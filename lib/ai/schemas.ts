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
  }),
});

export const draftCompareOutput = z.object({
  card: z.object({
    front: z.string().min(1).max(2000),
    back: z.string().min(1).max(2000),
    explanation: z.string(),
  }),
});
