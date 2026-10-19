-- Run this in the Supabase SQL editor.
-- Scheduled playback: a per-screen time zone and an optional per-placement schedule.
-- NULL schedule = "always eligible" (the previous behaviour), so nothing existing changes.

alter table screens add column if not exists timezone text not null default 'UTC';
alter table screen_media add column if not exists schedule jsonb;
