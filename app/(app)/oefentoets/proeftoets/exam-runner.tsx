"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ErrorChips } from "@/components/error-chips";
import { Badge, Button, Notice, Panel, Textarea } from "@/components/ui";
import type { ErrorType } from "@/lib/labels";
import { scoreByObjective } from "@/lib/exam";
import { markOpenAction, questionCardAction, setQuestionErrorAction, submitExamAction, type ExamResult } from "../actions";

export type ExamQuestion = { id: string; format: "open" | "mcq"; stem: string; options: string[] | null; topic_name: string };
type Answer = { chosen_option: number | null; answer_text: string | null };

const letter = (i: number) => String.fromCharCode(65 + i);

export function ExamRunner({ questions, sessionId }: { questions: ExamQuestion[]; sessionId: string }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [results, setResults] = useState<ExamResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const answered = questions.filter((q) => {
    const a = answers[q.id];
    return q.format === "mcq" ? a?.chosen_option != null : !!a?.answer_text?.trim();
  }).length;

  if (results) return <ExamResults initial={results} />;

  const submit = () => {
    if (answered < questions.length && !window.confirm(`Je hebt ${questions.length - answered} vra(a)g(en) niet beantwoord. Toch inleveren?`)) return;
    start(async () => {
      const res = await submitExamAction({
        sessionId,
        answers: questions.map((q) => ({
          questionId: q.id,
          chosen_option: answers[q.id]?.chosen_option ?? null,
          answer_text: answers[q.id]?.answer_text ?? null,
        })),
      }).catch(() => null);
      if (!res || !res.ok) return setError(res?.error ?? "Geen verbinding. Je antwoorden staan nog hier; probeer opnieuw.");
      setResults(res.results);
      window.scrollTo({ top: 0 });
    });
  };

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      {questions.map((q, i) => (
        <Panel key={q.id} className="space-y-3">
          <div className="flex items-center justify-between gap-2 text-sm text-muted">
            <span>Vraag {i + 1}</span>
            <Badge>{q.topic_name}</Badge>
          </div>
          <p className="prose-card font-medium">{q.stem}</p>
          {q.format === "mcq" ? (
            <fieldset className="space-y-2">
              <legend className="sr-only">Antwoord op vraag {i + 1}</legend>
              {(q.options ?? []).map((o, j) => (
                <label key={j} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-[:checked]:border-accent has-[:checked]:bg-surface-2">
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id]?.chosen_option === j}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: { chosen_option: j, answer_text: null } }))}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <strong>{letter(j)}.</strong> {o}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <Textarea
              aria-label={`Antwoord op vraag ${i + 1}`}
              value={answers[q.id]?.answer_text ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: { chosen_option: null, answer_text: e.target.value } }))}
              rows={4}
            />
          )}
        </Panel>
      ))}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 border-t border-border bg-bg/95 px-4 py-2 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <span className="text-sm text-muted">
          {answered} van {questions.length} beantwoord
        </span>
        <Button variant="primary" disabled={pending} onClick={submit}>
          {pending ? "Bezig…" : "Inleveren"}
        </Button>
      </div>
    </div>
  );
}

function ExamResults({ initial }: { initial: ExamResult[] }) {
  const [results, setResults] = useState(initial);
  const [cards, setCards] = useState<Record<string, "busy" | "done" | string>>({});
  const [errors, setErrors] = useState<Record<string, ErrorType | null>>({});
  const byObjective = useMemo(() => scoreByObjective(results), [results]);
  const mcq = results.filter((r) => r.format === "mcq");
  const open = results.filter((r) => r.format === "open");
  const pendingOpen = open.filter((r) => r.correct === null).length;
  const correct = results.filter((r) => r.correct === true).length;

  const mark = async (r: ExamResult, value: boolean) => {
    setResults((rs) => rs.map((x) => (x.attempt_id === r.attempt_id ? { ...x, correct: value } : x)));
    await markOpenAction(r.attempt_id, value).catch(() => null);
  };
  const makeCard = async (r: ExamResult) => {
    setCards((c) => ({ ...c, [r.question_id]: "busy" }));
    const res = await questionCardAction(r.question_id).catch(() => null);
    setCards((c) => ({ ...c, [r.question_id]: res?.ok ? "done" : (res?.error ?? "Mislukt") }));
  };

  return (
    <div className="space-y-6">
      <Panel className="space-y-2">
        <p className="text-lg font-medium">Resultaat</p>
        <p>
          {correct} van {results.length} goed
          {mcq.length ? ` · meerkeuze ${mcq.filter((r) => r.correct).length}/${mcq.length}` : ""}
          {open.length ? ` · open ${open.filter((r) => r.correct).length}/${open.length}` : ""}
        </p>
        {pendingOpen > 0 ? (
          <Notice>Kijk hieronder {pendingOpen} open vra(a)g(en) zelf na met het modelantwoord; dan klopt de score per leerdoel.</Notice>
        ) : null}
      </Panel>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Per leerdoel</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Leerdoel</th>
                <th className="py-1 pr-3 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {byObjective.map((o) => (
                <tr key={o.id ?? "geen"} className="border-t border-border align-top">
                  <td className="py-2 pr-3">
                    {o.code ? <strong>{o.code} </strong> : null}
                    {o.description}
                  </td>
                  <td className={`py-2 pr-3 text-right tabular-nums ${o.correct < o.total - o.pending ? "text-danger" : ""}`}>
                    {o.correct}/{o.total}
                    {o.pending ? <span className="block text-xs text-muted">{o.pending} na te kijken</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Nakijken</h2>
        {results.map((r, i) => (
          <Panel key={r.attempt_id} className={`space-y-2 ${r.correct === false ? "border-danger" : ""}`}>
            <p className="text-sm text-muted">
              Vraag {i + 1} · {r.correct === null ? "nog na te kijken" : r.correct ? "goed" : "fout"}
            </p>
            <p className="prose-card font-medium">{r.stem}</p>
            {r.format === "mcq" ? (
              <ul className="space-y-1 text-sm">
                {(r.options ?? []).map((o, j) => (
                  <li key={j} className={j === r.correct_option ? "font-semibold text-good" : j === r.chosen_option ? "text-danger line-through" : ""}>
                    {letter(j)}. {o}
                    {j === r.correct_option ? " ✓" : ""}
                    {j === r.chosen_option && j !== r.correct_option ? " (jouw keuze)" : ""}
                  </li>
                ))}
                {r.chosen_option === null ? <li className="text-danger">Niet beantwoord</li> : null}
              </ul>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="rounded-lg bg-surface-2 p-2">
                  <p className="text-xs text-muted">Jouw antwoord</p>
                  <p className="prose-card">{r.answer_text?.trim() || "–"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Modelantwoord</p>
                  <p className="prose-card">{r.model_answer || "–"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span>Had je het goed?</span>
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      aria-pressed={r.correct === v}
                      onClick={() => mark(r, v)}
                      className="min-h-11 rounded-lg border border-border px-4 aria-pressed:border-accent aria-pressed:bg-surface-2 aria-pressed:font-semibold"
                    >
                      {v ? "Goed" : "Fout"}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {r.explanation ? <p className="prose-card text-sm text-muted">{r.explanation}</p> : null}
            {r.correct === false ? (
              <ErrorChips
                suggested={errors[r.attempt_id] ?? null}
                skipLabel="Weet ik niet"
                onPick={(t) => {
                  setErrors((e) => ({ ...e, [r.attempt_id]: t }));
                  void setQuestionErrorAction(r.attempt_id, t).catch(() => null);
                }}
              />
            ) : null}
            {r.correct === false ? (
              cards[r.question_id] === "done" ? (
                <p className="text-sm text-good">Conceptkaart gemaakt; staat op Goedkeuren.</p>
              ) : (
                <div className="space-y-1">
                  <Button disabled={cards[r.question_id] === "busy"} onClick={() => makeCard(r)}>
                    Maak kaart van deze vraag
                  </Button>
                  {cards[r.question_id] && cards[r.question_id] !== "busy" ? <p className="text-sm text-danger">{cards[r.question_id]}</p> : null}
                </div>
              )
            ) : null}
          </Panel>
        ))}
      </section>
      <Link className="underline" href="/oefentoets">Terug naar Oefentoets</Link>
    </div>
  );
}
