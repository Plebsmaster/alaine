import { expect, test, type BrowserContext } from "@playwright/test";
import { admin, importExample, LOCAL, login, resetExample } from "./helpers";

// Fase 6: herhalen in vliegtuigmodus werkt en na herverbinden staan alle
// beoordelingen in de database. Vraagt een productiebuild (service worker).
test.skip(!LOCAL, "De rooktest wist testdata en draait alleen tegen de lokale Supabase (supabase start).");

test.beforeAll(resetExample);

// Echte vliegtuigmodus: setOffline geldt niet voor de service worker, dus ook alle
// verzoeken (ook die van de service worker) blokkeren.
const block = (route: { abort: (code: string) => Promise<void> }) => route.abort("internetdisconnected");
async function offline(context: BrowserContext) {
  await context.setOffline(true);
  await context.route("**/*", block);
}
async function online(context: BrowserContext) {
  await context.unroute("**/*", block);
  await context.setOffline(false);
}

test("offline herhalen en synchroniseren", async ({ page, context }) => {
  await login(page);
  await importExample(page);
  await page.goto("/goedkeuren");
  for (let left = 2; left >= 0; left--) {
    await page.getByRole("button", { name: "Goedkeuren", exact: true }).first().click();
    await expect(page.getByRole("textbox", { name: "Voorkant" })).toHaveCount(left);
  }

  // Online openen: service worker actief en /vandaag in de cache.
  await page.goto("/vandaag");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect.poll(() => page.evaluate(async () => !!(await (await caches.open("pages-v1")).match("/vandaag")))).toBe(true);

  // Vliegtuigmodus: de pagina opent uit de cache en herhalen werkt.
  await offline(context);
  await page.reload();
  await expect(page.getByText("3 kaarten · ongeveer")).toBeVisible();
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /Toon antwoord/ }).click();
    await page.getByRole("button", { name: /^Makkelijk/ }).click();
  }
  await expect(page.getByText("Offline · 2 beoordelingen wachten op verbinding")).toBeVisible();

  // Opnieuw openen, nog steeds offline: voortgang en uitgaande rij zijn bewaard.
  await page.reload();
  await expect(page.getByText("Nog 1 kaart")).toBeVisible();
  await expect(page.getByText("Offline · 2 beoordelingen wachten op verbinding")).toBeVisible();

  // Andere pagina's tonen offline een melding.
  await page.goto("/overzicht");
  await expect(page.getByText("Je bent offline")).toBeVisible();
  await page.goto("/vandaag");

  const db = admin();
  const count = async () => (await db.from("review_logs").select("id", { count: "exact", head: true })).count;
  expect(await count()).toBe(0);

  // Weer online: de rij wordt verstuurd.
  await online(context);
  await expect(page.getByText(/wachten op verbinding/)).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(count).toBe(2);

  // De laatste kaart online beoordelen en de sessie afronden.
  await page.reload();
  await expect(page.getByText("Nog 1 kaart")).toBeVisible();
  await page.getByRole("button", { name: /Toon antwoord/ }).click();
  await page.getByRole("button", { name: /^Makkelijk/ }).click();
  await expect(page.getByText(/Morgen: \d+ herhalingen/)).toBeVisible();
  expect(await count()).toBe(3);
});
