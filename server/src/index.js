import express from 'express';
import pg from 'pg';
import { issueToken, requireAuth, requireAuthStream, verifyGoogleIdToken, hashPassword, checkPassword, bindUserPool, forgetUser } from './auth.js';
import { text, email as emailField, HttpError, bad } from './validate.js';
import { createLimiter } from './rateLimit.js';
import { migrate } from './migrate.js';
import { wrap } from './lib.js';
import { registerEventRoutes } from './events.js';
import { registerExpenseRoutes } from './expenses.js';
import { registerPollRoutes } from './polls.js';
import { registerProfileRoutes } from './profile.js';
import { registerAccountRoutes } from './account.js';
import { registerChatRoutes } from './chat.js';
import { registerUploadRoutes } from './uploads.js';
import { registerFeedbackRoutes } from './feedback.js';
import { registerPasswordResetRoutes } from './passwordReset.js';
import { registerAdminRoutes, trackActivity, isAdminEmail } from './admin.js';
import { createPushDelivery, registerPushRoutes, pushStatus } from './push.js';

const { DATABASE_URL, JWT_SECRET, PORT = 3000, CORS_ORIGINS = '' } = process.env;

if (!DATABASE_URL || !JWT_SECRET) {
  console.error('DATABASE_URL and JWT_SECRET are required');
  process.exit(1);
}

// Match what the frontend was built against: numeric columns as numbers, DATE columns as 'YYYY-MM-DD' strings.
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(1082, (v) => v);

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await migrate(pool);
bindUserPool(pool);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway's edge proxy: req.ip must be the real client for rate limiting
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
const jsonParser = express.json({ limit: '1mb' });
app.use((req, res, next) => (req.path.startsWith('/uploads') ? next() : jsonParser(req, res, next)));

const allowedOrigins = CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || /^(https?|capacitor):\/\/localhost(:\d+)?$/.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(trackActivity(pool));

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, isAdmin: isAdminEmail(u.email) });

const ensureProfile = (user) =>
  pool.query(
    'insert into profiles (id, email, full_name) values ($1, $2, $3) on conflict (id) do nothing',
    [user.id, user.email, user.name]
  );

app.get('/health', async (_req, res) => {
  try {
    const { rows } = await pool.query('select 1 as ok');
    res.json({ status: 'ok', db: rows[0].ok === 1, push: pushStatus() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

const registerLimit = createLimiter({ windowMs: 60 * 60 * 1000, max: 60 });
const loginFailsByIp = createLimiter({ windowMs: 15 * 60 * 1000, max: 100 });
const loginFailsByAccount = createLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const MAX_PASSWORD = 200; // bcrypt only reads 72 bytes; anything much longer is abuse

app.post('/auth/register', wrap(async (req, res) => {
  registerLimit.consume(req.ip);
  const body = req.body ?? {};
  const normalized = emailField(body.email);
  const name = text(body.name, 'name', { max: 100 });
  if (typeof body.password !== 'string' || body.password.length < 6 || body.password.length > MAX_PASSWORD) {
    throw bad(`password must be 6-${MAX_PASSWORD} characters`);
  }
  const { rows: existing } = await pool.query('select id from app_users where email = $1', [normalized]);
  if (existing.length) return res.status(409).json({ error: 'email already registered' });
  // The unique constraint settles concurrent sign-ups: the loser gets a 409 from the error handler.
  const { rows } = await pool.query(
    'insert into app_users (email, name, password_hash) values ($1, $2, $3) returning id, email, name',
    [normalized, name, await hashPassword(body.password)]
  );
  await ensureProfile(rows[0]);
  res.status(201).json({ token: issueToken(rows[0]), user: publicUser(rows[0]) });
}));

app.post('/auth/login', wrap(async (req, res) => {
  const body = req.body ?? {};
  if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.password.length > MAX_PASSWORD) {
    return res.status(401).json({ error: 'invalid email or password' });
  }
  const normalized = body.email.trim().toLowerCase();
  const accountKey = `${req.ip}|${normalized}`;
  if (loginFailsByIp.isBlocked(req.ip) || loginFailsByAccount.isBlocked(accountKey)) {
    throw new HttpError(429, 'too many failed attempts, try again in a few minutes');
  }
  const { rows } = await pool.query('select * from app_users where email = $1', [normalized]);
  const user = rows[0];
  if (!user || !user.password_hash || !(await checkPassword(body.password, user.password_hash))) {
    loginFailsByIp.record(req.ip);
    loginFailsByAccount.record(accountKey);
    return res.status(401).json({ error: 'invalid email or password' });
  }
  loginFailsByAccount.reset(accountKey);
  res.json({ token: issueToken(user), user: publicUser(user) });
}));

app.post('/auth/google', wrap(async (req, res) => {
  const { idToken } = req.body ?? {};
  if (typeof idToken !== 'string' || !idToken) return res.status(400).json({ error: 'idToken is required' });
  let google;
  try {
    google = await verifyGoogleIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'invalid Google token' });
  }
  if (!google.emailVerified) return res.status(401).json({ error: 'Google email is not verified' });
  const mail = google.email.toLowerCase();
  const client = await pool.connect();
  let user;
  try {
    await client.query('begin');
    const { rows: found } = await client.query(
      'select id, email, name, google_sub from app_users where google_sub = $1 or email = $2 order by (google_sub = $1) desc nulls last limit 1 for update',
      [google.sub, mail]
    );
    user = found[0];
    if (!user) {
      ({ rows: [user] } = await client.query(
        'insert into app_users (email, name, google_sub) values ($1, $2, $3) returning id, email, name',
        [mail, google.name, google.sub]
      ));
    } else if (!user.google_sub) {
      // First Google sign-in for an account created with a password. Email addresses are not verified at sign-up, so anyone
      // could have registered this address first: drop that password and end its sessions. The owner can set a new one by email.
      await client.query(
        `update app_users set google_sub = $2,
           password_changed_at = case when password_hash is not null then now() else password_changed_at end,
           password_hash = null
         where id = $1`,
        [user.id, google.sub]
      );
      forgetUser(user.id);
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
  await ensureProfile(user);
  res.json({ token: issueToken(user), user: publicUser(user) });
}));

app.get('/auth/me', requireAuth, wrap(async (req, res) => {
  const { rows } = await pool.query('select id, email, name from app_users where id = $1', [req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'user not found' });
  res.json({ user: publicUser(rows[0]) });
}));

registerEventRoutes(app, pool, requireAuth);
registerExpenseRoutes(app, pool, requireAuth);
registerPollRoutes(app, pool, requireAuth);
registerProfileRoutes(app, pool, requireAuth, createPushDelivery(pool));
registerPushRoutes(app, pool, requireAuth);
registerAccountRoutes(app, pool, requireAuth);
registerChatRoutes(app, pool, requireAuth, requireAuthStream);
registerUploadRoutes(app, pool, requireAuth);
registerFeedbackRoutes(app, pool, requireAuth);
registerPasswordResetRoutes(app, pool);
registerAdminRoutes(app, pool, requireAuth);

// Postgres errors caused by bad input are the client's fault, not a server failure.
const PG_CLIENT_ERRORS = {
  '22P02': [400, 'invalid value'], '22003': [400, 'number out of range'], '22007': [400, 'invalid date'], '22008': [400, 'invalid date'],
  '22001': [400, 'value too long'], '23502': [400, 'a required field is missing'], '23514': [400, 'value not allowed'], '22023': [400, 'invalid value'],
  '23503': [409, 'refers to something that does not exist'], '23505': [409, 'already exists'],
};

app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'request body is too large' });
  const mapped = PG_CLIENT_ERRORS[err.code];
  if (mapped) return res.status(mapped[0]).json({ error: mapped[1] });
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

app.listen(PORT, () => console.log(`yachloku-api listening on ${PORT}`));
