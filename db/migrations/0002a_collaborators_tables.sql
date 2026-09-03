create table if not exists screen_collaborators (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references screens(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (screen_id, user_id)
);

create table if not exists screen_invites (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references screens(id) on delete cascade,
  token_hash text not null,
  created_by_user_id uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_by_user_id uuid references users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
