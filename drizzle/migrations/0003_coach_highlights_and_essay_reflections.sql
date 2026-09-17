-- 1. Highlight span recorded with each proactive coach intervention.
ALTER TABLE public.coach_interventions
  ADD COLUMN IF NOT EXISTS highlight_start integer,
  ADD COLUMN IF NOT EXISTS highlight_end integer;

-- 2. Per-assignment switch for the post-submission reflection.
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS reflection_required boolean NOT NULL DEFAULT false;

-- 3. Post-submission student reflection (non-research essays).
CREATE TABLE IF NOT EXISTS public.essay_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id uuid NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  argument_decision text,
  revision_note text,
  outside_support text NOT NULL DEFAULT 'none',
  outside_support_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT essay_reflections_one_per_essay UNIQUE (essay_id),
  CONSTRAINT essay_reflections_support_check CHECK (
    outside_support IN ('none', 'class_materials', 'dictionary_translation', 'other')
  )
);

GRANT SELECT, INSERT, UPDATE ON public.essay_reflections TO authenticated;
GRANT ALL ON public.essay_reflections TO service_role;

ALTER TABLE public.essay_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students manage their own reflection" ON public.essay_reflections;
CREATE POLICY "Students manage their own reflection"
ON public.essay_reflections
FOR ALL
TO authenticated
USING (student_id = auth.uid() AND public.student_owns_essay(essay_id, auth.uid()))
WITH CHECK (student_id = auth.uid() AND public.student_owns_essay(essay_id, auth.uid()));

DROP POLICY IF EXISTS "Reviewers read reflections they may review" ON public.essay_reflections;
CREATE POLICY "Reviewers read reflections they may review"
ON public.essay_reflections
FOR SELECT
TO authenticated
USING (
  public.can_review_essay(essay_id, auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM public.essays e
    WHERE e.id = essay_id AND e.research_mode = true
  )
);

CREATE INDEX IF NOT EXISTS essay_reflections_essay_idx ON public.essay_reflections(essay_id);

CREATE TRIGGER essay_reflections_updated_at
BEFORE UPDATE ON public.essay_reflections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();