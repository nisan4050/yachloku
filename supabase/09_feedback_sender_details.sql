-- Store the sender's email/name directly on the feedback row so the
-- send-feedback-email function doesn't need a join (simpler + always has
-- the details even if the profile row is incomplete).
alter table developer_feedback add column if not exists sender_email text;
alter table developer_feedback add column if not exists sender_name text;
