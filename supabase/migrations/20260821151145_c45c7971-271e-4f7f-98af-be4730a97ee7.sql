
CREATE OR REPLACE FUNCTION public.teacher_owns_essay_classroom(_essay_id uuid, _teacher uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.essays e
    JOIN public.classrooms c ON c.id = e.classroom_id
    WHERE e.id = _essay_id
      AND e.classroom_id IS NOT NULL
      AND c.teacher_id = _teacher
  )
$$;

DROP POLICY IF EXISTS "Students view own essays" ON public.essays;
CREATE POLICY "Students and lesson teachers view essays"
ON public.essays FOR SELECT TO authenticated
USING (
  auth.uid() = student_id
  OR (
    classroom_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.classrooms c
      WHERE c.id = essays.classroom_id AND c.teacher_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "View messages for accessible essays" ON public.messages;
CREATE POLICY "View messages for accessible essays"
ON public.messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.essays e
    WHERE e.id = messages.essay_id AND e.student_id = auth.uid()
  )
  OR public.teacher_owns_essay_classroom(messages.essay_id, auth.uid())
);

DROP POLICY IF EXISTS "Students and teachers view writing events" ON public.writing_events;
CREATE POLICY "Students and lesson teachers view writing events"
ON public.writing_events FOR SELECT TO authenticated
USING (
  student_id = auth.uid()
  OR public.teacher_owns_essay_classroom(writing_events.essay_id, auth.uid())
);
