import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const { JWT_SECRET, GOOGLE_WEB_CLIENT_ID } = process.env;
const googleClient = new OAuth2Client(GOOGLE_WEB_CLIENT_ID);

export function issueToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

export async function verifyGoogleIdToken(idToken) {
  const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_WEB_CLIENT_ID });
  const payload = ticket.getPayload();
  return { email: payload.email, name: payload.name ?? payload.email, emailVerified: payload.email_verified };
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function checkPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// EventSource cannot send headers, so SSE endpoints take the token from the query string.
export function requireAuthStream(req, res, next) {
  const token = typeof req.query.token === 'string' ? req.query.token : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    req.userId = jwt.verify(token, JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}
