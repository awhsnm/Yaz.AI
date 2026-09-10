CREATE OR REPLACE FUNCTION public.submit_classroom_essay(_essay_id uuid, _password text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  UPDATE public.essays
     SET is_submitted = true
   WHERE id = _essay_id
     AND student_id = auth.uid();
  RETURN FOUND;
END; $function$;

UPDATE public.assignments SET is_published = true WHERE is_published = false;