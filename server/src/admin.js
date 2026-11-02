import fs from 'node:fs/promises';
import path from 'node:path';
import { wrap } from './lib.js';
import { verifyToken } from './auth.js';

const { ADMIN_EMAILS = 'nisan4050@gmail.com', UPLOAD_DIR } = process.env;
const adminEmails = new Set(ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));

export const isAdminEmail = (email) => adminEmails.has(String(email ?? '').toLowerCase());

// Records "last seen" for authenticated requests, at most once every 5 minutes per user.
export function trackActivity(pool) {
  const lastWrite = new Map();
  return (req, _res, next) => {
    const header = req.headers.authorization ?? '';
    const userId = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
    if (userId && Date.now() - (lastWrite.get(userId) ?? 0) > 5 * 60 * 1000) {
      lastWrite.set(userId, Date.now());
      pool.query('update app_users set last_seen_at = now() where id = $1', [userId]).catch(() => {});
    }
    next();
  };
}

async function directorySize(dir) {
  let total = 0;
  let files = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await directorySize(full);
      total += sub.total;
      files += sub.files;
    } else if (!entry.name.endsWith('.type')) {
      total += (await fs.stat(full).catch(() => ({ size: 0 }))).size;
      files += 1;
    }
  }
  return { total, files };
}

export function registerAdminRoutes(app, pool, requireAuth) {
  const requireAdmin = [
    requireAuth,
    wrap(async (req, res, next) => {
      const { rows } = await pool.query('select email from app_users where id = $1', [req.userId]);
      if (!isAdminEmail(rows[0]?.email)) return res.status(403).json({ error: 'admin only' });
      next();
    }),
  ];

  app.get('/admin/overview', requireAdmin, wrap(async (_req, res) => {
    const { rows: users } = await pool.query(`
      select u.id, u.email, u.name, u.created_at, u.last_seen_at,
             (u.password_hash is not null) as has_password,
             (u.google_sub is not null) as has_google,
             (select count(*)::int from events e
                where e.created_by::text = u.id::text or e.manager_user_id::text = u.id::text
                   or e.participants @> jsonb_build_array(jsonb_build_object('user_id', u.id::text))) as events,
             (select count(*)::int from expenses x where x.created_by::text = u.id::text) as expenses,
             ((select count(*) from group_messages m where m.from_user_id::text = u.id::text)
              + (select count(*) from chat_messages c where c.from_user_id::text = u.id::text and c.is_system is not true))::int as messages
      from app_users u order by coalesce(u.last_seen_at, u.created_at) desc`);

    const { rows: [totals] } = await pool.query(`
      select (select count(*)::int from app_users) as users,
             (select count(*)::int from app_users where last_seen_at > now() - interval '7 days') as active_7d,
             (select count(*)::int from app_users where last_seen_at > now() - interval '30 days') as active_30d,
             (select count(*)::int from app_users where created_at > now() - interval '7 days') as new_7d,
             (select count(*)::int from events) as events,
             (select count(*)::int from events where status = 'active') as active_events,
             (select count(*)::int from expenses) as expenses,
             (select count(*)::int from group_messages) + (select count(*)::int from chat_messages where is_system is not true) as messages,
             (select count(*)::int from developer_feedback) as feedback`);

    const storage = UPLOAD_DIR ? await directorySize(UPLOAD_DIR) : { total: 0, files: 0 };
    res.json({ totals: { ...totals, storage_bytes: storage.total, storage_files: storage.files }, users });
  }));

  app.get('/admin/feedback', requireAdmin, wrap(async (_req, res) => {
    const { rows } = await pool.query('select id, user_id, sender_name, sender_email, message, attachment_url, created_at from developer_feedback order by created_at desc limit 100');
    res.json(rows);
  }));
}
