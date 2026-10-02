import { describe, expect, it } from "vitest";
import { pickExamQuestions, scoreByObjective } from "@/lib/exam";

let seed = 1;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const qs = (topic: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${topic}${i}`, topic_id: topic }));

describe("pickExamQuestions", () => {
  it("verdeelt vragen gelijk over de gekozen thema's en mengt ze", () => {
    const all = [...qs("A", 10), ...qs("B", 10), ...qs("C", 10)];
    const out = pickExamQuestions(all, ["A", "B", "C"], 9, rnd);
    expect(out).toHaveLength(9);
    for (const t of ["A", "B", "C"]) expect(out.filter((q) => q.topic_id === t)).toHaveLength(3);
    for (let i = 1; i < out.length; i++) expect(out[i].topic_id).not.toBe(out[i - 1].topic_id);
    expect(new Set(out.map((q) => q.id)).size).toBe(9);
  });

  it("negeert thema's die niet gekozen zijn en vult aan als een thema op is", () => {
    const all = [...qs("A", 2), ...qs("B", 10), ...qs("X", 10)];
    const out = pickExamQuestions(all, ["A", "B"], 6, rnd);
    expect(out.some((q) => q.topic_id === "X")).toBe(false);
    expect(out.filter((q) => q.topic_id === "A")).toHaveLength(2);
    expect(out.filter((q) => q.topic_id === "B")).toHaveLength(4);
  });

  it("geeft alles als er minder vragen zijn dan gevraagd", () => {
    expect(pickExamQuestions(qs("A", 3), ["A"], 20, rnd)).toHaveLength(3);
  });
});

describe("scoreByObjective", () => {
  const o1 = { id: "o1", code: "2.1", description: "Ritme" };
  const o2 = { id: "o2", code: "2.10", description: "Bloeddruk" };
  const o3 = { id: "o3", code: "2.2", description: "ECG" };

  it("telt per leerdoel, ook bij meerdere leerdoelen per vraag", () => {
    const s = scoreByObjective([
      { question_id: "q1", correct: true, objectives: [o1, o3] },
      { question_id: "q2", correct: false, objectives: [o1] },
      { question_id: "q3", correct: null, objectives: [o2] },
      { question_id: "q4", correct: true, objectives: [] },
    ]);
    expect(s.map((x) => x.code)).toEqual(["2.1", "2.2", "2.10", null]);
    expect(s[0]).toMatchObject({ correct: 1, total: 2, pending: 0 });
    expect(s[1]).toMatchObject({ correct: 1, total: 1 });
    expect(s[2]).toMatchObject({ correct: 0, total: 1, pending: 1 });
    expect(s[3]).toMatchObject({ description: "Zonder leerdoel", correct: 1, total: 1 });
  });
});
