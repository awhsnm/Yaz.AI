REVOKE EXECUTE ON FUNCTION public.teacher_owns_classroom(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_in_classroom(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_classroom_assignments(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.start_assignment_essay(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_owns_classroom(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_in_classroom(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_classroom_assignments(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_assignment_essay(uuid, text, text) TO authenticated;