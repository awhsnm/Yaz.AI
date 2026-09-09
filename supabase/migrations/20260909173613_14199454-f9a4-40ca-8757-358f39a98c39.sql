DROP POLICY IF EXISTS "Admins view all essays" ON public.essays;
CREATE POLICY "Admins view all essays" ON public.essays FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins view all messages" ON public.messages;
CREATE POLICY "Admins view all messages" ON public.messages FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins view all writing events" ON public.writing_events;
CREATE POLICY "Admins view all writing events" ON public.writing_events FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));