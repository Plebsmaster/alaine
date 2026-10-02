// De enige plek waar ts-fsrs wordt aangeroepen. Draait op server én client
// (de client gebruikt het voor de intervallen onder de knoppen en voor het
// terugplaatsen van kaarten binnen de sessie; de server is leidend bij opslaan).
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type FSRS,
  type Grade,
} from "ts-fsrs";

export type RatingValue = 1 | 2 | 3 | 4;

export const RATINGS: { value: RatingValue; label: string }[] = [
  { value: 1, label: "Opnieuw" },
  { value: 2, label: "Moeilijk" },
  { value: 3, label: "Goed" },
  { value: 4, label: "Makkelijk" },
];

/** 0 New, 1 Learning, 2 Review, 3 Relearning — gelijk aan ts-fsrs en de kolom card_schedule.state. */
export const STATE = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;

/** Spiegel van een rij in card_schedule (zonder card_id/user_id); datums als ISO-string. */
export type Schedule = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

/** Spiegel van de FSRS-velden in review_logs. */
export type ReviewLogFields = {
  rating: RatingValue;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  last_elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  review: string;
};

export type FsrsSettings = {
  desired_retention: number;
  fsrs_params?: number[] | null;
};

export const RETENTION_MIN = 0.8;
export const RETENTION_MAX = 0.97;
export const RETENTION_DEFAULT = 0.9;

export function scheduler(settings: FsrsSettings): FSRS {
  const request_retention = Math.min(
    RETENTION_MAX,
    Math.max(RETENTION_MIN, Number(settings.desired_retention) || RETENTION_DEFAULT),
  );
  const w = Array.isArray(settings.fsrs_params) && settings.fsrs_params.length > 0
    ? settings.fsrs_params
    : undefined;
  return fsrs(
    generatorParameters({
      request_retention,
      enable_fuzz: true,
      enable_short_term: true,
      ...(w ? { w } : {}),
    }),
  );
}

function toCard(s: Schedule): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  };
}

function fromCard(c: Card): Schedule {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? c.last_review.toISOString() : null,
  };
}

/** Lege planning voor een kaart die net is goedgekeurd. */
export function newSchedule(now: Date): Schedule {
  return fromCard(createEmptyCard(now));
}

/** Volgende vervaldatum per knop, voor de labels onder de beoordelingsknoppen. */
export function preview(
  schedule: Schedule,
  now: Date,
  settings: FsrsSettings,
): Record<RatingValue, { due: Date; label: string }> {
  const log = scheduler(settings).repeat(toCard(schedule), now);
  const out = {} as Record<RatingValue, { due: Date; label: string }>;
  for (const { value } of RATINGS) {
    const due = log[value as Grade].card.due;
    out[value] = { due, label: formatInterval(now, due) };
  }
  return out;
}

/** Beoordeel een kaart: nieuwe planning plus de logregel voor review_logs. */
export function rate(
  schedule: Schedule,
  rating: RatingValue,
  now: Date,
  settings: FsrsSettings,
): { schedule: Schedule; log: ReviewLogFields } {
  const { card, log } = scheduler(settings).next(toCard(schedule), now, rating as Grade);
  return {
    schedule: fromCard(card),
    log: {
      rating: log.rating as RatingValue,
      state: log.state,
      due: log.due.toISOString(),
      stability: log.stability,
      difficulty: log.difficulty,
      elapsed_days: log.elapsed_days,
      last_elapsed_days: log.last_elapsed_days,
      scheduled_days: log.scheduled_days,
      learning_steps: log.learning_steps,
      review: log.review.toISOString(),
    },
  };
}

export function isRating(n: unknown): n is RatingValue {
  return n === Rating.Again || n === Rating.Hard || n === Rating.Good || n === Rating.Easy;
}

/** Kort Nederlands label voor een interval: "<1 min", "10 min", "3 u", "4 d", "2 mnd", "1,5 jr". */
export function formatInterval(from: Date, to: Date): string {
  const minutes = (to.getTime() - from.getTime()) / 60_000;
  const nl = (n: number) =>
    n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace(".", ",");
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} u`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} d`;
  if (days < 365) return `${nl(days / 30)} mnd`;
  return `${nl(days / 365)} jr`;
}

/**
 * Lange Nederlandse weergave voor de beoordelingsknoppen (ontwerp 1f): "10 min", "3 uur",
 * "1 dag", "3 dagen", "2 maanden", "1,5 jaar".
 */
export function formatIntervalLong(from: Date, to: Date): string {
  const minutes = (to.getTime() - from.getTime()) / 60_000;
  const nl = (n: number) =>
    n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace(".", ",");
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} uur`;
  const days = hours / 24;
  if (days < 30) {
    const d = Math.round(days);
    return `${d} ${d === 1 ? "dag" : "dagen"}`;
  }
  if (days < 365) {
    const m = nl(days / 30);
    return `${m} ${m === "1" ? "maand" : "maanden"}`;
  }
  return `${nl(days / 365)} jaar`;
}
