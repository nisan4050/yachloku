import { wrap, memberClause, getMemberEvent, jsonVal } from './lib.js';
import { removeEventFiles } from './uploads.js';
import { bad, text, currency, oneOf, array, isPlainObject, isUuid, HttpError } from './validate.js';

const MEMBER_SQL = memberClause(1);
const MAX_PARTICIPANTS = 100;
const STATUSES = ['active', 'settled', 'archived'];

const newParticipant = (name, userId = null, email = null) => ({ id: crypto.randomUUID(), name, email, user_id: userId });

// Checks a participant list sent by a client. Members may rename people and add or remove people who have no account,
// but they can never hand a seat to a different account or remove another account — only the manager may remove accounts.
function validateParticipants(next, event, userId) {
  array(next, 'participants', { min: 1, max: MAX_PARTICIPANTS });
  const current = new Map((event.participants ?? []).map((p) => [p.id, p]));
  const seen = new Set();
  const cleaned = next.map((p) => {
    if (!isPlainObject(p)) throw bad('each participant must be an object');
    const id = text(p.id, 'participant id', { max: 64 });
    if (seen.has(id)) throw bad('participant ids must be unique');
    seen.add(id);
    const before = current.get(id);
    const userRef = p.user_id ?? null;
    if (userRef !== null && !isUuid(userRef)) throw bad('participant user_id is not valid');
    if (String(userRef) !== String(before?.user_id ?? null)) throw bad('a participant account cannot be changed');
    return { id, name: text(p.name, 'participant name', { max: 60 }), email: typeof p.email === 'string' ? p.email.slice(0, 254) : null, user_id: userRef };
  });
  const isManager = String(event.manager_user_id) === String(userId);
  if (!isManager) {
    for (const before of event.participants ?? []) {
      if (before.user_id && !seen.has(before.id)) throw new HttpError(403, 'only the trip manager can remove a member');
    }
  }
  if (event.manager_user_id && !cleaned.some((p) => String(p.user_id) === String(event.manager_user_id))) {
    throw bad('the trip manager cannot be removed from the trip');
  }
  return cleaned;
}

export function registerEventRoutes(app, pool, requireAuth) {
  app.get('/events', requireAuth, wrap(async (req, res) => {
    const { rows } = await pool.query(
      `select e.* from events e where ${MEMBER_SQL} order by e.created_at desc`,
      [req.userId]
    );
    res.json(rows);
  }));

  app.get('/events/:id', requireAuth, wrap(async (req, res) => {
    const { rows } = await pool.query(
      `select e.* from events e where e.id = $2 and ${MEMBER_SQL}`,
      [req.userId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'event not found' });
    res.json(rows[0]);
  }));

  app.post('/events', requireAuth, wrap(async (req, res) => {
    const body = req.body ?? {};
    const title = text(body.title, 'title', { max: 120 });
    const participantName = text(body.participantName, 'participantName', { max: 60 });
    const description = text(body.description, 'description', { min: 0, max: 1000, optional: true }) || null;
    const icon = text(body.icon, 'icon', { min: 0, max: 32, optional: true }) || null;
    const eventCurrency = body.currency === undefined || body.currency === null ? 'ILS' : currency(body.currency);
    const extras = body.extraParticipantNames === undefined ? [] : array(body.extraParticipantNames, 'extraParticipantNames', { max: MAX_PARTICIPANTS - 1 });
    const participants = [
      newParticipant(participantName, req.userId),
      ...extras.map((name) => newParticipant(text(name, 'participant name', { max: 60 }))),
    ];
    const { rows } = await pool.query(
      `insert into events (title, description, icon, currency, created_by, manager_user_id, participants)
       values ($1, $2, $3, $4, $5, $5, $6::jsonb) returning *`,
      [title, description, icon, eventCurrency, req.userId, JSON.stringify(participants)]
    );
    res.status(201).json(rows[0]);
  }));

  app.get('/events/by-code/:code', requireAuth, wrap(async (req, res) => {
    const { rows } = await pool.query('select * from events where invite_code = upper(trim($1)) limit 1', [req.params.code]);
    if (!rows[0]) return res.status(404).json({ error: 'Invalid invite code' });
    res.json(rows[0]);
  }));

  app.post('/events/join', requireAuth, wrap(async (req, res) => {
    const body = req.body ?? {};
    const inviteCode = text(body.inviteCode, 'inviteCode', { max: 20 });
    const name = text(body.name, 'name', { max: 60 });
    const { rows: found } = await pool.query('select * from events where invite_code = upper(trim($1))', [inviteCode]);
    const event = found[0];
    if (!event) return res.status(404).json({ error: 'Invalid invite code' });
    if ((event.participants ?? []).length >= MAX_PARTICIPANTS) return res.status(409).json({ error: 'this trip is full' });
    const participant = newParticipant(name, req.userId, typeof body.email === 'string' ? body.email.slice(0, 254) : null);
    // One statement, so simultaneous joins by the same account cannot add two seats.
    const { rows } = await pool.query(
      `update events set participants = participants || $2::jsonb
       where id = $1 and not (participants @> jsonb_build_array(jsonb_build_object('user_id', $3::text))) returning *`,
      [event.id, JSON.stringify([participant]), req.userId]
    );
    res.json(rows[0] ?? (await getMemberEvent(pool, event.id, req.userId)));
  }));

  // Any member may change the participant list and the photo list; everything else is manager-only.
  const MEMBER_FIELDS = ['participants', 'photos'];
  const MANAGER_FIELDS = ['title', 'description', 'icon', 'currency', 'status'];

  app.patch('/events/:id', requireAuth, wrap(async (req, res) => {
    const body = req.body ?? {};
    const keys = Object.keys(body).filter((k) => MEMBER_FIELDS.includes(k) || MANAGER_FIELDS.includes(k));
    if (keys.length === 0) return res.status(400).json({ error: 'nothing to update' });
    const event = await getMemberEvent(pool, req.params.id, req.userId);
    if (!event) return res.status(404).json({ error: 'event not found' });
    if (keys.some((k) => MANAGER_FIELDS.includes(k)) && String(event.manager_user_id) !== String(req.userId)) {
      return res.status(403).json({ error: 'only the trip manager can edit this trip' });
    }

    const values = {};
    for (const key of keys) {
      const v = body[key];
      if (key === 'title') values.title = text(v, 'title', { max: 120 });
      else if (key === 'description') values.description = text(v, 'description', { min: 0, max: 1000, optional: true }) || null;
      else if (key === 'icon') values.icon = text(v, 'icon', { min: 0, max: 32, optional: true }) || null;
      else if (key === 'currency') values.currency = currency(v);
      else if (key === 'status') values.status = oneOf(v, STATUSES, 'status');
      else if (key === 'participants') values.participants = validateParticipants(v, event, req.userId);
      else if (key === 'photos') values.photos = array(v, 'photos', { max: 500 });
    }
    const entries = Object.entries(values);
    const sets = entries.map(([k], i) => (MEMBER_FIELDS.includes(k) ? `${k} = $${i + 2}::jsonb` : `${k} = $${i + 2}`)).join(', ');
    const { rows } = await pool.query(`update events set ${sets} where id = $1 returning *`, [event.id, ...entries.map(([, v]) => jsonVal(v))]);
    res.json(rows[0]);
  }));

  app.post('/events/:id/transfer-manager', requireAuth, wrap(async (req, res) => {
    const { newManagerId } = req.body ?? {};
    if (!newManagerId) return res.status(400).json({ error: 'newManagerId is required' });
    if (!isUuid(newManagerId)) return res.status(400).json({ error: 'newManagerId is not valid' });
    const event = await getMemberEvent(pool, req.params.id, req.userId);
    if (!event || String(event.manager_user_id) !== String(req.userId)) {
      return res.status(403).json({ error: 'only the trip manager can transfer management' });
    }
    if (!(event.participants ?? []).some((p) => String(p.user_id) === String(newManagerId))) {
      return res.status(400).json({ error: 'the new manager must be a member of the trip' });
    }
    const { rows } = await pool.query(
      `update events set manager_user_id = $3, previous_manager_user_id = $2, manager_changed_at = now()
       where id = $1 and manager_user_id = $2 returning *`,
      [event.id, req.userId, newManagerId]
    );
    if (!rows[0]) return res.status(403).json({ error: 'only the trip manager can transfer management' });
    res.json(rows[0]);
  }));

  app.delete('/events/:id', requireAuth, wrap(async (req, res) => {
    const { rowCount } = await pool.query('delete from events where id = $1 and manager_user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    if (rowCount === 0) return res.status(403).json({ error: 'only the trip manager can delete this trip' });
    await removeEventFiles(req.params.id);
    res.status(204).end();
  }));
}
