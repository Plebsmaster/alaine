import http from "node:http";
import { expect, test } from "@playwright/test";
import { admin, approveDraft, cardsLeft, draftsOpen, importExample, LOCAL, login, resetExample } from "./helpers";

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
        { type: "fact", front: "Wat is het slagvolume?", back: "EDV min ESV.", explanation: "", objectives: [v1], source_locator: "p. 12", source_excerpt: "Het slagvolume is EDV min ESV.", needs_verification: false },
        // Ketenkaart met een dosering: altijd te controleren.
        { type: "chain", front: "ACE-remmer → serumkalium: leg de keten uit.", back: "ACE-remming → minder angiotensine II → minder aldosteron → minder K⁺-uitscheiding → hoger serum-K⁺", explanation: "Start met 2,5 mg.", objectives: [v1], source_locator: "", source_excerpt: "ACE-remmers verhogen het serumkalium.", needs_verification: true },
        // Zonder leerdoel: moet worden overgeslagen.
        { type: "fact", front: "Losse kaart", back: "x", explanation: "", objectives: ["onbekend"], source_locator: "", source_excerpt: "", needs_verification: false },
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
        needs_verification: false,
      },
    };
  }
  if (user.startsWith("Maak één vergelijkingskaart")) {
    return { card: { front: "Hoe onderscheid je hartfalen van COPD?", back: "Hartfalen: oedeem, orthopneu. COPD: piepen, verlengd expirium.", explanation: "", needs_verification: false } };
  }
  if (/^Maak \d+ casusvignetten/.test(user)) {
    const row = (diagnosis: string, rank: number) => ({ diagnosis, supporting: "past", against: "", missing: "", rank });
    return {
      cases: [
        { title: "Kortademige man", vignette: "Man, 75 jaar, enkeloedeem.", correct_diagnosis: "Hartfalen", expert_reflection: [row("Hartfalen", 1), row("COPD", 2)], teaching_points: "Let op oedeem.", difficulty: 2, objectives: [], needs_verification: false },
        { title: "Hoestende vrouw", vignette: "Vrouw, 60 jaar, rookt.", correct_diagnosis: "COPD", expert_reflection: [row("COPD", 1), row("Hartfalen", 2)], teaching_points: "Rookanamnese.", difficulty: 1, objectives: [], needs_verification: false },
        // Ongeldig (rank 1 is niet de juiste diagnose): moet worden overgeslagen.
        { title: "Fout", vignette: "x", correct_diagnosis: "Astma", expert_reflection: [row("COPD", 1), row("Astma", 2)], teaching_points: "", difficulty: 2, objectives: [], needs_verification: false },
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
        { format: "mcq", stem: "Welk symptoom past het best bij hartfalen?", options: ["Piepen", "Enkeloedeem", "Koorts", "Jeuk"], correct_option: 1, model_answer: "", explanation: "Vochtretentie.", objectives: [], needs_verification: false },
        { format: "open", stem: "Noem twee bevindingen bij hartfalen.", options: [], correct_option: -1, model_answer: "Crepitaties en enkeloedeem.", explanation: "", objectives: [], needs_verification: false },
        // Ongeldig (correct_option buiten bereik): overslaan.
        { format: "mcq", stem: "Fout", options: ["a", "b", "c", "d"], correct_option: 7, model_answer: "", explanation: "", objectives: [], needs_verification: false },
      ],
    };
  }
  if (user.startsWith("Je kijkt het antwoord van de student na")) {
    const stage = Number(user.match(/STAP = (\d)/)![1]);
    const chain = user.includes('"type":"chain"');
    if (stage === 1 && chain) {
      return { verdict: "incorrect", error_type: "reasoning_error", hint: "Kijk naar de richting van kalium.", recovery_question: "Stijgt of daalt het serumkalium als aldosteron daalt?", explanation: "ZOU-NIET-ZICHTBAAR-MOGEN-ZIJN", follow_up: null, suggested_rating: 1 };
    }
    if (stage === 1) {
      return { verdict: "correct", error_type: null, hint: null, recovery_question: null, explanation: "Klopt: Frank-Starling.", follow_up: "Wat gebeurt er bij een overvuld hart?", suggested_rating: 3 };
    }
    return { verdict: "correct", error_type: null, hint: null, recovery_question: null, explanation: "Minder aldosteron betekent minder kaliumuitscheiding: kalium stijgt. Je had de richting omgedraaid.", follow_up: null, suggested_rating: 2 };
  }
  if (user.startsWith("Vat in maximaal vijf punten samen")) {
    const items = JSON.parse(user.match(/FOUTEN VANDAAG: (\[.*\])/)![1]) as { item_ref: string }[];
    return { points: [{ text: "ACE-remming verhoogt het serumkalium via minder aldosteron.", item_ref: items[0].item_ref }] };
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

test("draft_cards, controleren, nakijken met hint, ketenkaart, fouttype en stopcheck", async ({ page }) => {
  const usage = async () => (await admin().from("ai_usage").select("id", { count: "exact", head: true })).count ?? 0;
  const usageBefore = await usage();
  await login(page);
  await importExample(page);

  // draft_cards vanaf de themapagina.
  await page.goto("/themas");
  await page.getByRole("link", { name: /Voorbeeld: hart en longen/ }).click();
  await page.getByRole("link", { name: /^Kaarten \d+/ }).click();
  await page.getByRole("link", { name: "Kaarten maken uit brontekst (AI)" }).click();
  await page.getByRole("textbox", { name: /^Brontekst/ }).fill("Het slagvolume is EDV min ESV. ACE-remmers ...");
  await page.getByRole("button", { name: "Maak conceptkaarten" }).click();
  await expect(page).toHaveURL(/\/goedkeuren\?thema=/);
  await expect.poll(() => draftsOpen(page)).toBe(5); // 3 geïmporteerd + 2 AI (kaart zonder leerdoel overgeslagen)
  expect(requests[0].system).toContain("Farmacotherapeutisch Kompas");
  const front = page.getByRole("textbox", { name: "Voorkant" });
  const list = page.getByRole("navigation", { name: "Concepten" });

  // Brondeel (1n): een letterlijk citaat staat naast het concept; een verzonnen citaat wordt
  // niet bewaard en de kaart moet gecontroleerd worden.
  await list.getByRole("button", { name: /^Wat is het slagvolume\?/ }).click();
  await expect(front).toHaveValue("Wat is het slagvolume?");
  await expect(page.getByText("Het slagvolume is EDV min ESV.", { exact: true })).toBeVisible();
  const { data: aiCards } = await admin()
    .from("cards")
    .select("front, source_excerpt, needs_verification")
    .in("front", ["Wat is het slagvolume?", "ACE-remmer → serumkalium: leg de keten uit."])
    .order("front");
  expect(aiCards).toEqual([
    { front: "ACE-remmer → serumkalium: leg de keten uit.", source_excerpt: null, needs_verification: true },
    { front: "Wat is het slagvolume?", source_excerpt: "Het slagvolume is EDV min ESV.", needs_verification: false },
  ]);

  // A7: de ketenkaart met dosering is te controleren en filterbaar.
  await page.getByRole("link", { name: "1 te controleren" }).click();
  await expect(page).toHaveURL(/controleren=1/);
  await expect.poll(() => draftsOpen(page)).toBe(1);
  await expect(front).toHaveValue("ACE-remmer → serumkalium: leg de keten uit.");
  await expect(page.getByText("Controleren", { exact: true })).toBeVisible();
  await expect(page.getByText("Brontekst niet bewaard bij dit concept.")).toBeVisible();
  await approveDraft(page); // zonder "gecontroleerd"

  // Ook de uitlegkaart over Frank-Starling goedkeuren.
  await page.goto("/goedkeuren");
  await expect.poll(() => draftsOpen(page)).toBe(4);
  await list.getByRole("button", { name: /^Waarom neemt het slagvolume toe/ }).click();
  await approveDraft(page);

  // Herhalen: beide kaarten, in willekeurige volgorde.
  await page.goto("/vandaag");
  await expect.poll(() => cardsLeft(page)).toBe(2);
  const done = { chain: false, explain: false };
  for (let round = 0; round < 6 && !(await page.getByText(/Sessie klaar/).isVisible()); round++) {
    const front = (await page.locator("main p.prose-card").first().textContent()) ?? "";
    if (front.startsWith("ACE-remmer") && !done.chain) {
      await expect(page.getByText("Controleren", { exact: true })).toBeVisible(); // A7 bij herhalen
      // A2: keten typen met de pijlknop; verkeerde richting.
      const box = page.getByRole("textbox", { name: "Typ de keten (optioneel)" });
      await box.fill("ACE-remming");
      await page.getByRole("button", { name: "Pijl invoegen" }).click();
      await box.pressSequentially("minder aldosteron → lager serum-K⁺");
      await expect(box).toHaveValue("ACE-remming → minder aldosteron → lager serum-K⁺");
      // A3: nakijken; bij fout eerst hint en herstelvraag, het antwoord blijft verborgen.
      await page.getByRole("button", { name: "Nakijken" }).click();
      await expect(page.getByText("Kijk naar de richting van kalium.")).toBeVisible();
      await expect(page.getByText("hoger serum-K⁺")).toHaveCount(0);
      await expect(page.getByText("ZOU-NIET-ZICHTBAAR-MOGEN-ZIJN")).toHaveCount(0);
      await page.getByRole("textbox", { name: "Stijgt of daalt het serumkalium als aldosteron daalt?" }).fill("Stijgt");
      await page.getByRole("button", { name: "Nakijken" }).click();
      await expect(page.getByText("Je had de richting omgedraaid.")).toBeVisible();
      // Keten naast elkaar.
      await expect(page.getByRole("columnheader", { name: "Jouw keten" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "lager serum-K⁺" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "hoger serum-K⁺" })).toBeVisible();
      // Suggestie Moeilijk; de student kiest Opnieuw. Daarna het fouttype, met de AI-suggestie voorgeselecteerd.
      await page.getByRole("button", { name: /^Opnieuw/ }).click();
      await expect(page.getByRole("button", { name: /^Redenering fout/ })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: /^Redenering fout/ }).click();
      done.chain = true;
    } else if (front.startsWith("Waarom neemt het slagvolume toe") && !done.explain) {
      await page.getByRole("textbox", { name: "Typ je antwoord (optioneel)" }).fill("Door het Frank-Starling-mechanisme.");
      await page.getByRole("button", { name: "Nakijken" }).click();
      await expect(page.getByText("Goed. Klopt: Frank-Starling.")).toBeVisible(); // correct: direct tonen
      await expect(page.getByText("Denk verder: Wat gebeurt er bij een overvuld hart?")).toBeVisible();
      await page.getByRole("button", { name: /^Goed/ }).click();
      done.explain = true;
    } else {
      // Terugkerende learning-kaart.
      await page.getByRole("button", { name: /Toon antwoord/ }).click();
      await page.getByRole("button", { name: /^Makkelijk/ }).click();
    }
  }
  await expect(page.getByText(/Sessie klaar/)).toBeVisible();
  expect(done).toEqual({ chain: true, explain: true });

  // Stopcheck: punt → eigen vraag → conceptkaart.
  await page.getByRole("button", { name: "Wat moet ik onthouden?" }).click();
  await expect(page.getByText("ACE-remming verhoogt het serumkalium via minder aldosteron.")).toBeVisible();
  await page.getByRole("button", { name: "Maak kaart" }).click();
  await page.getByRole("textbox", { name: /^Vraag \(voorkant\)/ }).fill("Wat doet een ACE-remmer met het serumkalium?");
  await page.getByRole("button", { name: "Opslaan als concept" }).click();
  await expect(page.getByText("Conceptkaart gemaakt; staat op Goedkeuren.")).toBeVisible();

  const db = admin();
  const { data: chainCard } = await db.from("cards").select("id").eq("type", "chain").single();
  const { data: chainLogs } = await expect
    .poll(async () => (await db.from("review_logs").select("rating, error_type").eq("card_id", chainCard!.id).order("review")).data?.length ?? 0)
    .toBeGreaterThan(0)
    .then(async () => db.from("review_logs").select("rating, error_type, ai_feedback").eq("card_id", chainCard!.id).order("review"));
  expect(chainLogs![0]).toMatchObject({ rating: 1, error_type: "reasoning_error" });
  expect(JSON.parse(chainLogs![0].ai_feedback!)).toHaveLength(2); // stap 1 + stap 2
  const { data: stop } = await db.from("cards").select("status, back").contains("tags", ["stopcheck"]).single();
  expect(stop).toEqual({ status: "draft", back: "ACE-remming verhoogt het serumkalium via minder aldosteron." });
  // 1× draft_cards, 3× explain_check, 1× stopcheck
  expect((await usage()) - usageBefore).toBe(5);
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
  await expect.poll(() => draftsOpen(page)).toBe(3 + 6 + 1);

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
