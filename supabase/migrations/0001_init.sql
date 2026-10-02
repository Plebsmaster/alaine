-- PA Studie-app: initieel schema
-- Eén gebruiker per rij (user_id), Row Level Security op elke tabel.
-- Volgorde: structuur (modules, thema's, leerdoelen, bronnen) -> inhoud (scripts, kaarten,
-- casussen, vragen) -> planning en logboek -> instellingen -> beveiliging -> storage.

create extension if not exists pgcrypto;

-- Hulpfunctie voor updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Structuur van de opleiding
-- ---------------------------------------------------------------------------

create table public.modules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  external_id  text,
  name         text not null,
  study_year   smallint,
  sort_order   int not null default 0,
  exam_date    date,
  created_at   timestamptz not null default now(),
  unique (user_id, external_id)
);

create table public.topics (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  module_id    uuid not null references public.modules (id) on delete cascade,
  external_id  text,
  name         text not null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, external_id)
);

create table public.learning_objectives (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id     uuid not null references public.topics (id) on delete cascade,
  external_id  text,
  code         text,
  description  text not null,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, external_id)
);

create table public.sources (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  external_id  text,
  kind         text not null default 'book'
               check (kind in ('book', 'lecture', 'practical', 'assignment', 'internship', 'guideline', 'other')),
  title        text not null,
  author       text,
  chapter      text,
  pages        text,
  url          text,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (user_id, external_id)
);

-- ---------------------------------------------------------------------------
-- Inhoud
-- ---------------------------------------------------------------------------

create table public.illness_scripts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id            uuid not null references public.topics (id) on delete cascade,
  source_id           uuid references public.sources (id) on delete set null,
  external_id         text,
  condition           text not null,
  epidemiology        text,   -- wie krijgt het, risicofactoren
  pathophysiology     text,   -- wat gaat er mis
  presentation        text,   -- klachten en symptomen, beloop
  findings            text,   -- lichamelijk onderzoek en aanvullende diagnostiek
  management          text,   -- behandeling en beleid
  key_discriminators  text,   -- wat het onderscheidt van gelijkende aandoeningen
  similar_conditions  text[] not null default '{}',
  source_locator      text,   -- bijv. 'p. 712-715'
  status              text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  origin              text not null default 'manual' check (origin in ('manual', 'ai', 'import')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, external_id)
);

create table public.cards (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id            uuid not null references public.topics (id) on delete cascade,
  source_id           uuid references public.sources (id) on delete set null,
  illness_script_id   uuid references public.illness_scripts (id) on delete cascade,
  external_id         text,
  type                text not null
                      check (type in ('fact', 'explain', 'illness_script', 'compare', 'image', 'skill', 'communication')),
  front               text not null,
  back                text not null,
  explanation         text,
  image_path          text,   -- pad in storage bucket 'card-images'
  source_locator      text,
  tags                text[] not null default '{}',
  status              text not null default 'draft' check (status in ('draft', 'active', 'suspended')),
  origin              text not null default 'manual' check (origin in ('manual', 'ai', 'import')),
  rewritten           boolean not null default false,  -- true als de gebruiker de tekst bij goedkeuren heeft aangepast
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, external_id)
);

create table public.card_objectives (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id       uuid not null references public.cards (id) on delete cascade,
  objective_id  uuid not null references public.learning_objectives (id) on delete cascade,
  primary key (card_id, objective_id)
);

create table public.cases (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id            uuid not null references public.topics (id) on delete cascade,
  source_id           uuid references public.sources (id) on delete set null,
  external_id         text,
  title               text not null,
  vignette            text not null,
  question            text not null default 'Wat is je werkdiagnose?',
  correct_diagnosis   text not null,
  -- [{ "diagnosis": "...", "supporting": "...", "against": "...", "missing": "...", "rank": 1 }]
  expert_reflection   jsonb not null default '[]'::jsonb,
  teaching_points     text,
  difficulty          smallint check (difficulty between 1 and 3),
  from_internship     boolean not null default false,
  status              text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  origin              text not null default 'manual' check (origin in ('manual', 'ai', 'import')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, external_id)
);

create table public.case_objectives (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  case_id       uuid not null references public.cases (id) on delete cascade,
  objective_id  uuid not null references public.learning_objectives (id) on delete cascade,
  primary key (case_id, objective_id)
);

create table public.questions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topic_id         uuid not null references public.topics (id) on delete cascade,
  source_id        uuid references public.sources (id) on delete set null,
  external_id      text,
  kind             text not null check (kind in ('pretest', 'exam')),
  format           text not null check (format in ('mcq', 'open')),
  stem             text not null,
  options          jsonb,      -- ["...", "...", "...", "..."] bij mcq
  correct_option   smallint,   -- index in options bij mcq
  model_answer     text,       -- bij open vragen
  explanation      text,
  status           text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  origin           text not null default 'manual' check (origin in ('manual', 'ai', 'import')),
  created_at       timestamptz not null default now(),
  unique (user_id, external_id),
  check (format <> 'mcq' or (options is not null and correct_option is not null))
);

create table public.question_objectives (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id   uuid not null references public.questions (id) on delete cascade,
  objective_id  uuid not null references public.learning_objectives (id) on delete cascade,
  primary key (question_id, objective_id)
);

-- ---------------------------------------------------------------------------
-- Planning (FSRS) en logboeken
-- ---------------------------------------------------------------------------

-- Spiegelt de Card-interface van ts-fsrs v5. Een rij ontstaat zodra een kaart actief wordt.
create table public.card_schedule (
  card_id         uuid primary key references public.cards (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  due             timestamptz not null default now(),
  stability       double precision not null default 0,
  difficulty      double precision not null default 0,
  elapsed_days    int not null default 0,
  scheduled_days  int not null default 0,
  learning_steps  int not null default 0,
  reps            int not null default 0,
  lapses          int not null default 0,
  state           smallint not null default 0 check (state between 0 and 3),  -- 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review     timestamptz
);

-- Elke beoordeling. Nodig voor statistiek en om later FSRS-parameters te optimaliseren.
create table public.review_logs (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id            uuid not null references public.cards (id) on delete cascade,
  rating             smallint not null check (rating between 1 and 4),  -- 1 Again, 2 Hard, 3 Good, 4 Easy
  state              smallint not null,
  due                timestamptz not null,
  stability          double precision not null,
  difficulty         double precision not null,
  elapsed_days       int not null default 0,
  last_elapsed_days  int not null default 0,
  scheduled_days     int not null default 0,
  learning_steps     int not null default 0,
  review             timestamptz not null default now(),
  duration_ms        int,
  answer_text        text,
  ai_feedback        text,
  session_id         uuid
);

create table public.case_attempts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  case_id             uuid not null references public.cases (id) on delete cascade,
  working_diagnosis   text,
  -- [{ "diagnosis": "...", "supporting": "...", "against": "...", "missing": "..." }]
  reflection          jsonb not null default '[]'::jsonb,
  final_ranking       text[] not null default '{}',
  cued                boolean not null default false,  -- alternatieven aangereikt?
  hints_used          smallint not null default 0,
  correct             boolean,
  self_score          smallint check (self_score between 1 and 5),
  ai_feedback         text,
  duration_ms         int,
  session_id          uuid,
  created_at          timestamptz not null default now()
);

create table public.question_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question_id   uuid not null references public.questions (id) on delete cascade,
  chosen_option smallint,
  answer_text   text,
  correct       boolean,
  ai_feedback   text,
  session_id    uuid,
  created_at    timestamptz not null default now()
);

create table public.study_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('review', 'cases', 'explain', 'pretest', 'exam')),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  items       int not null default 0
);

create table public.settings (
  user_id            uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  desired_retention  numeric(4, 3) not null default 0.900 check (desired_retention between 0.700 and 0.970),
  max_new_per_day    int not null default 20 check (max_new_per_day between 0 and 200),
  fsrs_params        jsonb,   -- geoptimaliseerde gewichten, later
  timezone           text not null default 'Europe/Amsterdam',
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexen en triggers
-- ---------------------------------------------------------------------------

create index on public.topics (user_id, module_id, sort_order);
create index on public.learning_objectives (topic_id, sort_order);
create index on public.cards (user_id, status, topic_id);
create index on public.cards (illness_script_id);
create index on public.card_schedule (user_id, due);
create index on public.review_logs (user_id, review desc);
create index on public.review_logs (card_id, review desc);
create index on public.cases (user_id, status, topic_id);
create index on public.case_attempts (case_id, created_at desc);
create index on public.questions (user_id, kind, topic_id);

create trigger cards_updated_at before update on public.cards
  for each row execute function public.set_updated_at();
create trigger illness_scripts_updated_at before update on public.illness_scripts
  for each row execute function public.set_updated_at();
create trigger cases_updated_at before update on public.cases
  for each row execute function public.set_updated_at();
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: alleen eigen rijen
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'modules', 'topics', 'learning_objectives', 'sources', 'illness_scripts', 'cards',
    'card_objectives', 'cases', 'case_objectives', 'questions', 'question_objectives',
    'card_schedule', 'review_logs',
    'case_attempts', 'question_attempts', 'study_sessions', 'settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Storage voor afbeeldingen (huidbeelden, ECG's); pad begint met de user-id
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', false)
on conflict (id) do nothing;

create policy "own images select" on storage.objects for select to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own images insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own images update" on storage.objects for update to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "own images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
