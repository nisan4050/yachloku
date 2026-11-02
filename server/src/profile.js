import { wrap, getMemberEvent, jsonVal } from './lib.js';
import { bad, text, array, object, isPlainObject } from './validate.js';
import { emitToUser } from './realtime.js';

const PREF_KEY_BY_TYPE = { chat: 'chat', poll: 'chat', expense: 'expenses', settlement: 'balance_changes' };

export function registerProfileRoutes(app, pool, requireAuth, deliverPush = async () => {}) {
  // ---- profile ----
  app.get('/me/profile', requireAuth, wrap(async (req, res) => {
    const { rows } = await pool.query('select * from profiles where id = $1', [req.userId]);
    if (!rows[0]) return res.status(404).json({ error: 'profile not found' });
    res.json(rows[0]);
  }));

  app.patch('/me/profile', requireAuth, wrap(async (req, res) => {
    const { notification_prefs, phone } = req.body ?? {};
    const sets = [];
    const args = [];
    if (notification_prefs !== undefined) {
      object(notification_prefs, 'notification_prefs', { maxJson: 1000 });
      if (!Object.values(notification_prefs).every((v) => typeof v === 'boolean')) throw bad('notification_prefs values must be true or false');
      args.push(jsonVal(notification_prefs)); sets.push(`notification_prefs = $${args.length}::jsonb`);
    }
    if (phone !== undefined) { args.push(text(phone, 'phone', { min: 0, max: 30, optional: true }) || null); sets.push(`phone = $${args.length}`); }
    if (sets.length === 0) return res.status(400).json({ error: 'nothing to update' });
    args.push(req.userId);
    const { rows } = await pool.query(`update profiles set ${sets.join(', ')}, updated_at = now() where id = $${args.length} returning *`, args);
    res.json(rows[0]);
  }));

  // Only phone numbers of people the caller shares a trip with.
  app.get('/profiles', requireAuth, wrap(async (req, res) => {
    const ids = String(req.query.ids ?? '').split(',').filter(Boolean).slice(0, 200);
    if (ids.length === 0) return res.json([]);
    const { rows } = await pool.query(
      `select p.id, p.phone from profiles p
       where p.id::text = any($1::text[])
         and (p.id::text = $2::text or exists (
           select 1 from events e
           where (e.created_by::text = $2::text or e.manager_user_id::text = $2::text
                  or e.participants @> jsonb_build_array(jsonb_build_object('user_id', $2::text)))
             and (e.created_by::text = p.id::text or e.manager_user_id::text = p.id::text
                  or e.participants @> jsonb_build_array(jsonb_build_object('user_id', p.id::text)))
         ))`,
      [ids, req.userId]
    );
    res.json(rows);
  }));

  // ---- notifications ----
  app.get('/notifications', requireAuth, wrap(async (req, res) => {
    const { rows } = await pool.query('select * from notifications where user_id = $1 order by created_at desc limit 50', [req.userId]);
    res.json(rows);
  }));

  app.post('/notifications/read-all', requireAuth, wrap(async (req, res) => {
    await pool.query('update notifications set read = true where user_id = $1 and read = false', [req.userId]);
    emitToUser(req.userId, 'notification', { eventType: 'UPDATE' });
    res.status(204).end();
  }));

  app.post('/notifications/:id/read', requireAuth, wrap(async (req, res) => {
    await pool.query('update notifications set read = true where id = $1 and user_id = $2', [req.params.id, req.userId]);
    emitToUser(req.userId, 'notification', { eventType: 'UPDATE' });
    res.status(204).end();
  }));

  // Fan-out to the other members of an event, honouring each person's notification prefs.
  app.post('/events/:id/notify', requireAuth, wrap(async (req, res) => {
    const event = await getMemberEvent(pool, req.params.id, req.userId);
    if (!event) return res.status(404).json({ error: 'event not found' });
    const input = req.body ?? {};
    const type = text(input.type, 'type', { max: 50 });
    const title = text(input.title, 'title', { max: 200 });
    const body = text(input.body, 'body', { max: 1000, optional: true });
    const data = input.data === undefined || input.data === null ? {} : object(input.data, 'data', { maxJson: 4000 });
    const onlyUserIds = input.onlyUserIds === undefined ? undefined : array(input.onlyUserIds, 'onlyUserIds', { max: 200 });

    let recipients = (event.participants ?? [])
      .map((p) => p.user_id)
      .filter((id) => id && String(id) !== String(req.userId));
    if (Array.isArray(onlyUserIds)) recipients = recipients.filter((id) => onlyUserIds.includes(id));
    if (recipients.length === 0) return res.json({ sent: 0 });

    const prefKey = PREF_KEY_BY_TYPE[type];
    if (prefKey) {
      const { rows } = await pool.query('select id, notification_prefs from profiles where id::text = any($1::text[])', [recipients]);
      const prefs = new Map(rows.map((r) => [String(r.id), r.notification_prefs]));
      recipients = recipients.filter((id) => prefs.get(String(id))?.[prefKey] !== false);
    }
    if (recipients.length === 0) return res.json({ sent: 0 });

    const { rows } = await pool.query(
      `insert into notifications (user_id, event_id, type, title, body, data)
       select u, $2, $3, $4, $5, $6::jsonb from unnest($1::uuid[]) as u returning *`,
      [recipients, event.id, type, title, body, JSON.stringify(data)]
    );
    rows.forEach((n) => emitToUser(n.user_id, 'notification', { eventType: 'INSERT', row: n }));
    await Promise.allSettled(rows.map((n) => deliverPush(n)));
    res.json({ sent: rows.length });
  }));
}
