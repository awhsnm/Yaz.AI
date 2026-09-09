
-- helper: admin check
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::public.app_role)
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;

-- 1. allowlist
CREATE TABLE public.beta_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  role public.app_role NOT NULL DEFAULT 'student',
  status text NOT NULL DEFAULT 'invited',
  invited_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_allowlist_status_chk CHECK (status IN ('invited','active','disabled'))
);
CREATE UNIQUE INDEX beta_allowlist_email_key ON public.beta_allowlist (lower(email));
CREATE INDEX beta_allowlist_status_idx ON public.beta_allowlist (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_allowlist TO authenticated;
GRANT ALL ON public.beta_allowlist TO service_role;
ALTER TABLE public.beta_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage allowlist" ON public.beta_allowlist FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Users view own allowlist row" ON public.beta_allowlist FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE TRIGGER beta_allowlist_updated_at BEFORE UPDATE ON public.beta_allowlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. feedback
CREATE TABLE public.beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  message text NOT NULL,
  page_url text,
  screenshot_path text,
  user_agent text,
  status text NOT NULL DEFAULT 'new',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_feedback_category_chk CHECK (category IN ('bug','confusing','suggestion','other')),
  CONSTRAINT beta_feedback_status_chk CHECK (status IN ('new','reviewing','resolved','closed'))
);
CREATE INDEX beta_feedback_created_idx ON public.beta_feedback (created_at DESC);
CREATE INDEX beta_feedback_status_idx ON public.beta_feedback (status, created_at DESC);
CREATE INDEX beta_feedback_category_idx ON public.beta_feedback (category, created_at DESC);
CREATE INDEX beta_feedback_user_idx ON public.beta_feedback (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.beta_feedback TO authenticated;
GRANT ALL ON public.beta_feedback TO service_role;
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own feedback" ON public.beta_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users view own feedback" ON public.beta_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins update feedback" ON public.beta_feedback FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER beta_feedback_updated_at BEFORE UPDATE ON public.beta_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.limit_beta_feedback()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  SELECT count(*) INTO _n FROM public.beta_feedback
   WHERE user_id = NEW.user_id AND created_at > now() - interval '5 minutes';
  IF _n >= 5 THEN
    RAISE EXCEPTION 'Too many feedback submissions. Please wait a few minutes.';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER beta_feedback_rate_limit BEFORE INSERT ON public.beta_feedback
  FOR EACH ROW EXECUTE FUNCTION public.limit_beta_feedback();

-- 3. error logs
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  page text,
  feature text,
  message text NOT NULL,
  details text,
  severity text NOT NULL DEFAULT 'error',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT error_logs_severity_chk CHECK (severity IN ('warn','error','fatal','request'))
);
CREATE INDEX error_logs_created_idx ON public.error_logs (created_at DESC);
CREATE INDEX error_logs_user_idx ON public.error_logs (user_id, created_at DESC);
CREATE INDEX error_logs_severity_idx ON public.error_logs (severity, created_at DESC);

GRANT INSERT ON public.error_logs TO authenticated;
GRANT SELECT ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users log errors" ON public.error_logs FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Admins read error logs" ON public.error_logs FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.limit_error_logs()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO _n FROM public.error_logs
   WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute';
  IF _n >= 60 THEN RETURN NULL; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER error_logs_rate_limit BEFORE INSERT ON public.error_logs
  FOR EACH ROW EXECUTE FUNCTION public.limit_error_logs();

-- 4. login events
CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_events_created_idx ON public.login_events (created_at DESC);
CREATE INDEX login_events_user_idx ON public.login_events (user_id, created_at DESC);

GRANT SELECT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read login events" ON public.login_events FOR SELECT TO authenticated
  USING (public.is_admin());

-- 5. beta status resolver + login recorder
CREATE OR REPLACE FUNCTION public.record_beta_login(_user_agent text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _status text; _last timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'unauthenticated'; END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = auth.uid();
  IF _email IS NULL THEN RETURN 'not_invited'; END IF;

  IF public.is_admin(auth.uid()) THEN _status := 'active';
  ELSE
    SELECT status INTO _status FROM public.beta_allowlist WHERE lower(email) = _email;
    IF _status IS NULL THEN RETURN 'not_invited'; END IF;
    IF _status = 'disabled' THEN RETURN 'disabled'; END IF;
  END IF;

  SELECT last_login_at INTO _last FROM public.beta_allowlist WHERE lower(email) = _email;
  UPDATE public.beta_allowlist
     SET status = CASE WHEN status = 'invited' THEN 'active' ELSE status END,
         last_login_at = now()
   WHERE lower(email) = _email;

  IF _last IS NULL OR _last < now() - interval '30 minutes' THEN
    INSERT INTO public.login_events (user_id, user_agent) VALUES (auth.uid(), left(coalesce(_user_agent,''), 400));
  END IF;

  RETURN 'active';
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_beta_login(text) FROM anon;
