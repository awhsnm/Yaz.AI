CREATE TABLE public.essay_teacher_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id uuid NOT NULL UNIQUE REFERENCES public.essays(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  model_version text,
  prompt_version text,
  assessment_confidence text,
  ideas_reasoning_score integer,
  ideas_reasoning_confidence text,
  ideas_reasoning_rationale text,
  organization_score integer,
  organization_confidence text,
  organization_rationale text,
  voice_score integer,
  voice_confidence text,
  voice_rationale text,
  word_choice_clarity_score integer,
  word_choice_clarity_confidence text,
  word_choice_clarity_rationale text,
  sentence_fluency_score integer,
  sentence_fluency_confidence text,
  sentence_fluency_rationale text,
  conventions_score integer,
  conventions_confidence text,
  conventions_rationale text,
  strongest_arguments jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority_improvement_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  possible_teacher_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  writing_duration_seconds integer,
  final_word_count integer,
  paragraph_count integer,
  meaningful_revision_count integer,
  submitted_at timestamptz,
  ai_questions_shown integer,
  ai_questions_answered integer,
  ai_questions_skipped integer,
  ai_questions_not_now integer,
  ai_coach_paused boolean,
  ai_prompt_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_support_label text,
  ai_support_interpretation text,
  ai_suggested_revision_type text,
  ai_revision_confidence text,
  teacher_confirmed_revision_type text,
  researcher_coded_revision_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.essay_teacher_assessments TO authenticated;
GRANT ALL ON public.essay_teacher_assessments TO service_role;
ALTER TABLE public.essay_teacher_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owning teacher can view assessment"
ON public.essay_teacher_assessments FOR SELECT TO authenticated
USING (public.teacher_owns_essay_classroom(essay_id, auth.uid()));

CREATE POLICY "Admins can view all assessments"
ON public.essay_teacher_assessments FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER essay_teacher_assessments_updated_at
BEFORE UPDATE ON public.essay_teacher_assessments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.essay_student_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id uuid NOT NULL UNIQUE REFERENCES public.essays(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at timestamptz NOT NULL DEFAULT now(),
  model_version text,
  prompt_version text,
  what_is_working_well jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_step_for_revision text,
  revision_question text,
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.essay_student_feedback TO authenticated;
GRANT ALL ON public.essay_student_feedback TO service_role;
ALTER TABLE public.essay_student_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own feedback"
ON public.essay_student_feedback FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE POLICY "Owning teacher can view student feedback"
ON public.essay_student_feedback FOR SELECT TO authenticated
USING (public.teacher_owns_essay_classroom(essay_id, auth.uid()));

CREATE POLICY "Admins can view all student feedback"
ON public.essay_student_feedback FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER essay_student_feedback_updated_at
BEFORE UPDATE ON public.essay_student_feedback
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_essay_student_feedback_student ON public.essay_student_feedback(student_id);