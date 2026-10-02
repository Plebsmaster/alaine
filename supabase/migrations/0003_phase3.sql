-- Fase 3: illness scripts goedkeuren (met automatische scriptkaarten) en AI-gebruik loggen.

-- ---------------------------------------------------------------------------
-- Welk scriptveld een automatische scriptkaart afdekt. Null voor andere kaarten.
-- ---------------------------------------------------------------------------
alter table public.cards add column if not exists script_field text
  check (script_field in ('presentation', 'pathophysiology', 'findings', 'management'));

create unique index if not exists cards_script_field_unique
  on public.cards (illness_script_id, script_field)
  where illness_script_id is not null and script_field is not null;

-- ---------------------------------------------------------------------------
-- approve_illness_script: script actief maken en per gevuld veld één conceptkaart
-- van type illness_script aanmaken (SPEC 5.5). Bestaat de kaart voor een veld al,
-- dan wordt een concept bijgewerkt; een actieve kaart blijft ongemoeid.
-- Geeft het aantal nieuw aangemaakte conceptkaarten terug.
-- ---------------------------------------------------------------------------
create or replace function public.approve_illness_script(p_script_id uuid)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s public.illness_scripts;
  f record;
  v_new int := 0;
  v_id uuid;
begin
  select * into s from public.illness_scripts where id = p_script_id for update;
  if not found then
    raise exception 'Illness script % niet gevonden', p_script_id using errcode = 'P0002';
  end if;

  update public.illness_scripts set status = 'active' where id = p_script_id;

  for f in
    select * from (values
      ('presentation',    format('Wat is de typische presentatie van %s?', s.condition), s.presentation),
      ('pathophysiology', format('Wat is de pathofysiologie van %s?', s.condition),      s.pathophysiology),
      ('findings',        format('Hoe stel je %s vast?', s.condition),                   s.findings),
      ('management',      format('Wat is het beleid bij %s?', s.condition),              s.management)
    ) as v(field, front, back)
  loop
    if nullif(btrim(coalesce(f.back, '')), '') is null then
      continue;
    end if;

    select id into v_id from public.cards
    where illness_script_id = p_script_id and script_field = f.field;

    if v_id is null then
      insert into public.cards (
        topic_id, source_id, illness_script_id, script_field, type, front, back,
        source_locator, status, origin
      ) values (
        s.topic_id, s.source_id, p_script_id, f.field, 'illness_script', f.front, btrim(f.back),
        s.source_locator, 'draft', s.origin
      );
      v_new := v_new + 1;
    else
      update public.cards
      set front = f.front, back = btrim(f.back), source_id = s.source_id, source_locator = s.source_locator
      where id = v_id and status = 'draft';
    end if;
  end loop;

  return v_new;
end;
$$;

revoke execute on function public.approve_illness_script(uuid) from public, anon;
grant execute on function public.approve_illness_script(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- ai_usage: per AI-aanroep functie, model, tokens en duur, zodat kosten zichtbaar blijven.
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  function       text not null,
  model          text not null,
  input_tokens   int not null default 0,
  output_tokens  int not null default 0,
  duration_ms    int,
  ok             boolean not null default true,
  created_at     timestamptz not null default now()
);

create index on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;
create policy "own rows" on public.ai_usage for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
