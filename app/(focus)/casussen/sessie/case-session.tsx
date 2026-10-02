"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ErrorChips } from "@/components/error-chips";
import { Badge, Button, Field, Input, Notice, Panel, Textarea } from "@/components/ui";
import type { ErrorType } from "@/lib/labels";
import type { CaseFeedback } from "@/lib/ai/schemas";
import { MAX_HINTS, type ExpertReflection, type Reflection } from "@/lib/cases";
import {
  caseFeedbackAction,
  caseHintAction,
  missedCardAction,
  revealAlternativesAction,
  revealExpertAction,
  saveAttemptAction,
  type AttemptInput,
} from "@/app/(app)/casussen/actions";

export type PublicCase = { id: string; title: string; vignette: string; question: string; topic_name: string };

type Expert = { correct_diagnosis: string; expert_reflection: ExpertReflection[]; teaching_points: string | null };
type Step = "diagnose" | "reflect" | "alternatives" | "rank" | "expert" | "score" | "card";
type Result = { correct: boolean; score: number };

const STEP_LABELS: Record<Step, string> = {
  diagnose: "1. Werkdiagnose",
  reflect: "2. Reflectie",
  alternatives: "3. Alternatieven",
  rank: "4. Rangschikken",
  expert: "5. Vergelijken met de expert",
  score: "6. Zelfscore",
  card: "7. Wat miste je?",
};

const emptyRow = (diagnosis = ""): Reflection => ({ diagnosis, supporting: "", against: "", missing: "" });

export function CaseSession({ cases, sessionId, aiEnabled }: { cases: PublicCase[]; sessionId: string; aiEnabled: boolean }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  if (index >= cases.length) {
    const correct = results.filter((r) => r.correct).length;
    const avg = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
    return (
      <Panel className="space-y-3">
        <p className="text-lg font-medium">Sessie klaar</p>
        <p className="text-sm">
          {results.length} {results.length === 1 ? "casus" : "casussen"} · {correct} keer de juiste diagnose · gemiddelde zelfscore{" "}
          {avg.toFixed(1).replace(".", ",")}
        </p>
        <p className="text-sm text-muted">Kaarten die je maakte staan als concept op Goedkeuren.</p>
        <div className="flex gap-2">
          <Link className="underline" href="/goedkeuren">Naar Goedkeuren</Link>
          <Link className="underline" href="/casussen">Terug naar casussen</Link>
        </div>
      </Panel>
    );
  }

  return (
    <CaseRunner
      key={cases[index].id}
      c={cases[index]}
      position={`${index + 1} van ${cases.length}`}
      last={index === cases.length - 1}
      sessionId={sessionId}
      aiEnabled={aiEnabled}
      onDone={(r) => {
        setResults((rs) => [...rs, r]);
        setIndex((i) => i + 1);
      }}
    />
  );
}

function CaseRunner({
  c,
  position,
  last,
  sessionId,
  aiEnabled,
  onDone,
}: {
  c: PublicCase;
  position: string;
  last: boolean;
  sessionId: string;
  aiEnabled: boolean;
  onDone: (r: Result) => void;
}) {
  const [startedAt] = useState(() => Date.now());
  const [step, setStep] = useState<Step>("diagnose");
  const [working, setWorking] = useState("");
  const [rows, setRows] = useState<Reflection[]>([emptyRow()]);
  const [cuedList, setCuedList] = useState<string[] | null>(null);
  const [ranking, setRanking] = useState<string[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [expert, setExpert] = useState<Expert | null>(null);
  const [feedback, setFeedback] = useState<CaseFeedback | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const attempt = (): AttemptInput => ({
    working_diagnosis: working.trim(),
    reflection: rows.filter((r) => r.diagnosis.trim()),
    final_ranking: ranking,
  });

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError(null);
      try {
        await fn();
      } catch {
        setError("Dat lukte niet. Controleer je verbinding en probeer het opnieuw.");
      }
    });

  const updateRow = (i: number, patch: Partial<Reflection>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const alternatives = rows.slice(1);
  const canHint = ["diagnose", "reflect", "alternatives", "rank"].includes(step) && hints.length < MAX_HINTS;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>
          Casus {position} · {STEP_LABELS[step]}
        </span>
        <Badge>{c.topic_name}</Badge>
      </div>

      <Panel className="space-y-2">
        <h2 className="text-lg font-semibold">{c.title}</h2>
        <p className="prose-card">{c.vignette}</p>
        <p className="font-medium">{c.question}</p>
      </Panel>

      {hints.length > 0 ? (
        <div className="space-y-1">
          {hints.map((h, i) => (
            <Notice key={i}>
              Hint {i + 1}: {h}
            </Notice>
          ))}
        </div>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      {/* 1. Werkdiagnose */}
      {step === "diagnose" ? (
        <Panel className="space-y-3">
          <Field label="Je werkdiagnose">
            <Input value={working} onChange={(e) => setWorking(e.target.value)} autoFocus />
          </Field>
          <Button
            variant="primary"
            disabled={!working.trim()}
            onClick={() => {
              updateRow(0, { diagnosis: working.trim() });
              setStep("reflect");
            }}
          >
            Volgende
          </Button>
        </Panel>
      ) : null}

      {/* 2. Reflectie op de werkdiagnose */}
      {step === "reflect" ? (
        <Panel className="space-y-3">
          <ReflectionFields row={rows[0]} title={`Werkdiagnose: ${rows[0].diagnosis}`} onChange={(p) => updateRow(0, p)} />
          <Button variant="primary" onClick={() => setStep("alternatives")}>
            Volgende
          </Button>
        </Panel>
      ) : null}

      {/* 3. Alternatieven */}
      {step === "alternatives" ? (
        <Panel className="space-y-4">
          <p className="text-sm">Welke andere diagnoses passen? Vul per alternatief dezelfde drie vragen in.</p>
          {alternatives.map((r, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <Field label={`Alternatief ${i + 1}`}>
                  <Input value={r.diagnosis} onChange={(e) => updateRow(i + 1, { diagnosis: e.target.value })} />
                </Field>
                <button
                  type="button"
                  aria-label={`Alternatief ${i + 1} verwijderen`}
                  className="mt-6 min-h-11 min-w-11 rounded-lg text-muted hover:bg-surface-2"
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i + 1))}
                >
                  ×
                </button>
              </div>
              <ReflectionFields row={r} onChange={(p) => updateRow(i + 1, p)} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRows((rs) => [...rs, emptyRow()])}>+ Alternatief</Button>
            {cuedList === null ? (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => run(async () => setCuedList(await revealAlternativesAction(c.id)))}
              >
                Toon mogelijke alternatieven
              </Button>
            ) : null}
          </div>
          {cuedList ? (
            <div className="space-y-1">
              <p className="text-xs text-muted">Mogelijke diagnoses (zonder uitwerking). Tik om toe te voegen als alternatief:</p>
              <div className="flex flex-wrap gap-2">
                {cuedList.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="min-h-11 rounded-full border border-border bg-surface px-3 text-sm hover:bg-surface-2"
                    onClick={() =>
                      setRows((rs) => (rs.some((r) => r.diagnosis.trim().toLowerCase() === d.toLowerCase()) ? rs : [...rs, emptyRow(d)]))
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Button
            variant="primary"
            disabled={!alternatives.some((r) => r.diagnosis.trim())}
            onClick={() => {
              setRanking(rows.map((r) => r.diagnosis.trim()).filter(Boolean));
              setStep("rank");
            }}
          >
            Volgende
          </Button>
        </Panel>
      ) : null}

      {/* 4. Rangschikken */}
      {step === "rank" ? (
        <Panel className="space-y-3">
          <p className="text-sm">Zet de diagnoses in volgorde van waarschijnlijkheid. Bovenaan staat je eindantwoord.</p>
          <ol className="space-y-2">
            {ranking.map((d, i) => (
              <li key={d} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2">
                <span className="w-6 text-center font-semibold">{i + 1}</span>
                <span className="flex-1">{d}</span>
                <button
                  type="button"
                  aria-label={`${d} omhoog`}
                  disabled={i === 0}
                  onClick={() => setRanking((r) => move(r, i, i - 1))}
                  className="min-h-11 min-w-11 rounded-lg hover:bg-surface-2 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`${d} omlaag`}
                  disabled={i === ranking.length - 1}
                  onClick={() => setRanking((r) => move(r, i, i + 1))}
                  className="min-h-11 min-w-11 rounded-lg hover:bg-surface-2 disabled:opacity-30"
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              run(async () => {
                setExpert(await revealExpertAction(c.id));
                setStep("expert");
              })
            }
          >
            Vergelijk met de expert
          </Button>
        </Panel>
      ) : null}

      {/* Hints tijdens stap 1–4 */}
      {canHint ? (
        <div className="flex items-center gap-2 text-sm">
          <Button
            variant="ghost"
            disabled={!aiEnabled || pending}
            onClick={() =>
              run(async () => {
                const res = await caseHintAction(c.id, attempt(), hints.length + 1);
                if (res.ok) setHints((h) => [...h, res.hint]);
                else setError(res.error);
              })
            }
          >
            Hint ({MAX_HINTS - hints.length} over)
          </Button>
          {!aiEnabled ? <span className="text-xs text-muted">Hints vragen een API-key.</span> : null}
        </div>
      ) : null}

      {/* 5. Expert-uitwerking en AI-feedback */}
      {step === "expert" && expert ? (
        <Panel className="space-y-4">
          <div>
            <p className="text-sm text-muted">Juiste diagnose</p>
            <p className="text-lg font-semibold">{expert.correct_diagnosis}</p>
            <p className="text-sm text-muted">Jouw eindantwoord: {ranking[0]}</p>
          </div>
          <div className="space-y-3">
            {expert.expert_reflection.map((r) => (
              <div key={r.diagnosis} className={`rounded-lg border p-3 text-sm ${r.rank === 1 ? "border-accent" : "border-border"}`}>
                <p className="font-semibold">
                  {r.rank}. {r.diagnosis}
                </p>
                <dl className="mt-1 grid gap-1 md:grid-cols-3">
                  <Def label="Past erbij" value={r.supporting} />
                  <Def label="Spreekt tegen" value={r.against} />
                  <Def label="Verwacht maar afwezig" value={r.missing} />
                </dl>
              </div>
            ))}
          </div>
          {expert.teaching_points ? (
            <div>
              <p className="text-sm font-medium">Lessen</p>
              <p className="prose-card text-sm">{expert.teaching_points}</p>
            </div>
          ) : null}

          {feedback ? (
            <FeedbackView feedback={feedback} />
          ) : (
            <Button
              disabled={!aiEnabled || pending}
              onClick={() =>
                run(async () => {
                  const res = await caseFeedbackAction(c.id, attempt());
                  if (res.ok) {
                    setFeedback(res.feedback);
                    setCorrect((v) => v ?? res.feedback.diagnosis_correct);
                  } else setError(res.error);
                })
              }
            >
              {pending ? "AI kijkt je redenering na…" : "Feedback van AI op je redenering"}
            </Button>
          )}
          <Button variant="primary" onClick={() => setStep("score")}>
            Verder
          </Button>
        </Panel>
      ) : null}

      {/* 6. Zelfscore */}
      {step === "score" ? (
        <Panel className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Was je diagnose juist?</legend>
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={correct === v}
                  onClick={() => setCorrect(v)}
                  className="min-h-11 rounded-lg border border-border px-4 aria-pressed:border-accent aria-pressed:bg-surface-2 aria-pressed:font-semibold"
                >
                  {v ? "Ja" : "Nee"}
                </button>
              ))}
            </div>
          </fieldset>
          {correct === false ? <ErrorChips suggested={errorType} onPick={setErrorType} skipLabel="Weet ik niet" /> : null}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Hoe ging je redenering? (1 = slecht, 5 = uitstekend)</legend>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={score === n}
                  onClick={() => setScore(n)}
                  className="min-h-11 min-w-11 rounded-lg border border-border aria-pressed:border-accent aria-pressed:bg-surface-2 aria-pressed:font-semibold"
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          <Button
            variant="primary"
            disabled={correct === null || score === null || pending}
            onClick={() =>
              run(async () => {
                const res = await saveAttemptAction({
                  caseId: c.id,
                  sessionId,
                  ...attempt(),
                  cued: cuedList !== null,
                  hints_used: hints.length,
                  correct: correct!,
                  error_type: correct ? null : errorType,
                  self_score: score!,
                  ai_feedback: feedback ? JSON.stringify(feedback) : null,
                  duration_ms: Date.now() - startedAt,
                });
                if (res.ok) setStep("card");
                else setError(res.error);
              })
            }
          >
            Opslaan
          </Button>
        </Panel>
      ) : null}

      {/* 7. Kaart van wat ik miste */}
      {step === "card" ? (
        <MissedCard
          caseId={c.id}
          suggestions={[...(feedback?.lessons ?? []), ...(expert?.teaching_points ? [expert.teaching_points] : [])]}
          fromAi={!!feedback}
          next={() => onDone({ correct: correct!, score: score! })}
          nextLabel={last ? "Sessie afronden" : "Volgende casus"}
        />
      ) : null}
    </div>
  );
}

function ReflectionFields({ row, title, onChange }: { row: Reflection; title?: string; onChange: (p: Partial<Reflection>) => void }) {
  return (
    <div className="space-y-2">
      {title ? <p className="font-medium">{title}</p> : null}
      <Field label="Wat past erbij?">
        <Textarea value={row.supporting} onChange={(e) => onChange({ supporting: e.target.value })} rows={2} />
      </Field>
      <Field label="Wat spreekt het tegen?">
        <Textarea value={row.against} onChange={(e) => onChange({ against: e.target.value })} rows={2} />
      </Field>
      <Field label="Wat zou je verwachten, maar ontbreekt?">
        <Textarea value={row.missing} onChange={(e) => onChange({ missing: e.target.value })} rows={2} />
      </Field>
    </div>
  );
}

function Def({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="prose-card">{value || "–"}</dd>
    </div>
  );
}

function FeedbackView({ feedback }: { feedback: CaseFeedback }) {
  return (
    <div className="space-y-2 rounded-lg bg-surface-2 p-3 text-sm">
      <p className="font-medium">Feedback van AI</p>
      <p>
        {feedback.diagnosis_correct ? "Je werkdiagnose was juist." : "Je werkdiagnose was niet juist."}{" "}
        {feedback.decisive_finding ? `Doorslaggevend: ${feedback.decisive_finding}` : null}
      </p>
      {feedback.per_diagnosis.map((d) => (
        <p key={d.diagnosis}>
          <strong>{d.diagnosis}:</strong> goed gezien: {d.seen || "–"}; gemist: {d.missed || "–"}
        </p>
      ))}
      {feedback.missing_alternatives.length ? <p>Ontbrekende alternatieven: {feedback.missing_alternatives.join(", ")}</p> : null}
      {feedback.lessons.length ? (
        <ul className="list-disc pl-5">
          {feedback.lessons.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function MissedCard({
  caseId,
  suggestions,
  fromAi,
  next,
  nextLabel,
}: {
  caseId: string;
  suggestions: string[];
  fromAi: boolean;
  next: () => void;
  nextLabel: string;
}) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState(suggestions[0] ?? "");
  const [made, setMade] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Panel className="space-y-3">
      <p className="font-medium">Maak kaart van wat ik miste</p>
      <p className="text-sm text-muted">Zet het in je eigen woorden: schrijf een vraag die het antwoord afdwingt. De kaart komt als concept op Goedkeuren.</p>
      {suggestions.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setBack(s)}
              className="max-w-full truncate rounded-full border border-border px-3 py-1 text-left text-xs hover:bg-surface-2"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <Field label="Vraag (voorkant)">
        <Textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} />
      </Field>
      <Field label="Antwoord (achterkant)">
        <Textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} />
      </Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {made > 0 ? <Notice tone="ok">{made} conceptkaart(en) gemaakt.</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending || !front.trim() || !back.trim()}
          onClick={() =>
            start(async () => {
              const res = await missedCardAction({ caseId, front, back, fromAi });
              if (res.ok) {
                setMade((n) => n + 1);
                setFront("");
                setError(null);
              } else setError(res.error);
            })
          }
        >
          Maak conceptkaart
        </Button>
        <Button variant="primary" onClick={next}>
          {nextLabel}
        </Button>
      </div>
    </Panel>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}
