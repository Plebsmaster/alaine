"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { int, optDate, text } from "@/lib/forms";

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function createModule(fd: FormData) {
  const { supabase } = await requireUser();
  const name = text(fd, "name");
  if (!name) throw new Error("Naam is verplicht");
  const { error } = await supabase.from("modules").insert({
    name,
    study_year: int(fd, "study_year", 1),
    sort_order: int(fd, "sort_order"),
    exam_date: optDate(fd, "exam_date"),
  });
  check(error);
  revalidatePath("/themas");
}

export async function updateModule(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("modules")
    .update({
      name: text(fd, "name"),
      sort_order: int(fd, "sort_order"),
      exam_date: optDate(fd, "exam_date"),
    })
    .eq("id", text(fd, "id"));
  check(error);
  revalidatePath("/themas");
}

export async function deleteModule(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("modules").delete().eq("id", text(fd, "id"));
  check(error);
  revalidatePath("/themas");
}

export async function createTopic(fd: FormData) {
  const { supabase } = await requireUser();
  const name = text(fd, "name");
  if (!name) throw new Error("Naam is verplicht");
  const { data, error } = await supabase
    .from("topics")
    .insert({ module_id: text(fd, "module_id"), name, sort_order: int(fd, "sort_order") })
    .select("id")
    .single();
  check(error);
  redirect(`/thema/${data!.id}`);
}

export async function updateTopic(fd: FormData) {
  const { supabase } = await requireUser();
  const id = text(fd, "id");
  const { error } = await supabase
    .from("topics")
    .update({ name: text(fd, "name"), sort_order: int(fd, "sort_order") })
    .eq("id", id);
  check(error);
  revalidatePath(`/thema/${id}`);
  revalidatePath("/themas");
}

export async function deleteTopic(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("topics").delete().eq("id", text(fd, "id"));
  check(error);
  redirect("/themas");
}
