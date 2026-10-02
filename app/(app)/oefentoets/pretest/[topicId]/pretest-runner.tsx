"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, Field, Notice, Panel, Textarea } from "@/components/ui";
import { pretestAnswerAction } from "../../actions";

type Q = { id: string; stem: string };
type Revealed = { model_answer: string | null; explanation: string | null };

export function PretestRunner({ questions, sessionId }: { questions: Q[]; sessionId: string }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [tried, setTried] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (index >= questions.length) {
    return (
      <Panel className="space-y-2">
        <p className="text-lg font-medium">Pretest klaar</p>
        <p>Je hebt er {tried} van de {questions.length} geprobeerd.</p>
        <p className="text-sm text-muted">Dit was geen toets: proberen vóór het leren zorgt dat je de stof straks beter onthoudt.</p>
        <Link className="underline" href="/oefentoets">Terug naar Oefentoets</Link>
      </Panel>
    );
  }

  const q = questions[index];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Vraag {index + 1} van {questions.length}
      </p>
      <Panel className="space-y-3">
        <p className="prose-card text-lg font-medium">{q.stem}</p>
        <Field label="Je antwoord">
          <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} readOnly={!!revealed} />
        </Field>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {!revealed ? (
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await pretestAnswerAction({ questionId: q.id, answer, sessionId }).catch(() => null);
                if (!res || !res.ok) return setError(res?.error ?? "Geen verbinding. Probeer het opnieuw.");
                setError(null);
                if (answer.trim()) setTried((n) => n + 1);
                setRevealed({ model_answer: res.model_answer, explanation: res.explanation });
              })
            }
          >
            {answer.trim() ? "Toon modelantwoord" : "Weet ik niet, toon modelantwoord"}
          </Button>
        ) : (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-medium">Modelantwoord</p>
            <p className="prose-card">{revealed.model_answer || "–"}</p>
            {revealed.explanation ? <p className="prose-card text-sm text-muted">{revealed.explanation}</p> : null}
            <Button
              variant="primary"
              onClick={() => {
                setIndex((i) => i + 1);
                setAnswer("");
                setRevealed(null);
              }}
            >
              {index === questions.length - 1 ? "Afronden" : "Volgende vraag"}
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
