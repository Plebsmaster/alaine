import { z } from "zod";

// Uitvoerschema's per AI-functie. Ook gebruikt als structured output voor de API.

export const draftScriptOutput = z.object({
  illness_script: z.object({
    epidemiology: z.string(),
    pathophysiology: z.string(),
    presentation: z.string(),
    findings: z.string(),
    management: z.string(),
    key_discriminators: z.string(),
    similar_conditions: z.array(z.string()),
    needs_verification: z.boolean(),
  }),
});

export const draftCompareOutput = z.object({
  card: z.object({
    front: z.string().min(1).max(2000),
    back: z.string().min(1).max(2000),
    explanation: z.string(),
    needs_verification: z.boolean(),
  }),
});

export const caseHintOutput = z.object({ hint: z.string().min(1) });

export const caseFeedbackOutput = z.object({
  diagnosis_correct: z.boolean(),
  decisive_finding: z.string(),
  per_diagnosis: z.array(z.object({ diagnosis: z.string(), seen: z.string(), missed: z.string() })),
  missing_alternatives: z.array(z.string()),
  lessons: z.array(z.string()),
});

export type CaseFeedback = z.infer<typeof caseFeedbackOutput>;

const aiCase = z.object({
  title: z.string().min(1),
  vignette: z.string().min(1).max(2000),
  correct_diagnosis: z.string().min(1),
  expert_reflection: z
    .array(
      z.object({
        diagnosis: z.string().min(1),
        supporting: z.string(),
        against: z.string(),
        missing: z.string(),
        rank: z.number().int(),
      }),
    )
    .min(2),
  teaching_points: z.string(),
  difficulty: z.number().int(),
  objectives: z.array(z.string()),
  needs_verification: z.boolean(),
});

export const draftCasesOutput = z.object({ cases: z.array(aiCase).min(1) });

export const draftQuestionsOutput = z.object({
  questions: z
    .array(
      z.object({
        format: z.enum(["open", "mcq"]),
        stem: z.string().min(1).max(2000),
        options: z.array(z.string()),
        correct_option: z.number().int(),
        model_answer: z.string(),
        explanation: z.string(),
        objectives: z.array(z.string()),
        needs_verification: z.boolean(),
      }),
    )
    .min(1),
});

export const draftCardsOutput = z.object({
  cards: z
    .array(
      z.object({
        type: z.enum(["fact", "explain", "chain", "skill", "communication"]),
        front: z.string().min(1).max(2000),
        back: z.string().min(1).max(2000),
        explanation: z.string(),
        objectives: z.array(z.string()),
        source_locator: z.string(),
        needs_verification: z.boolean(),
      }),
    )
    .min(1),
});

const errorType = z.enum(["knowledge_gap", "reasoning_error", "slip"]);

export const explainCheckOutput = z.object({
  verdict: z.enum(["correct", "partial", "incorrect"]),
  error_type: errorType.nullable(),
  hint: z.string().nullable(),
  recovery_question: z.string().nullable(),
  explanation: z.string().nullable(),
  follow_up: z.string().nullable(),
  suggested_rating: z.number().int().min(1).max(4),
});

export type ExplainCheck = z.infer<typeof explainCheckOutput>;

export const stopcheckOutput = z.object({
  points: z.array(z.object({ text: z.string().min(1), item_ref: z.string() })).max(5),
});
