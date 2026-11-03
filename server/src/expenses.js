import { wrap, getMemberEvent, pick, insertSql, updateSql } from './lib.js';
import { bad, text, money, currency, dateString, oneOf, array, isPlainObject, httpUrl } from './validate.js';

const EXPENSE_FIELDS = [
  'description', 'amount', 'currency', 'category', 'paid_by', 'split_type',
  'split_between', 'date', 'receipt_url', 'notes',
];
const PAYMENT_FIELDS = ['from_participant_id', 'to_participant_id', 'amount', 'currency', 'date', 'notes'];
const CATEGORIES = ['food', 'accommodation', 'transport', 'shopping', 'entertainment', 'drinks', 'groceries', 'other'];
const SPLIT_TYPES = ['equal', 'custom', 'percentage'];

const participantIds = (event) => new Set((event.participants ?? []).map((p) => p.id));

// Validates the fields present in `body`; with `requireAll`, the fields a new expense cannot do without must be there.
// `keepIds`: people already on the expense being edited stay valid even if they have since left the trip.
function cleanExpense(body, event, { requireAll, keepIds = [] }) {
  const ids = participantIds(event);
  for (const id of keepIds) ids.add(id);
  const raw = {};
  for (const k of EXPENSE_FIELDS) if (body && body[k] !== undefined) raw[k] = body[k];
  if (requireAll) for (const k of ['description', 'amount', 'paid_by', 'split_between']) if (raw[k] === undefined) throw bad(`${k} is required`);

  const out = {};
  if ('description' in raw) out.description = text(raw.description, 'description', { max: 200 });
  if ('amount' in raw) out.amount = money(raw.amount, 'amount');
  if ('currency' in raw) out.currency = currency(raw.currency);
  if ('category' in raw) out.category = oneOf(raw.category, CATEGORIES, 'category');
  if ('split_type' in raw) out.split_type = oneOf(raw.split_type, SPLIT_TYPES, 'split_type');
  if ('date' in raw) out.date = dateString(raw.date);
  if ('notes' in raw) out.notes = text(raw.notes, 'notes', { min: 0, max: 2000, optional: true }) || null;
  if ('receipt_url' in raw) out.receipt_url = httpUrl(raw.receipt_url, 'receipt_url');
  if ('paid_by' in raw) {
    out.paid_by = array(raw.paid_by, 'paid_by', { min: 1, max: 100 }).map((p) => {
      if (!isPlainObject(p) || !ids.has(p.participant_id)) throw bad('paid_by must refer to people in this trip');
      return { participant_id: p.participant_id, amount: money(p.amount, 'paid_by amount', { allowZero: true }) };
    });
  }
  if ('split_between' in raw) {
    out.split_between = array(raw.split_between, 'split_between', { min: 1, max: 100 }).map((p) => {
      if (!isPlainObject(p) || !ids.has(p.participant_id)) throw bad('split_between must refer to people in this trip');
      const entry = { participant_id: p.participant_id, amount: money(p.amount ?? 0, 'split amount', { allowZero: true }) };
      entry.percentage = p.percentage === undefined || p.percentage === null ? null : money(p.percentage, 'percentage', { allowZero: true });
      return entry;
    });
  }
  return out;
}

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
    const event = await memberOrFail(req, res, req.params.id);
    if (!event) return;
    const values = { ...pick(cleanExpense(req.body, event, { requireAll: true }), EXPENSE_FIELDS), event_id: event.id, created_by: req.userId };
    const { sql, args } = insertSql('expenses', values);
    const { rows } = await pool.query(sql, args);
    res.status(201).json(rows[0]);
  }));

  app.patch('/expenses/:id', requireAuth, wrap(async (req, res) => {
    const { rows: existing } = await pool.query('select event_id, paid_by, split_between from expenses where id = $1', [req.params.id]);
    const event = existing[0] && (await getMemberEvent(pool, existing[0].event_id, req.userId));
    if (!event) return res.status(404).json({ error: 'expense not found' });
    const keepIds = [...(existing[0].paid_by ?? []), ...(existing[0].split_between ?? [])].map((p) => p.participant_id);
    const values = pick(cleanExpense(req.body, event, { requireAll: false, keepIds }), EXPENSE_FIELDS);
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
    const event = await memberOrFail(req, res, req.params.id);
    if (!event) return;
    const body = req.body ?? {};
    const ids = participantIds(event);
    if (!ids.has(body.from_participant_id) || !ids.has(body.to_participant_id)) throw bad('payments must be between people in this trip');
    if (body.from_participant_id === body.to_participant_id) throw bad('a payment must be between two different people');
    const clean = {
      from_participant_id: body.from_participant_id,
      to_participant_id: body.to_participant_id,
      amount: money(body.amount, 'amount'),
    };
    if (body.currency !== undefined) clean.currency = currency(body.currency);
    if (body.date !== undefined) clean.date = dateString(body.date);
    if (body.notes !== undefined) clean.notes = text(body.notes, 'notes', { min: 0, max: 2000, optional: true }) || null;
    const values = { ...pick(clean, PAYMENT_FIELDS), event_id: event.id, created_by: req.userId };
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
    const ids = participantIds(event);
    if (!ids.has(fromParticipantId) || !ids.has(toParticipantId)) return res.status(400).json({ error: 'unknown participant' });
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
    if (typeof from !== 'string' || typeof to !== 'string' || !from || !to) return res.status(400).json({ error: 'from and to are required' });
    if (!isDebtorOrManager(event, req.userId, from)) return res.status(403).json({ error: 'only the payer or the manager can undo' });
    await pool.query(
      'delete from settlement_confirmations where event_id = $1 and from_participant_id = $2 and to_participant_id = $3',
      [event.id, from, to]
    );
    res.status(204).end();
  }));
}
