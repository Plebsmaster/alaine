import { describe, expect, it, vi } from "vitest";
import { AiError, modelFor, runJson, type ParseClient } from "@/lib/ai/client";
import { BASE_RULES, draftComparePrompt, draftScriptPrompt, wordCount } from "@/lib/ai/prompts";
import { draftCompareOutput, draftScriptOutput } from "@/lib/ai/schemas";

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
      { parsed: { card: { front: "", back: "x", explanation: "" } } },
      { parsed: { card: { front: "Hoe onderscheid je A van B?", back: "…", explanation: "" } } },
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
    expect(modelFor("case_hint")).toBe(modelFor("explain_feedback"));
    expect(modelFor("case_hint")).not.toBe(modelFor("draft_cards"));
  });
});
