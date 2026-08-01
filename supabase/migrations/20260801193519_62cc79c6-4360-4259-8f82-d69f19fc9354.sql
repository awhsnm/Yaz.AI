ALTER TABLE public.essays
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'classroom',
  ADD COLUMN IF NOT EXISTS ai_feedback text,
  ADD COLUMN IF NOT EXISTS ai_feedback_at timestamp with time zone;

ALTER TABLE public.essays
  ADD CONSTRAINT essays_mode_check CHECK (mode IN ('classroom','solo','brainstorm'));

UPDATE public.essays SET mode = 'solo' WHERE classroom_id IS NULL;