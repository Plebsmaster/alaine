-- Goedkeuren (ontwerp 1n): het letterlijke brondeel waarop een concept rust, om naast het
-- concept te tonen. Optioneel; bestaande kaarten houden null. Gevuld door draft_cards (alleen
-- als het citaat letterlijk in de meegegeven brontekst staat) en door de import.
alter table public.cards add column if not exists source_excerpt text
  check (source_excerpt is null or char_length(source_excerpt) <= 600);

-- import_bundle: optioneel source_excerpt per kaart. Verder gelijk aan 0006.
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
      status, origin, needs_verification
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
      source_locator, tags, status, origin, needs_verification, source_excerpt
    ) values (
      v_uid, v_topic, v_source, r ->> 'external_id', r ->> 'type', r ->> 'front', r ->> 'back',
      r ->> 'explanation', r ->> 'image_path', r ->> 'source_locator',
      coalesce(array(select jsonb_array_elements_text(r -> 'tags')), '{}'), 'draft', 'import', coalesce((r ->> 'needs_verification')::boolean, false),
      nullif(btrim(coalesce(r ->> 'source_excerpt', '')), '')
    )
    on conflict (user_id, external_id) do update set
      needs_verification = excluded.needs_verification,
      topic_id = excluded.topic_id, source_id = excluded.source_id, type = excluded.type,
      front = excluded.front, back = excluded.back, explanation = excluded.explanation,
      image_path = coalesce(excluded.image_path, c.image_path),
      source_excerpt = excluded.source_excerpt,
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
