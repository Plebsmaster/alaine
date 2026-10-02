"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AiError, runJson } from "@/lib/ai/client";
import { draftQuestionsPrompt, MAX_SOURCE_WORDS, wordCount } from "@/lib/ai/prompts";
import { draftQuestionsOutput } from "@/lib/ai/schemas";
import { requireUser } from "@/lib/auth";
import { EXAM_DEFAULT, pickExamQuestions } from "@/lib/exam";
import { int, list, optText, text } from "@/lib/forms";
import type { ServerClient } from "@/lib/supabase/server";

export type FormState = { error?: string };

async function touchSession(supabase: ServerClient, id: string, kind: "pretest" | "exam", items: number) {
  const now = new Date().toISOString();
  const { data } = await supabase.from("study_sessions").select("items").eq("id", id).maybeSingle();
  if (data) await supabase.from("study_sessions").update({ items: data.items + items, ended_at: now }).eq("id", id);
  else await supabase.from("study_sessions").insert({ id, kind, started_at: now, ended_at: now, items });
}

// ---------------------------------------------------------------------------
// Pretest
// ---------------------------------------------------------------------------

/** Antwoord opslaan en pas daarna het modelantwoord teruggeven. Geen score. */
export async function pretestAnswerAction(input: { questionId: string; answer: string; sessionId: string }) {
  const parsed = z.object({ questionId: z.uuid(), answer: z.string().max(5000), sessionId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ongeldige invoer" };
  const { questionId, answer, sessionId } = parsed.data;
  const { supabase } = await requireUser();
  const { data: q, error } = await supabase.from("questions").select("model_answer, explanation").eq("id", questionId).single();
  if (error) return { ok: false as const, error: "Vraag niet gevonden" };
  await supabase.from("question_attempts").insert({ question_id: questionId, answer_text: answer.trim() || null, session_id: sessionId });
  await touchSession(supabase, sessionId, "pretest", 1);
  return { ok: true as const, model_answer: q.model_answer, explanation: q.explanation };
}

// ---------------------------------------------------------------------------
// Proeftoets
// ---------------------------------------------------------------------------

export async function startExam(fd: FormData) {
  const { supabase } = await requireUser();
  const topics = list(fd, "topic");
  const n = Math.min(60, Math.max(5, int(fd, "n", EXAM_DEFAULT)));
  if (topics.length === 0) redirect("/oefentoets?fout=thema");
  const { data } = await supabase.from("questions").select("id, topic_id").eq("status", "active").eq("kind", "exam").in("topic_id", topics);
  const picked = pickExamQuestions(data ?? [], topics, n);
  if (picked.length === 0) redirect("/oefentoets?fout=geen-vragen");
  redirect(`/oefentoets/proeftoets?ids=${picked.map((q) => q.id).join(",")}`);
}

const answerSchema = z.object({
  questionId: z.uuid(),
  chosen_option: z.number().int().min(0).max(5).nullable(),
  answer_text: z.string().max(5000).nullable(),
});

export type ExamResult = {
  question_id: string;
  attempt_id: string;
  format: "open" | "mcq";
  stem: string;
  options: string[] | null;
  chosen_option: number | null;
  answer_text: string | null;
  correct_option: number | null;
  model_answer: string | null;
  explanation: string | null;
  correct: boolean | null;
  objectives: { id: string; code: string | null; description: string }[];
};

/** Inleveren: meerkeuze wordt nagekeken; open vragen beoordeel je daarna zelf. */
export async function submitExamAction(input: { sessionId: string; answers: z.infer<typeof answerSchema>[] }) {
  const parsed = z.object({ sessionId: z.uuid(), answers: z.array(answerSchema).min(1).max(60) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ongeldige invoer" };
  const { sessionId, answers } = parsed.data;
  const { supabase } = await requireUser();
  const { data: qs, error } = await supabase
    .from("questions")
    .select("id, format, stem, options, correct_option, model_answer, explanation, question_objectives(learning_objectives(id, code, description))")
    .in("id", answers.map((a) => a.questionId));
  if (error) return { ok: false as const, error: error.message };

  const rows = answers.map((a) => {
    const q = qs!.find((x) => x.id === a.questionId)!;
    const correct = q.format === "mcq" ? a.chosen_option !== null && a.chosen_option === q.correct_option : null;
    return { q, a, correct };
  });
  const { data: inserted, error: insertError } = await supabase
    .from("question_attempts")
    .insert(
      rows.map(({ a, q, correct }) => ({
        question_id: a.questionId,
        chosen_option: q.format === "mcq" ? a.chosen_option : null,
        answer_text: q.format === "open" ? a.answer_text?.trim() || null : null,
        correct,
        session_id: sessionId,
      })),
    )
    .select("id, question_id");
  if (insertError) return { ok: false as const, error: insertError.message };
  await touchSession(supabase, sessionId, "exam", rows.length);

  const results: ExamResult[] = rows.map(({ q, a, correct }) => ({
    question_id: q.id,
    attempt_id: inserted!.find((i) => i.question_id === q.id)!.id,
    format: q.format as "open" | "mcq",
    stem: q.stem,
    options: (q.options as string[] | null) ?? null,
    chosen_option: a.chosen_option,
    answer_text: a.answer_text,
    correct_option: q.correct_option,
    model_answer: q.model_answer,
    explanation: q.explanation,
    correct,
    objectives: q.question_objectives.map((o) => o.learning_objectives!).filter(Boolean),
  }));
  return { ok: true as const, results };
}

export async function markOpenAction(attemptId: string, correct: boolean) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("question_attempts").update({ correct }).eq("id", attemptId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/** A1: fouttype bij een fout antwoord (analyse; verandert de score niet). */
export async function setQuestionErrorAction(attemptId: string, errorType: "knowledge_gap" | "reasoning_error" | "slip" | null) {
  const parsed = z
    .object({ attemptId: z.uuid(), errorType: z.enum(["knowledge_gap", "reasoning_error", "slip"]).nullable() })
    .safeParse({ attemptId, errorType });
  if (!parsed.success) return { ok: false as const, error: "Ongeldige invoer" };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("question_attempts").update({ error_type: parsed.data.errorType }).eq("id", parsed.data.attemptId);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

/** Fout antwoord → met één klik een conceptkaart. */
export async function questionCardAction(questionId: string) {
  const { supabase } = await requireUser();
  const { data: q, error } = await supabase
    .from("questions")
    .select("topic_id, source_id, format, stem, options, correct_option, model_answer, explanation, question_objectives(objective_id)")
    .eq("id", questionId)
    .single();
  if (error) return { ok: false as const, error: "Vraag niet gevonden" };
  const options = (q.options as string[] | null) ?? [];
  const back =
    q.format === "mcq" && q.correct_option !== null ? options[q.correct_option] ?? "" : q.model_answer ?? "";
  if (!back.trim()) return { ok: false as const, error: "Deze vraag heeft geen antwoord om op de kaart te zetten." };
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .insert({
      topic_id: q.topic_id,
      source_id: q.source_id,
      type: "explain",
      front: q.stem.slice(0, 2000),
      back: back.slice(0, 2000),
      explanation: q.explanation,
      tags: ["toetsvraag"],
      status: "draft",
      origin: "manual",
    })
    .select("id")
    .single();
  if (cardError) return { ok: false as const, error: cardError.message };
  if (q.question_objectives.length) {
    await supabase.from("card_objectives").insert(q.question_objectives.map((o) => ({ card_id: card.id, objective_id: o.objective_id })));
  }
  revalidatePath("/goedkeuren");
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Beheer
// ---------------------------------------------------------------------------

function questionFields(fd: FormData) {
  const kind = text(fd, "kind");
  const format = text(fd, "format");
  if (kind !== "pretest" && kind !== "exam") throw new Error("Kies pretest of toetsvraag");
  if (format !== "open" && format !== "mcq") throw new Error("Kies open of meerkeuze");
  const stem = text(fd, "stem");
  if (!stem || stem.length > 2000) throw new Error("Vraag is verplicht (max. 2.000 tekens)");
  let options: string[] | null = null;
  let correct: number | null = null;
  if (format === "mcq") {
    const raw = Array.from({ length: 6 }, (_, i) => text(fd, `option${i}`));
    const chosen = int(fd, "correct_option", -1);
    options = raw.filter(Boolean);
    if (options.length < 3) throw new Error("Meerkeuze heeft minstens 3 opties");
    if (chosen < 0 || !raw[chosen]) throw new Error("Kies het juiste antwoord");
    correct = raw.slice(0, chosen).filter(Boolean).length; // index na het weglaten van lege opties
  }
  const model_answer = optText(fd, "model_answer");
  if (format === "open" && !model_answer) throw new Error("Een open vraag heeft een modelantwoord nodig");
  return {
    kind,
    format,
    stem,
    options,
    correct_option: correct,
    model_answer,
    explanation: optText(fd, "explanation"),
    needs_verification: fd.get("needs_verification") === "on",
  };
}

export async function createQuestion(fd: FormData) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("questions")
    .insert({ ...questionFields(fd), topic_id: text(fd, "topic_id"), status: "active", origin: "manual" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/oefentoets/vraag/${data.id}?opgeslagen=1`);
}

export async function updateQuestion(fd: FormData) {
  const { supabase } = await requireUser();
  const id = text(fd, "id");
  const status = fd.get("intent") === "approve" ? { status: "active" } : {};
  const { error } = await supabase.from("questions").update({ ...questionFields(fd), ...status }).eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.from("question_objectives").delete().eq("question_id", id);
  const objectives = list(fd, "objectives");
  if (objectives.length) {
    const ins = await supabase.from("question_objectives").insert(objectives.map((objective_id) => ({ question_id: id, objective_id })));
    if (ins.error) throw new Error(ins.error.message);
  }
  revalidatePath("/goedkeuren");
  redirect(`/oefentoets/vraag/${id}?opgeslagen=1`);
}

export async function setQuestionStatus(fd: FormData) {
  const { supabase } = await requireUser();
  const status = text(fd, "status");
  if (!["active", "draft", "archived"].includes(status)) throw new Error("Onbekende status");
  const { error } = await supabase.from("questions").update({ status }).eq("id", text(fd, "id"));
  if (error) throw new Error(error.message);
  revalidatePath(`/oefentoets/vraag/${text(fd, "id")}`);
}

export async function deleteQuestion(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("questions").delete().eq("id", text(fd, "id"));
  if (error) throw new Error(error.message);
  redirect("/oefentoets/vragen");
}

/** Bulk goedkeuren mag voor vragen (niet voor kaarten). */
export async function approveQuestions(fd: FormData) {
  const { supabase } = await requireUser();
  const ids = list(fd, "id");
  if (ids.length) {
    const { error } = await supabase.from("questions").update({ status: "active" }).in("id", ids).eq("status", "draft");
    if (error) throw new Error(error.message);
  }
  revalidatePath("/goedkeuren");
}

/** draft_questions: AI maakt conceptvragen uit scripts en/of geplakte brontekst. */
export async function draftQuestionsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const topicId = text(fd, "topic_id");
  const kind = text(fd, "kind") === "pretest" ? "pretest" : "exam";
  const format = (["open", "mcq", "mixed"].includes(text(fd, "format")) ? text(fd, "format") : "mixed") as "open" | "mcq" | "mixed";
  const n = Math.min(20, Math.max(1, int(fd, "n", 10)));
  const sourceText = text(fd, "source_text");
  if (wordCount(sourceText) > MAX_SOURCE_WORDS) return { error: "De brontekst is te lang. Plak alleen de relevante paragrafen." };

  const [{ data: topic }, { data: scripts }, { data: objectives }] = await Promise.all([
    supabase.from("topics").select("name").eq("id", topicId).single(),
    supabase
      .from("illness_scripts")
      .select("condition, epidemiology, pathophysiology, presentation, findings, management, key_discriminators")
      .eq("topic_id", topicId)
      .eq("status", "active"),
    supabase.from("learning_objectives").select("id, code, description").eq("topic_id", topicId).order("sort_order"),
  ]);
  if (!topic) return { error: "Kies een thema." };
  if (!sourceText && (scripts ?? []).length === 0) {
    return { error: "Plak brontekst, of keur eerst illness scripts van dit thema goed. De AI werkt alleen vanuit de bron." };
  }

  let result;
  try {
    result = await runJson({
      fn: "draft_questions",
      ...draftQuestionsPrompt({ topic: topic.name, n, kind, format, scripts: scripts ?? [], sourceText, objectives: objectives ?? [] }),
      schema: draftQuestionsOutput,
      supabase,
    });
  } catch (e) {
    if (e instanceof AiError) return { error: e.message };
    throw e;
  }

  const known = new Set((objectives ?? []).map((o) => o.id));
  let saved = 0;
  for (const q of result.questions) {
    const mcq = q.format === "mcq";
    if (mcq && (q.options.length < 3 || q.options.length > 6 || q.correct_option < 0 || q.correct_option >= q.options.length)) continue;
    if (!mcq && !q.model_answer.trim()) continue;
    const { data, error } = await supabase
      .from("questions")
      .insert({
        topic_id: topicId,
        kind,
        format: q.format,
        stem: q.stem.trim(),
        options: mcq ? q.options : null,
        correct_option: mcq ? q.correct_option : null,
        model_answer: q.model_answer.trim() || null,
        explanation: q.explanation.trim() || null,
        needs_verification: q.needs_verification,
        status: "draft",
        origin: "ai",
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    const objs = q.objectives.filter((o) => known.has(o));
    if (objs.length) await supabase.from("question_objectives").insert(objs.map((objective_id) => ({ question_id: data.id, objective_id })));
    saved++;
  }
  if (saved === 0) return { error: "De AI leverde geen bruikbare vragen op. Probeer het opnieuw." };
  revalidatePath("/goedkeuren");
  redirect(`/goedkeuren?thema=${topicId}`);
}
