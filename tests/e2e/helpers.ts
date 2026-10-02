import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { devices, expect, type Browser, type Page } from "@playwright/test";
import { E2E_EMAIL } from "../../playwright.config";

config({ path: ".env.local", quiet: true });

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
/** Eigen testgebruiker; nooit het account van de student (ALLOWED_EMAIL in .env.local). */
export const EMAIL = E2E_EMAIL;
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Rooktests wissen testdata en draaien daarom alleen tegen de lokale Supabase. */
export const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(SUPABASE_URL);

function serviceRole() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

let token: Promise<string> | null = null;

/**
 * Sessie van de testgebruiker (maakt het account aan als het nog niet bestaat). Met een
 * willekeurig wachtwoord per run in plaats van een inloglink: een link telt bij Supabase
 * als verstuurde mail, en dan weigert de inlogcode in de browser vlak daarna (429).
 */
function testUserToken(): Promise<string> {
  token ??= (async () => {
    const service = serviceRole();
    const password = `e2e-${crypto.randomUUID()}`;
    const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
    const existing = users.users.find((u) => u.email?.toLowerCase() === EMAIL);
    const { error } = existing
      ? await service.auth.admin.updateUserById(existing.id, { password })
      : await service.auth.admin.createUser({ email: EMAIL, password, email_confirm: true });
    if (error) throw error;
    const anon = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { data, error: signInError } = await anon.auth.signInWithPassword({ email: EMAIL, password });
    if (signInError || !data.session) throw signInError ?? new Error("Geen sessie voor de testgebruiker");
    return data.session.access_token;
  })();
  return token;
}

/**
 * Database-client die werkt als de testgebruiker: RLS laat alleen diens rijen zien, dus
 * tellingen en wijzigingen raken nooit de data van de student.
 */
export function admin() {
  return createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: testUserToken,
  });
}

/** Schone start: verwijder de voorbeeldmodule (cascade) van de testgebruiker. */
export async function resetExample() {
  await admin().from("modules").delete().eq("external_id", "voorbeeld");
}

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

export async function login(page: Page) {
  await page.goto("/vandaag");
  await expect(page).toHaveURL(/\/login/);
  const sentAt = Date.now();
  await page.getByLabel("E-mailadres").fill(EMAIL);
  await page.getByRole("button", { name: "Stuur inlogcode" }).click();
  await expect(page.getByLabel("Code uit de e-mail")).toBeVisible();
  await page.getByLabel("Code uit de e-mail").fill(await latestCode(sentAt));
  await page.getByRole("button", { name: "Inloggen" }).click();
  await expect(page).toHaveURL(/\/vandaag/);
  // Supabase staat één inlogmail per interval toe; wacht even voor een volgende login.
  await new Promise((r) => setTimeout(r, 1500));
}

export async function newPage(browser: Browser, device: keyof typeof devices) {
  const { defaultBrowserType: _ignored, ...options } = devices[device];
  void _ignored;
  const context = await browser.newContext(options);
  return context.newPage();
}

export async function importExample(page: Page, file = "content/voorbeeld-import.json") {
  await page.goto("/instellingen");
  await page.getByLabel("Importbestand (JSON)").setInputFiles(file);
  await expect(page.getByText("Controle geslaagd")).toBeVisible();
  await page.getByRole("button", { name: /^Importeer / }).click();
  await expect(page.getByText("Import klaar")).toBeVisible();
}

/** Herhaalscherm: kaarten gedaan en nog te doen, uit de voortgangsbalk (ontwerp 1f). */
async function progress(page: Page) {
  const bar = page.getByRole("progressbar", { name: "Voortgang van de sessie" });
  const max = Number(await bar.getAttribute("aria-valuemax"));
  const now = Number(await bar.getAttribute("aria-valuenow"));
  return { done: now, left: max - now };
}
export const cardsLeft = async (page: Page) => (await progress(page)).left;
export const cardsDone = async (page: Page) => (await progress(page)).done;

/**
 * Goedkeuren (ontwerp 1n): aantal open kaartconcepten uit "i van n". 0 zodra de lege staat er
 * is; die verschijnt pas als ook het laatste goedkeuren is opgeslagen.
 */
export async function draftsOpen(page: Page): Promise<number> {
  const position = page.getByText(/^\d+ van \d+$/).filter({ visible: true });
  if ((await position.count()) > 0) return Number((await position.first().textContent())?.match(/van (\d+)/)?.[1]);
  return (await page.getByText("Geen kaartconcepten om na te kijken.").isVisible()) ? 0 : NaN;
}

/** Keurt het geopende kaartconcept goed en wacht tot dat is opgeslagen. */
export async function approveDraft(page: Page) {
  await expect.poll(() => draftsOpen(page)).toBeGreaterThan(0);
  const open = await draftsOpen(page);
  const button = page.getByRole("button", { name: "Goedkeuren", exact: true });
  await button.click();
  await expect.poll(() => draftsOpen(page)).toBe(open - 1);
  // Tijdens het opslaan staan de knoppen uit.
  if (open > 1) await expect(button).toBeEnabled();
}
