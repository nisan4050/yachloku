import { wrap, getMemberEvent } from './lib.js';
import { bad, text, array, isPlainObject } from './validate.js';

export function registerPollRoutes(app, pool, requireAuth) {
  const loadPoll = async (pollId) => {
    const { rows } = await pool.query('select * from polls where id = $1', [pollId]);
    return rows[0] ?? null;
  };

  // creator or event manager
  const canManagePoll = async (poll, userId) => {
    const event = await getMemberEvent(pool, poll.event_id, userId);
    if (!event) return null;
    const allowed = String(poll.created_by) === String(userId) || String(event.manager_user_id) === String(userId);
    return allowed ? event : false;
  };

  app.get('/events/:id/polls', requireAuth, wrap(async (req, res) => {
    if (!(await getMemberEvent(pool, req.params.id, req.userId))) return res.status(404).json({ error: 'event not found' });
    const { rows } = await pool.query(
      `select p.*, coalesce(
         (select json_agg(v order by v.created_at) from poll_votes v where v.poll_id = p.id), '[]'::json
       ) as poll_votes
       from polls p where p.event_id = $1 order by p.created_at desc`,
      [req.params.id]
    );
    res.json(rows);
  }));

  app.post('/events/:id/polls', requireAuth, wrap(async (req, res) => {
    if (!(await getMemberEvent(pool, req.params.id, req.userId))) return res.status(404).json({ error: 'event not found' });
    const question = text(req.body?.question, 'question', { max: 200 });
    const labels = array(req.body?.options, 'options', { min: 2, max: 20 }).map((label) => text(label, 'option', { max: 100 }));
    const withIds = labels.map((label) => ({ id: crypto.randomUUID(), label }));
    const { rows } = await pool.query(
      'insert into polls (event_id, question, options, created_by) values ($1, $2, $3::jsonb, $4) returning *',
      [req.params.id, question, JSON.stringify(withIds), req.userId]
    );
    res.status(201).json(rows[0]);
  }));

  app.post('/polls/:id/vote', requireAuth, wrap(async (req, res) => {
    const poll = await loadPoll(req.params.id);
    if (!poll || !(await getMemberEvent(pool, poll.event_id, req.userId))) return res.status(404).json({ error: 'poll not found' });
    if (poll.closed) return res.status(409).json({ error: 'poll is closed' });
    const { optionId } = req.body ?? {};
    if (!(poll.options ?? []).some((o) => o.id === optionId)) return res.status(400).json({ error: 'unknown option' });
    const { rows } = await pool.query(
      `insert into poll_votes (poll_id, option_id, user_id) values ($1, $2, $3)
       on conflict (poll_id, user_id) do update set option_id = excluded.option_id returning *`,
      [poll.id, optionId, req.userId]
    );
    res.json(rows[0]);
  }));

  app.patch('/polls/:id', requireAuth, wrap(async (req, res) => {
    const poll = await loadPoll(req.params.id);
    if (!poll) return res.status(404).json({ error: 'poll not found' });
    const allowed = await canManagePoll(poll, req.userId);
    if (allowed === null) return res.status(404).json({ error: 'poll not found' });
    if (allowed === false) return res.status(403).json({ error: 'only the poll creator or the manager can edit' });
    const question = text(req.body?.question, 'question', { max: 200 });
    const seenIds = new Set();
    const options = array(req.body?.options, 'options', { min: 2, max: 20 }).map((o) => {
      if (!isPlainObject(o)) throw bad('each option needs an id and a label');
      const id = text(o.id, 'option id', { max: 64 });
      if (seenIds.has(id)) throw bad('option ids must be unique');
      seenIds.add(id);
      return { id, label: text(o.label, 'option', { max: 100 }) };
    });
    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query('update polls set question = $2, options = $3::jsonb where id = $1 returning *', [
        poll.id, question, JSON.stringify(options),
      ]);
      await client.query('delete from poll_votes where poll_id = $1 and not (option_id = any($2::text[]))', [
        poll.id, options.map((o) => o.id),
      ]);
      await client.query('commit');
      res.json(rows[0]);
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }));

  app.post('/polls/:id/close', requireAuth, wrap(async (req, res) => {
    const poll = await loadPoll(req.params.id);
    if (!poll) return res.status(404).json({ error: 'poll not found' });
    const allowed = await canManagePoll(poll, req.userId);
    if (allowed === null) return res.status(404).json({ error: 'poll not found' });
    if (allowed === false) return res.status(403).json({ error: 'only the poll creator or the manager can close' });
    const { rows } = await pool.query('update polls set closed = true where id = $1 returning *', [poll.id]);
    res.json(rows[0]);
  }));

  app.delete('/polls/:id', requireAuth, wrap(async (req, res) => {
    const poll = await loadPoll(req.params.id);
    if (!poll) return res.status(404).json({ error: 'poll not found' });
    const allowed = await canManagePoll(poll, req.userId);
    if (allowed === null) return res.status(404).json({ error: 'poll not found' });
    if (allowed === false) return res.status(403).json({ error: 'only the poll creator or the manager can delete' });
    await pool.query('delete from polls where id = $1', [poll.id]);
    res.status(204).end();
  }));
}
