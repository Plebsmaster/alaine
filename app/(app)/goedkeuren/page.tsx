import type { Metadata } from "next";
import Link from "next/link";
import { Button, Notice, PageHeader, Panel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { approveCases } from "../casussen/actions";
import { DraftCard, type Draft } from "./draft-card";

export const metadata: Metadata = { title: "Goedkeuren" };

const LIMIT = 50;

export default async function ApprovePage({ searchParams }: PageProps<"/goedkeuren">) {
  const { thema } = await searchParams;
  const topicFilter = typeof thema === "string" ? thema : null;
  const { supabase } = await requireUser();

  const count = (table: "cards" | "illness_scripts" | "cases" | "questions") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("status", "draft");

  let draftsQuery = supabase
    .from("cards")
    .select("id, topic_id, type, front, back, explanation, origin, flag_note, source_locator, topics(name, sort_order), sources(title, chapter), card_objectives(learning_objectives(code, sort_order))")
    .eq("status", "draft")
    .order("created_at")
    .limit(LIMIT);
  if (topicFilter) draftsQuery = draftsQuery.eq("topic_id", topicFilter);

  let scriptsQuery = supabase
    .from("illness_scripts")
    .select("id, condition, origin, topics(name)")
    .eq("status", "draft")
    .order("condition")
    .limit(100);
  if (topicFilter) scriptsQuery = scriptsQuery.eq("topic_id", topicFilter);

  let casesQuery = supabase
    .from("cases")
    .select("id, title, correct_diagnosis, origin, topics(name)")
    .eq("status", "draft")
    .order("created_at")
    .limit(100);
  if (topicFilter) casesQuery = casesQuery.eq("topic_id", topicFilter);

  const [cards, scripts, cases, questions, { data: drafts, error }, { data: counts }, { data: draftScripts }, { data: draftCases }] = await Promise.all([
    count("cards"),
    count("illness_scripts"),
    count("cases"),
    count("questions"),
    draftsQuery,
    supabase.from("topic_card_counts").select("topic_id, draft").gt("draft", 0),
    scriptsQuery,
    casesQuery,
  ]);
  if (error) throw new Error(error.message);

  const { data: topics } = counts?.length
    ? await supabase.from("topics").select("id, name").in("id", counts.map((c) => c.topic_id!))
    : { data: [] };

  // Groeperen per thema.
  const groups = new Map<string, { name: string; items: Draft[] }>();
  for (const c of drafts ?? []) {
    const g = groups.get(c.topic_id) ?? { name: c.topics?.name ?? "", items: [] };
    g.items.push({
      id: c.id,
      type: c.type,
      front: c.front,
      back: c.back,
      explanation: c.explanation,
      origin: c.origin,
      flag_note: c.flag_note,
      source: c.sources
        ? [c.sources.title, c.sources.chapter ? `h. ${c.sources.chapter}` : null, c.source_locator].filter(Boolean).join(", ")
        : c.source_locator,
      objectives: c.card_objectives.map((o) => o.learning_objectives?.code).filter((x): x is string => !!x),
    });
    groups.set(c.topic_id, g);
  }

  return (
    <>
      <PageHeader title="Goedkeuren" />
      <dl className="mb-6 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {[
          ["Kaarten", cards.count],
          ["Illness scripts", scripts.count],
          ["Casussen", cases.count],
          ["Vragen", questions.count],
        ].map(([label, n]) => (
          <div key={label as string} className="rounded-lg border border-border bg-surface p-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-xl font-semibold">{n ?? 0}</dd>
          </div>
        ))}
      </dl>

      {(topics ?? []).length > 1 ? (
        <nav className="mb-4 flex flex-wrap gap-1 text-sm" aria-label="Filter op thema">
          <Link href="/goedkeuren" aria-current={!topicFilter ? "page" : undefined} className="rounded-lg px-3 py-1.5 hover:bg-surface-2 aria-[current=page]:bg-surface-2 aria-[current=page]:font-semibold">
            Alle
          </Link>
          {(topics ?? []).map((t) => (
            <Link key={t.id} href={`/goedkeuren?thema=${t.id}`} aria-current={topicFilter === t.id ? "page" : undefined} className="rounded-lg px-3 py-1.5 hover:bg-surface-2 aria-[current=page]:bg-surface-2 aria-[current=page]:font-semibold">
              {t.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="mb-6">
        <Notice>Zet het in je eigen woorden; dat onthoud je beter.</Notice>
      </div>

      {(draftScripts ?? []).length > 0 ? (
        <section className="mb-8 space-y-2">
          <h2 className="text-lg font-semibold">Illness scripts</h2>
          <p className="text-sm text-muted">Controleer een script en keur het goed; dan komen er scriptkaarten bij.</p>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {(draftScripts ?? []).map((s) => (
              <li key={s.id}>
                <Link href={`/scripts/${s.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 hover:bg-surface-2">
                  <span>{s.condition}</span>
                  <span className="text-xs text-muted">
                    {s.topics?.name}
                    {s.origin === "ai" ? " · AI" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(draftCases ?? []).length > 0 ? (
        <section className="mb-8 space-y-2">
          <h2 className="text-lg font-semibold">Casussen</h2>
          <p className="text-sm text-muted">Open een casus om hem te controleren, of keur er meerdere tegelijk goed.</p>
          <form action={approveCases} className="space-y-2">
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {(draftCases ?? []).map((c) => (
                <li key={c.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
                  <input type="checkbox" name="id" value={c.id} aria-label={`${c.title} goedkeuren`} className="h-5 w-5 shrink-0" />
                  <Link href={`/casussen/${c.id}`} className="flex-1 hover:underline">
                    {c.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">
                    {c.topics?.name}
                    {c.origin === "ai" ? " · AI" : ""}
                  </span>
                </li>
              ))}
            </ul>
            <Button>Geselecteerde casussen goedkeuren</Button>
          </form>
        </section>
      ) : null}

      {(drafts ?? []).length === 0 ? (
        <Panel className="text-sm text-muted">Geen kaartconcepten om na te kijken.</Panel>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([topicId, g]) => (
            <section key={topicId} className="space-y-3">
              <h2 className="text-lg font-semibold">{g.name}</h2>
              {g.items.map((d) => (
                <DraftCard key={d.id} draft={d} />
              ))}
            </section>
          ))}
          {(cards.count ?? 0) > LIMIT ? (
            <p className="text-sm text-muted">
              De eerste {LIMIT} van {cards.count} concepten staan hier. Herlaad de pagina voor de volgende.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
