import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton } from "@/components/confirm-button";
import { Button, buttonClass, Eyebrow, Field, Input, PageHeader, Panel, Select } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { loadToday } from "@/lib/data/review";
import { getSettings } from "@/lib/data/settings";
import { daysUntil } from "@/lib/time";
import { createModule, createTopic, deleteModule, updateModule } from "./actions";
import { ModuleDialog } from "./module-dialog";

export const metadata: Metadata = { title: "Thema's" };

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

type TopicStats = { active: number; draft: number; due: number; covered: number; objectives: number };

export default async function TopicsPage() {
  const { supabase } = await requireUser();
  const settings = await getSettings(supabase);
  const [{ data: modules, error }, { data: counts }, { data: coverage }, today] = await Promise.all([
    supabase
      .from("modules")
      .select("id, name, study_year, sort_order, exam_date, topics(id, name, sort_order)")
      .order("sort_order")
      .order("sort_order", { referencedTable: "topics" }),
    supabase.from("topic_card_counts").select("*"),
    supabase.from("objective_coverage").select("topic_id, active_cards, active_cases"),
    loadToday(supabase, settings),
  ]);
  if (error) throw new Error(error.message);

  const stats = new Map<string, TopicStats>();
  const statsOf = (id: string) => {
    let s = stats.get(id);
    if (!s) stats.set(id, (s = { active: 0, draft: 0, due: 0, covered: 0, objectives: 0 }));
    return s;
  };
  for (const c of counts ?? []) if (c.topic_id) Object.assign(statsOf(c.topic_id), { active: Number(c.active ?? 0), draft: Number(c.draft ?? 0) });
  for (const o of coverage ?? []) {
    if (!o.topic_id) continue;
    const s = statsOf(o.topic_id);
    s.objectives += 1;
    if (Number(o.active_cards ?? 0) > 0 || Number(o.active_cases ?? 0) > 0) s.covered += 1;
  }
  // Wat er vandaag per thema aan de beurt is: dezelfde wachtrij als /vandaag.
  for (const card of [...today.queue, ...today.pending]) statsOf(card.topic_id).due += 1;

  const now = new Date();

  return (
    <>
      {/* Op laptop is de modulenaam de kop; de paginatitel blijft voor schermlezers. */}
      <div className="md:sr-only">
        <PageHeader title="Thema's" />
      </div>

      {(modules ?? []).length === 0 ? (
        <Panel className="mb-6 text-sm text-muted">
          Nog geen modules. Importeer studiestof via <Link className="underline" href="/instellingen">Instellingen</Link> of maak hieronder een module aan.
        </Panel>
      ) : null}

      <div className="space-y-12">
        {(modules ?? []).map((m) => {
          const days = m.exam_date ? daysUntil(m.exam_date, now, settings.timezone) : null;
          return (
            <section key={m.id} aria-labelledby={`module-${m.id}`}>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Eyebrow>
                    Module {m.sort_order}
                    {m.study_year ? ` · Studiejaar ${m.study_year}` : ""}
                  </Eyebrow>
                  <h2 id={`module-${m.id}`} className="mt-1 font-serif text-[26px] font-medium leading-[1.1] md:text-[34px]">
                    {m.name}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {m.exam_date && days !== null ? (
                    <p className="text-sm tabular-nums text-text-2">
                      Toets {formatDate(m.exam_date)} ·{" "}
                      <strong>{days >= 0 ? `over ${days} ${days === 1 ? "dag" : "dagen"}` : "geweest"}</strong>
                    </p>
                  ) : null}
                  <ModuleDialog label="Module bewerken" title={m.name}>
                    <div className="grid gap-6 md:grid-cols-2">
                      <form action={updateModule} className="space-y-3">
                        <input type="hidden" name="id" value={m.id} />
                        <Field label="Naam">
                          <Input name="name" defaultValue={m.name} required />
                        </Field>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Toetsdatum">
                            <Input name="exam_date" type="date" defaultValue={m.exam_date ?? ""} />
                          </Field>
                          <Field label="Volgorde">
                            <Input name="sort_order" type="number" defaultValue={m.sort_order} />
                          </Field>
                        </div>
                        <Button variant="primary">Opslaan</Button>
                      </form>
                      <form action={createTopic} className="space-y-3">
                        <input type="hidden" name="module_id" value={m.id} />
                        <Field label="Nieuw thema">
                          <Input name="name" placeholder="Bijv. Ritmestoornissen" required />
                        </Field>
                        <Field label="Volgorde">
                          <Input name="sort_order" type="number" defaultValue={m.topics.length + 1} />
                        </Field>
                        <Button>Thema toevoegen</Button>
                      </form>
                    </div>
                    <form action={deleteModule} className="mt-6 border-t border-border-subtle pt-4">
                      <input type="hidden" name="id" value={m.id} />
                      <ConfirmButton variant="danger" message={`Module "${m.name}" met alle thema's, kaarten en herhalingen verwijderen?`}>
                        Module verwijderen
                      </ConfirmButton>
                    </form>
                  </ModuleDialog>
                </div>
              </div>

              {m.topics.length === 0 ? (
                <Panel className="text-sm text-muted">Nog geen thema&apos;s. Voeg er een toe via &quot;Module bewerken&quot;.</Panel>
              ) : (
                <>
                  {/* Laptop: raster met kaarten. */}
                  <ul className="hidden gap-4 md:grid md:grid-cols-3">
                    {m.topics.map((t) => {
                      const s = statsOf(t.id);
                      return (
                        <li key={t.id}>
                          <Link
                            href={`/thema/${t.id}`}
                            className="flex h-full min-h-[150px] flex-col gap-3.5 rounded-[14px] border border-border bg-surface px-[22px] py-5 transition-colors hover:border-border-strong motion-reduce:transition-none"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="font-serif text-[23px] font-medium leading-[1.2]">{t.name}</h3>
                              {s.due > 0 ? (
                                <span className="shrink-0 rounded-full bg-accent-soft px-[9px] py-[3px] text-xs font-bold tabular-nums text-accent-strong">
                                  {s.due} vandaag
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm tabular-nums text-muted">
                              {s.active} actieve {s.active === 1 ? "kaart" : "kaarten"} · {s.draft} concept
                            </p>
                            <Coverage covered={s.covered} total={s.objectives} />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Telefoon: één lijst. */}
                  <ul className="divide-y divide-border-subtle rounded-2xl border border-border bg-surface md:hidden">
                    {m.topics.map((t) => {
                      const s = statsOf(t.id);
                      return (
                        <li key={t.id}>
                          <Link href={`/thema/${t.id}`} className="block px-4 py-3.5">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="text-base font-medium">{t.name}</span>
                              <span className="shrink-0 text-sm tabular-nums text-muted">{s.active} actief</span>
                            </span>
                            <Coverage covered={s.covered} total={s.objectives} compact />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          );
        })}
      </div>

      <details className="mt-12">
        <summary className={buttonClass("ghost", "cursor-pointer list-none")}>+ Nieuwe module</summary>
        <Panel className="mt-3 max-w-[820px]">
          <form action={createModule} className="grid gap-3 md:grid-cols-2">
            <Field label="Naam">
              <Input name="name" placeholder="Bijv. PA de eerste stap" required />
            </Field>
            <Field label="Toetsdatum">
              <Input name="exam_date" type="date" />
            </Field>
            <Field label="Studiejaar">
              <Select name="study_year" defaultValue="1">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </Select>
            </Field>
            <Field label="Volgorde">
              <Input name="sort_order" type="number" defaultValue={(modules?.length ?? 0) + 1} />
            </Field>
            <div className="md:col-span-2">
              <Button variant="primary">Module toevoegen</Button>
            </div>
          </form>
        </Panel>
      </details>
    </>
  );
}

/** Dekkingsbalk: aandeel leerdoelen met een actieve kaart of casus. */
function Coverage({ covered, total, compact = false }: { covered: number; total: number; compact?: boolean }) {
  const pct = total ? (covered / total) * 100 : 0;
  return (
    <span className={`flex items-center gap-2.5 ${compact ? "mt-2" : "mt-auto"}`}>
      <span aria-hidden className={`${compact ? "h-[5px]" : "h-1.5"} flex-1 overflow-hidden rounded bg-surface-2`}>
        <span className="block h-full rounded bg-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className={`${compact ? "text-xs" : "text-[13px]"} shrink-0 tabular-nums text-text-2`}>
        {compact ? `${covered}/${total}` : `${covered}/${total} leerdoelen gedekt`}
      </span>
    </span>
  );
}
