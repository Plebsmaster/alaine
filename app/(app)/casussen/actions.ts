"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AiError, runJson } from "@/lib/ai/client";
import { caseFeedbackPrompt, caseHintPrompt, draftCasesPrompt, type CaseForAi } from "@/lib/ai/prompts";
import { caseFeedbackOutput, caseHintOutput, draftCasesOutput, type CaseFeedback } from "@/lib/ai/schemas";
import { requireUser } from "@/lib/auth";
import {
  checkExpertReflection,
  MAX_HINTS,
  selectCases,
  SESSION_MAX,
  SESSION_MIN,
  type ExpertReflection,
} from "@/lib/cases";
import { int, list, optText, text } from "@/lib/forms";
import type { ServerClient } from "@/lib/supabase/server";

export type FormState = { error?: string };

// ---------------------------------------------------------------------------
// Sessie
// ---------------------------------------------------------------------------

export async function startSession(fd: FormData) {
  const { supabase } = await requireUser();
  const n = Math.min(SESSION_MAX, Math.max(SESSION_MIN, int(fd, "n", SESSION_MIN)));
  const [{ data: cases }, { data: attempts }] = await Promise.all([
    supabase.from("cases").select("id, topic_id").eq("status", "active"),
    supabase.from("case_attempts").select("case_id, created_at, self_score").order("created_at", { ascending: false }).limit(5000),
  ]);
  const last = new Map<string, { at: string; score: number | null }>();
  for (const a of attempts ?? []) if (!last.has(a.case_id)) last.set(a.case_id, { at: a.created_at, score: a.self_score });

  const picked = selectCases(
    (cases ?? []).map((c) => ({
      id: c.id,
      topic_id: c.topic_id,
      last_attempt_at: last.get(c.id)?.at ?? null,
      last_score: last.get(c.id)?.score ?? null,
    })),
    n,
    new Date(),
  );
  if (picked.length === 0) redirect("/casussen?leeg=1");
  redirect(`/casussen/sessie?ids=${picked.map((c) => c.id).join(",")}`);
}

const attemptInput = z.object({
  working_diagnosis: z.string().max(500),
  reflection: z
    .array(z.object({ diagnosis: z.string().max(500), supporting: z.string().max(2000), against: z.string().max(2000), missing: z.string().max(2000) }))
    .max(10),
  final_ranking: z.array(z.string().max(500)).max(10),
});
export type AttemptInput = z.infer<typeof attemptInput>;

async function loadCase(supabase: ServerClient, caseId: string) {
  const { data, error } = await supabase
    .from("cases")
    .select("id, topic_id, title, vignette, question, correct_diagnosis, expert_reflection, teaching_points")
    .eq("id", caseId)
    .single();
  if (error) throw new Error("Casus niet gevonden");
  return data;
}

const forAi = (c: Awaited<ReturnType<typeof loadCase>>): CaseForAi => ({
  title: c.title,
  vignette: c.vignette,
  question: c.question,
  correct_diagnosis: c.correct_diagnosis,
  expert_reflection: c.expert_reflection,
  teaching_points: c.teaching_points,
});

/** Stap 3, "Toon mogelijke alternatieven": alleen de namen uit de differentiaal, zonder uitwerking. */
export async function revealAlternativesAction(caseId: string): Promise<string[]> {
  const { supabase } = await requireUser();
  const c = await loadCase(supabase, caseId);
  return (c.expert_reflection as ExpertReflection[]).map((r) => r.diagnosis).sort((a, b) => a.localeCompare(b, "nl"));
}

/** Stap 5: de expert-uitwerking. De client vraagt die pas op na het rangschikken. */
export async function revealExpertAction(caseId: string) {
  const { supabase } = await requireUser();
  const c = await loadCase(supabase, caseId);
  return {
    correct_diagnosis: c.correct_diagnosis,
    expert_reflection: [...(c.expert_reflection as ExpertReflection[])].sort((a, b) => a.rank - b.rank),
    teaching_points: c.teaching_points,
  };
}

export async function caseHintAction(caseId: string, attempt: AttemptInput, n: number) {
  if (n < 1 || n > MAX_HINTS) return { ok: false as const, error: `Maximaal ${MAX_HINTS} hints per casus.` };
  const parsed = attemptInput.safeParse(attempt);
  if (!parsed.success) return { ok: false as const, error: "Ongeldige invoer" };
  const { supabase } = await requireUser();
  const c = await loadCase(supabase, caseId);
  try {
    const out = await runJson({ fn: "case_hint", ...caseHintPrompt({ case: forAi(c), attempt: parsed.data, n }), schema: caseHintOutput, supabase, maxTokens: 2000 });
    return { ok: true as const, hint: out.hint };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    throw e;
  }
}

export async function caseFeedbackAction(caseId: string, attempt: AttemptInput) {
  const parsed = attemptInput.safeParse(attempt);
  if (!parsed.success) return { ok: false as const, error: "Ongeldige invoer" };
  const { supabase } = await requireUser();
  const c = await loadCase(supabase, caseId);
  try {
    const feedback: CaseFeedback = await runJson({ fn: "case_feedback", ...caseFeedbackPrompt({ case: forAi(c), attempt: parsed.data }), schema: caseFeedbackOutput, supabase });
    return { ok: true as const, feedback };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    throw e;
  }
}

const saveInput = attemptInput.extend({
  caseId: z.uuid(),
  sessionId: z.uuid(),
  cued: z.boolean(),
  hints_used: z.number().int().min(0).max(MAX_HINTS),
  correct: z.boolean(),
  self_score: z.number().int().min(1).max(5),
  ai_feedback: z.string().max(20_000).nullable(),
  duration_ms: z.number().int().min(0).max(24 * 3_600_000),
});

/** Stap 6: poging opslaan (met sessie in study_sessions). */
export async function saveAttemptAction(input: z.infer<typeof saveInput>) {
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ongeldige invoer" };
  const { caseId, sessionId, ...a } = parsed.data;
  const { supabase } = await requireUser();
  const { error } = await supabase.from("case_attempts").insert({ case_id: caseId, session_id: sessionId, ...a });
  if (error) return { ok: false as const, error: error.message };

  const now = new Date().toISOString();
  const { data: session } = await supabase.from("study_sessions").select("items").eq("id", sessionId).maybeSingle();
  await supabase
    .from("study_sessions")
    .upsert({ id: sessionId, kind: "cases", started_at: session ? undefined : new Date(Date.now() - a.duration_ms).toISOString(), ended_at: now, items: (session?.items ?? 0) + 1 });
  revalidatePath("/casussen");
  return { ok: true as const };
}

/** Stap 7, "Maak kaart van wat ik miste": een conceptkaart die via Goedkeuren de herhaling in gaat. */
export async function missedCardAction(input: { caseId: string; front: string; back: string; fromAi: boolean }) {
  const front = input.front.trim();
  const back = input.back.trim();
  if (!front || !back) return { ok: false as const, error: "Vul een vraag en een antwoord in." };
  if (front.length > 2000 || back.length > 2000) return { ok: false as const, error: "Maximaal 2.000 tekens per kant." };
  const { supabase } = await requireUser();
  const c = await loadCase(supabase, input.caseId);
  const { error } = await supabase.from("cards").insert({
    topic_id: c.topic_id,
    type: "explain",
    front,
    back,
    tags: ["casus"],
    source_locator: `Casus: ${c.title}`,
    status: "draft",
    origin: input.fromAi ? "ai" : "manual",
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/goedkeuren");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Beheer
// ---------------------------------------------------------------------------

const ROWS = 5;

function caseFields(fd: FormData) {
  const reflection: ExpertReflection[] = [];
  for (let i = 0; i < ROWS; i++) {
    const diagnosis = text(fd, `d${i}_diagnosis`);
    if (!diagnosis) continue;
    reflection.push({
      diagnosis,
      supporting: text(fd, `d${i}_supporting`),
      against: text(fd, `d${i}_against`),
      missing: text(fd, `d${i}_missing`),
      rank: reflection.length + 1,
    });
  }
  const correct = reflection[0]?.diagnosis ?? "";
  const problem = checkExpertReflection(correct, reflection);
  if (problem) throw new Error(problem);
  const title = text(fd, "title");
  const vignette = text(fd, "vignette");
  if (!title || !vignette) throw new Error("Titel en vignet zijn verplicht.");
  if (vignette.length > 2000) throw new Error("Vignet: maximaal 2.000 tekens.");
  const difficulty = int(fd, "difficulty", 2);
  return {
    title,
    vignette,
    question: text(fd, "question") || "Wat is je werkdiagnose?",
    correct_diagnosis: correct,
    expert_reflection: reflection,
    teaching_points: optText(fd, "teaching_points"),
    difficulty: Math.min(3, Math.max(1, difficulty)),
  };
}

async function setObjectives(supabase: ServerClient, caseId: string, ids: string[]) {
  await supabase.from("case_objectives").delete().eq("case_id", caseId);
  if (ids.length) {
    const { error } = await supabase.from("case_objectives").insert(ids.map((objective_id) => ({ case_id: caseId, objective_id })));
    if (error) throw new Error(error.message);
  }
}

/** Nieuwe casus. Uit de stage: direct actief (SPEC 5.6). */
export async function createCase(fd: FormData) {
  const { supabase } = await requireUser();
  const internship = fd.get("from_internship") === "1";
  const { data, error } = await supabase
    .from("cases")
    .insert({
      ...caseFields(fd),
      topic_id: text(fd, "topic_id"),
      from_internship: internship,
      status: internship ? "active" : "draft",
      origin: "manual",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/casussen/${data.id}?opgeslagen=1`);
}

export async function updateCase(fd: FormData) {
  const { supabase } = await requireUser();
  const id = text(fd, "id");
  const fields = caseFields(fd);
  const status = fd.get("intent") === "approve" ? { status: "active" } : {};
  const { error } = await supabase.from("cases").update({ ...fields, ...status }).eq("id", id);
  if (error) throw new Error(error.message);
  await setObjectives(supabase, id, list(fd, "objectives"));
  revalidatePath("/goedkeuren");
  redirect(`/casussen/${id}?opgeslagen=1`);
}

export async function setCaseStatus(fd: FormData) {
  const { supabase } = await requireUser();
  const status = text(fd, "status");
  if (!["active", "draft", "archived"].includes(status)) throw new Error("Onbekende status");
  const { error } = await supabase.from("cases").update({ status }).eq("id", text(fd, "id"));
  if (error) throw new Error(error.message);
  revalidatePath(`/casussen/${text(fd, "id")}`);
}

export async function deleteCase(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("cases").delete().eq("id", text(fd, "id"));
  if (error) throw new Error(error.message);
  redirect("/casussen");
}

/** Bulk goedkeuren mag voor casussen (niet voor kaarten). */
export async function approveCases(fd: FormData) {
  const { supabase } = await requireUser();
  const ids = list(fd, "id");
  if (ids.length) {
    const { error } = await supabase.from("cases").update({ status: "active" }).in("id", ids).eq("status", "draft");
    if (error) throw new Error(error.message);
  }
  revalidatePath("/goedkeuren");
}

/** draft_cases: AI maakt conceptcasussen uit de goedgekeurde scripts van een thema. */
export async function draftCasesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const topicId = text(fd, "topic_id");
  const n = Math.min(8, Math.max(1, int(fd, "n", 5)));
  const [{ data: topic }, { data: scripts }, { data: objectives }] = await Promise.all([
    supabase.from("topics").select("name").eq("id", topicId).single(),
    supabase
      .from("illness_scripts")
      .select("condition, epidemiology, pathophysiology, presentation, findings, management, key_discriminators, similar_conditions")
      .eq("topic_id", topicId)
      .eq("status", "active"),
    supabase.from("learning_objectives").select("id, code, description").eq("topic_id", topicId).order("sort_order"),
  ]);
  if (!topic) return { error: "Kies een thema." };
  if (!scripts || scripts.length < 2) {
    return { error: "Keur eerst minstens twee illness scripts van dit thema goed; de AI maakt casussen vanuit die scripts." };
  }

  let result;
  try {
    result = await runJson({
      fn: "draft_cases",
      ...draftCasesPrompt({ topic: topic.name, n, scripts, objectives: objectives ?? [] }),
      schema: draftCasesOutput,
      supabase,
    });
  } catch (e) {
    if (e instanceof AiError) return { error: e.message };
    throw e;
  }

  const known = new Set((objectives ?? []).map((o) => o.id));
  let saved = 0;
  for (const c of result.cases) {
    const rows = [...c.expert_reflection].sort((a, b) => a.rank - b.rank);
    if (checkExpertReflection(c.correct_diagnosis, rows)) continue; // ongeldige casus overslaan
    const { data, error } = await supabase
      .from("cases")
      .insert({
        topic_id: topicId,
        title: c.title.trim(),
        vignette: c.vignette.trim(),
        correct_diagnosis: c.correct_diagnosis.trim(),
        expert_reflection: rows,
        teaching_points: c.teaching_points.trim() || null,
        difficulty: Math.min(3, Math.max(1, c.difficulty)),
        status: "draft",
        origin: "ai",
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    await setObjectives(supabase, data.id, c.objectives.filter((o) => known.has(o)));
    saved++;
  }
  if (saved === 0) return { error: "De AI leverde geen bruikbare casussen op. Probeer het opnieuw." };
  revalidatePath("/goedkeuren");
  redirect(`/goedkeuren?thema=${topicId}`);
}
