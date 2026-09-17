INSERT INTO public.beta_allowlist (email, role, status)
SELECT v.email, 'student'::app_role, 'invited'
FROM (VALUES ('zjook.1846@gmail.com'), ('zhalildinadilet@gmail.com')) AS v(email)
WHERE NOT EXISTS (
  SELECT 1 FROM public.beta_allowlist b WHERE lower(b.email) = v.email
);