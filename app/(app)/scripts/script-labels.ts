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
