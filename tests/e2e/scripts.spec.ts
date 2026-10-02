import { expect, test, type Page } from "@playwright/test";
import { draftsOpen, importExample, LOCAL, login, resetExample } from "./helpers";

// Fase 3: een goedgekeurd script levert per gevuld veld één conceptkaart op;
// twee scripts staan naast elkaar.
test.skip(!LOCAL, "De rooktest wist testdata en draait alleen tegen de lokale Supabase (supabase start).");

test.beforeAll(resetExample);

async function createScript(page: Page, condition: string, fields: Record<string, string>) {
  await page.goto("/scripts/nieuw");
  await page.getByRole("combobox", { name: "Thema" }).first().selectOption({ label: "VOORBEELD - verwijderen na testen · Voorbeeld: hart en longen" });
  await page.getByRole("textbox", { name: "Aandoening" }).first().fill(condition);
  await page.getByRole("button", { name: "Aanmaken" }).click();
  await expect(page.getByRole("heading", { name: condition })).toBeVisible();
  for (const [label, value] of Object.entries(fields)) {
    // Het label bevat ook de hint ("Presentatie Klachten, …"), dus zoeken op het begin.
    await page.getByRole("textbox", { name: new RegExp(`^${label}`) }).fill(value);
  }
  await page.getByRole("button", { name: "Opslaan en goedkeuren" }).click();
}

test("script goedkeuren maakt kaarten per gevuld veld; vergelijken naast elkaar", async ({ page }) => {
  await login(page);
  await importExample(page);

  // Drie van de vier kaartvelden gevuld: drie conceptkaarten.
  await createScript(page, "Hartfalen", {
    Presentatie: "Kortademig bij inspanning, enkeloedeem.",
    Pathofysiologie: "Het hart pompt onvoldoende voor de behoefte.",
    Bevindingen: "Crepitaties, verhoogde CVD; NT-proBNP verhoogd.",
    "Gelijkende aandoeningen": "COPD",
  });
  await expect(page.getByText("3 scriptkaart(en) staan als concept klaar")).toBeVisible();
  await expect(page.getByText("Wat is de typische presentatie van Hartfalen?")).toBeVisible();
  await expect(page.getByText("Wat is het beleid bij Hartfalen?")).toHaveCount(0);

  // Nog een keer goedkeuren levert geen dubbele kaarten op.
  await page.getByRole("button", { name: "Opslaan en kaarten bijwerken" }).click();
  await expect(page.getByText("Er kwamen geen nieuwe kaarten bij.")).toBeVisible();

  await createScript(page, "COPD", {
    Presentatie: "Chronisch hoesten en kortademigheid bij een roker.",
    "Onderscheidende kenmerken": "Piepen, verlengd expirium; geen oedeem.",
  });
  await expect(page.getByText("1 scriptkaart(en) staan als concept klaar")).toBeVisible();

  // Vergelijken: vanuit het script via "gelijkend", en via de lijst.
  await page.goto("/scripts");
  await page.getByRole("checkbox", { name: "Hartfalen vergelijken" }).check();
  await page.getByRole("checkbox", { name: "COPD vergelijken" }).check();
  await page.getByRole("button", { name: "Vergelijk geselecteerde" }).click();
  await expect(page.getByRole("columnheader", { name: "Hartfalen" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "COPD" })).toBeVisible();
  const presentatie = page.locator("tbody", { has: page.getByRole("columnheader", { name: "Presentatie" }) });
  await expect(presentatie).toContainText("enkeloedeem");
  await expect(presentatie).toContainText("roker");
  // Zonder API-key is de AI-knop uit, met uitleg.
  await expect(page.getByRole("button", { name: "Maak vergelijkingskaart" })).toBeDisabled();

  // De scriptkaarten staan als concept op Goedkeuren, nog niet in de herhaling.
  await page.goto("/goedkeuren");
  // 3 kaarten uit de voorbeeldimport + 4 scriptkaarten (3 van Hartfalen, 1 van COPD).
  await expect.poll(() => draftsOpen(page)).toBe(7);
  await page.goto("/vandaag");
  await expect(page.getByText("Niets te herhalen vandaag")).toBeVisible();
});
