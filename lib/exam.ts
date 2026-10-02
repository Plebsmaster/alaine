// Proeftoets en pretest: vragen kiezen en resultaat per leerdoel. Puur. Zie SPEC 5.7.
import { interleave } from "./queue";

export const PRETEST_MIN = 8;
export const PRETEST_MAX = 10;
export const EXAM_DEFAULT = 20;

export type ExamCandidate = { id: string; topic_id: string };

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Kies `n` toetsvragen gemengd over de gekozen thema's: zo gelijk mogelijk verdeeld
 * (om de beurt een vraag per thema), willekeurig binnen een thema, en daarna zo
 * gemengd dat twee opeenvolgende vragen waar mogelijk uit verschillende thema's komen.
 */
export function pickExamQuestions<T extends ExamCandidate>(
  questions: T[],
  topicIds: string[],
  n: number,
  random: () => number = Math.random,
): T[] {
  const pools = topicIds
    .map((t) => shuffle(questions.filter((q) => q.topic_id === t), random))
    .filter((p) => p.length > 0);
  const picked: T[] = [];
  while (picked.length < n && pools.some((p) => p.length > 0)) {
    for (const pool of pools) {
      if (picked.length >= n) break;
      const q = pool.shift();
      if (q) picked.push(q);
    }
  }
  return interleave(shuffle(picked, random), (q) => q.topic_id);
}

export type GradedQuestion = {
  question_id: string;
  /** true/false, of null als een open vraag nog niet is nagekeken. */
  correct: boolean | null;
  objectives: { id: string; code: string | null; description: string }[];
};

export type ObjectiveScore = {
  id: string | null;
  code: string | null;
  description: string;
  correct: number;
  total: number;
  /** Vragen die nog niet zijn nagekeken (open vragen zonder zelfbeoordeling). */
  pending: number;
};

/** Score per leerdoel. Een vraag met meerdere leerdoelen telt bij elk mee. */
export function scoreByObjective(results: GradedQuestion[]): ObjectiveScore[] {
  const map = new Map<string, ObjectiveScore>();
  const add = (key: string, o: Omit<ObjectiveScore, "correct" | "total" | "pending">, r: GradedQuestion) => {
    const s = map.get(key) ?? { ...o, correct: 0, total: 0, pending: 0 };
    s.total += 1;
    if (r.correct === true) s.correct += 1;
    if (r.correct === null) s.pending += 1;
    map.set(key, s);
  };
  for (const r of results) {
    if (r.objectives.length === 0) add("", { id: null, code: null, description: "Zonder leerdoel" }, r);
    for (const o of r.objectives) add(o.id, { id: o.id, code: o.code, description: o.description }, r);
  }
  return [...map.values()].sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return (a.code ?? a.description).localeCompare(b.code ?? b.description, "nl", { numeric: true });
  });
}
