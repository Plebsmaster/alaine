import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { devices, expect, test, type Browser, type Page } from "@playwright/test";

// Fase 0 + 1: inloggen (alleen ALLOWED_EMAIL), voorbeeld importeren, goedkeuren,
// herhalen op de telefoon en direct zien op de laptop.
config({ path: ".env.local", quiet: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const EMAIL = (process.env.ALLOWED_EMAIL ?? "").toLowerCase();
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(SUPABASE_URL);

test.skip(!LOCAL, "De rooktest wist testdata en draait alleen tegen de lokale Supabase (supabase start).");

async function latestCode(after: number): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${EMAIL}"`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string; Created: string }[] };
    const fresh = messages.find((m) => new Date(m.Created).getTime() >= after - 1000);
    if (fresh) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as { HTML: string; Text: string };
      const code = (msg.HTML || msg.Text).match(/\b(\d{6,10})\b/);
      if (code) return code[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Geen inlogmail gevonden in Mailpit");
}

async function login(page: Page) {
  await page.goto("/vandaag");
  await expect(page).toHaveURL(/\/login/);
  const sentAt = Date.now();
  await page.getByLabel("E-mailadres").fill(EMAIL);
  await page.getByRole("button", { name: "Stuur inlogcode" }).click();
  await expect(page.getByLabel("Code uit de e-mail")).toBeVisible();
  await page.getByLabel("Code uit de e-mail").fill(await latestCode(sentAt));
  await page.getByRole("button", { name: "Inloggen" }).click();
  await expect(page).toHaveURL(/\/vandaag/);
}

async function newPage(browser: Browser, device: keyof typeof devices) {
  const { defaultBrowserType: _ignored, ...options } = devices[device];
  void _ignored;
  const context = await browser.newContext(options);
  return context.newPage();
}

test.beforeAll(async () => {
  // Schone start: verwijder de voorbeeldmodule (cascade) van de testgebruiker.
  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await admin.from("modules").delete().eq("external_id", "voorbeeld");
});

test("ander e-mailadres wordt geweigerd", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mailadres").fill("iemand.anders@voorbeeld.nl");
  await page.getByRole("button", { name: "Stuur inlogcode" }).click();
  await expect(page.getByText("Dit e-mailadres heeft geen toegang tot deze app.")).toBeVisible();
});

test("importeren, goedkeuren, herhalen op telefoon, zichtbaar op laptop", async ({ browser }) => {
  const laptop = await newPage(browser, "Desktop Chrome");
  const phone = await newPage(browser, "Pixel 7");
  await login(laptop);
  await new Promise((r) => setTimeout(r, 1500)); // Supabase staat één inlogmail per interval toe
  await login(phone);

  // Import via /instellingen: eerst controle, dan importeren.
  await laptop.goto("/instellingen");
  await laptop.getByLabel("Importbestand (JSON)").setInputFiles("content/voorbeeld-import.json");
  await expect(laptop.getByText("Controle geslaagd")).toBeVisible();
  await expect(laptop.getByRole("cell", { name: "3 / 0 / 0" })).toBeVisible(); // 3 nieuwe kaarten
  await laptop.getByRole("button", { name: /Importeer voorbeeld-import\.json/ }).click();
  await expect(laptop.getByText("Import klaar")).toBeVisible();

  // Concepten staan nog niet in de herhaling.
  await laptop.goto("/vandaag");
  await expect(laptop.getByText("Niets te herhalen vandaag")).toBeVisible();

  // Goedkeuren, één kaart herschreven in eigen woorden.
  await laptop.goto("/goedkeuren");
  const first = laptop.getByRole("textbox", { name: "Voorkant" }).first();
  await first.fill("Wat is de formule voor de ejectiefractie?");
  // Na elke goedkeuring ververst de lijst; de goedgekeurde kaart verdwijnt eruit.
  for (let left = 2; left >= 0; left--) {
    await laptop.getByRole("button", { name: "Goedkeuren" }).first().click();
    await expect(laptop.getByRole("textbox", { name: "Voorkant" })).toHaveCount(left);
  }
  await expect(laptop.getByText("Geen kaartconcepten om na te kijken.")).toBeVisible();

  // Op de telefoon: drie kaarten, eentje beoordelen.
  await phone.goto("/vandaag");
  await expect(phone.getByText("3 kaarten · ongeveer")).toBeVisible();
  await phone.getByRole("button", { name: /Toon antwoord/ }).click();
  await expect(phone.getByRole("button", { name: /^Goed/ })).toBeVisible();
  await phone.getByRole("button", { name: /^Goed/ }).click();
  await expect(phone.getByText(/1 gedaan/)).toBeVisible();
  await expect(phone.getByText("Opslaan…")).toHaveCount(0);

  // Op de laptop direct zichtbaar: twee nieuwe over, één in learning (komt over minuten terug).
  await laptop.goto("/vandaag");
  await expect(laptop.getByText("3 kaarten · ongeveer")).toBeVisible();
  await expect(laptop.getByText("2 nieuw")).toBeVisible();

  // Laptop: sneltoetsen (spatie = omdraaien, 4 = Makkelijk) tot de sessie klaar is.
  for (let i = 0; i < 6; i++) {
    if (await laptop.getByText(/Klaar voor vandaag|Even pauze/).isVisible()) break;
    await laptop.keyboard.press("Space");
    await laptop.keyboard.press("4");
  }
  await expect(laptop.getByText("Klaar voor vandaag")).toBeVisible();
  // "Morgen: …" wordt pas geteld als alle beoordelingen zijn opgeslagen.
  await expect(laptop.getByText(/Morgen: \d+ herhalingen/)).toBeVisible();

  // Logboek in de database: telefoon (1) + laptop (2 nieuwe + de learning-kaart van de telefoon).
  const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { count } = await admin.from("review_logs").select("id", { count: "exact", head: true });
  expect(count).toBe(4);
});
