alter table public.lobbies add column if not exists game_state jsonb;
alter table public.lobbies add column if not exists current_seat int not null default 0;
alter table public.lobbies add column if not exists knocker_seat int;
alter table public.lobbies add column if not exists final_turns int not null default 0;
alter table public.lobby_players add column if not exists lives int not null default 3;
alter table public.lobby_players add column if not exists coins int not null default 1000;
alter table public.lobby_players add column if not exists xp int not null default 0;
alter table public.lobby_players add column if not exists level int not null default 1;

drop policy if exists "room players can update active game" on public.lobbies;
create policy "room players can update active game" on public.lobbies for update to authenticated
using (exists (select 1 from public.lobby_players p where p.lobby_id = id and p.user_id = auth.uid()))
with check (exists (select 1 from public.lobby_players p where p.lobby_id = id and p.user_id = auth.uid()));

do $$ begin
  alter publication supabase_realtime add table public.lobbies;
exception when duplicate_object then null;
end $$;
