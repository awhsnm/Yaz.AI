-- Raw, research-oriented event storage. Derived metrics are computed from these
-- rows at query time; no engagement or focus "score" is ever stored.

create table public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  essay_id uuid not null references public.essays(id) on delete cascade,
  created_at timestamptz not null default now(),
  interaction_type text not null default 'tutor_chat',
  source text not null default 'custom',
  student_message text not null,
  ai_response text,
  word_count_at_interaction integer,
  primary_category text,
  confidence_score numeric check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  classification_reason text,
  classified_at timestamptz,
  constraint ai_interactions_category_check check (
    primary_category is null or primary_category in (
      'socratic_use','generation_request','predefined_prompt','revision_feedback','off_task','other'
    )
  )
);

create table public.focus_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  essay_id uuid not null references public.essays(id) on delete cascade,
  event_type text not null,
  created_at timestamptz not null default now(),
  metadata jsonb,
  constraint focus_events_type_check check (
    event_type in (
      'writing_started','text_changed','writing_paused','writing_resumed',
      'ai_input_focus','ai_input_blur','ai_interaction',
      'tab_hidden','tab_visible','window_blurred','window_focused','essay_saved'
    )
  )
);

create index ai_interactions_essay_idx on public.ai_interactions (essay_id, created_at);
create index ai_interactions_student_idx on public.ai_interactions (student_id, created_at);
create index focus_events_essay_idx on public.focus_events (essay_id, created_at);
create index focus_events_student_idx on public.focus_events (student_id, created_at);

grant select, insert on public.ai_interactions to authenticated;
grant select, insert on public.focus_events to authenticated;
grant all on public.ai_interactions to service_role;
grant all on public.focus_events to service_role;

alter table public.ai_interactions enable row level security;
alter table public.focus_events enable row level security;

create policy "Students record their own AI interactions"
  on public.ai_interactions for insert to authenticated
  with check (student_id = auth.uid());
create policy "Students and admins read AI interactions"
  on public.ai_interactions for select to authenticated
  using (student_id = auth.uid() or public.is_admin(auth.uid()));

create policy "Students record their own focus events"
  on public.focus_events for insert to authenticated
  with check (student_id = auth.uid());
create policy "Students and admins read focus events"
  on public.focus_events for select to authenticated
  using (student_id = auth.uid() or public.is_admin(auth.uid()));

-- ============ Derived metrics (computed from raw events on read) ============

-- Per-essay focus/engagement metrics for one essay. The inactivity threshold
-- (seconds without meaningful interaction before "inactive") is configurable.
create or replace function public.essay_focus_metrics(_essay_id uuid, _inactive_seconds integer default 45)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_times timestamptz[];
  v_n integer;
  v_first timestamptz;
  v_last timestamptz;
  v_total_span double precision := 0;
  v_active double precision := 0;
  v_inactive double precision := 0;
  v_sessions integer := 0;
  v_session_spans double precision[] := '{}';
  v_cur_start timestamptz := null;
  v_cur_end timestamptz := null;
  v_gap double precision;
  v_i integer;
  v_word_count integer;
  v_ai_total integer := 0;
  v_cat record;
  v_socratic integer := 0;
  v_generation integer := 0;
  v_predefined integer := 0;
  v_revision integer := 0;
  v_offtask integer := 0;
  v_other integer := 0;
  v_switches integer := 0;
  v_resume_ai double precision[] := '{}';
  v_resume_focus double precision[] := '{}';
  v_next timestamptz;
  v_ai_time double precision := 0;
  v_ai_focus_in timestamptz := null;
  v_rec record;
  v_completion double precision := null;
  v_essay record;
  v_result json;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not allowed';
  end if;

  if _inactive_seconds is null or _inactive_seconds < 10 then
    _inactive_seconds := 45;
  end if;

  select * into v_essay from public.essays where id = _essay_id;
  if v_essay.id is null then return null; end if;

  v_word_count := array_length(regexp_split_to_array(trim(coalesce(v_essay.content, '')), '\s+'), 1);
  if v_word_count is null then v_word_count := 0; end if;

  -- Merged activity stream: typing snapshots + meaningful interface interactions.
  with act as (
    select created_at from public.writing_events where essay_id = _essay_id
    union all
    select created_at from public.focus_events
    where essay_id = _essay_id
      and event_type in ('writing_started','text_changed','writing_resumed','ai_interaction','essay_saved')
  )
  select array(select created_at from act order by created_at) into v_times;
  v_n := coalesce(array_length(v_times, 1), 0);

  if v_n > 0 then
    v_first := v_times[1];
    v_last := v_times[v_n];
    v_total_span := extract(epoch from (v_last - v_first));

    for v_i in 2..v_n loop
      v_gap := extract(epoch from (v_times[v_i] - v_times[v_i - 1]));
      if v_gap <= _inactive_seconds then
        v_active := v_active + v_gap;
        if v_cur_start is null then v_cur_start := v_times[v_i - 1]; end if;
        v_cur_end := v_times[v_i];
      else
        if v_cur_start is not null then
          v_sessions := v_sessions + 1;
          v_session_spans := v_session_spans || extract(epoch from (v_cur_end - v_cur_start));
          v_cur_start := null;
          v_cur_end := null;
        end if;
      end if;
    end loop;
    if v_cur_start is not null then
      v_sessions := v_sessions + 1;
      v_session_spans := v_session_spans || extract(epoch from (v_cur_end - v_cur_start));
    end if;
    v_inactive := v_total_span - v_active;
  end if;

  -- AI interaction metrics.
  select count(*) into v_ai_total from public.ai_interactions where essay_id = _essay_id;
  for v_cat in
    select primary_category, count(*) as n from public.ai_interactions
    where essay_id = _essay_id and primary_category is not null
    group by primary_category
  loop
    case v_cat.primary_category
      when 'socratic_use' then v_socratic := v_cat.n;
      when 'generation_request' then v_generation := v_cat.n;
      when 'predefined_prompt' then v_predefined := v_cat.n;
      when 'revision_feedback' then v_revision := v_cat.n;
      when 'off_task' then v_offtask := v_cat.n;
      else v_other := v_other + v_cat.n;
    end case;
  end loop;

  -- Time to resume writing after each AI interaction (next activity of any kind).
  for v_rec in
    select i.created_at as at from public.ai_interactions i where i.essay_id = _essay_id
  loop
    select min(t) into v_next from unnest(v_times) as t where t > v_rec.at;
    if v_next is not null then
      v_resume_ai := v_resume_ai || extract(epoch from (v_next - v_rec.at));
    end if;
  end loop;

  -- Time to resume writing after returning from another tab/window.
  for v_rec in
    select created_at as at from public.focus_events
    where essay_id = _essay_id and event_type = 'window_focused'
  loop
    select min(t) into v_next from unnest(v_times) as t where t > v_rec.at;
    if v_next is not null then
      v_resume_focus := v_resume_focus || extract(epoch from (v_next - v_rec.at));
    end if;
  end loop;

  select count(*) into v_switches from public.focus_events
  where essay_id = _essay_id and event_type = 'window_blurred';

  -- Time spent typing in the AI panel (focus → blur pairs).
  for v_rec in
    select created_at as at, event_type from public.focus_events
    where essay_id = _essay_id and event_type in ('ai_input_focus','ai_input_blur')
    order by created_at
  loop
    if v_rec.event_type = 'ai_input_focus' then
      v_ai_focus_in := v_rec.at;
    elsif v_ai_focus_in is not null then
      v_ai_time := v_ai_time + greatest(0, extract(epoch from (v_rec.at - v_ai_focus_in)));
      v_ai_focus_in := null;
    end if;
  end loop;

  if v_essay.submitted_at is not null and v_first is not null then
    v_completion := greatest(0, extract(epoch from (v_essay.submitted_at - v_first)));
  elsif v_first is not null then
    v_completion := v_total_span;
  end if;

  v_result := json_build_object(
    'essay_id', _essay_id,
    'word_count', v_word_count,
    'writing_duration_seconds', v_total_span,
    'active_focus_time_seconds', v_active,
    'inactive_time_seconds', v_inactive,
    'number_of_focus_sessions', v_sessions,
    'average_focus_session_seconds', case when v_sessions > 0 then (select avg(x) from unnest(v_session_spans) x) else 0 end,
    'median_focus_session_seconds', case when v_sessions > 0 then (select percentile_cont(0.5) within group (order by x) from unnest(v_session_spans) x) else 0 end,
    'longest_focus_session_seconds', case when v_sessions > 0 then (select max(x) from unnest(v_session_spans) x) else 0 end,
    'number_of_focus_interruptions', greatest(v_sessions - 1, 0),
    'average_inactive_period_seconds', case when v_sessions > 1 then v_inactive / (v_sessions - 1) else v_inactive end,
    'average_active_stretch_between_interruptions_seconds', case when v_sessions > 0 then (select avg(x) from unnest(v_session_spans) x) else 0 end,
    'external_window_switches', v_switches,
    'total_ai_interactions', v_ai_total,
    'ai_interactions_per_100_words', case when v_word_count > 0 then round((v_ai_total::numeric * 100 / v_word_count), 2) else 0 end,
    'socratic_interactions', v_socratic,
    'writing_generation_requests', v_generation,
    'predefined_prompt_usage', v_predefined,
    'revision_feedback_requests', v_revision,
    'off_task_interactions', v_offtask,
    'other_interactions', v_other,
    'average_time_to_resume_writing_after_ai_seconds', case when array_length(v_resume_ai, 1) > 0 then (select avg(x) from unnest(v_resume_ai) x) else null end,
    'average_time_to_resume_writing_after_focus_loss_seconds', case when array_length(v_resume_focus, 1) > 0 then (select avg(x) from unnest(v_resume_focus) x) else null end,
    'time_in_ai_interface_seconds', v_ai_time,
    'essay_completion_time_seconds', v_completion,
    'first_activity_at', v_first,
    'last_activity_at', v_last,
    'is_submitted', v_essay.is_submitted,
    'inactivity_threshold_seconds', _inactive_seconds
  );
  return v_result;
end;
$$;

-- Platform-wide overview for the admin dashboard.
create or replace function public.ai_interaction_overview()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'total_interactions', (select count(*) from public.ai_interactions),
    'students_interacted', (select count(distinct student_id) from public.ai_interactions),
    'avg_per_student', (
      select coalesce(round(avg(n), 2), 0) from
        (select count(*) as n from public.ai_interactions group by student_id) s
    ),
    'avg_per_essay', (
      select coalesce(round(avg(n), 2), 0) from
        (select count(*) as n from public.ai_interactions group by essay_id) e
    ),
    'daily', (
      select coalesce(json_agg(json_build_object('day', d, 'count', n) order by d), '[]'::json) from
        (select date_trunc('day', created_at)::date as d, count(*) as n
         from public.ai_interactions group by 1) x
    ),
    'weekly', (
      select coalesce(json_agg(json_build_object('week', w, 'count', n) order by w), '[]'::json) from
        (select date_trunc('week', created_at)::date as w, count(*) as n
         from public.ai_interactions group by 1) x
    ),
    'categories', (
      select coalesce(json_agg(json_build_object('category', c, 'count', n) order by n desc), '[]'::json) from
        (select coalesce(primary_category, 'unclassified') as c, count(*) as n
         from public.ai_interactions group by 1) x
    ),
    'sources', (
      select coalesce(json_agg(json_build_object('source', src, 'count', n) order by n desc), '[]'::json) from
        (select source as src, count(*) as n from public.ai_interactions group by 1) x
    ),
    'essays_with_activity', (select count(distinct essay_id) from public.ai_interactions)
  );
$$;

-- Chronological interaction timeline for one essay (writing milestones, AI
-- exchanges, focus events), for researcher inspection.
create or replace function public.essay_interaction_timeline(_essay_id uuid)
returns table(event_at timestamptz, event_kind text, detail text)
language sql
stable
security definer
set search_path = public
as $$
  with we as (
    select created_at,
           word_count,
           lag(word_count) over (order by created_at) as prev_wc
    from public.writing_events
    where essay_id = _essay_id and word_count > 0
  ),
  milestones as (
    select created_at as event_at,
           'writing_progress' as event_kind,
           'Word count ' || ((word_count / 25) * 25) ||
             case when prev_wc is not null
                  then ' (+' || greatest(word_count - prev_wc, 0) || ' words)'
                  else '' end as detail
    from we
    where (word_count / 25) > coalesce((prev_wc / 25), 0)
  )
  select event_at, event_kind, detail from milestones

  union all

  select created_at, 'ai_interaction', 'Student asked AI: ' || left(student_message, 120)
  from public.ai_interactions where essay_id = _essay_id

  union all

  select i.created_at, 'ai_reply', 'AI replied: ' || left(coalesce(i.ai_response, ''), 120)
  from public.ai_interactions i where i.essay_id = _essay_id

  union all

  select created_at, 'focus_' || event_type, 'Focus event: ' || event_type
  from public.focus_events where essay_id = _essay_id

  union all

  select submitted_at, 'submitted', 'Essay submitted'
  from public.essays where id = _essay_id and submitted_at is not null

  order by event_at
$$;

-- Research dataset: one row per student x essay.
create or replace function public.research_export_rows()
returns table(
  student_id uuid,
  student_email text,
  student_name text,
  essay_id uuid,
  essay_number bigint,
  essay_topic text,
  essay_mode text,
  created_at timestamptz,
  word_count integer,
  writing_duration double precision,
  active_focus_time double precision,
  average_focus_session double precision,
  longest_focus_session double precision,
  number_of_focus_sessions integer,
  number_of_focus_interruptions integer,
  external_window_switches integer,
  total_ai_interactions integer,
  ai_interactions_per_100_words numeric,
  socratic_interactions integer,
  writing_generation_requests integer,
  predefined_prompt_usage integer,
  revision_feedback_requests integer,
  off_task_interactions integer,
  average_time_to_resume_writing_after_ai double precision,
  average_time_to_resume_writing_after_focus_loss double precision,
  time_in_ai_interface double precision,
  essay_completion_time double precision,
  is_submitted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.student_id,
    u.email,
    p.full_name,
    e.id,
    row_number() over (partition by e.student_id order by e.created_at),
    e.topic,
    e.mode,
    e.created_at,
    (public.essay_focus_metrics(e.id) ->> 'word_count')::integer,
    (public.essay_focus_metrics(e.id) ->> 'writing_duration_seconds')::double precision,
    (public.essay_focus_metrics(e.id) ->> 'active_focus_time_seconds')::double precision,
    (public.essay_focus_metrics(e.id) ->> 'average_focus_session_seconds')::double precision,
    (public.essay_focus_metrics(e.id) ->> 'longest_focus_session_seconds')::double precision,
    (public.essay_focus_metrics(e.id) ->> 'number_of_focus_sessions')::integer,
    (public.essay_focus_metrics(e.id) ->> 'number_of_focus_interruptions')::integer,
    (public.essay_focus_metrics(e.id) ->> 'external_window_switches')::integer,
    (public.essay_focus_metrics(e.id) ->> 'total_ai_interactions')::integer,
    (public.essay_focus_metrics(e.id) ->> 'ai_interactions_per_100_words')::numeric,
    (public.essay_focus_metrics(e.id) ->> 'socratic_interactions')::integer,
    (public.essay_focus_metrics(e.id) ->> 'writing_generation_requests')::integer,
    (public.essay_focus_metrics(e.id) ->> 'predefined_prompt_usage')::integer,
    (public.essay_focus_metrics(e.id) ->> 'revision_feedback_requests')::integer,
    (public.essay_focus_metrics(e.id) ->> 'off_task_interactions')::integer,
    (public.essay_focus_metrics(e.id) ->> 'average_time_to_resume_writing_after_ai_seconds')::double precision,
    (public.essay_focus_metrics(e.id) ->> 'average_time_to_resume_writing_after_focus_loss_seconds')::double precision,
    (public.essay_focus_metrics(e.id) ->> 'time_in_ai_interface_seconds')::double precision,
    (public.essay_focus_metrics(e.id) ->> 'essay_completion_time_seconds')::double precision,
    e.is_submitted
  from public.essays e
  join auth.users u on u.id = e.student_id
  left join public.profiles p on p.id = e.student_id
  where coalesce(e.research_mode, false) = false
  order by e.student_id, e.created_at
$$;

-- Interaction-level dataset: one row per AI interaction, with derived
-- continued-writing behaviour traced back to the raw event stream.
create or replace function public.research_export_interactions()
returns table(
  interaction_id uuid,
  student_id uuid,
  student_email text,
  essay_id uuid,
  interaction_at timestamptz,
  interaction_type text,
  source text,
  student_message text,
  ai_response text,
  primary_category text,
  confidence_score numeric,
  classification_reason text,
  word_count_at_interaction integer,
  continued_writing boolean,
  seconds_to_next_writing double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.student_id,
    u.email,
    i.essay_id,
    i.created_at,
    i.interaction_type,
    i.source,
    i.student_message,
    i.ai_response,
    i.primary_category,
    i.confidence_score,
    i.classification_reason,
    i.word_count_at_interaction,
    (next_act.next_at is not null),
    case when next_act.next_at is null then null
         else extract(epoch from (next_act.next_at - i.created_at)) end
  from public.ai_interactions i
  join auth.users u on u.id = i.student_id
  left join lateral (
    select min(acts.t) as next_at from (
      select we.created_at as t from public.writing_events we where we.essay_id = i.essay_id
      union all
      select fe.created_at from public.focus_events fe
      where fe.essay_id = i.essay_id
        and fe.event_type in ('writing_started','text_changed','writing_resumed','essay_saved')
    ) acts
    where acts.t > i.created_at
  ) next_act on true
  order by i.created_at
$$;

revoke all on all functions in schema public from anon;
grant execute on function public.ai_interaction_overview() to authenticated;
grant execute on function public.essay_focus_metrics(uuid, integer) to authenticated;
grant execute on function public.essay_interaction_timeline(uuid) to authenticated;
grant execute on function public.research_export_rows() to authenticated;
grant execute on function public.research_export_interactions() to authenticated;
