
CREATE INDEX IF NOT EXISTS essays_student_updated_idx ON public.essays (student_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS classrooms_teacher_idx ON public.classrooms (teacher_id, created_at DESC);
