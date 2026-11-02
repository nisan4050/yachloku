import { wrap, getMemberEvent, pick } from './lib.js';
import { subscribeToEvent, subscribeUser, emitToEvent } from './realtime.js';

const SOFT_DELETE_SQL = 'deleted_at = now(), content = null, media_url = null, media_meta = null, location = null';
const MEDIA_FIELDS = ['content', 'reply_to_id', 'media_url', 'media_meta', 'location'];

const meIn = (event, userId) => (event.participants ?? []).find((p) => String(p.user_id) === String(userId));

export function registerChatRoutes(app, pool, requireAuth, requireAuthStream) {
  const emitGroup = (row, eventType) => emitToEvent(row.event_id, 'group_message', { eventType, row });
  const emitPrivate = (row, eventType) =>
    emitToEvent(row.event_id, 'private_message', { eventType, row }, [row.from_user_id, row.to_user_id]);

  // kind -> { table, emit, canAccess(message, event, userId) }
  const kinds = {
    group: { table: 'group_messages', path: 'group-messages', emit: emitGroup, canAccess: () => true },
    private: {
      table: 'chat_messages',
      path: 'private-messages',
      emit: emitPrivate,
      canAccess: (m, _event, userId) => String(m.from_user_id) === String(userId) || String(m.to_user_id) === String(userId),
    },
  };

  const loadMessage = async (kind, id, userId) => {
    const { rows } = await pool.query(`select * from ${kinds[kind].table} where id = $1`, [id]);
    const message = rows[0];
    if (!message) return {};
    const event = await getMemberEvent(pool, message.event_id, userId);
    if (!event || !kinds[kind].canAccess(message, event, userId)) return {};
    return { message, event };
  };

  for (const kind of Object.keys(kinds)) {
    const { table, path, emit } = kinds[kind];

    // Edit text — author only.
    app.patch(`/${path}/:id`, requireAuth, wrap(async (req, res) => {
      const { message } = await loadMessage(kind, req.params.id, req.userId);
      if (!message) return res.status(404).json({ error: 'message not found' });
      if (String(message.from_user_id) !== String(req.userId)) return res.status(403).json({ error: 'only the author can edit' });
      if (message.deleted_at) return res.status(409).json({ error: 'message was deleted' });
      const content = typeof req.body?.content === 'string' ? req.body.content : null;
      if (!content) return res.status(400).json({ error: 'content is required' });
      const { rows } = await pool.query(`update ${table} set content = $2, edited_at = now() where id = $1 returning *`, [message.id, content]);
      emit(rows[0], 'UPDATE');
      res.json(rows[0]);
    }));

    // Soft delete — author or trip manager.
    app.delete(`/${path}/:id`, requireAuth, wrap(async (req, res) => {
      const { message, event } = await loadMessage(kind, req.params.id, req.userId);
      if (!message) return res.status(404).json({ error: 'message not found' });
      const isAuthor = String(message.from_user_id) === String(req.userId);
      if (!isAuthor && String(event.manager_user_id) !== String(req.userId)) return res.status(403).json({ error: 'not allowed' });
      const { rows } = await pool.query(`update ${table} set ${SOFT_DELETE_SQL} where id = $1 returning *`, [message.id]);
      emit(rows[0], 'UPDATE');
      res.json(rows[0]);
    }));

    app.post(`/${path}/:id/pin`, requireAuth, wrap(async (req, res) => {
      const { message } = await loadMessage(kind, req.params.id, req.userId);
      if (!message) return res.status(404).json({ error: 'message not found' });
      const { rows } = await pool.query(
        `update ${table} set pinned_at = case when pinned_at is null then now() else null end where id = $1 returning *`,
        [message.id]
      );
      emit(rows[0], 'UPDATE');
      res.json(rows[0]);
    }));

    // Atomic toggle: reactions shape is { emoji: [userId, ...] }.
    app.post(`/${path}/:id/react`, requireAuth, wrap(async (req, res) => {
      const emoji = req.body?.emoji;
      if (typeof emoji !== 'string' || !emoji || emoji.length > 16) return res.status(400).json({ error: 'emoji is required' });
      const { message } = await loadMessage(kind, req.params.id, req.userId);
      if (!message) return res.status(404).json({ error: 'message not found' });
      const client = await pool.connect();
      try {
        await client.query('begin');
        const { rows: locked } = await client.query(`select reactions from ${table} where id = $1 for update`, [message.id]);
        const reactions = { ...(locked[0].reactions ?? {}) };
        const users = new Set(reactions[emoji] ?? []);
        if (users.has(req.userId)) users.delete(req.userId); else users.add(req.userId);
        if (users.size === 0) delete reactions[emoji]; else reactions[emoji] = [...users];
        const { rows } = await client.query(`update ${table} set reactions = $2::jsonb where id = $1 returning *`, [message.id, JSON.stringify(reactions)]);
        await client.query('commit');
        emit(rows[0], 'UPDATE');
        res.json(rows[0]);
      } catch (err) {
        await client.query('rollback');
        throw err;
      } finally {
        client.release();
      }
    }));
  }

  // ---- group chat ----
  app.get('/events/:id/group-messages', requireAuth, wrap(async (req, res) => {
    if (!(await getMemberEvent(pool, req.params.id, req.userId))) return res.status(404).json({ error: 'event not found' });
    const { rows } = await pool.query('select * from group_messages where event_id = $1 order by created_at asc', [req.params.id]);
    res.json(rows);
  }));

  app.post('/events/:id/group-messages', requireAuth, wrap(async (req, res) => {
    const event = await getMemberEvent(pool, req.params.id, req.userId);
    if (!event) return res.status(404).json({ error: 'event not found' });
    const me = meIn(event, req.userId);
    if (!me) return res.status(403).json({ error: 'not a participant' });
    const v = pick(req.body, MEDIA_FIELDS);
    if (!v.content && !v.media_url && !v.location) return res.status(400).json({ error: 'message is empty' });
    const { rows } = await pool.query(
      `insert into group_messages (event_id, from_participant_id, from_user_id, content, reply_to_id, media_url, media_meta, location)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb) returning *`,
      [event.id, me.id, req.userId, v.content ?? null, v.reply_to_id ?? null, v.media_url ?? null, v.media_meta ?? null, v.location ?? null]
    );
    emitGroup(rows[0], 'INSERT');
    res.status(201).json(rows[0]);
  }));

  app.post('/events/:id/group-messages/read', requireAuth, wrap(async (req, res) => {
    if (!(await getMemberEvent(pool, req.params.id, req.userId))) return res.status(404).json({ error: 'event not found' });
    const { rows } = await pool.query(
      `update group_messages set read_by = coalesce(read_by, '[]'::jsonb) || to_jsonb($2::text)
       where event_id = $1 and from_user_id::text <> $2::text and not (coalesce(read_by, '[]'::jsonb) ? $2::text) returning *`,
      [req.params.id, req.userId]
    );
    rows.forEach((row) => emitGroup(row, 'UPDATE'));
    res.json({ updated: rows.length });
  }));

  // ---- private chat ----
  app.get('/events/:id/private-messages', requireAuth, wrap(async (req, res) => {
    const event = await getMemberEvent(pool, req.params.id, req.userId);
    if (!event) return res.status(404).json({ error: 'event not found' });
    const me = meIn(event, req.userId);
    const other = req.query.with;
    if (!me || !other) return res.status(400).json({ error: 'with is required' });
    const { rows } = await pool.query(
      `select * from chat_messages where event_id = $1 and (
         (from_participant_id = $2 and to_participant_id = $3) or (from_participant_id = $3 and to_participant_id = $2)
       ) order by created_at asc`,
      [event.id, me.id, other]
    );
    res.json(rows);
  }));

  app.post('/events/:id/private-messages', requireAuth, wrap(async (req, res) => {
    const event = await getMemberEvent(pool, req.params.id, req.userId);
    if (!event) return res.status(404).json({ error: 'event not found' });
    const me = meIn(event, req.userId);
    const target = (event.participants ?? []).find((p) => p.id === req.body?.to_participant_id);
    if (!me || !target) return res.status(400).json({ error: 'unknown recipient' });
    const v = pick(req.body, MEDIA_FIELDS);
    if (!v.content && !v.media_url && !v.location) return res.status(400).json({ error: 'message is empty' });
    const { rows } = await pool.query(
      `insert into chat_messages (event_id, from_participant_id, to_participant_id, from_user_id, to_user_id, content, reply_to_id, media_url, media_meta, location)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb) returning *`,
      [event.id, me.id, target.id, req.userId, target.user_id ?? null, v.content ?? null, v.reply_to_id ?? null, v.media_url ?? null, v.media_meta ?? null, v.location ?? null]
    );
    emitPrivate(rows[0], 'INSERT');
    res.status(201).json(rows[0]);
  }));

  app.post('/events/:id/private-messages/read', requireAuth, wrap(async (req, res) => {
    if (!(await getMemberEvent(pool, req.params.id, req.userId))) return res.status(404).json({ error: 'event not found' });
    const from = req.body?.fromParticipantId;
    if (!from) return res.status(400).json({ error: 'fromParticipantId is required' });
    const { rows } = await pool.query(
      `update chat_messages set read = true
       where event_id = $1 and from_participant_id = $2 and to_user_id::text = $3::text and read = false returning *`,
      [req.params.id, from, req.userId]
    );
    rows.forEach((row) => emitPrivate(row, 'UPDATE'));
    res.json({ updated: rows.length });
  }));

  app.get('/events/:id/private-unread', requireAuth, wrap(async (req, res) => {
    if (!(await getMemberEvent(pool, req.params.id, req.userId))) return res.status(404).json({ error: 'event not found' });
    const { rows } = await pool.query(
      `select from_participant_id, count(*)::int as count from chat_messages
       where event_id = $1 and to_user_id::text = $2::text and read = false group by from_participant_id`,
      [req.params.id, req.userId]
    );
    res.json(Object.fromEntries(rows.map((r) => [r.from_participant_id, r.count])));
  }));

  app.get('/events/:id/media-count', requireAuth, wrap(async (req, res) => {
    if (!(await getMemberEvent(pool, req.params.id, req.userId))) return res.status(404).json({ error: 'event not found' });
    const { rows } = await pool.query(
      `select (select count(*) from group_messages where event_id = $1 and media_url is not null)
            + (select count(*) from chat_messages where event_id = $1 and media_url is not null) as count`,
      [req.params.id]
    );
    res.json({ count: Number(rows[0].count) });
  }));

  // ---- settlement system messages (client supplies the localized text) ----
  app.post('/events/:id/settlement-messages/sync', requireAuth, wrap(async (req, res) => {
    const event = await getMemberEvent(pool, req.params.id, req.userId);
    if (!event) return res.status(404).json({ error: 'event not found' });
    const wanted = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const byId = new Map((event.participants ?? []).map((p) => [p.id, p]));
    const valid = wanted
      .map((m) => ({ ...m, from: byId.get(m.fromParticipantId), to: byId.get(m.toParticipantId) }))
      .filter((m) => m.key?.startsWith('settlement:') && m.content && m.from?.user_id && m.to?.user_id);

    const client = await pool.connect();
    const changed = [];
    try {
      await client.query('begin');
      for (const m of valid) {
        const { rows } = await client.query(
          `insert into chat_messages (event_id, from_participant_id, to_participant_id, from_user_id, to_user_id, content, is_system, system_key)
           values ($1, $2, $3, $4, $5, $6, true, $7)
           on conflict (event_id, system_key) where system_key is not null and deleted_at is null
           do update set content = excluded.content, edited_at = now() where chat_messages.content is distinct from excluded.content
           returning *, (xmax = 0) as inserted`,
          [event.id, m.from.id, m.to.id, m.from.user_id, m.to.user_id, m.content, m.key]
        );
        if (rows[0]) changed.push({ row: rows[0], eventType: rows[0].inserted ? 'INSERT' : 'UPDATE' });
      }
      const keep = valid.map((m) => m.key);
      const { rows: removed } = await client.query(
        `update chat_messages set deleted_at = now(), content = null
         where event_id = $1 and system_key like 'settlement:%' and deleted_at is null and not (system_key = any($2::text[])) returning *`,
        [event.id, keep]
      );
      removed.forEach((row) => changed.push({ row, eventType: 'UPDATE' }));
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
    changed.forEach(({ row, eventType }) => emitPrivate(row, eventType));
    res.json({ changed: changed.length });
  }));

  // ---- typing indicator + realtime streams ----
  app.post('/events/:id/typing', requireAuth, wrap(async (req, res) => {
    const event = await getMemberEvent(pool, req.params.id, req.userId);
    if (!event) return res.status(404).json({ error: 'event not found' });
    const isTyping = Boolean(req.body?.isTyping);
    if (req.body?.scope === 'dm') {
      const target = (event.participants ?? []).find((p) => p.id === req.body?.with);
      if (target?.user_id) emitToEvent(event.id, 'typing', { scope: 'dm', user_id: req.userId, is_typing: isTyping }, [target.user_id]);
    } else {
      emitToEvent(event.id, 'typing', { scope: 'group', user_id: req.userId, is_typing: isTyping });
    }
    res.status(204).end();
  }));

  app.get('/events/:id/stream', requireAuthStream, wrap(async (req, res) => {
    if (!(await getMemberEvent(pool, req.params.id, req.userId))) return res.status(404).json({ error: 'event not found' });
    subscribeToEvent(req.params.id, req.userId, res);
  }));

  app.get('/stream', requireAuthStream, (req, res) => subscribeUser(req.userId, res));
}
