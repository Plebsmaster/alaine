import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CardFields } from "@/components/card-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge, Button, buttonClass, Eyebrow, Field, Input, LinkButton, Panel, Segmented, Textarea } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/client";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/data/settings";
import { PRETEST_MAX } from "@/lib/exam";
import { CARD_TYPE_LABELS } from "@/lib/labels";
import { daysUntil } from "@/lib/time";
import { createCard } from "../../kaart/actions";
import { deleteTopic, updateTopic } from "../../themas/actions";
import { createObjective, deleteObjective, updateObjective } from "./actions";
import { AiCardsForm } from "./ai-cards-form";

export const metadata: Metadata = { title: "Thema" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const TABS = ["leerdoelen", "kaarten", "scripts", "casussen", "vragen"] as const;
type Tab = (typeof TABS)[number];
const STATUS_LABELS: Record<string, string> = { active: "Actief", draft: "Concept", suspended: "Geschorst" };
const UUID = /^[0-9a-f-]{36}$/i;

export default async function TopicPage({ params, searchParams }: PageProps<"/thema/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const tab: Tab = (TABS as readonly string[]).includes(one("tab") ?? "") ? (one("tab") as Tab) : "leerdoelen";
  const status = one("status") && one("status")! in STATUS_LABELS ? one("status")! : "active";
  const ownFor = one("eigen"); // "1" of een leerdoel-id: formulier "Eigen kaart" openen
  const showAi = one("maak") === "ai";

  const { supabase } = await requireUser();
  const settings = await getSettings(supabase);

  const [
    { data: topic },
    { data: objectives },
    { data: coverage },
    { data: counts },
    { data: cards },
    { count: draftsToCheck },
    { data: sourceIds },
    { data: allSources },
    { data: scripts },
    { data: cases },
    { data: questions },
  ] = await Promise.all([
    supabase.from("topics").select("id, name, sort_order, modules(name, exam_date)").eq("id", id).maybeSingle(),
    supabase.from("learning_objectives").select("id, code, description, sort_order").eq("topic_id", id).order("sort_order"),
    supabase.from("objective_coverage").select("*").eq("topic_id", id),
    supabase.from("topic_card_counts").select("*").eq("topic_id", id).maybeSingle(),
    supabase
      .from("cards")
      .select("id, type, front, status, flag_note, needs_verification, card_schedule(lapses)")
      .eq("topic_id", id)
      .eq("status", status)
      .order("created_at")
      .order("external_id", { nullsFirst: false })
      .limit(500),
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("topic_id", id).eq("status", "draft").eq("needs_verification", true),
    supabase.from("cards").select("source_id").eq("topic_id", id).not("source_id", "is", null).limit(2000),
    supabase.from("sources").select("id, title, author, chapter").order("title"),
    supabase.from("illness_scripts").select("id, condition, status").eq("topic_id", id).neq("status", "archived").order("condition"),
    supabase.from("cases").select("id, title, status, difficulty").eq("topic_id", id).neq("status", "archived").order("created_at").order("external_id", { nullsFirst: false }),
    supabase
      .from("questions")
      .select("id, stem, kind, format, status")
      .eq("topic_id", id)
      .neq("status", "archived")
      .order("kind")
      .order("created_at")
      .order("external_id", { nullsFirst: false }),
  ]);
  if (!topic) notFound();

  // Volgende stap: pretest, alleen zolang er actieve pretestvragen zijn die je nog niet probeerde.
  const pretestIds = (questions ?? []).filter((q) => q.kind === "pretest" && q.status === "active").slice(0, PRETEST_MAX).map((q) => q.id);
  const { data: tried } = pretestIds.length
    ? await supabase.from("question_attempts").select("question_id").in("question_id", pretestIds)
    : { data: [] as { question_id: string }[] };
  const triedIds = new Set((tried ?? []).map((t) => t.question_id));
  const pretestOpen = pretestIds.length > 0 && pretestIds.some((q) => !triedIds.has(q));

  const cov = new Map((coverage ?? []).map((c) => [c.objective_id, c]));
  const isCovered = (oid: string) => !!(cov.get(oid)?.active_cards || cov.get(oid)?.active_cases);
  const open = (objectives ?? []).filter((o) => !isCovered(o.id)).length;
  const exam = topic.modules?.exam_date ? daysUntil(topic.modules.exam_date, new Date(), settings.timezone) : null;
  const sourceLabel = (s: { title: string; author: string | null; chapter: string | null }) =>
    [s.author, s.title, s.chapter ? `h. ${s.chapter}` : null].filter(Boolean).join(", ");
  const usedSourceIds = new Set((sourceIds ?? []).map((c) => c.source_id));
  const usedSources = (allSources ?? []).filter((s) => usedSourceIds.has(s.id));
  const cardCounts = { active: Number(counts?.active ?? 0), draft: Number(counts?.draft ?? 0), suspended: Number(counts?.suspended ?? 0) };
  const href = (q: Record<string, string>) => `/thema/${id}?${new URLSearchParams(q).toString()}`;

  const tabs: { key: Tab; label: ReactNode }[] = [
    {
      key: "leerdoelen",
      label: (
        <>
          Leerdoelen{open > 0 ? <span className="font-normal text-danger"> · {open} open</span> : null}
        </>
      ),
    },
    { key: "kaarten", label: `Kaarten ${cardCounts.active + cardCounts.draft + cardCounts.suspended}` },
    { key: "scripts", label: `Illness scripts ${(scripts ?? []).length}` },
    { key: "casussen", label: `Casussen ${(cases ?? []).length}` },
    { key: "vragen", label: `Vragen ${(questions ?? []).length}` },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Kruimelpad en titel */}
      <div className="space-y-1.5">
        <p className="text-[13px] text-muted">
          <Link href="/themas" className="text-accent">
            <span className="md:hidden">‹ Studiestof</span>
            <span className="hidden md:inline">Thema&apos;s</span>
          </Link>
          <span className="hidden md:inline">
            {" "}
            · {topic.modules?.name}
            {exam !== null && exam >= 0 ? ` · toets over ${plural(exam, "dag", "dagen")}` : ""}
          </span>
        </p>
        <div className="flex items-start gap-2">
          <h1 className="font-serif text-[32px] font-medium leading-[1.1] md:text-[42px]">{topic.name}</h1>
          <details className="relative">
            <summary aria-label="Thema bewerken" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-[10px] text-xl text-muted hover:bg-surface-2">
              ⋯
            </summary>
            <div className="absolute left-0 z-20 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-4 md:left-auto md:right-0">
              <form action={updateTopic} className="space-y-3">
                <input type="hidden" name="id" value={id} />
                <Field label="Naam">
                  <Input name="name" defaultValue={topic.name} required />
                </Field>
                <Field label="Volgorde">
                  <Input name="sort_order" type="number" defaultValue={topic.sort_order} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary">Opslaan</Button>
                  <ConfirmButton variant="danger" formAction={deleteTopic} message={`Thema "${topic.name}" met alle kaarten en herhalingen verwijderen?`}>
                    Thema verwijderen
                  </ConfirmButton>
                </div>
              </form>
            </div>
          </details>
        </div>
      </div>

      {/* Tabbladen */}
      <nav aria-label="Onderdelen van het thema" className="-mx-4 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0">
        <ul className="flex gap-1 whitespace-nowrap text-sm md:text-[15px]">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                href={href({ tab: t.key })}
                aria-current={tab === t.key ? "page" : undefined}
                className="flex min-h-11 items-center px-3 text-text-2 hover:text-text aria-[current=page]:font-bold aria-[current=page]:text-text aria-[current=page]:shadow-[inset_0_-2px_0_var(--accent)]"
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Telefoon: compacte volgende stap */}
      {pretestOpen ? (
        <div className="flex items-center justify-between gap-3 rounded-[14px] bg-accent-deep px-4 py-3.5 text-on-deep md:hidden">
          <p className="text-[15px] font-bold">Pretest · {plural(pretestIds.length, "vraag", "vragen")}</p>
          <Link href={`/oefentoets/pretest/${id}`} className="flex h-10 items-center rounded-[10px] bg-on-deep px-4 text-sm font-bold text-accent-deep">
            Start
          </Link>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          {tab === "leerdoelen" ? (
            <section aria-label="Leerdoelen en dekking" className="space-y-3">
              {(objectives ?? []).length === 0 ? (
                <Panel className="text-sm text-muted">Nog geen leerdoelen. Voeg ze toe zoals ze in de studiehandleiding staan.</Panel>
              ) : (
                <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                  {(objectives ?? []).map((o) => {
                    const c = cov.get(o.id);
                    const covered = isCovered(o.id);
                    return (
                      <li key={o.id} className="border-b border-border-subtle px-4 py-3.5 last:border-b-0 md:px-5">
                        <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 md:grid-cols-[88px_1fr_200px] md:gap-3.5">
                          <span className="text-[13px] font-bold text-text-2 md:text-sm">{o.code ?? ""}</span>
                          <span className="col-span-2 row-start-2 text-[15px] leading-[1.4] md:col-span-1 md:row-start-auto">{o.description}</span>
                          <span className="flex flex-wrap items-start justify-end gap-1.5">
                            {covered ? (
                              <>
                                <span className="rounded-full bg-accent-soft px-[9px] py-[3px] text-[11px] tabular-nums text-accent-strong md:text-xs">
                                  {plural(Number(c?.active_cards ?? 0), "kaart", "kaarten")}
                                </span>
                                <span className="rounded-full bg-surface-2 px-[9px] py-[3px] text-[11px] tabular-nums text-text-2 md:text-xs">
                                  {plural(Number(c?.active_cases ?? 0), "casus", "casussen")}
                                </span>
                              </>
                            ) : (
                              <Link
                                href={`${href({ tab: "kaarten", eigen: o.id })}#eigen-kaart`}
                                className="rounded-[9px] border border-accent px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent-soft md:text-[13px]"
                              >
                                + Kaart maken
                              </Link>
                            )}
                            <details className="relative">
                              <summary aria-label={`Leerdoel ${o.code ?? ""} bewerken`} className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-md text-muted hover:bg-surface-2">
                                ⋯
                              </summary>
                              <form action={updateObjective} className="absolute right-0 z-20 mt-1 w-[min(26rem,calc(100vw-2rem))] space-y-2 rounded-xl border border-border bg-surface p-4">
                                <input type="hidden" name="id" value={o.id} />
                                <input type="hidden" name="topic_id" value={id} />
                                <div className="grid grid-cols-[6rem_1fr] gap-2">
                                  <Input name="code" defaultValue={o.code ?? ""} aria-label="Code" />
                                  <Input name="sort_order" type="number" defaultValue={o.sort_order} aria-label="Volgorde" />
                                </div>
                                <Textarea name="description" defaultValue={o.description} aria-label="Omschrijving" required rows={3} />
                                <div className="flex gap-2">
                                  <Button variant="primary">Opslaan</Button>
                                  <ConfirmButton variant="danger" formAction={deleteObjective} message="Leerdoel verwijderen?">
                                    Verwijderen
                                  </ConfirmButton>
                                </div>
                              </form>
                            </details>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer text-muted">Leerdoel toevoegen</summary>
                <form action={createObjective} className="mt-2 space-y-2">
                  <input type="hidden" name="topic_id" value={id} />
                  <div className="grid grid-cols-[6rem_1fr_5rem] gap-2">
                    <Input name="code" placeholder="2.1" aria-label="Code" />
                    <Textarea name="description" placeholder="Letterlijk uit de studiehandleiding" aria-label="Omschrijving" required rows={2} />
                    <Input name="sort_order" type="number" defaultValue={(objectives?.length ?? 0) + 1} aria-label="Volgorde" />
                  </div>
                  <Button>Toevoegen</Button>
                </form>
              </details>
            </section>
          ) : null}

          {tab === "kaarten" ? (
            <section aria-label="Kaarten" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Segmented
                  label="Status"
                  value={status}
                  className="w-full md:w-auto"
                  items={Object.entries(STATUS_LABELS).map(([key, label]) => ({
                    key,
                    href: href({ tab: "kaarten", status: key }),
                    label: `${label} ${cardCounts[key as keyof typeof cardCounts]}`,
                  }))}
                />
                <div className="flex flex-wrap gap-2">
                  <LinkButton href={`${href({ tab: "kaarten", status, maak: "ai" })}#ai-kaarten`}>Kaarten maken uit brontekst (AI)</LinkButton>
                  <LinkButton href={`${href({ tab: "kaarten", status, eigen: "1" })}#eigen-kaart`}>Eigen kaart</LinkButton>
                </div>
              </div>

              {showAi ? (
                <Panel id="ai-kaarten">
                  <h2 className="mb-3 text-[15px] font-bold">Kaarten maken uit brontekst (AI)</h2>
                  <AiCardsForm
                    topicId={id}
                    sources={(allSources ?? []).map((s) => ({ id: s.id, label: sourceLabel(s) }))}
                    enabled={aiConfigured()}
                    hasObjectives={(objectives ?? []).length > 0}
                  />
                </Panel>
              ) : null}

              {ownFor ? (
                <Panel id="eigen-kaart">
                  <h2 className="mb-3 text-[15px] font-bold">Eigen kaart</h2>
                  <form action={createCard} className="space-y-3">
                    <input type="hidden" name="topic_id" value={id} />
                    <CardFields objectives={objectives ?? []} selected={ownFor !== "1" ? [ownFor] : []} />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="activate" defaultChecked className="h-4 w-4" />
                      Direct in de herhaling (zelf geschreven, dus geen goedkeuring nodig)
                    </label>
                    <Button variant="primary">Kaart toevoegen</Button>
                  </form>
                </Panel>
              ) : null}

              {status === "draft" && (cards ?? []).length > 0 ? (
                <p className="text-sm">
                  <Link className="font-bold text-accent" href={`/goedkeuren?thema=${id}`}>
                    Concepten nakijken en goedkeuren →
                  </Link>
                </p>
              ) : null}
              <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                {(cards ?? []).length === 0 ? <li className="px-5 py-4 text-sm text-muted">Geen kaarten met deze status.</li> : null}
                {(cards ?? []).map((c) => (
                  <li key={c.id} className="border-b border-border-subtle last:border-b-0">
                    <Link
                      href={`/kaart/${c.id}?terug=${encodeURIComponent(href({ tab: "kaarten", status }))}`}
                      className="flex min-h-12 items-center justify-between gap-3 px-5 py-3 hover:bg-surface-sunk"
                    >
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-[15px] leading-[1.4]">{c.front}</span>
                        <span className="text-xs text-muted">{CARD_TYPE_LABELS[c.type] ?? c.type}</span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {c.needs_verification ? <Badge tone="warn">Controleren</Badge> : null}
                        {c.flag_note ? <Badge>klopt niet</Badge> : null}
                        {(c.card_schedule?.lapses ?? 0) >= 4 ? <Badge>lastig</Badge> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {tab === "scripts" ? (
            <SimpleList
              label="Illness scripts"
              empty="Nog geen illness scripts in dit thema."
              action={{ href: "/scripts/nieuw", label: "Nieuw script" }}
              items={(scripts ?? []).map((s) => ({ id: s.id, href: `/scripts/${s.id}`, title: s.condition, meta: s.status === "draft" ? "Concept" : "Goedgekeurd" }))}
            />
          ) : null}

          {tab === "casussen" ? (
            <SimpleList
              label="Casussen"
              empty="Nog geen casussen in dit thema."
              action={{ href: "/casussen/nieuw", label: "Nieuwe casus" }}
              items={(cases ?? []).map((c) => ({
                id: c.id,
                href: `/casussen/${c.id}`,
                title: c.title,
                meta: [c.status === "draft" ? "Concept" : "Actief", c.difficulty ? `moeilijkheid ${c.difficulty}` : null].filter(Boolean).join(" · "),
              }))}
            />
          ) : null}

          {tab === "vragen" ? (
            <SimpleList
              label="Vragen"
              empty="Nog geen pretest- of toetsvragen in dit thema."
              action={{ href: "/oefentoets/vraag/nieuw", label: "Nieuwe vraag" }}
              items={(questions ?? []).map((q) => ({
                id: q.id,
                href: `/oefentoets/vraag/${q.id}`,
                title: q.stem,
                meta: [q.kind === "pretest" ? "Pretest" : "Toetsvraag", q.format === "mcq" ? "meerkeuze" : "open", q.status === "draft" ? "concept" : null]
                  .filter(Boolean)
                  .join(" · "),
              }))}
            />
          ) : null}
        </div>

        {/* Rechterkolom */}
        <aside className="flex flex-col gap-4">
          {pretestOpen ? (
            <div className="hidden flex-col gap-2.5 rounded-2xl bg-accent-deep px-[22px] py-5 text-on-deep md:flex">
              <Eyebrow className="text-on-deep-muted">Volgende stap</Eyebrow>
              <p className="font-serif text-2xl font-medium leading-[1.2]">Pretest {topic.name}</p>
              <p className="text-sm leading-normal text-on-deep-2">
                {plural(pretestIds.length, "vraag", "vragen")}, geen score. Proberen helpt je de stof daarna beter te onthouden.
              </p>
              <Link href={`/oefentoets/pretest/${id}`} className="mt-1 flex h-11 items-center justify-center rounded-[10px] bg-on-deep text-[15px] font-bold text-accent-deep">
                Start pretest
              </Link>
            </div>
          ) : null}

          <section className="rounded-2xl border border-border bg-surface px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[15px] font-bold">Concepten</h2>
              <Link href={`/goedkeuren?thema=${id}`} className="text-[13px] font-bold text-accent">
                Nakijken →
              </Link>
            </div>
            <p className="mt-1 text-sm text-text-2">
              {cardCounts.draft === 0
                ? "Geen kaarten wachten op goedkeuring."
                : `${plural(cardCounts.draft, "kaart wacht", "kaarten wachten")} op goedkeuring, waarvan ${draftsToCheck ?? 0} te controleren.`}
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-surface px-5 py-4">
            <h2 className="text-[15px] font-bold">Bronnen</h2>
            {usedSources.length === 0 ? (
              <p className="mt-1 text-sm text-muted">Nog geen bronnen gekoppeld aan kaarten.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm text-text-2">
                {usedSources.map((s) => (
                  <li key={s.id}>{sourceLabel(s)}</li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function SimpleList({
  label,
  empty,
  action,
  items,
}: {
  label: string;
  empty: string;
  action: { href: string; label: string };
  items: { id: string; href: string; title: string; meta: string }[];
}) {
  return (
    <section aria-label={label} className="space-y-3">
      <div className="flex justify-end">
        <Link href={action.href} className={buttonClass("secondary")}>
          {action.label}
        </Link>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
        {items.length === 0 ? <li className="px-5 py-4 text-sm text-muted">{empty}</li> : null}
        {items.map((i) => (
          <li key={i.id} className="border-b border-border-subtle last:border-b-0">
            <Link href={i.href} className="block px-5 py-3 hover:bg-surface-sunk">
              <span className="line-clamp-2 text-[15px] leading-[1.4]">{i.title}</span>
              <span className="text-xs text-muted">{i.meta}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
