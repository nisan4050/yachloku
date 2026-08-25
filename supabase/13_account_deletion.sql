-- Allow deleting an auth.users row without it being blocked by every table
-- that references it. Before this, `created_by`/`from_user_id` etc. were
-- `not null references auth.users(id)` with no ON DELETE action (Postgres
-- default: RESTRICT) — deleting a user who'd ever added an expense, sent a
-- message, or created a poll would fail outright. Switch these to
-- ON DELETE SET NULL so a deleted user's past contributions stay visible
-- to the rest of the trip (as "removed user") instead of blocking deletion
-- or cascading into deleting other people's shared history.

alter table events alter column created_by drop not null;
alter table events drop constraint events_created_by_fkey;
alter table events add constraint events_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table events drop constraint events_manager_user_id_fkey;
alter table events add constraint events_manager_user_id_fkey
  foreign key (manager_user_id) references auth.users(id) on delete set null;

alter table events drop constraint events_previous_manager_user_id_fkey;
alter table events add constraint events_previous_manager_user_id_fkey
  foreign key (previous_manager_user_id) references auth.users(id) on delete set null;

alter table expenses alter column created_by drop not null;
alter table expenses drop constraint expenses_created_by_fkey;
alter table expenses add constraint expenses_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table payments alter column created_by drop not null;
alter table payments drop constraint payments_created_by_fkey;
alter table payments add constraint payments_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table chat_messages alter column from_user_id drop not null;
alter table chat_messages drop constraint chat_messages_from_user_id_fkey;
alter table chat_messages add constraint chat_messages_from_user_id_fkey
  foreign key (from_user_id) references auth.users(id) on delete set null;

alter table chat_messages drop constraint chat_messages_to_user_id_fkey;
alter table chat_messages add constraint chat_messages_to_user_id_fkey
  foreign key (to_user_id) references auth.users(id) on delete set null;

alter table group_messages alter column from_user_id drop not null;
alter table group_messages drop constraint group_messages_from_user_id_fkey;
alter table group_messages add constraint group_messages_from_user_id_fkey
  foreign key (from_user_id) references auth.users(id) on delete set null;

alter table polls alter column created_by drop not null;
alter table polls drop constraint polls_created_by_fkey;
alter table polls add constraint polls_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
