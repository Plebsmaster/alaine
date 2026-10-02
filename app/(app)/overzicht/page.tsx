import type { Metadata } from "next";
import Link from "next/link";
import { ColumnChart } from "@/components/column-chart";
import { PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { LEECH_LAPSES } from "@/lib/dashboard";
import { loadDashboard } from "@/lib/data/dashboard";
import { getSettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Overzicht" };

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);
const dayLabel = (key: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("nl-NL", { ...opts, timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));

export default async function OverviewPage() {
  const { supabase } = await requireUser();
  const settings = await getSettings(supabase);
  const d = await loadDashboard(supabase, settings);

  const toColumns = (rows: { day: string; value: number }[]) =>
    rows.map((r) => ({
      key: r.day,
      label: dayLabel(r.day, { day: "numeric" }),
      detail: dayLabel(r.day, { weekday: "short", day: "numeric", month: "short" }),
      value: r.value,
    }));

  return (
    <>
      <PageHeader title="Overzicht" />
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Vandaag te herhalen" value={String(d.dueToday)} />
          <Stat label="Studiestreak" value={`${d.streak} ${d.streak === 1 ? "dag" : "dagen"}`} />
          <Stat label="Minuten vandaag" value={String(d.minutesToday)} />
          <Stat
            label="Retentie, 30 dagen"
            value={pct(d.retention.value)}
            note={d.retention.n ? `${d.retention.n} herhalingen` : "nog geen herhalingen"}
          />
        </dl>

        {d.exams.length > 0 ? (
          <Panel>
            <h2 className="mb-2 font-semibold">Toetsen</h2>
            <ul className="space-y-1 text-sm">
              {d.exams.map((e) => (
                <li key={e.name} className="flex justify-between gap-3">
                  <span>{e.name}</span>
                  <span className="tabular-nums">
                    {e.days === 0 ? "vandaag" : `over ${e.days} ${e.days === 1 ? "dag" : "dagen"}`} ·{" "}
                    {dayLabel(e.date, { day: "numeric", month: "long" })}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <Panel>
            <ColumnChart
              title="Werklast komende 14 dagen (herhalingen per dag)"
              columns={toColumns(d.workload.map((w) => ({ day: w.day, value: w.count })))}
              unit={["herhaling", "herhalingen"]}
              emptyText="Nog geen geplande herhalingen."
            />
          </Panel>
          <Panel>
            <ColumnChart
              title="Studietijd afgelopen 14 dagen (minuten per dag)"
              columns={toColumns(d.minutes.map((m) => ({ day: m.day, value: m.minutes })))}
              unit={["min", "min"]}
              emptyText="Nog geen studietijd gemeten."
            />
          </Panel>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Per thema</h2>
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">Thema</th>
                  <th className="py-1 pr-3 text-right font-medium">Actief</th>
                  <th className="py-1 pr-3 text-right font-medium">Concept</th>
                  <th className="py-1 pr-3 text-right font-medium">Vandaag</th>
                  <th className="py-1 pr-3 text-right font-medium">Retentie 30 d</th>
                  <th className="py-1 text-right font-medium">Laatste casus</th>
                </tr>
              </thead>
              <tbody>
                {d.topics.map((t) => (
                  <tr key={t.id} className="border-t border-border">
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
                    <td className="py-2 text-right tabular-nums">{t.lastCaseScore === null ? "–" : `${t.lastCaseScore}/5`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {d.topics.length === 0 ? <p className="text-sm text-muted">Nog geen thema&apos;s.</p> : null}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Leerdoelen zonder dekking</h2>
          {d.uncovered.length === 0 ? (
            <p className="text-sm text-muted">Elk leerdoel heeft een actieve kaart of casus.</p>
          ) : (
            <>
              <p className="text-sm text-muted">{d.uncovered.length} leerdoel(en) hebben nog geen actieve kaart of casus.</p>
              <ul className="divide-y divide-border rounded-xl border border-danger bg-surface">
                {d.uncovered.slice(0, 50).map((o) => (
                  <li key={o.id}>
                    <Link href={`/thema/${o.topic_id}`} className="block px-4 py-2 text-sm hover:bg-surface-2">
                      <span className="text-xs text-muted">{o.topic}</span>
                      <span className="block">
                        {o.code ? <strong>{o.code} </strong> : null}
                        {o.description}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Lastige kaarten</h2>
          {d.leeches.length === 0 ? (
            <p className="text-sm text-muted">Geen kaarten die je {LEECH_LAPSES} keer of vaker bent vergeten.</p>
          ) : (
            <>
              <p className="text-sm text-muted">
                Deze kaarten vergat je {LEECH_LAPSES} keer of vaker. Herschrijf ze in je eigen woorden of splits ze op in kleinere kaarten.
              </p>
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {d.leeches.map((c) => (
                  <li key={c.id}>
                    <Link href={`/kaart/${c.id}?terug=/overzicht`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 hover:bg-surface-2">
                      <span className="text-sm">
                        <span className="block text-xs text-muted">{c.topic}</span>
                        {c.front}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{c.lapses}× vergeten</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
      {note ? <dd className="text-xs text-muted">{note}</dd> : null}
    </div>
  );
}
