// Lokaal importscript: npm run import -- [--dry-run] <pad-naar-json>
// Gebruikt de service role uit .env.local en importeert voor de gebruiker met ALLOWED_EMAIL.
// Afbeeldingen (veld `image`, pad relatief aan content/) worden geüpload naar bucket card-images.
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  applyImport,
  checkReferences,
  formatSummary,
  loadExisting,
  parseImport,
  planImport,
  summarize,
  type ImportError,
} from "../lib/import/importer";
import type { ImportBundle } from "../lib/import/schema";

config({ path: ".env.local", quiet: true });

const CONTENT_DIR = path.resolve("content");
const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function fail(message: string, errors: ImportError[] = []): never {
  console.error(`\n${message}`);
  for (const e of errors.slice(0, 200)) console.error(`  ${e.path}: ${e.message}`);
  if (errors.length > 200) console.error(`  … en nog ${errors.length - 200} fouten`);
  process.exit(1);
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) fail(`${name} ontbreekt in .env.local`);
  return v;
}

async function findUserId(admin: SupabaseClient, email: string): Promise<string> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Gebruikers ophalen mislukt: ${error.message}`);
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 200) {
      fail(`Geen account gevonden voor ${email}. Log eerst één keer in via de app.`);
    }
  }
}

async function uploadImages(
  admin: SupabaseClient,
  userId: string,
  bundle: ImportBundle,
  allowed: Set<string>,
): Promise<Map<string, string>> {
  const paths = new Map<string, string>();
  for (const card of bundle.cards) {
    if (!card.image || !allowed.has(card.external_id)) continue;
    const file = path.resolve(CONTENT_DIR, card.image);
    if (!file.startsWith(CONTENT_DIR + path.sep)) fail(`Afbeelding buiten content/: ${card.image}`);
    const ext = path.extname(file).toLowerCase();
    if (!MIME[ext]) fail(`Onbekend afbeeldingstype voor ${card.external_id}: ${card.image}`);
    const body = await readFile(file).catch(() => fail(`Afbeelding niet gevonden: content/${card.image}`));
    const target = `${userId}/${card.external_id}${ext}`;
    const { error } = await admin.storage.from("card-images").upload(target, body, { contentType: MIME[ext], upsert: true });
    if (error) fail(`Upload mislukt voor ${card.image}: ${error.message}`);
    paths.set(card.external_id, target);
  }
  return paths;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) fail("Gebruik: npm run import -- [--dry-run] <pad-naar-json>");

  const text = await readFile(file, "utf8").catch(() => fail(`Bestand niet gevonden: ${file}`));
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    fail(`Geen geldige JSON: ${(e as Error).message}`);
  }

  const parsed = parseImport(raw);
  if (!parsed.ok) fail(`Validatie mislukt; er is niets geïmporteerd (${parsed.errors.length} fouten):`, parsed.errors);
  const bundle = parsed.bundle;

  const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = env("ALLOWED_EMAIL").trim().toLowerCase();
  const userId = await findUserId(admin, email);

  const existing = await loadExisting(admin, userId);
  const refErrors = checkReferences(bundle, existing);
  if (refErrors.length) fail(`Verwijzingen kloppen niet; er is niets geïmporteerd (${refErrors.length} fouten):`, refErrors);

  const plan = planImport(bundle, existing);
  const imageCount = bundle.cards.filter((c) => c.image).length;

  if (dryRun) {
    console.log(`\nDry run voor ${file} (${email}). Er is niets opgeslagen.\n`);
    console.log(formatSummary(summarize(plan, bundle, existing, imageCount ? [`${imageCount} afbeelding(en) zouden worden geüpload.`] : [])));
    return;
  }

  const writable = new Set(plan.filter((r) => r.kind === "cards" && r.outcome !== "skipped").map((r) => r.external_id));
  const imagePaths = await uploadImages(admin, userId, bundle, writable);
  const results = await applyImport(admin, bundle, { userId, imagePaths }).catch((e: Error) => fail(e.message));

  console.log(`\nGeïmporteerd: ${file} (${email})\n`);
  console.log(formatSummary(summarize(results, bundle, existing, imagePaths.size ? [`${imagePaths.size} afbeelding(en) geüpload.`] : [])));
}

main().catch((e) => fail((e as Error).message));
