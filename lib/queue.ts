// Opbouw van de dagelijkse wachtrij. Puur: geen database, geen klok. Zie SPEC 5.2.
import { STATE, type Schedule } from "./fsrs";

export type QueueItem = {
  card_id: string;
  topic_id: string;
  schedule: Schedule;
  /** Toetsdatum van de module (JJJJ-MM-DD) of null. */
  exam_date: string | null;
  module_sort: number;
  topic_sort: number;
  /** Laagste sort_order van de gekoppelde leerdoelen, of null zonder leerdoel. */
  objective_sort: number | null;
  created_at: string;
};

export type QueueOptions = {
  now: Date;
  /** Eind van de lokale dag (exclusief), in de tijdzone van de gebruiker. */
  endOfDay: Date;
  /** Lokale datum van vandaag (JJJJ-MM-DD), om verlopen toetsdata te negeren. */
  today: string;
  maxNewPerDay: number;
  /** Aantal nieuwe kaarten dat vandaag al is gestart. */
  newStartedToday: number;
};

export type DailyQueue = {
  /** Kaarten om nu te doen, in volgorde. */
  queue: QueueItem[];
  /** Learning-kaarten die later vandaag due worden; komen op hun due-tijd terug. */
  pending: QueueItem[];
  counts: { due: number; new: number; learning: number };
};

/** Hoe ver vooruit een learning-kaart mag worden getoond als er niets anders meer is. */
export const LEARN_AHEAD_MS = 20 * 60_000;

export function isNew(s: Schedule): boolean {
  return s.state === STATE.New && s.reps === 0;
}

function isLearning(s: Schedule): boolean {
  return s.state === STATE.Learning || s.state === STATE.Relearning;
}

const dueTime = (i: QueueItem) => new Date(i.schedule.due).getTime();

function compareNew(today: string) {
  const exam = (i: QueueItem) =>
    i.exam_date && i.exam_date >= today ? i.exam_date : "9999-12-31";
  return (a: QueueItem, b: QueueItem) =>
    exam(a).localeCompare(exam(b)) ||
    a.module_sort - b.module_sort ||
    a.topic_sort - b.topic_sort ||
    (a.objective_sort ?? Number.MAX_SAFE_INTEGER) - (b.objective_sort ?? Number.MAX_SAFE_INTEGER) ||
    a.created_at.localeCompare(b.created_at) ||
    a.card_id.localeCompare(b.card_id);
}

/**
 * Kies de nieuwe kaarten van vandaag, om en om over de thema's verdeeld, zodat alle
 * thema's tegelijk starten. Thema's met een naderende toets komen in elke ronde eerst;
 * binnen een thema gaat het op leerdoelvolgorde. Raakt een thema op, dan vullen de
 * andere aan.
 */
export function pickNew(fresh: QueueItem[], room: number, today: string): QueueItem[] {
  const byTopic = new Map<string, QueueItem[]>();
  for (const item of [...fresh].sort(compareNew(today))) {
    const list = byTopic.get(item.topic_id);
    if (list) list.push(item);
    else byTopic.set(item.topic_id, [item]);
  }
  const lists = [...byTopic.values()];
  const out: QueueItem[] = [];
  for (let round = 0; out.length < room; round++) {
    const before = out.length;
    for (const list of lists) {
      if (out.length < room && round < list.length) out.push(list[round]);
    }
    if (out.length === before) break;
  }
  return out;
}

/** Verspreid `inserts` gelijkmatig door `base`, met behoud van beider volgorde. */
export function spread<T>(base: T[], inserts: T[]): T[] {
  if (base.length === 0) return [...inserts];
  if (inserts.length === 0) return [...base];
  const keyed = [
    ...base.map((item, i) => ({ item, key: (i + 0.5) / base.length, tie: 0 })),
    ...inserts.map((item, i) => ({ item, key: (i + 0.5) / inserts.length, tie: 1 })),
  ];
  keyed.sort((a, b) => a.key - b.key || a.tie - b.tie);
  return keyed.map((k) => k.item);
}

/**
 * Zorg dat geen twee opeenvolgende items hetzelfde thema hebben, waar dat kan.
 * Gulzig: staat er een herhaling van het vorige thema, dan wordt het eerstvolgende
 * item uit een ander thema naar voren gehaald. De rest behoudt zijn volgorde.
 */
export function interleave<T>(items: T[], topicOf: (item: T) => string): T[] {
  const out = [...items];
  for (let i = 1; i < out.length; i++) {
    if (topicOf(out[i]) !== topicOf(out[i - 1])) continue;
    const j = out.findIndex((item, k) => k > i && topicOf(item) !== topicOf(out[i - 1]));
    if (j === -1) break;
    const [moved] = out.splice(j, 1);
    out.splice(i, 0, moved);
  }
  return out;
}

export function buildDailyQueue(items: QueueItem[], opts: QueueOptions): DailyQueue {
  const now = opts.now.getTime();
  const end = opts.endOfDay.getTime();

  const due: QueueItem[] = [];
  const pending: QueueItem[] = [];
  const fresh: QueueItem[] = [];

  for (const item of items) {
    const s = item.schedule;
    if (isNew(s)) {
      fresh.push(item);
    } else if (dueTime(item) < end) {
      if (isLearning(s) && dueTime(item) > now) pending.push(item);
      else due.push(item);
    }
  }

  due.sort((a, b) => dueTime(a) - dueTime(b) || a.card_id.localeCompare(b.card_id));
  pending.sort((a, b) => dueTime(a) - dueTime(b));

  const room = Math.max(0, opts.maxNewPerDay - opts.newStartedToday);
  const newToday = pickNew(fresh, room, opts.today);

  return {
    queue: interleave(spread(due, newToday), (i) => i.topic_id),
    pending,
    counts: { due: due.length, new: newToday.length, learning: pending.length },
  };
}

/**
 * Kies de volgende kaart binnen een sessie: eerst een learning-kaart die due is,
 * dan de wachtrij, en als die leeg is een learning-kaart binnen LEARN_AHEAD_MS.
 */
export function pickNext(
  queue: QueueItem[],
  pending: QueueItem[],
  now: Date,
): { item: QueueItem; source: "queue" | "pending" } | null {
  const t = now.getTime();
  if (pending.length > 0 && dueTime(pending[0]) <= t) return { item: pending[0], source: "pending" };
  if (queue.length > 0) return { item: queue[0], source: "queue" };
  if (pending.length > 0 && dueTime(pending[0]) - t <= LEARN_AHEAD_MS) {
    return { item: pending[0], source: "pending" };
  }
  return null;
}

/**
 * Na een beoordeling: kaarten die nog vandaag (in learning of relearning) due
 * worden, komen terug in de rij op hun due-tijd.
 */
export function requeue(
  pending: QueueItem[],
  item: QueueItem,
  schedule: Schedule,
  endOfDay: Date,
): QueueItem[] {
  const rest = pending.filter((p) => p.card_id !== item.card_id);
  if (!isLearning(schedule) || new Date(schedule.due).getTime() >= endOfDay.getTime()) return rest;
  return [...rest, { ...item, schedule }].sort((a, b) => dueTime(a) - dueTime(b));
}
