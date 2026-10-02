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

export type CaseForAi = {
  title: string;
  vignette: string;
  question: string;
  correct_diagnosis: string;
  expert_reflection: unknown;
  teaching_points: string | null;
};

export type AttemptForAi = {
  working_diagnosis: string;
  reflection: { diagnosis: string; supporting: string; against: string; missing: string }[];
  final_ranking: string[];
};

export function caseHintPrompt(input: { case: CaseForAi; attempt: AttemptForAi; n: number }) {
  return {
    system: BASE_RULES,
    user: `Geef de student één hint bij deze casus. Je kent de uitwerking, maar je verklapt de diagnose NIET.
- Hint 1: wijs op een bevinding in het vignet die de student nog niet heeft gebruikt.
- Hint 2: stel een vraag die naar het juiste orgaansysteem of mechanisme leidt.
- Hint 3: noem een categorie aandoeningen om te overwegen, zonder de diagnose te noemen.
- Maximaal 40 woorden.
CASUS: ${JSON.stringify(input.case)}
INGEVULD DOOR STUDENT: ${JSON.stringify(input.attempt)}
HINTNUMMER: ${input.n}
Geef JSON: {"hint": "..."}`,
  };
}

export function caseFeedbackPrompt(input: { case: CaseForAi; attempt: AttemptForAi }) {
  return {
    system: BASE_RULES,
    user: `Vergelijk de redenering van de student met de expert-uitwerking.
- Was de werkdiagnose juist? Zo niet: welke bevinding had de doorslag moeten geven?
- Per diagnose in de reflectie: wat de student goed zag, wat hij miste.
- Welke alternatieven ontbraken?
- Eindig met de één of twee belangrijkste lessen, als zinnen die direct een flashcard kunnen worden.
- Maximaal 200 woorden.
CASUS EN UITWERKING: ${JSON.stringify(input.case)}
POGING STUDENT: ${JSON.stringify(input.attempt)}
Geef JSON: {"diagnosis_correct": true|false, "decisive_finding": "...", "per_diagnosis": [{"diagnosis","seen","missed"}], "missing_alternatives": [...], "lessons": ["...", "..."]}`,
  };
}

export function draftCasesPrompt(input: {
  topic: string;
  n: number;
  scripts: unknown[];
  objectives: { id: string; code: string | null; description: string }[];
}) {
  return {
    system: BASE_RULES,
    user: `Maak ${input.n} casusvignetten op toepassingsniveau voor het thema "${input.topic}".
- Elke casus heeft een duidelijke juiste diagnose uit de SCRIPTS en minstens één alternatief dat erop lijkt.
- Het vignet bevat leeftijd, geslacht, hulpvraag, anamnese en bevindingen. Noem de diagnose niet en geef geen weggevertjes in de titel.
- Neem ook bevindingen op die tegen een alternatief pleiten, zodat redeneren nodig is.
- Vul "expert_reflection" per diagnose: supporting, against, missing en rank (1 = juist).
- "teaching_points": de twee of drie lessen van de casus.
- Varieer de moeilijkheid (1 tot 3).
- "objectives": de ids van de leerdoelen die de casus afdekt.
SCRIPTS: ${JSON.stringify(input.scripts)}
LEERDOELEN: ${JSON.stringify(input.objectives)}
Geef JSON: {"cases": [...]}`,
  };
}
