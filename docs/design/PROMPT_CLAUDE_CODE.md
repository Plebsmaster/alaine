# Instructie voor Claude Code

## Voorbereiden (eenmalig, zelf doen)

1. Pak de zip uit en zet de map in je repo als **`docs/design/`**: dus `docs/design/README.md`, `docs/design/globals.css`, `docs/design/designs/…`. Zet hem niet in `content/`, want die map staat in `.gitignore`.
2. Commit dit als "Ontwerp herzien toegevoegd".
3. Start Claude Code in de projectmap en geef de prompts hieronder **één voor één**. Test na elke stap zelf op laptop én telefoon voordat je verdergaat, zoals bij de fases.

---

## Stap 0 · Lezen en plannen

```
Lees docs/design/README.md helemaal, en daarna CLAUDE.md, AGENTS.md en docs/SPEC.md.
Open de ontwerpen in docs/design/designs/ als referentie; het zijn HTML-ontwerpen, geen code om te kopiëren.
Bouw niets. Geef me:
1. per stap hieronder welke bestanden je aanpast of toevoegt;
2. waar het ontwerp botst met de principes in CLAUDE.md of met bestaande tests;
3. welke e2e-tests (tests/e2e/) je moet aanpassen omdat navigatie of teksten veranderen.
Voeg aan CLAUDE.md onder "Taal en UI" toe: "Ontwerp: volg docs/design/README.md (variant b · Herzien). Tokens in app/globals.css; geen losse hexkleuren in componenten."
```

## Stap 1 · Tokens, fonts en basiscomponenten

```
Volg docs/design/README.md, sectie "Design tokens" en "Basiscomponenten".
- Vervang app/globals.css door docs/design/globals.css.
- Laad Atkinson Hyperlegible Next en Newsreader via next/font in app/layout.tsx (variabelen --font-atkinson en --font-newsreader) en zet themeColor op #f5f4ef / #121412.
- Werk components/ui.tsx bij (Button, Panel, Badge, Field, Input, Textarea, Select, Notice met tone "warn") en voeg Segmented, Eyebrow, Kbd en ProgressSegments toe.
- Gebruik overal Tailwind-klassen met de tokens; geen hexwaarden in componenten.
Klaar als: npm run lint, typecheck en test slagen; elke bestaande pagina rendert zonder fouten in licht en donker.
```

## Stap 2 · Shell en focusmodus

```
Volg docs/design/README.md, secties "1b · App-shell en navigatie" en "Focusmodus".
- Vervang SideNav door de bovenbalk met vier werkruimtes en subnav; vervang BottomNav door Vandaag, Leren, Studiestof, Inzicht. Pas components/nav-links.ts aan.
- Instellingen via de knop rechts; Uitloggen verhuist naar /instellingen; /meer stuurt door naar /themas.
- Maak de route group voor de focusmodus (zonder navigatie) en verplaats de herhaalsessie, /casussen/sessie, /oefentoets/proeftoets en /oefentoets/pretest/[topicId]. URL's blijven gelijk; requireUser() blijft in elke layout en pagina.
- Bouw de Thema's-pagina (/themas) in het nieuwe rasterontwerp.
Klaar als: alle routes bereikbaar zijn op laptop en telefoon; de juiste werkruimte actief is; e2e-tests aangepast zijn en slagen.
```

## Stap 3 · Vandaag en sessie-einde

```
Volg docs/design/README.md, secties "1f · Vandaag" en "1h · Sessie-einde en stopcheck".
Verander alleen de presentatie in app/(app)/vandaag/*: wachtrij, offline-opslag, FSRS, fouttypes (A1) en nakijken (A3) blijven zoals ze zijn.
- Focusheader met Stoppen, segmentvoortgang en opslaanstatus.
- Jouw antwoord naast het antwoord; AI-strook; dock met beoordelingen, sneltoetsnummers en het label "AI-voorstel".
- Sessie-einde met verdelingsbalk, retentie, morgen, fouttypes en "Om te onthouden".
Klaar als: principe 1 (eerst ophalen) en 11 (eerst hint) aantoonbaar gelden; sneltoetsen werken; herhalen in vliegtuigmodus werkt nog (tests/e2e/offline.spec.ts); alle tests slagen.
```

## Stap 4 · Overzicht en thema

```
Volg docs/design/README.md, secties "1j · Overzicht" (inclusief de ColumnChart-wijzigingen) en "1l · Thema-pagina".
- Overzicht: kopzin met retentie tegenover settings.desired_retention, Per thema met doelstreep, Aandacht nodig, Werklast; de bestaande tabel en de studietijd onder "Alle cijfers per thema".
- Thema: tabbladen via ?tab=, leerdoelen met "+ Kaart maken" (formulier met leerdoel aangevinkt), Volgende stap (pretest), Concepten, Bronnen.
Klaar als: geen cijfer verdwijnt dat nu op het overzicht staat; tests voor lib/dashboard.ts slagen; de pretestkaart alleen verschijnt als er nog open pretestvragen zijn.
```

## Stap 5 · Goedkeuren (eerst vragen)

```
Volg docs/design/README.md, sectie "1n · Goedkeuren".
Vraag mij eerst toestemming voor de schemawijziging (cards.source_excerpt, migratie 0008) en laat me de aanpassing aan de draft_cards-prompt zien voordat je hem doorvoert.
Daarna:
- Triagelayout met lijst, bronpaneel en editor; sneltoetsen A / L / X en ↑/↓; telefoon één concept tegelijk zonder onderbalk.
- Een citaat dat niet letterlijk in de brontekst staat → needs_verification = true.
- Bulk-goedkeuren alleen voor casussen en vragen.
Klaar als: goedkeuren, later en afwijzen werken zoals nu (rewritten, card_schedule); de AI-tests (tests/ai.test.ts, tests/e2e/ai.spec.ts) bijgewerkt zijn en slagen; IMPORT_FORMAT.md en AI_PROMPTS.md bijgewerkt zijn.
```

## Stap 6 · Illness scripts vergelijken

```
Volg docs/design/README.md, sectie "1p · Illness scripts vergelijken".
Onderscheidende kenmerken eerst; aandoeningen toevoegen en verwijderen via de URL (max 4); Lezen/Overhoren via ?modus=; afgedekte cellen alleen als clientstate. Telefoon: per veld.
Klaar als: twee tot vier scripts naast elkaar staan; Overhoren werkt met muis en toetsenbord; "Vergelijkingskaart (AI)" werkt zoals nu.
```

## Stap 7 · Casussen

```
Volg docs/design/README.md, sectie "1r · Casussen-sessie".
Vervang stap 2 tot 4 op laptop door de reflectietabel met slepen én ↑/↓-knoppen; telefoon blijft stapsgewijs. Expert, zelfscore en "Wat miste je" in de nieuwe stijl.
Behoud: revealAlternativesAction pas op verzoek (cued = true), revealExpertAction pas na rangschikken, maximaal 3 hints, saveAttemptAction met dezelfde velden.
Klaar als: een sessie van 3 casussen af te ronden is op laptop en telefoon; tests/cases.test.ts en tests/e2e/cases.spec.ts slagen.
```

## Stap 8 · Oefentoets

```
Volg docs/design/README.md, sectie "1t · Oefentoets".
- Resultaat: per leerdoel eerst, rechts de foute vragen met fouttype en "Maak kaart van deze vraag".
- Toets maken en pretest: één vraag per scherm met vraagoverzicht (telefoon en laptop).
- Startpagina /oefentoets in de nieuwe stijl.
Behoud: geen juiste opties of modelantwoorden naar de browser vóór inleveren of antwoorden.
Klaar als: tests/exam.test.ts en tests/e2e/exam.spec.ts slagen; de score per leerdoel overeenkomt met scoreByObjective.
```

## Stap 9 · Inloggen

```
Volg docs/design/README.md, sectie "1d · Inloggen".
Gesplitst scherm op laptop; codestap met zes vakjes, gebouwd als één input met autoComplete="one-time-code", zodat plakken en iOS-autofill werken. Controleer otp_length in supabase/config.toml.
Klaar als: inloggen op laptop en telefoon (ook als PWA op het beginscherm) werkt; een ander e-mailadres nog steeds geweigerd wordt; tests/e2e/smoke.spec.ts slaagt.
```

## Stap 10 · Donkere modus en afronding

```
Loop alle schermen na in donkere modus. De donkere tokens in app/globals.css zijn afgeleid en niet ontworpen: controleer of tekst minstens 4,5:1 contrast heeft en pas tokens aan waar nodig (niet per component).
Draai lint, typecheck, test en test:e2e. Werk README.md bij met een korte sectie "Ontwerp" die naar docs/design/README.md verwijst.
```
