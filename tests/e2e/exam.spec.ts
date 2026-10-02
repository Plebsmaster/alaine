import { expect, test } from "@playwright/test";
import { admin, importExample, LOCAL, login, resetExample } from "./helpers";

// Fase 5: een pretest is te maken vóór een thema; een proeftoets mengt thema's en
// toont per leerdoel de score.
test.skip(!LOCAL, "De rooktest wist testdata en draait alleen tegen de lokale Supabase (supabase start).");

test.beforeAll(resetExample);

test("pretest en proeftoets", async ({ page }) => {
  await login(page);
  await importExample(page, "tests/e2e/fixtures/toets-import.json");

  // Alle conceptvragen in één keer goedkeuren.
  await page.goto("/goedkeuren");
  const boxes = page.getByRole("checkbox", { name: /^Vraag goedkeuren/ });
  await expect(boxes).toHaveCount(16);
  for (const box of await boxes.all()) await box.check();
  await page.getByRole("button", { name: "Geselecteerde vragen goedkeuren" }).click();
  await expect(boxes).toHaveCount(0);

  // Pretest: modelantwoord pas na antwoorden, geen score.
  await page.goto("/oefentoets");
  await page.getByRole("link", { name: "Start pretest" }).click();
  expect(await page.content()).not.toContain("MODEL-PRETEST");
  for (let i = 1; i <= 8; i++) {
    await expect(page.getByText(`Vraag ${i} van 8`)).toBeVisible();
    if (i <= 2) {
      await page.getByRole("textbox", { name: "Je antwoord" }).fill("Mijn gok");
      await page.getByRole("button", { name: "Toon modelantwoord" }).click();
    } else {
      await page.getByRole("button", { name: "Weet ik niet, toon modelantwoord" }).click();
    }
    await expect(page.getByText(`MODEL-PRETEST-${i}`)).toBeVisible();
    await page.getByRole("button", { name: i === 8 ? "Afronden" : "Volgende vraag" }).click();
  }
  await expect(page.getByText("Je hebt er 2 van de 8 geprobeerd.")).toBeVisible();
  await expect(page.getByText(/%|score/i)).toHaveCount(0);

  // Proeftoets over beide thema's.
  await page.goto("/oefentoets");
  await page.getByRole("checkbox", { name: "Voorbeeld: ritme in proeftoets" }).check();
  await page.getByRole("checkbox", { name: "Voorbeeld: KNO in proeftoets" }).check();
  await page.getByRole("button", { name: "Start proeftoets" }).click();
  await expect(page).toHaveURL(/\/oefentoets\/proeftoets\?ids=/);
  await expect(page.getByRole("heading", { name: "Proeftoets" })).toBeVisible();
  await expect(page.getByText("8 vragen", { exact: true })).toBeVisible();
  const html = await page.content();
  expect(html).not.toMatch(/UITLEG-|MODEL-OPEN/);

  // Gemengd: beide thema's, en geen twee opeenvolgende vragen uit hetzelfde thema.
  const badges = await page.locator("main").getByText(/^Voorbeeld: (ritme|KNO)$/).allTextContents();
  expect(new Set(badges).size).toBe(2);
  for (let i = 1; i < badges.length; i++) expect(badges[i]).not.toBe(badges[i - 1]);

  // Overal optie A (juist voor ritme, fout voor KNO); open vragen invullen.
  const sets = page.locator("main fieldset");
  await expect(sets).toHaveCount(6);
  for (let i = 0; i < 6; i++) await sets.nth(i).locator("input[type=radio]").first().check();
  for (const box of await page.getByRole("textbox", { name: /^Antwoord op vraag/ }).all()) await box.fill("Mijn antwoord");
  await expect(page.getByText("8 van 8 beantwoord")).toBeVisible();
  await page.getByRole("button", { name: "Inleveren" }).click();

  await expect(page.getByText("Resultaat")).toBeVisible();
  await expect(page.getByText("meerkeuze 3/6")).toBeVisible();
  const row = (code: string) => page.getByRole("row", { name: new RegExp(`^${code.replace(".", "\\.")} `) });
  await expect(row("R.1")).toContainText("3/4");
  await expect(row("R.1")).toContainText("1 na te kijken");
  await expect(row("K.1")).toContainText("0/4");

  // Open vragen zelf nakijken: score per leerdoel werkt bij.
  const openR = page.locator("div", { has: page.getByText("Open toetsvraag R?") }).filter({ has: page.getByRole("button", { name: "Goed" }) }).last();
  await openR.getByRole("button", { name: "Goed" }).click();
  await expect(row("R.1")).toContainText("4/4");

  // Fout antwoord → met één klik een conceptkaart.
  await page.getByRole("button", { name: "Maak kaart van deze vraag" }).first().click();
  await expect(page.getByText("Conceptkaart gemaakt; staat op Goedkeuren.")).toBeVisible();

  const db = admin();
  const { count } = await db.from("question_attempts").select("id", { count: "exact", head: true }).not("session_id", "is", null);
  expect(count).toBe(16); // 8 pretest + 8 proeftoets
  const { data: cards } = await db.from("cards").select("status, back").contains("tags", ["toetsvraag"]);
  expect(cards).toEqual([{ status: "draft", back: "Optie twee" }]);
});
