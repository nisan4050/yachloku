const { RESEND_API_KEY, MAIL_FROM = 'Yachloku <onboarding@resend.dev>' } = process.env;

export const mailEnabled = Boolean(RESEND_API_KEY);

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Sends through Resend. Throws on failure so callers decide whether it matters.
export async function sendEmail({ to, subject, html, replyTo }) {
  if (!mailEnabled) throw new Error('email is not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: Array.isArray(to) ? to : [to], subject, html, reply_to: replyTo || undefined }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
