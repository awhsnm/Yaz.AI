CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  fn text not null,
  called_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS api_rate_limits_lookup ON public.api_rate_limits (user_id, fn, called_at DESC);
GRANT ALL ON public.api_rate_limits TO service_role;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;