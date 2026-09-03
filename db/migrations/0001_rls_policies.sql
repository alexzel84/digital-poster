-- Run this in the Supabase SQL editor AFTER `npm run db:migrate` has created
-- the tables from lib/db/schema.ts. Drizzle Kit does not manage RLS policies,
-- so they're kept here as a plain, explicit SQL file.

alter table users enable row level security;
alter table screens enable row level security;
alter table media enable row level security;
alter table screen_media enable row level security;

-- users: a user can only see/update their own row
create policy "users_select_own" on users
  for select using (auth.uid() = id);

create policy "users_update_own" on users
  for update using (auth.uid() = id);

-- screens: full CRUD scoped to the owning user
create policy "screens_select_own" on screens
  for select using (auth.uid() = user_id);

create policy "screens_insert_own" on screens
  for insert with check (auth.uid() = user_id);

create policy "screens_update_own" on screens
  for update using (auth.uid() = user_id);

create policy "screens_delete_own" on screens
  for delete using (auth.uid() = user_id);

-- media: full CRUD scoped to the owning user
create policy "media_select_own" on media
  for select using (auth.uid() = user_id);

create policy "media_insert_own" on media
  for insert with check (auth.uid() = user_id);

create policy "media_update_own" on media
  for update using (auth.uid() = user_id);

create policy "media_delete_own" on media
  for delete using (auth.uid() = user_id);

-- screen_media: scoped via the parent screen's owner
create policy "screen_media_select_own" on screen_media
  for select using (
    exists (
      select 1 from screens
      where screens.id = screen_media.screen_id
      and screens.user_id = auth.uid()
    )
  );

create policy "screen_media_insert_own" on screen_media
  for insert with check (
    exists (
      select 1 from screens
      where screens.id = screen_media.screen_id
      and screens.user_id = auth.uid()
    )
  );

create policy "screen_media_update_own" on screen_media
  for update using (
    exists (
      select 1 from screens
      where screens.id = screen_media.screen_id
      and screens.user_id = auth.uid()
    )
  );

create policy "screen_media_delete_own" on screen_media
  for delete using (
    exists (
      select 1 from screens
      where screens.id = screen_media.screen_id
      and screens.user_id = auth.uid()
    )
  );

-- Keep public.users in sync with auth.users on signup.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Note: the /api/screens/:id/manifest route authenticates via the screen's
-- hashed token using the service-role key (RLS bypass), NOT a Supabase
-- session — screens are never logged-in Supabase users. The route itself
-- must scope every query to the single screen whose token matched.
