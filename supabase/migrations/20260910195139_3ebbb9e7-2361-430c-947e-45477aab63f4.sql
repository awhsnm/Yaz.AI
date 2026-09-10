ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS subject text NOT NULL DEFAULT 'English';

DROP FUNCTION IF EXISTS public.list_classroom_assignments(text);

CREATE OR REPLACE FUNCTION public.list_classroom_assignments(_code text)
 RETURNS TABLE(id uuid, classroom_id uuid, classroom_name text, title text, description text, prompt text, instructions text, due_at timestamp with time zone, time_limit_minutes integer, subject text, essay_id uuid, is_submitted boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.id, a.classroom_id, c.name, a.title, a.description, a.prompt, a.instructions, a.due_at, a.time_limit_minutes, a.subject,
         e.id, COALESCE(e.is_submitted, false)
  FROM public.classrooms c
  JOIN public.assignments a ON a.classroom_id = c.id
  LEFT JOIN public.essays e ON e.assignment_id = a.id AND e.student_id = auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND upper(trim(c.access_code)) = upper(trim(_code))
    AND c.is_active = true
    AND a.is_published = true
    AND a.is_archived = false
  ORDER BY a.created_at
$function$;

CREATE OR REPLACE FUNCTION public.start_assignment_essay(_assignment_id uuid, _code text, _subject text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _essay uuid; _classroom uuid; _title text; _asubject text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT a.classroom_id, a.title, a.subject INTO _classroom, _title, _asubject
  FROM public.assignments a
  JOIN public.classrooms c ON c.id = a.classroom_id
  WHERE a.id = _assignment_id
    AND a.is_published = true AND a.is_archived = false
    AND c.is_active = true
    AND upper(trim(c.access_code)) = upper(trim(coalesce(_code, '')));

  IF _classroom IS NULL THEN RAISE EXCEPTION 'assignment not available'; END IF;

  SELECT e.id INTO _essay FROM public.essays e
   WHERE e.assignment_id = _assignment_id AND e.student_id = auth.uid();
  IF _essay IS NOT NULL THEN RETURN _essay; END IF;

  INSERT INTO public.essays (student_id, topic, subject, classroom_id, assignment_id, mode)
  VALUES (auth.uid(), _title, coalesce(nullif(trim(_asubject), ''), nullif(trim(_subject), ''), 'English'), _classroom, _assignment_id, 'classroom')
  RETURNING id INTO _essay;

  RETURN _essay;
END; $function$;