// Importer volgens docs/IMPORT_FORMAT.md.
// 1. parseImport: zod + dubbele ids        (puur)
// 2. checkReferences: bestaan alle verwijzingen (puur, met de huidige database-stand)
// 3. planImport: wat wordt nieuw/bijgewerkt/overgeslagen (puur; ook voor --dry-run)
// 4. applyImport: één transactie in Postgres via rpc('import_bundle')
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONTENT_KINDS,
  importSchema,
  STRUCTURE_KINDS,
  type ContentKind,
  type ImportBundle,
  type ImportKind,
} from "./schema";

export type ImportError = { path: string; message: string };

export type ExistingState = {
  modules: Set<string>;
  topics: Map<string, string>; // external_id -> naam
  objectives: Set<string>;
  sources: Set<string>;
  // external_id -> status
  illness_scripts: Map<string, string>;
  cards: Map<string, string>;
  cases: Map<string, string>;
  questions: Map<string, string>;
};

export type Outcome = "new" | "updated" | "skipped";
export type ItemResult = {
  kind: ImportKind;
  external_id: string;
  topic: string | null;
  outcome: Outcome;
};

export type Counts = Record<Outcome, number>;
export type ImportSummary = {
  general: Record<"modules" | "sources", Counts>;
  topics: { external_id: string; name: string; counts: Partial<Record<ImportKind, Counts>> }[];
  conflicts: ItemResult[];
  warnings: string[];
};

export const KIND_LABELS: Record<ImportKind, string> = {
  modules: "modules",
  topics: "thema's",
  objectives: "leerdoelen",
  sources: "bronnen",
  illness_scripts: "illness scripts",
  cards: "kaarten",
  cases: "casussen",
  questions: "vragen",
};

export function emptyExisting(): ExistingState {
  return {
    modules: new Set(),
    topics: new Map(),
    objectives: new Set(),
    sources: new Set(),
    illness_scripts: new Map(),
    cards: new Map(),
    cases: new Map(),
    questions: new Map(),
  };
}

/** ["cards", 12, "front"] -> "cards[12].front" */
export function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((p, i) => (typeof p === "number" ? `[${p}]` : `${i === 0 ? "" : "."}${String(p)}`))
    .join("");
}

export function parseImport(
  raw: unknown,
): { ok: true; bundle: ImportBundle } | { ok: false; errors: ImportError[] } {
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({ path: formatPath(i.path) || "(bestand)", message: i.message })),
    };
  }
  const errors: ImportError[] = [];
  for (const kind of [...STRUCTURE_KINDS, ...CONTENT_KINDS]) {
    const seen = new Map<string, number>();
    parsed.data[kind].forEach((item, i) => {
      const first = seen.get(item.external_id);
      if (first !== undefined) {
        errors.push({
          path: `${kind}[${i}].external_id`,
          message: `"${item.external_id}" staat al bij ${kind}[${first}]`,
        });
      } else {
        seen.set(item.external_id, i);
      }
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true, bundle: parsed.data };
}

export function checkReferences(bundle: ImportBundle, existing: ExistingState): ImportError[] {
  const errors: ImportError[] = [];
  const known = {
    module: new Set([...existing.modules, ...bundle.modules.map((m) => m.external_id)]),
    topic: new Set([...existing.topics.keys(), ...bundle.topics.map((t) => t.external_id)]),
    objective: new Set([...existing.objectives, ...bundle.objectives.map((o) => o.external_id)]),
    source: new Set([...existing.sources, ...bundle.sources.map((s) => s.external_id)]),
  };
  const need = (set: Set<string>, id: string | null | undefined, path: string, what: string) => {
    if (id && !set.has(id)) errors.push({ path, message: `${what} "${id}" bestaat niet in het bestand of de database` });
  };

  bundle.topics.forEach((t, i) => need(known.module, t.module, `topics[${i}].module`, "Module"));
  bundle.objectives.forEach((o, i) => need(known.topic, o.topic, `objectives[${i}].topic`, "Thema"));
  for (const kind of CONTENT_KINDS) {
    bundle[kind].forEach((item, i) => {
      need(known.topic, item.topic, `${kind}[${i}].topic`, "Thema");
      need(known.source, item.source, `${kind}[${i}].source`, "Bron");
      if ("objectives" in item) {
        item.objectives.forEach((o, j) =>
          need(known.objective, o, `${kind}[${i}].objectives[${j}]`, "Leerdoel"),
        );
      }
    });
  }
  return errors;
}

export function planImport(bundle: ImportBundle, existing: ExistingState): ItemResult[] {
  const results: ItemResult[] = [];
  const structure: [Exclude<ImportKind, ContentKind>, { has(id: string): boolean }][] = [
    ["modules", existing.modules],
    ["topics", existing.topics],
    ["objectives", existing.objectives],
    ["sources", existing.sources],
  ];
  for (const [kind, have] of structure) {
    for (const item of bundle[kind]) {
      results.push({
        kind,
        external_id: item.external_id,
        topic: kind === "topics" ? item.external_id : "topic" in item ? item.topic : null,
        outcome: have.has(item.external_id) ? "updated" : "new",
      });
    }
  }
  for (const kind of CONTENT_KINDS) {
    for (const item of bundle[kind]) {
      const status = existing[kind].get(item.external_id);
      results.push({
        kind,
        external_id: item.external_id,
        topic: item.topic,
        outcome: status === undefined ? "new" : status === "draft" ? "updated" : "skipped",
      });
    }
  }
  return results;
}

const zero = (): Counts => ({ new: 0, updated: 0, skipped: 0 });

export function summarize(
  results: ItemResult[],
  bundle: ImportBundle,
  existing: ExistingState,
  warnings: string[] = [],
): ImportSummary {
  const names = new Map(existing.topics);
  for (const t of bundle.topics) names.set(t.external_id, t.name);

  const general = { modules: zero(), sources: zero() };
  const topics = new Map<string, ImportSummary["topics"][number]>();
  for (const r of results) {
    if (r.kind === "modules" || r.kind === "sources") {
      general[r.kind][r.outcome] += 1;
      continue;
    }
    if (!r.topic) continue;
    let entry = topics.get(r.topic);
    if (!entry) {
      entry = { external_id: r.topic, name: names.get(r.topic) ?? r.topic, counts: {} };
      topics.set(r.topic, entry);
    }
    const counts = (entry.counts[r.kind] ??= zero());
    counts[r.outcome] += 1;
  }
  return {
    general,
    topics: [...topics.values()],
    conflicts: results.filter((r) => r.outcome === "skipped"),
    warnings,
  };
}

export function formatSummary(s: ImportSummary): string {
  const fmt = (c: Counts) => `${c.new} nieuw, ${c.updated} bijgewerkt, ${c.skipped} overgeslagen`;
  const lines: string[] = [];
  lines.push(`Modules: ${fmt(s.general.modules)}`);
  lines.push(`Bronnen: ${fmt(s.general.sources)}`);
  for (const t of s.topics) {
    lines.push("", `Thema: ${t.name} (${t.external_id})`);
    for (const [kind, c] of Object.entries(t.counts) as [ImportKind, Counts][]) {
      if (kind === "topics") continue;
      lines.push(`  ${KIND_LABELS[kind]}: ${fmt(c)}`);
    }
  }
  if (s.conflicts.length) {
    lines.push("", `Conflicten (al actief, niet overschreven): ${s.conflicts.length}`);
    for (const c of s.conflicts) lines.push(`  ${KIND_LABELS[c.kind]}: ${c.external_id}`);
  }
  if (s.warnings.length) lines.push("", ...s.warnings.map((w) => `Let op: ${w}`));
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const PAGE = 1000;

async function selectAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  userId?: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select(columns).not("external_id", "is", null);
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q.order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

/**
 * Huidige stand in de database. Met de client van de ingelogde gebruiker filtert
 * RLS al op eigen rijen; met de service role geef je `userId` mee.
 */
export async function loadExisting(supabase: SupabaseClient, userId?: string): Promise<ExistingState> {
  type Row = { external_id: string; status?: string; name?: string };
  const [modules, topics, objectives, sources, scripts, cards, cases, questions] = await Promise.all([
    selectAll<Row>(supabase, "modules", "external_id", userId),
    selectAll<Row>(supabase, "topics", "external_id, name", userId),
    selectAll<Row>(supabase, "learning_objectives", "external_id", userId),
    selectAll<Row>(supabase, "sources", "external_id", userId),
    selectAll<Row>(supabase, "illness_scripts", "external_id, status", userId),
    selectAll<Row>(supabase, "cards", "external_id, status", userId),
    selectAll<Row>(supabase, "cases", "external_id, status", userId),
    selectAll<Row>(supabase, "questions", "external_id, status", userId),
  ]);
  const statusMap = (rows: Row[]) => new Map(rows.map((r) => [r.external_id, r.status ?? "draft"]));
  return {
    modules: new Set(modules.map((r) => r.external_id)),
    topics: new Map(topics.map((r) => [r.external_id, r.name ?? r.external_id])),
    objectives: new Set(objectives.map((r) => r.external_id)),
    sources: new Set(sources.map((r) => r.external_id)),
    illness_scripts: statusMap(scripts),
    cards: statusMap(cards),
    cases: statusMap(cases),
    questions: statusMap(questions),
  };
}

/** Payload voor rpc('import_bundle'): `image` eruit, eventueel `image_path` erin. */
export function toPayload(bundle: ImportBundle, imagePaths: Map<string, string> = new Map()) {
  return {
    ...bundle,
    cards: bundle.cards.map((card) => {
      const { image, ...rest } = card;
      void image; // afbeeldingen lopen via image_path (alleen het lokale script uploadt)
      return { ...rest, image_path: imagePaths.get(card.external_id) ?? null };
    }),
  };
}

/** Voert de import uit in één transactie. Geeft per item de uitkomst terug. */
export async function applyImport(
  supabase: SupabaseClient,
  bundle: ImportBundle,
  opts: { userId?: string; imagePaths?: Map<string, string> } = {},
): Promise<ItemResult[]> {
  const { data, error } = await supabase.rpc("import_bundle", {
    p_payload: toPayload(bundle, opts.imagePaths),
    ...(opts.userId ? { p_user_id: opts.userId } : {}),
  });
  if (error) throw new Error(`Import mislukt, er is niets opgeslagen: ${error.message}`);
  return data as ItemResult[];
}
