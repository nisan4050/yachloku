-- Add reactions, typing status, and read status to group_messages
-- Run this against your Supabase project to enable chat features

-- Add reactions column (stores { "emoji": [user_ids] } )
alter table group_messages add column if not exists reactions jsonb default '{}'::jsonb;

-- Add read_by column to track who read the message
alter table group_messages add column if not exists read_by jsonb default '[]'::jsonb;

-- Add media_meta column (stores { name, type, size } for uploaded attachments)
alter table group_messages add column if not exists media_meta jsonb;

-- Create reactions index for faster queries
create index if not exists group_messages_reactions_gin_idx on group_messages using gin (reactions);
