import http from "node:http";
import { expect, test } from "@playwright/test";
import { admin, importExample, LOCAL, login, resetExample } from "./helpers";

// Fase 2 (AI): geplakte tekst levert concepten op die pas na goedkeuren in de herhaling
// komen; AI-feedback is pas beschikbaar na het tonen van het antwoord.
// Draait tegen een nagebootste Anthropic-API: start de app met
//   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run start
// en dan E2E_AI=1 npx playwright test tests/e2e/ai.spec.ts
test.skip(!LOCAL || process.env.E2E_AI !== "1", "Alleen met de nagebootste AI (E2E_AI=1) tegen de lokale Supabase.");

const requests: { system: string; user: string; model: string }[] = [];
let server: http.Server;

function reply(user: string): unknown {
  if (user.startsWith("Maak flashcards")) {
    const objectives = JSON.parse(user.match(/LEERDOELEN: (\[.*\])/)![1]) as { id: string; code: string }[];
    const v1 = objectives.find((o) => o.code === "V.1")!.id;
    return {
      cards: [
        { type: "fact", front: "Wat is het slagvolume?", back: "EDV min ESV.", explanation: "", objectives: [v1], source_locator: "p. 12" },
        { type: "explain", front: "Waarom stijgt het hartminuutvolume bij inspanning?", back: "Hogere frequentie en slagvolume.", explanation: "Sympathicus.", objectives: [v1], source_locator: "" },
        // Zonder leerdoel: moet worden overgeslagen.
        { type: "fact", front: "Losse kaart", back: "x", explanation: "", objectives: ["onbekend"], source_locator: "" },
      ],
    };
  }
  if (user.startsWith("Maak een illness script")) {
    const condition = user.match(/voor "([^"]+)"/)![1];
    const hf = condition === "Hartfalen";
    return {
      illness_script: {
        epidemiology: hf ? "Ouderen, hypertensie." : "Rokers.",
        pathophysiology: hf ? "Pompfunctie schiet tekort." : "Chronische ontsteking van de luchtwegen.",
        presentation: hf ? "Kortademig, enkeloedeem." : "Hoesten, piepen.",
        findings: hf ? "Crepitaties, NT-proBNP verhoogd." : "Verlengd expirium, spirometrie obstructief.",
        management: "",
        key_discriminators: hf ? "Oedeem, orthopneu." : "Piepen, geen oedeem.",
        similar_conditions: [hf ? "COPD" : "Hartfalen"],
      },
    };
  }
  if (user.startsWith("Maak één vergelijkingskaart")) {
    return { card: { front: "Hoe onderscheid je hartfalen van COPD?", back: "Hartfalen: oedeem, orthopneu. COPD: piepen, verlengd expirium.", explanation: "" } };
  }
  if (/^Maak \d+ casusvignetten/.test(user)) {
    const row = (diagnosis: string, rank: number) => ({ diagnosis, supporting: "past", against: "", missing: "", rank });
    return {
      cases: [
        { title: "Kortademige man", vignette: "Man, 75 jaar, enkeloedeem.", correct_diagnosis: "Hartfalen", expert_reflection: [row("Hartfalen", 1), row("COPD", 2)], teaching_points: "Let op oedeem.", difficulty: 2, objectives: [] },
        { title: "Hoestende vrouw", vignette: "Vrouw, 60 jaar, rookt.", correct_diagnosis: "COPD", expert_reflection: [row("COPD", 1), row("Hartfalen", 2)], teaching_points: "Rookanamnese.", difficulty: 1, objectives: [] },
        // Ongeldig (rank 1 is niet de juiste diagnose): moet worden overgeslagen.
        { title: "Fout", vignette: "x", correct_diagnosis: "Astma", expert_reflection: [row("COPD", 1), row("Astma", 2)], teaching_points: "", difficulty: 2, objectives: [] },
      ],
    };
  }
  if (user.startsWith("Geef de student één hint")) return { hint: "Kijk nog eens naar de enkels." };
  if (user.startsWith("Vergelijk de redenering")) {
    return {
      diagnosis_correct: false,
      decisive_finding: "Enkeloedeem",
      per_diagnosis: [{ diagnosis: "COPD", seen: "kortademigheid", missed: "oedeem" }],
      missing_alternatives: ["Hartfalen"],
      lessons: ["Enkeloedeem bij kortademigheid wijst op hartfalen."],
    };
  }
  if (/^Maak \d+ (pretest|exam)-vragen/.test(user)) {
    return {
      questions: [
        { format: "mcq", stem: "Welk symptoom past het best bij hartfalen?", options: ["Piepen", "Enkeloedeem", "Koorts", "Jeuk"], correct_option: 1, model_answer: "", explanation: "Vochtretentie.", objectives: [] },
        { format: "open", stem: "Noem twee bevindingen bij hartfalen.", options: [], correct_option: -1, model_answer: "Crepitaties en enkeloedeem.", explanation: "", objectives: [] },
        // Ongeldig (correct_option buiten bereik): overslaan.
        { format: "mcq", stem: "Fout", options: ["a", "b", "c", "d"], correct_option: 7, model_answer: "", explanation: "", objectives: [] },
      ],
    };
  }
  if (user.startsWith("Beoordeel het antwoord")) {
    return {
      correct: "Je noemt het Frank-Starling-mechanisme.",
      missing: "Dat rek van de vezels de kracht verhoogt.",
      misconception: null,
      follow_up: "Wat gebeurt er bij een overvuld hart?",
      suggested_rating: 2,
    };
  }
  throw new Error(`Onverwacht verzoek: ${user.slice(0, 60)}`);
}

test.beforeAll(async () => {
  await resetExample();
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = JSON.parse(body);
      const user = String(json.messages.at(-1).content);
      requests.push({ system: json.system, user, model: json.model });
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: json.model,
          content: [{ type: "text", text: JSON.stringify(reply(user)) }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      );
    });
  });
  await new Promise<void>((r) => server.listen(4010, "127.0.0.1", r));
});

test.afterAll(() => new Promise<void>((r) => server.close(() => r())));

test("draft_cards en explain_feedback", async ({ page }) => {
  const usage = async () => (await admin().from("ai_usage").select("id", { count: "exact", head: true })).count ?? 0;
  const usageBefore = await usage();
  await login(page);
  await importExample(page);

  // draft_cards vanaf de themapagina.
  await page.goto("/themas");
  await page.getByRole("link", { name: /Voorbeeld: hart en longen/ }).click();
  await page.getByText("Kaarten laten maken uit brontekst (AI)").click();
  await page.getByRole("textbox", { name: /^Brontekst/ }).fill("Het slagvolume is EDV min ESV. Bij inspanning stijgt ...");
  await page.getByRole("button", { name: "Maak conceptkaarten" }).click();
  await expect(page).toHaveURL(/\/goedkeuren\?thema=/);
  await expect(page.getByRole("textbox", { name: "Voorkant" })).toHaveCount(5); // 3 geïmporteerd + 2 AI
  await expect(page.getByText("AI-concept")).toHaveCount(2);

  const db = admin();
  const { data: aiCards } = await db.from("cards").select("status, origin, source_locator, card_objectives(objective_id)").eq("origin", "ai");
  expect(aiCards).toHaveLength(2);
  expect(aiCards!.every((c) => c.status === "draft" && c.card_objectives.length === 1)).toBe(true);
  expect(requests[0].system.startsWith("Je bent een studiecoach")).toBe(true);
  expect(requests[0].user).toContain("BRONTEKST");

  // Concepten staan nog niet in de herhaling.
  await page.goto("/vandaag");
  await expect(page.getByText("Niets te herhalen vandaag")).toBeVisible();

  // Alleen de uitlegkaart over Frank-Starling goedkeuren.
  await page.goto("/goedkeuren");
  const fronts = page.getByRole("textbox", { name: "Voorkant" });
  for (let i = 0; i < 5; i++) {
    if ((await fronts.nth(i).inputValue()).startsWith("Waarom neemt het slagvolume toe")) {
      await page.getByRole("button", { name: "Goedkeuren", exact: true }).nth(i).click();
      break;
    }
  }
  await expect(fronts).toHaveCount(4);

  // explain_feedback: de knop verschijnt pas na "Toon antwoord".
  await page.goto("/vandaag");
  await expect(page.getByText("1 kaart · ongeveer")).toBeVisible();
  await page.getByRole("textbox", { name: "Typ je antwoord (optioneel)" }).fill("Door het Frank-Starling-mechanisme.");
  await expect(page.getByRole("button", { name: "Feedback van AI" })).toHaveCount(0);
  await page.getByRole("button", { name: /Toon antwoord/ }).click();
  await page.getByRole("button", { name: "Feedback van AI" }).click();
  await expect(page.getByText("Je noemt het Frank-Starling-mechanisme.")).toBeVisible();
  await expect(page.getByText("Voorstel: Moeilijk. Je kiest zelf.")).toBeVisible();
  expect(requests.at(-1)!.model).toBe("claude-haiku-4-5"); // snel model voor feedback
  expect(requests.at(-1)!.user).toContain("Door het Frank-Starling-mechanisme.");

  // De student kiest zelf (hier Goed, niet het voorstel); feedback komt in het logboek.
  await page.getByRole("button", { name: /^Goed/ }).click();
  await expect.poll(async () => (await db.from("review_logs").select("rating, ai_feedback, answer_text")).data).toEqual([
    expect.objectContaining({ rating: 3, answer_text: "Door het Frank-Starling-mechanisme." }),
  ]);
  const { data: log } = await db.from("review_logs").select("ai_feedback").single();
  expect(JSON.parse(log!.ai_feedback!)).toMatchObject({ suggested_rating: 2 });
  // Elke AI-aanroep is gelogd (kosten zichtbaar).
  expect((await usage()) - usageBefore).toBe(2);
});

test("draft_script, draft_compare, draft_cases, case_hint, case_feedback, draft_questions", async ({ page }) => {
  await resetExample();
  await login(page);
  await importExample(page);
  const topic = "VOORBEELD - verwijderen na testen · Voorbeeld: hart en longen";

  // Twee scripts laten maken en goedkeuren.
  for (const condition of ["Hartfalen", "COPD"]) {
    await page.goto("/scripts/nieuw");
    const form = page.locator("form", { has: page.getByRole("button", { name: "Maak concept met AI" }) });
    await form.getByRole("combobox", { name: "Thema" }).selectOption({ label: topic });
    await form.getByRole("textbox", { name: "Aandoening" }).fill(condition);
    await form.getByRole("textbox", { name: /^Brontekst/ }).fill(`Tekst over ${condition}.`);
    await form.getByRole("button", { name: "Maak concept met AI" }).click();
    await expect(page.getByText("Dit is een AI-concept.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^Presentatie/ })).not.toHaveValue("");
    await expect(page.getByRole("textbox", { name: /^Beleid/ })).toHaveValue(""); // leeg in de bron = leeg
    await page.getByRole("button", { name: "Opslaan en goedkeuren" }).click();
    await expect(page.getByText("3 scriptkaart(en) staan als concept klaar")).toBeVisible();
  }

  // Vergelijkingskaart.
  await page.goto("/scripts");
  await page.getByRole("checkbox", { name: "Hartfalen vergelijken" }).check();
  await page.getByRole("checkbox", { name: "COPD vergelijken" }).check();
  await page.getByRole("button", { name: "Vergelijk geselecteerde" }).click();
  await page.getByRole("button", { name: "Maak vergelijkingskaart" }).click();
  await expect(page).toHaveURL(/\/goedkeuren/);
  const fronts = page.getByRole("textbox", { name: "Voorkant" });
  await expect(fronts).toHaveCount(3 + 6 + 1);

  // Casussen: twee geldige, de ongeldige wordt overgeslagen.
  await page.goto("/casussen");
  await page.getByText("Casussen laten maken door AI").click();
  await page.getByRole("combobox", { name: "Thema" }).selectOption({ label: topic });
  await page.getByRole("button", { name: "Maak conceptcasussen" }).click();
  await expect(page).toHaveURL(/\/goedkeuren/);
  const caseBoxes = page.getByRole("checkbox", { name: /goedkeuren$/ });
  await expect(caseBoxes).toHaveCount(2);
  for (const b of await caseBoxes.all()) await b.check();
  await page.getByRole("button", { name: "Geselecteerde casussen goedkeuren" }).click();
  await expect(caseBoxes).toHaveCount(0);

  // Casussessie met hint en AI-feedback.
  await page.goto("/casussen");
  await page.getByRole("button", { name: "Start sessie" }).click();
  await page.getByRole("textbox", { name: "Je werkdiagnose" }).fill("COPD");
  await page.getByRole("button", { name: /^Hint/ }).click();
  await expect(page.getByText("Hint 1: Kijk nog eens naar de enkels.")).toBeVisible();
  await page.getByRole("button", { name: "Volgende" }).click();
  await page.getByRole("button", { name: "Volgende" }).click();
  await page.getByRole("button", { name: "Toon mogelijke alternatieven" }).click();
  await page.locator("button.rounded-full", { hasText: "Hartfalen" }).click(); // COPD is al de werkdiagnose
  await page.getByRole("button", { name: "Volgende" }).click();
  await page.getByRole("button", { name: "Vergelijk met de expert" }).click();
  await page.getByRole("button", { name: "Feedback van AI op je redenering" }).click();
  await expect(page.getByText("Doorslaggevend: Enkeloedeem")).toBeVisible();
  await page.getByRole("button", { name: "Verder" }).click();
  await expect(page.getByRole("button", { name: "Nee", exact: true })).toHaveAttribute("aria-pressed", "true"); // voorgesteld door AI
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expect(page.getByRole("textbox", { name: "Antwoord (achterkant)" })).toHaveValue("Enkeloedeem bij kortademigheid wijst op hartfalen.");

  // Vragen laten maken: twee geldige.
  await page.goto("/oefentoets");
  await page.getByText("Vragen laten maken door AI").click();
  await page.getByRole("combobox", { name: "Thema" }).selectOption({ label: topic });
  await page.getByRole("button", { name: "Maak conceptvragen" }).click();
  await expect(page).toHaveURL(/\/goedkeuren/);
  await expect(page.getByRole("checkbox", { name: /^Vraag goedkeuren/ })).toHaveCount(2 + 2); // 2 uit import + 2 AI

  const db = admin();
  const { data: attempt } = await db.from("case_attempts").select("hints_used, cued, correct, ai_feedback").single();
  expect(attempt).toMatchObject({ hints_used: 1, cued: true, correct: false });
  expect(JSON.parse(attempt!.ai_feedback!)).toMatchObject({ decisive_finding: "Enkeloedeem" });
  const { data: q } = await db.from("questions").select("format, correct_option, status").eq("origin", "ai").order("format");
  expect(q).toEqual([
    { format: "mcq", correct_option: 1, status: "draft" },
    { format: "open", correct_option: null, status: "draft" },
  ]);
});
