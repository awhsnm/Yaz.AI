-- 1) api_rate_limits: server-only
REVOKE ALL ON public.api_rate_limits FROM anon, authenticated;
GRANT ALL ON public.api_rate_limits TO service_role;
COMMENT ON TABLE public.api_rate_limits IS 'Server-only. Written by edge functions via service role; no client access by design.';

-- 2) beta_allowlist: match on verified email from auth.users, not the JWT claim
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(u.email)
  FROM auth.users u
  WHERE u.id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.current_user_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;

DROP POLICY IF EXISTS "Users view own allowlist row" ON public.beta_allowlist;
CREATE POLICY "Users view own allowlist row"
ON public.beta_allowlist
FOR SELECT
TO authenticated
USING (lower(email) = public.current_user_email());

-- 3) annotations: teachers may only modify their own annotations
DROP POLICY IF EXISTS "Teachers manage annotations" ON public.annotations;

CREATE POLICY "Teachers view lesson annotations"
ON public.annotations
FOR SELECT
TO authenticated
USING (
  teacher_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.essays e
    JOIN public.classrooms c ON c.id = e.classroom_id
    WHERE e.id = annotations.essay_id AND c.teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers create own annotations"
ON public.annotations
FOR INSERT
TO authenticated
WITH CHECK (
  teacher_id = auth.uid()
  AND public.has_role(auth.uid(), 'teacher'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.essays e
    JOIN public.classrooms c ON c.id = e.classroom_id
    WHERE e.id = annotations.essay_id AND c.teacher_id = auth.uid()
  )
);

CREATE POLICY "Teachers update own annotations"
ON public.annotations
FOR UPDATE
TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers delete own annotations"
ON public.annotations
FOR DELETE
TO authenticated
USING (teacher_id = auth.uid());