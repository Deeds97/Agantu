create table if not exists public.profiles (
  id uuid primary key,
  email text unique not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key,
  status text not null check (status in ('waiting', 'active', 'finished')),
  round int not null default 1,
  phase text not null check (phase in ('preparation', 'duel', 'npc_events', 'rewards')),
  active_seat int not null check (active_seat between 1 and 4),
  rng_seed bigint not null,
  winner_seat int,
  bounty_seat int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_players (
  id bigserial primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null,
  seat int not null check (seat between 1 and 4),
  hero_name text not null,
  vp int not null default 0,
  active_quest_ids text[] not null default '{}',
  unique(match_id, seat),
  unique(match_id, user_id)
);

create table if not exists public.match_state_snapshots (
  id bigserial primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  round int not null,
  phase text not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.turn_events (
  id bigserial primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  seat int not null check (seat between 1 and 4),
  action_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
