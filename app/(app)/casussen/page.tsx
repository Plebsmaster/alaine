import type { Metadata } from "next";
import Link from "next/link";
import { Button, LinkButton, Notice, PageHeader, Panel, Select } from "@/components/ui";
import { aiConfigured } from "@/lib/ai/client";
import { requireUser } from "@/lib/auth";
import { selectCases, SESSION_MAX, SESSION_MIN } from "@/lib/cases";
import { startSession } from "./actions";
import { AiCasesForm } from "./ai-cases-form";

export const metadata: Metadata = { title: "Casussen" };

export default async function CasesPage({ searchParams }: PageProps<"/casussen">) {
  const { leeg } = await searchParams;
  const { supabase } = await requireUser();
  const [{ data: cases, error }, { data: attempts }, { data: topics }] = await Promise.all([
    supabase
      .from("cases")
      .select("id, title, status, from_internship, topic_id, topics(name, sort_order)")
      .neq("status", "archived")
      .order("title"),
    supabase.from("case_attempts").select("case_id, created_at, self_score").order("created_at", { ascending: false }).limit(5000),
    supabase.from("topics").select("id, name, sort_order, modules(name, sort_order)").order("sort_order"),
  ]);
  if (error) throw new Error(error.message);

  const last = new Map<string, { at: string; score: number | null }>();
  for (const a of attempts ?? []) if (!last.has(a.case_id)) last.set(a.case_id, { at: a.created_at, score: a.self_score });

  const active = (cases ?? []).filter((c) => c.status === "active");
  const drafts = (cases ?? []).filter((c) => c.status === "draft").length;
  const ready = selectCases(
    active.map((c) => ({ id: c.id, topic_id: c.topic_id, last_attempt_at: last.get(c.id)?.at ?? null, last_score: last.get(c.id)?.score ?? null })),
    Number.MAX_SAFE_INTEGER,
    new Date(),
  ).length;

  const groups = new Map<string, { name: string; sort: number; items: typeof active }>();
  for (const c of active) {
    const g = groups.get(c.topic_id) ?? { name: c.topics?.name ?? "", sort: c.topics?.sort_order ?? 0, items: [] };
    g.items.push(c);
    groups.set(c.topic_id, g);
  }
  const topicOptions = (topics ?? [])
    .sort((a, b) => (a.modules?.sort_order ?? 0) - (b.modules?.sort_order ?? 0) || a.sort_order - b.sort_order)
    .map((t) => ({ id: t.id, label: `${t.modules?.name ?? ""} · ${t.name}` }));

  return (
    <>
      <PageHeader title="Casussen" />
      <div className="space-y-6">
        <Panel className="space-y-3">
          <h2 className="font-semibold">Oefenen</h2>
          <p className="text-sm text-muted">
            {ready} van {active.length} casussen klaar om te oefenen. Een casus komt pas na 7 dagen terug.
          </p>
          {leeg ? <Notice tone="error">Er zijn nu geen casussen om te oefenen.</Notice> : null}
          <form action={startSession} className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-sm">
              <span className="block font-medium">Aantal</span>
              <Select name="n" defaultValue={String(SESSION_MIN)} className="w-24">
                {Array.from({ length: SESSION_MAX - SESSION_MIN + 1 }, (_, i) => SESSION_MIN + i).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
            <Button variant="primary" disabled={ready === 0}>
              Start sessie
            </Button>
          </form>
        </Panel>

        <div className="flex flex-wrap gap-2">
          <LinkButton href="/casussen/nieuw?stage=1">Nieuwe casus uit stage</LinkButton>
          <LinkButton href="/casussen/nieuw">Nieuwe casus</LinkButton>
          {drafts > 0 ? <LinkButton href="/goedkeuren">{drafts} concept(en) nakijken</LinkButton> : null}
        </div>

        {topicOptions.length > 0 ? (
          <details className="rounded-xl border border-border bg-surface p-4">
            <summary className="cursor-pointer font-semibold">Casussen laten maken door AI</summary>
            <div className="mt-3">
              <AiCasesForm topics={topicOptions} enabled={aiConfigured()} />
            </div>
          </details>
        ) : null}

        {[...groups.values()]
          .sort((a, b) => a.sort - b.sort)
          .map((g) => (
            <section key={g.name} className="space-y-2">
              <h2 className="text-lg font-semibold">{g.name}</h2>
              <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
                {g.items.map((c) => {
                  const l = last.get(c.id);
                  return (
                    <li key={c.id}>
                      <Link href={`/casussen/${c.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 hover:bg-surface-2">
                        <span>
                          {c.title}
                          {c.from_internship ? <span className="ml-2 text-xs text-muted">stage</span> : null}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {l ? `${new Date(l.at).toLocaleDateString("nl-NL")} · score ${l.score ?? "–"}` : "nog niet geoefend"}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        {active.length === 0 ? (
          <Panel className="text-sm text-muted">Nog geen actieve casussen. Importeer ze, laat ze maken door AI, of schrijf er zelf een.</Panel>
        ) : null}
      </div>
    </>
  );
}
