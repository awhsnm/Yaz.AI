create or replace function public.research_export_rows()
returns table(
  student_id uuid, student_email text, student_name text, essay_id uuid, essay_number bigint,
  essay_topic text, essay_mode text, created_at timestamptz, word_count integer,
  writing_duration double precision, active_focus_time double precision,
  average_focus_session double precision, longest_focus_session double precision,
  number_of_focus_sessions integer, number_of_focus_interruptions integer,
  external_window_switches integer, total_ai_interactions integer,
  ai_interactions_per_100_words numeric, socratic_interactions integer,
  writing_generation_requests integer, predefined_prompt_usage integer,
  revision_feedback_requests integer, off_task_interactions integer,
  average_time_to_resume_writing_after_ai double precision,
  average_time_to_resume_writing_after_focus_loss double precision,
  time_in_ai_interface double precision, essay_completion_time double precision,
  is_submitted boolean
)
language sql stable security definer set search_path = public
as $$
  select
    e.student_id, u.email, p.full_name, e.id,
    row_number() over (partition by e.student_id order by e.created_at),
    e.topic, e.mode, e.created_at,
    (m.j ->> 'word_count')::integer,
    (m.j ->> 'writing_duration_seconds')::double precision,
    (m.j ->> 'active_focus_time_seconds')::double precision,
    (m.j ->> 'average_focus_session_seconds')::double precision,
    (m.j ->> 'longest_focus_session_seconds')::double precision,
    (m.j ->> 'number_of_focus_sessions')::integer,
    (m.j ->> 'number_of_focus_interruptions')::integer,
    (m.j ->> 'external_window_switches')::integer,
    (m.j ->> 'total_ai_interactions')::integer,
    (m.j ->> 'ai_interactions_per_100_words')::numeric,
    (m.j ->> 'socratic_interactions')::integer,
    (m.j ->> 'writing_generation_requests')::integer,
    (m.j ->> 'predefined_prompt_usage')::integer,
    (m.j ->> 'revision_feedback_requests')::integer,
    (m.j ->> 'off_task_interactions')::integer,
    (m.j ->> 'average_time_to_resume_writing_after_ai_seconds')::double precision,
    (m.j ->> 'average_time_to_resume_writing_after_focus_loss_seconds')::double precision,
    (m.j ->> 'time_in_ai_interface_seconds')::double precision,
    (m.j ->> 'essay_completion_time_seconds')::double precision,
    e.is_submitted
  from public.essays e
  join auth.users u on u.id = e.student_id
  left join public.profiles p on p.id = e.student_id
  cross join lateral (select public.essay_focus_metrics(e.id) as j offset 0) m
  where coalesce(e.research_mode, false) = false
  order by e.student_id, e.created_at
$$;
grant execute on function public.research_export_rows() to authenticated;