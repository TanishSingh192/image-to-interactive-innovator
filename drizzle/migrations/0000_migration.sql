create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  hypothesis text not null default '',
  agents text[] not null default '{}',
  environments text[] not null default '{}',
  action_budget int not null default 80,
  timeout_s int not null default 300,
  repetitions int not null default 1,
  seed int not null default 42,
  prompt_version text not null default 'v1',
  temperature numeric not null default 0.2,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  agent text not null,
  environment text not null,
  repetition int not null default 1,
  status text not null default 'queued',
  score numeric not null default 0,
  solved boolean not null default false,
  actions int not null default 0,
  duration_ms int not null default 0,
  tokens int not null default 0,
  cost numeric not null default 0,
  failures int not null default 0,
  retries int not null default 0,
  created_at timestamptz not null default now()
);
create table public.steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  step_index int not null,
  observation jsonb not null,
  proposed_action text not null,
  executed_action text not null,
  valid boolean not null default true,
  latency_ms int not null default 0,
  tokens int not null default 0,
  state_change text not null default '',
  error text
);
create index on public.runs(experiment_id);
create index on public.steps(run_id, step_index);

grant select, insert, update, delete on public.experiments, public.runs, public.steps to authenticated;
grant all on public.experiments, public.runs, public.steps to service_role;
alter table public.experiments enable row level security;
alter table public.runs enable row level security;
alter table public.steps enable row level security;

create policy "own experiments" on public.experiments for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own runs" on public.runs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own steps" on public.steps for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());