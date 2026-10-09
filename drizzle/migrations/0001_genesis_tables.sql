
CREATE TABLE public.genesis_worlds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled world',
  seed integer NOT NULL DEFAULT 1,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  clock integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'paused',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.genesis_worlds TO authenticated;
GRANT ALL ON public.genesis_worlds TO service_role;
ALTER TABLE public.genesis_worlds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their worlds" ON public.genesis_worlds FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.genesis_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.genesis_worlds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#b4442c',
  model_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  position jsonb NOT NULL DEFAULT '{"x":0,"y":0}'::jsonb,
  status text NOT NULL DEFAULT 'idle',
  objective text NOT NULL DEFAULT 'explore',
  resources jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.genesis_agents TO authenticated;
GRANT ALL ON public.genesis_agents TO service_role;
ALTER TABLE public.genesis_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their agents" ON public.genesis_agents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.genesis_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.genesis_worlds(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.genesis_agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step integer NOT NULL,
  observation jsonb NOT NULL DEFAULT '{}'::jsonb,
  action text NOT NULL,
  predicted jsonb,
  actual jsonb NOT NULL DEFAULT '{}'::jsonb,
  prediction_error numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.genesis_experiences TO authenticated;
GRANT ALL ON public.genesis_experiences TO service_role;
ALTER TABLE public.genesis_experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their experiences" ON public.genesis_experiences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.genesis_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.genesis_worlds(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.genesis_agents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rule text NOT NULL,
  kind text NOT NULL DEFAULT 'hypothesis',
  confidence numeric NOT NULL DEFAULT 0.3,
  evidence integer NOT NULL DEFAULT 1,
  shared boolean NOT NULL DEFAULT false,
  discovery_step integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, rule)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.genesis_knowledge TO authenticated;
GRANT ALL ON public.genesis_knowledge TO service_role;
ALTER TABLE public.genesis_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their knowledge" ON public.genesis_knowledge FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.genesis_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id uuid NOT NULL REFERENCES public.genesis_worlds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  step integer NOT NULL,
  kind text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.genesis_events TO authenticated;
GRANT ALL ON public.genesis_events TO service_role;
ALTER TABLE public.genesis_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their events" ON public.genesis_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.genesis_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  hypothesis text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  seed integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.genesis_experiments TO authenticated;
GRANT ALL ON public.genesis_experiments TO service_role;
ALTER TABLE public.genesis_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their experiments" ON public.genesis_experiments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
