import express from 'express';
import pg from 'pg';
import { issueToken, requireAuth, verifyGoogleIdToken, hashPassword, checkPassword } from './auth.js';

const { DATABASE_URL, JWT_SECRET, PORT = 3000 } = process.env;

if (!DATABASE_URL || !JWT_SECRET) {
  console.error('DATABASE_URL and JWT_SECRET are required');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

await pool.query(`
  create table if not exists app_users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    name text not null,
    password_hash text,
    google_sub text unique,
    created_at timestamptz not null default now()
  )
`);

const app = express();
app.use(express.json());

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

app.get('/health', async (_req, res) => {
  try {
    const { rows } = await pool.query('select 1 as ok');
    res.json({ status: 'ok', db: rows[0].ok === 1 });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

app.post('/auth/register', async (req, res) => {
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
  res.status(201).json({ token: issueToken(rows[0]), user: publicUser(rows[0]) });
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const { rows } = await pool.query('select * from app_users where email = $1', [String(email ?? '').trim().toLowerCase()]);
  const user = rows[0];
  if (!user || !user.password_hash || !(await checkPassword(password ?? '', user.password_hash))) {
    return res.status(401).json({ error: 'invalid email or password' });
  }
  res.json({ token: issueToken(user), user: publicUser(user) });
});

app.post('/auth/google', async (req, res) => {
  const { idToken } = req.body ?? {};
  if (!idToken) return res.status(400).json({ error: 'idToken is required' });
  let google;
  try {
    google = await verifyGoogleIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'invalid Google token' });
  }
  const email = google.email.toLowerCase();
  const { rows } = await pool.query(
    `insert into app_users (email, name, google_sub)
     values ($1, $2, null)
     on conflict (email) do update set name = app_users.name
     returning id, email, name`,
    [email, google.name]
  );
  res.json({ token: issueToken(rows[0]), user: publicUser(rows[0]) });
});

app.get('/auth/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('select id, email, name from app_users where id = $1', [req.userId]);
  if (!rows[0]) return res.status(404).json({ error: 'user not found' });
  res.json({ user: publicUser(rows[0]) });
});

app.listen(PORT, () => console.log(`yachloku-api listening on ${PORT}`));
