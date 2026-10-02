import { describe, expect, it } from "vitest";
import { formatInterval, newSchedule, preview, rate, STATE, type Schedule } from "@/lib/fsrs";

const settings = { desired_retention: 0.9 };
const t0 = new Date("2026-10-01T08:00:00Z");
const days = (n: number) => new Date(t0.getTime() + n * 86_400_000);

/** Breng een kaart in staat Review door hem twee keer Goed te geven. */
function reviewCard(retention = 0.9): { schedule: Schedule; at: Date } {
  const s = { desired_retention: retention };
  let schedule = newSchedule(t0);
  schedule = rate(schedule, 3, t0, s).schedule;
  const at = new Date(schedule.due);
  schedule = rate(schedule, 3, at, s).schedule;
  return { schedule, at };
}

describe("lib/fsrs", () => {
  it("nieuwe kaart is leeg en direct due", () => {
    const s = newSchedule(t0);
    expect(s.state).toBe(STATE.New);
    expect(s.reps).toBe(0);
    expect(s.due).toBe(t0.toISOString());
  });

  it("nieuwe kaart + Goed geeft een learning-stap", () => {
    const { schedule, log } = rate(newSchedule(t0), 3, t0, settings);
    expect(schedule.state).toBe(STATE.Learning);
    expect(schedule.reps).toBe(1);
    // Learning-stap is minuten, geen dagen.
    expect(new Date(schedule.due).getTime() - t0.getTime()).toBeLessThan(86_400_000);
    expect(log.rating).toBe(3);
    expect(log.state).toBe(STATE.New);
  });

  it("Opnieuw in Review verhoogt lapses en zet de kaart in Relearning", () => {
    const { schedule } = reviewCard();
    expect(schedule.state).toBe(STATE.Review);
    expect(schedule.lapses).toBe(0);
    const later = new Date(schedule.due);
    const after = rate(schedule, 1, later, settings).schedule;
    expect(after.lapses).toBe(1);
    expect(after.state).toBe(STATE.Relearning);
  });

  it("retentie 0,95 geeft kortere intervallen dan 0,90", () => {
    const high = reviewCard(0.95).schedule;
    const low = reviewCard(0.9).schedule;
    expect(high.scheduled_days).toBeLessThan(low.scheduled_days);

    // Ook vanaf exact dezelfde kaart: de preview voor Goed ligt eerder bij hogere retentie.
    const { schedule } = reviewCard(0.9);
    const at = days(10);
    const p90 = preview(schedule, at, { desired_retention: 0.9 })[3].due.getTime();
    const p95 = preview(schedule, at, { desired_retention: 0.95 })[3].due.getTime();
    expect(p95).toBeLessThan(p90);
  });

  it("preview geeft vier oplopende intervallen", () => {
    const { schedule } = reviewCard();
    const p = preview(schedule, new Date(schedule.due), settings);
    expect(p[1].due.getTime()).toBeLessThan(p[3].due.getTime());
    expect(p[3].due.getTime()).toBeLessThanOrEqual(p[4].due.getTime());
    for (const r of [1, 2, 3, 4] as const) expect(p[r].label).toMatch(/min|u|d|mnd|jr/);
  });

  it("rate is deterministisch voor dezelfde kaart en hetzelfde moment (server = client)", () => {
    const { schedule } = reviewCard();
    const at = days(20);
    expect(rate(schedule, 3, at, settings)).toEqual(rate(schedule, 3, at, settings));
  });

  it("formatInterval geeft korte Nederlandse labels", () => {
    const from = t0;
    const plus = (ms: number) => new Date(from.getTime() + ms);
    expect(formatInterval(from, plus(30_000))).toBe("<1 min");
    expect(formatInterval(from, plus(10 * 60_000))).toBe("10 min");
    expect(formatInterval(from, plus(3 * 3_600_000))).toBe("3 u");
    expect(formatInterval(from, plus(4 * 86_400_000))).toBe("4 d");
    expect(formatInterval(from, plus(45 * 86_400_000))).toBe("1,5 mnd");
    expect(formatInterval(from, plus(800 * 86_400_000))).toBe("2,2 jr");
  });
});
