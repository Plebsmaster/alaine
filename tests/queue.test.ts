import { describe, expect, it } from "vitest";
import { newSchedule, rate, STATE, type Schedule } from "@/lib/fsrs";
import {
  buildDailyQueue,
  interleave,
  pickNew,
  pickNext,
  requeue,
  spread,
  type QueueItem,
} from "@/lib/queue";
import { dayBounds } from "@/lib/time";

const TZ = "Europe/Amsterdam";
const now = new Date("2026-10-02T10:00:00Z"); // 12:00 in Amsterdam
const { end: endOfDay } = dayBounds(now, TZ);

let seq = 0;
function item(topic: string, schedule: Schedule, extra: Partial<QueueItem> = {}): QueueItem {
  seq += 1;
  return {
    card_id: `c${String(seq).padStart(3, "0")}`,
    topic_id: topic,
    schedule,
    exam_date: null,
    module_sort: 0,
    topic_sort: 0,
    objective_sort: null,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
    ...extra,
  };
}

function reviewDue(due: string): Schedule {
  return { ...newSchedule(new Date(due)), state: STATE.Review, reps: 3, stability: 5, difficulty: 5, due };
}

const opts = (o: Partial<Parameters<typeof buildDailyQueue>[1]> = {}) => ({
  now,
  endOfDay,
  today: "2026-10-02",
  maxNewPerDay: 20,
  newStartedToday: 0,
  ...o,
});

describe("interleave", () => {
  it("zet geen twee kaarten uit hetzelfde thema achter elkaar als dat kan", () => {
    const out = interleave(["A", "A", "A", "B", "B", "B"], (x) => x);
    expect(out).toEqual(["A", "B", "A", "B", "A", "B"]);
  });

  it("laat de rest staan als er geen ander thema meer is", () => {
    expect(interleave(["A", "A", "A", "A", "B"], (x) => x)).toEqual(["A", "B", "A", "A", "A"]);
  });
});

describe("spread", () => {
  it("verspreidt nieuwe kaarten door de sessie in plaats van aan het eind", () => {
    const out = spread(["d1", "d2", "d3", "d4", "d5", "d6"], ["n1", "n2"]);
    expect(out.indexOf("n1")).toBeGreaterThan(0);
    expect(out.indexOf("n2")).toBeLessThan(out.length - 1);
    expect(out.filter((x) => x.startsWith("d"))).toEqual(["d1", "d2", "d3", "d4", "d5", "d6"]);
  });
});

describe("buildDailyQueue", () => {
  it("mengt thema's: geen twee opeenvolgende kaarten uit hetzelfde thema", () => {
    const items = [
      ...["A", "A", "A", "A"].map((t, i) => item(t, reviewDue(`2026-09-2${i}T08:00:00Z`))),
      ...["B", "B", "B"].map((t, i) => item(t, reviewDue(`2026-09-2${i}T09:00:00Z`))),
      ...["C", "C", "C"].map((t) => item(t, newSchedule(now))),
    ];
    const { queue } = buildDailyQueue(items, opts());
    expect(queue).toHaveLength(10);
    for (let i = 1; i < queue.length; i++) {
      expect(queue[i].topic_id).not.toBe(queue[i - 1].topic_id);
    }
  });

  it("neemt herhalingen op tot het eind van de lokale dag, oudste eerst", () => {
    const late = item("A", reviewDue("2026-10-02T21:30:00Z")); // 23:30 Amsterdam: vandaag
    const tomorrow = item("A", reviewDue("2026-10-02T22:30:00Z")); // 00:30 Amsterdam: morgen
    const old = item("B", reviewDue("2026-09-01T08:00:00Z"));
    const { queue } = buildDailyQueue([late, tomorrow, old], opts());
    expect(queue.map((q) => q.card_id)).toEqual([old.card_id, late.card_id]);
  });

  it("respecteert de tijdzonegrens bij een andere tijdzone", () => {
    const due = item("A", reviewDue("2026-10-02T21:30:00Z"));
    const ny = dayBounds(now, "America/New_York").end; // 3 okt 04:00 UTC
    const tokyo = dayBounds(now, "Asia/Tokyo").end; // 2 okt 15:00 UTC
    expect(buildDailyQueue([due], opts({ endOfDay: ny })).queue).toHaveLength(1);
    expect(buildDailyQueue([due], opts({ endOfDay: tokyo })).queue).toHaveLength(0);
  });

  it("beperkt nieuwe kaarten tot max per dag min wat al is gestart", () => {
    const fresh = Array.from({ length: 30 }, () => item("A", newSchedule(now)));
    expect(buildDailyQueue(fresh, opts({ maxNewPerDay: 10 })).counts.new).toBe(10);
    expect(buildDailyQueue(fresh, opts({ maxNewPerDay: 10, newStartedToday: 7 })).counts.new).toBe(3);
    expect(buildDailyQueue(fresh, opts({ maxNewPerDay: 10, newStartedToday: 12 })).counts.new).toBe(0);
  });

  it("verdeelt nieuwe kaarten om en om over de thema's, naderende toets eerst", () => {
    const later = item("A", newSchedule(now), { exam_date: "2026-12-01", objective_sort: 1 });
    const soonB2 = item("B", newSchedule(now), { exam_date: "2026-10-20", objective_sort: 2 });
    const soonB1 = item("B", newSchedule(now), { exam_date: "2026-10-20", objective_sort: 1 });
    const past = item("C", newSchedule(now), { exam_date: "2026-09-01", objective_sort: 1 });
    // Ronde 1: B (toets 20 okt), A (toets 1 dec), C (toets voorbij). Ronde 2: B.
    const picked = pickNew([later, soonB2, past, soonB1], 4, "2026-10-02");
    expect(picked.map((q) => q.card_id)).toEqual([soonB1, later, past, soonB2].map((c) => c.card_id));
    // Met ruimte voor 2 krijgt elk thema met de vroegste toets er één.
    expect(pickNew([later, soonB2, past, soonB1], 2, "2026-10-02")).toEqual([soonB1, later]);
  });

  it("laat alle thema's tegelijk starten en vult aan als een thema op is", () => {
    const fresh = [
      ...Array.from({ length: 10 }, (_, i) => item("A", newSchedule(now), { topic_sort: 1, objective_sort: i })),
      ...Array.from({ length: 10 }, (_, i) => item("B", newSchedule(now), { topic_sort: 2, objective_sort: i })),
      ...Array.from({ length: 2 }, (_, i) => item("C", newSchedule(now), { topic_sort: 3, objective_sort: i })),
    ];
    const count = (items: QueueItem[], topic: string) => items.filter((i) => i.topic_id === topic).length;

    const six = pickNew(fresh, 6, "2026-10-02");
    expect([count(six, "A"), count(six, "B"), count(six, "C")]).toEqual([2, 2, 2]);

    const twelve = pickNew(fresh, 12, "2026-10-02");
    expect([count(twelve, "A"), count(twelve, "B"), count(twelve, "C")]).toEqual([5, 5, 2]);

    // Binnen een thema blijft de leerdoelvolgorde.
    const a = twelve.filter((i) => i.topic_id === "A").map((i) => i.objective_sort);
    expect(a).toEqual([0, 1, 2, 3, 4]);

    expect(pickNew(fresh, 100, "2026-10-02")).toHaveLength(22);
  });

  it("houdt learning-kaarten die later vandaag due zijn apart tot hun due-tijd", () => {
    const learning = rate(newSchedule(now), 3, now, { desired_retention: 0.9 }).schedule;
    const waiting = item("A", learning);
    const ready = item("B", { ...learning, due: new Date(now.getTime() - 60_000).toISOString() });
    const { queue, pending } = buildDailyQueue([waiting, ready], opts());
    expect(queue.map((q) => q.card_id)).toEqual([ready.card_id]);
    expect(pending.map((q) => q.card_id)).toEqual([waiting.card_id]);
  });
});

describe("binnen de sessie", () => {
  const settings = { desired_retention: 0.9 };

  it("Opnieuw zet een kaart terug in de rij op zijn due-tijd", () => {
    const card = item("A", reviewDue("2026-10-01T08:00:00Z"));
    const { schedule } = rate(card.schedule, 1, now, settings);
    const pending = requeue([], card, schedule, endOfDay);
    expect(pending).toHaveLength(1);
    expect(pending[0].schedule.state).toBe(STATE.Relearning);

    const other = item("B", reviewDue("2026-10-01T09:00:00Z"));
    // Direct erna: eerst de wachtrij, de relearning-kaart is nog niet due.
    expect(pickNext([other], pending, now)?.item.card_id).toBe(other.card_id);
    // Na de due-tijd komt de relearning-kaart vóór de wachtrij.
    const later = new Date(new Date(schedule.due).getTime() + 1000);
    expect(pickNext([other], pending, later)?.item.card_id).toBe(card.card_id);
  });

  it("Goed op een review-kaart haalt hem uit de sessie", () => {
    const card = item("A", reviewDue("2026-10-01T08:00:00Z"));
    const { schedule } = rate(card.schedule, 3, now, settings);
    expect(requeue([], card, schedule, endOfDay)).toHaveLength(0);
  });

  it("toont een learning-kaart vooruit als de rij leeg is, maar niet te ver", () => {
    const soon = item("A", { ...reviewDue(new Date(now.getTime() + 5 * 60_000).toISOString()), state: STATE.Learning });
    const far = item("A", { ...reviewDue(new Date(now.getTime() + 60 * 60_000).toISOString()), state: STATE.Learning });
    expect(pickNext([], [soon], now)?.item.card_id).toBe(soon.card_id);
    expect(pickNext([], [far], now)).toBeNull();
  });
});

describe("dayBounds", () => {
  it("geeft lokale middernacht, ook rond de wintertijdwissel", () => {
    // 25 oktober 2026: klok gaat in Amsterdam van 03:00 naar 02:00.
    const { start, end } = dayBounds(new Date("2026-10-25T12:00:00Z"), TZ);
    expect(start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
});
