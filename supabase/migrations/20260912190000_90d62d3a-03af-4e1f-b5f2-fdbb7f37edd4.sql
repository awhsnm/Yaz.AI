CREATE OR REPLACE FUNCTION public.collaborator_can_view_student(_student uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.essays e
    JOIN public.assignment_collaborators ac ON ac.assignment_id = e.assignment_id
    WHERE e.student_id = _student
      AND e.assignment_id IS NOT NULL
      AND e.research_mode = false
      AND ac.status = 'accepted'
      AND ac.collaborator_user_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION public.collaborator_can_view_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.collaborator_can_view_student(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Own profile, admins and lesson teachers" ON public.profiles;
CREATE POLICY "Own profile, admins, lesson teachers and collaborators"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.teacher_can_view_student(id)
  OR public.collaborator_can_view_student(id)
);