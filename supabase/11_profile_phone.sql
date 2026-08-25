-- Optional phone number, used to speed up peer-to-peer settling via
-- external apps (Bit etc.) — see src/lib/bitLink.js.
alter table profiles add column if not exists phone text;
