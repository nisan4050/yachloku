// TEMPORARY: one-off import of the files exported from the old Supabase project.
// Only active while IMPORT_TOKEN is set. Remove this file (and its registration) afterwards.
import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { wrap } from './lib.js';

const { IMPORT_TOKEN, UPLOAD_DIR, PUBLIC_URL, RAILWAY_VOLUME_MOUNT_PATH } = process.env;
const BUCKETS = new Set(['receipts', 'event-photos', 'chat-media', 'feedback']);
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const NAME_RE = new RegExp(`^${UUID}(\\.[a-z0-9]{1,8})?$`, 'i');
const OLD_BASE = 'https://vzgbfgcefshqmkzhqndx.supabase.co/storage/v1/object/public/';

const sameToken = (given) => {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(IMPORT_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export function registerImportRoutes(app, pool) {
  if (!IMPORT_TOKEN || !UPLOAD_DIR) return;
  const onVolume = RAILWAY_VOLUME_MOUNT_PATH && path.resolve(UPLOAD_DIR).startsWith(path.resolve(RAILWAY_VOLUME_MOUNT_PATH));
  const guard = (req, res, next) => (onVolume && sameToken(req.headers['x-import-token']) ? next() : res.status(404).end());

  app.put(
    '/internal/import/:bucket/:owner/:file',
    guard,
    express.raw({ type: () => true, limit: '30mb' }),
    wrap(async (req, res) => {
      const { bucket, owner, file } = req.params;
      if (!BUCKETS.has(bucket) || !new RegExp(`^${UUID}$`, 'i').test(owner) || !NAME_RE.test(file)) return res.status(400).json({ error: 'bad path' });
      const dir = path.join(UPLOAD_DIR, bucket, owner);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, file), req.body);
      await fs.writeFile(path.join(dir, `${file}.type`), String(req.headers['content-type'] ?? 'application/octet-stream'));
      res.status(201).json({ bytes: req.body.length });
    })
  );

  // Rewrites the stored Supabase URLs to the new file host. `renames` maps files whose names were shortened.
  app.post('/internal/import/finish', guard, wrap(async (req, res) => {
    const base = `${PUBLIC_URL}/files/`;
    const renames = Array.isArray(req.body?.renames) ? req.body.renames : [];
    const columns = [
      ['expenses', 'receipt_url'], ['group_messages', 'media_url'], ['chat_messages', 'media_url'], ['developer_feedback', 'attachment_url'],
    ];
    const changed = {};
    for (const [table, col] of columns) {
      let total = 0;
      for (const r of renames) {
        const { rowCount } = await pool.query(`update ${table} set ${col} = replace(${col}, $1, $2) where ${col} like $3`, [
          `${OLD_BASE}${r.bucket}/${r.owner}/${r.from}`, `${OLD_BASE}${r.bucket}/${r.owner}/${r.to}`, `%${r.from}`,
        ]);
        total += rowCount;
      }
      const { rowCount } = await pool.query(`update ${table} set ${col} = replace(${col}, $1, $2) where ${col} like $3`, [OLD_BASE, base, `${OLD_BASE}%`]);
      changed[`${table}.${col}`] = total + rowCount;
    }
    // events.photos is a JSON array of { url, ... }
    for (const r of renames) {
      await pool.query(`update events set photos = replace(photos::text, $1, $2)::jsonb where photos::text like $3`, [
        `${OLD_BASE}${r.bucket}/${r.owner}/${r.from}`, `${OLD_BASE}${r.bucket}/${r.owner}/${r.to}`, `%${r.from}%`,
      ]);
    }
    const photos = await pool.query(`update events set photos = replace(photos::text, $1, $2)::jsonb where photos::text like $3`, [OLD_BASE, base, `%${OLD_BASE}%`]);
    changed['events.photos'] = photos.rowCount;

    const left = {};
    for (const [table, col] of columns) {
      left[`${table}.${col}`] = Number((await pool.query(`select count(*) from ${table} where ${col} like '%supabase.co%'`)).rows[0].count);
    }
    left['events.photos'] = Number((await pool.query(`select count(*) from events where photos::text like '%supabase.co%'`)).rows[0].count);
    res.json({ changed, remainingSupabaseUrls: left });
  }));
}
