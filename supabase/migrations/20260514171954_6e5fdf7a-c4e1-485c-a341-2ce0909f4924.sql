-- ESSAYS
CREATE TABLE public.essays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  is_submitted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.essays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students view own essays"
  ON public.essays FOR SELECT TO authenticated
  USING (auth.uid() = student_id OR public.has_role(auth.uid(), 'teacher'::public.app_role));

CREATE POLICY "Students insert own essays"
  ON public.essays FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students update own essays"
  ON public.essays FOR UPDATE TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Students delete own essays"
  ON public.essays FOR DELETE TO authenticated
  USING (auth.uid() = student_id);

CREATE TRIGGER update_essays_updated_at
  BEFORE UPDATE ON public.essays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_essays_student ON public.essays(student_id);

-- MESSAGES
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  essay_id UUID NOT NULL REFERENCES public.essays(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View messages for accessible essays"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.essays e
      WHERE e.id = messages.essay_id
        AND (e.student_id = auth.uid() OR public.has_role(auth.uid(), 'teacher'::public.app_role))
    )
  );

CREATE POLICY "Owner inserts messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.essays e
      WHERE e.id = messages.essay_id AND e.student_id = auth.uid()
    )
  );

CREATE INDEX idx_messages_essay ON public.messages(essay_id);

-- Auto-create trigger for handle_new_user (was created in prior migration but trigger missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();