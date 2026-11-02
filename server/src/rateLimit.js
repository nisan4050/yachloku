import { HttpError } from './validate.js';

// Small in-memory sliding-window counter. One API replica only; move to Redis before scaling out (like realtime.js).
export function createLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> timestamps
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, times] of hits) {
      const live = times.filter((t) => t > cutoff);
      if (live.length) hits.set(key, live); else hits.delete(key);
    }
  }, 60_000).unref();

  const recent = (key) => {
    const cutoff = Date.now() - windowMs;
    const live = (hits.get(key) ?? []).filter((t) => t > cutoff);
    hits.set(key, live);
    return live;
  };

  return {
    isBlocked: (key) => recent(key).length >= max,
    record: (key) => { recent(key).push(Date.now()); },
    reset: (key) => { hits.delete(key); },
    // Counts the attempt and throws 429 once the key is over the limit.
    consume(key) {
      if (recent(key).length >= max) throw new HttpError(429, 'too many attempts, try again later');
      recent(key).push(Date.now());
    },
  };
}
