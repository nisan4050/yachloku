// Input validation helpers. Every check throws an HttpError, which the global error handler turns into a 4xx.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const bad = (message) => new HttpError(400, message);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);
export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// A string within [min, max] characters after trimming. `optional` lets undefined/null through as null.
export function text(value, label, { min = 1, max = 200, optional = false } = {}) {
  if (value === undefined || value === null) {
    if (optional) return null;
    throw bad(`${label} is required`);
  }
  if (typeof value !== 'string') throw bad(`${label} must be text`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw bad(`${label} is required`);
  if (trimmed.length > max) throw bad(`${label} must be at most ${max} characters`);
  return trimmed;
}

export function email(value) {
  const e = text(value, 'email', { max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(e)) throw bad('email is not valid');
  return e;
}

export function money(value, label, { allowZero = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw bad(`${label} must be a number`);
  if (allowZero ? value < 0 : value <= 0) throw bad(`${label} must be ${allowZero ? 'zero or more' : 'greater than zero'}`);
  if (value > 9_999_999_999) throw bad(`${label} is too large`);
  return value;
}

export function currency(value, label = 'currency') {
  if (typeof value !== 'string' || !CURRENCY_RE.test(value)) throw bad(`${label} must be a 3-letter currency code`);
  return value;
}

export function dateString(value, label = 'date') {
  if (typeof value !== 'string' || !DATE_RE.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw bad(`${label} must be a valid YYYY-MM-DD date`);
  }
  return value;
}

export function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) throw bad(`${label} must be one of: ${allowed.join(', ')}`);
  return value;
}

export function httpUrl(value, label, { optional = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw bad(`${label} is required`);
  }
  if (typeof value !== 'string' || value.length > 2000 || !/^https?:\/\/\S+$/i.test(value)) throw bad(`${label} must be an http(s) link`);
  return value;
}

export function array(value, label, { min = 0, max = 100 } = {}) {
  if (!Array.isArray(value)) throw bad(`${label} must be a list`);
  if (value.length < min) throw bad(`${label} needs at least ${min} item${min === 1 ? '' : 's'}`);
  if (value.length > max) throw bad(`${label} may have at most ${max} items`);
  return value;
}

export function object(value, label, { maxJson = 10_000 } = {}) {
  if (!isPlainObject(value)) throw bad(`${label} must be an object`);
  if (JSON.stringify(value).length > maxJson) throw bad(`${label} is too large`);
  return value;
}
