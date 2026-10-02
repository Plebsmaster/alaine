"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AiError, runJson } from "@/lib/ai/client";
import { draftComparePrompt, draftScriptPrompt, MAX_SOURCE_WORDS, wordCount } from "@/lib/ai/prompts";
import { draftCompareOutput, draftScriptOutput } from "@/lib/ai/schemas";
import { csv, optText, text } from "@/lib/forms";

export type FormState = { error?: string };

const FIELDS = [
  "epidemiology",
  "pathophysiology",
  "presentation",
  "findings",
  "management",
  "key_discriminators",
] as const;

function scriptFields(fd: FormData) {
  const condition = text(fd, "condition");
  if (!condition) throw new Error("Aandoening is verplicht");
  if (condition.length > 2000) throw new Error("Aandoening: maximaal 2.000 tekens");
  const fields = Object.fromEntries(FIELDS.map((f) => [f, optText(fd, f)])) as Record<(typeof FIELDS)[number], string | null>;
  return {
    condition,
    ...fields,
    similar_conditions: csv(fd, "similar_conditions"),
    source_id: optText(fd, "source_id"),
    source_locator: optText(fd, "source_locator"),
  };
}

/** Handmatig script: begint als concept, zodat het via goedkeuren kaarten oplevert. */
export async function createScript(fd: FormData) {
  const { supabase } = await requireUser();
  const condition = text(fd, "condition");
  if (!condition) throw new Error("Aandoening is verplicht");
  const { data, error } = await supabase
    .from("illness_scripts")
    .insert({ topic_id: text(fd, "topic_id"), condition, status: "draft", origin: "manual" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/scripts/${data.id}`);
}

export async function saveScript(fd: FormData) {
  const { supabase } = await requireUser();
  const id = text(fd, "id");
  const { error } = await supabase.from("illness_scripts").update(scriptFields(fd)).eq("id", id);
  if (error) throw new Error(error.message);
  if (fd.get("intent") === "approve") {
    const rpc = await supabase.rpc("approve_illness_script", { p_script_id: id });
    if (rpc.error) throw new Error(rpc.error.message);
    revalidatePath("/goedkeuren");
    redirect(`/scripts/${id}?kaarten=${rpc.data}`);
  }
  revalidatePath(`/scripts/${id}`);
  redirect(`/scripts/${id}?opgeslagen=1`);
}

export async function setScriptStatus(fd: FormData) {
  const { supabase } = await requireUser();
  const id = text(fd, "id");
  const status = text(fd, "status");
  if (status !== "archived" && status !== "draft") throw new Error("Onbekende status");
  const { error } = await supabase.from("illness_scripts").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/scripts/${id}`);
}

export async function deleteScript(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("illness_scripts").delete().eq("id", text(fd, "id"));
  if (error) throw new Error(error.message);
  redirect("/scripts");
}

/** draft_script: AI maakt een conceptscript uit geplakte brontekst. */
export async function draftScriptAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const topicId = text(fd, "topic_id");
  const condition = text(fd, "condition");
  const sourceText = text(fd, "source_text");
  if (!condition || !sourceText) return { error: "Vul de aandoening en de brontekst in." };
  if (wordCount(sourceText) > MAX_SOURCE_WORDS) {
    return { error: `De brontekst is te lang (max. ${MAX_SOURCE_WORDS.toLocaleString("nl-NL")} woorden). Plak alleen de relevante paragrafen.` };
  }
  const { data: topic } = await supabase.from("topics").select("name").eq("id", topicId).single();
  if (!topic) return { error: "Kies een thema." };

  let result;
  try {
    result = await runJson({
      fn: "draft_script",
      ...draftScriptPrompt({ condition, topic: topic.name, sourceText }),
      schema: draftScriptOutput,
      supabase,
    });
  } catch (e) {
    if (e instanceof AiError) return { error: e.message };
    throw e;
  }

  const s = result.illness_script;
  const clean = (v: string) => v.trim() || null;
  const { data, error } = await supabase
    .from("illness_scripts")
    .insert({
      topic_id: topicId,
      condition,
      epidemiology: clean(s.epidemiology),
      pathophysiology: clean(s.pathophysiology),
      presentation: clean(s.presentation),
      findings: clean(s.findings),
      management: clean(s.management),
      key_discriminators: clean(s.key_discriminators),
      similar_conditions: s.similar_conditions.map((c) => c.trim()).filter(Boolean),
      source_id: optText(fd, "source_id"),
      source_locator: optText(fd, "source_locator"),
      status: "draft",
      origin: "ai",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  redirect(`/scripts/${data.id}?ai=1`);
}

/** draft_compare: AI maakt één vergelijkingskaart (concept) uit twee of meer goedgekeurde scripts. */
export async function draftCompareAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const ids = fd.getAll("id").map(String);
  const { data: scripts, error } = await supabase
    .from("illness_scripts")
    .select("id, topic_id, condition, epidemiology, pathophysiology, presentation, findings, management, key_discriminators, status")
    .in("id", ids);
  if (error) return { error: error.message };
  const active = (scripts ?? []).filter((s) => s.status === "active");
  if (active.length < 2) return { error: "Keur eerst minstens twee van deze scripts goed; AI werkt alleen vanuit goedgekeurde scripts." };

  let result;
  try {
    result = await runJson({
      fn: "draft_compare",
      ...draftComparePrompt(
        active.map(({ condition, epidemiology, pathophysiology, presentation, findings, management, key_discriminators }) => ({
          condition, epidemiology, pathophysiology, presentation, findings, management, key_discriminators,
        })),
      ),
      schema: draftCompareOutput,
      supabase,
    });
  } catch (e) {
    if (e instanceof AiError) return { error: e.message };
    throw e;
  }

  const topicId = active[0].topic_id;
  const { error: insertError } = await supabase.from("cards").insert({
    topic_id: topicId,
    type: "compare",
    front: result.card.front.trim(),
    back: result.card.back.trim(),
    explanation: result.card.explanation.trim() || null,
    tags: ["vergelijken"],
    status: "draft",
    origin: "ai",
  });
  if (insertError) return { error: insertError.message };
  revalidatePath("/goedkeuren");
  redirect(`/goedkeuren?thema=${topicId}`);
}
