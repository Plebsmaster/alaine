import { expect, test } from "@playwright/test";
import { admin, importExample, LOCAL, login, resetExample } from "./helpers";

// Fase 4 en ontwerp 1r: een sessie van 3 casussen uit verschillende thema's is af te ronden,
// op laptop (reflectietabel) en telefoon (stapsgewijs); de expert-uitwerking is pas zichtbaar
// na het rangschikken; "Maak kaart van wat ik miste" werkt.
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
    // Casus 1 en 2 op de laptop (reflectietabel), casus 3 op de telefoon (stapsgewijs).
    const phone = i === 2;
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText(phone ? `${i + 1} / 3` : `Casus ${i + 1} van 3`)).toBeVisible();
    topics.add(((await page.getByText(/ · Vignet$/).textContent()) ?? "").replace(/ · Vignet$/, ""));

    await page.getByRole("textbox", { name: "Je werkdiagnose" }).fill("Mijn werkdiagnose");
    await page.getByRole("button", { name: "Volgende" }).click();

    // De differentiaal pas na eigen denkwerk: minstens één kolom bij de werkdiagnose.
    const reveal = page.getByRole("button", { name: "Toon mogelijke alternatieven" });
    const chips = page.getByRole("group", { name: "Mogelijke diagnoses" }).getByRole("button");
    if (!phone) {
      await expect(reveal).toBeDisabled();
      await page.getByRole("textbox", { name: "Wat past erbij? (Mijn werkdiagnose)" }).fill("Passende bevindingen");
      await reveal.click();
    } else {
      await page.getByRole("textbox", { name: "Wat past erbij?" }).fill("Passende bevindingen");
      await page.getByRole("button", { name: "Volgende" }).click();
      await reveal.click();
    }
    await expect(chips).toHaveCount(2);
    const alt = (await chips.first().textContent())!;
    await chips.first().click();
    await expect(page.getByText(/EXPERT-/)).toHaveCount(0);

    // Rangschikken: het alternatief naar boven, met het toetsenbord, door te slepen of op de telefoon.
    const workingUp = page.getByRole("button", { name: "Mijn werkdiagnose omhoog" });
    if (i === 0) {
      await page.getByRole("button", { name: `${alt} omhoog` }).focus();
      await page.keyboard.press("Enter");
    } else if (i === 1) {
      const grip = (await page.locator("li[data-row]").nth(1).locator("[data-grip]").boundingBox())!;
      const top = (await page.locator("li[data-row]").first().boundingBox())!;
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await page.mouse.down();
      await page.mouse.move(grip.x + grip.width / 2, top.y + 4, { steps: 8 });
      await page.mouse.up();
    } else {
      await page.getByRole("button", { name: "Volgende" }).click();
      await expect(page.getByText("Zet de diagnoses in volgorde")).toBeVisible();
      await page.getByRole("button", { name: `${alt} omhoog` }).click();
    }
    await expect(workingUp).toBeEnabled();

    await expect(page.getByText(/EXPERT-/)).toHaveCount(0);
    await page.getByRole("button", { name: "Vergelijk met de expert" }).click();
    await expect(page.getByText("Juiste diagnose")).toBeVisible();
    await expect(page.getByText(`Jouw eindantwoord: ${alt}`)).toBeVisible();
    // Alleen de juiste diagnose staat open; de rest op verzoek.
    await expect(page.getByText(/EXPERT-/)).toHaveCount(0);
    await page.getByRole("button", { name: /^2\. .+Toon$/ }).click();
    await expect(page.getByText(/EXPERT-/)).toBeVisible();
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
  // Rijvolgorde = eindrangschikking; de reflectie gaat mee; de differentiaal was opgevraagd.
  const { data: ranked } = await db.from("case_attempts").select("final_ranking, reflection, cued");
  for (const a of ranked ?? []) {
    expect(a.final_ranking[1]).toBe("Mijn werkdiagnose");
    expect(a.reflection).toContainEqual(expect.objectContaining({ diagnosis: "Mijn werkdiagnose", supporting: "Passende bevindingen" }));
    expect(a.cued).toBe(true);
  }
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
