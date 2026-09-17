-- 1. Lesson (classroom/assignment) work can never be hidden from the teacher.
CREATE OR REPLACE FUNCTION public.unshare_essay(_essay_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _e public.essays;
BEGIN
  SELECT * INTO _e FROM public.essays WHERE id = _essay_id AND student_id = auth.uid();
  IF _e.id IS NULL THEN RAISE EXCEPTION 'essay not found'; END IF;
  IF _e.classroom_id IS NOT NULL OR _e.assignment_id IS NOT NULL THEN
    RAISE EXCEPTION 'lesson work stays visible to your teacher';
  END IF;
  IF _e.is_submitted THEN RAISE EXCEPTION 'submitted work cannot be unshared'; END IF;
  IF _e.visibility NOT IN ('shared','returned') THEN RAISE EXCEPTION 'submitted work cannot be unshared'; END IF;
  UPDATE public.essays SET visibility = 'private', shared_at = NULL WHERE id = _essay_id;
  INSERT INTO public.essay_activity_log (essay_id, actor_id, actor_role, action)
  VALUES (_essay_id, auth.uid(), 'student', 'unshare');
  RETURN 'private';
END; $function$;

-- 2. Invited assignment collaborators may use the grading tools on essays shared with them.
CREATE OR REPLACE FUNCTION public.can_review_essay(_essay_id uuid, _user uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.teacher_can_access_shared_essay(_essay_id, _user)
      OR public.collaborator_can_access_essay(_essay_id, _user)
$function$;

REVOKE EXECUTE ON FUNCTION public.can_review_essay(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_review_essay(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.return_essay_for_revision(_essay_id uuid, _comment text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_review_essay(_essay_id, auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.essays SET visibility = 'returned', returned_at = now() WHERE id = _essay_id;
  INSERT INTO public.essay_activity_log (essay_id, actor_id, actor_role, action, detail)
  VALUES (_essay_id, auth.uid(), 'teacher', 'return_for_revision', left(coalesce(_comment,''), 2000));
  RETURN 'returned';
END; $function$;

CREATE OR REPLACE FUNCTION public.mark_essay_graded(_essay_id uuid, _grade text, _feedback text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.can_review_essay(_essay_id, auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  INSERT INTO public.evaluations (essay_id, teacher_id, grade, feedback)
  VALUES (_essay_id, auth.uid(), coalesce(_grade,''), coalesce(_feedback,''))
  ON CONFLICT (essay_id) DO UPDATE
    SET grade = excluded.grade, feedback = excluded.feedback, teacher_id = excluded.teacher_id;
  UPDATE public.essays SET visibility = 'graded', graded_at = now() WHERE id = _essay_id;
  INSERT INTO public.essay_activity_log (essay_id, actor_id, actor_role, action, detail)
  VALUES (_essay_id, auth.uid(), 'teacher', 'grade', left(coalesce(_grade,''), 200));
  RETURN 'graded';
END; $function$;

-- Rubric scores: allow collaborators too.
DROP POLICY IF EXISTS "Teachers manage own rubric scores" ON public.essay_rubric_scores;
CREATE POLICY "Teachers and collaborators manage rubric scores"
ON public.essay_rubric_scores
FOR ALL
TO authenticated
USING (public.can_review_essay(essay_id, auth.uid()))
WITH CHECK (public.can_review_essay(essay_id, auth.uid()));

-- Submissions: collaborators can read the submitted snapshot.
DROP POLICY IF EXISTS "Student and teacher view submissions" ON public.essay_submissions;
CREATE POLICY "Student, teacher and collaborator view submissions"
ON public.essay_submissions
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.can_review_essay(essay_id, auth.uid())
);