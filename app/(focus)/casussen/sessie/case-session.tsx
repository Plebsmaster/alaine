"use client";

import Link from "next/link";
import { type ComponentProps, type PointerEvent, useLayoutEffect, useRef, useState, useTransition } from "react";
import { ErrorChips } from "@/components/error-chips";
import { Icon } from "@/components/nav";
import { Button, Eyebrow, Field, Input, Notice, Panel, Textarea } from "@/components/ui";
import type { ErrorType } from "@/lib/labels";
import type { CaseFeedback } from "@/lib/ai/schemas";
import { MAX_HINTS, moveItem, sameDiagnosis, type ExpertReflection, type Reflection } from "@/lib/cases";
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
/** Laptop: stap 2 tot 4 zijn samen de reflectietabel. Telefoon: binnen "table" stapsgewijs. */
type Step = "diagnose" | "table" | "expert" | "score" | "card";
type PhoneStep = "reflect" | "alternatives" | "rank";
type Result = { correct: boolean; score: number };
/** Volgorde van de rijen = rangschikking; de werkdiagnose is de rij met `working`. */
type Row = Reflection & { key: string; working?: boolean };

const STEPS: { step: Step; label: string }[] = [
  { step: "diagnose", label: "Werkdiagnose" },
  { step: "table", label: "Reflectietabel" },
  { step: "expert", label: "Expert" },
  { step: "score", label: "Zelfscore" },
  { step: "card", label: "Wat miste je?" },
];
const PHONE_TITLES: Record<Exclude<Step, "table">, string> & Record<PhoneStep, string> = {
  diagnose: "Werkdiagnose",
  reflect: "Reflectie",
  alternatives: "Alternatieven",
  rank: "Rangschikken",
  expert: "Vergelijken met de expert",
  score: "Zelfscore",
  card: "Wat miste je?",
};
const COLUMNS = [
  { key: "supporting", label: "Wat past erbij?", long: "Wat past erbij?" },
  { key: "against", label: "Wat spreekt het tegen?", long: "Wat spreekt het tegen?" },
  { key: "missing", label: "Verwacht, maar ontbreekt", long: "Wat zou je verwachten, maar ontbreekt?" },
] as const;

const CHECK = "M4 12l5 5L20 6";
const CROSS = "M6 6l12 12M18 6L6 18";

let rowSeq = 0;
const newRow = (diagnosis = ""): Row => ({ key: `r${++rowSeq}`, diagnosis, supporting: "", against: "", missing: "" });
const rowName = (r: Row, i: number) => r.diagnosis.trim() || `Alternatief ${i}`;

export function CaseSession({ cases, sessionId, aiEnabled }: { cases: PublicCase[]; sessionId: string; aiEnabled: boolean }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  if (index >= cases.length) {
    const correct = results.filter((r) => r.correct).length;
    const avg = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
    return (
      <Panel className="mt-4 space-y-3">
        <h1 className="font-serif text-[26px] font-medium">Sessie klaar</h1>
        <p className="text-[15px]">
          {results.length} {results.length === 1 ? "casus" : "casussen"} · {correct} keer de juiste diagnose · gemiddelde zelfscore{" "}
          {avg.toFixed(1).replace(".", ",")}
        </p>
        <p className="text-sm text-muted">Kaarten die je maakte staan als concept op Goedkeuren.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link className="inline-flex min-h-11 items-center rounded-[10px] border border-border-strong bg-surface px-4 text-[15px] hover:bg-surface-2" href="/goedkeuren">
            Naar Goedkeuren
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-[10px] px-4 text-[15px] text-text-2 hover:bg-surface-2" href="/casussen">
            Terug naar casussen
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <CaseRunner
      key={cases[index].id}
      c={cases[index]}
      index={index}
      total={cases.length}
      sessionId={sessionId}
      aiEnabled={aiEnabled}
      onDone={(r) => {
        setResults((rs) => [...rs, r]);
        setIndex((i) => i + 1);
        window.scrollTo(0, 0);
      }}
    />
  );
}

function CaseRunner({
  c,
  index,
  total,
  sessionId,
  aiEnabled,
  onDone,
}: {
  c: PublicCase;
  index: number;
  total: number;
  sessionId: string;
  aiEnabled: boolean;
  onDone: (r: Result) => void;
}) {
  const [startedAt] = useState(() => Date.now());
  const [step, setStep] = useState<Step>("diagnose");
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("reflect");
  const [working, setWorking] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [cuedList, setCuedList] = useState<string[] | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [expert, setExpert] = useState<Expert | null>(null);
  const [feedback, setFeedback] = useState<CaseFeedback | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const named = rows.filter((r) => r.diagnosis.trim());
  const attempt = (): AttemptInput => ({
    working_diagnosis: working.trim(),
    reflection: named.map(({ diagnosis, supporting, against, missing }) => ({ diagnosis: diagnosis.trim(), supporting, against, missing })),
    final_ranking: named.map((r) => r.diagnosis.trim()),
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

  const updateRow = (key: string, patch: Partial<Reflection>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key));
  const addRow = (diagnosis = "") =>
    setRows((rs) => (diagnosis && rs.some((r) => sameText(r.diagnosis, diagnosis)) ? rs : [...rs, newRow(diagnosis)]));
  const moveRow = (from: number, to: number) => setRows((rs) => moveItem(rs, from, to));

  const workingRow = rows.find((r) => r.working);
  // Eerst zelf nadenken: de differentiaal pas na minstens één kolom bij de werkdiagnose.
  const workingFilled = !!workingRow && [workingRow.supporting, workingRow.against, workingRow.missing].some((v) => v.trim());
  const canCompare = rows.some((r) => !r.working && r.diagnosis.trim());
  const canHint = (step === "diagnose" || step === "table") && hints.length < MAX_HINTS;

  const revealAlternatives = () => run(async () => setCuedList(await revealAlternativesAction(c.id)));
  const compare = () =>
    run(async () => {
      setRows((rs) => rs.filter((r) => r.working || r.diagnosis.trim()));
      setExpert(await revealExpertAction(c.id));
      setStep("expert");
      window.scrollTo(0, 0);
    });

  const phoneTitle = step === "table" ? PHONE_TITLES[phoneStep] : PHONE_TITLES[step];
  const stepLabel = STEPS.find((s) => s.step === step)!.label;
  const shared = { rows, cuedList, workingFilled, pending, updateRow, removeRow, addRow, moveRow, revealAlternatives };

  return (
    <div data-own-header className="min-h-dvh md:flex md:flex-col">
      {/* Kop: stoppen, stappen, positie. */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface px-2 md:h-16 md:gap-6 md:px-7">
        <Link
          href="/casussen"
          aria-label="Stoppen"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-[10px] text-sm text-text-2 transition-colors hover:bg-surface-2 motion-reduce:transition-none md:h-10 md:w-auto md:border md:border-border md:px-3"
        >
          <Icon d={CROSS} size={16} />
          <span className="hidden md:inline">Stoppen</span>
        </Link>
        <span className="flex-1 text-sm font-bold md:hidden">{phoneTitle}</span>
        <span className="pr-2 text-[13px] tabular-nums text-muted md:hidden">
          {index + 1} / {total}
        </span>
        <ol aria-label="Stappen" className="mx-auto hidden items-center gap-1.5 text-[13px] md:flex">
          {STEPS.map((s, i) => {
            const at = STEPS.findIndex((x) => x.step === step);
            return (
              <li key={s.step} className="flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden className="h-px w-5 bg-border-strong" /> : null}
                {i < at ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-accent">
                    <Icon d={CHECK} size={13} strokeWidth={2.4} />
                    {s.label}
                  </span>
                ) : i === at ? (
                  <span aria-current="step" className="rounded-full bg-accent px-3 py-1.5 font-bold text-accent-text">
                    {s.label}
                  </span>
                ) : (
                  <span className="px-3 py-1.5 text-muted">{s.label}</span>
                )}
              </li>
            );
          })}
        </ol>
        <span className="hidden text-[13px] tabular-nums text-muted md:inline">
          Casus {index + 1} van {total}
        </span>
      </header>

      <div className="md:grid md:flex-1 md:grid-cols-[380px_1fr]">
        {/* Vignet en hints. Op de telefoon alleen tot en met het rangschikken. */}
        <aside
          className={`border-b border-border bg-surface-sunk px-4 py-4 md:sticky md:top-16 md:flex md:h-[calc(100dvh-4rem)] md:flex-col md:gap-3 md:overflow-y-auto md:border-b-0 md:border-r md:px-[30px] md:py-7 ${
            step === "diagnose" || step === "table" ? "" : "max-md:hidden"
          }`}
        >
          <Eyebrow>{c.topic_name} · Vignet</Eyebrow>
          <h1 className="mt-1 font-serif text-[22px] font-medium leading-[1.2] md:mt-0 md:text-2xl">{c.title}</h1>
          <p className="prose-card mt-2 font-serif text-base leading-[1.6] md:mt-0 md:text-[17px] md:leading-[1.65]">{c.vignette}</p>
          <p className="mt-2 text-[15px] font-bold md:mt-0">{c.question}</p>
          {hints.length > 0 || canHint ? (
            <div className="mt-4 space-y-2 md:mt-auto">
              {hints.map((h, i) => (
                <p key={i} className="rounded-[10px] bg-warn-bg px-3 py-2.5 text-[13px] leading-[1.45] text-warn-text-strong">
                  <b>Hint {i + 1}:</b> {h}
                </p>
              ))}
              {canHint ? (
                aiEnabled ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const res = await caseHintAction(c.id, attempt(), hints.length + 1);
                        if (res.ok) setHints((h) => [...h, res.hint]);
                        else setError(res.error);
                      })
                    }
                    className="min-h-11 text-[13px] font-bold text-warn-text disabled:opacity-50"
                  >
                    {hints.length ? "Nog een hint" : "Hint"} · {MAX_HINTS - hints.length} over
                  </button>
                ) : (
                  <p className="text-[13px] text-muted">Hints vragen een API-key.</p>
                )
              ) : null}
            </div>
          ) : null}
        </aside>

        {/* Werkpaneel */}
        <section aria-label={stepLabel} className="flex flex-col gap-3.5 px-4 py-5 md:px-[30px] md:py-7">
          {error ? <Notice tone="error">{error}</Notice> : null}

          {step === "diagnose" ? (
            <div className="space-y-3 md:max-w-[520px]">
              <Field label="Je werkdiagnose">
                <Input value={working} onChange={(e) => setWorking(e.target.value)} autoFocus />
              </Field>
              <Button
                variant="primary"
                className="h-12 w-full md:w-auto"
                disabled={!working.trim()}
                onClick={() => {
                  setRows([{ ...newRow(working.trim()), working: true }]);
                  setStep("table");
                }}
              >
                Volgende
              </Button>
            </div>
          ) : null}

          {step === "table" ? (
            <>
              <div className="hidden md:contents">
                <ReflectionTable {...shared} canCompare={canCompare} onCompare={compare} />
              </div>
              <div className="md:hidden">
                <PhoneReflection {...shared} step={phoneStep} setStep={setPhoneStep} canCompare={canCompare} onCompare={compare} />
              </div>
            </>
          ) : null}

          {step === "expert" && expert ? (
            <ExpertView
              expert={expert}
              finalAnswer={named[0]?.diagnosis.trim() ?? working.trim()}
              feedback={feedback}
              aiEnabled={aiEnabled}
              pending={pending}
              onFeedback={() =>
                run(async () => {
                  const res = await caseFeedbackAction(c.id, attempt());
                  if (res.ok) {
                    setFeedback(res.feedback);
                    setCorrect((v) => v ?? res.feedback.diagnosis_correct);
                  } else setError(res.error);
                })
              }
              onNext={() => {
                setStep("score");
                window.scrollTo(0, 0);
              }}
            />
          ) : null}

          {step === "score" ? (
            <div className="space-y-6 md:max-w-[560px]">
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-bold">Was je diagnose juist?</legend>
                <div className="flex gap-2">
                  {[true, false].map((v) => (
                    <button key={String(v)} type="button" aria-pressed={correct === v} onClick={() => setCorrect(v)} className={`${CHOICE} min-w-20`}>
                      {v ? "Ja" : "Nee"}
                    </button>
                  ))}
                </div>
              </fieldset>
              {correct === false ? <ErrorChips suggested={errorType} onPick={setErrorType} skipLabel="Weet ik niet" shortcuts={false} /> : null}
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-bold">Hoe ging je redenering? (1 = slecht, 5 = uitstekend)</legend>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-pressed={score === n} onClick={() => setScore(n)} className={`${CHOICE} min-w-11 flex-1 md:flex-none`}>
                      {n}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Button
                variant="primary"
                className="h-12 w-full md:w-auto"
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
            </div>
          ) : null}

          {step === "card" ? (
            <MissedCard
              caseId={c.id}
              suggestions={[...(feedback?.lessons ?? []), ...(expert?.teaching_points ? [expert.teaching_points] : [])]}
              fromAi={!!feedback}
              next={() => onDone({ correct: correct!, score: score! })}
              nextLabel={index === total - 1 ? "Sessie afronden" : "Volgende casus"}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

const CHOICE =
  "min-h-11 rounded-[10px] border border-border-strong bg-surface px-4 text-[15px] transition-colors hover:bg-surface-2 motion-reduce:transition-none aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:font-bold";

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type Shared = {
  rows: Row[];
  cuedList: string[] | null;
  workingFilled: boolean;
  pending: boolean;
  updateRow: (key: string, patch: Partial<Reflection>) => void;
  removeRow: (key: string) => void;
  addRow: (diagnosis?: string) => void;
  moveRow: (from: number, to: number) => void;
  revealAlternatives: () => void;
};

/** "Toon mogelijke alternatieven" en de chips; pas na eigen denkwerk bij de werkdiagnose. */
function Alternatives({ rows, cuedList, workingFilled, pending, addRow, revealAlternatives }: Shared) {
  if (cuedList === null) {
    return (
      <>
        <button
          type="button"
          disabled={!workingFilled || pending}
          onClick={revealAlternatives}
          className="min-h-11 text-sm text-text-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          Toon mogelijke alternatieven
        </button>
        {!workingFilled ? <span className="text-[13px] text-muted">Vul eerst minstens één kolom bij je werkdiagnose in.</span> : null}
      </>
    );
  }
  return (
    <div role="group" aria-label="Mogelijke diagnoses" className="w-full space-y-1.5">
      <p className="text-xs text-muted">Mogelijke diagnoses (zonder uitwerking). Tik om toe te voegen als alternatief:</p>
      <div className="flex flex-wrap gap-2">
        {cuedList.map((d) => {
          const added = rows.some((r) => sameText(r.diagnosis, d));
          return (
            <button
              key={d}
              type="button"
              aria-pressed={added}
              onClick={() => addRow(d)}
              className="min-h-11 rounded-full border border-border-strong bg-surface px-3.5 text-sm hover:bg-surface-2 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-strong"
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Meegroeiend tekstvak (alleen gemeten als het zichtbaar is). */
function GrowingTextarea({ value, ...props }: ComponentProps<"textarea"> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.offsetParent === null) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={2} value={value} {...props} />;
}

function Grip() {
  return (
    <svg viewBox="0 0 10 16" width={10} height={16} fill="currentColor" aria-hidden>
      {[3, 8, 13].map((y) => (
        <g key={y}>
          <circle cx="2.5" cy={y} r="1.3" />
          <circle cx="7.5" cy={y} r="1.3" />
        </g>
      ))}
    </svg>
  );
}

/** Laptop: stap 2 tot 4 in één tabel. Rijvolgorde = rangschikking; slepen of ↑/↓. */
function ReflectionTable(props: Shared & { canCompare: boolean; onCompare: () => void }) {
  const { rows, pending, updateRow, removeRow, addRow, moveRow, canCompare, onCompare } = props;
  const listRef = useRef<HTMLOListElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const onGripDown = (key: string) => (e: PointerEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(key);
  };
  const onGripMove = (key: string) => (e: PointerEvent<HTMLSpanElement>) => {
    if (dragging !== key || !listRef.current) return;
    const items = [...listRef.current.querySelectorAll<HTMLElement>("[data-row]")];
    const from = items.findIndex((el) => el.dataset.row === key);
    let to = items.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return e.clientY < r.top + r.height / 2;
    });
    if (to === -1) to = items.length - 1;
    else if (to > from) to -= 1;
    if (to !== from) moveRow(from, to);
  };

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-bold">Reflectietabel</h2>
        <p className="text-[13px] text-muted">Sleep om te rangschikken; bovenaan staat je eindantwoord.</p>
      </div>
      <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
        <div aria-hidden className="grid grid-cols-[44px_170px_1fr_1fr_1fr] border-b border-border bg-surface-sunk text-xs font-bold text-muted">
          <span className="py-2.5 text-center">#</span>
          <span className="px-3 py-2.5">Diagnose</span>
          {COLUMNS.map((col) => (
            <span key={col.key} className="px-3 py-2.5">
              {col.label}
            </span>
          ))}
        </div>
        <ol ref={listRef} aria-label="Diagnoses, op volgorde van waarschijnlijkheid">
          {rows.map((r, i) => {
            const name = rowName(r, i);
            return (
              <li
                key={r.key}
                data-row={r.key}
                className={`group grid grid-cols-[44px_170px_1fr_1fr_1fr] border-b border-border-subtle text-[13px] leading-[1.45] ${
                  dragging === r.key ? "bg-accent-soft" : ""
                }`}
              >
                <div className="flex flex-col items-center gap-1.5 py-3 text-faint">
                  <span className="text-[15px] font-bold text-text">{i + 1}</span>
                  <span
                    data-grip
                    title="Sleep om te verplaatsen"
                    onPointerDown={onGripDown(r.key)}
                    onPointerMove={onGripMove(r.key)}
                    onPointerUp={() => setDragging(null)}
                    onPointerCancel={() => setDragging(null)}
                    className="flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-md hover:bg-surface-2 hover:text-muted active:cursor-grabbing"
                  >
                    <Grip />
                  </span>
                </div>
                <div className="flex flex-col gap-1 p-3">
                  {r.working ? (
                    <span className="text-sm font-bold">{r.diagnosis}</span>
                  ) : (
                    <input
                      value={r.diagnosis}
                      onChange={(e) => updateRow(r.key, { diagnosis: e.target.value })}
                      aria-label={`Diagnose ${i + 1}`}
                      placeholder="Diagnose"
                      className="w-full bg-transparent text-sm font-bold placeholder:font-normal placeholder:text-muted"
                    />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    {r.working ? (
                      <span className="text-[11px] text-accent-strong">Werkdiagnose</span>
                    ) : (
                      <button type="button" onClick={() => removeRow(r.key)} aria-label={`${name} verwijderen`} className="text-[11px] text-muted hover:text-danger">
                        Verwijderen
                      </button>
                    )}
                    {/* Rangschikken met het toetsenbord; zichtbaar bij aanwijzen of focus. */}
                    <span className="flex opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none">
                      <button type="button" aria-label={`${name} omhoog`} disabled={i === 0} onClick={() => moveRow(i, i - 1)} className={ARROW}>
                        ↑
                      </button>
                      <button type="button" aria-label={`${name} omlaag`} disabled={i === rows.length - 1} onClick={() => moveRow(i, i + 1)} className={ARROW}>
                        ↓
                      </button>
                    </span>
                  </div>
                </div>
                {COLUMNS.map((col) => (
                  <div key={col.key} className="border-l border-border-subtle focus-within:bg-surface-sunk">
                    <GrowingTextarea
                      value={r[col.key]}
                      onChange={(e) => updateRow(r.key, { [col.key]: e.target.value })}
                      aria-label={`${col.long} (${name})`}
                      placeholder={col.label}
                      className="block w-full resize-none bg-transparent p-3 placeholder:text-muted"
                    />
                  </div>
                ))}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2">
          <button type="button" onClick={() => addRow()} className="min-h-11 text-sm font-bold text-accent">
            + Alternatief
          </button>
          <Alternatives {...props} />
        </div>
      </div>
      <div className="mt-auto flex justify-end pt-2">
        <Button variant="primary" className="h-12 px-[22px]" disabled={!canCompare || pending} onClick={onCompare}>
          Vergelijk met de expert
        </Button>
      </div>
    </>
  );
}

const ARROW = "flex h-6 w-7 items-center justify-center rounded text-sm text-muted hover:bg-surface-2 hover:text-text disabled:opacity-30";

/** Telefoon: reflectie, alternatieven en rangschikken na elkaar. */
function PhoneReflection(
  props: Shared & { step: PhoneStep; setStep: (s: PhoneStep) => void; canCompare: boolean; onCompare: () => void },
) {
  const { rows, step, setStep, pending, updateRow, removeRow, addRow, moveRow, canCompare, onCompare } = props;
  const workingRow = rows.find((r) => r.working);

  if (step === "reflect" && workingRow) {
    return (
      <div className="space-y-3">
        <p className="text-[15px] font-bold">Werkdiagnose: {workingRow.diagnosis}</p>
        <ReflectionFields row={workingRow} onChange={(p) => updateRow(workingRow.key, p)} />
        <Button variant="primary" className="h-12 w-full" onClick={() => setStep("alternatives")}>
          Volgende
        </Button>
      </div>
    );
  }

  if (step === "alternatives") {
    const alternatives = rows.map((r, i) => ({ r, i })).filter(({ r }) => !r.working);
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-2">Welke andere diagnoses passen? Vul per alternatief dezelfde drie vragen in.</p>
        {alternatives.map(({ r, i }, n) => (
          <div key={r.key} className="space-y-2 rounded-[14px] border border-border bg-surface p-3.5">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label={`Alternatief ${n + 1}`}>
                  <Input value={r.diagnosis} onChange={(e) => updateRow(r.key, { diagnosis: e.target.value })} />
                </Field>
              </div>
              <button
                type="button"
                aria-label={`${rowName(r, i)} verwijderen`}
                onClick={() => removeRow(r.key)}
                className="flex h-11 w-11 items-center justify-center rounded-[10px] text-muted hover:bg-surface-2"
              >
                <Icon d={CROSS} size={16} />
              </button>
            </div>
            <ReflectionFields row={r} onChange={(p) => updateRow(r.key, p)} />
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Button onClick={() => addRow()}>+ Alternatief</Button>
          <Alternatives {...props} />
        </div>
        <Button
          variant="primary"
          className="h-12 w-full"
          disabled={!canCompare}
          onClick={() => {
            props.rows.filter((r) => !r.working && !r.diagnosis.trim()).forEach((r) => removeRow(r.key));
            setStep("rank");
          }}
        >
          Volgende
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-2">Zet de diagnoses in volgorde van waarschijnlijkheid. Bovenaan staat je eindantwoord.</p>
      <ol className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-2 rounded-[14px] border border-border bg-surface py-1.5 pl-3.5 pr-1.5">
            <span className="w-5 text-[15px] font-bold">{i + 1}</span>
            <span className="flex-1 text-[15px]">
              {r.diagnosis}
              {r.working ? <span className="block text-[11px] text-accent-strong">Werkdiagnose</span> : null}
            </span>
            <button type="button" aria-label={`${r.diagnosis} omhoog`} disabled={i === 0} onClick={() => moveRow(i, i - 1)} className={PHONE_ARROW}>
              ↑
            </button>
            <button
              type="button"
              aria-label={`${r.diagnosis} omlaag`}
              disabled={i === rows.length - 1}
              onClick={() => moveRow(i, i + 1)}
              className={PHONE_ARROW}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <Button variant="primary" className="h-12 w-full" disabled={!canCompare || pending} onClick={onCompare}>
        Vergelijk met de expert
      </Button>
    </div>
  );
}

const PHONE_ARROW = "flex h-11 w-11 items-center justify-center rounded-[10px] text-lg hover:bg-surface-2 disabled:opacity-30";

function ReflectionFields({ row, onChange }: { row: Reflection; onChange: (p: Partial<Reflection>) => void }) {
  return (
    <div className="space-y-2">
      {COLUMNS.map((col) => (
        <Field key={col.key} label={col.long}>
          <Textarea value={row[col.key]} onChange={(e) => onChange({ [col.key]: e.target.value })} rows={2} />
        </Field>
      ))}
    </div>
  );
}

function ExpertView({
  expert,
  finalAnswer,
  feedback,
  aiEnabled,
  pending,
  onFeedback,
  onNext,
}: {
  expert: Expert;
  finalAnswer: string;
  feedback: CaseFeedback | null;
  aiEnabled: boolean;
  pending: boolean;
  onFeedback: () => void;
  onNext: () => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const match = sameDiagnosis(finalAnswer, expert.correct_diagnosis);
  return (
    <div className="flex flex-col gap-3 md:max-w-[760px]">
      <div className="flex flex-col gap-1 rounded-[14px] border border-border bg-surface px-4 py-3.5">
        <span className="text-xs text-muted">Juiste diagnose</span>
        <span className="font-serif text-[26px] font-medium leading-tight">{expert.correct_diagnosis}</span>
        <span className={`flex items-center gap-1.5 text-[13px] ${match ? "text-accent-strong" : "text-danger"}`}>
          <Icon d={match ? CHECK : CROSS} size={14} strokeWidth={2.4} />
          Jouw eindantwoord: {finalAnswer}
        </span>
      </div>

      {expert.expert_reflection.map((r) => {
        const shown = r.rank === 1 || open.has(r.diagnosis);
        if (!shown) {
          return (
            <button
              key={r.diagnosis}
              type="button"
              aria-expanded={false}
              onClick={() => setOpen((s) => new Set(s).add(r.diagnosis))}
              className="flex min-h-12 items-center justify-between gap-3 rounded-[14px] border border-border bg-surface px-4 py-3 text-left hover:bg-surface-2"
            >
              <span className="text-[15px] font-bold">
                {r.rank}. {r.diagnosis}
              </span>
              <span className="text-[13px] text-accent">Toon</span>
            </button>
          );
        }
        return (
          <div key={r.diagnosis} className={`flex flex-col gap-2 rounded-[14px] bg-surface p-4 ${r.rank === 1 ? "border-2 border-accent" : "border border-border"}`}>
            <p className="text-[15px] font-bold">
              {r.rank}. {r.diagnosis}
            </p>
            <dl className="grid gap-2 text-[13px] leading-[1.45] lg:grid-cols-3 lg:gap-4">
              <Def label="Past erbij" value={r.supporting} />
              <Def label="Spreekt tegen" value={r.against} />
              <Def label="Verwacht maar afwezig" value={r.missing} />
            </dl>
          </div>
        );
      })}

      {expert.teaching_points ? (
        <div className="flex flex-col gap-1 px-1 pt-1">
          <span className="text-[13px] font-bold">Lessen</span>
          <p className="prose-card text-sm leading-normal text-text-2">{expert.teaching_points}</p>
        </div>
      ) : null}

      {feedback ? <FeedbackView feedback={feedback} /> : null}

      <div className="flex flex-col gap-2 pt-2 md:flex-row md:items-center md:justify-end">
        {!feedback ? (
          <Button className="h-12" disabled={!aiEnabled || pending} onClick={onFeedback}>
            {pending ? "AI kijkt je redenering na…" : "Feedback van AI op je redenering"}
          </Button>
        ) : null}
        <Button variant="primary" className="h-[54px] text-base md:h-12 md:text-[15px]" onClick={onNext}>
          Verder
        </Button>
      </div>
      {!feedback && !aiEnabled ? <p className="text-xs text-muted md:text-right">AI-feedback vraagt een API-key.</p> : null}
    </div>
  );
}

function Def({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[.06em] text-muted">{label}</dt>
      <dd className="prose-card">{value || "–"}</dd>
    </div>
  );
}

function FeedbackView({ feedback }: { feedback: CaseFeedback }) {
  return (
    <div className="space-y-2 rounded-[14px] bg-accent-soft px-4 py-3.5 text-sm leading-normal text-text">
      <p className="text-[13px] font-bold text-accent-strong">Feedback van AI</p>
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
    <div className="space-y-3 md:max-w-[640px]">
      <h2 className="text-[17px] font-bold">Maak kaart van wat ik miste</h2>
      <p className="text-sm text-muted">Zet het in je eigen woorden: schrijf een vraag die het antwoord afdwingt. De kaart komt als concept op Goedkeuren.</p>
      {suggestions.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setBack(s)}
              className="min-h-9 max-w-full truncate rounded-full border border-border-strong bg-surface px-3 text-left text-[13px] hover:bg-surface-2"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <Field label="Vraag (voorkant)">
        <Textarea value={front} onChange={(e) => setFront(e.target.value)} rows={2} className="font-serif text-lg leading-[1.35]" />
      </Field>
      <Field label="Antwoord (achterkant)">
        <Textarea value={back} onChange={(e) => setBack(e.target.value)} rows={3} />
      </Field>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {made > 0 ? <Notice tone="ok">{made} conceptkaart(en) gemaakt.</Notice> : null}
      <div className="flex flex-col gap-2 pt-1 md:flex-row md:justify-end">
        <Button
          className="h-12"
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
        <Button variant="primary" className="h-12" onClick={next}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
