"use client";

import { useCallback, useState } from "react";
import { Button, Field, Notice, Textarea } from "@/components/ui";
import type { ExplainCheck } from "@/lib/ai/schemas";
import { RATINGS } from "@/lib/fsrs";
import { explainCheckAction } from "./actions";

export type CheckStep = { stage: 1 | 2; answer: string; result: ExplainCheck };

/**
 * A3: nakijken vóór het antwoord zichtbaar is. Bij deels of fout eerst een hint en een
 * herstelvraag; pas na het antwoord daarop de volledige uitleg (en dan de achterkant).
 */
export function useAnswerCheck(cardId: string) {
  const [steps, setSteps] = useState<CheckStep[]>([]);
  const [state, setState] = useState<"idle" | "loading" | string>("idle");

  const run = async (stage: 1 | 2, answer: string): Promise<CheckStep | null> => {
    setState("loading");
    const prev = steps.at(-1);
    const res = await explainCheckAction({
      cardId,
      answer,
      stage,
      previous: prev
        ? { answer: prev.answer, verdict: prev.result.verdict, hint: prev.result.hint, recovery_question: prev.result.recovery_question }
        : null,
    }).catch(() => null);
    if (!res || !res.ok) {
      setState(res?.error ?? "Geen verbinding. Probeer het opnieuw.");
      return null;
    }
    const step = { stage, answer, result: res.check };
    setSteps((s) => [...s, step]);
    setState("idle");
    return step;
  };

  const reset = useCallback(() => {
    setSteps([]);
    setState("idle");
  }, []);

  return { steps, state, run, reset, last: steps.at(-1) ?? null };
}

/** Hint + herstelvraag (stap 1, niet correct), met een veld voor het herstelantwoord. */
export function RecoveryPrompt({
  step,
  loading,
  onSubmit,
}: {
  step: CheckStep;
  loading: boolean;
  onSubmit: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  return (
    <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm" aria-live="polite">
      <p className="font-medium">{step.result.verdict === "partial" ? "Deels goed." : "Nog niet goed."} Probeer het met een hint.</p>
      {step.result.hint ? (
        <p>
          <strong>Hint:</strong> {step.result.hint}
        </p>
      ) : null}
      {step.result.recovery_question ? (
        <Field label={step.result.recovery_question}>
          <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} />
        </Field>
      ) : null}
      <Button variant="primary" disabled={loading || !answer.trim()} onClick={() => onSubmit(answer)}>
        {loading ? "Nakijken…" : "Nakijken"}
      </Button>
    </div>
  );
}

/** Uitkomst na het tonen: bevestiging + vervolgvraag, of de volledige uitleg na stap 2. */
export function CheckOutcome({ steps }: { steps: CheckStep[] }) {
  const last = steps.at(-1);
  if (!last) return null;
  const r = last.result;
  return (
    <div className="space-y-1 rounded-lg bg-surface-2 p-3 text-sm" aria-live="polite">
      <p className="text-xs font-medium text-muted">Nakijken door AI</p>
      {last.stage === 1 && r.verdict === "correct" ? <p>Goed. {r.explanation ?? ""}</p> : null}
      {last.stage === 2 ? (
        <p>
          <strong>{r.verdict === "correct" ? "Na de hint gelukt." : "Uitleg:"}</strong> {r.explanation}
        </p>
      ) : null}
      {r.follow_up ? (
        <p>
          <strong>Denk verder:</strong> {r.follow_up}
        </p>
      ) : null}
      <p className="text-xs text-muted">Voorstel: {RATINGS.find((x) => x.value === r.suggested_rating)?.label}. Je kiest zelf.</p>
    </div>
  );
}

export function CheckError({ state }: { state: string }) {
  if (state === "idle" || state === "loading") return null;
  return <Notice tone="error">{state}</Notice>;
}
