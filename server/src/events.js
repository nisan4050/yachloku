const MEMBER_SQL = `(e.created_by::text = $1::text or e.manager_user_id::text = $1::text or e.participants @> jsonb_build_array(jsonb_build_object('user_id', $1::text)))`;

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

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

  app.patch('/events/:id', requireAuth, wrap(async (req, res) => {
    const allowed = ['title', 'description', 'icon', 'currency', 'status'];
    const entries = Object.entries(req.body ?? {}).filter(([k]) => allowed.includes(k));
    if (entries.length === 0) return res.status(400).json({ error: 'nothing to update' });
    const sets = entries.map(([k], i) => `${k} = $${i + 3}`).join(', ');
    const { rows } = await pool.query(
      `update events set ${sets} where id = $1 and manager_user_id = $2 returning *`,
      [req.params.id, req.userId, ...entries.map(([, v]) => v)]
    );
    if (!rows[0]) return res.status(403).json({ error: 'only the trip manager can edit this trip' });
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
    res.status(204).end();
  }));
}
