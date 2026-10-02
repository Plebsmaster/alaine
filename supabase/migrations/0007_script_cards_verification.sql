-- Kaarten die uit een illness script ontstaan, nemen het label "Controleren" (needs_verification)
-- van het script over. Eerst de functie, daarna de kaarten die al bestaan.

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
        source_locator, status, origin, needs_verification
      ) values (
        s.topic_id, s.source_id, p_script_id, f.field, 'illness_script', f.front, btrim(f.back),
        s.source_locator, 'draft', s.origin, s.needs_verification
      );
      v_new := v_new + 1;
    else
      update public.cards
      set front = f.front, back = btrim(f.back), source_id = s.source_id, source_locator = s.source_locator,
          needs_verification = s.needs_verification
      where id = v_id and status = 'draft';
    end if;
  end loop;

  return v_new;
end;
$$;

update public.cards c
set needs_verification = true
from public.illness_scripts s
where c.illness_script_id = s.id and s.needs_verification and not c.needs_verification;
