
-- Annotations table
CREATE TABLE public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id UUID NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL,
  start_index INTEGER NOT NULL,
  end_index INTEGER NOT NULL,
  color_code TEXT NOT NULL DEFAULT '#fde68a',
  comment_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage annotations"
ON public.annotations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'teacher'))
WITH CHECK (public.has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid());

CREATE POLICY "Students view annotations on own essays"
ON public.annotations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.essays e WHERE e.id = annotations.essay_id AND e.student_id = auth.uid()));

CREATE TRIGGER annotations_updated_at BEFORE UPDATE ON public.annotations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_annotations_essay ON public.annotations(essay_id);

-- Evaluations table
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id UUID NOT NULL UNIQUE REFERENCES public.essays(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL,
  grade TEXT NOT NULL DEFAULT '',
  feedback TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage evaluations"
ON public.evaluations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'teacher'))
WITH CHECK (public.has_role(auth.uid(), 'teacher') AND teacher_id = auth.uid());

CREATE POLICY "Students view own evaluations"
ON public.evaluations FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.essays e WHERE e.id = evaluations.essay_id AND e.student_id = auth.uid()));

CREATE TRIGGER evaluations_updated_at BEFORE UPDATE ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Essays: AI detection columns
ALTER TABLE public.essays
  ADD COLUMN ai_probability NUMERIC,
  ADD COLUMN ai_checked_at TIMESTAMPTZ;
