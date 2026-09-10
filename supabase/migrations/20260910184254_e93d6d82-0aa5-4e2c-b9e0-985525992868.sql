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
      AND a.status = 'active'
  ) OR public.is_admin(_user_id);
$$;

REVOKE ALL ON FUNCTION public.is_beta_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_beta_active(uuid) TO authenticated;

DROP POLICY IF EXISTS "Students insert own essays" ON public.essays;
CREATE POLICY "Students insert own essays" ON public.essays
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id AND public.is_beta_active(auth.uid()));

DROP POLICY IF EXISTS "Students update own essays" ON public.essays;
CREATE POLICY "Students update own essays" ON public.essays
FOR UPDATE TO authenticated
USING (auth.uid() = student_id AND public.is_beta_active(auth.uid()))
WITH CHECK (auth.uid() = student_id AND ((classroom_id IS NULL) OR (is_submitted = false)));

DROP POLICY IF EXISTS "Students and lesson teachers view essays" ON public.essays;
CREATE POLICY "Students and lesson teachers view essays" ON public.essays
FOR SELECT TO authenticated
USING (
  public.is_beta_active(auth.uid())
  AND (
    auth.uid() = student_id
    OR (classroom_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = essays.classroom_id AND c.teacher_id = auth.uid()
    ))
  )
);