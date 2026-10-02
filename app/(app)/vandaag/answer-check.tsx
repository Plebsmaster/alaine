"use client";

import { useCallback, useState } from "react";
import { Notice, Textarea } from "@/components/ui";
import type { ExplainCheck } from "@/lib/ai/schemas";
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

/**
 * Hint + herstelvraag (stap 1, niet correct), met een veld voor het herstelantwoord.
 * De knop "Nakijken" staat in de dock van het herhaalscherm.
 */
export function RecoveryPrompt({
  step,
  answer,
  onChange,
}: {
  step: CheckStep;
  answer: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-surface p-4" aria-live="polite">
      <p className="text-base font-bold">
        {step.result.verdict === "partial" ? "Deels goed." : "Nog niet goed."} Probeer het met een hint.
      </p>
      {step.result.hint ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.07em] text-hard">Hint</p>
          <p className="text-[15px] leading-normal">{step.result.hint}</p>
        </div>
      ) : null}
      {step.result.recovery_question ? (
        <label className="block space-y-1.5">
          <span className="text-[15px] font-bold">{step.result.recovery_question}</span>
          <Textarea value={answer} onChange={(e) => onChange(e.target.value)} className="min-h-[84px]" />
        </label>
      ) : null}
    </div>
  );
}

/** AI-strook na het tonen: bevestiging of uitleg, plus een vervolgvraag. */
export function CheckOutcome({ steps }: { steps: CheckStep[] }) {
  const last = steps.at(-1);
  if (!last) return null;
  const r = last.result;
  return (
    <div className="flex gap-4 rounded-[14px] bg-accent-soft px-[18px] py-3.5 text-[15px] leading-normal" aria-live="polite">
      <span className="pt-0.5 text-[11px] font-bold tracking-[.07em] text-accent-strong">AI</span>
      <div className="space-y-1">
        {last.stage === 1 && r.verdict === "correct" ? <p>Goed. {r.explanation ?? ""}</p> : null}
        {last.stage === 2 ? (
          <p>
            <strong>{r.verdict === "correct" ? "Na de hint gelukt." : "Uitleg:"}</strong> {r.explanation}
          </p>
        ) : null}
        {r.follow_up ? (
          <p className="text-text-2">
            <strong>Denk verder:</strong> {r.follow_up}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function CheckError({ state }: { state: string }) {
  if (state === "idle" || state === "loading") return null;
  return <Notice tone="error">{state}</Notice>;
}
