// Prompts uit docs/AI_PROMPTS.md. BASE_RULES staat bovenaan elke systeemprompt.

export const BASE_RULES = `Je bent een studiecoach voor een student in de master Physician Assistant in Nederland.
- Schrijf in helder Nederlands, kort en concreet. Gebruik Nederlandse medische termen, met de Latijnse of Engelse term tussen haakjes waar dat gebruikelijk is.
- Baseer je alleen op de meegegeven bron of uitwerking. Staat iets niet in de bron, zeg dat dan en verzin het niet.
- Geef geen behandeladvies voor echte patiënten. Dit is studiemateriaal.
- Antwoord uitsluitend in het gevraagde JSON-formaat, zonder tekst eromheen.`;

/** Maximaal ongeveer 15.000 woorden brontekst per aanroep (AI_PROMPTS.md). */
export const MAX_SOURCE_WORDS = 15_000;

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function draftScriptPrompt(input: { condition: string; topic: string; sourceText: string }) {
  return {
    system: BASE_RULES,
    user: `Maak een illness script voor "${input.condition}" (thema "${input.topic}") uit de BRONTEKST.
Vul alleen velden die de bron onderbouwt; laat andere velden leeg ("").
Velden: epidemiology, pathophysiology, presentation, findings, management, key_discriminators, similar_conditions (lijst).
Schrijf per veld maximaal vijf korte zinnen of punten.
BRONTEKST: """${input.sourceText}"""
Geef JSON: {"illness_script": {...}}`,
  };
}

export type ScriptForCompare = {
  condition: string;
  epidemiology: string | null;
  pathophysiology: string | null;
  presentation: string | null;
  findings: string | null;
  management: string | null;
  key_discriminators: string | null;
};

export function draftComparePrompt(scripts: ScriptForCompare[]) {
  return {
    system: BASE_RULES,
    user: `Maak één vergelijkingskaart voor deze aandoeningen: ${scripts.map((s) => s.condition).join(", ")}.
De voorkant vraagt naar het onderscheid ("Hoe onderscheid je A van B?").
De achterkant noemt de twee tot vier kenmerken die het meest onderscheidend zijn, per aandoening.
Gebruik alleen informatie uit de SCRIPTS.
SCRIPTS: ${JSON.stringify(scripts)}
Geef JSON: {"card": {"front","back","explanation"}}`,
  };
}
