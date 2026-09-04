-- Run this in the Supabase SQL editor.
--
-- Same situation as db/migrations/0002a_collaborators_tables.sql:
-- drizzle-kit's local migration tracking got out of sync and reported
-- "no schema changes" even though these columns don't exist in the
-- database yet. This adds them directly, matching lib/db/schema.ts.

alter table screens add column if not exists address text;
alter table screens add column if not exists business_type text;
