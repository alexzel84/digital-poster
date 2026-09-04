-- Run this in the Supabase SQL editor.

alter table users add column if not exists terms_accepted_at timestamptz;

-- Update the existing signup trigger (from 0001_rls_policies.sql) so it
-- also captures terms acceptance at account-creation time, read from the
-- metadata passed to supabase.auth.signUp({ options: { data: {...} } }).
-- This works regardless of whether email confirmation is required,
-- since the metadata is attached to auth.users immediately at signup,
-- before any session/authenticated API call would be possible.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, terms_accepted_at)
  values (
    new.id,
    new.email,
    (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz
  );
  return new;
end;
$$ language plpgsql security definer;
