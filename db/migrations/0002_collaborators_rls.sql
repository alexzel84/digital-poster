-- Run this in the Supabase SQL editor AFTER running `npm run db:migrate`
-- to create the screen_collaborators and screen_invites tables.
--
-- Reminder: the app's own API routes (using Drizzle over a direct
-- Postgres connection) are the actual enforcement point for the
-- owner/contributor permission rules — see lib/screen/access.ts and the
-- route handlers under app/api/media, app/api/screens. These RLS
-- policies are defense-in-depth for any direct Supabase client access,
-- consistent with 0001_rls_policies.sql.

alter table screen_collaborators enable row level security;
alter table screen_invites enable row level security;

-- screen_collaborators: the screen owner can see/manage who has access;
-- a collaborator can see their own membership row.
create policy "screen_collaborators_select" on screen_collaborators
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from screens
      where screens.id = screen_collaborators.screen_id
      and screens.user_id = auth.uid()
    )
  );

create policy "screen_collaborators_delete_owner" on screen_collaborators
  for delete using (
    exists (
      select 1 from screens
      where screens.id = screen_collaborators.screen_id
      and screens.user_id = auth.uid()
    )
  );

-- screen_invites: only the screen owner can see/create invites for their
-- own screen. Accepting an invite happens through the app's API (service
-- role), not directly, since an unauthenticated/new user needs to look up
-- the invite by token before they're a collaborator.
create policy "screen_invites_select_owner" on screen_invites
  for select using (
    exists (
      select 1 from screens
      where screens.id = screen_invites.screen_id
      and screens.user_id = auth.uid()
    )
  );

create policy "screen_invites_insert_owner" on screen_invites
  for insert with check (
    exists (
      select 1 from screens
      where screens.id = screen_invites.screen_id
      and screens.user_id = auth.uid()
    )
  );

-- Extend existing screens/media/screen_media SELECT access to
-- collaborators, so a contributor's own direct Supabase queries (if any)
-- can see the screen and its media, not just the app's own API routes.
create policy "screens_select_collaborator" on screens
  for select using (
    exists (
      select 1 from screen_collaborators
      where screen_collaborators.screen_id = screens.id
      and screen_collaborators.user_id = auth.uid()
    )
  );

create policy "screen_media_select_collaborator" on screen_media
  for select using (
    exists (
      select 1 from screen_collaborators
      where screen_collaborators.screen_id = screen_media.screen_id
      and screen_collaborators.user_id = auth.uid()
    )
  );
