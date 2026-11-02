import { wrap, memberClause } from './lib.js';

// Replaces the Supabase `delete-account` edge function. Without FKs to the user table,
// the former ON DELETE SET NULL / CASCADE behaviour is applied explicitly here.
export function registerAccountRoutes(app, pool, requireAuth) {
  app.delete('/me', requireAuth, wrap(async (req, res) => {
    const userId = req.userId;
    const client = await pool.connect();
    try {
      await client.query('begin');

      const { rows: events } = await client.query(`select e.* from events e where ${memberClause(1)} for update`, [userId]);
      for (const event of events) {
        const participants = (event.participants ?? []).map((p) => (String(p.user_id) === String(userId) ? { ...p, user_id: null } : p));
        let managerId = event.manager_user_id;
        let previous = event.previous_manager_user_id;
        let changedAt = event.manager_changed_at;

        if (String(event.manager_user_id) === String(userId)) {
          const next = participants.find((p) => p.user_id);
          if (!next) {
            await client.query('delete from events where id = $1', [event.id]);
            continue;
          }
          managerId = next.user_id;
          previous = userId;
          changedAt = new Date().toISOString();
        }
        await client.query(
          `update events set participants = $2::jsonb, manager_user_id = $3, previous_manager_user_id = $4, manager_changed_at = $5,
             created_by = case when created_by::text = $6::text then null else created_by end
           where id = $1`,
          [event.id, JSON.stringify(participants), managerId, previous, changedAt, userId]
        );
      }

      for (const [table, col] of [
        ['push_subscriptions', 'user_id'], ['fcm_tokens', 'user_id'], ['notifications', 'user_id'],
        ['developer_feedback', 'user_id'], ['poll_votes', 'user_id'], ['profiles', 'id'],
      ]) {
        await client.query(`delete from ${table} where ${col}::text = $1::text`, [userId]);
      }
      for (const [table, col] of [
        ['events', 'created_by'], ['polls', 'created_by'], ['expenses', 'created_by'], ['payments', 'created_by'],
        ['group_messages', 'from_user_id'], ['chat_messages', 'from_user_id'], ['chat_messages', 'to_user_id'],
      ]) {
        await client.query(`update ${table} set ${col} = null where ${col}::text = $1::text`, [userId]);
      }
      await client.query('delete from app_users where id = $1', [userId]);

      await client.query('commit');
      res.json({ deleted: true });
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }));
}
