"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { newSchedule } from "@/lib/fsrs";
import { csv, list, optText, safeReturn, text } from "@/lib/forms";
import { CARD_TYPES } from "@/lib/import/schema";
import type { ServerClient } from "@/lib/supabase/server";

type CardType = (typeof CARD_TYPES)[number];

function cardFields(fd: FormData) {
  const type = text(fd, "type") as CardType;
  if (!CARD_TYPES.includes(type)) throw new Error("Onbekend kaarttype");
  const front = text(fd, "front");
  const back = text(fd, "back");
  if (!front || !back) throw new Error("Voor- en achterkant zijn verplicht");
  if (front.length > 2000 || back.length > 2000) throw new Error("Maximaal 2.000 tekens per kant");
  return {
    type,
    front,
    back,
    explanation: optText(fd, "explanation"),
    source_locator: optText(fd, "source_locator"),
    tags: csv(fd, "tags"),
    needs_verification: fd.get("needs_verification") === "on",
  };
}

async function setObjectives(supabase: ServerClient, cardId: string, objectiveIds: string[]) {
  const del = await supabase.from("card_objectives").delete().eq("card_id", cardId);
  if (del.error) throw new Error(del.error.message);
  if (objectiveIds.length === 0) return;
  const ins = await supabase
    .from("card_objectives")
    .insert(objectiveIds.map((objective_id) => ({ card_id: cardId, objective_id })));
  if (ins.error) throw new Error(ins.error.message);
}

async function activate(supabase: ServerClient, cardId: string) {
  const { data, error } = await supabase.from("cards").select("front, back, explanation").eq("id", cardId).single();
  if (error) throw new Error(error.message);
  const rpc = await supabase.rpc("approve_card", {
    p_card_id: cardId,
    p_front: data.front,
    p_back: data.back,
    p_explanation: data.explanation ?? "",
    p_schedule: newSchedule(new Date()),
  });
  if (rpc.error) throw new Error(rpc.error.message);
}

/** Handmatig gemaakte kaart: door de gebruiker zelf geschreven, dus mag direct actief. */
export async function createCard(fd: FormData) {
  const { supabase } = await requireUser();
  const topicId = text(fd, "topic_id");
  const { data, error } = await supabase
    .from("cards")
    .insert({ ...cardFields(fd), topic_id: topicId, status: "draft", origin: "manual" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await setObjectives(supabase, data.id, list(fd, "objectives"));
  if (fd.get("activate") === "on") await activate(supabase, data.id);
  revalidatePath(`/thema/${topicId}`);
}

export async function updateCard(fd: FormData) {
  const { supabase } = await requireUser();
  const id = text(fd, "id");
  const { error } = await supabase.from("cards").update(cardFields(fd)).eq("id", id);
  if (error) throw new Error(error.message);
  await setObjectives(supabase, id, list(fd, "objectives"));
  revalidatePath(`/kaart/${id}`);
  redirect(safeReturn(fd.get("terug"), `/kaart/${id}`));
}

export async function setCardStatus(fd: FormData) {
  const { supabase } = await requireUser();
  const id = text(fd, "id");
  const status = text(fd, "status");
  if (status === "active") {
    await activate(supabase, id);
  } else if (status === "draft" || status === "suspended") {
    const { error } = await supabase.from("cards").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    throw new Error("Onbekende status");
  }
  revalidatePath(`/kaart/${id}`);
  revalidatePath("/goedkeuren");
}

export async function deleteCard(fd: FormData) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("cards").select("topic_id").eq("id", text(fd, "id")).single();
  const { error } = await supabase.from("cards").delete().eq("id", text(fd, "id"));
  if (error) throw new Error(error.message);
  redirect(data ? `/thema/${data.topic_id}` : "/themas");
}
