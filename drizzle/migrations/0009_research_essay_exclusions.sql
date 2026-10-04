CREATE TABLE public.research_essay_exclusions (
  essay_id uuid PRIMARY KEY REFERENCES public.essays(id) ON DELETE CASCADE,
  excluded_by uuid REFERENCES auth.users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.research_essay_exclusions TO authenticated;
GRANT ALL ON public.research_essay_exclusions TO service_role;

ALTER TABLE public.research_essay_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage research exclusions"
ON public.research_essay_exclusions
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));