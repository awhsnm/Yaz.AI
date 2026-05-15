
CREATE TABLE public.classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  access_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  exit_password text,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own classrooms select"
ON public.classrooms FOR SELECT TO authenticated
USING (teacher_id = auth.uid() OR is_active = true);

CREATE POLICY "Teachers insert own classrooms"
ON public.classrooms FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid() AND public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Teachers update own classrooms"
ON public.classrooms FOR UPDATE TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "Teachers delete own classrooms"
ON public.classrooms FOR DELETE TO authenticated
USING (teacher_id = auth.uid());

CREATE TRIGGER update_classrooms_updated_at
BEFORE UPDATE ON public.classrooms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.essays ADD COLUMN classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL;
CREATE INDEX idx_essays_classroom_id ON public.essays(classroom_id);
