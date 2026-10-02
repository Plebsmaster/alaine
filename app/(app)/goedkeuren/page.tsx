import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Button, Eyebrow, LinkButton, Segmented } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ORIGIN_LABELS, VERIFY_TEXT } from "@/lib/labels";
import { approveCases } from "../casussen/actions";
import { approveQuestions } from "../oefentoets/actions";
import { SCRIPT_FIELDS } from "../scripts/script-labels";
import { CardTriage, PhoneHeader, type DraftCardItem } from "./card-triage";
import { TopicSelect } from "./topic-select";

export const metadata: Metadata = { title: "Goedkeuren" };

// Goedkeuren als triage (docs/design/README.md, 1n). Kaarten: lijst, bron en editor (CardTriage).
// Scripts, casussen en vragen: lijst met alleen-lezenvoorbeeld en "Openen"; bulk alleen voor casussen en vragen.

const KINDS = [
  { key: "kaarten", label: "Kaarten", table: "cards" },
  { key: "scripts", label: "Scripts", table: "illness_scripts" },
  { key: "casussen", label: "Casus", table: "cases" },
  { key: "vragen", label: "Vragen", table: "questions" },
] as const;
type Kind = (typeof KINDS)[number]["key"];
type Table = (typeof KINDS)[number]["table"];

const CARD_LIMIT = 300;
const LIST_LIMIT = 200;

type Source = { title: string; chapter: string | null; pages: string | null } | null;

function sourceLabel(source: Source, locator: string | null): string | null {
  const parts = [source?.title, source?.chapter ? `h. ${source.chapter}` : null, locator ?? (source?.pages ? `p. ${source.pages}` : null)];
  const label = parts.filter(Boolean).join(" · ");
  return label || null;
}

export default async function ApprovePage({ searchParams }: PageProps<"/goedkeuren">) {
  const sp = await searchParams;
  const kind: Kind = KINDS.find((k) => k.key === sp.soort)?.key ?? "kaarten";
  const topicFilter = typeof sp.thema === "string" && sp.thema ? sp.thema : null;
  const verifyOnly = sp.controleren === "1";
  const selectedId = typeof sp.id === "string" ? sp.id : null;
  const table = KINDS.find((k) => k.key === kind)!.table;
  const { supabase } = await requireUser();

  const draftCount = async (t: Table, verify = false) => {
    let q = supabase.from(t).select("id", { count: "exact", head: true }).eq("status", "draft");
    if (topicFilter) q = q.eq("topic_id", topicFilter);
    if (verify) q = q.eq("needs_verification", true);
    return (await q).count ?? 0;
  };
  const draftTopics = async (t: Table) => (await supabase.from(t).select("topic_id").eq("status", "draft")).data ?? [];

  const [counts, verifyCount, { data: topicRows }, topicLists] = await Promise.all([
    Promise.all(KINDS.map((k) => draftCount(k.table))),
    draftCount(table, true),
    supabase.from("topics").select("id, name, sort_order, modules(sort_order)"),
    Promise.all(KINDS.map((k) => draftTopics(k.table))),
  ]);

  // Thema's in de volgorde van de modules; in de themakeuze alleen thema's met concepten.
  const topics = (topicRows ?? []).sort(
    (a, b) => (a.modules?.sort_order ?? 0) - (b.modules?.sort_order ?? 0) || a.sort_order - b.sort_order || a.name.localeCompare(b.name, "nl"),
  );
  const topicOrder = new Map(topics.map((t, i) => [t.id, i]));
  const topicName = new Map(topics.map((t) => [t.id, t.name]));
  const withDrafts = new Set(topicLists.flat().map((r) => r.topic_id));
  const topicOptions = topics.filter((t) => withDrafts.has(t.id) || t.id === topicFilter).map((t) => ({ id: t.id, name: t.name }));
  const byTopicOrder = <T extends { topicId: string }>(items: T[]) =>
    items.map((item, i) => ({ item, i })).sort((a, b) => (topicOrder.get(a.item.topicId) ?? 0) - (topicOrder.get(b.item.topicId) ?? 0) || a.i - b.i).map((x) => x.item);

  const params = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const all: Record<string, string | null> = {
      soort: kind === "kaarten" ? null : kind,
      thema: topicFilter,
      controleren: verifyOnly ? "1" : null,
      ...extra,
    };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return p;
  };
  const href = (extra: Record<string, string | null>) => {
    const query = params(extra).toString();
    return query ? `/goedkeuren?${query}` : "/goedkeuren";
  };

  const header = (
    <div className="flex flex-col gap-2.5 border-b border-border px-4 pb-3 pt-2 md:p-4">
      <Segmented
        size="sm"
        label="Soort concept"
        value={kind}
        items={KINDS.map((k, i) => ({
          key: k.key,
          href: href({ soort: k.key === "kaarten" ? null : k.key }),
          label: (
            <>
              {k.label} <span className="tabular-nums">{counts[i]}</span>
            </>
          ),
        }))}
      />
      {topicOptions.length > 1 || topicFilter || verifyCount > 0 || verifyOnly ? (
        <div className="flex min-h-8 items-center justify-between gap-3">
          {topicOptions.length > 1 || topicFilter ? (
            <TopicSelect options={topicOptions} value={topicFilter} base={Object.fromEntries(params({ thema: null }))} />
          ) : (
            <span />
          )}
          {verifyCount > 0 || verifyOnly ? (
            <Link
              href={href({ controleren: verifyOnly ? null : "1" })}
              aria-current={verifyOnly ? "page" : undefined}
              className="rounded-md px-1.5 py-1 text-[13px] font-bold text-warn-text hover:bg-warn-bg aria-[current=page]:bg-warn-bg"
            >
              {verifyCount} te controleren
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  let content: ReactNode;

  if (kind === "kaarten") {
    let q = supabase
      .from("cards")
      .select(
        "id, topic_id, type, front, back, explanation, tags, origin, flag_note, source_locator, source_excerpt, needs_verification, sources(title, chapter, pages), card_objectives(learning_objectives(code, description, sort_order))",
      )
      .eq("status", "draft")
      .order("created_at")
      .order("external_id", { nullsFirst: false })
      .limit(CARD_LIMIT);
    if (topicFilter) q = q.eq("topic_id", topicFilter);
    if (verifyOnly) q = q.eq("needs_verification", true);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const items: DraftCardItem[] = byTopicOrder(
      (data ?? []).map((c) => ({
        id: c.id,
        topicId: c.topic_id,
        topicName: topicName.get(c.topic_id) ?? "",
        type: c.type,
        front: c.front,
        back: c.back,
        explanation: c.explanation,
        tags: c.tags ?? [],
        sourceLocator: c.source_locator,
        sourceExcerpt: c.source_excerpt,
        sourceLabel: sourceLabel(c.sources, c.source_locator),
        origin: c.origin,
        flagNote: c.flag_note,
        needsVerification: c.needs_verification,
        objectives: c.card_objectives
          .map((o) => o.learning_objectives)
          .filter((o): o is NonNullable<typeof o> => !!o)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((o) => ({ code: o.code, description: o.description })),
      })),
    );
    // Sleutel per filter: een ander filter begint met een verse lijst.
    content = <CardTriage key={`${topicFilter}-${verifyOnly}`} items={items} initialId={selectedId} header={header} />;
  } else {
    content = await otherKinds(kind);
  }

  return (
    <div data-wide className="flex flex-col md:h-[calc(100dvh-108px)] md:flex-row">
      <h1 className="sr-only max-md:hidden">Goedkeuren</h1>
      {content}
    </div>
  );

  /** Scripts, casussen en vragen: lijst links, alleen-lezenvoorbeeld rechts, "Openen" voor de volledige controle. */
  async function otherKinds(kind: Exclude<Kind, "kaarten">) {
    type Item = { id: string; topicId: string; title: string; meta: string; verify: boolean; open: string; checkbox?: string };
    let items: Item[] = [];
    let preview: ReactNode = null;
    const sel = (list: { id: string }[]) => list.find((x) => x.id === selectedId)?.id ?? list[0]?.id ?? null;

    if (kind === "scripts") {
      let q = supabase
        .from("illness_scripts")
        .select("id, topic_id, condition, origin, needs_verification, source_locator, epidemiology, pathophysiology, presentation, findings, management, key_discriminators, sources(title, chapter, pages)")
        .eq("status", "draft")
        .order("condition")
        .limit(LIST_LIMIT);
      if (topicFilter) q = q.eq("topic_id", topicFilter);
      if (verifyOnly) q = q.eq("needs_verification", true);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = byTopicOrder((data ?? []).map((s) => ({ ...s, topicId: s.topic_id })));
      items = rows.map((s) => ({
        id: s.id,
        topicId: s.topicId,
        title: s.condition,
        meta: `Illness script · ${ORIGIN_LABELS[s.origin] ?? s.origin}`,
        verify: s.needs_verification,
        open: `/scripts/${s.id}`,
      }));
      const s = rows.find((x) => x.id === sel(rows));
      if (s) {
        // Onderscheidende kenmerken eerst (zoals bij Vergelijken).
        const fields = [...SCRIPT_FIELDS].sort((a, b) => Number(b.key === "key_discriminators") - Number(a.key === "key_discriminators"));
        preview = (
          <Preview
            title={s.condition}
            meta={`${topicName.get(s.topicId) ?? ""} · ${ORIGIN_LABELS[s.origin] ?? s.origin}`}
            source={sourceLabel(s.sources, s.source_locator)}
            verify={s.needs_verification}
            open={`/scripts/${s.id}`}
            note="Openen om te controleren en goed te keuren; daarna komen er scriptkaarten bij."
          >
            <dl className="overflow-hidden rounded-2xl border border-border bg-surface">
              {fields.map((f) => (
                <div key={f.key} className="grid grid-cols-[150px_1fr] border-b border-border-subtle last:border-b-0 lg:grid-cols-[190px_1fr]">
                  <dt className={`bg-surface-sunk px-4 py-3 text-xs font-bold tracking-[.04em] ${f.key === "key_discriminators" ? "text-accent-strong" : "text-muted"}`}>
                    {f.label}
                  </dt>
                  <dd className="prose-card px-4 py-3 text-sm leading-[1.45]">{s[f.key] || <span className="text-muted">–</span>}</dd>
                </div>
              ))}
            </dl>
          </Preview>
        );
      }
    } else if (kind === "casussen") {
      let q = supabase
        .from("cases")
        .select("id, topic_id, title, vignette, question, origin, needs_verification, from_internship")
        .eq("status", "draft")
        .order("created_at")
        .order("external_id", { nullsFirst: false })
        .limit(LIST_LIMIT);
      if (topicFilter) q = q.eq("topic_id", topicFilter);
      if (verifyOnly) q = q.eq("needs_verification", true);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = byTopicOrder((data ?? []).map((c) => ({ ...c, topicId: c.topic_id })));
      items = rows.map((c) => ({
        id: c.id,
        topicId: c.topicId,
        title: c.title,
        meta: `Casus · ${c.from_internship ? "stage" : (ORIGIN_LABELS[c.origin] ?? c.origin)}`,
        verify: c.needs_verification,
        open: `/casussen/${c.id}`,
        checkbox: `${c.title} goedkeuren`,
      }));
      const c = rows.find((x) => x.id === sel(rows));
      if (c) {
        preview = (
          <Preview
            title={c.title}
            meta={`${topicName.get(c.topicId) ?? ""} · ${ORIGIN_LABELS[c.origin] ?? c.origin}`}
            verify={c.needs_verification}
            open={`/casussen/${c.id}`}
            note="De diagnose en de expert-uitwerking zie je bij Openen."
          >
            <div className="rounded-2xl border border-border bg-surface-sunk px-5 py-4">
              <Eyebrow>Vignet</Eyebrow>
              <p className="prose-card mt-2 font-serif text-[17px] leading-[1.6] text-text-2">{c.vignette}</p>
            </div>
            <p className="prose-card text-[15px] font-bold leading-[1.5]">{c.question}</p>
          </Preview>
        );
      }
    } else {
      let q = supabase
        .from("questions")
        .select("id, topic_id, kind, format, stem, options, origin, needs_verification")
        .eq("status", "draft")
        .order("created_at")
        .order("external_id", { nullsFirst: false })
        .limit(LIST_LIMIT);
      if (topicFilter) q = q.eq("topic_id", topicFilter);
      if (verifyOnly) q = q.eq("needs_verification", true);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = byTopicOrder((data ?? []).map((x) => ({ ...x, topicId: x.topic_id })));
      const what = (x: { kind: string; format: string }) => `${x.kind === "pretest" ? "Pretest" : "Toets"} · ${x.format === "mcq" ? "MC" : "open"}`;
      items = rows.map((x) => ({
        id: x.id,
        topicId: x.topicId,
        title: x.stem,
        meta: `${what(x)} · ${ORIGIN_LABELS[x.origin] ?? x.origin}`,
        verify: x.needs_verification,
        open: `/oefentoets/vraag/${x.id}`,
        checkbox: `Vraag goedkeuren: ${x.stem.slice(0, 60)}`,
      }));
      const x = rows.find((r) => r.id === sel(rows));
      if (x) {
        const options = Array.isArray(x.options) ? x.options.filter((o): o is string => typeof o === "string") : [];
        preview = (
          <Preview
            title={null}
            meta={`${topicName.get(x.topicId) ?? ""} · ${what(x)} · ${ORIGIN_LABELS[x.origin] ?? x.origin}`}
            verify={x.needs_verification}
            open={`/oefentoets/vraag/${x.id}`}
            note={x.format === "mcq" ? "Het juiste antwoord en de uitleg zie je bij Openen." : "Het modelantwoord zie je bij Openen."}
          >
            <p className="prose-card font-serif text-xl leading-[1.4]">{x.stem}</p>
            {options.length ? (
              <ol className="space-y-2">
                {options.map((o, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-[15px]">
                    <span className="font-bold text-muted">{String.fromCharCode(65 + i)}</span>
                    <span className="prose-card">{o}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </Preview>
        );
      }
    }

    const selected = items.find((i) => i.id === selectedId)?.id ?? items[0]?.id ?? null;
    const groups: { topicId: string; items: Item[] }[] = [];
    for (const item of items) {
      const g = groups.find((x) => x.topicId === item.topicId);
      if (g) g.items.push(item);
      else groups.push({ topicId: item.topicId, items: [item] });
    }
    const bulk = kind === "casussen" ? { action: approveCases, label: "Geselecteerde casussen goedkeuren" } : kind === "vragen" ? { action: approveQuestions, label: "Geselecteerde vragen goedkeuren" } : null;
    const empty = { scripts: "Geen conceptscripts om na te kijken.", casussen: "Geen conceptcasussen om na te kijken.", vragen: "Geen conceptvragen om na te kijken." }[kind];

    const list = (
      <nav aria-label="Concepten" className="min-h-0 flex-1 overflow-y-auto pb-28 md:pb-0">
        {groups.map((g) => (
          <div key={g.topicId}>
            <Eyebrow className="px-4 pb-1.5 pt-3.5">
              {topicName.get(g.topicId)} · {g.items.length}
            </Eyebrow>
            <ul>
              {g.items.map((item) => {
                const body = (
                  <>
                    <span className="line-clamp-2 text-sm leading-[1.4]">{item.title}</span>
                    <span className="text-xs text-muted">
                      {item.meta}
                      {item.verify ? <span className="font-bold text-warn-text"> · Controleren</span> : null}
                    </span>
                  </>
                );
                return (
                  <li key={item.id} className={`flex items-start gap-3 border-b border-border-subtle px-4 py-[11px] ${item.id === selected ? "md:bg-accent-soft" : ""}`}>
                    {bulk ? <input type="checkbox" name="id" value={item.id} aria-label={item.checkbox} className="mt-0.5 h-5 w-5 shrink-0" /> : null}
                    {/* Laptop: voorbeeld rechts. Telefoon: meteen openen. */}
                    <Link
                      href={href({ id: item.id })}
                      aria-current={item.id === selected ? "true" : undefined}
                      scroll={false}
                      className="hidden min-w-0 flex-1 flex-col gap-1 hover:underline md:flex"
                    >
                      {body}
                    </Link>
                    <Link href={item.open} className="flex min-w-0 flex-1 flex-col gap-1 md:hidden">
                      {body}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {items.length === 0 ? <p className="px-4 py-6 text-sm text-muted">{empty}</p> : null}
      </nav>
    );

    return (
      <>
        <PhoneHeader />
        <div className="flex flex-col md:min-h-0 md:w-[330px] md:shrink-0 md:border-r md:border-border md:bg-surface">
          {header}
          {bulk && items.length ? (
            <form action={bulk.action} className="flex min-h-0 flex-1 flex-col">
              {list}
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 md:static md:z-auto md:p-4">
                <Button className="w-full">{bulk.label}</Button>
              </div>
            </form>
          ) : (
            list
          )}
        </div>
        <section aria-label="Voorbeeld" className="hidden min-h-0 flex-1 overflow-y-auto md:block">
          {preview ?? <p className="p-8 text-center text-muted">{empty}</p>}
        </section>
      </>
    );
  }
}

function Preview({
  title,
  meta,
  source,
  verify,
  open,
  note,
  children,
}: {
  title: string | null;
  meta: string;
  source?: string | null;
  verify: boolean;
  open: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto flex max-w-[760px] flex-col gap-4 px-[30px] py-7">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <span>{meta}</span>
        {source ? <span>· {source}</span> : null}
      </div>
      {title ? <h2 className="font-serif text-[26px] leading-[1.25]">{title}</h2> : null}
      {verify ? (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-warn-text">
          <Badge tone="warn">Controleren</Badge>
          {VERIFY_TEXT}
        </p>
      ) : null}
      {children}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <LinkButton variant="primary" href={open}>
          Openen
        </LinkButton>
        <span className="text-[13px] text-muted">{note}</span>
      </div>
    </article>
  );
}
