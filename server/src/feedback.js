import { wrap } from './lib.js';

const { RESEND_API_KEY, FEEDBACK_TO = 'nisan4050@gmail.com', FEEDBACK_FROM = 'Yachloku Feedback <onboarding@resend.dev>' } = process.env;

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function emailDeveloper(row) {
  if (!RESEND_API_KEY) return;
  const html = `
    <p><strong>From:</strong> ${escapeHtml(row.sender_name)} &lt;${escapeHtml(row.sender_email)}&gt;</p>
    <p><strong>User id:</strong> ${escapeHtml(row.user_id)}<br><strong>Sent:</strong> ${escapeHtml(row.created_at.toISOString())}</p>
    <p>${escapeHtml(row.message).replace(/\n/g, '<br>')}</p>
    ${row.attachment_url ? `<p><a href="${escapeHtml(row.attachment_url)}">Attachment</a></p>` : ''}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FEEDBACK_FROM,
      to: [FEEDBACK_TO],
      reply_to: row.sender_email || undefined,
      subject: `Yachloku feedback from ${row.sender_name || row.sender_email || 'a user'}`,
      html,
    }),
  });
  if (!res.ok) console.error('feedback email failed', res.status, await res.text());
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
    emailDeveloper(rows[0]).catch((err) => console.error('feedback email failed', err));
    res.status(201).json({ id: rows[0].id });
  }));
}
