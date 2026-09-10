GRANT ALL ON TABLE public.api_rate_limits TO service_role;
REVOKE ALL ON TABLE public.api_rate_limits FROM anon, authenticated;

DROP POLICY IF EXISTS "Service role manages API rate limits" ON public.api_rate_limits;
CREATE POLICY "Service role manages API rate limits"
ON public.api_rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Admins delete essays" ON public.essays;
CREATE POLICY "Admins delete essays"
ON public.essays
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Classroom teachers delete classroom essays" ON public.essays;
CREATE POLICY "Classroom teachers delete classroom essays"
ON public.essays
FOR DELETE
TO authenticated
USING (
  classroom_id IS NOT NULL
  AND public.teacher_owns_classroom(classroom_id, auth.uid())
);