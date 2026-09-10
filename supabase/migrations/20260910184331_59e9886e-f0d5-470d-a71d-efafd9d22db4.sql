CREATE OR REPLACE FUNCTION public.is_beta_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.beta_allowlist a ON lower(a.email) = lower(u.email)
    WHERE u.id = _user_id
      AND u.email_confirmed_at IS NOT NULL
      AND a.status IN ('invited','active')
  ) OR public.is_admin(_user_id);
$$;