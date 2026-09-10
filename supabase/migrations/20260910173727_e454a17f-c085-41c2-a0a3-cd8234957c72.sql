drop policy if exists "Teachers manage annotations" on public.annotations;
create policy "Teachers manage annotations"
on public.annotations for all to authenticated
using (
  has_role(auth.uid(),'teacher') and (
    teacher_id = auth.uid()
    or exists (select 1 from public.essays e join public.classrooms c on c.id = e.classroom_id
               where e.id = annotations.essay_id and c.teacher_id = auth.uid())
  )
)
with check (has_role(auth.uid(),'teacher') and teacher_id = auth.uid());

drop policy if exists "Teachers manage evaluations" on public.evaluations;
create policy "Teachers manage evaluations"
on public.evaluations for all to authenticated
using (
  has_role(auth.uid(),'teacher') and (
    teacher_id = auth.uid()
    or exists (select 1 from public.essays e join public.classrooms c on c.id = e.classroom_id
               where e.id = evaluations.essay_id and c.teacher_id = auth.uid())
  )
)
with check (has_role(auth.uid(),'teacher') and teacher_id = auth.uid());