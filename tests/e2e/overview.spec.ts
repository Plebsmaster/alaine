import { expect, test } from "@playwright/test";
import { admin, importExample, LOCAL, login, resetExample } from "./helpers";

// Fase 6: overzicht per thema, dekking, werklast, lastige kaarten, streak.
test.skip(!LOCAL, "De rooktest wist testdata en draait alleen tegen de lokale Supabase (supabase start).");

test.beforeAll(resetExample);

test("overzicht toont echte cijfers uit het logboek", async ({ page }) => {
  await login(page);
  await importExample(page);
  await page.goto("/goedkeuren");
  // Alleen de eerste kaart goedkeuren: leerdoel V.2 blijft zonder dekking.
  await page.getByRole("button", { name: "Goedkeuren", exact: true }).first().click();
  await expect(page.getByRole("textbox", { name: "Voorkant" })).toHaveCount(2);

  await page.goto("/vandaag");
  await page.getByRole("button", { name: /Toon antwoord/ }).click();
  await page.getByRole("button", { name: /^Goed/ }).click();
  // Wachten op de leerstap, of de kaart komt meteen terug (vooruit leren binnen 20 min).
  await expect(page.getByText(/Even pauze|2 \/ 2/)).toBeVisible();

  // Lastige kaart nabootsen, pas als de beoordeling is opgeslagen (anders overschrijft die het).
  const db = admin();
  await expect.poll(async () => (await db.from("review_logs").select("id", { count: "exact", head: true })).count).toBe(1);
  const { data: card } = await db.from("cards").select("id").eq("external_id", "voorbeeld-fysiologie-k-001").single();
  await db.from("card_schedule").update({ lapses: 5 }).eq("card_id", card!.id);

  await page.goto("/overzicht");
  // Per thema: dekking van de leerdoelen (V.1 gedekt, V.2 niet).
  const perTopic = page.getByRole("region", { name: "Per thema" });
  await expect(perTopic.getByText("1/2")).toBeVisible();
  // Aandacht nodig: eerst het leerdoel zonder dekking, dan de lastige kaart.
  const attention = page.getByRole("region", { name: "Aandacht nodig" });
  await expect(attention.getByText(/V\.2/)).toBeVisible();
  await expect(attention.getByText(/5× vergeten · herschrijf of splits/)).toBeVisible();

  // Alle cijfers blijven beschikbaar onder "Alle cijfers per thema".
  await page.getByText("Alle cijfers per thema").click();
  await expect(page.getByText("Studiestreak")).toBeVisible();
  await expect(page.locator("dd", { hasText: /^1 dag$/ })).toBeVisible();
  const row = page.getByRole("row", { name: /Voorbeeld: hart en longen/ });
  await expect(row.getByRole("cell").nth(1)).toHaveText("1"); // actief
  await expect(row.getByRole("cell").nth(2)).toHaveText("2"); // concept

  // Werklast: de learning-kaart staat vandaag; de tabelweergave toont alle waarden.
  const chart = page.locator("figure", { hasText: "Werklast, 14 dagen" });
  await chart.getByText("Als tabel").click();
  await expect(chart.getByRole("row").first()).toContainText("1 herhaling");
  // Tooltip op toetsenbordfocus.
  await chart.getByRole("button").first().focus();
  await expect(chart.getByRole("status")).toContainText("1 herhaling");
});
