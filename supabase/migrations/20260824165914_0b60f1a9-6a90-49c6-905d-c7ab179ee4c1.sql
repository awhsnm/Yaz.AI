CREATE TABLE public.research_questionnaires (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  essay_id uuid NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.research_participants(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (essay_id)
);

GRANT SELECT, INSERT, UPDATE ON public.research_questionnaires TO authenticated;
GRANT ALL ON public.research_questionnaires TO service_role;

ALTER TABLE public.research_questionnaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own questionnaires"
ON public.research_questionnaires FOR SELECT TO authenticated
USING (public.student_owns_essay(essay_id, auth.uid()));

CREATE POLICY "Students insert own questionnaires"
ON public.research_questionnaires FOR INSERT TO authenticated
WITH CHECK (public.student_owns_essay(essay_id, auth.uid()));

CREATE POLICY "Students update own questionnaires"
ON public.research_questionnaires FOR UPDATE TO authenticated
USING (public.student_owns_essay(essay_id, auth.uid()));

CREATE TRIGGER research_questionnaires_updated_at
BEFORE UPDATE ON public.research_questionnaires
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();