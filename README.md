# PA Studie-app — start hier

Dit pakket is alles wat Claude Code nodig heeft om je studie-app te bouwen: een Next.js-webapp met Supabase die je op je laptop en telefoon gebruikt. De leermethode komt uit het leerplan: overhoren met feedback, gespreid herhalen met FSRS, illness scripts, casussen met gestructureerde reflectie en interleaving.

## Stand van zaken

| Fase | Wat | Status |
| --- | --- | --- |
| 0 | Fundament: Next.js, Supabase, inloggen met code (alleen `ALLOWED_EMAIL`), PWA | Gebouwd |
| 1 | Herhalen: beheer, import, FSRS, dagelijkse wachtrij, herhaalscherm, sneltoetsen | Gebouwd |
| 2 | Goedkeuren met AI-concepten (`draft_cards`) en AI-feedback (`explain_feedback`) | Gebouwd |
| 3 | Illness scripts: scriptkaarten bij goedkeuren, naast elkaar vergelijken, `draft_script`, `draft_compare` | Gebouwd |
| 4 | Casusmodus: sessies, reflectietabel, hints, expert-vergelijking, stagecasussen, `case_hint`, `case_feedback`, `draft_cases` | Gebouwd |
| 5 | Pretest en proeftoets: resultaat per leerdoel, foute antwoorden als kaart, `draft_questions` | Gebouwd |
| 6 | Overzicht, export en offline herhalen | Gebouwd |
| Aanvulling 01 | Fouttypes, ketenkaarten, hint en herstelvraag, controleren tegenover de bron, stopcheck | Gebouwd; coachmodus, varianten, vermoeidheid, stoplicht en gesprekken nog niet (zie `docs/AANVULLING_01_COACH.md`) |
| Herontwerp | Ontwerp variant b (`docs/design/`): shell met vier werkruimtes, alle schermen, donkere modus gecontroleerd | Gebouwd (stap 0–10) |

Getest met een lokale Supabase: 90 unit tests (FSRS, wachtrij, importer, casusselectie, toetsselectie en score per leerdoel, overzichtscijfers, brondeel bij AI-kaarten, vergelijken, AI-laag met een nagebootste API) en rooktests in de browser voor alle fases, waaronder herhalen in vliegtuigmodus. Alle AI-functies zijn end-to-end getest tegen een nagebootste Anthropic-API (`tests/e2e/ai.spec.ts`), nog niet tegen de echte. De studiestof zelf ontbreekt nog; die komt via `content/` en de contentpipeline.

## Wat er in deze repo zit

| Bestand of map | Waarvoor |
| --- | --- |
| `CLAUDE.md` | Projectinstructies die Claude Code bij elke sessie automatisch leest |
| `docs/SPEC.md` | Functionele en technische specificatie, per fase met acceptatiecriteria |
| `docs/SETUP.md` | Stappenplan voor Supabase, Vercel, je telefoon en lokaal ontwikkelen |
| `docs/IMPORT_FORMAT.md` | Het JSON-formaat waarmee studiestof in de app komt |
| `docs/AI_PROMPTS.md` | De AI-functies, hun prompts en de vangrails |
| `docs/CONTENT_PIPELINE.md` | Hoe Claude Code van jouw pdf's en leerdoelen importbestanden maakt |
| `docs/AANVULLING_01_COACH.md` | Coachprincipes: fouttypes, ketenkaarten, hint vóór uitleg, controleren; met status per onderdeel |
| `docs/design/` | Het ontwerp: tokens, schermen en gedrag (`README.md`), de ontwerpbestanden en de bouwprompts |
| `supabase/migrations/` | Databaseschema met beveiliging per gebruiker, plus functies voor import en herhalen |
| `supabase/templates/` | E-mailsjablonen met inlogcode, om in Supabase te plakken |
| `app/`, `components/`, `lib/` | De app zelf |
| `scripts/import.ts` | Lokaal importscript (`npm run import`) |
| `tests/` | Unit tests en de rooktest |
| `content/README.md` | Waar je je studiestof neerzet |
| `content/voorbeeld-import.json` | Een klein voorbeeldbestand om de import mee te testen |

## Ontwerp

Het ontwerp staat in [`docs/design/README.md`](docs/design/README.md) (variant b · Herzien): de design tokens, de basiscomponenten en per scherm de laptop- en telefoonversie. De tokens staan in `app/globals.css` als Tailwind-klassen (`bg-surface`, `text-muted`, `bg-accent-soft`); gebruik die, geen losse hexkleuren. Lettertypes: Atkinson Hyperlegible Next (tekst) en Newsreader (koppen en kaarttekst).

- Vier werkruimtes: Vandaag, Leren, Studiestof, Inzicht. Herhalen, casussessie, proeftoets en pretest draaien in een focusmodus zonder navigatie.
- Licht en donker volgen de systeeminstelling. De lichte kleuren zijn ontworpen; de donkere zijn afgeleid en gecontroleerd op contrast (alle tekst minstens 4,5:1).
- Nieuwe schermen of onderdelen: volg eerst `docs/design/README.md`; daar staat ook wat elk scherm níet mag tonen (zoals antwoorden vóór het ophalen).

## Stap 1: regel dit zelf

Volg `docs/SETUP.md`. In het kort:

1. **GitHub**: deze repository. Controleer onder Settings dat hij **privé** is.
2. **Supabase**: nieuw project in regio **Frankfurt (eu-central-1)**, migraties uitvoeren, e-mailsjablonen met code instellen, en na je eerste login nieuwe aanmeldingen uitzetten.
3. **Vercel**: repository koppelen en de omgevingsvariabelen invullen.
4. **Anthropic API-key** (console.anthropic.com) voor de AI-functies. Pas nodig vanaf fase 2.

## Stap 2: maak `.env.local` aan (deel deze nooit in een chat of commit)

Kopieer `.env.example` naar `.env.local` en vul het in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # alleen voor het lokale importscript
ANTHROPIC_API_KEY=<api-key>                    # vanaf fase 2
ANTHROPIC_MODEL=claude-sonnet-5-5
ANTHROPIC_MODEL_FAST=claude-haiku-4-5-20251001
ALLOWED_EMAIL=<jouw-e-mailadres>               # alleen dit adres kan inloggen
```

Claude Code leest dit bestand zelf; je hoeft de keys niet in de chat te plakken.

## Stap 3: zet je studiestof in `content/`

Zie `content/README.md`. Kort: per thema een map met de leerdoelen en de hoofdstukken of slides als pdf. De map `content/` staat in `.gitignore`, zodat boekstof nooit op GitHub komt.

## Stap 4: bouw in fases met deze prompts

Start Claude Code in de projectmap en geef per fase één prompt. Test na elke fase zelf op laptop én telefoon voordat je verdergaat.

**Fase 0 en 1: basis en herhalen**: gebouwd. Test zelf:
1. Inloggen op laptop en telefoon met hetzelfde adres; een ander adres wordt geweigerd.
2. **Instellingen → Studiestof importeren** met `content/voorbeeld-import.json`.
3. **Goedkeuren**: zet de drie kaarten in je eigen woorden en keur ze goed.
4. **Vandaag**: herhaal op je telefoon en kijk of de laptop het direct ziet.
5. Verwijder daarna de module "VOORBEELD" via **Thema's**.

**Fase 3: illness scripts**: gebouwd. Test zelf:
1. **Illness scripts → Nieuw script**: maak een script, vul een paar velden en kies **Opslaan en goedkeuren**. Per gevuld veld (presentatie, pathofysiologie, bevindingen, beleid) staat er een conceptkaart op **Goedkeuren**.
2. Vink twee goedgekeurde scripts aan en kies **Vergelijk geselecteerde**.
3. Met een `ANTHROPIC_API_KEY`: laat een script maken uit geplakte brontekst, en maak vanuit het vergelijkscherm een vergelijkingskaart. Beide komen binnen als concept.

**Fase 2: goedkeuren en AI-concepten**
```
Bouw fase 2 uit docs/SPEC.md. Gebruik de prompts en vangrails uit docs/AI_PROMPTS.md.
```

**Studiestof omzetten (kan parallel aan fase 2)**
```
Volg docs/CONTENT_PIPELINE.md voor thema <naam> in content/module-1/.
Maak het importbestand en laat me de samenvatting zien voordat je importeert.
```

**Fase 4: casusmodus**: gebouwd. Test zelf:
1. Zet casussen klaar: importeer ze, laat ze maken door AI (vanaf twee goedgekeurde scripts per thema), of schrijf er zelf een. Keur ze goed op **Goedkeuren** (meerdere tegelijk kan).
2. **Casussen → Start sessie**: werkdiagnose, reflectie, alternatieven, rangschikken, vergelijken met de expert, zelfscore, en een kaart van wat je miste.
3. **Nieuwe casus uit stage**: geanonimiseerd, en direct actief.

**Fase 5: pretest en proeftoets**: gebouwd. Test zelf:
1. Zet vragen klaar (importeren, door AI laten maken, of zelf schrijven via **Oefentoets → Nieuwe vraag**) en keur ze goed op **Goedkeuren**.
2. **Pretest** bij een thema dat je nog moet bestuderen: na elke vraag het modelantwoord, geen score.
3. **Proeftoets**: kies thema's en het aantal vragen, lever in, kijk open vragen zelf na en bekijk de score per leerdoel. Van een fout antwoord maak je met één klik een conceptkaart.

**Fase 6: overzicht, export en offline**: gebouwd. Test zelf:
1. **Overzicht**: per thema actieve kaarten, concepten, vandaag te doen, retentie over 30 dagen en de laatste casusscore; leerdoelen zonder dekking; werklast voor 14 dagen; dagen tot de toets; lastige kaarten; streak en minuten per dag.
2. **Offline**: open Vandaag één keer met verbinding, zet je telefoon in vliegtuigmodus en herhaal. Na herverbinden worden je beoordelingen vanzelf opgeslagen. De rest van de app vraagt verbinding.
3. **Export**: Instellingen → Download export.

**Fase 2: AI-concepten en AI-feedback**: gebouwd. Test zelf (met `ANTHROPIC_API_KEY`):
1. Op een themapagina: **Kaarten laten maken uit brontekst (AI)**. De kaarten komen als concept op Goedkeuren.
2. Op Vandaag bij een uitleg- of ketenkaart: typ je antwoord en kies **Nakijken**. Klopt het, dan zie je het antwoord met een vervolgvraag; klopt het niet, dan eerst een hint en een herstelvraag, en pas daarna de uitleg. De voorgestelde beoordeling is gemarkeerd; je kiest zelf.

**Aanvulling 01**: test zelf:
1. Na **Opnieuw** of **Moeilijk** vraagt de app wat er misging (Wist ik niet, Redenering fout, Slordig of moe). Overslaan mag. Het overzicht toont de verdeling per thema.
2. Een **ketenkaart** maak je met type "Keten"; bij herhalen typ je de stappen met de pijlknop en zie je daarna jouw keten naast de juiste.
3. AI-concepten die niet uit de bron komen (of een dosering bevatten) krijgen het label **Controleren**; filter erop in Goedkeuren.
4. Aan het eind van een herhaalsessie met fouten: **Stopcheck**.

**Volgende stap**: studiestof omzetten met `docs/CONTENT_PIPELINE.md` zodra je de stof hebt.

## Wat je níet deelt

- Keys in de chat of in Git (alleen in `.env.local` en in Vercel).
- Patiëntgegevens. Stagecasussen schrijf je altijd geanonimiseerd.
- Boek-pdf's in Git. Ze blijven lokaal in `content/`.
