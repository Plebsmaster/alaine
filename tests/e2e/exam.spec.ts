import { expect, test } from "@playwright/test";
import { admin, importExample, LOCAL, login, resetExample } from "./helpers";

// Fase 5 en ontwerp 1t: een pretest is te maken vóór een thema; een proeftoets mengt thema's,
// toont één vraag per scherm met vraagoverzicht en na inleveren per leerdoel de score.
test.skip(!LOCAL, "De rooktest wist testdata en draait alleen tegen de lokale Supabase (supabase start).");

test.beforeAll(resetExample);

test("pretest en proeftoets", async ({ page }) => {
  await login(page);
  await importExample(page, "tests/e2e/fixtures/toets-import.json");

  // Alle conceptvragen in één keer goedkeuren.
  await page.goto("/goedkeuren?soort=vragen");
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
  await expect(page.getByRole("heading", { name: /^Proeftoets/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Vraagoverzicht" }).getByRole("button")).toHaveCount(8);
  const html = await page.content();
  expect(html).not.toMatch(/UITLEG-|MODEL-OPEN/);

  // Eén vraag per scherm (ontwerp 1t). Overal optie A (juist voor ritme, fout voor KNO); open vragen invullen.
  const topics: string[] = [];
  let mcq = 0;
  for (let i = 1; i <= 8; i++) {
    await expect(page.getByText(`Vraag ${i} van 8`)).toBeVisible();
    topics.push((await page.locator("main").getByText(/^Voorbeeld: (ritme|KNO)$/).textContent()) ?? "");
    const radios = page.getByRole("radio");
    if ((await radios.count()) > 0) {
      await radios.first().check();
      mcq++;
    } else {
      await page.getByRole("textbox", { name: `Antwoord op vraag ${i}` }).fill("Mijn antwoord");
    }
    if (i < 8) await page.getByRole("button", { name: "Volgende", exact: true }).click();
  }
  expect(mcq).toBe(6);
  // Gemengd: beide thema's, en geen twee opeenvolgende vragen uit hetzelfde thema.
  expect(new Set(topics).size).toBe(2);
  for (let i = 1; i < topics.length; i++) expect(topics[i]).not.toBe(topics[i - 1]);
  // Terug via het vraagoverzicht: het antwoord blijft staan.
  await page.getByRole("button", { name: "Vraag 1, beantwoord" }).click();
  await expect(page.getByText("Vraag 1 van 8")).toBeVisible();
  await expect(page.getByText("8 van 8 beantwoord")).toBeVisible();
  await page.getByRole("button", { name: "Inleveren" }).first().click();

  await expect(page.getByRole("heading", { name: /van 8 goed$/ })).toBeVisible();
  await expect(page.getByText("meerkeuze 3/6")).toBeVisible();
  const row = (code: string) => page.getByRole("row", { name: new RegExp(` ${code.replace(".", "\\.")} `) });
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
