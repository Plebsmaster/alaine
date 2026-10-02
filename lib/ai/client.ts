import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { ServerClient } from "@/lib/supabase/server";

export class AiError extends Error {}

export type AiFunction =
  | "draft_cards"
  | "draft_script"
  | "draft_compare"
  | "draft_cases"
  | "draft_questions"
  | "explain_check"
  | "case_hint"
  | "case_feedback"
  | "stopcheck";

const FAST_FUNCTIONS: AiFunction[] = ["explain_check", "case_hint"];

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function modelFor(fn: AiFunction): string {
  return FAST_FUNCTIONS.includes(fn)
    ? process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-4-5"
    : process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
}

/** Minimale vorm van de SDK-client die runJson gebruikt; maakt testen zonder netwerk mogelijk. */
export type ParseClient = Pick<Anthropic["messages"], "parse">;

let client: Anthropic | null = null;
function defaultClient(): ParseClient {
  if (!aiConfigured()) {
    throw new AiError("AI is nog niet ingesteld: zet ANTHROPIC_API_KEY in .env.local of in Vercel.");
  }
  client ??= new Anthropic();
  return client.messages;
}

/**
 * Eén AI-aanroep met gevalideerde JSON-uitvoer. Ongeldige uitvoer: één nieuwe poging met
 * de foutmelding erbij; daarna een nette fout. Elke poging wordt gelogd in ai_usage.
 */
export async function runJson<S extends z.ZodType>(opts: {
  fn: AiFunction;
  system: string;
  user: string;
  schema: S;
  supabase?: ServerClient;
  api?: ParseClient;
  maxTokens?: number;
}): Promise<z.infer<S>> {
  const api = opts.api ?? defaultClient();
  const model = modelFor(opts.fn);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.user }];

  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    let response: Awaited<ReturnType<ParseClient["parse"]>>;
    try {
      response = await api.parse({
        model,
        max_tokens: opts.maxTokens ?? 16000,
        system: opts.system,
        messages,
        output_config: { format: zodOutputFormat(opts.schema) },
      });
    } catch (e) {
      await log(opts, model, 0, 0, Date.now() - started, false);
      if (e instanceof Anthropic.AuthenticationError) throw new AiError("De Anthropic API-key klopt niet.");
      if (e instanceof Anthropic.RateLimitError) throw new AiError("Te veel AI-aanvragen tegelijk. Probeer het zo opnieuw.");
      if (e instanceof Anthropic.APIError) throw new AiError(`AI-aanroep mislukt (${e.status ?? "verbinding"}).`);
      throw e;
    }

    const usage = response.usage;
    if (response.stop_reason === "refusal") {
      await log(opts, model, usage.input_tokens, usage.output_tokens, Date.now() - started, false);
      throw new AiError("De AI wilde deze tekst niet verwerken. Probeer een ander stuk bron.");
    }

    const parsed = opts.schema.safeParse(response.parsed_output);
    await log(opts, model, usage.input_tokens, usage.output_tokens, Date.now() - started, parsed.success);
    if (parsed.success) return parsed.data;

    // Eén nieuwe poging met de validatiefout erbij.
    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: `Je antwoord voldeed niet aan het schema: ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}. Geef het volledige JSON opnieuw.`,
      },
    );
  }
  throw new AiError("De AI gaf twee keer geen bruikbaar antwoord. Probeer het opnieuw.");
}

async function log(
  opts: { fn: AiFunction; supabase?: ServerClient },
  model: string,
  input: number,
  output: number,
  durationMs: number,
  ok: boolean,
) {
  console.info(JSON.stringify({ ai: opts.fn, model, input_tokens: input, output_tokens: output, duration_ms: durationMs, ok }));
  if (!opts.supabase) return;
  await opts.supabase
    .from("ai_usage")
    .insert({ function: opts.fn, model, input_tokens: input, output_tokens: output, duration_ms: durationMs, ok });
}
