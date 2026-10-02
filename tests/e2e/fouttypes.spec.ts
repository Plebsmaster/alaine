import { expect, test } from "@playwright/test";
import { admin, approveDraft, cardsLeft, draftsOpen, importExample, LOCAL, login, resetExample } from "./helpers";

// Aanvulling 01 zonder AI: fouttype na Opnieuw/Moeilijk (A1), stopcheck zonder AI,
// en de verdeling van fouttypes op het overzicht.
test.skip(!LOCAL, "De rooktest wist testdata en draait alleen tegen de lokale Supabase (supabase start).");

test.beforeAll(resetExample);

test("fouttype vastleggen, stopcheck en verdeling op het overzicht", async ({ page }) => {
  await login(page);
  await importExample(page);
  await page.goto("/goedkeuren");
  await approveDraft(page);
  await expect.poll(() => draftsOpen(page)).toBe(2);

  await page.goto("/vandaag");
  await expect.poll(() => cardsLeft(page)).toBe(1);
  await page.keyboard.press("Space");
  await page.keyboard.press("1"); // Opnieuw
  // Fouttype: niets voorgeselecteerd zonder AI; met het toetsenbord kiezen.
  await expect(page.getByRole("group", { name: "Wat ging er mis?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Wist ik niet/ })).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("1"); // Wist ik niet

  // De kaart komt terug (learning); nu goed, en de sessie is klaar.
  for (let i = 0; i < 4 && !(await page.getByText(/Sessie klaar/).isVisible()); i++) {
    await page.keyboard.press("Space");
    await page.keyboard.press("4");
  }
  await expect(page.getByText(/Sessie klaar/)).toBeVisible();
  // Stopcheck zonder AI: de kaarten die fout gingen.
  await expect(page.getByText("Om te onthouden")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Hoe bereken je de ejectiefractie (EF)?" })).toBeVisible();

  const db = admin();
  await expect
    .poll(async () => (await db.from("review_logs").select("rating, error_type").order("review")).data)
    .toEqual([
      { rating: 1, error_type: "knowledge_gap" },
      { rating: 4, error_type: null },
    ]);

  await page.goto("/overzicht");
  await page.getByText("Alle cijfers per thema").click();
  await expect(page.getByText("1 kennis · 0 redenering · 0 slordig")).toBeVisible();
});
