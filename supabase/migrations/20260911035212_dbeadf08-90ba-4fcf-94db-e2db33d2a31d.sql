CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role;
  _listed public.app_role;
BEGIN
  SELECT role INTO _listed FROM public.beta_allowlist WHERE lower(email) = lower(NEW.email) LIMIT 1;

  _role := COALESCE(
    _listed,
    CASE WHEN NEW.raw_user_meta_data->>'role' = 'teacher' THEN 'teacher'::public.app_role END,
    'student'::public.app_role
  );

  IF _role = 'admin'::public.app_role THEN
    _role := 'teacher'::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, full_name, school, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'school', _role);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  RETURN NEW;
END;
$function$;