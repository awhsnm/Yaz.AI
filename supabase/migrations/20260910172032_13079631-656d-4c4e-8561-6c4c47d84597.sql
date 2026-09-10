CREATE OR REPLACE FUNCTION public.beta_progress()
RETURNS TABLE (
  email text,
  full_name text,
  role app_role,
  status text,
  invited_at timestamptz,
  last_login_at timestamptz,
  signed_up boolean,
  essay_count integer,
  submitted_count integer,
  feedback_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.email,
    COALESCE(a.full_name, p.full_name) AS full_name,
    a.role,
    a.status,
    a.invited_at,
    a.last_login_at,
    (u.id IS NOT NULL) AS signed_up,
    COALESCE(e.total, 0)::int AS essay_count,
    COALESCE(e.submitted, 0)::int AS submitted_count,
    COALESCE(f.total, 0)::int AS feedback_count
  FROM public.beta_allowlist a
  LEFT JOIN auth.users u ON lower(u.email) = lower(a.email)
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN LATERAL (
    SELECT count(*) AS total, count(*) FILTER (WHERE es.is_submitted) AS submitted
    FROM public.essays es WHERE es.student_id = u.id
  ) e ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS total FROM public.beta_feedback bf WHERE bf.user_id = u.id
  ) f ON true
  WHERE public.is_admin(auth.uid())
  ORDER BY a.invited_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.beta_progress() FROM anon;
GRANT EXECUTE ON FUNCTION public.beta_progress() TO authenticated;