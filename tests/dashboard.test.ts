import { describe, expect, it } from "vitest";
import { minutesByDay, nextDays, pastDays, retention, streak, workload } from "@/lib/dashboard";
import { STATE } from "@/lib/fsrs";

const TZ = "Europe/Amsterdam";
const now = new Date("2026-10-02T10:00:00Z");

describe("workload", () => {
  it("telt per lokale dag, achterstallig bij vandaag, nieuwe kaarten niet", () => {
    const review = (due: string) => ({ due, state: STATE.Review, reps: 3 });
    const out = workload(
      [
        review("2026-09-20T08:00:00Z"), // achterstallig -> vandaag
        review("2026-10-02T21:30:00Z"), // 23:30 lokaal -> vandaag
        review("2026-10-02T22:30:00Z"), // 00:30 lokaal -> morgen
        review("2026-10-20T08:00:00Z"), // buiten 14 dagen
        { due: "2026-10-02T08:00:00Z", state: STATE.New, reps: 0 },
      ],
      now,
      TZ,
    );
    expect(out).toHaveLength(14);
    expect(out[0]).toEqual({ day: "2026-10-02", count: 2 });
    expect(out[1]).toEqual({ day: "2026-10-03", count: 1 });
    expect(out.reduce((s, d) => s + d.count, 0)).toBe(3);
  });

  it("dagreeksen", () => {
    expect(nextDays(now, TZ, 3)).toEqual(["2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(pastDays(now, TZ, 3)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
  });
});

describe("retention", () => {
  it("telt alleen herhalingen in staat Review", () => {
    const r = retention([
      { state: STATE.Review, rating: 3 },
      { state: STATE.Review, rating: 1 },
      { state: STATE.Review, rating: 4 },
      { state: STATE.Review, rating: 2 },
      { state: STATE.New, rating: 1 },
      { state: STATE.Learning, rating: 1 },
    ]);
    expect(r).toEqual({ value: 0.75, n: 4 });
    expect(retention([{ state: STATE.New, rating: 3 }])).toEqual({ value: null, n: 0 });
  });
});

describe("streak", () => {
  it("telt opeenvolgende dagen tot vandaag, of tot gisteren als vandaag nog leeg is", () => {
    const days = new Set(["2026-09-29", "2026-09-30", "2026-10-01"]);
    expect(streak(days, "2026-10-02")).toBe(3);
    expect(streak(new Set([...days, "2026-10-02"]), "2026-10-02")).toBe(4);
    expect(streak(new Set(["2026-09-29"]), "2026-10-02")).toBe(0);
  });
});

describe("minutesByDay", () => {
  it("telt duren op per lokale dag", () => {
    const days = ["2026-10-01", "2026-10-02"];
    const out = minutesByDay(
      [
        { at: "2026-10-01T21:59:00Z", ms: 120_000 }, // 23:59 lokaal op 1 okt
        { at: "2026-10-01T22:01:00Z", ms: 180_000 }, // 00:01 lokaal op 2 okt
        { at: "2026-10-02T09:00:00Z", ms: 600_000 },
      ],
      days,
      TZ,
    );
    expect(out).toEqual([
      { day: "2026-10-01", minutes: 2 },
      { day: "2026-10-02", minutes: 13 },
    ]);
  });
});

import { errorProfile } from "@/lib/dashboard";

describe("errorProfile", () => {
  it("telt fouttypes en geeft advies als één type overheerst", () => {
    expect(errorProfile(["reasoning_error", "reasoning_error", "knowledge_gap", null])).toEqual({
      counts: { knowledge_gap: 1, reasoning_error: 2, slip: 0 },
      advice: "Vooral redeneerfouten: oefen meer casussen.",
    });
    expect(errorProfile(["knowledge_gap", "knowledge_gap", "slip"]).advice).toBe("Vooral kennisgaten: terug naar de stof.");
    expect(errorProfile(["knowledge_gap", "slip"]).advice).toBeNull(); // te weinig
    expect(errorProfile(["knowledge_gap", "reasoning_error", "slip"]).advice).toBeNull(); // geen overheersend type
  });
});
