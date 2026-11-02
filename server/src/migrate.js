// Idempotent boot-time migrations. Each statement must be safe to re-run.
const STATEMENTS = [
  `create table if not exists app_users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    name text not null,
    password_hash text,
    google_sub text unique,
    created_at timestamptz not null default now()
  )`,
  `alter table app_users add column if not exists last_seen_at timestamptz`,
  // Supabase-only triggers that call pg_net / edge functions, which do not exist here.
  `drop trigger if exists on_notification_created on notifications`,
  `drop trigger if exists on_feedback_created on developer_feedback`,
  `drop trigger if exists on_auth_user_created on app_users`,
  `drop function if exists trigger_send_push()`,
  `drop function if exists trigger_send_feedback_email()`,
  `insert into profiles (id, email, full_name)
     select u.id, u.email, u.name from app_users u
     where not exists (select 1 from profiles p where p.id = u.id)`,
];

export async function migrate(pool) {
  for (const sql of STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (err) {
      console.error(`migration statement failed: ${sql.slice(0, 60)}... -> ${err.message}`);
    }
  }
}
