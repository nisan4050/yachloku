import { wrap, getMemberEvent, pick, insertSql, updateSql } from './lib.js';

const EXPENSE_FIELDS = [
  'description', 'amount', 'currency', 'category', 'paid_by', 'split_type',
  'split_between', 'date', 'receipt_url', 'notes',
];
const PAYMENT_FIELDS = ['from_participant_id', 'to_participant_id', 'amount', 'currency', 'date', 'notes'];

export function registerExpenseRoutes(app, pool, requireAuth) {
  const memberOrFail = async (req, res, eventId) => {
    const event = await getMemberEvent(pool, eventId, req.userId);
    if (!event) res.status(404).json({ error: 'event not found' });
    return event;
  };

  const eventIdOf = async (table, id) => {
    const { rows } = await pool.query(`select event_id from ${table} where id = $1`, [id]);
    return rows[0]?.event_id ?? null;
  };

  // ---- expenses ----
  app.get('/events/:id/expenses', requireAuth, wrap(async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const { rows } = await pool.query(
      'select * from expenses where event_id = $1 order by date desc, created_at desc',
      [req.params.id]
    );
    res.json(rows);
  }));

  app.post('/events/:id/expenses', requireAuth, wrap(async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const values = { ...pick(req.body, EXPENSE_FIELDS), event_id: req.params.id, created_by: req.userId };
    const { sql, args } = insertSql('expenses', values);
    const { rows } = await pool.query(sql, args);
    res.status(201).json(rows[0]);
  }));

  app.patch('/expenses/:id', requireAuth, wrap(async (req, res) => {
    const eventId = await eventIdOf('expenses', req.params.id);
    if (!eventId || !(await getMemberEvent(pool, eventId, req.userId))) return res.status(404).json({ error: 'expense not found' });
    const values = pick(req.body, EXPENSE_FIELDS);
    if (Object.keys(values).length === 0) return res.status(400).json({ error: 'nothing to update' });
    const { sql, args } = updateSql('expenses', values, 'id', req.params.id);
    const { rows } = await pool.query(sql, args);
    res.json(rows[0]);
  }));

  app.delete('/expenses/:id', requireAuth, wrap(async (req, res) => {
    const eventId = await eventIdOf('expenses', req.params.id);
    if (!eventId || !(await getMemberEvent(pool, eventId, req.userId))) return res.status(404).json({ error: 'expense not found' });
    await pool.query('delete from expenses where id = $1', [req.params.id]);
    res.status(204).end();
  }));

  // ---- payments ----
  app.get('/events/:id/payments', requireAuth, wrap(async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const { rows } = await pool.query('select * from payments where event_id = $1 order by date desc, created_at desc', [req.params.id]);
    res.json(rows);
  }));

  app.post('/events/:id/payments', requireAuth, wrap(async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const values = { ...pick(req.body, PAYMENT_FIELDS), event_id: req.params.id, created_by: req.userId };
    const { sql, args } = insertSql('payments', values);
    const { rows } = await pool.query(sql, args);
    res.status(201).json(rows[0]);
  }));

  app.delete('/payments/:id', requireAuth, wrap(async (req, res) => {
    const eventId = await eventIdOf('payments', req.params.id);
    if (!eventId || !(await getMemberEvent(pool, eventId, req.userId))) return res.status(404).json({ error: 'payment not found' });
    await pool.query('delete from payments where id = $1', [req.params.id]);
    res.status(204).end();
  }));

  // ---- settlement confirmations (debtor or manager only) ----
  const isDebtorOrManager = (event, userId, fromParticipantId) =>
    String(event.manager_user_id) === String(userId) ||
    (event.participants ?? []).some((p) => p.id === fromParticipantId && String(p.user_id) === String(userId));

  app.get('/events/:id/confirmations', requireAuth, wrap(async (req, res) => {
    if (!(await memberOrFail(req, res, req.params.id))) return;
    const { rows } = await pool.query('select * from settlement_confirmations where event_id = $1', [req.params.id]);
    res.json(rows);
  }));

  app.put('/events/:id/confirmations', requireAuth, wrap(async (req, res) => {
    const event = await memberOrFail(req, res, req.params.id);
    if (!event) return;
    const { fromParticipantId, toParticipantId } = req.body ?? {};
    if (!fromParticipantId || !toParticipantId) return res.status(400).json({ error: 'fromParticipantId and toParticipantId are required' });
    if (!isDebtorOrManager(event, req.userId, fromParticipantId)) return res.status(403).json({ error: 'only the payer or the manager can confirm' });
    const { rows } = await pool.query(
      `insert into settlement_confirmations (event_id, from_participant_id, to_participant_id, confirmed, confirmed_at)
       values ($1, $2, $3, true, now())
       on conflict (event_id, from_participant_id, to_participant_id)
       do update set confirmed = true, confirmed_at = now() returning *`,
      [event.id, fromParticipantId, toParticipantId]
    );
    res.json(rows[0]);
  }));

  app.delete('/events/:id/confirmations', requireAuth, wrap(async (req, res) => {
    const event = await memberOrFail(req, res, req.params.id);
    if (!event) return;
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
    if (!isDebtorOrManager(event, req.userId, String(from))) return res.status(403).json({ error: 'only the payer or the manager can undo' });
    await pool.query(
      'delete from settlement_confirmations where event_id = $1 and from_participant_id = $2 and to_participant_id = $3',
      [event.id, from, to]
    );
    res.status(204).end();
  }));
}
