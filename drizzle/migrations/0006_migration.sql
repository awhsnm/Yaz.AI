create table public.study_cohorts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.study_cohorts to authenticated;
grant all on public.study_cohorts to service_role;
alter table public.study_cohorts enable row level security;
create policy "admins manage cohorts" on public.study_cohorts for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.study_participants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  participant_code text not null unique,
  study_cohort_id uuid references public.study_cohorts(id) on delete set null,
  consent_status text not null default 'unknown' check (consent_status in ('unknown','consented','withdrawn')),
  included boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.study_participants to authenticated;
grant all on public.study_participants to service_role;
alter table public.study_participants enable row level security;
create policy "admins manage participants" on public.study_participants for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.research_message_reviews (
  interaction_id uuid primary key references public.ai_interactions(id) on delete cascade,
  auto_request_category text,
  final_request_category text,
  is_direct_writing_request boolean,
  auto_response_type text,
  final_response_type text,
  is_socratic_response boolean,
  is_boundary_redirection boolean,
  ai_wrote_ready_text boolean,
  review_status text not null default 'unreviewed' check (review_status in ('unreviewed','reviewed','corrected')),
  reviewer_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  auto_classified_at timestamptz,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.research_message_reviews to authenticated;
grant all on public.research_message_reviews to service_role;
alter table public.research_message_reviews enable row level security;
create policy "admins manage message reviews" on public.research_message_reviews for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.research_essay_coding (
  essay_id uuid primary key references public.essays(id) on delete cascade,
  clear_claim smallint check (clear_claim between 0 and 2),
  relevant_evidence smallint check (relevant_evidence between 0 and 2),
  evidence_explanation smallint check (evidence_explanation between 0 and 2),
  counterargument smallint check (counterargument between 0 and 2),
  organization smallint check (organization between 0 and 2),
  notes text,
  coded_by uuid,
  coded_at timestamptz
);
grant select, insert, update, delete on public.research_essay_coding to authenticated;
grant all on public.research_essay_coding to service_role;
alter table public.research_essay_coding enable row level security;
create policy "admins manage essay coding" on public.research_essay_coding for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- Assign anonymous P-codes to students with essays, ordered by first essay.
create or replace function public.assign_study_participants()
returns integer language plpgsql security definer set search_path = public as $$
declare n int := 0; r record; next_num int;
begin
  if not public.is_admin(auth.uid()) then raise exception 'forbidden'; end if;
  select coalesce(max(nullif(regexp_replace(participant_code,'\D','','g'),'')::int),0) into next_num from study_participants;
  for r in
    select e.student_id, min(e.created_at) first_at from essays e
    where not exists (select 1 from study_participants sp where sp.user_id = e.student_id)
      and not public.is_admin(e.student_id)
    group by e.student_id order by first_at
  loop
    next_num := next_num + 1;
    insert into study_participants(user_id, participant_code) values (r.student_id, 'P' || lpad(next_num::text, 2, '0'));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.assign_study_participants() from public, anon;
grant execute on function public.assign_study_participants() to authenticated;