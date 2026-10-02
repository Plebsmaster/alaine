import { defineConfig, devices } from "@playwright/test";

// Rooktest tegen de lokale Supabase-stack (supabase start), met een eigen testgebruiker
// (E2E_EMAIL) en een eigen productieserver op poort 3100. Zo raken de tests de data van de
// student niet: alleen E2E_EMAIL mag inloggen op die server, en RLS scheidt de rijen.
// Chromium-pad overschrijven kan met PW_CHROMIUM_PATH.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
export const E2E_EMAIL = (process.env.E2E_EMAIL ?? "e2e@pa-studie.test").toLowerCase();
const PORT = 3100;

// Laat context.route ook verzoeken van de service worker onderscheppen (offline-test).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    launchOptions: { executablePath },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // next dev mag maar één keer per project draaien; daarom een build op een eigen poort.
        command: `npm run build && npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        reuseExistingServer: false,
        timeout: 300_000,
        env: { ALLOWED_EMAIL: E2E_EMAIL },
      },
});
