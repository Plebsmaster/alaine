"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AiError, runJson } from "@/lib/ai/client";
import { DRAFT_CARD_TYPES, draftCardsPrompt, MAX_SOURCE_WORDS, wordCount, type DraftCardType } from "@/lib/ai/prompts";
import { draftCardsOutput } from "@/lib/ai/schemas";
import { requireUser } from "@/lib/auth";
import { int, list, optText, text } from "@/lib/forms";

export async function createObjective(fd: FormData) {
  const { supabase } = await requireUser();
  const topicId = text(fd, "topic_id");
  const description = text(fd, "description");
  if (!description) throw new Error("Omschrijving is verplicht");
  const { error } = await supabase.from("learning_objectives").insert({
    topic_id: topicId,
    code: optText(fd, "code"),
    description,
    sort_order: int(fd, "sort_order"),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/thema/${topicId}`);
}

export async function updateObjective(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("learning_objectives")
    .update({ code: optText(fd, "code"), description: text(fd, "description"), sort_order: int(fd, "sort_order") })
    .eq("id", text(fd, "id"));
  if (error) throw new Error(error.message);
  revalidatePath(`/thema/${text(fd, "topic_id")}`);
}

export async function deleteObjective(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("learning_objectives").delete().eq("id", text(fd, "id"));
  if (error) throw new Error(error.message);
  revalidatePath(`/thema/${text(fd, "topic_id")}`);
}

export type DraftCardsState = { error?: string };

/** draft_cards: AI maakt conceptkaarten uit geplakte brontekst. Alles komt binnen als concept. */
export async function draftCardsAction(_prev: DraftCardsState, fd: FormData): Promise<DraftCardsState> {
  const { supabase } = await requireUser();
  const topicId = text(fd, "topic_id");
  const sourceText = text(fd, "source_text");
  const types = list(fd, "types").filter((t): t is DraftCardType => (DRAFT_CARD_TYPES as readonly string[]).includes(t));
  const max = Math.min(30, Math.max(1, int(fd, "max", 15)));
  if (!sourceText) return { error: "Plak de brontekst." };
  if (wordCount(sourceText) > MAX_SOURCE_WORDS) {
    return { error: `De brontekst is te lang (max. ${MAX_SOURCE_WORDS.toLocaleString("nl-NL")} woorden). Plak één paragraaf of hoofdstukdeel per keer.` };
  }
  if (types.length === 0) return { error: "Kies minstens één kaarttype." };

  const [{ data: topic }, { data: objectives }] = await Promise.all([
    supabase.from("topics").select("name").eq("id", topicId).single(),
    supabase.from("learning_objectives").select("id, code, description").eq("topic_id", topicId).order("sort_order"),
  ]);
  if (!topic) return { error: "Thema niet gevonden." };
  if (!objectives || objectives.length === 0) {
    return { error: "Voeg eerst de leerdoelen van dit thema toe; de AI koppelt elke kaart aan een leerdoel." };
  }

  let result;
  try {
    result = await runJson({
      fn: "draft_cards",
      ...draftCardsPrompt({ topic: topic.name, objectives, sourceText, types, max }),
      schema: draftCardsOutput,
      supabase,
    });
  } catch (e) {
    if (e instanceof AiError) return { error: e.message };
    throw e;
  }

  const known = new Set(objectives.map((o) => o.id));
  const sourceId = optText(fd, "source_id");
  const locator = optText(fd, "source_locator");
  let saved = 0;
  for (const c of result.cards.slice(0, max)) {
    const objs = c.objectives.filter((o) => known.has(o));
    if (objs.length === 0 || !types.includes(c.type)) continue; // geen leerdoel of ander type: overslaan
    const { data, error } = await supabase
      .from("cards")
      .insert({
        topic_id: topicId,
        source_id: sourceId,
        type: c.type,
        front: c.front.trim(),
        back: c.back.trim(),
        explanation: c.explanation.trim() || null,
        source_locator: c.source_locator.trim() || locator,
        needs_verification: c.needs_verification,
        status: "draft",
        origin: "ai",
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    await supabase.from("card_objectives").insert(objs.map((objective_id) => ({ card_id: data.id, objective_id })));
    saved++;
  }
  if (saved === 0) return { error: "De AI leverde geen bruikbare kaarten op (elke kaart moet bij een leerdoel horen). Probeer een ander stuk tekst." };
  revalidatePath("/goedkeuren");
  redirect(`/goedkeuren?thema=${topicId}`);
}
