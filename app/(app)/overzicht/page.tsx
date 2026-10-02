import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ColumnChart } from "@/components/column-chart";
import { Eyebrow, SettingsButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { LEECH_LAPSES, retentionScale } from "@/lib/dashboard";
import { loadDashboard, type TopicRow } from "@/lib/data/dashboard";
import { getSettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Overzicht" };

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("nl-NL", { ...opts, timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Maximaal zoveel regels in "Aandacht nodig" voordat "Alles bekijken" verschijnt. */
const ATTENTION_MAX = 6;

type Attention = { key: string; kind: "objective" | "leech"; href: string; text: ReactNode; meta: string };

export default async function OverviewPage() {
  const { supabase } = await requireUser();
  const settings = await getSettings(supabase);
  const d = await loadDashboard(supabase, settings);

  const target = Math.round(settings.desired_retention * 100);
  const retentionPct = d.retention.value === null ? null : Math.round(d.retention.value * 100);
  const topicPct = (t: TopicRow) => (t.retention === null ? null : Math.round(t.retention * 100));
  const scale = retentionScale([...d.topics.map(topicPct), target]);

  const toColumns = (rows: { day: string; value: number }[]) =>
    rows.map((r) => ({
      key: r.day,
      label: dayLabel(r.day, { day: "numeric" }),
      detail: dayLabel(r.day, { weekday: "short", day: "numeric", month: "short" }),
      value: r.value,
    }));

  // Eerst leerdoelen zonder dekking, dan lastige kaarten.
  const attention: Attention[] = [
    ...d.uncovered.map((o) => ({
      key: `o-${o.id}`,
      kind: "objective" as const,
      href: `/thema/${o.topic_id}`,
      text: (
        <>
          {o.code ? <strong>{o.code} </strong> : null}
          {o.description}
        </>
      ),
      meta: `${o.topic} · geen kaart of casus`,
    })),
    ...d.leeches.map((c) => ({
      key: `k-${c.id}`,
      kind: "leech" as const,
      href: `/kaart/${c.id}?terug=/overzicht`,
      text: c.front,
      meta: `${c.topic} · ${c.lapses}× vergeten · herschrijf of splits`,
    })),
  ];

  // Telefoon: samenvatting per soort.
  const uncoveredByTopic = new Map<string, number>();
  for (const o of d.uncovered) uncoveredByTopic.set(o.topic, (uncoveredByTopic.get(o.topic) ?? 0) + 1);
  const worstTopic = [...uncoveredByTopic.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const metaParts = [
    plural(d.retention.n, "herhaling", "herhalingen"),
    `${d.streak} ${d.streak === 1 ? "dag" : "dagen"} streak`,
    `${d.minutesToday} min vandaag`,
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Overzicht</h1>

      {/* Laptop: kopzin met retentie tegenover het doel. */}
      <header className="hidden flex-wrap items-end justify-between gap-6 md:flex">
        <div className="space-y-2">
          <Eyebrow>Afgelopen 30 dagen</Eyebrow>
          <p className="font-serif text-[40px] font-medium leading-[1.1]">
            {retentionPct === null ? "Nog geen herhalingen in de afgelopen 30 dagen." : `Retentie ${retentionPct}%, bij een doel van ${target}%.`}
          </p>
        </div>
        <dl className="flex gap-6 text-sm text-muted">
          <InlineStat value={String(d.retention.n)} label={d.retention.n === 1 ? "herhaling" : "herhalingen"} />
          <InlineStat value={String(d.streak)} label={`${d.streak === 1 ? "dag" : "dagen"} streak`} />
          <InlineStat value={String(d.minutesToday)} label="min vandaag" />
        </dl>
      </header>

      {/* Telefoon: groot percentage. */}
      <header className="space-y-2 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Inzicht · 30 dagen</Eyebrow>
          <SettingsButton />
        </div>
        <div className="flex items-end gap-3">
          <p className="font-serif text-[56px] font-medium leading-none tabular-nums">{retentionPct === null ? "–" : `${retentionPct}%`}</p>
          <p className="pb-1.5 text-sm text-text-2">
            retentie
            <br />
            doel {target}%
          </p>
        </div>
        <p className="text-[13px] text-muted">{metaParts.join(" · ")}</p>
      </header>

      {/* Telefoon: aandacht nodig, samengevat per soort. */}
      {attention.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface md:hidden" aria-labelledby="aandacht-tel">
          <h2 id="aandacht-tel" className="px-4 pt-4 text-[15px] font-bold">
            Aandacht nodig
          </h2>
          <div className="divide-y divide-border-subtle">
            {d.uncovered.length > 0 ? (
              <AttentionGroup
                dot="bg-danger"
                summary={`${plural(d.uncovered.length, "leerdoel", "leerdoelen")} zonder dekking${worstTopic ? ` · ${worstTopic}` : ""}`}
                items={attention.filter((a) => a.kind === "objective")}
              />
            ) : null}
            {d.leeches.length > 0 ? (
              <AttentionGroup
                dot="bg-hard"
                summary={`${plural(d.leeches.length, "lastige kaart", "lastige kaarten")} om te herschrijven`}
                items={attention.filter((a) => a.kind === "leech")}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[1fr_400px]">
        {/* Per thema: retentie tegenover het doel. */}
        <section className="self-start rounded-2xl border border-border bg-surface px-4 py-4 md:px-6 md:py-5" aria-labelledby="per-thema">
          <h2 id="per-thema" className="mb-3 text-[15px] font-bold md:mb-2">
            Per thema
          </h2>
          {d.topics.length === 0 ? (
            <p className="text-sm text-muted">Nog geen thema&apos;s.</p>
          ) : (
            <>
              <div className="hidden grid-cols-[210px_1fr_90px] gap-5 pb-2 text-xs font-bold text-muted md:grid">
                <span>Thema</span>
                <span className="relative h-4">
                  <span className="absolute left-0">{scale.min}%</span>
                  <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${scale.pos(target) * 100}%` }}>
                    doel {target}%
                  </span>
                  <span className="absolute right-0">100%</span>
                </span>
                <span className="text-right">Leerdoelen</span>
              </div>
              <ul>
                {d.topics.map((t) => {
                  const r = topicPct(t);
                  const ok = r !== null && r >= target;
                  const advice = t.errorAdvice ?? (t.objectives - t.covered > 0 ? `${plural(t.objectives - t.covered, "leerdoel", "leerdoelen")} zonder dekking` : null);
                  return (
                    <li key={t.id} className="border-t border-border-subtle py-3 md:grid md:grid-cols-[210px_1fr_90px] md:items-center md:gap-5 md:py-[13px]">
                      <div className="flex items-baseline justify-between gap-3 md:block">
                        <Link href={`/thema/${t.id}`} className="text-sm font-medium hover:underline md:text-[15px] md:font-bold">
                          {t.name}
                        </Link>
                        <span className={`text-sm font-bold tabular-nums md:hidden ${r === null ? "text-muted" : ok ? "text-accent" : "text-hard"}`}>
                          {r === null ? "–" : `${r}%`}
                        </span>
                        {advice ? <p className="hidden text-xs text-muted md:block">{advice}</p> : null}
                      </div>
                      <RetentionTrack value={r} target={target} pos={scale.pos} ok={ok} />
                      <span className="hidden text-right text-sm tabular-nums md:block">
                        {t.covered}/{t.objectives}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-muted">Retentie per thema over de afgelopen 30 dagen; de streep is je doel.</p>
            </>
          )}
        </section>

        <div className="flex flex-col gap-5">
          {/* Laptop: één lijst met wat aandacht nodig heeft. */}
          <section className="hidden rounded-2xl border border-border bg-surface px-[22px] py-5 md:block" aria-labelledby="aandacht">
            <h2 id="aandacht" className="mb-1 text-[15px] font-bold">
              Aandacht nodig
            </h2>
            {attention.length === 0 ? (
              <p className="text-sm text-muted">
                Elk leerdoel heeft een actieve kaart of casus, en geen kaart is {LEECH_LAPSES} keer of vaker vergeten.
              </p>
            ) : (
              <>
                <AttentionList items={attention.slice(0, ATTENTION_MAX)} />
                {attention.length > ATTENTION_MAX ? (
                  <details className="group">
                    <summary className="mt-2 cursor-pointer list-none text-sm font-bold text-accent group-open:hidden">Alles bekijken ({attention.length})</summary>
                    <AttentionList items={attention.slice(ATTENTION_MAX)} />
                  </details>
                ) : null}
              </>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface px-[22px] py-5">
            <ColumnChart
              title="Werklast, 14 dagen"
              columns={toColumns(d.workload.map((w) => ({ day: w.day, value: w.count })))}
              unit={["herhaling", "herhalingen"]}
              emptyText="Nog geen geplande herhalingen."
              compact
            />
          </section>
        </div>
      </div>

      {/* Alle cijfers blijven beschikbaar. */}
      <details className="rounded-2xl border border-border bg-surface px-4 py-4 md:px-6 md:py-5">
        <summary className="cursor-pointer text-[15px] font-bold">Alle cijfers per thema</summary>
        <div className="mt-4 space-y-6">
          <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <SmallStat label="Vandaag" value={String(d.dueToday + d.newToday)} note={`${d.dueToday} herhalen · ${d.newToday} nieuw`} />
            <SmallStat label="Studiestreak" value={`${d.streak} ${d.streak === 1 ? "dag" : "dagen"}`} />
            <SmallStat label="Minuten vandaag" value={String(d.minutesToday)} />
            <SmallStat label="Retentie, 30 dagen" value={pct(d.retention.value)} note={d.retention.n ? plural(d.retention.n, "herhaling", "herhalingen") : "nog geen herhalingen"} />
          </dl>

          {d.exams.length > 0 ? (
            <div>
              <h3 className="mb-1 text-sm font-bold">Toetsen</h3>
              <ul className="space-y-1 text-sm">
                {d.exams.map((e) => (
                  <li key={e.name} className="flex justify-between gap-3">
                    <span>{e.name}</span>
                    <span className="tabular-nums">
                      {e.days === 0 ? "vandaag" : `over ${plural(e.days, "dag", "dagen")}`} · {dayLabel(e.date, { day: "numeric", month: "long" })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 pr-3 font-bold">Thema</th>
                  <th className="py-1 pr-3 text-right font-bold">Actief</th>
                  <th className="py-1 pr-3 text-right font-bold">Concept</th>
                  <th className="py-1 pr-3 text-right font-bold">Vandaag</th>
                  <th className="py-1 pr-3 text-right font-bold">Retentie 30 d</th>
                  <th className="py-1 pr-3 text-right font-bold">Laatste casus</th>
                  <th className="py-1 font-bold">Fouttypes, 30 d</th>
                </tr>
              </thead>
              <tbody>
                {d.topics.map((t) => {
                  const total = t.errors.knowledge_gap + t.errors.reasoning_error + t.errors.slip;
                  return (
                    <tr key={t.id} className="border-t border-border-subtle">
                      <td className="py-2 pr-3">
                        <Link href={`/thema/${t.id}`} className="hover:underline">
                          {t.name}
                        </Link>
                        <span className="block text-xs text-muted">{t.module}</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{t.active}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{t.draft}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{t.dueToday}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {pct(t.retention)}
                        {t.retentionN ? <span className="block text-xs text-muted">n = {t.retentionN}</span> : null}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{t.lastCaseScore === null ? "–" : `${t.lastCaseScore}/5`}</td>
                      <td className="py-2 text-xs">
                        {total > 0 ? (
                          <span aria-hidden className="mb-1 flex h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
                            <span className="bg-err-1" style={{ flexGrow: t.errors.knowledge_gap }} />
                            <span className="bg-err-2" style={{ flexGrow: t.errors.reasoning_error }} />
                            <span className="bg-err-3" style={{ flexGrow: t.errors.slip }} />
                          </span>
                        ) : null}
                        <span className="tabular-nums">
                          {t.errors.knowledge_gap} kennis · {t.errors.reasoning_error} redenering · {t.errors.slip} slordig
                        </span>
                        {t.errorAdvice ? <span className="block text-muted">{t.errorAdvice}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ColumnChart
            title="Studietijd afgelopen 14 dagen (minuten per dag)"
            columns={toColumns(d.minutes.map((m) => ({ day: m.day, value: m.minutes })))}
            unit={["min", "min"]}
            emptyText="Nog geen studietijd gemeten."
          />
        </div>
      </details>
    </div>
  );
}

/** Spoor van 70 (of lager) tot 100%: doelstreep en een stip op de retentie van het thema. */
function RetentionTrack({ value, target, pos, ok }: { value: number | null; target: number; pos: (x: number) => number; ok: boolean }) {
  const color = ok ? "bg-accent ring-accent" : "bg-hard ring-hard";
  return (
    <div className="relative mt-2 h-3 md:mt-0 md:h-[22px]" aria-hidden>
      <span className="absolute inset-x-0 top-[5px] h-[3px] rounded bg-surface-2 md:top-2.5" />
      <span className="absolute top-0 h-3 w-0.5 bg-text/35 md:-top-px md:h-[18px]" style={{ left: `${pos(target) * 100}%` }} />
      {value !== null ? (
        <>
          <span
            className={`absolute top-px h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-surface ring-1 md:top-1 md:h-3.5 md:w-3.5 ${color}`}
            style={{ left: `${pos(value) * 100}%` }}
          />
          <span
            className={`absolute top-0.5 hidden text-[13px] font-bold tabular-nums md:block ${ok ? "text-accent" : "text-hard"}`}
            style={{ left: `calc(${pos(value) * 100}% + 14px)` }}
          >
            {value}%
          </span>
        </>
      ) : (
        <span className="absolute left-0 top-0.5 hidden text-[13px] text-muted md:block">–</span>
      )}
    </div>
  );
}

function AttentionList({ items }: { items: Attention[] }) {
  return (
    <ul>
      {items.map((a) => (
        <li key={a.key} className="border-t border-border-subtle first:border-t-0">
          <Link href={a.href} className="flex gap-3 py-2.5 hover:bg-surface-sunk">
            <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.kind === "objective" ? "bg-danger" : "bg-hard"}`} />
            <span className="min-w-0">
              <span className="line-clamp-2 block text-sm leading-[1.4]">{a.text}</span>
              <span className="block text-xs text-muted">{a.meta}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AttentionGroup({ dot, summary, items }: { dot: string; summary: string; items: Attention[] }) {
  return (
    <details className="group px-4">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-2.5 text-sm">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="flex-1">{summary}</span>
        <svg aria-hidden viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} className="text-muted transition-transform group-open:rotate-90">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </summary>
      <div className="pb-2">
        <AttentionList items={items} />
      </div>
    </details>
  );
}

function InlineStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd className="text-lg font-bold tabular-nums text-text">{value}</dd>
      <dd aria-hidden>{label}</dd>
    </div>
  );
}

function SmallStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-xl font-bold tabular-nums">{value}</dd>
      {note ? <dd className="text-xs text-muted">{note}</dd> : null}
    </div>
  );
}
