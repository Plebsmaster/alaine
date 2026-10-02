-- Fase 2: AI-feedback (explain_feedback) meeschrijven in review_logs.ai_feedback.
-- rate_card krijgt een extra, optionele parameter; de oude versie vervalt.

drop function if exists public.rate_card(uuid, jsonb, jsonb, int, text, uuid);

create or replace function public.rate_card(
  p_card_id uuid,
  p_schedule jsonb,
  p_log jsonb,
  p_duration_ms int default null,
  p_answer_text text default null,
  p_session_id uuid default null,
  p_ai_feedback text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_review timestamptz := (p_log ->> 'review')::timestamptz;
begin
  if exists (
    select 1 from public.review_logs where card_id = p_card_id and review = v_review
  ) then
    return false;
  end if;

  update public.card_schedule set
    due            = (p_schedule ->> 'due')::timestamptz,
    stability      = (p_schedule ->> 'stability')::double precision,
    difficulty     = (p_schedule ->> 'difficulty')::double precision,
    elapsed_days   = (p_schedule ->> 'elapsed_days')::int,
    scheduled_days = (p_schedule ->> 'scheduled_days')::int,
    learning_steps = (p_schedule ->> 'learning_steps')::int,
    reps           = (p_schedule ->> 'reps')::int,
    lapses         = (p_schedule ->> 'lapses')::int,
    state          = (p_schedule ->> 'state')::smallint,
    last_review    = (p_schedule ->> 'last_review')::timestamptz
  where card_id = p_card_id;

  if not found then
    raise exception 'Geen planning gevonden voor kaart %', p_card_id using errcode = 'P0002';
  end if;

  insert into public.review_logs (
    card_id, rating, state, due, stability, difficulty, elapsed_days, last_elapsed_days,
    scheduled_days, learning_steps, review, duration_ms, answer_text, session_id, ai_feedback
  ) values (
    p_card_id,
    (p_log ->> 'rating')::smallint,
    (p_log ->> 'state')::smallint,
    (p_log ->> 'due')::timestamptz,
    (p_log ->> 'stability')::double precision,
    (p_log ->> 'difficulty')::double precision,
    coalesce((p_log ->> 'elapsed_days')::int, 0),
    coalesce((p_log ->> 'last_elapsed_days')::int, 0),
    coalesce((p_log ->> 'scheduled_days')::int, 0),
    coalesce((p_log ->> 'learning_steps')::int, 0),
    v_review,
    p_duration_ms,
    nullif(btrim(p_answer_text), ''),
    p_session_id,
    p_ai_feedback
  );

  if p_session_id is not null then
    insert into public.study_sessions (id, kind, started_at, ended_at, items)
    values (p_session_id, 'review', v_review, v_review, 1)
    on conflict (id) do update set
      items = public.study_sessions.items + 1,
      ended_at = greatest(public.study_sessions.ended_at, excluded.ended_at);
  end if;

  return true;
end;
$$;

revoke execute on function public.rate_card(uuid, jsonb, jsonb, int, text, uuid, text) from public, anon;
grant execute on function public.rate_card(uuid, jsonb, jsonb, int, text, uuid, text) to authenticated, service_role;
