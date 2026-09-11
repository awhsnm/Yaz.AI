
CREATE TABLE public.assignment_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  collaborator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'reviewer' CHECK (role IN ('reviewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz
);

CREATE UNIQUE INDEX assignment_collaborators_unique_email
  ON public.assignment_collaborators (assignment_id, lower(invited_email));
CREATE INDEX assignment_collaborators_user_idx
  ON public.assignment_collaborators (collaborator_user_id, status);

CREATE OR REPLACE FUNCTION public.normalize_collaborator_email()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.invited_email := lower(trim(NEW.invited_email));
  RETURN NEW;
END; $$;

CREATE TRIGGER assignment_collaborators_normalize_email
BEFORE INSERT OR UPDATE ON public.assignment_collaborators
FOR EACH ROW EXECUTE FUNCTION public.normalize_collaborator_email();

GRANT SELECT, INSERT, UPDATE ON public.assignment_collaborators TO authenticated;
GRANT ALL ON public.assignment_collaborators TO service_role;

ALTER TABLE public.assignment_collaborators ENABLE ROW LEVEL SECURITY;

-- helpers -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.owns_assignment(_assignment_id uuid, _user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.classrooms c ON c.id = a.classroom_id
    WHERE a.id = _assignment_id AND c.teacher_id = _user
  )
$$;

CREATE OR REPLACE FUNCTION public.is_accepted_assignment_collaborator(_assignment_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignment_collaborators ac
    WHERE ac.assignment_id = _assignment_id
      AND ac.status = 'accepted'
      AND ac.collaborator_user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.collaborator_can_access_essay(_essay_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.essays e
    JOIN public.assignment_collaborators ac ON ac.assignment_id = e.assignment_id
    WHERE e.id = _essay_id
      AND e.assignment_id IS NOT NULL
      AND e.research_mode = false
      AND ac.status = 'accepted'
      AND ac.collaborator_user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.accept_assignment_invitations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  _email := public.current_user_email();
  IF _email IS NULL THEN RETURN 0; END IF;

  UPDATE public.assignment_collaborators
     SET collaborator_user_id = auth.uid(),
         status = 'accepted',
         accepted_at = now()
   WHERE lower(invited_email) = _email
     AND status = 'pending';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END; $$;

REVOKE ALL ON FUNCTION public.accept_assignment_invitations() FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_assignment_invitations() TO authenticated;

-- collaborator table policies -----------------------------------------
CREATE POLICY "Owners and admins view collaborators"
ON public.assignment_collaborators FOR SELECT TO authenticated
USING (public.owns_assignment(assignment_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Collaborators view own record"
ON public.assignment_collaborators FOR SELECT TO authenticated
USING (collaborator_user_id = auth.uid());

CREATE POLICY "Owners invite collaborators"
ON public.assignment_collaborators FOR INSERT TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND (public.owns_assignment(assignment_id, auth.uid()) OR public.is_admin(auth.uid()))
);

CREATE POLICY "Owners manage collaborators"
ON public.assignment_collaborators FOR UPDATE TO authenticated
USING (public.owns_assignment(assignment_id, auth.uid()) OR public.is_admin(auth.uid()))
WITH CHECK (public.owns_assignment(assignment_id, auth.uid()) OR public.is_admin(auth.uid()));

-- related table access -------------------------------------------------
CREATE POLICY "Collaborators view shared assignment"
ON public.assignments FOR SELECT TO authenticated
USING (public.is_accepted_assignment_collaborator(id, auth.uid()));

CREATE POLICY "Collaborators view shared assignment essays"
ON public.essays FOR SELECT TO authenticated
USING (public.collaborator_can_access_essay(id, auth.uid()));

CREATE POLICY "Collaborators view shared writing events"
ON public.writing_events FOR SELECT TO authenticated
USING (public.collaborator_can_access_essay(essay_id, auth.uid()));

CREATE POLICY "Collaborators view shared messages"
ON public.messages FOR SELECT TO authenticated
USING (public.collaborator_can_access_essay(essay_id, auth.uid()));

CREATE POLICY "Collaborators view shared assessments"
ON public.essay_teacher_assessments FOR SELECT TO authenticated
USING (public.collaborator_can_access_essay(essay_id, auth.uid()));

CREATE POLICY "Collaborators view shared student feedback"
ON public.essay_student_feedback FOR SELECT TO authenticated
USING (public.collaborator_can_access_essay(essay_id, auth.uid()));

CREATE POLICY "Collaborators view shared annotations"
ON public.annotations FOR SELECT TO authenticated
USING (public.collaborator_can_access_essay(essay_id, auth.uid()));

CREATE POLICY "Collaborators create annotations"
ON public.annotations FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid() AND public.collaborator_can_access_essay(essay_id, auth.uid()));

CREATE POLICY "Collaborators view shared evaluations"
ON public.evaluations FOR SELECT TO authenticated
USING (public.collaborator_can_access_essay(essay_id, auth.uid()));

CREATE POLICY "Collaborators create evaluations"
ON public.evaluations FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid() AND public.collaborator_can_access_essay(essay_id, auth.uid()));

CREATE POLICY "Collaborators update own evaluations"
ON public.evaluations FOR UPDATE TO authenticated
USING (teacher_id = auth.uid() AND public.collaborator_can_access_essay(essay_id, auth.uid()))
WITH CHECK (teacher_id = auth.uid() AND public.collaborator_can_access_essay(essay_id, auth.uid()));
