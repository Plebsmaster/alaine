// Casusselectie en -validatie. Puur: geen database. Zie SPEC 5.6.

export const MIN_DAYS_BETWEEN = 7;
export const SESSION_MIN = 3;
export const SESSION_MAX = 5;
export const MAX_HINTS = 3;

export type CaseCandidate = {
  id: string;
  topic_id: string;
  /** Moment van de laatste poging, of null als de casus nooit is geoefend. */
  last_attempt_at: string | null;
  /** Zelfscore (1–5) van de laatste poging, of null. */
  last_score: number | null;
};

/**
 * Kies `n` casussen: eerst nooit geoefende, dan de laagste laatste score, dan het
 * langst geleden geoefend. Niets wat korter dan 7 dagen geleden is gedaan.
 * Gemengd over thema's: eerst één per thema, daarna aanvullen.
 * `random` breekt gelijke standen (voor variatie); in tests deterministisch.
 */
export function selectCases(
  candidates: CaseCandidate[],
  n: number,
  now: Date,
  random: () => number = Math.random,
): CaseCandidate[] {
  const cutoff = now.getTime() - MIN_DAYS_BETWEEN * 86_400_000;
  const eligible = candidates
    .filter((c) => !c.last_attempt_at || new Date(c.last_attempt_at).getTime() <= cutoff)
    .map((c) => ({ c, tie: random() }));

  const rank = (c: CaseCandidate) => (c.last_attempt_at ? 1 : 0);
  eligible.sort(
    (a, b) =>
      rank(a.c) - rank(b.c) ||
      (a.c.last_score ?? 0) - (b.c.last_score ?? 0) ||
      (a.c.last_attempt_at ?? "").localeCompare(b.c.last_attempt_at ?? "") ||
      a.tie - b.tie,
  );

  const picked: CaseCandidate[] = [];
  const topics = new Set<string>();
  for (const { c } of eligible) {
    if (picked.length >= n) break;
    if (!topics.has(c.topic_id)) {
      picked.push(c);
      topics.add(c.topic_id);
    }
  }
  for (const { c } of eligible) {
    if (picked.length >= n) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}

export type Reflection = { diagnosis: string; supporting: string; against: string; missing: string };
export type ExpertReflection = Reflection & { rank: number };

/** Controleert een expert-uitwerking zoals de importer: ≥2 diagnoses, één rank 1, gelijk aan de juiste diagnose. */
export function checkExpertReflection(correct: string, rows: ExpertReflection[]): string | null {
  if (rows.length < 2) return "Geef minstens twee diagnoses: de juiste en een gelijkend alternatief.";
  const first = rows.filter((r) => r.rank === 1);
  if (first.length !== 1) return "Precies één diagnose moet op plek 1 staan.";
  if (first[0].diagnosis.trim().toLowerCase() !== correct.trim().toLowerCase()) {
    return "De diagnose op plek 1 moet de juiste diagnose zijn.";
  }
  return null;
}

function normalizeDiagnosis(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Komt het eindantwoord overeen met de juiste diagnose? Ruim: hoofdletters, accenten en
 * leestekens tellen niet, en een preciezere of kortere schrijfwijze ook niet
 * ("Psoriasis" en "Psoriasis vulgaris"). Alleen voor de weergave; de student scoort zelf.
 */
export function sameDiagnosis(answer: string, correct: string): boolean {
  const a = normalizeDiagnosis(answer);
  const b = normalizeDiagnosis(correct);
  if (!a || !b) return false;
  return a === b || ` ${b} `.includes(` ${a} `) || ` ${a} `.includes(` ${b} `);
}

/** Verplaats één element (rangschikken met slepen of ↑/↓). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, x);
  return out;
}
