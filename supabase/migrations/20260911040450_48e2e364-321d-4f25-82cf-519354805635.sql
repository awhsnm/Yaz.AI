
REVOKE ALL ON FUNCTION public.owns_assignment(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_accepted_assignment_collaborator(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.collaborator_can_access_essay(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.accept_assignment_invitations() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.owns_assignment(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_accepted_assignment_collaborator(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.collaborator_can_access_essay(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_assignment_invitations() TO authenticated, service_role;
REVOKE ALL ON public.assignment_collaborators FROM anon;
