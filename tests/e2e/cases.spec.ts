import { expect, test } from "@playwright/test";
import { admin, importExample, LOCAL, login, resetExample } from "./helpers";

// Fase 4: een sessie van 3 casussen uit verschillende thema's is af te ronden; de
// expert-uitwerking is pas zichtbaar na stap 4; "Maak kaart van wat ik miste" werkt.
test.skip(!LOCAL, "De rooktest wist testdata en draait alleen tegen de lokale Supabase (supabase start).");

test.beforeAll(resetExample);

test("casussessie van drie casussen uit drie thema's", async ({ page }) => {
  await login(page);
  await importExample(page, "tests/e2e/fixtures/casussen-import.json");

  // Conceptcasussen in één keer goedkeuren.
  await page.goto("/goedkeuren?soort=casussen");
  for (const title of ["Kortademige man van 72", "Hoestende vrouw van 58", "Schilferende plekken"]) {
    await page.getByRole("checkbox", { name: `${title} goedkeuren` }).check();
  }
  await page.getByRole("button", { name: "Geselecteerde casussen goedkeuren" }).click();
  await expect(page.getByRole("checkbox", { name: /goedkeuren$/ })).toHaveCount(0);

  await page.goto("/casussen");
  await expect(page.getByText("3 van 3 casussen klaar om te oefenen")).toBeVisible();
  await page.getByRole("button", { name: "Start sessie" }).click();
  await expect(page).toHaveURL(/\/casussen\/sessie\?ids=/);

  // De uitwerking zit niet in de pagina vóór stap 4, ook niet verborgen.
  expect(await page.content()).not.toMatch(/EXPERT-(HART|LONG|HUID)/);

  const topics = new Set<string>();
  for (let i = 0; i < 3; i++) {
    await expect(page.getByText(`Casus ${i + 1} van 3`)).toBeVisible();
    topics.add((await page.locator("main span.rounded-full").first().textContent()) ?? "");

    await page.getByRole("textbox", { name: "Je werkdiagnose" }).fill("Mijn werkdiagnose");
    await page.getByRole("button", { name: "Volgende" }).click();
    await page.getByRole("textbox", { name: "Wat past erbij?" }).fill("Passende bevindingen");
    await page.getByRole("button", { name: "Volgende" }).click();

    await page.getByRole("button", { name: "Toon mogelijke alternatieven" }).click();
    const chips = page.locator("button.rounded-full");
    await expect(chips).toHaveCount(2);
    await chips.first().click();
    await expect(page.getByText(/EXPERT-/)).toHaveCount(0);
    await page.getByRole("button", { name: "Volgende" }).click();

    await expect(page.getByText("Zet de diagnoses in volgorde")).toBeVisible();
    await expect(page.getByText(/EXPERT-/)).toHaveCount(0);
    await page.getByRole("button", { name: "Vergelijk met de expert" }).click();
    await expect(page.getByText(/EXPERT-/)).toBeVisible();
    await expect(page.getByText("Juiste diagnose")).toBeVisible();
    await page.getByRole("button", { name: "Verder" }).click();

    await page.getByRole("button", { name: "Nee" }).click();
    if (i === 0) await page.getByRole("button", { name: /^Slordig of moe/ }).click(); // A1
    await page.getByRole("button", { name: "4", exact: true }).click();
    await page.getByRole("button", { name: "Opslaan" }).click();

    await expect(page.getByText("Maak kaart van wat ik miste")).toBeVisible();
    if (i === 0) {
      await expect(page.getByRole("textbox", { name: "Antwoord (achterkant)" })).toHaveValue(/^Les: herken/);
      await page.getByRole("textbox", { name: "Vraag (voorkant)" }).fill("Welke bevinding wijst op deze diagnose?");
      await page.getByRole("button", { name: "Maak conceptkaart" }).click();
      await expect(page.getByText("1 conceptkaart(en) gemaakt.")).toBeVisible();
    }
    await page.getByRole("button", { name: i === 2 ? "Sessie afronden" : "Volgende casus" }).click();
  }
  await expect(page.getByText("Sessie klaar")).toBeVisible();
  expect(topics.size).toBe(3);

  const db = admin();
  const { count: attempts } = await db.from("case_attempts").select("id", { count: "exact", head: true });
  expect(attempts).toBe(3);
  const { data: typed } = await db.from("case_attempts").select("error_type").not("error_type", "is", null);
  expect(typed).toEqual([{ error_type: "slip" }]);
  const { data: card } = await db.from("cards").select("status, tags, front").contains("tags", ["casus"]).single();
  expect(card).toMatchObject({ status: "draft", front: "Welke bevinding wijst op deze diagnose?" });

  // Binnen 7 dagen komen ze niet terug.
  await page.goto("/casussen");
  await expect(page.getByText("0 van 3 casussen klaar om te oefenen")).toBeVisible();
});

test("stagecasus: anonimiseringsmelding en direct actief", async ({ page }) => {
  await login(page);
  await page.goto("/casussen/nieuw?stage=1");
  await expect(page.getByText("Schrijf geanonimiseerd: geen naam, geboortedatum of herkenbare details.")).toBeVisible();
  await page.getByRole("combobox", { name: "Thema" }).selectOption({ label: "VOORBEELD - verwijderen na testen · Voorbeeld: huid" });
  await page.getByRole("textbox", { name: /^Titel/ }).fill("Jeukende handen");
  await page.getByRole("textbox", { name: /^Vignet/ }).fill("Vrouw, 40 jaar, kapster, jeukende rode handen.");
  await page.getByRole("textbox", { name: "1. Juiste diagnose" }).fill("Contacteczeem");
  await page.getByRole("textbox", { name: "2. Alternatief" }).fill("Psoriasis");
  await page.getByRole("button", { name: "Opslaan" }).click();
  await expect(page.getByText("Opgeslagen.")).toBeVisible();
  await expect(page.getByText("Actief", { exact: true })).toBeVisible();
  await expect(page.getByText("stage", { exact: true })).toBeVisible();
});
