REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_beta_login(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_research_participant() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_owns_essay(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_owns_essay_classroom(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_can_view_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_classroom_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_classroom_essay(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.beta_progress() TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;