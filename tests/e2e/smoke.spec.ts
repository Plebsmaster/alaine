import { expect, test } from "@playwright/test";
import { admin, approveDraft, cardsDone, cardsLeft, draftsOpen, EMAIL, importExample, latestCode, LOCAL, login, newPage, resetExample } from "./helpers";

// Fase 0 + 1: inloggen (alleen ALLOWED_EMAIL), voorbeeld importeren, goedkeuren,
// herhalen op de telefoon en direct zien op de laptop.
test.skip(!LOCAL, "De rooktest wist testdata en draait alleen tegen de lokale Supabase (supabase start).");

test.beforeAll(resetExample);

test("ander e-mailadres wordt geweigerd", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mailadres").fill("iemand.anders@voorbeeld.nl");
  await page.getByRole("button", { name: "Stuur inlogcode" }).click();
  await expect(page.getByText("Dit e-mailadres heeft geen toegang tot deze app.")).toBeVisible();
});

test("inlogcode in zes vakjes: plakken met spaties, verkeerde code, dan inloggen", async ({ page }) => {
  await page.goto("/login");
  const sentAt = Date.now();
  await page.getByLabel("E-mailadres").fill(EMAIL);
  await page.getByRole("button", { name: "Stuur inlogcode" }).click();
  await expect(page.getByRole("heading", { name: "Vul je code in" })).toBeVisible();

  // Eén veld met one-time-code (iOS-autofill); alleen cijfers, hooguit zes.
  const code = page.getByLabel("Code uit de e-mail");
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await expect(code).toHaveAttribute("inputmode", "numeric");
  await code.fill("12 34 56 78");
  await expect(code).toHaveValue("123456");
  await page.getByRole("button", { name: "Inloggen", exact: true }).click();
  await expect(page.getByText("Deze code klopt niet of is verlopen.")).toBeVisible();

  const real = await latestCode(sentAt);
  await code.fill(`${real.slice(0, 3)} ${real.slice(3)}`);
  await page.getByRole("button", { name: "Inloggen", exact: true }).click();
  await expect(page).toHaveURL(/\/vandaag/);
  await new Promise((r) => setTimeout(r, 1500)); // één inlogmail per interval
});

test("importeren, goedkeuren, herhalen op telefoon, zichtbaar op laptop", async ({ browser }) => {
  const laptop = await newPage(browser, "Desktop Chrome");
  const phone = await newPage(browser, "Pixel 7");
  await login(laptop);
  await login(phone);

  // Import via /instellingen: eerst controle, dan importeren.
  await importExample(laptop);

  // Concepten staan nog niet in de herhaling.
  await laptop.goto("/vandaag");
  await expect(laptop.getByText("Niets te herhalen vandaag")).toBeVisible();

  // Goedkeuren, één kaart herschreven in eigen woorden.
  await laptop.goto("/goedkeuren");
  await expect.poll(() => draftsOpen(laptop)).toBe(3);
  await laptop.getByRole("textbox", { name: "Voorkant" }).fill("Wat is de formule voor de ejectiefractie?");
  await expect(laptop.getByText("Herschreven")).toBeVisible();
  // Na elke goedkeuring staat meteen het volgende concept open.
  for (let i = 0; i < 3; i++) await approveDraft(laptop);
  await expect(laptop.getByText("Geen kaartconcepten om na te kijken.")).toBeVisible();

  // Op de telefoon: drie kaarten, eentje beoordelen.
  await phone.goto("/vandaag");
  await expect.poll(() => cardsLeft(phone)).toBe(3);
  await phone.getByRole("button", { name: /Toon antwoord/ }).click();
  await expect(phone.getByRole("button", { name: /^Goed/ })).toBeVisible();
  await phone.getByRole("button", { name: /^Goed/ }).click();
  await expect.poll(() => cardsDone(phone)).toBe(1);
  await expect(phone.getByText("Opslaan…")).toHaveCount(0);

  // Op de laptop direct zichtbaar: twee nieuwe over, één in learning (komt over minuten terug).
  await laptop.goto("/vandaag");
  await expect.poll(() => cardsLeft(laptop)).toBe(3);
  await expect(laptop.getByText(/· Nieuw$/)).toBeVisible();

  // Laptop: sneltoetsen (spatie = omdraaien, 4 = Makkelijk) tot de sessie klaar is.
  for (let i = 0; i < 6; i++) {
    if (await laptop.getByText(/Sessie klaar|Even pauze/).isVisible()) break;
    await laptop.keyboard.press("Space");
    await laptop.keyboard.press("4");
  }
  await expect(laptop.getByText(/Sessie klaar/)).toBeVisible();
  // "Morgen klaar" wordt pas geteld als alle beoordelingen zijn opgeslagen.
  await expect(laptop.getByText(/herhalingen en tot \d+ nieuwe kaarten/)).toBeVisible();

  // Logboek in de database: telefoon (1) + laptop (2 nieuwe + de learning-kaart van de telefoon).
  const { count } = await admin().from("review_logs").select("id", { count: "exact", head: true });
  expect(count).toBe(4);
});
