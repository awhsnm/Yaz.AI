-- Additive columns on essays (existing rows keep current behaviour)
ALTER TABLE public.essays
  ADD COLUMN IF NOT EXISTS research_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS coach_questions_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS text_stage text NOT NULL DEFAULT 'planning';

-- 1. Research participants (pseudonymisation)
CREATE TABLE public.research_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_code text NOT NULL UNIQUE,
  consented_at timestamptz,
  consent_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.research_participants TO authenticated;
GRANT ALL ON public.research_participants TO service_role;

ALTER TABLE public.research_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own participant record"
  ON public.research_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own participant record"
  ON public.research_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own participant record"
  ON public.research_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER research_participants_updated_at
  BEFORE UPDATE ON public.research_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: fetch-or-create the caller's pseudonymous participant code
CREATE OR REPLACE FUNCTION public.ensure_research_participant()
RETURNS public.research_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _row public.research_participants;
  _n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO _row FROM public.research_participants WHERE user_id = auth.uid();
  IF FOUND THEN
    RETURN _row;
  END IF;

  SELECT COALESCE(MAX(NULLIF(regexp_replace(participant_code, '\D', '', 'g'), '')::int), 0) + 1
    INTO _n FROM public.research_participants;

  INSERT INTO public.research_participants (user_id, participant_code)
  VALUES (auth.uid(), 'P' || lpad(_n::text, 2, '0'))
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

-- Helper: is this essay owned by the calling student?
CREATE OR REPLACE FUNCTION public.student_owns_essay(_essay_id uuid, _student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.essays e
    WHERE e.id = _essay_id AND e.student_id = _student
  )
$$;

-- 2. Coach interventions (research log)
CREATE TABLE public.coach_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id uuid NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.research_participants(id) ON DELETE CASCADE,
  text_stage text NOT NULL DEFAULT 'drafting',
  word_count integer NOT NULL DEFAULT 0,
  trigger_event text NOT NULL,
  issue_category text NOT NULL DEFAULT 'none',
  paragraph_index integer,
  question_shown text,
  suppressed_reason text,
  user_action text,
  reflection_response text,
  snapshot_before_id uuid REFERENCES public.writing_events(id) ON DELETE SET NULL,
  snapshot_after_id uuid REFERENCES public.writing_events(id) ON DELETE SET NULL,
  target_paragraph_changed boolean,
  revision_type text,
  intervention_version text,
  system_prompt_version text,
  model text,
  model_version text,
  question_helpfulness text,
  coach_paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coach_interventions_essay_idx ON public.coach_interventions (essay_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.coach_interventions TO authenticated;
GRANT ALL ON public.coach_interventions TO service_role;

ALTER TABLE public.coach_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students and lesson teachers view coach interventions"
  ON public.coach_interventions FOR SELECT TO authenticated
  USING (
    public.student_owns_essay(essay_id, auth.uid())
    OR public.teacher_owns_essay_classroom(essay_id, auth.uid())
  );

CREATE POLICY "Students insert own coach interventions"
  ON public.coach_interventions FOR INSERT TO authenticated
  WITH CHECK (public.student_owns_essay(essay_id, auth.uid()));

CREATE POLICY "Students update own coach interventions"
  ON public.coach_interventions FOR UPDATE TO authenticated
  USING (public.student_owns_essay(essay_id, auth.uid()));

CREATE TRIGGER coach_interventions_updated_at
  BEFORE UPDATE ON public.coach_interventions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Coach pause events
CREATE TABLE public.coach_pause_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id uuid NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.research_participants(id) ON DELETE CASCADE,
  paused boolean NOT NULL,
  word_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.coach_pause_events TO authenticated;
GRANT ALL ON public.coach_pause_events TO service_role;

ALTER TABLE public.coach_pause_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students and lesson teachers view coach pause events"
  ON public.coach_pause_events FOR SELECT TO authenticated
  USING (
    public.student_owns_essay(essay_id, auth.uid())
    OR public.teacher_owns_essay_classroom(essay_id, auth.uid())
  );

CREATE POLICY "Students insert own coach pause events"
  ON public.coach_pause_events FOR INSERT TO authenticated
  WITH CHECK (public.student_owns_essay(essay_id, auth.uid()));