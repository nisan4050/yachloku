import crypto from 'node:crypto';
import { wrap } from './lib.js';
import { sendEmail, escapeHtml } from './mail.js';
import { hashPassword, issueToken } from './auth.js';
import { isAdminEmail } from './admin.js';

const { APP_URL = 'https://www.yachloku.com' } = process.env;
const TOKEN_TTL_MINUTES = 60;
const MAX_REQUESTS_PER_HOUR = 3;

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function resetEmail(name, link) {
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
    <h2>איפוס סיסמה ליחלוקו</h2>
    <p>שלום ${escapeHtml(name)},</p>
    <p>קיבלנו בקשה לאפס את הסיסמה לחשבון שלך. הקישור תקף לשעה אחת:</p>
    <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#1f9d6e;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none">בחירת סיסמה חדשה</a></p>
    <p style="color:#666;font-size:13px">אם לא ביקשת לאפס סיסמה, אפשר להתעלם מהמייל הזה והסיסמה הנוכחית תישאר ללא שינוי.</p>
    <hr style="border:none;border-top:1px solid #eee">
    <div dir="ltr"><p>Hi ${escapeHtml(name)}, we received a request to reset your Yachloku password. Use the button above (valid for 1 hour). If this wasn't you, ignore this email.</p></div>
  </div>`;
}

export function registerPasswordResetRoutes(app, pool) {
  // Always answers the same way, so it cannot be used to discover which emails are registered.
  app.post('/auth/forgot', wrap(async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    res.json({ ok: true });
    if (!email) return;

    try {
      const { rows } = await pool.query('select id, email, name from app_users where email = $1', [email]);
      const user = rows[0];
      if (!user) return;
      const { rows: recent } = await pool.query(
        `select count(*)::int as n from password_resets where user_id = $1 and created_at > now() - interval '1 hour'`,
        [user.id]
      );
      if (recent[0].n >= MAX_REQUESTS_PER_HOUR) return;

      const token = crypto.randomBytes(32).toString('base64url');
      await pool.query(
        `insert into password_resets (token_hash, user_id, expires_at) values ($1, $2, now() + ($3 || ' minutes')::interval)`,
        [sha256(token), user.id, String(TOKEN_TTL_MINUTES)]
      );
      await sendEmail({
        to: user.email,
        subject: 'איפוס סיסמה ליחלוקו',
        html: resetEmail(user.name, `${APP_URL}/reset-password?token=${token}`),
      });
    } catch (err) {
      console.error('password reset request failed', err.message);
    }
  }));

  app.post('/auth/reset', wrap(async (req, res) => {
    const { token, password } = req.body ?? {};
    if (typeof token !== 'string' || !token || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'a valid token and a password of 6+ characters are required' });
    }
    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query(
        'select user_id from password_resets where token_hash = $1 and expires_at > now() for update',
        [sha256(token)]
      );
      if (!rows[0]) {
        await client.query('rollback');
        return res.status(400).json({ error: 'this link is invalid or has expired' });
      }
      const { rows: users } = await client.query(
        'update app_users set password_hash = $2 where id = $1 returning id, email, name',
        [rows[0].user_id, await hashPassword(password)]
      );
      await client.query('delete from password_resets where user_id = $1', [rows[0].user_id]);
      await client.query('commit');
      res.json({ token: issueToken(users[0]), user: { id: users[0].id, email: users[0].email, name: users[0].name, isAdmin: isAdminEmail(users[0].email) } });
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }));
}
