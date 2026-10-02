"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Notice, Panel, Textarea } from "@/components/ui";
import type { ReviewCard } from "@/lib/data/review";
import { CARD_TYPE_LABELS } from "@/lib/labels";
import { preview, rate, RATINGS, STATE, type FsrsSettings, type RatingValue } from "@/lib/fsrs";
import { pickNext, requeue } from "@/lib/queue";
import {
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

type Props = {
  initialQueue: ReviewCard[];
  initialPending: ReviewCard[];
  settings: FsrsSettings;
  endOfDay: string;
};

type Current = { card: ReviewCard; source: "queue" | "pending" } | null;

export function ReviewSession({ initialQueue, initialPending, settings, endOfDay }: Props) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [queue, setQueue] = useState(initialQueue);
  const [pending, setPending] = useState(initialPending);
  const [current, setCurrent] = useState<Current>(() => {
    const next = pickNext(initialQueue, initialPending, new Date());
    return next ? { card: next.item as ReviewCard, source: next.source } : null;
  });
  const [revealedAt, setRevealedAt] = useState<Date | null>(null);
  const [answer, setAnswer] = useState("");
  const shownAt = useRef(0);
  const [startedAt] = useState(() => Date.now());
  const [results, setResults] = useState<{ rating: RatingValue; wasReview: boolean }[]>([]);
  const [menu, setMenu] = useState<"closed" | "open" | "flag">("closed");
  const [flagNote, setFlagNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Uitgaande beoordelingen: één voor één, in volgorde, met nieuwe pogingen bij een fout.
  const outbox = useRef<RateInput[]>([]);
  const [outboxCount, setOutboxCount] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const sending = useRef(false);

  const flush = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    setSaveState("saving");
    try {
      while (outbox.current.length > 0) {
        const item = outbox.current[0];
        let ok = false;
        for (let attempt = 0; attempt <= RETRY_DELAYS.length && !ok; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt - 1]));
          try {
            ok = (await rateCardAction(item)).ok;
          } catch {
            ok = false;
          }
        }
        if (!ok) {
          setSaveState("error");
          return;
        }
        outbox.current.shift();
        setOutboxCount(outbox.current.length);
      }
      setSaveState("idle");
    } finally {
      sending.current = false;
    }
  }, []);

  const enqueue = useCallback(
    (item: RateInput) => {
      outbox.current.push(item);
      setOutboxCount(outbox.current.length);
      void flush();
    },
    [flush],
  );

  const retry = useCallback(() => void flush(), [flush]);

  useEffect(() => {
    if (outboxCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [outboxCount]);

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
      enqueue({
        cardId: card.card_id,
        rating,
        reviewedAt: now.toISOString(),
        durationMs: Math.min(MAX_DURATION_MS, now.getTime() - shownAt.current),
        answerText: answer.trim() || null,
        sessionId,
      });
      const nextQueue = current.source === "queue" ? queue.slice(1) : queue;
      const nextPending = requeue(pending, card, schedule, new Date(endOfDay)) as ReviewCard[];
      advance(nextQueue, nextPending);
    },
    [current, revealedAt, settings, answer, sessionId, queue, pending, endOfDay, advance, enqueue],
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
        <SessionEnd results={results} startedAt={startedAt} waiting={waiting} pending={pending} saved={outboxCount === 0} />
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
            {RATINGS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onRate(value)}
                className={`flex min-h-14 flex-col items-center justify-center rounded-lg border-2 bg-surface px-1 text-[0.8rem] font-semibold hover:bg-surface-2 sm:text-sm ${RATING_STYLES[value]}`}
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
  state: "idle" | "saving" | "error";
  count: number;
  onRetry: () => void;
  compact?: boolean;
}) {
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
}: {
  results: { rating: RatingValue; wasReview: boolean }[];
  startedAt: number;
  waiting: boolean;
  pending: ReviewCard[];
  saved: boolean;
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
        {tomorrow ? `${tomorrow.due} herhalingen en tot ${tomorrow.fresh} nieuwe kaarten` : "bezig met tellen…"}
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
