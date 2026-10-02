export const CARD_TYPE_LABELS: Record<string, string> = {
  fact: "Feit",
  explain: "Uitleg",
  illness_script: "Illness script",
  compare: "Vergelijken",
  image: "Beeld",
  skill: "Vaardigheid",
  communication: "Communicatie",
  chain: "Keten",
};

/** A1: fouttypes. Analyse naast de beoordeling; FSRS krijgt altijd de eerlijke beoordeling. */
export const ERROR_TYPES = [
  { value: "knowledge_gap", label: "Wist ik niet" },
  { value: "reasoning_error", label: "Redenering fout" },
  { value: "slip", label: "Slordig of moe" },
] as const;
export type ErrorType = (typeof ERROR_TYPES)[number]["value"];

/** A7: verwijzing bij te controleren inhoud. */
export const VERIFY_TEXT = "Controleer in het Farmacotherapeutisch Kompas, de NHG-Standaard of de FMS-richtlijn.";
