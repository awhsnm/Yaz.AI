CREATE TABLE public.writing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  essay_id uuid NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  at timestamp with time zone NOT NULL DEFAULT now(),
  snapshot text NOT NULL DEFAULT '',
  word_count integer NOT NULL DEFAULT 0,
  chars_added integer NOT NULL DEFAULT 0,
  is_paste boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.writing_events TO authenticated;
GRANT ALL ON public.writing_events TO service_role;

ALTER TABLE public.writing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students insert own writing events"
ON public.writing_events FOR INSERT TO authenticated
WITH CHECK (student_id = auth.uid() AND EXISTS (
  SELECT 1 FROM public.essays e WHERE e.id = essay_id AND e.student_id = auth.uid()
));

CREATE POLICY "Students and teachers view writing events"
ON public.writing_events FOR SELECT TO authenticated
USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'teacher'::public.app_role));

CREATE INDEX writing_events_essay_at_idx ON public.writing_events (essay_id, at);