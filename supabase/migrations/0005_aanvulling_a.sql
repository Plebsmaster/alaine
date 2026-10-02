-- Aanvulling 01 (A1, A2, A7): fouttypes, ketenkaarten en "bron of extern".
-- Alleen toevoegingen; bestaande data blijft intact.

-- A7: wat niet (aantoonbaar) uit de bron komt, is te controleren.
alter table public.cards add column if not exists needs_verification boolean not null default false;
alter table public.illness_scripts add column if not exists needs_verification boolean not null default false;
alter table public.cases add column if not exists needs_verification boolean not null default false;
alter table public.questions add column if not exists needs_verification boolean not null default false;

-- A1: fouttype als analyse naast de beoordeling (FSRS blijft de eerlijke beoordeling krijgen).
alter table public.review_logs add column if not exists error_type text
  check (error_type in ('knowledge_gap', 'reasoning_error', 'slip'));
alter table public.case_attempts add column if not exists error_type text
  check (error_type in ('knowledge_gap', 'reasoning_error', 'slip'));
alter table public.question_attempts add column if not exists error_type text
  check (error_type in ('knowledge_gap', 'reasoning_error', 'slip'));

-- A2: ketenkaarten.
alter table public.cards drop constraint if exists cards_type_check;
alter table public.cards add constraint cards_type_check
  check (type in ('fact', 'explain', 'illness_script', 'compare', 'image', 'skill', 'communication', 'chain'));

-- rate_card: fouttype meeschrijven.
drop function if exists public.rate_card(uuid, jsonb, jsonb, int, text, uuid, text);

create or replace function public.rate_card(
  p_card_id uuid,
  p_schedule jsonb,
  p_log jsonb,
  p_duration_ms int default null,
  p_answer_text text default null,
  p_session_id uuid default null,
  p_ai_feedback text default null,
  p_error_type text default null
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
    scheduled_days, learning_steps, review, duration_ms, answer_text, session_id, ai_feedback, error_type
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
    p_ai_feedback,
    p_error_type
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

revoke execute on function public.rate_card(uuid, jsonb, jsonb, int, text, uuid, text, text) from public, anon;
grant execute on function public.rate_card(uuid, jsonb, jsonb, int, text, uuid, text, text) to authenticated, service_role;

-- import_bundle: optioneel needs_verification per item.
create or replace function public.import_bundle(p_payload jsonb, p_user_id uuid default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := coalesce(auth.uid(), p_user_id);
  v_results jsonb := '[]'::jsonb;
  r jsonb;
  v_id uuid;
  v_inserted boolean;
  v_topic uuid;
  v_source uuid;
  v_module uuid;
  v_obj text;
  v_obj_id uuid;
begin
  if v_uid is null then
    raise exception 'Geen gebruiker: log in of geef p_user_id mee';
  end if;
  if auth.uid() is not null and p_user_id is not null and p_user_id <> auth.uid() then
    raise exception 'p_user_id hoort niet bij de ingelogde gebruiker';
  end if;
  if p_payload ->> 'format' is distinct from 'pa-studie-import' or (p_payload ->> 'version')::int <> 1 then
    raise exception 'Onbekend importformaat';
  end if;

  -- Modules ------------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_payload -> 'modules', '[]')) loop
    insert into public.modules as m (user_id, external_id, name, study_year, sort_order, exam_date)
    values (
      v_uid, r ->> 'external_id', r ->> 'name', (r ->> 'study_year')::smallint,
      coalesce((r ->> 'sort_order')::int, 0), (r ->> 'exam_date')::date
    )
    on conflict (user_id, external_id) do update set
      name = excluded.name,
      study_year = excluded.study_year,
      sort_order = excluded.sort_order,
      exam_date = coalesce(excluded.exam_date, m.exam_date)
    returning (xmax = 0) into v_inserted;
    v_results := v_results || jsonb_build_object(
      'kind', 'modules', 'external_id', r ->> 'external_id', 'topic', null,
      'outcome', case when v_inserted then 'new' else 'updated' end);
  end loop;

  -- Thema's ------------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_payload -> 'topics', '[]')) loop
    select id into v_module from public.modules where user_id = v_uid and external_id = r ->> 'module';
    if v_module is null then
      raise exception 'Module "%" bestaat niet (thema "%")', r ->> 'module', r ->> 'external_id';
    end if;
    insert into public.topics as t (user_id, module_id, external_id, name, sort_order)
    values (v_uid, v_module, r ->> 'external_id', r ->> 'name', coalesce((r ->> 'sort_order')::int, 0))
    on conflict (user_id, external_id) do update set
      module_id = excluded.module_id, name = excluded.name, sort_order = excluded.sort_order
    returning (xmax = 0) into v_inserted;
    v_results := v_results || jsonb_build_object(
      'kind', 'topics', 'external_id', r ->> 'external_id', 'topic', r ->> 'external_id',
      'outcome', case when v_inserted then 'new' else 'updated' end);
  end loop;

  -- Leerdoelen ---------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_payload -> 'objectives', '[]')) loop
    select id into v_topic from public.topics where user_id = v_uid and external_id = r ->> 'topic';
    if v_topic is null then
      raise exception 'Thema "%" bestaat niet (leerdoel "%")', r ->> 'topic', r ->> 'external_id';
    end if;
    insert into public.learning_objectives as o (user_id, topic_id, external_id, code, description, sort_order)
    values (v_uid, v_topic, r ->> 'external_id', r ->> 'code', r ->> 'description', coalesce((r ->> 'sort_order')::int, 0))
    on conflict (user_id, external_id) do update set
      topic_id = excluded.topic_id, code = excluded.code,
      description = excluded.description, sort_order = excluded.sort_order
    returning (xmax = 0) into v_inserted;
    v_results := v_results || jsonb_build_object(
      'kind', 'objectives', 'external_id', r ->> 'external_id', 'topic', r ->> 'topic',
      'outcome', case when v_inserted then 'new' else 'updated' end);
  end loop;

  -- Bronnen ------------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_payload -> 'sources', '[]')) loop
    insert into public.sources as s (user_id, external_id, kind, title, author, chapter, pages, url, notes)
    values (
      v_uid, r ->> 'external_id', coalesce(r ->> 'kind', 'book'), r ->> 'title', r ->> 'author',
      r ->> 'chapter', r ->> 'pages', r ->> 'url', r ->> 'notes'
    )
    on conflict (user_id, external_id) do update set
      kind = excluded.kind, title = excluded.title, author = excluded.author, chapter = excluded.chapter,
      pages = excluded.pages, url = excluded.url, notes = excluded.notes
    returning (xmax = 0) into v_inserted;
    v_results := v_results || jsonb_build_object(
      'kind', 'sources', 'external_id', r ->> 'external_id', 'topic', null,
      'outcome', case when v_inserted then 'new' else 'updated' end);
  end loop;

  -- Illness scripts ----------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_payload -> 'illness_scripts', '[]')) loop
    v_topic := public._import_topic(v_uid, r);
    v_source := public._import_source(v_uid, r);
    v_id := null;
    insert into public.illness_scripts as x (
      user_id, topic_id, source_id, external_id, condition, epidemiology, pathophysiology,
      presentation, findings, management, key_discriminators, similar_conditions, source_locator,
      status, origin
    ) values (
      v_uid, v_topic, v_source, r ->> 'external_id', r ->> 'condition', r ->> 'epidemiology',
      r ->> 'pathophysiology', r ->> 'presentation', r ->> 'findings', r ->> 'management',
      r ->> 'key_discriminators',
      coalesce(array(select jsonb_array_elements_text(r -> 'similar_conditions')), '{}'),
      r ->> 'source_locator', 'draft', 'import', coalesce((r ->> 'needs_verification')::boolean, false)
    )
    on conflict (user_id, external_id) do update set
      needs_verification = excluded.needs_verification,
      topic_id = excluded.topic_id, source_id = excluded.source_id, condition = excluded.condition,
      epidemiology = excluded.epidemiology, pathophysiology = excluded.pathophysiology,
      presentation = excluded.presentation, findings = excluded.findings,
      management = excluded.management, key_discriminators = excluded.key_discriminators,
      similar_conditions = excluded.similar_conditions, source_locator = excluded.source_locator
      where x.status = 'draft'
    returning id, (xmax = 0) into v_id, v_inserted;
    v_results := v_results || public._import_result('illness_scripts', r, v_id, v_inserted);
  end loop;

  -- Kaarten ------------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_payload -> 'cards', '[]')) loop
    v_topic := public._import_topic(v_uid, r);
    v_source := public._import_source(v_uid, r);
    v_id := null;
    insert into public.cards as c (
      user_id, topic_id, source_id, external_id, type, front, back, explanation, image_path,
      source_locator, tags, status, origin, needs_verification
    ) values (
      v_uid, v_topic, v_source, r ->> 'external_id', r ->> 'type', r ->> 'front', r ->> 'back',
      r ->> 'explanation', r ->> 'image_path', r ->> 'source_locator',
      coalesce(array(select jsonb_array_elements_text(r -> 'tags')), '{}'), 'draft', 'import', coalesce((r ->> 'needs_verification')::boolean, false)
    )
    on conflict (user_id, external_id) do update set
      needs_verification = excluded.needs_verification,
      topic_id = excluded.topic_id, source_id = excluded.source_id, type = excluded.type,
      front = excluded.front, back = excluded.back, explanation = excluded.explanation,
      image_path = coalesce(excluded.image_path, c.image_path),
      source_locator = excluded.source_locator, tags = excluded.tags
      where c.status = 'draft'
    returning id, (xmax = 0) into v_id, v_inserted;
    if v_id is not null then
      delete from public.card_objectives where card_id = v_id;
      for v_obj in select jsonb_array_elements_text(coalesce(r -> 'objectives', '[]')) loop
        v_obj_id := public._import_objective(v_uid, v_obj, r);
        insert into public.card_objectives (user_id, card_id, objective_id)
        values (v_uid, v_id, v_obj_id) on conflict do nothing;
      end loop;
    end if;
    v_results := v_results || public._import_result('cards', r, v_id, v_inserted);
  end loop;

  -- Casussen -----------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_payload -> 'cases', '[]')) loop
    v_topic := public._import_topic(v_uid, r);
    v_source := public._import_source(v_uid, r);
    v_id := null;
    insert into public.cases as c (
      user_id, topic_id, source_id, external_id, title, vignette, question, correct_diagnosis,
      expert_reflection, teaching_points, difficulty, status, origin, needs_verification
    ) values (
      v_uid, v_topic, v_source, r ->> 'external_id', r ->> 'title', r ->> 'vignette',
      coalesce(r ->> 'question', 'Wat is je werkdiagnose?'), r ->> 'correct_diagnosis',
      coalesce(r -> 'expert_reflection', '[]'), r ->> 'teaching_points',
      (r ->> 'difficulty')::smallint, 'draft', 'import', coalesce((r ->> 'needs_verification')::boolean, false)
    )
    on conflict (user_id, external_id) do update set
      needs_verification = excluded.needs_verification,
      topic_id = excluded.topic_id, source_id = excluded.source_id, title = excluded.title,
      vignette = excluded.vignette, question = excluded.question,
      correct_diagnosis = excluded.correct_diagnosis, expert_reflection = excluded.expert_reflection,
      teaching_points = excluded.teaching_points, difficulty = excluded.difficulty
      where c.status = 'draft'
    returning id, (xmax = 0) into v_id, v_inserted;
    if v_id is not null then
      delete from public.case_objectives where case_id = v_id;
      for v_obj in select jsonb_array_elements_text(coalesce(r -> 'objectives', '[]')) loop
        v_obj_id := public._import_objective(v_uid, v_obj, r);
        insert into public.case_objectives (user_id, case_id, objective_id)
        values (v_uid, v_id, v_obj_id) on conflict do nothing;
      end loop;
    end if;
    v_results := v_results || public._import_result('cases', r, v_id, v_inserted);
  end loop;

  -- Vragen -------------------------------------------------------------------
  for r in select * from jsonb_array_elements(coalesce(p_payload -> 'questions', '[]')) loop
    v_topic := public._import_topic(v_uid, r);
    v_source := public._import_source(v_uid, r);
    v_id := null;
    insert into public.questions as q (
      user_id, topic_id, source_id, external_id, kind, format, stem, options, correct_option,
      model_answer, explanation, status, origin, needs_verification
    ) values (
      v_uid, v_topic, v_source, r ->> 'external_id', r ->> 'kind', r ->> 'format', r ->> 'stem',
      case when jsonb_typeof(r -> 'options') = 'array' then r -> 'options' end,
      (r ->> 'correct_option')::smallint, r ->> 'model_answer', r ->> 'explanation', 'draft', 'import', coalesce((r ->> 'needs_verification')::boolean, false)
    )
    on conflict (user_id, external_id) do update set
      needs_verification = excluded.needs_verification,
      topic_id = excluded.topic_id, source_id = excluded.source_id, kind = excluded.kind,
      format = excluded.format, stem = excluded.stem, options = excluded.options,
      correct_option = excluded.correct_option, model_answer = excluded.model_answer,
      explanation = excluded.explanation
      where q.status = 'draft'
    returning id, (xmax = 0) into v_id, v_inserted;
    if v_id is not null then
      delete from public.question_objectives where question_id = v_id;
      for v_obj in select jsonb_array_elements_text(coalesce(r -> 'objectives', '[]')) loop
        v_obj_id := public._import_objective(v_uid, v_obj, r);
        insert into public.question_objectives (user_id, question_id, objective_id)
        values (v_uid, v_id, v_obj_id) on conflict do nothing;
      end loop;
    end if;
    v_results := v_results || public._import_result('questions', r, v_id, v_inserted);
  end loop;

  return v_results;
end;
$$;

-- review_queue: needs_verification erbij (achteraan, zodat create or replace mag).
create or replace view public.review_queue
with (security_invoker = true)
as
select
  c.id as card_id,
  c.topic_id,
  c.type,
  c.front,
  c.back,
  c.explanation,
  c.image_path,
  c.source_locator,
  c.created_at,
  t.name as topic_name,
  t.sort_order as topic_sort,
  m.sort_order as module_sort,
  m.exam_date,
  -- Alleen toetsdata die nog komen tellen mee voor de volgorde van nieuwe kaarten.
  case when m.exam_date >= current_date then m.exam_date end as upcoming_exam_date,
  (
    select min(lo.sort_order)
    from public.card_objectives co
    join public.learning_objectives lo on lo.id = co.objective_id
    where co.card_id = c.id
  ) as objective_sort,
  concat_ws(', ', so.title, nullif(concat_ws(' ', 'h.', so.chapter), 'h.'), c.source_locator) as source_label,
  s.due,
  s.stability,
  s.difficulty,
  s.elapsed_days,
  s.scheduled_days,
  s.learning_steps,
  s.reps,
  s.lapses,
  s.state,
  s.last_review,
  c.needs_verification
from public.cards c
join public.card_schedule s on s.card_id = c.id
join public.topics t on t.id = c.topic_id
join public.modules m on m.id = t.module_id
left join public.sources so on so.id = c.source_id
where c.status = 'active';
