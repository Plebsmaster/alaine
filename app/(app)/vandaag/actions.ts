"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { countDueTomorrow } from "@/lib/data/review";
import { getSettings } from "@/lib/data/settings";
import { AiError, runJson } from "@/lib/ai/client";
import { explainCheckPrompt, stopcheckPrompt } from "@/lib/ai/prompts";
import { explainCheckOutput, stopcheckOutput, type ExplainCheck } from "@/lib/ai/schemas";
import { rate, type Schedule } from "@/lib/fsrs";

const rateInput = z.object({
  cardId: z.uuid(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  reviewedAt: z.iso.datetime(),
  durationMs: z.number().int().min(0).max(3_600_000).nullable(),
  answerText: z.string().max(5000).nullable(),
  sessionId: z.uuid(),
  aiFeedback: z.string().max(10_000).nullable().optional(),
  errorType: z.enum(["knowledge_gap", "reasoning_error", "slip"]).nullable().optional(),
});

export type RateInput = z.infer<typeof rateInput>;
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Slaat een beoordeling op. De server rekent de planning zelf uit vanaf de stand
 * in de database; de client doet dat alleen voor de weergave.
 */
export async function rateCardAction(input: RateInput): Promise<ActionResult> {
  const parsed = rateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ongeldige invoer" };
  const { cardId, rating, reviewedAt, durationMs, answerText, sessionId, aiFeedback, errorType } = parsed.data;
  const { supabase } = await requireUser();

  const [{ data: row, error }, settings] = await Promise.all([
    supabase.from("card_schedule").select("*").eq("card_id", cardId).maybeSingle(),
    getSettings(supabase),
  ]);
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: "Kaart niet gevonden" };

  // Reviewmoment van de client (stabiel bij een nieuwe poging, dus idempotent), maar
  // niet ver in de toekomst en niet vóór de vorige herhaling.
  let at = Math.min(new Date(reviewedAt).getTime(), Date.now() + 2 * 60_000);
  if (row.last_review) at = Math.max(at, new Date(row.last_review).getTime());
  const schedule: Schedule = { ...row };
  const { schedule: next, log } = rate(schedule, rating, new Date(at), settings);

  const { error: rpcError } = await supabase.rpc("rate_card", {
    p_card_id: cardId,
    p_schedule: next,
    p_log: log,
    p_duration_ms: durationMs ?? undefined,
    p_answer_text: answerText ?? undefined,
    p_session_id: sessionId,
    p_ai_feedback: aiFeedback ?? undefined,
    p_error_type: errorType ?? undefined,
  });
  if (rpcError) return { ok: false, error: rpcError.message };
  return { ok: true };
}

export async function suspendCardAction(cardId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("cards").update({ status: "suspended" }).eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/goedkeuren");
  return { ok: true };
}

export async function flagCardAction(cardId: string, note: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("cards")
    .update({ status: "draft", flag_note: note.trim().slice(0, 2000) || "Klopt niet" })
    .eq("id", cardId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/goedkeuren");
  return { ok: true };
}

export async function tomorrowAction(): Promise<{ due: number; fresh: number }> {
  const { supabase } = await requireUser();
  const settings = await getSettings(supabase);
  const [due, { count }] = await Promise.all([
    countDueTomorrow(supabase, settings),
    supabase.from("review_queue").select("card_id", { count: "exact", head: true }).eq("state", 0).eq("reps", 0),
  ]);
  return { due, fresh: Math.min(settings.max_new_per_day, count ?? 0) };
}

const checkInput = z.object({
  cardId: z.uuid(),
  answer: z.string().trim().min(1).max(5000),
  stage: z.union([z.literal(1), z.literal(2)]),
  previous: z
    .object({ answer: z.string().max(5000), verdict: z.string(), hint: z.string().nullable(), recovery_question: z.string().nullable() })
    .nullable(),
});

/**
 * explain_check (A3): nakijken vóórdat de student het antwoord ziet. Bij deels of fout
 * eerst alleen een hint en herstelvraag; pas na stap 2 de volledige uitleg.
 */
export async function explainCheckAction(input: z.infer<typeof checkInput>) {
  const parsed = checkInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Typ eerst een antwoord." };
  const { cardId, answer, stage, previous } = parsed.data;
  const { supabase } = await requireUser();
  const { data: card, error } = await supabase
    .from("cards")
    .select("type, front, back, explanation, source_locator, sources(title, chapter)")
    .eq("id", cardId)
    .single();
  if (error) return { ok: false as const, error: "Kaart niet gevonden" };
  // De app bewaart geen boektekst; de "bron" is de uitwerking op de kaart plus de bronvermelding.
  const sourceExcerpt = [
    card.explanation,
    card.sources ? `Bron: ${card.sources.title}${card.sources.chapter ? `, h. ${card.sources.chapter}` : ""}` : null,
    card.source_locator,
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const check: ExplainCheck = await runJson({
      fn: "explain_check",
      ...explainCheckPrompt({
        stage,
        card: { type: card.type, front: card.front, back: card.back, explanation: card.explanation },
        sourceExcerpt: sourceExcerpt || "Geen bronfragment; gebruik de achterkant van de kaart.",
        answer,
        previous,
      }),
      schema: explainCheckOutput,
      supabase,
      maxTokens: 4000,
    });
    // Vangrail: bij stap 1 en een niet-correct antwoord nooit de uitleg doorgeven.
    if (stage === 1 && check.verdict !== "correct") return { ok: true as const, check: { ...check, explanation: null } };
    return { ok: true as const, check };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Geen verbinding met de AI. Probeer het opnieuw." };
  }
}

const stopItems = z
  .array(z.object({ cardId: z.uuid(), rating: z.number().int().min(1).max(4), errorType: z.string().nullable(), answer: z.string().max(5000).nullable() }))
  .min(1)
  .max(50);

/** Stopcheck (A8): maximaal vijf punten om te onthouden, op basis van de fouten van deze sessie. */
export async function stopcheckAction(items: z.infer<typeof stopItems>) {
  const parsed = stopItems.safeParse(items);
  if (!parsed.success) return { ok: false as const, error: "Geen fouten om samen te vatten." };
  const { supabase } = await requireUser();
  const { data: cards } = await supabase
    .from("cards")
    .select("id, front, back")
    .in("id", parsed.data.map((i) => i.cardId));
  const byId = new Map((cards ?? []).map((c) => [c.id, c]));
  const errors = parsed.data
    .filter((i) => byId.has(i.cardId))
    .map((i) => ({
      item_ref: i.cardId,
      vraag: byId.get(i.cardId)!.front,
      juist_antwoord: byId.get(i.cardId)!.back,
      beoordeling: i.rating === 1 ? "Opnieuw" : "Moeilijk",
      fouttype: i.errorType,
      antwoord_student: i.answer,
    }));
  try {
    const out = await runJson({ fn: "stopcheck", ...stopcheckPrompt(errors), schema: stopcheckOutput, supabase, maxTokens: 4000 });
    return { ok: true as const, points: out.points.slice(0, 5) };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Geen verbinding met de AI. Probeer het opnieuw." };
  }
}

/** "Maak kaart" bij een stopcheckpunt: conceptkaart in het thema van de kaart waar het over gaat. */
export async function stopcheckCardAction(input: { cardId: string; front: string; back: string }) {
  const front = input.front.trim();
  const back = input.back.trim();
  if (!front || !back) return { ok: false as const, error: "Vul een vraag en een antwoord in." };
  if (front.length > 2000 || back.length > 2000) return { ok: false as const, error: "Maximaal 2.000 tekens per kant." };
  const { supabase } = await requireUser();
  const { data: ref } = await supabase.from("cards").select("topic_id, source_id").eq("id", input.cardId).maybeSingle();
  if (!ref) return { ok: false as const, error: "Kaart niet gevonden" };
  const { error } = await supabase.from("cards").insert({
    topic_id: ref.topic_id,
    source_id: ref.source_id,
    type: "explain",
    front,
    back,
    tags: ["stopcheck"],
    status: "draft",
    origin: "ai",
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/goedkeuren");
  return { ok: true as const };
}
