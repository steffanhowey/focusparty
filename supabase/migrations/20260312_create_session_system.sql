-- Phase 1: Persistence Substrate
-- Creates session tracking, sprint records, goals, and activity event tables.

-- ─── fp_sessions ───────────────────────────────────────────────
-- One row per focus session (solo or party). Status: active → completed | abandoned.
create table public.fp_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  party_id uuid references public.fp_parties(id) on delete set null,
  task_id uuid references public.fp_tasks(id) on delete set null,
  character text,
  goal_text text,
  phase text not null default 'setup',
  status text not null default 'active',
  planned_duration_sec int not null default 1500,
  actual_duration_sec int,
  reflection_mood text,
  reflection_productivity int,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index fp_sessions_user_id_idx on public.fp_sessions(user_id);
create index fp_sessions_party_id_idx on public.fp_sessions(party_id);
create index fp_sessions_status_idx on public.fp_sessions(user_id, status);

-- ─── fp_session_sprints ────────────────────────────────────────
-- One row per sprint within a session (supports "another round").
create table public.fp_session_sprints (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.fp_sessions(id) on delete cascade,
  sprint_number int not null default 1,
  duration_sec int not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  completed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create index fp_session_sprints_session_id_idx on public.fp_session_sprints(session_id);

-- ─── fp_session_goals ──────────────────────────────────────────
-- Goals declared during a session, optionally linked to a task.
create table public.fp_session_goals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.fp_sessions(id) on delete cascade,
  sprint_id uuid references public.fp_session_sprints(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.fp_tasks(id) on delete set null,
  body text not null,
  status text not null default 'declared',
  declared_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index fp_session_goals_session_id_idx on public.fp_session_goals(session_id);
create index fp_session_goals_user_id_idx on public.fp_session_goals(user_id);

-- ─── fp_activity_events ────────────────────────────────────────
-- Backbone of momentum feed, progress tracking, and AI host context.
create table public.fp_activity_events (
  id uuid primary key default gen_random_uuid(),
  party_id uuid references public.fp_parties(id) on delete cascade,
  session_id uuid references public.fp_sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  actor_type text not null default 'user',
  event_type text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index fp_activity_events_party_id_idx on public.fp_activity_events(party_id, created_at desc);
create index fp_activity_events_user_id_idx on public.fp_activity_events(user_id, created_at desc);
create index fp_activity_events_session_id_idx on public.fp_activity_events(session_id);

-- ─── RLS: fp_sessions ─────────────────────────────────────────
alter table public.fp_sessions enable row level security;

create policy "Users can view own sessions"
  on public.fp_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.fp_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.fp_sessions for update
  using (auth.uid() = user_id);

-- ─── RLS: fp_session_sprints ──────────────────────────────────
alter table public.fp_session_sprints enable row level security;

create policy "Users can view own sprints"
  on public.fp_session_sprints for select
  using (exists (
    select 1 from public.fp_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

create policy "Users can insert own sprints"
  on public.fp_session_sprints for insert
  with check (exists (
    select 1 from public.fp_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

create policy "Users can update own sprints"
  on public.fp_session_sprints for update
  using (exists (
    select 1 from public.fp_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

-- ─── RLS: fp_session_goals ────────────────────────────────────
alter table public.fp_session_goals enable row level security;

create policy "Users can view own goals"
  on public.fp_session_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.fp_session_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.fp_session_goals for update
  using (auth.uid() = user_id);

-- ─── RLS: fp_activity_events ──────────────────────────────────
alter table public.fp_activity_events enable row level security;

create policy "Users can view own events"
  on public.fp_activity_events for select
  using (auth.uid() = user_id);

-- Client can only insert user-actor events; host/system events come from server.
create policy "Users can insert own events"
  on public.fp_activity_events for insert
  with check (auth.uid() = user_id and actor_type = 'user');

-- ─── Realtime ──────────────────────────────────────────────────
alter publication supabase_realtime add table fp_sessions;
alter publication supabase_realtime add table fp_activity_events;
