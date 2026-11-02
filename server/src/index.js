import express from 'express';
import pg from 'pg';
import { issueToken, requireAuth, requireAuthStream, verifyGoogleIdToken, hashPassword, checkPassword } from './auth.js';
import { migrate } from './migrate.js';
import { wrap } from './lib.js';
import { registerEventRoutes } from './events.js';
import { registerExpenseRoutes } from './expenses.js';
import { registerPollRoutes } from './polls.js';
import { registerProfileRoutes } from './profile.js';
import { registerAccountRoutes } from './account.js';
import { registerChatRoutes } from './chat.js';

const { DATABASE_URL, JWT_SECRET, PORT = 3000, CORS_ORIGINS = '' } = process.env;

if (!DATABASE_URL || !JWT_SECRET) {
  console.error('DATABASE_URL and JWT_SECRET are required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await migrate(pool);

const app = express();
app.use(express.json({ limit: '1mb' }));

const allowedOrigins = CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

const ensureProfile = (user) =>
  pool.query(
    'insert into profiles (id, email, full_name) values ($1, $2, $3) on conflict (id) do nothing',
    [user.id, user.email, user.name]
  );

app.get('/health', async (_req, res) => {
  try {
    const { rows } = await pool.query('select 1 as ok');
    res.json({ status: 'ok', db: rows[0].ok === 1 });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

app.post('/auth/register', wrap(async (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password || password.length < 6 || !name) {
    return res.status(400).json({ error: 'email, name and a password of 6+ characters are required' });
  }
  const normalized = String(email).trim().toLowerCase();
  const { rows: existing } = await pool.query('select id from app_users where email = $1', [normalized]);
  if (existing.length) return res.status(409).json({ error: 'email already registered' });
  const { rows } = await pool.query(
    'insert into app_users (email, name, password_hash) values ($1, $2, $3) returning id, email, name',
    [normalized, String(name).trim(), await hashPassword(password)]
  );
  await ensureProfile(rows[0]);
  res.status(201).json({ token: issueToken(rows[0]), user: publicUser(rows[0]) });
}));

app.post('/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body ?? {};
  const { rows } = await pool.query('select * from app_users where email = $1', [String(email ?? '').trim().toLowerCase()]);
  const user = rows[0];
  if (!user || !user.password_hash || !(await checkPassword(password ?? '', user.password_hash))) {
    return res.status(401).json({ error: 'invalid email or password' });
  }
  res.json({ token: issueToken(user), user: publicUser(user) });
}));

app.post('/auth/google', wrap(async (req, res) => {
  const { idToken } = req.body ?? {};
  if (!idToken) return res.status(400).json({ error: 'idToken is required' });
  let google;
  try {
    google = await verifyGoogleIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'invalid Google token' });
  }
  if (!google.emailVerified) return res.status(401).json({ error: 'Google email is not verified' });
  const email = google.email.toLowerCase();
  const { rows } = await pool.query(
    `insert into app_users (email, name) values ($1, $2)
     on conflict (email) do update set name = app_users.name
     returning id, email, name`,
    [email, google.name]
  );
  await ensureProfile(rows[0]);
  res.json({ token: issueToken(rows[0]), user: publicUser(rows[0]) });
}));

app.get('/auth/me', requireAuth, wrap(async (req, res) => {
  const { rows } = await pool.query('select id, email, name from app_users where id = $1', [req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'user not found' });
  res.json({ user: publicUser(rows[0]) });
}));

registerEventRoutes(app, pool, requireAuth);
registerExpenseRoutes(app, pool, requireAuth);
registerPollRoutes(app, pool, requireAuth);
registerProfileRoutes(app, pool, requireAuth);
registerAccountRoutes(app, pool, requireAuth);
registerChatRoutes(app, pool, requireAuth, requireAuthStream);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

app.listen(PORT, () => console.log(`yachloku-api listening on ${PORT}`));
