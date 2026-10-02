import { describe, expect, it, vi } from "vitest";
import { AiError, modelFor, runJson, type ParseClient } from "@/lib/ai/client";
import { BASE_RULES, draftComparePrompt, draftScriptPrompt, wordCount } from "@/lib/ai/prompts";
import { caseFeedbackOutput, caseHintOutput, draftCasesOutput, draftCompareOutput, draftScriptOutput } from "@/lib/ai/schemas";
import { caseHintPrompt } from "@/lib/ai/prompts";

type Reply = { parsed: unknown; stop_reason?: string };

/** Nagebootste API: geeft de antwoorden in volgorde terug en onthoudt de verzoeken. */
function fakeApi(replies: Reply[]) {
  const calls: Parameters<ParseClient["parse"]>[0][] = [];
  const api = {
    parse: vi.fn(async (body: Parameters<ParseClient["parse"]>[0]) => {
      calls.push({ ...body, messages: [...body.messages] });
      const r = replies.shift()!;
      return {
        stop_reason: r.stop_reason ?? "end_turn",
        usage: { input_tokens: 100, output_tokens: 50 },
        content: [{ type: "text", text: JSON.stringify(r.parsed) }],
        parsed_output: r.parsed,
      };
    }),
  } as unknown as ParseClient;
  return { api, calls };
}

const goodScript = {
  illness_script: {
    epidemiology: "Vooral ouderen.",
    pathophysiology: "Chaotische elektrische activiteit in de boezems.",
    presentation: "Hartkloppingen, irregulaire pols.",
    findings: "ECG: geen P-toppen, irregulaire RR-intervallen.",
    management: "",
    key_discriminators: "Volledig irregulair.",
    similar_conditions: ["Boezemflutter"],
    needs_verification: false,
  },
};

describe("prompts", () => {
  it("zet BASE_RULES bovenaan en neemt de brontekst mee", () => {
    const p = draftScriptPrompt({ condition: "Boezemfibrilleren", topic: "Ritmestoornissen", sourceText: "BRON-123" });
    expect(p.system.startsWith(BASE_RULES)).toBe(true);
    expect(p.user).toContain('"Boezemfibrilleren"');
    expect(p.user).toContain("BRON-123");
  });

  it("draft_compare noemt alle aandoeningen en geeft de scripts mee", () => {
    const s = { condition: "A", epidemiology: null, pathophysiology: null, presentation: "x", findings: null, management: null, key_discriminators: "y" };
    const p = draftComparePrompt([s, { ...s, condition: "B" }]);
    expect(p.user).toContain("A, B");
    expect(p.user).toContain('"key_discriminators":"y"');
  });

  it("telt woorden", () => {
    expect(wordCount("  een twee\n drie ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
});

describe("runJson", () => {
  it("geeft gevalideerde uitvoer terug en gebruikt het model uit de omgeving", async () => {
    const { api, calls } = fakeApi([{ parsed: goodScript }]);
    const out = await runJson({ fn: "draft_script", system: "s", user: "u", schema: draftScriptOutput, api });
    expect(out.illness_script.findings).toContain("ECG");
    expect(calls[0].model).toBe(modelFor("draft_script"));
    expect(calls[0].output_config?.format).toBeDefined();
  });

  it("doet één nieuwe poging met de validatiefout erbij", async () => {
    const { api, calls } = fakeApi([
      { parsed: { card: { front: "", back: "x", explanation: "", needs_verification: false } } },
      { parsed: { card: { front: "Hoe onderscheid je A van B?", back: "…", explanation: "", needs_verification: false } } },
    ]);
    const out = await runJson({ fn: "draft_compare", system: "s", user: "u", schema: draftCompareOutput, api });
    expect(out.card.front).toBe("Hoe onderscheid je A van B?");
    expect(calls).toHaveLength(2);
    const retry = calls[1].messages.at(-1);
    expect(retry?.role).toBe("user");
    expect(String(retry?.content)).toContain("card.front");
  });

  it("geeft na twee ongeldige antwoorden een nette fout", async () => {
    const { api } = fakeApi([{ parsed: null }, { parsed: { iets: "anders" } }]);
    await expect(runJson({ fn: "draft_compare", system: "s", user: "u", schema: draftCompareOutput, api })).rejects.toBeInstanceOf(AiError);
  });

  it("vangt een weigering netjes af", async () => {
    const { api } = fakeApi([{ parsed: null, stop_reason: "refusal" }]);
    await expect(runJson({ fn: "draft_script", system: "s", user: "u", schema: draftScriptOutput, api })).rejects.toThrow(
      /wilde deze tekst niet verwerken/,
    );
  });

  it("kiest het snelle model voor hints en feedback", () => {
    expect(modelFor("case_hint")).toBe(modelFor("explain_check"));
    expect(modelFor("case_hint")).not.toBe(modelFor("draft_cards"));
  });
});

describe("casus-AI", () => {
  it("hintprompt verbiedt de diagnose te verklappen en noemt het hintnummer", () => {
    const p = caseHintPrompt({
      case: { title: "t", vignette: "v", question: "q", correct_diagnosis: "Hartfalen", expert_reflection: [], teaching_points: null },
      attempt: { working_diagnosis: "COPD", reflection: [], final_ranking: [] },
      n: 2,
    });
    expect(p.user).toContain("verklapt de diagnose NIET");
    expect(p.user).toContain("HINTNUMMER: 2");
  });

  it("schema's voor hint, feedback en casussen werken met structured output", async () => {
    const feedback = {
      diagnosis_correct: false,
      decisive_finding: "Enkeloedeem",
      per_diagnosis: [{ diagnosis: "COPD", seen: "roken", missed: "oedeem" }],
      missing_alternatives: ["Hartfalen"],
      lessons: ["Enkeloedeem bij kortademigheid wijst op hartfalen."],
    };
    const cases = {
      cases: [
        {
          title: "Kortademig",
          vignette: "Man, 72 jaar…",
          correct_diagnosis: "Hartfalen",
          expert_reflection: [
            { diagnosis: "Hartfalen", supporting: "oedeem", against: "", missing: "", rank: 1 },
            { diagnosis: "COPD", supporting: "", against: "geen piepen", missing: "", rank: 2 },
          ],
          teaching_points: "…",
          difficulty: 2,
          objectives: [],
          needs_verification: false,
        },
      ],
    };
    const { api } = fakeApi([{ parsed: { hint: "Kijk naar de enkels." } }, { parsed: feedback }, { parsed: cases }]);
    expect((await runJson({ fn: "case_hint", system: "s", user: "u", schema: caseHintOutput, api })).hint).toBe("Kijk naar de enkels.");
    expect((await runJson({ fn: "case_feedback", system: "s", user: "u", schema: caseFeedbackOutput, api })).lessons).toHaveLength(1);
    expect((await runJson({ fn: "draft_cases", system: "s", user: "u", schema: draftCasesOutput, api })).cases).toHaveLength(1);
  });
});

import { BASE_RULES as RULES, explainCheckPrompt } from "@/lib/ai/prompts";
import { explainCheckOutput, stopcheckOutput } from "@/lib/ai/schemas";

describe("Aanvulling 01", () => {
  it("BASE_RULES bevat de regels over bron, doseringen, farmacologie en richtingen", () => {
    expect(RULES).toContain("needs_verification op true");
    expect(RULES).toContain("Farmacotherapeutisch Kompas");
    expect(RULES).toContain("geneesmiddelgroep, voorbeeldmiddel, kernmechanisme");
    expect(RULES).toContain("retentie/uitscheiding");
  });

  it("explain_check geeft stap, kaarttype en eerdere stap mee", () => {
    const p = explainCheckPrompt({
      stage: 2,
      card: { type: "chain", front: "ACE-remmer → kalium?", back: "a → b", explanation: null },
      sourceExcerpt: "",
      answer: "b → a",
      previous: { answer: "x", verdict: "incorrect", hint: "h", recovery_question: "q" },
    });
    expect(p.user).toContain("STAP = 2");
    expect(p.user).toContain('"type":"chain"');
    expect(p.user).toContain('"recovery_question":"q"');
    expect(p.user).toContain("De student heeft het juiste antwoord nog NIET gezien.");
  });

  it("schema's voor explain_check en stopcheck", async () => {
    const check = { verdict: "incorrect", error_type: "reasoning_error", hint: "Kijk naar de richting.", recovery_question: "Stijgt of daalt kalium?", explanation: null, follow_up: null, suggested_rating: 1 };
    const { api } = fakeApi([{ parsed: check }, { parsed: { points: [{ text: "ACE-remming verhoogt kalium.", item_ref: "x" }] } }]);
    expect((await runJson({ fn: "explain_check", system: "s", user: "u", schema: explainCheckOutput, api })).error_type).toBe("reasoning_error");
    expect((await runJson({ fn: "stopcheck", system: "s", user: "u", schema: stopcheckOutput, api })).points).toHaveLength(1);
  });
});

import { draftCardsPrompt } from "@/lib/ai/prompts";
import { draftCardsOutput } from "@/lib/ai/schemas";

describe("draft_cards: brondeel (ontwerp 1n)", () => {
  it("vraagt om een letterlijk citaat en eist het veld in de uitvoer", () => {
    const p = draftCardsPrompt({ topic: "T", objectives: [], sourceText: "BRON", types: ["fact"], max: 5 });
    expect(p.user).toContain('"source_excerpt": een letterlijk citaat');
    expect(p.user).toContain('"source_excerpt"');
    const card = { type: "fact", front: "V?", back: "A.", explanation: "", objectives: [], source_locator: "", needs_verification: false };
    expect(draftCardsOutput.safeParse({ cards: [card] }).success).toBe(false);
    expect(draftCardsOutput.safeParse({ cards: [{ ...card, source_excerpt: "" }] }).success).toBe(true);
  });
});

describe("BASE_RULES", () => {
  it("vraagt naar de kennis, niet naar de bron (geen RC-nummer of college in de vraag)", () => {
    expect(BASE_RULES).toContain("niet naar de bron");
    expect(BASE_RULES).toContain("source_locator");
  });
});
