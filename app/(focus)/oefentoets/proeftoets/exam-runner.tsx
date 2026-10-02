"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ErrorChips } from "@/components/error-chips";
import { Icon } from "@/components/nav";
import { Button, Eyebrow, Notice, Textarea } from "@/components/ui";
import type { ErrorType } from "@/lib/labels";
import { groupScoresByTopic, scoreByObjective, scoreCells } from "@/lib/exam";
import { markOpenAction, questionCardAction, setQuestionErrorAction, submitExamAction, type ExamResult } from "@/app/(app)/oefentoets/actions";
import { FOOTER_BUTTON, letter, QuestionNav, RunnerFooter, RunnerHeader } from "../runner-ui";

export type ExamQuestion = { id: string; format: "open" | "mcq"; stem: string; options: string[] | null; topic_name: string };
type Answer = { chosen_option: number | null; answer_text: string | null };

/** Proeftoets (ontwerp 1t): één vraag per scherm met vraagoverzicht; nakijken pas na inleveren. */
export function ExamRunner({ questions, sessionId }: { questions: ExamQuestion[]; sessionId: string }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{ results: ExamResult[]; at: Date } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const isAnswered = (q: ExamQuestion) => {
    const a = answers[q.id];
    return q.format === "mcq" ? a?.chosen_option != null : !!a?.answer_text?.trim();
  };
  const answered = questions.filter(isAnswered).length;

  if (result) return <ExamResults initial={result.results} questions={questions} submittedAt={result.at} />;

  const go = (i: number) => {
    setIndex(i);
    window.scrollTo({ top: 0 });
  };

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
      setResult({ results: res.results, at: new Date() });
      window.scrollTo({ top: 0 });
    });
  };

  const q = questions[index];
  const last = index === questions.length - 1;

  return (
    <div data-own-header>
      <RunnerHeader
        title="Proeftoets"
        subtitle={`${questions.length} vragen`}
        action={
          <button type="button" onClick={submit} disabled={pending} className="min-h-11 shrink-0 px-2 text-sm font-bold text-accent disabled:opacity-50">
            {pending ? "Bezig…" : "Inleveren"}
          </button>
        }
      />
      <div className="mx-auto max-w-[720px] px-4 pt-4 md:pb-12 md:pt-6">
        <QuestionNav done={questions.map(isAnswered)} current={index} onPick={go} doneLabel="beantwoord" />
        <p className="mt-2 text-[13px] text-muted">
          {answered} van {questions.length} beantwoord
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-[13px] text-muted">
            Vraag {index + 1} van {questions.length}
          </span>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-text-2">{q.topic_name}</span>
        </div>
        <p className="prose-card mt-3 font-serif text-[22px] font-medium leading-[1.35]">{q.stem}</p>

        {q.format === "mcq" ? (
          <fieldset key={q.id} className="mt-5 flex flex-col gap-2.5">
            <legend className="sr-only">Antwoord op vraag {index + 1}</legend>
            {(q.options ?? []).map((o, j) => (
              <label
                key={j}
                className="flex min-h-14 cursor-pointer items-center gap-3.5 rounded-[14px] border border-border-strong bg-surface px-4 py-3 text-base transition-colors hover:bg-surface-2 motion-reduce:transition-none has-[:checked]:border-2 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:px-[15px] has-[:checked]:font-medium"
              >
                {/* Echte radioknop als lettercirkel: werkt met toetsenbord en schermlezer. */}
                <span className="relative flex h-7 w-7 shrink-0">
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    checked={answers[q.id]?.chosen_option === j}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: { chosen_option: j, answer_text: null } }))}
                    className="peer h-7 w-7 cursor-pointer appearance-none rounded-full border-[1.5px] border-border-strong bg-surface checked:border-accent checked:bg-accent"
                  />
                  <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-bold peer-checked:text-accent-text">
                    {letter(j)}
                  </span>
                </span>
                <span className="prose-card">{o}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <Textarea
            key={q.id}
            aria-label={`Antwoord op vraag ${index + 1}`}
            value={answers[q.id]?.answer_text ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: { chosen_option: null, answer_text: e.target.value } }))}
            className="mt-5 min-h-40"
          />
        )}

        {error ? (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}

        <RunnerFooter>
          <Button className={FOOTER_BUTTON} disabled={index === 0} onClick={() => go(index - 1)}>
            Vorige
          </Button>
          {last ? (
            <Button variant="primary" className={FOOTER_BUTTON} disabled={pending} onClick={submit}>
              {pending ? "Bezig…" : "Inleveren"}
            </Button>
          ) : (
            <Button variant="primary" className={FOOTER_BUTTON} onClick={() => go(index + 1)}>
              Volgende
            </Button>
          )}
        </RunnerFooter>
      </div>
    </div>
  );
}

const CELL: Record<"correct" | "wrong" | "pending", string> = {
  correct: "bg-accent",
  wrong: "bg-danger-soft",
  pending: "border-[1.5px] border-dashed border-border-dashed bg-surface",
};

/** Resultaat (ontwerp 1t): per leerdoel eerst, rechts de vragen die fout gingen of nog na te kijken zijn. */
function ExamResults({ initial, questions, submittedAt }: { initial: ExamResult[]; questions: ExamQuestion[]; submittedAt: Date }) {
  const [results, setResults] = useState(initial);
  const [cards, setCards] = useState<Record<string, "busy" | "done" | string>>({});
  const [errors, setErrors] = useState<Record<string, ErrorType | null>>({});
  // De nakijklijst blijft staan, ook als je een open vraag daarna goed rekent: open vragen eerst.
  const [reviewIds] = useState(() =>
    [...initial.filter((r) => r.correct === null), ...initial.filter((r) => r.correct === false)].map((r) => r.attempt_id),
  );
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([...initial.filter((r) => r.correct === null).map((r) => r.attempt_id), ...initial.filter((r) => r.correct === false).slice(0, 1).map((r) => r.attempt_id)]),
  );

  const topicOf = useMemo(() => new Map(questions.map((q) => [q.id, q.topic_name])), [questions]);
  const groups = useMemo(
    () => groupScoresByTopic(scoreByObjective(results.map((r) => ({ ...r, topic: topicOf.get(r.question_id) ?? null })))),
    [results, topicOf],
  );
  const mcq = results.filter((r) => r.format === "mcq");
  const open = results.filter((r) => r.format === "open");
  const pendingOpen = open.filter((r) => r.correct === null).length;
  const correct = results.filter((r) => r.correct === true).length;
  const toReview = results.filter((r) => r.correct !== true).length;
  const topics = new Set(questions.map((q) => q.topic_name)).size;
  const time = submittedAt.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });

  const mark = async (r: ExamResult, value: boolean) => {
    setResults((rs) => rs.map((x) => (x.attempt_id === r.attempt_id ? { ...x, correct: value } : x)));
    await markOpenAction(r.attempt_id, value).catch(() => null);
  };
  const makeCard = async (r: ExamResult) => {
    setCards((c) => ({ ...c, [r.question_id]: "busy" }));
    const res = await questionCardAction(r.question_id).catch(() => null);
    setCards((c) => ({ ...c, [r.question_id]: res?.ok ? "done" : (res?.error ?? "Mislukt") }));
  };
  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div data-own-header>
      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-2 px-2 md:h-16 md:px-6">
          <Link
            href="/oefentoets"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-2 text-sm text-text-2 transition-colors hover:bg-surface-2 motion-reduce:transition-none md:border md:border-border md:px-3"
          >
            <Icon d="M15 6l-6 6 6 6" size={16} />
            Terug naar Oefentoets
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1120px] px-4 pb-12 pt-6 md:px-6 md:pt-7 lg:grid lg:grid-cols-[1fr_420px] lg:items-start lg:gap-7">
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-1.5">
            <Eyebrow>
              Proeftoets · {topics} {topics === 1 ? "thema" : "thema's"} · ingeleverd {time}
            </Eyebrow>
            <div className="flex flex-wrap items-baseline gap-x-[18px] gap-y-1">
              <h1 className="font-serif text-[36px] font-medium leading-[1.05] md:text-[44px]">
                {correct} van {results.length} goed
              </h1>
              <span className="text-[15px] tabular-nums text-text-2">
                {[mcq.length ? `meerkeuze ${mcq.filter((r) => r.correct).length}/${mcq.length}` : null, open.length ? `open ${open.filter((r) => r.correct).length}/${open.length}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </div>
          {pendingOpen > 0 ? (
            <Notice tone="warn">
              Kijk {pendingOpen} open {pendingOpen === 1 ? "vraag" : "vragen"} zelf na met het modelantwoord; dan klopt de score per leerdoel.
            </Notice>
          ) : null}

          <section aria-labelledby="per-leerdoel" className="flex flex-col gap-2">
            <h2 id="per-leerdoel" className="text-[15px] font-bold">
              Per leerdoel
            </h2>
            <div className="rounded-2xl border border-border bg-surface px-4 pb-3 pt-1.5 md:px-[22px]">
              <table className="w-full border-collapse text-left">
                <colgroup>
                  <col />
                  <col className="w-[72px] md:w-[140px]" />
                  <col className="w-[92px] md:w-[130px]" />
                </colgroup>
                <tbody>
                  {groups.flatMap((g) =>
                    g.items.map((o) => (
                      <tr key={o.id ?? "geen"} className="border-b border-border-subtle last:border-b-0">
                        <td className="py-[9px] pr-4 align-middle">
                          {g.topic ? <span className="block text-[11px] text-muted">{g.topic}</span> : null}
                          <span className="text-sm leading-[1.35]">
                            {o.code ? <b>{o.code}</b> : null} {o.description}
                          </span>
                        </td>
                        <td className="py-[9px] pr-4 align-middle">
                          <div aria-hidden className="flex gap-[3px]">
                            {scoreCells(o).map((c, i) => (
                              <span key={i} className={`h-2.5 flex-1 rounded-[3px] ${CELL[c]}`} />
                            ))}
                          </div>
                        </td>
                        <td className={`py-[9px] text-right align-middle text-sm font-bold tabular-nums ${o.correct < o.total - o.pending ? "text-danger" : ""}`}>
                          {o.correct}/{o.total}
                          {o.pending ? <span className="block text-xs font-normal text-muted md:inline"> · {o.pending} na te kijken</span> : null}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section aria-labelledby="fout" className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface px-4 py-5 md:px-[22px] lg:mt-0">
          <div className="flex items-baseline justify-between">
            <h2 id="fout" className="text-base font-bold">
              Fout beantwoord
            </h2>
            <span className="text-[13px] tabular-nums text-muted">{toReview}</span>
          </div>
          {reviewIds.length === 0 ? <p className="text-sm text-muted">Geen fouten in deze proeftoets.</p> : null}
          {reviewIds.map((id) => {
            const r = results.find((x) => x.attempt_id === id)!;
            const card = cards[r.question_id];
            if (!expanded.has(id)) {
              return (
                <div key={id} className="flex items-center gap-2.5 rounded-xl border border-border px-3.5 py-3">
                  <button type="button" aria-expanded={false} onClick={() => toggle(id)} className="line-clamp-2 flex-1 text-left font-serif text-[15px] leading-[1.4]">
                    {r.stem}
                  </button>
                  {card === "done" ? (
                    <span className="shrink-0 text-[13px] text-accent">✓ Op Goedkeuren</span>
                  ) : r.correct === false ? (
                    <button type="button" disabled={card === "busy"} onClick={() => makeCard(r)} className="min-h-9 shrink-0 text-[13px] font-bold text-accent disabled:opacity-50">
                      Maak kaart
                    </button>
                  ) : r.correct === null ? (
                    <button type="button" onClick={() => toggle(id)} className="min-h-9 shrink-0 text-[13px] font-bold text-warn-text">
                      Nakijken
                    </button>
                  ) : (
                    <span className="shrink-0 text-[13px] text-accent-strong">Goed</span>
                  )}
                </div>
              );
            }
            return (
              <div key={id} className="flex flex-col gap-2.5 rounded-xl border border-border p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="prose-card font-serif text-base leading-[1.4]">{r.stem}</p>
                  <button type="button" aria-expanded onClick={() => toggle(id)} className="min-h-8 shrink-0 text-xs text-muted hover:text-text">
                    Inklappen
                  </button>
                </div>
                {r.format === "mcq" ? (
                  <div className="flex flex-col gap-[3px] text-[13px]">
                    {r.chosen_option === null ? (
                      <span className="text-danger">Niet beantwoord</span>
                    ) : r.chosen_option !== r.correct_option ? (
                      <span className="text-danger line-through">
                        {letter(r.chosen_option)}. {r.options?.[r.chosen_option]} (jouw keuze)
                      </span>
                    ) : null}
                    {r.correct_option !== null ? (
                      <span className="font-bold text-accent-strong">
                        {letter(r.correct_option)}. {r.options?.[r.correct_option]} ✓
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 text-[13px]">
                    <div className="rounded-lg bg-surface-2 px-3 py-2">
                      <p className="text-xs text-muted">Jouw antwoord</p>
                      <p className="prose-card">{r.answer_text?.trim() || "–"}</p>
                    </div>
                    <div className="px-1">
                      <p className="text-xs text-muted">Modelantwoord</p>
                      <p className="prose-card">{r.model_answer || "–"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold">Had je het goed?</span>
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          aria-pressed={r.correct === v}
                          onClick={() => mark(r, v)}
                          className="min-h-10 rounded-[10px] border border-border-strong bg-surface px-4 text-sm hover:bg-surface-2 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-bold"
                        >
                          {v ? "Goed" : "Fout"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {r.explanation ? <p className="prose-card text-[13px] text-muted">{r.explanation}</p> : null}
                {r.correct === false ? (
                  <>
                    <ErrorChips
                      size="sm"
                      suggested={errors[r.attempt_id] ?? null}
                      skipLabel="Weet ik niet"
                      onPick={(t) => {
                        setErrors((e) => ({ ...e, [r.attempt_id]: t }));
                        void setQuestionErrorAction(r.attempt_id, t).catch(() => null);
                      }}
                    />
                    {card === "done" ? (
                      <p className="text-sm text-accent">Conceptkaart gemaakt; staat op Goedkeuren.</p>
                    ) : (
                      <div className="space-y-1">
                        <Button className="h-10 w-full" disabled={card === "busy"} onClick={() => makeCard(r)}>
                          Maak kaart van deze vraag
                        </Button>
                        {card && card !== "busy" ? <p className="text-sm text-danger">{card}</p> : null}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
