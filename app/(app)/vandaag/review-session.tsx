"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge, Button, buttonClass, Eyebrow, Kbd, LinkButton, Notice, Panel, ProgressSegments, Textarea } from "@/components/ui";
import type { ReviewCard } from "@/lib/data/review";
import { CARD_TYPE_LABELS, ERROR_TYPES, VERIFY_TEXT, type ErrorType } from "@/lib/labels";
import { formatIntervalLong, preview, rate, RATINGS, STATE, type FsrsSettings, type RatingValue } from "@/lib/fsrs";
import { available as idbAvailable, loadSnapshot, outboxAdd, outboxAll, outboxRemove, saveSnapshot } from "@/lib/offline/idb";
import { pickNext, requeue } from "@/lib/queue";
import { uuid } from "@/lib/uuid";
import {
  flagCardAction,
  rateCardAction,
  suspendCardAction,
  tomorrowAction,
  type RateInput,
} from "./actions";
import { CheckError, CheckOutcome, RecoveryPrompt, useAnswerCheck } from "./answer-check";
import { ChainCompare, ChainInput } from "./chain";
import { ErrorChips } from "@/components/error-chips";
import { FocusMarker, Icon } from "@/components/nav";
import { Stopcheck } from "./stopcheck";

const TYPED_ANSWER_TYPES = new Set(["explain", "chain", "illness_script", "compare"]);
const RATING_BORDER: Record<RatingValue, string> = {
  1: "border-again",
  2: "border-hard",
  3: "border-good",
  4: "border-easy",
};
const RATING_TEXT: Record<RatingValue, string> = {
  1: "text-again",
  2: "text-hard",
  3: "text-good",
  4: "text-easy",
};
const MAX_DURATION_MS = 5 * 60_000;
const RETRY_DELAYS = [1_000, 3_000, 9_000];

type SaveState = "idle" | "saving" | "offline" | "error";
type Result = {
  rating: RatingValue;
  wasReview: boolean;
  cardId?: string;
  errorType?: ErrorType | null;
  answer?: string | null;
};

/** Wachtrij en voortgang van vandaag, voor heropenen zonder verbinding. */
type Snapshot = {
  userId: string;
  endOfDay: string;
  savedAt: number;
  queue: ReviewCard[];
  pending: ReviewCard[];
  results: Result[];
  sessionId: string;
};

type Props = {
  initialQueue: ReviewCard[];
  initialPending: ReviewCard[];
  settings: FsrsSettings;
  endOfDay: string;
  userId: string;
  /** Moment waarop de server deze wachtrij maakte; een nieuwere lokale stand wint. */
  generatedAt: number;
  aiEnabled: boolean;
  /** Paginakop (van de server), boven de sessie. */
  header?: ReactNode;
};

type Current = { card: ReviewCard; source: "queue" | "pending" } | null;

export function ReviewSession({ initialQueue, initialPending, settings, endOfDay, userId, generatedAt, aiEnabled, header }: Props) {
  const [sessionId, setSessionId] = useState(() => uuid());
  const [queue, setQueue] = useState(initialQueue);
  const [pending, setPending] = useState(initialPending);
  const [current, setCurrent] = useState<Current>(() => {
    const next = pickNext(initialQueue, initialPending, new Date());
    return next ? { card: next.item as ReviewCard, source: next.source } : null;
  });
  const router = useRouter();
  const [revealedAt, setRevealedAt] = useState<Date | null>(null);
  const [answer, setAnswer] = useState("");
  // A3: antwoord op de herstelvraag (de knop "Nakijken" staat in de dock).
  const [recovery, setRecovery] = useState("");
  // "Stoppen" met resultaten: naar het sessie-einde; de rest blijft voor later vandaag.
  const [stopped, setStopped] = useState(false);
  const check = useAnswerCheck(current?.card.card_id ?? "");
  // A1: na Opnieuw/Moeilijk eerst het fouttype (één tik of overslaan), dan pas door.
  const [pendingRating, setPendingRating] = useState<{ rating: RatingValue; at: Date } | null>(null);
  // A1: fouttype uit de nakijkstappen (stap 1 benoemt de fout; stap 2 is vaak "gelukt na hint").
  const suggestedError = [...check.steps].reverse().find((st) => st.result.error_type)?.result.error_type ?? null;
  const shownAt = useRef(0);
  const [startedAt] = useState(() => Date.now());
  const [results, setResults] = useState<Result[]>([]);
  const [menu, setMenu] = useState<"closed" | "open" | "flag">("closed");
  const [flagNote, setFlagNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Uitgaande beoordelingen: in IndexedDB, één voor één in volgorde. Zonder verbinding
  // blijven ze staan tot de browser weer online is (ook na sluiten en heropenen).
  const [outboxCount, setOutboxCount] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const sending = useRef(false);

  const flush = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      let items = await outboxAll();
      setOutboxCount(items.length);
      while (items.length > 0) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setSaveState("offline");
          return;
        }
        setSaveState("saving");
        const item = items[0];
        let result: "ok" | "rejected" | "network" = "network";
        for (let attempt = 0; attempt <= RETRY_DELAYS.length && result === "network"; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
          try {
            result = (await rateCardAction(item.payload)).ok ? "ok" : "rejected";
          } catch {
            result = "network"; // geen verbinding of server onbereikbaar
          }
        }
        if (result !== "ok") {
          setSaveState(result === "network" ? "offline" : "error");
          return;
        }
        await outboxRemove(item.key);
        items = await outboxAll();
        setOutboxCount(items.length);
      }
      setSaveState("idle");
    } finally {
      sending.current = false;
    }
  }, []);

  const enqueue = useCallback(
    async (payload: RateInput) => {
      // Teller meteen ophogen: het sessie-einde wacht hierop voordat het "morgen" telt.
      setOutboxCount((n) => n + 1);
      await outboxAdd({ key: `${payload.cardId}|${payload.reviewedAt}`, createdAt: Date.now(), payload });
      void flush();
    },
    [flush],
  );

  const retry = useCallback(() => void flush(), [flush]);

  // Bij openen (rij van een eerdere offline sessie) en zodra de verbinding terug is.
  useEffect(() => {
    void flush();
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [flush]);

  useEffect(() => {
    if (outboxCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    // Met IndexedDB gaat er niets verloren; alleen waarschuwen als het geheugen de enige opslag is.
    if (!idbAvailable()) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [outboxCount]);

  // Lokale stand: een nieuwere (bijv. offline bijgehouden) stand van dezelfde dag wint
  // van wat de server meegaf; anders slaan we de verse wachtrij op.
  const restored = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadSnapshot<Snapshot>(), outboxAll()]).then(([snap, unsent]) => {
      if (cancelled) return;
      restored.current = true;
      // Staan er nog niet-verstuurde beoordelingen, dan kent de server die nog niet en is
      // zijn wachtrij verouderd: dan wint de lokale stand, ook als die ouder lijkt.
      const sameDay = snap && snap.userId === userId && snap.endOfDay === endOfDay;
      if (snap && sameDay && (snap.savedAt > generatedAt || unsent.length > 0)) {
        setQueue(snap.queue);
        setPending(snap.pending);
        setResults(snap.results);
        setSessionId(snap.sessionId);
        const next = pickNext(snap.queue, snap.pending, new Date());
        setCurrent(next ? { card: next.item as ReviewCard, source: next.source } : null);
      } else {
        // Zonder bruikbare lokale stand: kaarten die nog in de uitgaande rij staan niet opnieuw tonen.
        const sent = new Set(unsent.map((u) => u.payload.cardId));
        const q = initialQueue.filter((c) => !sent.has(c.card_id));
        const p = initialPending.filter((c) => !sent.has(c.card_id));
        if (sent.size > 0) {
          setQueue(q);
          setPending(p);
          const next = pickNext(q, p, new Date());
          setCurrent(next ? { card: next.item as ReviewCard, source: next.source } : null);
        }
        void saveSnapshot<Snapshot>({ userId, endOfDay, savedAt: Date.now(), queue: q, pending: p, results: [], sessionId });
      }
    });
    return () => {
      cancelled = true;
    };
    // Alleen bij openen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    void saveSnapshot<Snapshot>({ userId, endOfDay, savedAt: Date.now(), queue, pending, results, sessionId });
  }, [queue, pending, results, sessionId, userId, endOfDay]);

  // Nieuwe kaart in beeld: timer starten.
  useEffect(() => {
    shownAt.current = Date.now();
  }, [current?.card.card_id, current?.card.schedule.reps]);

  const resetCheck = check.reset;
  const advance = useCallback((nextQueue: ReviewCard[], nextPending: ReviewCard[]) => {
    setQueue(nextQueue);
    setPending(nextPending);
    const next = pickNext(nextQueue, nextPending, new Date());
    setCurrent(next ? { card: next.item as ReviewCard, source: next.source } : null);
    setRevealedAt(null);
    setAnswer("");
    setRecovery("");
    resetCheck();
    setPendingRating(null);
    setMenu("closed");
    setFlagNote("");
  }, [resetCheck]);

  // Wachten op een learning-kaart: af en toe opnieuw kijken.
  useEffect(() => {
    if (current || pending.length === 0) return;
    const id = setInterval(() => {
      const next = pickNext(queue, pending, new Date());
      if (next) setCurrent({ card: next.item as ReviewCard, source: next.source });
      else setTick((t) => t + 1);
    }, 15_000);
    return () => clearInterval(id);
  }, [current, queue, pending]);

  const previews = useMemo(
    () => (current && revealedAt ? preview(current.card.schedule, revealedAt, settings) : null),
    [current, revealedAt, settings],
  );

  const reveal = useCallback(() => {
    if (current && !revealedAt) setRevealedAt(new Date());
  }, [current, revealedAt]);

  // A3: eerst nakijken (bij fout een hint en herstelvraag), pas daarna het antwoord.
  const typedCard = !!current && TYPED_ANSWER_TYPES.has(current.card.type);
  const inRecovery = !revealedAt && check.last?.stage === 1 && check.last.result.verdict !== "correct";
  const canCheck = typedCard && aiEnabled && !!answer.trim() && check.steps.length === 0 && !revealedAt;
  const runCheck = check.run;
  const startCheck = useCallback(async () => {
    const step = await runCheck(1, answer);
    if (step?.result.verdict === "correct") reveal();
  }, [runCheck, answer, reveal]);
  const submitRecovery = useCallback(async () => {
    if (recovery.trim() && (await runCheck(2, recovery))) reveal();
  }, [runCheck, recovery, reveal]);

  const finalize = useCallback(
    (rating: RatingValue, at: Date, errorType: ErrorType | null) => {
      if (!current) return;
      const card = current.card;
      const { schedule } = rate(card.schedule, rating, at, settings);
      setResults((r) => [
        ...r,
        { rating, wasReview: card.schedule.state === STATE.Review, cardId: card.card_id, errorType, answer: answer.trim() || null },
      ]);
      void enqueue({
        cardId: card.card_id,
        rating,
        reviewedAt: at.toISOString(),
        durationMs: Math.min(MAX_DURATION_MS, at.getTime() - shownAt.current),
        answerText: answer.trim() || null,
        sessionId,
        aiFeedback: check.steps.length ? JSON.stringify(check.steps) : null,
        errorType,
      });
      const nextQueue = current.source === "queue" ? queue.slice(1) : queue;
      const nextPending = requeue(pending, card, schedule, new Date(endOfDay)) as ReviewCard[];
      advance(nextQueue, nextPending);
    },
    [current, settings, answer, check.steps, sessionId, queue, pending, endOfDay, advance, enqueue],
  );

  const onRate = useCallback(
    (rating: RatingValue) => {
      if (!current || !revealedAt || pendingRating) return;
      const at = new Date();
      // FSRS krijgt altijd de eerlijke beoordeling; het fouttype is alleen analyse.
      if (rating <= 2) setPendingRating({ rating, at });
      else finalize(rating, at, null);
    },
    [current, revealedAt, pendingRating, finalize],
  );

  const pickError = useCallback(
    (type: ErrorType | null) => {
      if (pendingRating) finalize(pendingRating.rating, pendingRating.at, type);
    },
    [pendingRating, finalize],
  );

  const removeCurrent = useCallback(
    async (action: () => Promise<{ ok: boolean; error?: string }>) => {
      if (!current) return;
      const card = current.card;
      advance(
        queue.filter((c) => c.card_id !== card.card_id),
        pending.filter((c) => c.card_id !== card.card_id),
      );
      const res = await action().catch(() => ({ ok: false, error: "Geen verbinding" }));
      setActionError(res.ok ? null : `Niet gelukt: ${res.error ?? "onbekende fout"}`);
    },
    [current, queue, pending, advance],
  );

  // Sneltoetsen: spatie = omdraaien, 1–4 = beoordelen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.isContentEditable;
      if (typing) {
        // ⌘/Ctrl+Enter: nakijken als dat kan, anders het antwoord tonen.
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && check.state !== "loading") {
          e.preventDefault();
          if (inRecovery) void submitRecovery();
          else if (canCheck) void startCheck();
          else reveal();
        }
        return;
      }
      if (menu !== "closed" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (pendingRating) {
        // Fouttype: 1–3 kiest, Enter slaat over (of bevestigt de AI-suggestie).
        if (["1", "2", "3"].includes(e.key)) {
          e.preventDefault();
          pickError(ERROR_TYPES[Number(e.key) - 1].value);
        } else if (e.key === "Enter") {
          e.preventDefault();
          pickError(suggestedError);
        }
        return;
      }
      if (e.key === " " && !revealedAt) {
        e.preventDefault();
        reveal();
      } else if (revealedAt && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        onRate(Number(e.key) as RatingValue);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reveal, onRate, revealedAt, menu, pendingRating, pickError, suggestedError, inRecovery, canCheck, startCheck, submitRecovery, check.state]);

  const remaining = queue.length + pending.length;
  // Voorkant per kaart (voor de stopcheck zonder AI).
  const frontOf = new Map([...initialQueue, ...initialPending, ...queue, ...pending].map((c) => [c.card_id, c.front]));
  // Voortgang: elke beoordeling is een segment; komt een kaart binnen de sessie terug, dan
  // groeit het totaal (eerlijk: je ziet dat je meer doet dan gepland).
  const total = results.length + remaining;
  const status = <SaveStatus state={saveState} count={outboxCount} onRetry={retry} done={results.length} />;

  // Focusmodus zodra er kaarten of resultaten zijn; zonder kaarten blijft de gewone navigatie.
  const focus = !!current || results.length > 0 || pending.length > 0;

  if (!focus) {
    return (
      <>
        {header}
        <Panel className="space-y-2 text-center">
          <p className="font-serif text-2xl font-medium">Niets te herhalen vandaag</p>
          <p className="text-sm text-muted">
            Keur nieuwe kaarten goed in <Link className="underline" href="/goedkeuren">Goedkeuren</Link> of importeer studiestof via{" "}
            <Link className="underline" href="/instellingen">Instellingen</Link>.
          </p>
        </Panel>
        <div className="mt-3">{status}</div>
      </>
    );
  }

  const stop = () => {
    if (results.length > 0) setStopped(true);
    else router.push("/overzicht");
  };

  if (!current || stopped) {
    const waiting = !stopped && pending.length > 0;
    const errors = results
      .filter((r) => r.rating <= 2 && r.cardId)
      .map((r) => ({
        cardId: r.cardId!,
        rating: r.rating,
        errorType: r.errorType ?? null,
        answer: r.answer ?? null,
        front: frontOf.get(r.cardId!) ?? "",
      }));
    return (
      <div className="flex min-h-dvh flex-col">
        <FocusMarker />
        <SessionHeader done={waiting ? results.length : total} total={total} status={status} onStop={waiting ? stop : undefined} />
        {waiting ? (
          <Waiting pending={pending} />
        ) : (
          <SessionEnd
            results={results}
            startedAt={startedAt}
            saved={outboxCount === 0}
            offline={saveState === "offline"}
            stopcheck={<Stopcheck aiEnabled={aiEnabled && saveState !== "offline"} items={errors} />}
          />
        )}
      </div>
    );
  }

  const card = current.card;
  const typed = typedCard;
  const isNew = card.schedule.state === STATE.New;

  return (
    <div className="flex min-h-dvh flex-col">
      <FocusMarker />
      <SessionHeader done={results.length} total={total} status={status} onStop={stop} />

      <div className="flex-1 px-5 pb-[calc(env(safe-area-inset-bottom)+230px)] md:px-7 md:pb-44">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4 pt-3 md:gap-[22px] md:pt-7">
          {actionError ? <Notice tone="error">{actionError}</Notice> : null}

          <div className="flex items-start justify-between gap-3">
            <Eyebrow className="pt-3 text-[11px] md:text-xs">
              {card.topic_name} · {CARD_TYPE_LABELS[card.type] ?? card.type}
              {isNew ? " · Nieuw" : ""}
            </Eyebrow>
            <button
              type="button"
              aria-label="Kaartmenu"
              aria-expanded={menu !== "closed"}
              onClick={() => setMenu(menu === "closed" ? "open" : "closed")}
              className="-mr-2 min-h-11 min-w-11 rounded-[10px] text-xl leading-none text-muted transition-colors hover:bg-surface-2 motion-reduce:transition-none"
            >
              ⋯
            </button>
          </div>

          {menu === "open" ? (
            <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1.5">
              <Link className={buttonClass("ghost", "min-h-10")} href={`/kaart/${card.card_id}?terug=/vandaag`}>
                Bewerken
              </Link>
              <button className={buttonClass("ghost", "min-h-10")} onClick={() => removeCurrent(() => suspendCardAction(card.card_id))}>
                Schorsen
              </button>
              <button className={buttonClass("danger", "min-h-10")} onClick={() => setMenu("flag")}>
                Klopt niet
              </button>
            </div>
          ) : null}
          {menu === "flag" ? (
            <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
              <p className="text-sm">De kaart gaat terug naar de concepten. Wat klopt er niet?</p>
              <Textarea value={flagNote} onChange={(e) => setFlagNote(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => removeCurrent(() => flagCardAction(card.card_id, flagNote))}>
                  Terug naar concept
                </Button>
                <Button variant="ghost" onClick={() => setMenu("closed")}>
                  Annuleren
                </Button>
              </div>
            </div>
          ) : null}

          <p className="prose-card font-serif text-[26px] font-medium leading-[1.25] [text-wrap:pretty] md:text-[38px] md:leading-[1.2]">
            {card.front}
          </p>

          {card.needs_verification ? (
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-warn-text">
              <Badge tone="warn">Controleren</Badge>
              {VERIFY_TEXT}
            </p>
          ) : null}

          {/* Eerst ophalen: het antwoord is pas zichtbaar na "Toon antwoord" of nakijken. */}
          {typed && !revealedAt && check.steps.length === 0 ? (
            <div className="space-y-1.5">
              {card.type === "chain" ? (
                <ChainInput value={answer} onChange={setAnswer} />
              ) : (
                <Textarea
                  aria-label="Typ je antwoord (optioneel)"
                  placeholder="Typ je antwoord"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="min-h-[120px] rounded-xl px-4 py-3.5 leading-[1.55]"
                />
              )}
              <p className="text-[13px] text-muted">
                {aiEnabled
                  ? "Optioneel. Typen helpt ophalen; de AI kijkt na vóór je het antwoord ziet."
                  : "Optioneel. Typen helpt ophalen."}
              </p>
            </div>
          ) : null}

          {/* A3: bij deels of fout eerst hint en herstelvraag; het antwoord blijft verborgen. */}
          {inRecovery && check.last ? (
            <>
              <div className="rounded-xl bg-surface-2 px-3 py-2.5 md:rounded-[14px] md:px-5 md:py-[18px]">
                <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted">Jouw antwoord</p>
                <p className="prose-card mt-1 text-sm text-text-2 md:text-base">{answer}</p>
              </div>
              <RecoveryPrompt step={check.last} answer={recovery} onChange={setRecovery} />
            </>
          ) : null}
          <CheckError state={check.state} />

          {revealedAt ? (
            <>
              {card.type === "chain" && answer.trim() ? (
                <ChainCompare answer={answer} back={card.back} />
              ) : (
                <div className={answer.trim() ? "grid gap-3.5 md:grid-cols-2" : ""}>
                  {answer.trim() ? (
                    <div className="rounded-[14px] bg-surface-2 px-5 py-[18px]">
                      <p className="text-[11px] font-bold uppercase tracking-[.07em] text-muted">Jouw antwoord</p>
                      <p className="prose-card mt-1.5 text-base leading-[1.55] text-text-2">{answer}</p>
                    </div>
                  ) : null}
                  <div className="rounded-[14px] border border-border bg-surface px-5 py-[18px]">
                    <p className="text-[11px] font-bold uppercase tracking-[.07em] text-accent-strong">Antwoord</p>
                    <p className="prose-card mt-1.5 text-base leading-[1.55]">{card.back}</p>
                    {card.source_label ? <p className="mt-3 text-xs text-muted">Bron: {card.source_label}</p> : null}
                  </div>
                </div>
              )}
              {card.type === "chain" && answer.trim() && card.source_label ? (
                <p className="text-xs text-muted">Bron: {card.source_label}</p>
              ) : null}
              {card.explanation ? <p className="prose-card text-[15px] leading-normal text-muted">{card.explanation}</p> : null}
              {card.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.image_url} alt="" className="max-h-80 self-start rounded-xl border border-border" />
              ) : null}
              <CheckOutcome steps={check.steps} />
            </>
          ) : null}
        </div>
      </div>

      {/* Dock: vast onderin, binnen duimbereik. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface-sunk px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 md:px-7 md:pb-7">
        <div className="mx-auto w-full max-w-[820px]">
          {pendingRating ? (
            <ErrorChips size="dock" suggested={suggestedError} onPick={pickError} />
          ) : !revealedAt ? (
            inRecovery || canCheck ? (
              <div className="flex flex-col gap-1 md:grid md:grid-cols-2 md:gap-2.5">
                <Button
                  variant="primary"
                  className="h-14 rounded-xl text-[17px] md:h-[54px] md:text-[15px]"
                  disabled={check.state === "loading" || (inRecovery && !recovery.trim())}
                  onClick={() => void (inRecovery ? submitRecovery() : startCheck())}
                >
                  {check.state === "loading" ? "Nakijken…" : "Nakijken"}
                  <Kbd aria-hidden onPrimary className="hidden md:inline-flex">
                    ⌘ ↵
                  </Kbd>
                </Button>
                <Button
                  variant="ghost"
                  className="h-11 rounded-xl md:h-[54px] md:border md:border-border-strong md:bg-surface md:text-text"
                  onClick={reveal}
                >
                  Toon antwoord
                  <Kbd aria-hidden className="hidden md:inline-flex">
                    spatie
                  </Kbd>
                </Button>
              </div>
            ) : (
              <Button variant="primary" className="h-14 w-full rounded-xl text-[17px] md:h-[54px] md:text-[15px]" onClick={reveal}>
                Toon antwoord
                <Kbd aria-hidden onPrimary className="hidden md:inline-flex">
                  spatie
                </Kbd>
              </Button>
            )
          ) : (
            <div className="grid grid-cols-4 gap-1.5 md:gap-2.5">
              {check.last ? (
                <span id="ai-voorstel" className="sr-only">
                  Voorstel van de AI
                </span>
              ) : null}
              {RATINGS.map(({ value, label }) => {
                const suggested = check.last?.result.suggested_rating === value;
                const interval = previews && revealedAt ? formatIntervalLong(revealedAt, previews[value].due) : "";
                return (
                  <button
                    key={value}
                    onClick={() => onRate(value)}
                    aria-describedby={suggested ? "ai-voorstel" : undefined}
                    className={`relative flex h-[58px] flex-col items-center justify-center rounded-xl border-2 bg-surface px-1 transition-colors motion-reduce:transition-none md:h-[68px] md:flex-row md:justify-start md:gap-3 md:px-4 ${RATING_BORDER[value]} ${
                      suggested
                        ? "bg-accent-soft shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus)] md:border-accent md:shadow-none"
                        : "hover:bg-surface-2 md:border md:border-border-strong"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`hidden h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border text-xs md:flex ${
                        suggested ? "border-accent bg-accent text-accent-text" : "border-border text-muted"
                      }`}
                    >
                      {value}
                    </span>
                    <span className="flex flex-col items-center md:items-start">
                      <span className={`text-sm font-bold md:text-[15px] ${RATING_TEXT[value]}`}>{label}</span>
                      <span className="text-xs tabular-nums text-muted md:text-[13px]">{interval}</span>
                    </span>
                    {suggested ? (
                      <span
                        aria-hidden
                        className="absolute -top-2.5 right-2.5 hidden rounded-full bg-accent px-[7px] py-0.5 text-[11px] font-bold text-accent-text md:block"
                      >
                        AI-voorstel
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Kop van de focusmodus: Stoppen (of het merk op het sessie-einde), voortgang en opslaanstatus. */
function SessionHeader({
  done,
  total,
  status,
  onStop,
}: {
  done: number;
  total: number;
  status: ReactNode;
  /** Zonder onStop: sessie-einde, met het merk als link naar het overzicht. */
  onStop?: () => void;
}) {
  const shown = Math.min(onStop ? done + 1 : done, total);
  return (
    <header className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 md:flex-nowrap md:gap-7 md:px-7">
      {onStop ? (
        <button
          type="button"
          onClick={onStop}
          aria-label="Stoppen"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-surface text-sm text-text-2 transition-colors hover:bg-surface-2 motion-reduce:transition-none md:h-10 md:w-auto md:px-3"
        >
          <Icon d="M6 6l12 12M18 6L6 18" size={16} />
          <span className="hidden md:inline">Stoppen</span>
        </button>
      ) : (
        <Link href="/overzicht" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-accent text-[11px] font-bold text-accent-text">PA</span>
          <span className="hidden text-[15px] font-bold md:inline">PA Studie</span>
        </Link>
      )}
      <div className="mx-auto flex min-w-0 max-w-[640px] flex-1 items-center gap-3 md:gap-3.5">
        <ProgressSegments done={done} total={total} label="Voortgang van de sessie" />
        <span className="shrink-0 text-[13px] font-bold tabular-nums md:text-sm">
          {shown} / {total}
        </span>
      </div>
      <div className="order-last basis-full text-center md:order-none md:min-w-[150px] md:basis-auto md:text-right">{status}</div>
    </header>
  );
}

function SaveStatus({
  state,
  count,
  onRetry,
  done,
}: {
  state: SaveState;
  count: number;
  onRetry: () => void;
  done: number;
}) {
  if (state === "offline" && count > 0) {
    return (
      <span role="status" className="text-[13px] text-text-2">
        Offline · {count} {count === 1 ? "beoordeling wacht" : "beoordelingen wachten"} op verbinding
      </span>
    );
  }
  if (state === "error") {
    return (
      <span role="alert" className="text-[13px] text-danger">
        {count} niet opgeslagen ·{" "}
        <button className="underline" onClick={onRetry}>
          opnieuw proberen
        </button>
      </span>
    );
  }
  if (count > 0) {
    return (
      <span aria-live="polite" className="hidden text-[13px] text-muted md:inline">
        Opslaan…
      </span>
    );
  }
  if (done > 0) {
    return (
      <span className="hidden items-center justify-end gap-1.5 text-[13px] text-muted md:inline-flex">
        <Icon d="M4 12l5 5L20 6" size={14} strokeWidth={2.2} className="text-accent" />
        Opgeslagen
      </span>
    );
  }
  return null;
}

function Waiting({ pending }: { pending: ReviewCard[] }) {
  const next = new Date(pending[0].schedule.due);
  const inMin = Math.max(1, Math.round((next.getTime() - Date.now()) / 60_000));
  return (
    <div className="flex flex-1 items-center justify-center px-5 pb-24">
      <div className="max-w-md space-y-2 text-center">
        <p className="font-serif text-[32px] font-medium leading-[1.1]">Even pauze</p>
        <p className="text-[15px] text-text-2">
          Over ongeveer {inMin} min {pending.length === 1 ? "komt er nog een kaart" : `komen er nog ${pending.length} kaarten`} terug. Laat deze pagina open of kom later terug.
        </p>
      </div>
    </div>
  );
}

const DAY_FORMAT = new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long" });

function SessionEnd({
  results,
  startedAt,
  saved,
  offline,
  stopcheck,
}: {
  results: Result[];
  startedAt: number;
  saved: boolean;
  offline: boolean;
  stopcheck: ReactNode;
}) {
  const [tomorrow, setTomorrow] = useState<{ due: number; fresh: number } | null>(null);
  const [endedAt] = useState(() => Date.now());
  useEffect(() => {
    // Pas tellen als alle beoordelingen zijn opgeslagen.
    if (saved) tomorrowAction().then(setTomorrow).catch(() => setTomorrow(null));
  }, [saved]);

  const reviews = results.filter((r) => r.wasReview);
  const kept = reviews.filter((r) => r.rating !== 1).length;
  const retention = reviews.length ? Math.round((kept / reviews.length) * 100) : null;
  const minutes = Math.max(1, Math.round((endedAt - startedAt) / 60_000));
  const perRating = RATINGS.map((r) => ({ ...r, count: results.filter((x) => x.rating === r.value).length }));
  const perError = ERROR_TYPES.map((t) => ({ ...t, count: results.filter((x) => x.errorType === t.value).length }));
  const n = results.length;
  const SWATCH: Record<RatingValue, string> = { 1: "bg-again", 2: "bg-hard", 3: "bg-good", 4: "bg-easy" };

  return (
    <div className="flex-1 px-5 pb-[calc(env(safe-area-inset-bottom)+110px)] md:px-7 md:pb-16">
      <div className="mx-auto grid w-full max-w-[1080px] gap-8 pt-4 md:grid-cols-[1fr_440px] md:gap-14 md:pt-9">
        <div className="flex flex-col gap-6 md:gap-7">
          <div className="space-y-3">
            <Eyebrow>{DAY_FORMAT.format(endedAt)} · Sessie klaar</Eyebrow>
            <h1 className="font-serif text-[36px] font-medium leading-[1.08] md:text-[52px] md:leading-[1.05]">
              {n} {n === 1 ? "kaart" : "kaarten"} in {minutes} {minutes === 1 ? "minuut" : "minuten"}.
            </h1>
          </div>

          <div className="space-y-3">
            <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-[7px]" aria-hidden>
              {perRating
                .filter((r) => r.count > 0)
                .map((r) => (
                  <span key={r.value} className={SWATCH[r.value]} style={{ flexGrow: r.count }} />
                ))}
            </div>
            <ul className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm tabular-nums md:flex md:flex-wrap" aria-label="Verdeling van je beoordelingen">
              {perRating.map((r) => (
                <li key={r.value} className="flex items-center gap-2">
                  <span aria-hidden className={`h-2.5 w-2.5 rounded-[3px] ${SWATCH[r.value]}`} />
                  {r.label} {r.count}
                </li>
              ))}
            </ul>
          </div>

          <dl className="grid grid-cols-2 gap-2 md:gap-3">
            <EndStat
              label="Retentie deze sessie"
              value={retention === null ? "–" : `${retention}%`}
              note={
                retention === null
                  ? "Retentie telt alleen kaarten die al in herhaling waren."
                  : `${kept} van ${reviews.length} herhalingen niet met Opnieuw`
              }
            />
            <EndStat
              label="Morgen klaar"
              value={tomorrow ? String(tomorrow.due) : "…"}
              note={
                tomorrow
                  ? `herhalingen en tot ${tomorrow.fresh} nieuwe kaarten`
                  : offline
                    ? "wordt geteld zodra je weer online bent"
                    : "bezig met tellen…"
              }
            />
          </dl>

          {perError.some((e) => e.count > 0) ? (
            <div className="space-y-2">
              <p className="text-[13px] font-bold text-text-2">Wat ging er mis bij Opnieuw en Moeilijk</p>
              <ul className="flex flex-wrap gap-2">
                {perError.map((e) => (
                  <li key={e.value} className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm tabular-nums">
                    {e.label} · {e.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="flex flex-col gap-4 self-start rounded-2xl border border-border bg-surface p-6">
          {stopcheck}
          <LinkButton href="/overzicht" variant="primary" className="hidden h-[52px] w-full rounded-xl md:flex">
            Klaar
          </LinkButton>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface-sunk px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 md:hidden">
        <LinkButton href="/overzicht" variant="primary" className="h-14 w-full rounded-xl text-[17px]">
          Klaar
        </LinkButton>
      </div>
    </div>
  );
}

function EndStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface px-4 py-4 md:px-5 md:py-[18px]">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-[26px] font-bold tabular-nums md:text-[32px]">{value}</dd>
      <dd className="text-[13px] text-muted">{note}</dd>
    </div>
  );
}
