"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { countDueTomorrow } from "@/lib/data/review";
import { getSettings } from "@/lib/data/settings";
import { AiError, runJson } from "@/lib/ai/client";
import { explainFeedbackPrompt } from "@/lib/ai/prompts";
import { explainFeedbackOutput, type ExplainFeedback } from "@/lib/ai/schemas";
import { rate, type Schedule } from "@/lib/fsrs";

const rateInput = z.object({
  cardId: z.uuid(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  reviewedAt: z.iso.datetime(),
  durationMs: z.number().int().min(0).max(3_600_000).nullable(),
  answerText: z.string().max(5000).nullable(),
  sessionId: z.uuid(),
  aiFeedback: z.string().max(10_000).nullable().optional(),
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
  const { cardId, rating, reviewedAt, durationMs, answerText, sessionId, aiFeedback } = parsed.data;
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

/**
 * explain_feedback: feedback op een getypt antwoord. De knop staat pas in beeld nadat
 * de student het antwoord heeft getoond; de student kiest daarna zelf de beoordeling.
 */
export async function explainFeedbackAction(cardId: string, answer: string) {
  const parsed = z.object({ cardId: z.uuid(), answer: z.string().trim().min(1).max(5000) }).safeParse({ cardId, answer });
  if (!parsed.success) return { ok: false as const, error: "Typ eerst een antwoord." };
  const { supabase } = await requireUser();
  const { data: card, error } = await supabase
    .from("cards")
    .select("front, back, explanation, source_locator, sources(title, chapter, notes)")
    .eq("id", parsed.data.cardId)
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
    const feedback: ExplainFeedback = await runJson({
      fn: "explain_feedback",
      ...explainFeedbackPrompt({
        card: { front: card.front, back: card.back, explanation: card.explanation },
        sourceExcerpt: sourceExcerpt || "Geen bronfragment; gebruik de achterkant van de kaart.",
        answer: parsed.data.answer,
      }),
      schema: explainFeedbackOutput,
      supabase,
      maxTokens: 4000,
    });
    return { ok: true as const, feedback };
  } catch (e) {
    if (e instanceof AiError) return { ok: false as const, error: e.message };
    return { ok: false as const, error: "Geen verbinding met de AI. Probeer het opnieuw." };
  }
}
