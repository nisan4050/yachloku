import { wrap } from './lib.js';
import { text, httpUrl } from './validate.js';
import { sendEmail, escapeHtml, mailEnabled } from './mail.js';
import { renderEmail, button, callout, COLORS, FONT } from './emailLayout.js';

const { FEEDBACK_TO = 'nisan4050@gmail.com', APP_URL = 'https://www.yachloku.com' } = process.env;

const RTL = 'direction:rtl;text-align:right;';

export function feedbackEmailHtml(row) {
  const name = escapeHtml(row.sender_name || row.sender_email || 'משתמש');
  const email = escapeHtml(row.sender_email);
  const sent = new Date(row.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'full', timeStyle: 'short' });
  const message = escapeHtml(row.message).replace(/\r?\n/g, '<br>');
  const initial = escapeHtml(String(row.sender_name || row.sender_email || '?').trim().charAt(0));

  const sender = `<table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" border="0" style="direction:rtl;margin:0 0 18px"><tr>
    <td dir="rtl" width="56" valign="top" style="${RTL}"><div style="width:44px;height:44px;border-radius:22px;background:${COLORS.brand};color:#ffffff;text-align:center;line-height:44px;font-family:${FONT};font-size:20px;font-weight:700">${initial}</div></td>
    <td dir="rtl" align="right" valign="middle" style="${RTL}font-family:${FONT}">
      <div dir="rtl" style="${RTL}font-size:17px;font-weight:700;color:${COLORS.text}">${name}</div>
      ${email ? `<div dir="rtl" style="${RTL}font-size:13px;margin-top:2px"><a href="mailto:${email}" style="color:${COLORS.brand};text-decoration:none"><bdi>${email}</bdi></a></div>` : ''}
      <div dir="rtl" style="${RTL}font-size:12.5px;color:${COLORS.faint};margin-top:4px">נשלח ב-${escapeHtml(sent)}</div>
    </td>
  </tr></table>`;

  const html = renderEmail({
    title: 'הערה חדשה מהאפליקציה',
    subtitle: `מאת ${row.sender_name || row.sender_email || 'משתמש'}`,
    preheader: String(row.message || '').slice(0, 120),
    body: [
      sender,
      callout(message),
      row.attachment_url ? button('📎 צפייה בקובץ המצורף', row.attachment_url, { variant: 'outline' }) : '',
      button('פתיחת לוח הניהול', `${APP_URL}/admin`),
    ].join('\n'),
    footer: `אפשר להשיב ישירות למייל הזה, והתשובה תגיע אל ${name}.`,
  });
  const text = [
    `הערה חדשה מ${row.sender_name || row.sender_email || 'משתמש'}${row.sender_email ? ` <${row.sender_email}>` : ''}`,
    `נשלח ב-${sent}`,
    '',
    String(row.message || ''),
    '',
    row.attachment_url ? `קובץ מצורף: ${row.attachment_url}` : '',
    `לוח הניהול: ${APP_URL}/admin`,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  return { html, text };
}

async function emailDeveloper(row) {
  if (!mailEnabled) return;
  await sendEmail({
    to: FEEDBACK_TO,
    replyTo: row.sender_email,
    subject: `הערה חדשה מ${row.sender_name || row.sender_email || 'משתמש'} · יחלוקו`,
    ...feedbackEmailHtml(row),
  });
}

export function registerFeedbackRoutes(app, pool, requireAuth) {
  app.post('/feedback', requireAuth, wrap(async (req, res) => {
    const message = text(req.body?.message, 'message', { max: 4000 });
    const attachmentUrl = httpUrl(req.body?.attachmentUrl, 'attachmentUrl');
    const { rows: users } = await pool.query('select email, name from app_users where id = $1', [req.userId]);
    if (!users[0]) return res.status(404).json({ error: 'user not found' });
    const { rows } = await pool.query(
      `insert into developer_feedback (user_id, message, attachment_url, sender_email, sender_name)
       values ($1, $2, $3, $4, $5) returning *`,
      [req.userId, message, attachmentUrl, users[0].email, users[0].name]
    );
    emailDeveloper(rows[0]).catch((err) => console.error('feedback email failed', err.message));
    res.status(201).json({ id: rows[0].id });
  }));
}
