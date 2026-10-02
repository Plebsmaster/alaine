export const SCRIPT_FIELDS = [
  { key: "epidemiology", label: "Epidemiologie", hint: "Wie krijgt het, risicofactoren" },
  { key: "pathophysiology", label: "Pathofysiologie", hint: "Wat gaat er mis" },
  { key: "presentation", label: "Presentatie", hint: "Klachten, symptomen, beloop" },
  { key: "findings", label: "Bevindingen", hint: "Lichamelijk onderzoek en aanvullende diagnostiek" },
  { key: "management", label: "Beleid", hint: "Behandeling en beleid" },
  { key: "key_discriminators", label: "Onderscheidende kenmerken", hint: "Wat het onderscheidt van gelijkende aandoeningen" },
] as const;

export type ScriptFieldKey = (typeof SCRIPT_FIELDS)[number]["key"];

export const SCRIPT_STATUS_LABELS: Record<string, string> = {
  active: "Goedgekeurd",
  draft: "Concept",
  archived: "Gearchiveerd",
};

/** Vergelijken (ontwerp 1p): onderscheidende kenmerken eerst, dan wat je bij de patiënt ziet. */
export const COMPARE_FIELDS: { key: ScriptFieldKey; label: string }[] = [
  { key: "key_discriminators", label: "Onderscheidend" },
  { key: "presentation", label: "Presentatie" },
  { key: "findings", label: "Bevindingen" },
  { key: "pathophysiology", label: "Pathofysiologie" },
  { key: "management", label: "Beleid" },
  { key: "epidemiology", label: "Epidemiologie" },
];
