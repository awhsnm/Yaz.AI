-- classroom_members: explicit, tightly scoped write policies.
DROP POLICY IF EXISTS "Students join classrooms themselves" ON public.classroom_members;
CREATE POLICY "Students join classrooms themselves"
ON public.classroom_members FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Student or owning teacher removes membership" ON public.classroom_members;
CREATE POLICY "Student or owning teacher removes membership"
ON public.classroom_members FOR DELETE TO authenticated
USING (
  student_id = auth.uid()
  OR public.teacher_owns_classroom(classroom_id)
  OR public.is_admin(auth.uid())
);

-- essay_activity_log: append-only, actor must be the writer and must have access.
DROP POLICY IF EXISTS "Participants append own activity" ON public.essay_activity_log;
CREATE POLICY "Participants append own activity"
ON public.essay_activity_log FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND (
    public.student_owns_essay(essay_id, auth.uid())
    OR public.teacher_can_access_shared_essay(essay_id)
    OR public.is_admin(auth.uid())
  )
);
