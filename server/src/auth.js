import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { isUuid } from './validate.js';

const { JWT_SECRET, GOOGLE_WEB_CLIENT_ID } = process.env;
const googleClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);

export function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

// ---- token validation ----
// A signed token is only trusted while its user still exists and has not changed their password since it was issued.
// The lookup is cached briefly so ordinary requests do not each hit the database.
const CACHE_MS = 60_000;
const known = new Map(); // userId -> { until, changedAt }
let userPool = null;

export const bindUserPool = (pool) => { userPool = pool; };
export const forgetUser = (userId) => known.delete(String(userId));

async function lookupUser(userId) {
  const hit = known.get(userId);
  if (hit && hit.until > Date.now()) return hit;
  const { rows } = await userPool.query('select extract(epoch from password_changed_at) as changed from app_users where id = $1', [userId]);
  if (!rows[0]) {
    known.delete(userId);
    return null;
  }
  if (known.size > 5000) known.clear();
  const entry = { until: Date.now() + CACHE_MS, changedAt: rows[0].changed === null ? 0 : Number(rows[0].changed) };
  known.set(userId, entry);
  return entry;
}

async function authenticate(token) {
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
  if (!isUuid(payload.sub)) return null;
  const user = await lookupUser(payload.sub);
  if (!user) return null;
  if (user.changedAt && payload.iat < Math.floor(user.changedAt)) return null;
  return payload.sub;
}

function guard(readToken) {
  return async (req, res, next) => {
    try {
      const token = readToken(req);
      if (!token) return res.status(401).json({ error: 'missing token' });
      const userId = await authenticate(token);
      if (!userId) return res.status(401).json({ error: 'invalid token' });
      req.userId = userId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireAuth = guard((req) => {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
});

// EventSource cannot send headers, so SSE endpoints take the token from the query string.
export const requireAuthStream = guard((req) => (typeof req.query.token === 'string' ? req.query.token : null));

// Returns the user id for a validly signed token, or null (no throwing, for best-effort callers).
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET).sub;
  } catch {
    return null;
  }
}

export async function verifyGoogleIdToken(idToken) {
  const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_WEB_CLIENT_ID });
  const payload = ticket.getPayload();
  return { sub: payload.sub, email: payload.email, name: payload.name ?? payload.email, emailVerified: payload.email_verified };
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function checkPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
