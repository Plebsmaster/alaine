"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Notice, Panel, Textarea } from "@/components/ui";
import type { ReviewCard } from "@/lib/data/review";
import type { ExplainFeedback } from "@/lib/ai/schemas";
import { CARD_TYPE_LABELS } from "@/lib/labels";
import { preview, rate, RATINGS, STATE, type FsrsSettings, type RatingValue } from "@/lib/fsrs";
import { available as idbAvailable, loadSnapshot, outboxAdd, outboxAll, outboxRemove, saveSnapshot } from "@/lib/offline/idb";
import { pickNext, requeue } from "@/lib/queue";
import {
  explainFeedbackAction,
  flagCardAction,
  rateCardAction,
  suspendCardAction,
  tomorrowAction,
  type RateInput,
} from "./actions";

const TYPED_ANSWER_TYPES = new Set(["explain", "illness_script", "compare"]);
const RATING_STYLES: Record<RatingValue, string> = {
  1: "border-again text-again",
  2: "border-hard text-hard",
  3: "border-good text-good",
  4: "border-easy text-easy",
};
const MAX_DURATION_MS = 5 * 60_000;
const RETRY_DELAYS = [1_000, 3_000, 9_000];

type SaveState = "idle" | "saving" | "offline" | "error";
type Result = { rating: RatingValue; wasReview: boolean };

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
};

type Current = { card: ReviewCard; source: "queue" | "pending" } | null;

export function ReviewSession({ initialQueue, initialPending, settings, endOfDay, userId, generatedAt, aiEnabled }: Props) {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [queue, setQueue] = useState(initialQueue);
  const [pending, setPending] = useState(initialPending);
  const [current, setCurrent] = useState<Current>(() => {
    const next = pickNext(initialQueue, initialPending, new Date());
    return next ? { card: next.item as ReviewCard, source: next.source } : null;
  });
  const [revealedAt, setRevealedAt] = useState<Date | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<ExplainFeedback | null>(null);
  const [feedbackState, setFeedbackState] = useState<"idle" | "loading" | string>("idle");
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

  const advance = useCallback((nextQueue: ReviewCard[], nextPending: ReviewCard[]) => {
    setQueue(nextQueue);
    setPending(nextPending);
    const next = pickNext(nextQueue, nextPending, new Date());
    setCurrent(next ? { card: next.item as ReviewCard, source: next.source } : null);
    setRevealedAt(null);
    setAnswer("");
    setFeedback(null);
    setFeedbackState("idle");
    setMenu("closed");
    setFlagNote("");
  }, []);

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

  const onRate = useCallback(
    (rating: RatingValue) => {
      if (!current || !revealedAt) return;
      const now = new Date();
      const card = current.card;
      const { schedule } = rate(card.schedule, rating, now, settings);
      setResults((r) => [...r, { rating, wasReview: card.schedule.state === STATE.Review }]);
      void enqueue({
        cardId: card.card_id,
        rating,
        reviewedAt: now.toISOString(),
        durationMs: Math.min(MAX_DURATION_MS, now.getTime() - shownAt.current),
        answerText: answer.trim() || null,
        sessionId,
        aiFeedback: feedback ? JSON.stringify(feedback) : null,
      });
      const nextQueue = current.source === "queue" ? queue.slice(1) : queue;
      const nextPending = requeue(pending, card, schedule, new Date(endOfDay)) as ReviewCard[];
      advance(nextQueue, nextPending);
    },
    [current, revealedAt, settings, answer, feedback, sessionId, queue, pending, endOfDay, advance, enqueue],
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
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          reveal();
        }
        return;
      }
      if (menu !== "closed" || e.metaKey || e.ctrlKey || e.altKey) return;
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
  }, [reveal, onRate, revealedAt, menu]);

  const remaining = queue.length + pending.length;

  if (!current) {
    const waiting = pending.length > 0;
    return (
      <>
        <SessionEnd results={results} startedAt={startedAt} waiting={waiting} pending={pending} saved={outboxCount === 0} offline={saveState === "offline"} />
        <SaveStatus state={saveState} count={outboxCount} onRetry={retry} />
      </>
    );
  }

  const card = current.card;
  const typed = TYPED_ANSWER_TYPES.has(card.type);

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Nog {remaining} {remaining === 1 ? "kaart" : "kaarten"}
          {results.length > 0 ? ` · ${results.length} gedaan` : ""}
        </span>
        <SaveStatus state={saveState} count={outboxCount} onRetry={retry} compact />
      </div>

      {actionError ? <Notice tone="error">{actionError}</Notice> : null}

      <Panel className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge>{card.topic_name}</Badge>
            <Badge>{CARD_TYPE_LABELS[card.type] ?? card.type}</Badge>
            {card.schedule.state === STATE.New ? <Badge>Nieuw</Badge> : null}
          </div>
          <button
            type="button"
            aria-label="Kaartmenu"
            aria-expanded={menu !== "closed"}
            onClick={() => setMenu(menu === "closed" ? "open" : "closed")}
            className="-mr-2 -mt-2 min-h-11 min-w-11 rounded-lg text-xl leading-none text-muted hover:bg-surface-2"
          >
            ⋯
          </button>
        </div>

        {menu === "open" ? (
          <div className="flex flex-wrap gap-2 rounded-lg bg-surface-2 p-2">
            <Link className="rounded-md px-3 py-2 text-sm hover:bg-surface" href={`/kaart/${card.card_id}?terug=/vandaag`}>
              Bewerken
            </Link>
            <button className="rounded-md px-3 py-2 text-sm hover:bg-surface" onClick={() => removeCurrent(() => suspendCardAction(card.card_id))}>
              Schorsen
            </button>
            <button className="rounded-md px-3 py-2 text-sm text-danger hover:bg-surface" onClick={() => setMenu("flag")}>
              Klopt niet
            </button>
          </div>
        ) : null}
        {menu === "flag" ? (
          <div className="space-y-2 rounded-lg bg-surface-2 p-3">
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

        <p className="prose-card text-lg font-medium">{card.front}</p>

        {typed && !revealedAt ? (
          <Textarea
            aria-label="Typ je antwoord (optioneel)"
            placeholder="Typ je antwoord (optioneel)"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
          />
        ) : null}

        {revealedAt ? (
          <div className="space-y-3 border-t border-border pt-4">
            {answer.trim() ? (
              <div className="rounded-lg bg-surface-2 p-3 text-sm">
                <div className="mb-1 text-xs font-medium text-muted">Jouw antwoord</div>
                <p className="prose-card">{answer}</p>
              </div>
            ) : null}
            <p className="prose-card text-base">{card.back}</p>
            {card.explanation ? <p className="prose-card text-sm text-muted">{card.explanation}</p> : null}
            {card.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.image_url} alt="" className="max-h-80 rounded-lg border border-border" />
            ) : null}
            {card.source_label ? <p className="text-xs text-muted">Bron: {card.source_label}</p> : null}

            {/* explain_feedback: pas na het tonen van het antwoord, en alleen op een getypt antwoord. */}
            {answer.trim() && aiEnabled ? (
              feedback ? (
                <div className="space-y-1 rounded-lg bg-surface-2 p-3 text-sm" aria-live="polite">
                  <p className="text-xs font-medium text-muted">Feedback van AI</p>
                  {feedback.correct ? <p><strong>Klopt:</strong> {feedback.correct}</p> : null}
                  {feedback.missing ? <p><strong>Ontbreekt:</strong> {feedback.missing}</p> : null}
                  {feedback.misconception ? <p><strong>Misvatting:</strong> {feedback.misconception}</p> : null}
                  {feedback.follow_up ? <p><strong>Denk verder:</strong> {feedback.follow_up}</p> : null}
                  <p className="text-xs text-muted">
                    Voorstel: {RATINGS.find((r) => r.value === feedback.suggested_rating)?.label}. Je kiest zelf.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Button
                    disabled={feedbackState === "loading"}
                    onClick={async () => {
                      setFeedbackState("loading");
                      const res = await explainFeedbackAction(card.card_id, answer).catch(() => null);
                      if (res?.ok) {
                        setFeedback(res.feedback);
                        setFeedbackState("idle");
                      } else setFeedbackState(res?.error ?? "Geen verbinding. Probeer het opnieuw.");
                    }}
                  >
                    {feedbackState === "loading" ? "AI leest je antwoord…" : "Feedback van AI"}
                  </Button>
                  {feedbackState !== "idle" && feedbackState !== "loading" ? (
                    <p className="text-sm text-danger">{feedbackState}</p>
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        ) : null}
      </Panel>

      {/* Telefoon: vast onderin boven de navigatie, binnen duimbereik. Laptop: onder de kaart. */}
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 border-t border-border bg-bg/95 px-4 py-2 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        {!revealedAt ? (
          <Button variant="primary" className="h-14 w-full text-base" onClick={reveal}>
            Toon antwoord <kbd className="hidden text-xs opacity-70 md:inline">spatie</kbd>
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {feedback ? (
              <span id="ai-voorstel" className="sr-only">
                Voorstel van de AI
              </span>
            ) : null}
            {RATINGS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onRate(value)}
                aria-describedby={feedback?.suggested_rating === value ? "ai-voorstel" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center rounded-lg border-2 bg-surface px-1 text-[0.8rem] font-semibold hover:bg-surface-2 sm:text-sm ${RATING_STYLES[value]} ${feedback?.suggested_rating === value ? "ring-2 ring-offset-2 ring-[var(--focus)] ring-offset-[var(--bg)]" : ""}`}
              >
                <span>{label}</span>
                <span className="text-xs font-normal text-muted">
                  {previews?.[value].label}
                  <span className="hidden md:inline"> · {value}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveStatus({
  state,
  count,
  onRetry,
  compact = false,
}: {
  state: SaveState;
  count: number;
  onRetry: () => void;
  compact?: boolean;
}) {
  if (state === "offline" && count > 0) {
    return (
      <span role="status" className="text-sm">
        Offline · {count} {count === 1 ? "beoordeling wacht" : "beoordelingen wachten"} op verbinding
      </span>
    );
  }
  if (state === "error") {
    return (
      <span role="alert" className="text-sm text-danger">
        {count} niet opgeslagen ·{" "}
        <button className="underline" onClick={onRetry}>
          opnieuw proberen
        </button>
      </span>
    );
  }
  if (compact) return <span aria-live="polite">{count > 0 ? "Opslaan…" : ""}</span>;
  return null;
}

function SessionEnd({
  results,
  startedAt,
  waiting,
  pending,
  saved,
  offline,
}: {
  results: Result[];
  startedAt: number;
  waiting: boolean;
  pending: ReviewCard[];
  saved: boolean;
  offline: boolean;
}) {
  const [tomorrow, setTomorrow] = useState<{ due: number; fresh: number } | null>(null);
  const [endedAt] = useState(() => Date.now());
  useEffect(() => {
    // Pas tellen als alle beoordelingen zijn opgeslagen.
    if (!waiting && saved) tomorrowAction().then(setTomorrow).catch(() => setTomorrow(null));
  }, [waiting, saved]);

  const reviews = results.filter((r) => r.wasReview);
  const retention = reviews.length
    ? Math.round((reviews.filter((r) => r.rating !== 1).length / reviews.length) * 100)
    : null;
  const minutes = Math.max(1, Math.round((endedAt - startedAt) / 60_000));

  if (waiting) {
    const next = new Date(pending[0].schedule.due);
    const inMin = Math.max(1, Math.round((next.getTime() - Date.now()) / 60_000));
    return (
      <Panel className="space-y-2 text-center">
        <p className="text-lg font-medium">Even pauze</p>
        <p className="text-sm text-muted">
          Over ongeveer {inMin} min {pending.length === 1 ? "komt er nog een kaart" : `komen er nog ${pending.length} kaarten`} terug. Laat deze pagina open of kom later terug.
        </p>
      </Panel>
    );
  }

  if (results.length === 0) {
    return (
      <Panel className="space-y-2 text-center">
        <p className="text-lg font-medium">Niets te herhalen vandaag</p>
        <p className="text-sm text-muted">
          Keur nieuwe kaarten goed in <Link className="underline" href="/goedkeuren">Goedkeuren</Link> of importeer studiestof via{" "}
          <Link className="underline" href="/instellingen">Instellingen</Link>.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="space-y-4">
      <p className="text-lg font-medium">Klaar voor vandaag</p>
      <dl className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Kaarten" value={String(results.length)} />
        <Stat label="Minuten" value={String(minutes)} />
        <Stat label="Retentie" value={retention === null ? "–" : `${retention}%`} />
      </dl>
      <p className="text-sm text-muted">
        {retention === null
          ? "Retentie telt alleen kaarten die al in herhaling waren."
          : `Retentie: aandeel herhalingen dat je niet met "Opnieuw" beoordeelde (${reviews.length} herhalingen).`}
      </p>
      <p className="text-sm">
        Morgen:{" "}
        {tomorrow
          ? `${tomorrow.due} herhalingen en tot ${tomorrow.fresh} nieuwe kaarten`
          : offline
            ? "wordt geteld zodra je weer online bent"
            : "bezig met tellen…"}
      </p>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}
