-- Security fix: Supabase flagged both these tables as publicly readable/
-- writable (RLS was never enabled on them — an oversight from when they were
-- created this session). Neither is actually referenced anywhere in the app:
--   - expense_participants: scaffolding for an "activity split" mode
--     (supabase/15_expense_notes_and_trip_rules.sql) that was never wired
--     into the UI — split_mode itself is unused too, but that's just an
--     inert column on events, not a whole exposed table.
--   - system_messages: superseded before it was ever used — settlement
--     system messages ended up living in chat_messages.is_system instead
--     (supabase/17_system_messages_in_chat.sql), so this table was dead on
--     arrival.
-- Dropping outright rather than bolting on RLS policies for tables nothing
-- reads or writes.
drop table if exists expense_participants;
drop table if exists system_messages;
