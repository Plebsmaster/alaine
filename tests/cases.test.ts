import { describe, expect, it } from "vitest";
import { checkExpertReflection, moveItem, sameDiagnosis, selectCases, type CaseCandidate } from "@/lib/cases";

const now = new Date("2026-10-02T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const c = (id: string, topic: string, last: number | null = null, score: number | null = null): CaseCandidate => ({
  id,
  topic_id: topic,
  last_attempt_at: last === null ? null : daysAgo(last),
  last_score: score,
});
const ids = (cs: CaseCandidate[]) => cs.map((x) => x.id);
const fixed = () => 0.5;

describe("selectCases", () => {
  it("slaat casussen over die korter dan 7 dagen geleden zijn gedaan", () => {
    const out = selectCases([c("a", "T1", 3, 1), c("b", "T2", 8, 5), c("c", "T3")], 5, now, fixed);
    expect(ids(out)).not.toContain("a");
    expect(ids(out)).toEqual(["c", "b"]);
  });

  it("volgorde: nooit geoefend, dan laagste score, dan langst geleden", () => {
    const out = selectCases(
      [c("old-high", "T1", 30, 5), c("low", "T2", 10, 2), c("never", "T3"), c("old-mid", "T4", 40, 3), c("recent-mid", "T5", 9, 3)],
      5,
      now,
      fixed,
    );
    expect(ids(out)).toEqual(["never", "low", "old-mid", "recent-mid", "old-high"]);
  });

  it("mengt thema's: eerst één per thema, dan aanvullen", () => {
    const out = selectCases([c("a1", "A"), c("a2", "A"), c("a3", "A"), c("b1", "B"), c("c1", "C")], 3, now, fixed);
    expect(new Set(out.map((x) => x.topic_id)).size).toBe(3);
    const two = selectCases([c("a1", "A"), c("a2", "A"), c("b1", "B")], 3, now, fixed);
    expect(ids(two).sort()).toEqual(["a1", "a2", "b1"]);
    expect(two[0].topic_id).not.toBe(two[1].topic_id);
  });

  it("geeft minder terug als er niet genoeg zijn", () => {
    expect(selectCases([c("a", "A")], 3, now, fixed)).toHaveLength(1);
    expect(selectCases([], 3, now, fixed)).toHaveLength(0);
  });
});

describe("checkExpertReflection", () => {
  const row = (diagnosis: string, rank: number) => ({ diagnosis, supporting: "", against: "", missing: "", rank });
  it("accepteert een geldige uitwerking", () => {
    expect(checkExpertReflection("Hartfalen", [row("Hartfalen", 1), row("COPD", 2)])).toBeNull();
  });
  it("weigert ongeldige uitwerkingen", () => {
    expect(checkExpertReflection("Hartfalen", [row("Hartfalen", 1)])).toMatch(/minstens twee/);
    expect(checkExpertReflection("Hartfalen", [row("Hartfalen", 1), row("COPD", 1)])).toMatch(/Precies één/);
    expect(checkExpertReflection("Hartfalen", [row("COPD", 1), row("Hartfalen", 2)])).toMatch(/juiste diagnose/);
  });
});

describe("sameDiagnosis", () => {
  it("negeert hoofdletters, accenten en leestekens", () => {
    expect(sameDiagnosis("  psoriasis ", "Psoriasis")).toBe(true);
    expect(sameDiagnosis("Seborroisch eczeem", "Seborroïsch eczeem")).toBe(true);
  });

  it("een preciezere of kortere schrijfwijze telt mee, een ander woord niet", () => {
    expect(sameDiagnosis("Psoriasis", "Psoriasis vulgaris")).toBe(true);
    expect(sameDiagnosis("Hartfalen met verminderde ejectiefractie", "Hartfalen")).toBe(true);
    expect(sameDiagnosis("Eczeem", "Seborroïsch eczeem")).toBe(true);
    expect(sameDiagnosis("COPD", "Astma")).toBe(false);
    expect(sameDiagnosis("Psoriasis", "Psoriasisartritis")).toBe(false);
    expect(sameDiagnosis("", "Astma")).toBe(false);
  });
});

describe("moveItem", () => {
  it("verplaatst omhoog en omlaag zonder de lijst zelf te wijzigen", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(list, 0, 1)).toEqual(["b", "a", "c"]);
    expect(list).toEqual(["a", "b", "c"]);
  });

  it("buiten de grenzen: niets of tot aan de rand", () => {
    const list = ["a", "b"];
    expect(moveItem(list, 5, 0)).toBe(list);
    expect(moveItem(list, 0, 9)).toEqual(["b", "a"]);
  });
});
