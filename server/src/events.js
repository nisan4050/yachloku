import { wrap, memberClause, getMemberEvent, jsonVal } from './lib.js';
import { removeEventFiles } from './uploads.js';

const MEMBER_SQL = memberClause(1);

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
    const { title, description, icon, currency, participantName, extraParticipantNames = [] } = req.body ?? {};
    if (!title || !participantName) return res.status(400).json({ error: 'title and participantName are required' });
    const participants = [
      { id: crypto.randomUUID(), name: participantName, email: null, user_id: req.userId },
      ...extraParticipantNames.map((name) => ({ id: crypto.randomUUID(), name, email: null, user_id: null })),
    ];
    const { rows } = await pool.query(
      `insert into events (title, description, icon, currency, created_by, manager_user_id, participants)
       values ($1, $2, $3, $4, $5, $5, $6::jsonb) returning *`,
      [title, description ?? null, icon ?? null, currency ?? 'ILS', req.userId, JSON.stringify(participants)]
    );
    res.status(201).json(rows[0]);
  }));

  app.get('/events/by-code/:code', requireAuth, wrap(async (req, res) => {
    const { rows } = await pool.query('select * from events where invite_code = upper(trim($1)) limit 1', [req.params.code]);
    if (!rows[0]) return res.status(404).json({ error: 'Invalid invite code' });
    res.json(rows[0]);
  }));

  app.post('/events/join', requireAuth, wrap(async (req, res) => {
    const { inviteCode, name, email } = req.body ?? {};
    if (!inviteCode || !name) return res.status(400).json({ error: 'inviteCode and name are required' });
    const { rows: found } = await pool.query('select * from events where invite_code = upper(trim($1))', [inviteCode]);
    const event = found[0];
    if (!event) return res.status(404).json({ error: 'Invalid invite code' });
    if ((event.participants ?? []).some((p) => String(p.user_id) === String(req.userId))) return res.json(event);
    const participant = { id: crypto.randomUUID(), name, email: email ?? null, user_id: req.userId };
    const { rows } = await pool.query(
      `update events set participants = participants || $2::jsonb where id = $1 returning *`,
      [event.id, JSON.stringify([participant])]
    );
    res.json(rows[0]);
  }));

  // Any member may change the participant list and the photo list; everything else is manager-only.
  const MEMBER_FIELDS = ['participants', 'photos'];
  const MANAGER_FIELDS = ['title', 'description', 'icon', 'currency', 'status'];

  app.patch('/events/:id', requireAuth, wrap(async (req, res) => {
    const body = req.body ?? {};
    const entries = Object.entries(body).filter(([k]) => MEMBER_FIELDS.includes(k) || MANAGER_FIELDS.includes(k));
    if (entries.length === 0) return res.status(400).json({ error: 'nothing to update' });
    const needsManager = entries.some(([k]) => MANAGER_FIELDS.includes(k));
    const event = await getMemberEvent(pool, req.params.id, req.userId);
    if (!event) return res.status(404).json({ error: 'event not found' });
    if (needsManager && String(event.manager_user_id) !== String(req.userId)) {
      return res.status(403).json({ error: 'only the trip manager can edit this trip' });
    }
    const sets = entries.map(([k], i) => (MEMBER_FIELDS.includes(k) ? `${k} = $${i + 2}::jsonb` : `${k} = $${i + 2}`)).join(', ');
    const { rows } = await pool.query(`update events set ${sets} where id = $1 returning *`, [
      event.id,
      ...entries.map(([, v]) => jsonVal(v)),
    ]);
    res.json(rows[0]);
  }));

  app.post('/events/:id/transfer-manager', requireAuth, wrap(async (req, res) => {
    const { newManagerId } = req.body ?? {};
    if (!newManagerId) return res.status(400).json({ error: 'newManagerId is required' });
    const { rows } = await pool.query(
      `update events set manager_user_id = $3, previous_manager_user_id = $2, manager_changed_at = now()
       where id = $1 and manager_user_id = $2 returning *`,
      [req.params.id, req.userId, newManagerId]
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
