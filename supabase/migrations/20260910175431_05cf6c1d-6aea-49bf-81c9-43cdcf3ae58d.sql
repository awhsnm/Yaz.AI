CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  prompt text,
  instructions text,
  due_at timestamptz,
  time_limit_minutes integer DEFAULT 45,
  is_published boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.teacher_owns_classroom(_classroom_id uuid, _teacher uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = _classroom_id AND c.teacher_id = _teacher)
$$;

CREATE OR REPLACE FUNCTION public.student_in_classroom(_classroom_id uuid, _student uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.essays e WHERE e.classroom_id = _classroom_id AND e.student_id = _student)
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_owns_classroom(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.student_in_classroom(uuid, uuid) FROM anon;

CREATE POLICY "Teachers and admins view assignments"
ON public.assignments FOR SELECT TO authenticated
USING (public.teacher_owns_classroom(classroom_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Students view published assignments"
ON public.assignments FOR SELECT TO authenticated
USING (is_published = true AND is_archived = false AND public.student_in_classroom(classroom_id, auth.uid()));

CREATE POLICY "Teachers insert assignments in own classrooms"
ON public.assignments FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.teacher_owns_classroom(classroom_id, auth.uid()));

CREATE POLICY "Teachers update assignments in own classrooms"
ON public.assignments FOR UPDATE TO authenticated
USING (public.teacher_owns_classroom(classroom_id, auth.uid()))
WITH CHECK (public.teacher_owns_classroom(classroom_id, auth.uid()));

CREATE POLICY "Teachers delete assignments in own classrooms"
ON public.assignments FOR DELETE TO authenticated
USING (public.teacher_owns_classroom(classroom_id, auth.uid()));

CREATE TRIGGER assignments_updated_at BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS assignments_classroom_idx ON public.assignments(classroom_id);

ALTER TABLE public.essays ADD COLUMN IF NOT EXISTS assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS essays_assignment_idx ON public.essays(assignment_id);
CREATE UNIQUE INDEX IF NOT EXISTS essays_one_per_assignment_idx ON public.essays(student_id, assignment_id) WHERE assignment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.list_classroom_assignments(_code text)
RETURNS TABLE(id uuid, classroom_id uuid, classroom_name text, title text, description text, prompt text, instructions text, due_at timestamptz, time_limit_minutes integer, essay_id uuid, is_submitted boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.classroom_id, c.name, a.title, a.description, a.prompt, a.instructions, a.due_at, a.time_limit_minutes,
         e.id, COALESCE(e.is_submitted, false)
  FROM public.classrooms c
  JOIN public.assignments a ON a.classroom_id = c.id
  LEFT JOIN public.essays e ON e.assignment_id = a.id AND e.student_id = auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND upper(trim(c.access_code)) = upper(trim(_code))
    AND c.is_active = true
    AND a.is_published = true
    AND a.is_archived = false
  ORDER BY a.created_at
$$;

CREATE OR REPLACE FUNCTION public.start_assignment_essay(_assignment_id uuid, _code text, _subject text DEFAULT 'English')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _essay uuid; _classroom uuid; _title text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT a.classroom_id, a.title INTO _classroom, _title
  FROM public.assignments a
  JOIN public.classrooms c ON c.id = a.classroom_id
  WHERE a.id = _assignment_id
    AND a.is_published = true AND a.is_archived = false
    AND c.is_active = true
    AND upper(trim(c.access_code)) = upper(trim(coalesce(_code, '')));

  IF _classroom IS NULL THEN RAISE EXCEPTION 'assignment not available'; END IF;

  SELECT e.id INTO _essay FROM public.essays e
   WHERE e.assignment_id = _assignment_id AND e.student_id = auth.uid();
  IF _essay IS NOT NULL THEN RETURN _essay; END IF;

  INSERT INTO public.essays (student_id, topic, subject, classroom_id, assignment_id, mode)
  VALUES (auth.uid(), _title, coalesce(nullif(trim(_subject), ''), 'English'), _classroom, _assignment_id, 'classroom')
  RETURNING id INTO _essay;

  RETURN _essay;
END; $$;

REVOKE EXECUTE ON FUNCTION public.list_classroom_assignments(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_assignment_essay(uuid, text, text) FROM anon;