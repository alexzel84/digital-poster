-- Run this in the Supabase SQL editor.

alter table media add column if not exists cloned_from_id uuid references media(id) on delete set null;
