"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Field, Notice, Panel, Textarea } from "@/components/ui";
import { pretestAnswerAction } from "@/app/(app)/oefentoets/actions";
import { FOOTER_BUTTON, QuestionNav, RunnerFooter, RunnerHeader } from "../../runner-ui";

type Q = { id: string; stem: string };
type Revealed = { model_answer: string | null; explanation: string | null; tried: boolean };

/** Pretest (ontwerp 1t): zelfde patroon als de proeftoets, zonder score. Het modelantwoord pas na je antwoord. */
export function PretestRunner({ questions, sessionId, topicName }: { questions: Q[]; sessionId: string; topicName: string }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, Revealed>>({});
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const tried = Object.values(revealed).filter((r) => r.tried).length;

  if (finished) {
    return (
      <Panel className="mt-4 space-y-2">
        <h1 className="font-serif text-[26px] font-medium">Pretest klaar</h1>
        <p className="text-[15px]">
          Je hebt er {tried} van de {questions.length} geprobeerd.
        </p>
        <p className="text-sm text-muted">Dit was geen toets: proberen vóór het leren zorgt dat je de stof straks beter onthoudt.</p>
        <Link className="inline-flex min-h-11 items-center text-[15px] text-accent underline" href="/oefentoets">
          Terug naar Oefentoets
        </Link>
      </Panel>
    );
  }

  const q = questions[index];
  const answer = answers[q.id] ?? "";
  const shown = revealed[q.id];
  const last = index === questions.length - 1;
  const go = (i: number) => {
    setIndex(i);
    setError(null);
    window.scrollTo({ top: 0 });
  };

  const reveal = () =>
    start(async () => {
      const res = await pretestAnswerAction({ questionId: q.id, answer, sessionId }).catch(() => null);
      if (!res || !res.ok) return setError(res?.error ?? "Geen verbinding. Probeer het opnieuw.");
      setError(null);
      setRevealed((r) => ({ ...r, [q.id]: { model_answer: res.model_answer, explanation: res.explanation, tried: !!answer.trim() } }));
    });

  return (
    <div data-own-header>
      <RunnerHeader title="Pretest" subtitle={topicName} />
      <div className="mx-auto max-w-[720px] px-4 pt-4 md:pb-12 md:pt-6">
        <QuestionNav done={questions.map((x) => !!revealed[x.id])} current={index} onPick={go} doneLabel="bekeken" />

        <p className="mt-5 text-[13px] text-muted">
          Vraag {index + 1} van {questions.length}
        </p>
        <p className="prose-card mt-3 font-serif text-[22px] font-medium leading-[1.35]">{q.stem}</p>

        <div className="mt-5">
          <Field label="Je antwoord">
            <Textarea
              key={q.id}
              value={answer}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              readOnly={!!shown}
              className="min-h-40"
            />
          </Field>
        </div>

        {shown ? (
          <div className="mt-4 space-y-1.5 rounded-[14px] bg-accent-soft px-4 py-3.5">
            <p className="text-[13px] font-bold text-accent-strong">Modelantwoord</p>
            <p className="prose-card text-[15px] leading-normal">{shown.model_answer || "–"}</p>
            {shown.explanation ? <p className="prose-card text-[13px] text-text-2">{shown.explanation}</p> : null}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}

        <RunnerFooter>
          <Button className={FOOTER_BUTTON} disabled={index === 0} onClick={() => go(index - 1)}>
            Vorige
          </Button>
          {!shown ? (
            <Button variant="primary" className={FOOTER_BUTTON} disabled={pending} onClick={reveal}>
              {answer.trim() ? "Toon modelantwoord" : "Weet ik niet, toon modelantwoord"}
            </Button>
          ) : last ? (
            <Button variant="primary" className={FOOTER_BUTTON} onClick={() => setFinished(true)}>
              Afronden
            </Button>
          ) : (
            <Button variant="primary" className={FOOTER_BUTTON} onClick={() => go(index + 1)}>
              Volgende vraag
            </Button>
          )}
        </RunnerFooter>
      </div>
    </div>
  );
}
