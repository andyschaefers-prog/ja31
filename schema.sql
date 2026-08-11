create table public.lobbies (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (char_length(code) = 6),
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','playing','finished')),
  created_at timestamptz not null default now()
);

create table public.lobby_players (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null check (char_length(player_name) between 2 and 18),
  seat int not null check (seat between 0 and 3),
  joined_at timestamptz not null default now(),
  unique (lobby_id, user_id), unique (lobby_id, seat)
);

alter table public.lobbies enable row level security;
alter table public.lobby_players enable row level security;
create policy "authenticated users can read lobbies" on public.lobbies for select to authenticated using (true);
create policy "users can create own lobbies" on public.lobbies for insert to authenticated with check (auth.uid() = owner_id);
create policy "authenticated users can read players" on public.lobby_players for select to authenticated using (true);
create policy "users can join as themselves" on public.lobby_players for insert to authenticated with check (auth.uid() = user_id);
alter publication supabase_realtime add table public.lobby_players;
