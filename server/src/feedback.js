import { wrap } from './lib.js';
import { sendEmail, escapeHtml, mailEnabled } from './mail.js';

const { FEEDBACK_TO = 'nisan4050@gmail.com', APP_URL = 'https://www.yachloku.com' } = process.env;

const FONT = "-apple-system,'Segoe UI',Arial,'Helvetica Neue',sans-serif";
// Gmail drops <html>/<body> attributes, so direction is stated on every block.
const RTL = 'direction:rtl;text-align:right;';
const DIR = 'dir="rtl" align="right"';

export function feedbackEmailHtml(row) {
  const name = escapeHtml(row.sender_name || row.sender_email || 'משתמש');
  const email = escapeHtml(row.sender_email);
  const sent = new Date(row.created_at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'full', timeStyle: 'short' });
  const message = escapeHtml(row.message).replace(/\r?\n/g, '<br>');
  const initial = escapeHtml(String(row.sender_name || row.sender_email || '?').trim().charAt(0));
  const attachment = row.attachment_url
    ? `<tr><td ${DIR} style="${RTL}padding:0 28px 8px"><a href="${escapeHtml(row.attachment_url)}" style="display:inline-block;padding:10px 18px;border:1px solid #cfe9dd;border-radius:10px;color:#1f9d6e;text-decoration:none;font-size:14px;font-weight:600">📎 צפייה בקובץ המצורף</a></td></tr>`
    : '';

  return `<!doctype html>
<html lang="he" dir="rtl"><body dir="rtl" style="${RTL}margin:0;padding:24px 12px;background:#eef5f1;font-family:${FONT};color:#1c2b25">
<div ${DIR} style="${RTL}">
<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="direction:rtl;max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden">
  <tr><td ${DIR} style="${RTL}background:#1f9d6e;padding:22px 28px;color:#ffffff">
    <div ${DIR} style="${RTL}font-size:22px;font-weight:700">🧳 יחלוקו</div>
    <div ${DIR} style="${RTL}font-size:14px;margin-top:4px;color:#e6f6ee">התקבלה הערה חדשה מהאפליקציה</div>
  </td></tr>
  <tr><td ${DIR} style="${RTL}padding:24px 28px 8px">
    <table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="direction:rtl"><tr>
      <td ${DIR} width="56" valign="top" style="${RTL}"><div style="width:44px;height:44px;border-radius:22px;background:#1f9d6e;color:#ffffff;text-align:center;line-height:44px;font-size:20px;font-weight:700">${initial}</div></td>
      <td ${DIR} valign="middle" style="${RTL}padding-right:4px">
        <div ${DIR} style="${RTL}font-size:17px;font-weight:700">${name}</div>
        <div ${DIR} style="${RTL}font-size:13px;margin-top:2px"><a href="mailto:${email}" style="color:#1f9d6e;text-decoration:none"><bdi>${email}</bdi></a></div>
      </td>
    </tr></table>
    <div ${DIR} style="${RTL}font-size:12.5px;color:#7a8a83;margin-top:12px">נשלח ב-${escapeHtml(sent)}</div>
  </td></tr>
  <tr><td ${DIR} style="${RTL}padding:12px 28px 20px">
    <div ${DIR} style="${RTL}background:#f4faf7;border-right:4px solid #1f9d6e;border-radius:10px;padding:16px 18px;font-size:16px;line-height:1.7">${message}</div>
  </td></tr>
  ${attachment}
  <tr><td ${DIR} style="${RTL}padding:12px 28px 26px">
    <a href="${escapeHtml(APP_URL)}/admin" style="display:inline-block;background:#1f9d6e;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600">פתיחת לוח הניהול</a>
    <div ${DIR} style="${RTL}font-size:12px;color:#8a9892;margin-top:16px">אפשר להשיב ישירות למייל הזה, והתשובה תגיע אל ${name}.</div>
  </td></tr>
</table>
</div>
</body></html>`;
}

async function emailDeveloper(row) {
  if (!mailEnabled) return;
  await sendEmail({
    to: FEEDBACK_TO,
    replyTo: row.sender_email,
    subject: `הערה חדשה מ${row.sender_name || row.sender_email || 'משתמש'} · יחלוקו`,
    html: feedbackEmailHtml(row),
  });
}

export function registerFeedbackRoutes(app, pool, requireAuth) {
  app.post('/feedback', requireAuth, wrap(async (req, res) => {
    const message = String(req.body?.message ?? '').trim();
    if (message.length < 1 || message.length > 4000) return res.status(400).json({ error: 'message must be 1-4000 characters' });
    const { rows: users } = await pool.query('select email, name from app_users where id = $1', [req.userId]);
    if (!users[0]) return res.status(404).json({ error: 'user not found' });
    const { rows } = await pool.query(
      `insert into developer_feedback (user_id, message, attachment_url, sender_email, sender_name)
       values ($1, $2, $3, $4, $5) returning *`,
      [req.userId, message, req.body?.attachmentUrl ?? null, users[0].email, users[0].name]
    );
    emailDeveloper(rows[0]).catch((err) => console.error('feedback email failed', err.message));
    res.status(201).json({ id: rows[0].id });
  }));
}
