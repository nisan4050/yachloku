import { wrap } from './lib.js';
import { sendEmail, escapeHtml, mailEnabled } from './mail.js';

const { FEEDBACK_TO = 'nisan4050@gmail.com' } = process.env;

async function emailDeveloper(row) {
  if (!mailEnabled) return;
  const html = `
    <p><strong>From:</strong> ${escapeHtml(row.sender_name)} &lt;${escapeHtml(row.sender_email)}&gt;</p>
    <p><strong>User id:</strong> ${escapeHtml(row.user_id)}<br><strong>Sent:</strong> ${escapeHtml(row.created_at.toISOString())}</p>
    <p>${escapeHtml(row.message).replace(/\n/g, '<br>')}</p>
    ${row.attachment_url ? `<p><a href="${escapeHtml(row.attachment_url)}">Attachment</a></p>` : ''}`;
  await sendEmail({
    to: FEEDBACK_TO,
    replyTo: row.sender_email,
    subject: `Yachloku feedback from ${row.sender_name || row.sender_email || 'a user'}`,
    html,
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
