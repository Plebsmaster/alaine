"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { int, optText, text } from "@/lib/forms";

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
