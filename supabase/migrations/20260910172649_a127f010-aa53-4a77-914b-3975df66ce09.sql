-- Helper: may the current teacher see this student (they wrote in the teacher's classroom)?
CREATE OR REPLACE FUNCTION public.teacher_can_view_student(_student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.essays e
    JOIN public.classrooms c ON c.id = e.classroom_id
    WHERE e.student_id = _student AND c.teacher_id = auth.uid()
  )
$$;

-- Students join a lesson without reading the classrooms table.
CREATE OR REPLACE FUNCTION public.join_classroom_by_code(_code text)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name FROM public.classrooms c
  WHERE auth.uid() IS NOT NULL
    AND upper(trim(c.access_code)) = upper(trim(_code))
    AND c.is_active = true
  LIMIT 1
$$;

-- Exit password verified server-side before a classroom essay is submitted.
CREATE OR REPLACE FUNCTION public.submit_classroom_essay(_essay_id uuid, _password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.essays e
    JOIN public.classrooms c ON c.id = e.classroom_id
    WHERE e.id = _essay_id
      AND e.student_id = auth.uid()
      AND c.exit_password IS NOT NULL
      AND upper(trim(c.exit_password)) = upper(trim(coalesce(_password, '')))
  ) INTO _ok;
  IF NOT _ok THEN RETURN false; END IF;
  UPDATE public.essays SET is_submitted = true WHERE id = _essay_id AND student_id = auth.uid();
  RETURN true;
END; $$;

REVOKE EXECUTE ON FUNCTION public.teacher_can_view_student(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.join_classroom_by_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_classroom_essay(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.teacher_can_view_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_classroom_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_classroom_essay(uuid, text) TO authenticated;

-- Classrooms: owner (or admin) only.
DROP POLICY IF EXISTS "Teachers manage own classrooms select" ON public.classrooms;
CREATE POLICY "Teachers and admins view classrooms" ON public.classrooms
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin(auth.uid()));

-- Profiles: self, admins, and teachers of that student's lessons.
DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;
CREATE POLICY "Own profile, admins and lesson teachers" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.teacher_can_view_student(id)
  );

-- Students cannot flip a classroom essay to submitted without the exit password.
DROP POLICY IF EXISTS "Students update own essays" ON public.essays;
CREATE POLICY "Students update own essays" ON public.essays
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (
    auth.uid() = student_id
    AND (classroom_id IS NULL OR is_submitted = false)
  );

-- Signed-out visitors get no table or function access.
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM anon;