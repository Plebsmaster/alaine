# CLAUDE.md — PA Studie-app

## Wat dit is

Een persoonlijke studie-app voor de master Physician Assistant (HU, cohort 2026, specialisatie dermatologie). Eén gebruiker, gebruikt op laptop en telefoon. De app is gebouwd rond bewezen leermethoden; die zijn het product, niet de techniek.

Lees `docs/SPEC.md` voordat je iets bouwt. Bouw fase voor fase en rond elke fase af met de acceptatiecriteria.

## Stack

- Next.js 16, App Router, TypeScript (strict), Server Components en Server Actions
- Tailwind CSS; componenten mogen van shadcn/ui komen
- Supabase: Postgres, Auth (magic link), Storage; `@supabase/ssr` voor sessies in Next.js
- `ts-fsrs` (v5) voor het plannen van herhalingen
- `@anthropic-ai/sdk` voor AI-functies, alleen server-side
- `zod` voor alle validatie van import en AI-output
- Vitest voor unit tests; Playwright voor één end-to-end rooktest per fase
- Hosting op Vercel; Supabase in regio eu-central-1

## Niet-onderhandelbare principes

Dit zijn de regels uit het leeronderzoek. Een feature die ze breekt, bouw je niet.

1. **Eerst ophalen, dan pas zien.** Een antwoord, uitwerking of AI-feedback is nooit zichtbaar voordat de gebruiker zelf een antwoord heeft gegeven of bewust op "Toon antwoord" drukt.
2. **FSRS plant, de gebruiker niet.** Geen handmatige "herhaal over X dagen". Alle planning via `lib/fsrs.ts`.
3. **Gemengd herhalen.** De dagelijkse wachtrij mengt thema's. Nooit standaard per thema in een blok.
4. **AI maakt alleen concepten.** Alles wat AI genereert krijgt `status = 'draft'` en komt pas na goedkeuring in de herhaalstapel.
5. **AI geeft hints en feedback, geen kant-en-klare antwoorden** vóór de gebruiker heeft geantwoord. Zie `docs/AI_PROMPTS.md`.
6. **AI werkt vanuit de bron.** Elke AI-aanroep krijgt de relevante brontekst of uitwerking mee.
7. **Echte cijfers boven gevoel.** Toon retentie en zwakke plekken uit het logboek, geen motiverende schattingen.
8. **Fouttype is analyse, geen planning.** FSRS krijgt altijd de eerlijke beoordeling, ook bij een slordigheidsfout.
9. **Het geheugen zit in de database, niet in de chat.** AI-functies krijgen bij elke beurt de relevante fouten en items uit de database mee.
10. **Bron of extern.** De AI markeert alles wat niet uit de bron komt (`needs_verification`). Doseringen, contra-indicaties en richtlijnadviezen alleen uit de bron, en dan ook altijd gemarkeerd.
11. **Bij een fout eerst een hint en een herstelvraag**, pas daarna de volledige uitleg (`explain_check`).

## Taal en UI

- Alle UI-tekst in het Nederlands. Code, tabellen en variabelen in het Engels.
- Mobile first: duimvriendelijke knoppen onderin, minimaal 44 px hoog. Op laptop sneltoetsen: spatie = omdraaien, 1–4 = beoordelen.
- Beoordelingsknoppen: Opnieuw, Moeilijk, Goed, Makkelijk, elk met het volgende interval eronder (via `fsrs.repeat`).
- Rustig, leesbaar ontwerp; lichte en donkere modus.
- Ontwerp: volg docs/design/README.md (variant b · Herzien). Tokens in app/globals.css; geen losse hexkleuren in componenten.

## Privacy en beveiliging

- Row Level Security op elke tabel: een gebruiker ziet alleen eigen rijen (`user_id = auth.uid()`).
- Inloggen alleen voor het adres in `ALLOWED_EMAIL`; controleer dat server-side.
- `SUPABASE_SERVICE_ROLE_KEY` en `ANTHROPIC_API_KEY` alleen server-side, nooit in clientcode.
- Geen patiëntgegevens. Toon bij het aanmaken van een casus vanuit stage een korte melding: "Schrijf geanonimiseerd: geen naam, geboortedatum of herkenbare details."
- `content/` staat in `.gitignore`, behalve `content/README.md` en `content/voorbeeld-import.json`.

## Structuur

```
app/
  (auth)/login/
  (app)/vandaag/          dagelijkse herhaling (startpagina)
  (app)/goedkeuren/       concepten nakijken en goedkeuren
  (app)/thema/[id]/       thema-overzicht, leerdoelen, dekking
  (app)/scripts/          illness scripts
  (app)/casussen/         casusmodus
  (app)/oefentoets/       pretest en proeftoets
  (app)/overzicht/        dashboard
  (app)/instellingen/
  api/ai/                 AI-routes (server only)
lib/
  fsrs.ts                 enige plek waar ts-fsrs wordt aangeroepen
  queue.ts                opbouw van de dagelijkse wachtrij
  supabase/{client,server}.ts
  ai/{client,prompts,schemas}.ts
  import/{schema,importer}.ts
scripts/import.ts         lokaal importscript (service role)
supabase/migrations/
```

## Commando's

- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`
- `npm run test:e2e`: Playwright-rooktest tegen de lokale Supabase (`supabase start`), met eigen testgebruiker `e2e@pa-studie.test` op een eigen server (poort 3100); raakt de data van de student niet. Wist de voorbeeldmodule van de testgebruiker
- `npm run import -- [--dry-run] <pad-naar-json>`: importeert een bestand volgens `docs/IMPORT_FORMAT.md`
- `npm run db:types`: `lib/supabase/database.types.ts` opnieuw genereren na een migratie (lokale stack)
- Migraties: `supabase link` en `supabase db push`, of via de Supabase MCP als die verbonden is

## Stand en afspraken in de code

- Alle fases (0–6) uit SPEC zijn gebouwd. Uit `docs/AANVULLING_01_COACH.md` zijn A1, A2, A3, A7 en de stopcheck gebouwd (zie de statustabel bovenin dat document); A4, A5, A6, coachmodus en B1 nog niet. `explain_check` (A3) schrijft de nakijkstappen mee in `review_logs.ai_feedback`, en het fouttype in `review_logs.error_type`, via `rate_card` (migraties 0004 en 0005).
- AI-functies end-to-end testen kan zonder echte key: `tests/e2e/ai.spec.ts` start een nagebootste Messages-API (zie docs/SETUP.md).
- Offline (fase 6): `public/sw.js` bewaart app-bestanden en `/vandaag`; `lib/offline/idb.ts` houdt de wachtrij van vandaag en een uitgaande rij beoordelingen in IndexedDB. Zolang de rij niet leeg is, wint de lokale stand van de wachtrij van de server. Uitloggen wist beide. In Playwright omzeilt de service worker `setOffline`; de offline-test blokkeert daarom ook via `context.route`.
- Overzicht: rekenwerk in `lib/dashboard.ts` (puur, getest), data in `lib/data/dashboard.ts`. Grafiekkleur `--chart` is gevalideerd met de dataviz-validator.
- Oefentoets: selectie en score per leerdoel in `lib/exam.ts` (puur, getest). Pretest en proeftoets sturen geen modelantwoorden of juiste opties naar de browser vóór antwoorden of inleveren (`pretestAnswerAction`, `submitExamAction`).
- Import gebeurt in één transactie, dus geïmporteerde rijen hebben dezelfde `created_at`: sorteer daarna op `external_id` om de volgorde uit het bestand te houden.
- Casussen: selectie in `lib/cases.ts` (puur, getest). De sessiepagina stuurt alleen titel, vignet en vraag naar de browser; differentiaal en expert-uitwerking komen pas via server actions (`revealAlternativesAction` in stap 3, `revealExpertAction` na stap 4).
- AI: `lib/ai/client.ts` (`runJson`: structured output met zod, één herkansing, logging in `ai_usage`), prompts in `lib/ai/prompts.ts`, schema's in `lib/ai/schemas.ts`. Modellen via `ANTHROPIC_MODEL` en `ANTHROPIC_MODEL_FAST`. Zonder key tonen de schermen een melding in plaats van een knop die faalt.
- Illness scripts: `approve_illness_script` (migratie 0003) zet het script actief en maakt per gevuld veld één conceptkaart (`cards.script_field`), idempotent.
- Next.js 16: `proxy.ts` (vroeger middleware), async `params`/`searchParams`/`cookies()`. Lees `AGENTS.md`.
- Database: schrijfacties die samen moeten slagen lopen via Postgres-functies in `supabase/migrations/`: `rate_card` (planning + log, idempotent per reviewmoment), `approve_card`, `import_bundle` (hele importbestand in één transactie). Allemaal `security invoker`, dus RLS geldt.
- Views met `security_invoker`: `review_queue` (wachtrij), `topic_card_counts`, `objective_coverage`.
- Elke pagina en Server Action begint met `requireUser()` uit `lib/auth.ts` (controleert ook `ALLOWED_EMAIL`).
- Inloggen gaat met een code uit de mail (`verifyOtp`), zodat het ook werkt in de PWA op het beginscherm; de link in de mail werkt via `/auth/confirm`.
- Het herhaalscherm rekent intervallen op de client uit voor de weergave; de server rekent bij opslaan opnieuw vanaf de stand in de database.

## Werkwijze

- Kleine commits per onderdeel, met een duidelijke boodschap.
- Schrijf eerst tests voor `lib/fsrs.ts`, `lib/queue.ts` en de importer; die moeten kloppen.
- Twijfel je over een keuze die de leermethode raakt, vraag het dan in plaats van te gokken.

@AGENTS.md
