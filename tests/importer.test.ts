import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkReferences,
  emptyExisting,
  formatPath,
  formatSummary,
  parseImport,
  planImport,
  summarize,
  toPayload,
} from "@/lib/import/importer";

const example = JSON.parse(readFileSync("content/voorbeeld-import.json", "utf8"));
const clone = () => structuredClone(example);

function parseOk(raw: unknown) {
  const r = parseImport(raw);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.bundle;
}

describe("parseImport", () => {
  it("accepteert content/voorbeeld-import.json", () => {
    const bundle = parseOk(example);
    expect(bundle.cards).toHaveLength(3);
    expect(bundle.questions).toHaveLength(2);
    expect(bundle.cases).toHaveLength(0);
  });

  it("geeft per fout het pad, zoals cards[1].front", () => {
    const raw = clone();
    raw.cards[1].front = "   ";
    raw.cards[2].type = "flashcard";
    const r = parseImport(raw);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.path)).toEqual(expect.arrayContaining(["cards[1].front", "cards[2].type"]));
  });

  it("weigert tekst langer dan 2.000 tekens", () => {
    const raw = clone();
    raw.cards[0].back = "x".repeat(2001);
    const r = parseImport(raw);
    expect(r.ok).toBe(false);
  });

  it("controleert format en versie", () => {
    expect(parseImport({ ...clone(), format: "iets-anders" }).ok).toBe(false);
    expect(parseImport({ ...clone(), version: 2 }).ok).toBe(false);
  });

  it("controleert external_id en exam_date", () => {
    const raw = clone();
    raw.topics[0].external_id = "Voorbeeld Fysiologie";
    raw.modules[0].exam_date = "12-03-2027";
    const r = parseImport(raw);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(["topics[0].external_id", "modules[0].exam_date"]),
    );
  });

  it("meldt dubbele external_ids binnen een soort", () => {
    const raw = clone();
    raw.cards[2].external_id = raw.cards[0].external_id;
    const r = parseImport(raw);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0].path).toBe("cards[2].external_id");
  });

  it("controleert meerkeuzevragen: 3–6 opties en correct_option binnen bereik", () => {
    const raw = clone();
    raw.questions[1].options = ["a", "b"];
    raw.questions[1].correct_option = 3;
    const r = parseImport(raw);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(["questions[1].options", "questions[1].correct_option"]),
    );
  });

  it("controleert expert_reflection: ≥2 diagnoses, één rank 1, gelijk aan correct_diagnosis", () => {
    const base = {
      external_id: "voorbeeld-fysiologie-c-001",
      topic: "voorbeeld-fysiologie",
      title: "Kortademig bij inspanning",
      vignette: "Man, 64 jaar, ...",
      correct_diagnosis: "Hartfalen",
      objectives: [],
    };
    const ok = {
      ...base,
      expert_reflection: [
        { diagnosis: "Hartfalen", supporting: "oedeem", against: null, missing: null, rank: 1 },
        { diagnosis: "COPD", supporting: "roken", against: "geen piepen", missing: null, rank: 2 },
      ],
    };
    expect(parseImport({ ...clone(), cases: [ok] }).ok).toBe(true);

    const oneDiagnosis = { ...ok, expert_reflection: ok.expert_reflection.slice(0, 1) };
    const twoFirst = { ...ok, expert_reflection: ok.expert_reflection.map((r) => ({ ...r, rank: 1 })) };
    const wrongFirst = { ...ok, correct_diagnosis: "COPD" };
    for (const bad of [oneDiagnosis, twoFirst, wrongFirst]) {
      const r = parseImport({ ...clone(), cases: [bad] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0].path).toBe("cases[0].expert_reflection");
    }
  });

  it("alle lijsten zijn optioneel", () => {
    expect(parseImport({ format: "pa-studie-import", version: 1 }).ok).toBe(true);
  });
});

describe("checkReferences", () => {
  it("vindt verwijzingen binnen het bestand", () => {
    expect(checkReferences(parseOk(example), emptyExisting())).toEqual([]);
  });

  it("meldt een onbekend thema, leerdoel of bron", () => {
    const raw = clone();
    raw.cards[0].topic = "m1-bestaat-niet";
    raw.cards[1].objectives = ["m1-ld-99"];
    raw.questions[0].source = "onbekend-boek";
    const errors = checkReferences(parseOk(raw), emptyExisting());
    expect(errors.map((e) => e.path)).toEqual([
      "cards[0].topic",
      "cards[1].objectives[0]",
      "questions[0].source",
    ]);
  });

  it("accepteert verwijzingen die al in de database staan", () => {
    const onlyCards = {
      format: "pa-studie-import",
      version: 1,
      cards: [{ ...example.cards[0], external_id: "voorbeeld-fysiologie-k-099" }],
    };
    const existing = emptyExisting();
    expect(checkReferences(parseOk(onlyCards), existing)).toHaveLength(3); // thema, leerdoel, bron
    existing.topics.set("voorbeeld-fysiologie", "Voorbeeld");
    existing.sources.add("martini-hart");
    existing.objectives.add("voorbeeld-fysiologie-ld-01");
    expect(checkReferences(parseOk(onlyCards), existing)).toEqual([]);
  });
});

describe("planImport en summarize", () => {
  it("eerste import: alles nieuw", () => {
    const bundle = parseOk(example);
    const existing = emptyExisting();
    const s = summarize(planImport(bundle, existing), bundle, existing);
    expect(s.general.modules).toEqual({ new: 1, updated: 0, skipped: 0 });
    expect(s.general.sources).toEqual({ new: 2, updated: 0, skipped: 0 });
    expect(s.topics).toHaveLength(1);
    expect(s.topics[0].name).toBe("Voorbeeld: hart en longen");
    expect(s.topics[0].counts.cards).toEqual({ new: 3, updated: 0, skipped: 0 });
    expect(s.topics[0].counts.questions).toEqual({ new: 2, updated: 0, skipped: 0 });
    expect(s.conflicts).toEqual([]);
  });

  it("opnieuw importeren: concepten bijgewerkt, actieve kaarten overgeslagen als conflict", () => {
    const bundle = parseOk(example);
    const existing = emptyExisting();
    existing.modules.add("voorbeeld");
    existing.topics.set("voorbeeld-fysiologie", "Voorbeeld: hart en longen");
    existing.cards.set("voorbeeld-fysiologie-k-001", "active");
    existing.cards.set("voorbeeld-fysiologie-k-002", "draft");
    existing.cards.set("voorbeeld-fysiologie-k-003", "suspended");
    const s = summarize(planImport(bundle, existing), bundle, existing);
    expect(s.general.modules).toEqual({ new: 0, updated: 1, skipped: 0 });
    expect(s.topics[0].counts.cards).toEqual({ new: 0, updated: 1, skipped: 2 });
    expect(s.conflicts.map((c) => c.external_id)).toEqual([
      "voorbeeld-fysiologie-k-001",
      "voorbeeld-fysiologie-k-003",
    ]);
    expect(formatSummary(s)).toContain("Conflicten (al actief, niet overschreven): 2");
  });
});

describe("hulpfuncties", () => {
  it("formatPath", () => {
    expect(formatPath(["cards", 12, "front"])).toBe("cards[12].front");
    expect(formatPath(["cases", 0, "expert_reflection", 1, "rank"])).toBe("cases[0].expert_reflection[1].rank");
  });

  it("toPayload haalt image weg en zet image_path", () => {
    const raw = clone();
    raw.cards[0].image = "module-1/06-dermatologie/beelden/plaque.jpg";
    const payload = toPayload(parseOk(raw), new Map([[raw.cards[0].external_id, "uid/voorbeeld.jpg"]]));
    expect(payload.cards[0]).not.toHaveProperty("image");
    expect(payload.cards[0].image_path).toBe("uid/voorbeeld.jpg");
    expect(payload.cards[1].image_path).toBeNull();
  });
});

describe("Aanvulling 01 in het importformaat", () => {
  it("accepteert ketenkaarten en needs_verification, standaard false", () => {
    const raw = clone();
    raw.cards[0].type = "chain";
    raw.cards[0].needs_verification = true;
    const bundle = parseOk(raw);
    expect(bundle.cards[0].type).toBe("chain");
    expect(bundle.cards[0].needs_verification).toBe(true);
    expect(bundle.cards[1].needs_verification).toBe(false);
    expect(toPayload(bundle).cards[0].needs_verification).toBe(true);
  });
});
