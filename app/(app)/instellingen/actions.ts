"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { RETENTION_MAX, RETENTION_MIN } from "@/lib/fsrs";
import {
  applyImport,
  checkReferences,
  loadExisting,
  parseImport,
  planImport,
  summarize,
  type ImportError,
  type ImportSummary,
} from "@/lib/import/importer";
import type { ImportBundle } from "@/lib/import/schema";
import { isValidTimeZone } from "@/lib/time";

export type SettingsState = { ok?: boolean; message?: string };

export async function saveSettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const { supabase } = await requireUser();
  const retention = Number(String(fd.get("desired_retention")).replace(",", "."));
  const maxNew = Number(fd.get("max_new_per_day"));
  const timezone = String(fd.get("timezone") ?? "");
  if (!(retention >= RETENTION_MIN && retention <= RETENTION_MAX)) {
    return { ok: false, message: `Retentie moet tussen ${RETENTION_MIN} en ${RETENTION_MAX} liggen.` };
  }
  if (!Number.isInteger(maxNew) || maxNew < 0 || maxNew > 200) {
    return { ok: false, message: "Nieuwe kaarten per dag: 0 tot 200." };
  }
  if (!isValidTimeZone(timezone)) return { ok: false, message: "Onbekende tijdzone." };
  const { error } = await supabase
    .from("settings")
    .upsert({ desired_retention: retention, max_new_per_day: maxNew, timezone }, { onConflict: "user_id" });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/vandaag");
  return { ok: true, message: "Opgeslagen." };
}

export type ImportResult =
  | { ok: true; summary: ImportSummary; applied: boolean }
  | { ok: false; errors: ImportError[] };

function warningsFor(bundle: ImportBundle): string[] {
  const withImage = bundle.cards.filter((c) => c.image).length;
  return withImage
    ? [`${withImage} kaart(en) hebben een afbeelding. Afbeeldingen worden alleen geüpload via "npm run import"; hier worden ze overgeslagen.`]
    : [];
}

async function prepare(json: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { ok: false as const, errors: [{ path: "(bestand)", message: `Geen geldige JSON: ${(e as Error).message}` }] };
  }
  const parsed = parseImport(raw);
  if (!parsed.ok) return parsed;
  const { supabase } = await requireUser();
  const existing = await loadExisting(supabase);
  const errors = checkReferences(parsed.bundle, existing);
  if (errors.length) return { ok: false as const, errors };
  return { ok: true as const, bundle: parsed.bundle, existing, supabase };
}

/** Alleen valideren en tonen wat er zou gebeuren (dry run). */
export async function previewImport(json: string): Promise<ImportResult> {
  const p = await prepare(json);
  if (!p.ok) return p;
  const results = planImport(p.bundle, p.existing);
  return { ok: true, applied: false, summary: summarize(results, p.bundle, p.existing, warningsFor(p.bundle)) };
}

export async function runImport(json: string): Promise<ImportResult> {
  const p = await prepare(json);
  if (!p.ok) return p;
  try {
    const results = await applyImport(p.supabase, p.bundle);
    revalidatePath("/", "layout");
    return { ok: true, applied: true, summary: summarize(results, p.bundle, p.existing, warningsFor(p.bundle)) };
  } catch (e) {
    return { ok: false, errors: [{ path: "(database)", message: (e as Error).message }] };
  }
}
