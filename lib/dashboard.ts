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

export type ErrorCounts = { knowledge_gap: number; reasoning_error: number; slip: number };

/** A1: verdeling van fouttypes, en een advies als één type duidelijk overheerst. */
export function errorProfile(types: (string | null | undefined)[]): { counts: ErrorCounts; advice: string | null } {
  const counts: ErrorCounts = { knowledge_gap: 0, reasoning_error: 0, slip: 0 };
  for (const t of types) if (t && t in counts) counts[t as keyof ErrorCounts] += 1;
  const total = counts.knowledge_gap + counts.reasoning_error + counts.slip;
  let advice: string | null = null;
  if (total >= 3) {
    if (counts.reasoning_error > counts.knowledge_gap && counts.reasoning_error >= total / 2) advice = "Vooral redeneerfouten: oefen meer casussen.";
    else if (counts.knowledge_gap > counts.reasoning_error && counts.knowledge_gap >= total / 2) advice = "Vooral kennisgaten: terug naar de stof.";
    else if (counts.slip >= total / 2) advice = "Vooral slordigheid: kortere sessies, of stoppen als je moe bent.";
  }
  return { counts, advice };
}

/** Ronde bovengrens voor een grafiekas, in stappen 1, 2, 2,5, 5, 10 (23 → 25, niet 50). */
export function niceMax(n: number): number {
  if (n <= 0) return 0;
  const steps = [1, 2, 2.5, 5, 10];
  const mag = 10 ** Math.floor(Math.log10(n));
  for (const s of steps) if (s * mag >= n) return s * mag;
  return 10 * mag;
}

/**
 * Schaal voor "Retentie per thema" (ontwerp 1j): van `min` tot 100%. `min` is 70, of lager
 * (afgerond op tientallen) als een thema daaronder zit. `pos` geeft 0–1 voor een percentage.
 */
export function retentionScale(percents: (number | null)[]): { min: number; pos: (x: number) => number } {
  const known = percents.filter((p): p is number => p !== null);
  const lowest = known.length ? Math.min(...known) : 100;
  const min = Math.min(70, Math.floor(lowest / 10) * 10);
  return { min, pos: (x: number) => Math.max(0, Math.min(1, (x - min) / (100 - min))) };
}
