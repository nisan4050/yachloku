-- Fix: poll_votes.user_id was missed by migration 13 (still ON DELETE NO ACTION,
-- Postgres's default). Deleting a user's account who had ever voted on ANY poll
-- would fail at auth.admin.deleteUser() with a foreign key violation, surfacing
-- to the client as "Edge Function returned a non-2xx status code" with no
-- indication of the actual cause.
--
-- user_id is NOT NULL here (unlike created_by/from_user_id elsewhere), so
-- SET NULL isn't an option — CASCADE instead: losing your own vote when you
-- delete your account is expected behavior, not data loss that needs preserving.
alter table poll_votes drop constraint poll_votes_user_id_fkey;
alter table poll_votes add constraint poll_votes_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
