-- ============ 1. Essay visibility columns ============
ALTER TABLE public.essays
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS shared_with_classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS graded_at timestamptz,
  ADD COLUMN IF NOT EXISTS submission_version integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.essays ADD CONSTRAINT essays_visibility_check
    CHECK (visibility IN ('private','shared','submitted','returned','graded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Preserve today's behaviour: classroom essays stay visible to their lesson teacher.
UPDATE public.essays
   SET visibility = CASE WHEN is_submitted THEN 'submitted' ELSE 'shared' END,
       shared_at  = COALESCE(shared_at, created_at),
       submitted_at = CASE WHEN is_submitted THEN COALESCE(submitted_at, updated_at) ELSE submitted_at END
 WHERE classroom_id IS NOT NULL AND visibility = 'private';

CREATE OR REPLACE FUNCTION public.default_essay_visibility()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.classroom_id IS NOT NULL AND NEW.visibility = 'private' THEN
    NEW.visibility := 'shared';
    NEW.shared_at := now();
    NEW.shared_with_classroom_id := NEW.classroom_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS essays_default_visibility ON public.essays;
CREATE TRIGGER essays_default_visibility BEFORE INSERT ON public.essays
FOR EACH ROW EXECUTE FUNCTION public.default_essay_visibility();

CREATE INDEX IF NOT EXISTS essays_visibility_idx ON public.essays (visibility);
CREATE INDEX IF NOT EXISTS essays_shared_classroom_idx ON public.essays (shared_with_classroom_id);

-- ============ 2. Classroom membership ============
CREATE TABLE IF NOT EXISTS public.classroom_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, student_id)
);
GRANT SELECT ON public.classroom_members TO authenticated;
GRANT ALL ON public.classroom_members TO service_role;
ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students see own memberships" ON public.classroom_members;
CREATE POLICY "Students see own memberships" ON public.classroom_members
FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.teacher_owns_classroom(classroom_id) OR public.is_admin(auth.uid()));

-- Backfill membership from existing classroom essays.
INSERT INTO public.classroom_members (classroom_id, student_id)
SELECT DISTINCT e.classroom_id, e.student_id FROM public.essays e
WHERE e.classroom_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_classroom_member(_classroom_id uuid, _student uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.classroom_members m
                 WHERE m.classroom_id = _classroom_id AND m.student_id = _student)
$$;
REVOKE ALL ON FUNCTION public.is_classroom_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_classroom_member(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enroll_in_classroom(_code text)
RETURNS TABLE(id uuid, name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.classrooms;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _c FROM public.classrooms c
   WHERE upper(trim(c.access_code)) = upper(trim(coalesce(_code,''))) AND c.is_active = true LIMIT 1;
  IF _c.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.classroom_members (classroom_id, student_id)
  VALUES (_c.id, auth.uid()) ON CONFLICT DO NOTHING;
  RETURN QUERY SELECT _c.id, _c.name;
END; $$;
REVOKE ALL ON FUNCTION public.enroll_in_classroom(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enroll_in_classroom(text) TO authenticated;

-- ============ 3. Submission snapshots ============
CREATE TABLE IF NOT EXISTS public.essay_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id uuid NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  classroom_id uuid,
  version integer NOT NULL,
  topic text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  word_count integer NOT NULL DEFAULT 0,
  ai_questions_shown integer NOT NULL DEFAULT 0,
  ai_student_responses integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (essay_id, version)
);
GRANT SELECT ON public.essay_submissions TO authenticated;
GRANT ALL ON public.essay_submissions TO service_role;
ALTER TABLE public.essay_submissions ENABLE ROW LEVEL SECURITY;

-- ============ 4. Rubric scores ============
CREATE TABLE IF NOT EXISTS public.essay_rubric_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id uuid NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  criterion text NOT NULL,
  score numeric,
  max_score numeric NOT NULL DEFAULT 10,
  comment text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.essay_rubric_scores TO authenticated;
GRANT ALL ON public.essay_rubric_scores TO service_role;
ALTER TABLE public.essay_rubric_scores ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS essay_rubric_scores_updated_at ON public.essay_rubric_scores;
CREATE TRIGGER essay_rubric_scores_updated_at BEFORE UPDATE ON public.essay_rubric_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 5. Activity log ============
CREATE TABLE IF NOT EXISTS public.essay_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id uuid NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.essay_activity_log TO authenticated;
GRANT ALL ON public.essay_activity_log TO service_role;
ALTER TABLE public.essay_activity_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS essay_activity_log_essay_idx ON public.essay_activity_log (essay_id, created_at DESC);

-- ============ 6. Access helper ============
CREATE OR REPLACE FUNCTION public.teacher_can_access_shared_essay(_essay_id uuid, _teacher uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.essays e
    JOIN public.classrooms c
      ON c.id = COALESCE(e.shared_with_classroom_id, e.classroom_id)
    WHERE e.id = _essay_id
      AND e.research_mode = false
      AND e.visibility <> 'private'
      AND c.teacher_id = _teacher
  )
$$;
REVOKE ALL ON FUNCTION public.teacher_can_access_shared_essay(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_can_access_shared_essay(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Student and teacher view submissions" ON public.essay_submissions;
CREATE POLICY "Student and teacher view submissions" ON public.essay_submissions
FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.teacher_can_access_shared_essay(essay_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Student and teacher view activity" ON public.essay_activity_log;
CREATE POLICY "Student and teacher view activity" ON public.essay_activity_log
FOR SELECT TO authenticated
USING (public.student_owns_essay(essay_id, auth.uid()) OR public.teacher_can_access_shared_essay(essay_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Teachers manage own rubric scores" ON public.essay_rubric_scores;
CREATE POLICY "Teachers manage own rubric scores" ON public.essay_rubric_scores
FOR ALL TO authenticated
USING (teacher_id = auth.uid() AND public.teacher_can_access_shared_essay(essay_id))
WITH CHECK (teacher_id = auth.uid() AND public.teacher_can_access_shared_essay(essay_id));

DROP POLICY IF EXISTS "Students view rubric on own graded essays" ON public.essay_rubric_scores;
CREATE POLICY "Students view rubric on own graded essays" ON public.essay_rubric_scores
FOR SELECT TO authenticated
USING (public.student_owns_essay(essay_id, auth.uid()));

-- ============ 7. Teachers only see non-private essays ============
DROP POLICY IF EXISTS "Students and lesson teachers view essays" ON public.essays;
CREATE POLICY "Students and lesson teachers view essays" ON public.essays
FOR SELECT TO authenticated
USING (
  public.is_beta_active(auth.uid())
  AND (
    auth.uid() = student_id
    OR public.teacher_can_access_shared_essay(essays.id, auth.uid())
  )
);

-- ============ 8. Student sharing actions ============
CREATE OR REPLACE FUNCTION public.share_essay_with_teacher(_essay_id uuid, _classroom_id uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e public.essays; _target uuid;
BEGIN
  SELECT * INTO _e FROM public.essays WHERE id = _essay_id AND student_id = auth.uid();
  IF _e.id IS NULL THEN RAISE EXCEPTION 'essay not found'; END IF;
  _target := COALESCE(_classroom_id, _e.shared_with_classroom_id, _e.classroom_id);
  IF _target IS NULL OR NOT public.is_classroom_member(_target, auth.uid()) THEN
    RAISE EXCEPTION 'join a classroom before sharing';
  END IF;
  UPDATE public.essays
     SET visibility = 'shared', shared_with_classroom_id = _target,
         shared_at = now(), returned_at = NULL
   WHERE id = _essay_id;
  INSERT INTO public.essay_activity_log (essay_id, actor_id, actor_role, action)
  VALUES (_essay_id, auth.uid(), 'student', 'share');
  RETURN 'shared';
END; $$;

CREATE OR REPLACE FUNCTION public.unshare_essay(_essay_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _v text;
BEGIN
  SELECT visibility INTO _v FROM public.essays WHERE id = _essay_id AND student_id = auth.uid();
  IF _v IS NULL THEN RAISE EXCEPTION 'essay not found'; END IF;
  IF _v NOT IN ('shared','returned') THEN RAISE EXCEPTION 'submitted work cannot be unshared'; END IF;
  UPDATE public.essays SET visibility = 'private', shared_at = NULL WHERE id = _essay_id;
  INSERT INTO public.essay_activity_log (essay_id, actor_id, actor_role, action)
  VALUES (_essay_id, auth.uid(), 'student', 'unshare');
  RETURN 'private';
END; $$;

CREATE OR REPLACE FUNCTION public.submit_essay_for_grading(_essay_id uuid, _classroom_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _e public.essays; _target uuid; _v integer; _sub uuid; _q integer; _r integer;
BEGIN
  SELECT * INTO _e FROM public.essays WHERE id = _essay_id AND student_id = auth.uid();
  IF _e.id IS NULL THEN RAISE EXCEPTION 'essay not found'; END IF;
  _target := COALESCE(_classroom_id, _e.shared_with_classroom_id, _e.classroom_id);
  IF _target IS NULL OR NOT public.is_classroom_member(_target, auth.uid()) THEN
    RAISE EXCEPTION 'join a classroom before submitting';
  END IF;

  SELECT count(*) FILTER (WHERE sender = 'ai'), count(*) FILTER (WHERE sender <> 'ai')
    INTO _q, _r FROM public.messages WHERE essay_id = _essay_id;

  _v := _e.submission_version + 1;
  INSERT INTO public.essay_submissions
    (essay_id, student_id, classroom_id, version, topic, subject, content, word_count,
     ai_questions_shown, ai_student_responses)
  VALUES (_essay_id, auth.uid(), _target, _v, _e.topic, _e.subject, _e.content,
          array_length(regexp_split_to_array(trim(_e.content), '\s+'), 1),
          COALESCE(_q,0), COALESCE(_r,0))
  RETURNING id INTO _sub;

  UPDATE public.essays
     SET visibility = 'submitted', shared_with_classroom_id = _target,
         submitted_at = now(), submission_version = _v, returned_at = NULL
   WHERE id = _essay_id;

  INSERT INTO public.essay_activity_log (essay_id, actor_id, actor_role, action, detail)
  VALUES (_essay_id, auth.uid(), 'student', 'submit', 'version ' || _v);
  RETURN _sub;
END; $$;

-- ============ 9. Teacher actions ============
CREATE OR REPLACE FUNCTION public.return_essay_for_revision(_essay_id uuid, _comment text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.teacher_can_access_shared_essay(_essay_id, auth.uid()) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  UPDATE public.essays SET visibility = 'returned', returned_at = now() WHERE id = _essay_id;
  INSERT INTO public.essay_activity_log (essay_id, actor_id, actor_role, action, detail)
  VALUES (_essay_id, auth.uid(), 'teacher', 'return_for_revision', left(coalesce(_comment,''), 2000));
  RETURN 'returned';
END; $$;

CREATE OR REPLACE FUNCTION public.mark_essay_graded(_essay_id uuid, _grade text, _feedback text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.teacher_can_access_shared_essay(_essay_id, auth.uid()) THEN
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
END; $$;

REVOKE ALL ON FUNCTION public.share_essay_with_teacher(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unshare_essay(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_essay_for_grading(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_essay_for_revision(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_essay_graded(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_essay_with_teacher(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unshare_essay(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_essay_for_grading(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_essay_for_revision(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_essay_graded(uuid, text, text) TO authenticated;

-- ============ 10. Student-facing classroom + teacher names ============
CREATE OR REPLACE FUNCTION public.my_classrooms()
RETURNS TABLE(classroom_id uuid, classroom_name text, teacher_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, coalesce(c.name, 'Lesson'), coalesce(p.full_name, 'your teacher')
  FROM public.classroom_members m
  JOIN public.classrooms c ON c.id = m.classroom_id
  LEFT JOIN public.profiles p ON p.id = c.teacher_id
  WHERE m.student_id = auth.uid()
  ORDER BY m.joined_at DESC
$$;
REVOKE ALL ON FUNCTION public.my_classrooms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_classrooms() TO authenticated;