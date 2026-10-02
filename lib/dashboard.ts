// Rekenwerk voor /overzicht. Puur: geen database. Zie SPEC 5.8.
import { STATE } from "./fsrs";
import { localDate } from "./time";

/** Lokale datum als "JJJJ-MM-DD". */
export function dayKey(date: Date, timeZone: string): string {
  const d = localDate(date, timeZone);
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

/** De komende `days` lokale dagen vanaf vandaag, als dagsleutels. */
export function nextDays(now: Date, timeZone: string, days: number): string[] {
  const t = localDate(now, timeZone);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(t.year, t.month - 1, t.day + i));
    return d.toISOString().slice(0, 10);
  });
}

/** De afgelopen `days` lokale dagen tot en met vandaag. */
export function pastDays(now: Date, timeZone: string, days: number): string[] {
  const t = localDate(now, timeZone);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.UTC(t.year, t.month - 1, t.day - (days - 1 - i)));
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Aantal herhalingen per dag voor de komende dagen. Achterstallige kaarten tellen
 * vandaag mee. Nieuwe kaarten (nog nooit gezien) tellen niet mee: die plant FSRS niet.
 */
export function workload(
  cards: { due: string; state: number; reps: number }[],
  now: Date,
  timeZone: string,
  days = 14,
): { day: string; count: number }[] {
  const keys = nextDays(now, timeZone, days);
  const counts = new Map(keys.map((k) => [k, 0]));
  for (const c of cards) {
    if (c.state === STATE.New && c.reps === 0) continue;
    const k = dayKey(new Date(c.due), timeZone);
    const key = k < keys[0] ? keys[0] : k;
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return keys.map((day) => ({ day, count: counts.get(day)! }));
}

/** Retentie: aandeel herhalingen in staat Review dat niet met "Opnieuw" is beoordeeld. */
export function retention(logs: { state: number; rating: number }[]): { value: number | null; n: number } {
  const reviews = logs.filter((l) => l.state === STATE.Review);
  if (reviews.length === 0) return { value: null, n: 0 };
  return { value: reviews.filter((l) => l.rating !== 1).length / reviews.length, n: reviews.length };
}

/**
 * Studiestreak: aantal opeenvolgende dagen met studie, eindigend vandaag. Is er vandaag
 * nog niets gedaan, dan telt de reeks tot en met gisteren (de dag is nog niet om).
 */
export function streak(activeDays: Set<string>, today: string): number {
  const step = (k: string) => {
    const d = new Date(`${k}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  let day = activeDays.has(today) ? today : step(today);
  let n = 0;
  while (activeDays.has(day)) {
    n++;
    day = step(day);
  }
  return n;
}

/** Totale minuten per dag uit losse duren (ms) met een tijdstip. */
export function minutesByDay(
  items: { at: string; ms: number }[],
  days: string[],
  timeZone: string,
): { day: string; minutes: number }[] {
  const totals = new Map(days.map((d) => [d, 0]));
  for (const it of items) {
    const k = dayKey(new Date(it.at), timeZone);
    if (totals.has(k)) totals.set(k, totals.get(k)! + Math.max(0, it.ms));
  }
  return days.map((day) => ({ day, minutes: Math.round(totals.get(day)! / 60_000) }));
}

export const LEECH_LAPSES = 4;
