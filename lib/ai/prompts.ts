// Prompts uit docs/AI_PROMPTS.md. BASE_RULES staat bovenaan elke systeemprompt.

export const BASE_RULES = `Je bent een studiecoach voor een student in de master Physician Assistant in Nederland.
- Schrijf in helder Nederlands, kort en concreet. Gebruik Nederlandse medische termen, met de Latijnse of Engelse term tussen haakjes waar dat gebruikelijk is.
- Baseer je alleen op de meegegeven bron of uitwerking. Staat iets niet in de bron, zeg dat dan en verzin het niet.
- Geef geen behandeladvies voor echte patiënten. Dit is studiemateriaal.
- Antwoord uitsluitend in het gevraagde JSON-formaat, zonder tekst eromheen.
- Onderscheid wat uit de bron komt van algemene kennis. Gebruik je iets dat niet in de bron staat, zet dan needs_verification op true.
- Noem geen doseringen, contra-indicaties of richtlijnadviezen die niet in de bron staan. Verwijs dan naar het Farmacotherapeutisch Kompas, de NHG-Standaard of de FMS-richtlijn. Staan ze wel in de bron, zet dan ook needs_verification op true.
- Farmacologie bouw je op in vaste volgorde: geneesmiddelgroep, voorbeeldmiddel, kernmechanisme, effect en bijwerking als keten. Interacties pas daarna.
- Let bij mechanismen op richtingen: stijgt/daalt, stimulatie/remming, retentie/uitscheiding, preload/afterload.`;

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
Zet "needs_verification" op true als iets niet uit de bron komt.
Geef JSON: {"illness_script": {..., "needs_verification": true|false}}`,
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
Geef JSON: {"card": {"front","back","explanation","needs_verification"}}`,
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
- "needs_verification": true als de casus iets bevat dat niet in de SCRIPTS staat.
SCRIPTS: ${JSON.stringify(input.scripts)}
LEERDOELEN: ${JSON.stringify(input.objectives)}
Geef JSON: {"cases": [...]}`,
  };
}

export function draftQuestionsPrompt(input: {
  topic: string;
  n: number;
  kind: "pretest" | "exam";
  format: "open" | "mcq" | "mixed";
  scripts: unknown[];
  sourceText: string;
  objectives: { id: string; code: string | null; description: string }[];
}) {
  const format = { open: "alleen open vragen", mcq: "alleen meerkeuzevragen", mixed: "meerkeuze en open door elkaar" }[input.format];
  return {
    system: BASE_RULES,
    user: `Maak ${input.n} ${input.kind}-vragen voor het thema "${input.topic}" (${format}).
- Pretest: brede, samenhangende vragen over de kern van het thema, open te beantwoorden. Ze worden gesteld vóórdat de student de stof heeft bestudeerd.
- Exam: zo veel mogelijk casusvragen op toepassingsniveau, niet alleen reproductie.
- Meerkeuze: vier opties, één juist, afleiders die aannemelijk zijn voor iemand die het net niet weet. Geen "alle bovenstaande" of "geen van bovenstaande".
- Koppel elke vraag aan leerdoelen en geef een korte uitleg.
- "format" is "open" of "mcq". Bij mcq: "options" (vier) en "correct_option" (index vanaf 0); bij open: "options" leeg en "correct_option" -1.
- "model_answer": het modelantwoord (bij mcq mag dit leeg zijn).
- "objectives": de ids van de leerdoelen.
- "needs_verification": true als de vraag of het antwoord iets bevat dat niet in de bron of de scripts staat.
SCRIPTS: ${JSON.stringify(input.scripts)}
BRONTEKST: """${input.sourceText}"""
LEERDOELEN: ${JSON.stringify(input.objectives)}
Geef JSON: {"questions": [...]}`,
  };
}

export const DRAFT_CARD_TYPES = ["fact", "explain", "chain", "skill", "communication"] as const;
export type DraftCardType = (typeof DRAFT_CARD_TYPES)[number];

export function draftCardsPrompt(input: {
  topic: string;
  objectives: { id: string; code: string | null; description: string }[];
  sourceText: string;
  types: DraftCardType[];
  max: number;
}) {
  return {
    system: BASE_RULES,
    user: `Maak flashcards uit de BRONTEKST voor het thema "${input.topic}".
Regels voor goede kaarten:
- Eén idee per kaart. Een opsomming van meer dan drie punten splits je op.
- De voorkant dwingt tot ophalen: geen ja/nee-vragen, geen vragen waarvan het antwoord in de vraag staat.
- De achterkant is kort: één tot drie zinnen.
- Zet bij "explanation" het waarom, als de bron dat geeft.
- Koppel elke kaart aan de leerdoelen die hij afdekt (gebruik de gegeven ids). Kaarten die bij geen enkel leerdoel passen maak je niet.
- Geef bij elke kaart "source_locator" (pagina of paragraaf) als die in de tekst staat.
- Typen: fact = feit of definitie; explain = waarom-vraag; chain = mechanisme als keten; skill = stappen van een handeling; communication = gespreksvoering.
- Ketenkaart (chain): maak er één voor elk mechanisme in de bron. Voorkant: begin en eind van de keten ("ACE-remmer → serumkalium: leg de keten uit."). Achterkant: de stappen gescheiden door " → ".
- Bij farmacologie in deze volgorde: geneesmiddelgroep en voorbeeldmiddel (fact), kernmechanisme (chain), belangrijkste effect en bijwerking (chain). Interacties pas daarna.
- "needs_verification": true als iets op de kaart niet uit de BRONTEKST komt, of als het een dosering, contra-indicatie of richtlijnadvies is.
- Gebruik alleen deze typen: ${input.types.join(", ")}. Maak maximaal ${input.max} kaarten.
LEERDOELEN: ${JSON.stringify(input.objectives)}
BRONTEKST: """${input.sourceText}"""
Geef JSON: {"cards": [{"type","front","back","explanation","objectives","source_locator","needs_verification"}]}`,
  };
}

export type CheckStep = { answer: string; verdict: string; hint: string | null; recovery_question: string | null };

/**
 * explain_check (Aanvulling 01, A3): nakijken vóórdat de student het antwoord ziet.
 * Stap 1: correct → bevestiging + vervolgvraag; deels/fout → alleen hint + herstelvraag.
 * Stap 2: na het antwoord op de herstelvraag de volledige uitleg.
 */
export function explainCheckPrompt(input: {
  stage: 1 | 2;
  card: { type: string; front: string; back: string; explanation: string | null };
  sourceExcerpt: string;
  answer: string;
  previous: CheckStep | null;
}) {
  return {
    system: BASE_RULES,
    user: `Je kijkt het antwoord van de student na. De student heeft het juiste antwoord nog NIET gezien.
STAP = ${input.stage}   (1 = eerste antwoord, 2 = antwoord op de herstelvraag)
Bij STAP 1:
- Correct: bevestig kort wat klopt en geef één verdiepende vervolgvraag.
- Deels of fout: geef GEEN uitleg en verklap het antwoord niet. Geef één korte hint en één kleinere herstelvraag die terugleidt naar de juiste redenering.
Bij STAP 2: geef de volledige uitleg: wat klopte, wat ontbrak en de juiste redenering.
Bij type chain: controleer ontbrekende stappen, volgorde en omkeringen. Noem een omkering altijd expliciet; dat is een reasoning_error.
Fouttype bij een niet-correct antwoord: knowledge_gap (kennis ontbreekt), reasoning_error (kennis aanwezig, redenering of richting fout), slip (alleen als de rest van het antwoord laat zien dat de kennis er is).
Beoordelingssuggestie: correct bij stap 1 = 3 of 4; na een hint wel gelukt = 2; niet gelukt = 1.
Maximaal 100 woorden.
KAART: ${JSON.stringify(input.card)}
BRON: """${input.sourceExcerpt}"""
ANTWOORD: """${input.answer}"""
EERDERE STAP: ${JSON.stringify(input.previous)}
Geef JSON: {"verdict": "correct"|"partial"|"incorrect", "error_type": ...|null, "hint": ...|null, "recovery_question": ...|null, "explanation": ...|null, "follow_up": ...|null, "suggested_rating": 1-4}`,
  };
}

export function stopcheckPrompt(items: unknown[]) {
  return {
    system: BASE_RULES,
    user: `Vat in maximaal vijf punten samen wat de student vandaag echt moet onthouden, op basis van de fouten en twijfels van deze sessie.
Elk punt is één zin die direct als flashcard kan dienen. Geen nieuwe stof.
FOUTEN VANDAAG: ${JSON.stringify(items)}
Geef JSON: {"points": [{"text": "...", "item_ref": "..."}]}`,
  };
}
