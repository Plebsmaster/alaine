import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { devices, expect, type Browser, type Page } from "@playwright/test";

config({ path: ".env.local", quiet: true });

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const EMAIL = (process.env.ALLOWED_EMAIL ?? "").toLowerCase();
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Rooktests wissen testdata en draaien daarom alleen tegen de lokale Supabase. */
export const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(SUPABASE_URL);

export function admin() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
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
