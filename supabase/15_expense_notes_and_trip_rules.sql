-- Add notes column to expenses and trip rules/split mode to events
alter table expenses add column if not exists notes text;

-- Trip split modes: 'equal' (default) or 'activity' (split by who participated)
alter table events add column if not exists split_mode text default 'equal';
alter table events add constraint split_mode_check
  check (split_mode in ('equal', 'activity'));

-- When splitting by activity, track who participated in each expense
-- (this replaces the implicit "all participants" assumption)
create table if not exists expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  participant_id text not null,
  created_at timestamp default now(),

  unique(expense_id, participant_id)
);

create index if not exists expense_participants_expense_idx on expense_participants(expense_id);
create index if not exists expense_participants_participant_idx on expense_participants(participant_id);
