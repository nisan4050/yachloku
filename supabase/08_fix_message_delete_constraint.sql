-- The original check constraint required content/media_url/location to
-- never ALL be null — which is exactly what a soft-delete does (it nulls
-- all three out). So deleting a text-only message always violated this
-- constraint and failed. Allow the all-null state when the message is
-- soft-deleted.
alter table group_messages drop constraint group_messages_check;
alter table group_messages add constraint group_messages_check
  check (deleted_at is not null or content is not null or media_url is not null or location is not null);
