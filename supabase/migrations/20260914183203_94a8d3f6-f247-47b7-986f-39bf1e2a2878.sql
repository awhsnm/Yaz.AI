REVOKE ALL ON FUNCTION public.list_classroom_assignments(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_classroom_assignments(text) TO authenticated, service_role;