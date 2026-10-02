// Zod-schema voor het importformaat, versie 1. Zie docs/IMPORT_FORMAT.md.
import { z } from "zod";

const MAX_TEXT = 2000;

const externalId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Alleen kleine letters, cijfers en koppeltekens");

const requiredText = z
  .string()
  .trim()
  .min(1, "Mag niet leeg zijn")
  .max(MAX_TEXT, `Maximaal ${MAX_TEXT} tekens`);

const optionalText = z.string().trim().max(10_000).nullish();
const refList = z.array(externalId).default([]);

export const CARD_TYPES = [
  "fact",
  "explain",
  "illness_script",
  "compare",
  "image",
  "skill",
  "communication",
] as const;

export const SOURCE_KINDS = [
  "book",
  "lecture",
  "practical",
  "assignment",
  "internship",
  "guideline",
  "other",
] as const;

export const moduleSchema = z.object({
  external_id: externalId,
  name: requiredText,
  study_year: z.number().int().min(1).max(9).nullish(),
  sort_order: z.number().int().default(0),
  exam_date: z.iso.date("Gebruik JJJJ-MM-DD").nullish(),
});

export const topicSchema = z.object({
  external_id: externalId,
  module: externalId,
  name: requiredText,
  sort_order: z.number().int().default(0),
});

export const objectiveSchema = z.object({
  external_id: externalId,
  topic: externalId,
  code: z.string().trim().max(50).nullish(),
  description: requiredText,
  sort_order: z.number().int().default(0),
});

export const sourceSchema = z.object({
  external_id: externalId,
  kind: z.enum(SOURCE_KINDS).default("book"),
  title: requiredText,
  author: optionalText,
  chapter: optionalText,
  pages: optionalText,
  url: optionalText,
  notes: optionalText,
});

export const illnessScriptSchema = z.object({
  external_id: externalId,
  topic: externalId,
  source: externalId.nullish(),
  source_locator: optionalText,
  condition: requiredText,
  epidemiology: optionalText,
  pathophysiology: optionalText,
  presentation: optionalText,
  findings: optionalText,
  management: optionalText,
  key_discriminators: optionalText,
  similar_conditions: z.array(z.string().trim().min(1)).default([]),
});

export const cardSchema = z.object({
  external_id: externalId,
  topic: externalId,
  type: z.enum(CARD_TYPES),
  front: requiredText,
  back: requiredText,
  explanation: optionalText,
  source: externalId.nullish(),
  source_locator: optionalText,
  objectives: refList,
  tags: z.array(z.string().trim().min(1)).default([]),
  image: z.string().trim().min(1).nullish(),
});

const reflectionSchema = z.object({
  diagnosis: requiredText,
  supporting: optionalText,
  against: optionalText,
  missing: optionalText,
  rank: z.number().int().min(1),
});

const sameDiagnosis = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const caseSchema = z
  .object({
    external_id: externalId,
    topic: externalId,
    source: externalId.nullish(),
    title: requiredText,
    vignette: requiredText,
    question: z.string().trim().min(1).default("Wat is je werkdiagnose?"),
    correct_diagnosis: requiredText,
    expert_reflection: z.array(reflectionSchema).min(2, "Minimaal 2 diagnoses"),
    teaching_points: optionalText,
    difficulty: z.number().int().min(1).max(3).nullish(),
    objectives: refList,
  })
  .superRefine((c, ctx) => {
    const first = c.expert_reflection.filter((r) => r.rank === 1);
    if (first.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["expert_reflection"],
        message: `Precies één diagnose moet rank 1 hebben (nu ${first.length})`,
      });
    } else if (!sameDiagnosis(first[0].diagnosis, c.correct_diagnosis)) {
      ctx.addIssue({
        code: "custom",
        path: ["expert_reflection"],
        message: "De diagnose met rank 1 moet gelijk zijn aan correct_diagnosis",
      });
    }
  });

export const questionSchema = z
  .object({
    external_id: externalId,
    topic: externalId,
    source: externalId.nullish(),
    kind: z.enum(["pretest", "exam"]),
    format: z.enum(["open", "mcq"]),
    stem: requiredText,
    options: z.array(z.string().trim().min(1)).nullish(),
    correct_option: z.number().int().min(0).nullish(),
    model_answer: optionalText,
    explanation: optionalText,
    objectives: refList,
  })
  .superRefine((q, ctx) => {
    if (q.format !== "mcq") return;
    const n = q.options?.length ?? 0;
    if (n < 3 || n > 6) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Meerkeuze heeft 3 tot 6 opties" });
    }
    if (q.correct_option == null || q.correct_option >= n) {
      ctx.addIssue({
        code: "custom",
        path: ["correct_option"],
        message: "correct_option moet een index binnen options zijn (vanaf 0)",
      });
    }
  });

export const importSchema = z.object({
  format: z.literal("pa-studie-import", "format moet \"pa-studie-import\" zijn"),
  version: z.literal(1, "Alleen versie 1 wordt ondersteund"),
  modules: z.array(moduleSchema).default([]),
  topics: z.array(topicSchema).default([]),
  objectives: z.array(objectiveSchema).default([]),
  sources: z.array(sourceSchema).default([]),
  illness_scripts: z.array(illnessScriptSchema).default([]),
  cards: z.array(cardSchema).default([]),
  cases: z.array(caseSchema).default([]),
  questions: z.array(questionSchema).default([]),
});

export type ImportBundle = z.infer<typeof importSchema>;
export type ImportCard = z.infer<typeof cardSchema>;

export const STRUCTURE_KINDS = ["modules", "topics", "objectives", "sources"] as const;
export const CONTENT_KINDS = ["illness_scripts", "cards", "cases", "questions"] as const;
export type StructureKind = (typeof STRUCTURE_KINDS)[number];
export type ContentKind = (typeof CONTENT_KINDS)[number];
export type ImportKind = StructureKind | ContentKind;
