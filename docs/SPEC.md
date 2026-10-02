# Specificatie — PA Studie-app

Versie 1 · 2 oktober 2026

## 1. Doel

Een persoonlijke webapp waarmee een PA-student in opleiding de stof van de master Physician Assistant leert met de best onderbouwde methode: successive relearning (overhoren met feedback, gespreid met FSRS), aangevuld met illness scripts, casussen met gestructureerde reflectie en interleaving. De app werkt op laptop en telefoon met dezelfde data.

**Succes betekent:** de gebruiker herhaalt dagelijks 15 tot 30 minuten, ziet per thema en leerdoel waar hij staat, en hoeft voor een toets niet te stampen.

## 2. Gebruiker en context

- Eén gebruiker: werkt naast de studie en reist veel. Korte sessies op de telefoon zijn het hoofdgebruik; kaarten nakijken en casussen gebeuren vaker op de laptop.
- Opleiding: master PA (HU), jaar 1 modules: PA de eerste stap, Interne geneeskunde, Chirurgie, Spoedeisende hulp. Daarnaast leerlijnen farmacotherapie, vaardigheden en wetenschap.
- Module 1 heeft zes thema's: geneeskundig proces, ritmestoornissen, KNO, lage rugklachten, bloeddruk en hypertensie, dermatologie. Plus practica lichamelijk onderzoek.

## 3. Begrippen

| Begrip | Betekenis |
| --- | --- |
| Kaart | Eén vraag met antwoord, gepland door FSRS. Types: `fact`, `explain`, `illness_script`, `compare`, `image`, `skill`, `communication` |
| Illness script | Eén aandoening in vast format: epidemiologie, pathofysiologie, presentatie, bevindingen, beleid, onderscheidende kenmerken, gelijkende aandoeningen |
| Casus | Een vignet met werkdiagnose, gestructureerde reflectie en expert-uitwerking. Niet door FSRS gepland, maar wekelijks geoefend |
| Vraag | Pretestvraag of toetsvraag (meerkeuze of open), voor pretest en proeftoets |
| Concept | Alles met `status = 'draft'`; nog niet goedgekeurd, dus niet in herhaling |
| Retentie | Aandeel herhalingen in staat Review dat niet met "Opnieuw" is beoordeeld |

## 4. Schermen

| Route | Scherm | Hoofdgebruik |
| --- | --- | --- |
| `/vandaag` | Dagelijkse herhaling (startpagina) | Telefoon |
| `/goedkeuren` | Concepten nakijken, herschrijven, goedkeuren | Laptop |
| `/thema/[id]` | Thema: leerdoelen, dekking, kaarten, scripts, casussen | Beide |
| `/scripts` | Illness scripts bekijken, bewerken, vergelijken | Beide |
| `/casussen` | Casusmodus | Laptop |
| `/oefentoets` | Pretest per thema en gemengde proeftoets | Beide |
| `/overzicht` | Dashboard | Beide |
| `/instellingen` | Retentie, nieuwe kaarten per dag, import, export | Laptop |

Navigatie: onderbalk op telefoon (Vandaag, Casussen, Overzicht, Meer), zijbalk op laptop. Op `/vandaag` staat bovenaan het aantal kaarten voor vandaag en de geschatte tijd.

## 5. Kernlogica

### 5.1 Planning met FSRS (`lib/fsrs.ts`)

- Gebruik `ts-fsrs` v5: `fsrs(generatorParameters({ request_retention, enable_fuzz: true, enable_short_term: true }))`.
- `request_retention` komt uit `settings.desired_retention` (standaard 0,90; instelbaar 0,80–0,97 met waarschuwing boven 0,90 dat de werklast snel stijgt).
- Als `settings.fsrs_params` gevuld is, gebruik die als gewichten (`w`).
- Functies:
  - `newSchedule(now)`: `createEmptyCard(now)` → rij in `card_schedule` bij goedkeuren.
  - `preview(schedule, now)`: `f.repeat(...)` → interval per knop, voor de labels onder de knoppen.
  - `rate(schedule, rating, now)`: `f.next(...)` → nieuwe `card_schedule` + rij in `review_logs` (alle velden uit `log`, plus `duration_ms`, `answer_text`, `session_id`).
- Opslaan van schema en log in één transactie: een Postgres-functie `rate_card(...)` via RPC, of een Server Action die beide schrijft en bij een fout terugdraait.
- Unit tests: nieuwe kaart + Goed geeft learning-stap; Opnieuw verhoogt `lapses` in Review; retentie 0,95 geeft kortere intervallen dan 0,90.

### 5.2 Dagelijkse wachtrij (`lib/queue.ts`)

1. **Te herhalen:** actieve kaarten met `due <= eind van vandaag` (tijdzone uit settings), oudste eerst.
2. **Nieuw:** actieve kaarten met `state = 0` en `reps = 0`, maximaal `max_new_per_day` min het aantal nieuwe dat vandaag al is gestart.
3. **Mengen:** voeg samen en interleave zodat geen twee opeenvolgende kaarten uit hetzelfde thema komen, waar dat kan. Nieuwe kaarten worden verspreid door de sessie, niet allemaal aan het eind.
4. **Binnen de sessie:** kaarten die na "Opnieuw" of een learning-stap binnen de sessie due worden, komen terug in de rij op hun due-tijd.
5. **Volgorde van nieuwe kaarten:** om en om verdeeld over de thema's, zodat alle thema's tegelijk starten (keuze van de student, 2 oktober 2026). In elke ronde komen thema's met een naderende toetsdatum eerst; binnen een thema de volgorde van de leerdoelen. Raakt een thema op, dan vullen de andere aan.

Unit tests voor mengen, limiet nieuwe kaarten en tijdzonegrens.

### 5.3 Herhaalscherm

1. Toon de voorkant. Bij `explain`, `illness_script` en `compare` staat er een optioneel tekstveld: "Typ je antwoord (optioneel)".
2. Knop "Toon antwoord" (spatie). Toon achterkant, uitleg, afbeelding en bron met paginanummer.
3. Bij een getypt antwoord: knop "Feedback van AI" (zie `docs/AI_PROMPTS.md`, `explain_feedback`). Alleen na het tonen van het antwoord.
4. Vier knoppen met interval eronder: Opnieuw, Moeilijk, Goed, Makkelijk (toetsen 1–4).
5. Menu per kaart: bewerken, schorsen, "klopt niet" (zet terug naar concept met notitie).
6. Einde sessie: aantal kaarten, tijd, retentie van deze sessie, en wat er morgen klaarstaat.

### 5.4 Concepten goedkeuren

- Lijst per thema van alle concepten (kaarten, scripts, casussen, vragen), met bron en leerdoel.
- Per kaart: voor- en achterkant direct bewerkbaar. Boven het formulier de tip: "Zet het in je eigen woorden; dat onthoud je beter."
- Knoppen: Goedkeuren (status `active`, `rewritten = true` als de tekst is gewijzigd, maak `card_schedule`), Afwijzen (verwijderen), Later.
- Bulk-goedkeuren alleen voor casussen en vragen, niet voor kaarten.
- Teller bovenaan: aantal concepten per type.

### 5.5 Illness scripts en vergelijken

- Formulier met de vaste velden uit `illness_scripts`.
- Bij goedkeuren van een script worden er automatisch kaarten van type `illness_script` aangemaakt, als concept, met `illness_script_id` gezet:
  - "Wat is de typische presentatie van {condition}?" → `presentation`
  - "Wat is de pathofysiologie van {condition}?" → `pathophysiology`
  - "Hoe stel je {condition} vast?" → `findings`
  - "Wat is het beleid bij {condition}?" → `management`
  - Velden die leeg zijn leveren geen kaart op.
- Vergelijken: kies twee of meer scripts uit `similar_conditions` of binnen een thema en toon ze naast elkaar. Knop "Maak vergelijkingskaart" vraagt AI om een `compare`-concept (zie `docs/AI_PROMPTS.md`).

### 5.6 Casusmodus

Sessie van 3 tot 5 casussen, gemengd over thema's. Selectie: eerst nooit geoefende, dan laagste laatste score, dan langst geleden geoefend; geen casus die korter dan 7 dagen geleden is gedaan.

Per casus:

1. **Vignet lezen** en een werkdiagnose typen.
2. **Reflectietabel** voor de werkdiagnose: wat past erbij, wat spreekt het tegen, wat zou je verwachten maar ontbreekt.
3. **Alternatieven:** de gebruiker voegt alternatieve diagnoses toe en vult per alternatief dezelfde drie kolommen in. Knop "Toon mogelijke alternatieven" laat de differentiaal uit `expert_reflection` zien zonder uitwerking (`cued = true`); onderzoek laat zien dat dit beter werkt dan helemaal vrij.
4. **Rangschikken** van de diagnoses.
5. **Vergelijken met de expert:** toon `expert_reflection` en `teaching_points`, en vraag AI-feedback (`case_feedback`).
6. **Zelfscore** 1–5 en "Was je diagnose juist?".
7. Knop "Maak kaart van wat ik miste": opent een conceptkaart met de feedback als startpunt.

Hulp tijdens stap 1–4: knop "Hint" (`case_hint`), maximaal drie per casus, telt in `hints_used`.

Stagecasussen: knop "Nieuwe casus uit stage" met de anonimiseringsmelding; `from_internship = true`, status direct `active`.

### 5.7 Pretest en proeftoets

- **Pretest:** bij de start van een thema 8–10 vragen (`kind = 'pretest'`). Open beantwoorden, daarna direct het modelantwoord. Geen score in beeld, alleen "je hebt er X geprobeerd". Doel is voorbereiden, niet beoordelen.
- **Proeftoets:** gemengd over gekozen thema's (`kind = 'exam'`), in het formaat van de echte toets (meerkeuze en/of open). Resultaat per leerdoel; foute antwoorden kunnen met één klik een conceptkaart worden.

### 5.8 Dashboard

- Per thema: actieve kaarten, concepten, due vandaag, retentie laatste 30 dagen, laatste casusscore.
- Leerdoelendekking: leerdoelen zonder actieve kaart of casus vallen op.
- Werklast komende 14 dagen (aantal due per dag), als staafdiagram.
- Dagen tot elke toetsdatum.
- Lastige kaarten: `lapses >= 4` (in Anki heten dit "leeches"), met de tip ze te herschrijven of op te splitsen.
- Studiestreak en minuten per dag uit `study_sessions`.

### 5.9 Import en export

- Import van JSON volgens `docs/IMPORT_FORMAT.md`, via `/instellingen` (upload) en via `npm run import`. `npm run import -- --dry-run <pad>` valideert alleen en schrijft niets.
- Idempotent: upsert op `(user_id, external_id)`. Opnieuw importeren werkt bestaande concepten bij, maar overschrijft nooit kaarten die al `active` zijn; die worden als conflict gemeld.
- Na import een samenvatting: per thema aantallen nieuw, bijgewerkt, overgeslagen.
- Export: één JSON-bestand met alle tabellen van de gebruiker, inclusief `review_logs`.

## 6. AI-functies

Alle AI-aanroepen lopen via `app/api/ai/*` met de server-side `ANTHROPIC_API_KEY`. Prompts, invoer en uitvoerschema's staan in `docs/AI_PROMPTS.md`. Uitvoer altijd valideren met zod; bij ongeldige uitvoer één nieuwe poging, daarna een nette foutmelding.

| Functie | Wanneer | Model |
| --- | --- | --- |
| `draft_cards` | Gebruiker plakt brontekst bij een thema | `ANTHROPIC_MODEL` |
| `draft_script` | Gebruiker kiest een aandoening en plakt brontekst | `ANTHROPIC_MODEL` |
| `draft_compare` | Vanuit vergelijken van scripts | `ANTHROPIC_MODEL` |
| `draft_cases` | Gebruiker vraagt casussen bij een thema | `ANTHROPIC_MODEL` |
| `draft_questions` | Pretest- of toetsvragen bij een thema | `ANTHROPIC_MODEL` |
| `explain_feedback` | Na een getypt antwoord op een kaart | `ANTHROPIC_MODEL_FAST` |
| `case_hint` | Hint tijdens een casus | `ANTHROPIC_MODEL_FAST` |
| `case_feedback` | Na afronden van een casus | `ANTHROPIC_MODEL` |

Gebruik bijhouden: log per aanroep het aantal tokens in een eenvoudige tabel of in de serverlogs, zodat de kosten zichtbaar blijven.

## 7. Niet-functioneel

- **Snelheid:** `/vandaag` interactief binnen 1,5 seconde op 4G. Beoordelen voelt direct (optimistische update, opslaan op de achtergrond, opnieuw proberen bij een fout).
- **PWA:** web-manifest en iconen, zodat de app op het beginscherm van de telefoon kan. Offline herhalen is fase 6.
- **Toegankelijkheid:** goed contrast, focus zichtbaar, alles met toetsenbord te bedienen.
- **Beveiliging:** RLS op alle tabellen (migratie `0001_init.sql`); inloggen alleen voor `ALLOWED_EMAIL`.
- **Data:** Supabase in eu-central-1; geen patiëntgegevens.

## 8. Fases en acceptatiecriteria

### Fase 0: fundament
- Next.js-project, Tailwind, Supabase-clients, magic-link login met `ALLOWED_EMAIL`, migratie toegepast, PWA-manifest, deploy op Vercel.
- **Klaar als:** inloggen werkt op laptop en telefoon met hetzelfde account; een ander e-mailadres wordt geweigerd.

### Fase 1: herhalen
- Modules, thema's, leerdoelen en kaarten beheren (eenvoudige formulieren).
- Import van JSON (upload en script). `lib/fsrs.ts`, `lib/queue.ts`, herhaalscherm, sneltoetsen, sessie-einde.
- **Klaar als:** `content/voorbeeld-import.json` importeert zonder fouten; na goedkeuren verschijnen kaarten in `/vandaag`; een beoordeling op de telefoon is direct zichtbaar op de laptop; tests voor fsrs, queue en importer slagen.

### Fase 2: concepten en AI
- `/goedkeuren`, `draft_cards`, `explain_feedback`, leerdoelendekking op `/thema/[id]`.
- **Klaar als:** geplakte tekst levert concepten op die pas na goedkeuren in de herhaling komen; AI-feedback is pas beschikbaar na het tonen van het antwoord.

### Fase 3: illness scripts
- `/scripts`, automatische scriptkaarten, vergelijken, `draft_script`, `draft_compare`.
- **Klaar als:** een goedgekeurd script levert per gevuld veld één conceptkaart op; twee scripts staan naast elkaar.

### Fase 4: casusmodus
- Volledige flow uit 5.6, `case_hint`, `case_feedback`, `draft_cases`, stagecasussen.
- **Klaar als:** een sessie van 3 casussen uit verschillende thema's is af te ronden; de expert-uitwerking is pas zichtbaar na stap 4; "Maak kaart van wat ik miste" werkt.

### Fase 5: pretest en proeftoets
- `/oefentoets`, `draft_questions`, resultaat per leerdoel.
- **Klaar als:** een pretest is te maken vóór een thema; een proeftoets mengt thema's en toont per leerdoel de score.

### Fase 6: overzicht, export en offline
- `/overzicht` volgens 5.8, JSON-export, offline herhalen (wachtrij van vandaag in IndexedDB, beoordelingen in een uitgaande rij die synchroniseert zodra er verbinding is).
- **Klaar als:** herhalen in vliegtuigmodus werkt en na herverbinden staan alle beoordelingen in de database.

### Later
- FSRS-parameters optimaliseren op basis van `review_logs` zodra er genoeg herhalingen zijn.
- Pdf direct uploaden naar AI in de app (nu loopt dat via de contentpipeline in Claude Code).
- Afbeeldingskaarten met occlusie (delen van een plaat afdekken).
