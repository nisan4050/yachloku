import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { wrap, getMemberEvent } from './lib.js';

const { UPLOAD_DIR, PUBLIC_URL, RAILWAY_ENVIRONMENT, RAILWAY_VOLUME_MOUNT_PATH } = process.env;

// On Railway the container disk is wiped on every deploy, so uploads must live on an attached volume.
const storagePersistent = Boolean(UPLOAD_DIR) && (!RAILWAY_ENVIRONMENT || (RAILWAY_VOLUME_MOUNT_PATH && path.resolve(UPLOAD_DIR).startsWith(path.resolve(RAILWAY_VOLUME_MOUNT_PATH))));
if (UPLOAD_DIR && !storagePersistent) console.error('UPLOAD_DIR is not on a persistent volume; uploads are disabled');
const MAX_BYTES = 25 * 1024 * 1024;
const EVENT_BUCKETS = new Set(['receipts', 'event-photos', 'chat-media']);
const USER_BUCKETS = new Set(['feedback', 'avatars']);
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const FILE_RE = new RegExp(`^(${UUID})/(${UUID}(?:\\.[a-z0-9]{1,8})?)$`, 'i');
const INLINE_TYPES = /^(image\/(png|jpe?g|gif|webp|avif|heic|heif)|video\/|audio\/|application\/pdf)/i;

const bucketDir = (bucket) => path.join(UPLOAD_DIR, bucket);

export async function removeEventFiles(eventId) {
  if (!UPLOAD_DIR) return;
  for (const bucket of EVENT_BUCKETS) {
    await fs.rm(path.join(bucketDir(bucket), eventId), { recursive: true, force: true }).catch(() => {});
  }
}

export function registerUploadRoutes(app, pool, requireAuth) {
  // Raw body upload: POST /uploads/:bucket?path=<ownerId>/<uuid>.<ext>
  app.post(
    '/uploads/:bucket',
    requireAuth,
    express.raw({ type: () => true, limit: MAX_BYTES }),
    wrap(async (req, res) => {
      if (!storagePersistent) return res.status(503).json({ error: 'file storage is not configured' });
      const { bucket } = req.params;
      const match = FILE_RE.exec(String(req.query.path ?? ''));
      if (!match || !(EVENT_BUCKETS.has(bucket) || USER_BUCKETS.has(bucket))) return res.status(400).json({ error: 'invalid bucket or path' });
      const [, ownerId, fileName] = match;

      if (EVENT_BUCKETS.has(bucket)) {
        if (!(await getMemberEvent(pool, ownerId, req.userId))) return res.status(404).json({ error: 'event not found' });
      } else if (ownerId.toLowerCase() !== String(req.userId).toLowerCase()) {
        return res.status(403).json({ error: 'not allowed' });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'empty file' });

      const dir = path.join(bucketDir(bucket), ownerId);
      await fs.mkdir(dir, { recursive: true });
      try {
        await fs.writeFile(path.join(dir, fileName), req.body, { flag: 'wx' });
      } catch (err) {
        if (err.code === 'EEXIST') return res.status(409).json({ error: 'file already exists' });
        throw err;
      }
      await fs.writeFile(path.join(dir, `${fileName}.type`), String(req.headers['content-type'] ?? 'application/octet-stream'));

      const base = PUBLIC_URL || `${req.headers['x-forwarded-proto'] ?? req.protocol}://${req.headers.host}`;
      res.status(201).json({ url: `${base}/files/${bucket}/${ownerId}/${fileName}` });
    })
  );

  // Public read. Paths contain two random UUIDs, same exposure model as the old public buckets.
  app.get('/files/:bucket/:ownerId/:fileName', wrap(async (req, res) => {
    if (!UPLOAD_DIR) return res.status(404).end();
    const { bucket, ownerId, fileName } = req.params;
    if (!(EVENT_BUCKETS.has(bucket) || USER_BUCKETS.has(bucket)) || !FILE_RE.test(`${ownerId}/${fileName}`)) return res.status(404).end();
    const file = path.join(bucketDir(bucket), ownerId, fileName);
    let type = 'application/octet-stream';
    try {
      type = (await fs.readFile(`${file}.type`, 'utf8')).trim() || type;
    } catch {
      /* no sidecar: keep default */
    }
    res.setHeader('Content-Type', type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Disposition', INLINE_TYPES.test(type) ? 'inline' : 'attachment');
    res.sendFile(file, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  }));
}
