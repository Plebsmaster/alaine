# Handoff: PA Studie, herontwerp variant b (Herzien)

## Overzicht

Herontwerp van alle schermen van de PA Studie-app (`Plebsmaster/alaine`) voor een rustig, professioneel studiehulpmiddel. De gekozen richting is overal **variant b · Herzien**: nieuwe navigatie in vier werkruimtes, een focusmodus voor herhalen, casussen en proeftoetsen, en schermen die de leermethode uit `CLAUDE.md` zichtbaarder maken (eerst ophalen, echte cijfers, bron naast AI-concepten).

De principes in `CLAUDE.md` blijven leidend. Waar dit ontwerp een principe lijkt te breken, wint `CLAUDE.md` en vraag je het na.

## Over de ontwerpbestanden

De bestanden in `designs/` zijn **ontwerpreferenties in HTML**: ze laten zien hoe het eruit moet zien en wat het moet doen, maar het is geen productiecode. Bouw de schermen opnieuw op in de bestaande stack van de repo (Next.js 16 App Router, React Server Components, Tailwind CSS v4, de componenten in `components/ui.tsx`) en volg daarbij de patronen die er al zijn. Kopieer geen inline styles uit de HTML; vertaal ze naar Tailwind-klassen met de tokens uit `globals.css`.

Open de ontwerpen in een browser (bestand openen; `support.js` moet ernaast staan). Elk bestand toont per scherm een laptopframe (1280 × 800) en een telefoonframe (390 × 844). Optie a is verborgen; zet in een bestand de prop `options` op "Beide" om a ter vergelijking te zien.

## Fidelity

**High-fidelity.** Kleuren, typografie, maten, afstanden en teksten zijn definitief voor de lichte modus. Bouw ze zo exact mogelijk na. Uitzonderingen:
- Donkere modus is **niet ontworpen**; de donkere tokens in `globals.css` zijn afgeleid. Controleer contrast.
- Alle medische inhoud, aantallen en bronnen in de ontwerpen zijn voorbeelddata. Gebruik echte data uit de database.
- Laptopframes zijn op 1280 breed ontworpen. Onder `md` (768 px) geldt het telefoonontwerp.

## Wat er verandert, in het kort

| Onderdeel | Ontwerp | Wat er anders is |
| --- | --- | --- |
| Shell | 1b | Zijbalk wordt bovenbalk met 4 werkruimtes + subnavigatie. Telefoon: Vandaag, Leren, Studiestof, Inzicht. `/meer` vervalt. |
| Focusmodus | 1f, 1h, 1r, 1t | Nieuwe layout zonder navigatie voor herhalen, casussessie en toets maken. |
| Inloggen | 1d | Gesplitst scherm met de leerprincipes; code in 6 vakjes. |
| Vandaag | 1f | Jouw antwoord naast het juiste; beoordelingsbalk vast onderin met sneltoets en AI-voorstel. |
| Sessie-einde | 1h | Verdeling van beoordelingen, fouttypes, "Om te onthouden". |
| Overzicht | 1j | Retentie per thema tegenover `desired_retention`; één lijst "Aandacht nodig". |
| Thema | 1l | Tabbladen per thema; pretest als volgende stap. |
| Goedkeuren | 1n | Triage: lijst, bron naast concept, sneltoetsen A / L / X. **Vraagt een schemawijziging** (zie 1n). |
| Scripts vergelijken | 1p | Onderscheidend eerst; overhoormodus met afgedekte cellen. |
| Casussen | 1r | Stap 2–4 samen in één reflectietabel met slepen. |
| Oefentoets | 1t | Resultaat per leerdoel eerst; telefoon één vraag per scherm. |

---

## Design tokens

Alle tokens staan in `globals.css` (drop-in vervanging van `app/globals.css`, Tailwind v4 `@theme inline`). Gebruik ze als Tailwind-klassen: `bg-surface`, `text-muted`, `border-border-strong`, `bg-accent-soft`, enz.

### Kleur (licht)

| Token | Hex | Gebruik |
| --- | --- | --- |
| `--bg` | #F5F4EF | Paginagrond |
| `--surface` | #FFFFFF | Panelen, kaarten, bovenbalk, onderbalk |
| `--surface-2` | #EEEDE6 | Chips, "jouw antwoord", segmented-track, balksporen |
| `--surface-sunk` | #FBFAF7 | Subnavigatie, bronpaneel, vignetpaneel, footer-dock |
| `--text` | #1A1C19 | Hoofdtekst |
| `--text-2` | #3E413B | Secundaire tekst met hoog contrast |
| `--muted` | #5C5F58 | Labels, meta (≈ 6:1 op wit) |
| `--faint` | #8A8C85 | Alleen iconen en sleepgrepen, nooit leestekst |
| `--border` | #E1DFD6 | Paneelranden |
| `--border-subtle` | #EEEDE6 | Scheidingslijnen binnen panelen |
| `--border-strong` | #D2D0C6 | Invoervelden, secundaire knoppen |
| `--border-dashed` | #A9A79D | Gestippelde placeholders (+ Aandoening, na te kijken) |
| `--accent` | #2F6F62 | Primaire knop, actief, voortgang gedaan |
| `--accent-strong` | #1F5248 | Tekst op `--accent-soft` |
| `--accent-soft` | #E3EEEA | Actief item, AI-strook, selectie |
| `--accent-mid` | #9CC4B8 | Huidige stap in voortgang |
| `--accent-deep` | #1F4A41 | Inlogpaneel, "Volgende stap"-kaart |
| `--on-deep` / `--on-deep-2` / `--on-deep-muted` / `--on-deep-accent` | #FFFFFF / #E4F0EC / #CFE3DC / #8FCBB9 | Tekst op `--accent-deep` |
| `--highlight` | #DCEBE5 | Markering in brontekst |
| `--warn-bg` / `--warn-text` / `--warn-text-strong` | #FBF1DC / #7A5300 / #3E2C00 | Controleren, hints, na te kijken |
| `--danger` / `--danger-soft` | #B3261E / #F4D9D6 | Geen dekking, fout, afwijzen |
| `--again` `--hard` `--good` `--easy` | #B3261E #9A6700 #2F6F62 #2D5F9A | Beoordelingen (ongewijzigd) |
| `--focus` | #2D5F9A | Focusring (ongewijzigd) |
| `--chart` | #1BAF7A | Kolommen in grafieken (ongewijzigd) |
| `--err-1/2/3` | #3E413B / #8A8C85 / #C9C7BD | Fouttypes kennis / redenering / slordig |

Kleur betekent iets: beoordeling, dekking, controleren, fout. Gebruik geen kleur als decoratie.

### Typografie

Twee families via `next/font/google` in `app/layout.tsx`:

```tsx
import { Atkinson_Hyperlegible_Next, Newsreader } from "next/font/google";

const sans = Atkinson_Hyperlegible_Next({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-atkinson", display: "swap" });
const serif = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-newsreader", display: "swap" });

// <html lang="nl" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
```

Is `Atkinson_Hyperlegible_Next` niet beschikbaar in de geïnstalleerde Next-versie, gebruik dan `@fontsource/atkinson-hyperlegible-next` met dezelfde CSS-variabele.

- **Newsreader** (`font-serif`, gewicht 500): leestekst en titels. Kaartvragen, vignetten, scriptcellkoppen, paginatitels, grote cijfers in zinnen.
- **Atkinson Hyperlegible Next** (`font-sans`): alle interface. Labels, knoppen, cijfers.
- Cijfers altijd `tabular-nums`.

| Rol | Familie | Grootte / regelhoogte | Gewicht | Overig |
| --- | --- | --- | --- | --- |
| Display (sessie-einde, toetsresultaat) | serif | 44–52 / 1.05 (tel. 36 / 1.08) | 500 | |
| Kopzin overzicht | serif | 40 / 1.1 | 500 | |
| Paginatitel | serif | 34–42 / 1.1 (tel. 28–32) | 500 | |
| Kaartvraag, focusmodus | serif | 38 / 1.2 (tel. 22–26 / 1.25) | 500 | `text-wrap: pretty` |
| Kaartvoorkant in formulier | serif | 18–20 / 1.35–1.4 | 400 | |
| Vignet, brontekst | serif | 17–18 / 1.6–1.65 | 400 | |
| Sectietitel | sans | 15–17 | 700 | |
| Body | sans | 15–16 / 1.5–1.55 | 400 | |
| Klein, meta | sans | 13–14 / 1.45 | 400 | `text-muted` |
| Eyebrow | sans | 11–12 | 700 | HOOFDLETTERS, `tracking-[.08em]`, `text-muted` |
| Statcijfer | sans | 26–32 | 700 | `tabular-nums` |

### Maten

- **Afstanden**: 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 48, 56 px.
- **Radius**: chips en pillen `rounded-full`; kleine tags en sneltoetslabels 5–8; knoppen en invoer 10 (telefoon primair 12); panelen 14; grote panelen en kaarten 16.
- **Hoogtes**: knoppen ≥ 44 (`min-h-11`); primaire telefoonknop 54–56; beoordelingsknop telefoon 58, laptop 68; bovenbalk 60; focusheader 64; subnav 48; onderbalk 60 + `env(safe-area-inset-bottom)`.
- **Schaduw**: geen in de app. Vlakken scheiden met randen. Alleen de actieve segmented-knop krijgt `0 1px 2px rgb(0 0 0 / .06)`.
- **Focus**: bestaande `:focus-visible`-ring behouden. Actieve invoer krijgt daarnaast `border-2 border-accent`.

### Basiscomponenten (`components/ui.tsx`)

- `buttonClass`: `rounded-[10px] min-h-11 px-4 text-[15px] font-medium`. Primary `bg-accent text-accent-text font-bold`. Secondary `bg-surface border border-border-strong`. Ghost `text-text-2 hover:bg-surface-2`. Danger: `text-danger` zonder rand (tekstknop).
- `Panel`: `rounded-2xl border border-border bg-surface p-5 md:p-6`.
- `Badge` → chip: `rounded-full bg-surface-2 text-text-2 text-xs md:text-[13px] px-2.5 py-0.5`, geen rand. Variant `warn`: `bg-warn-bg text-warn-text font-bold`. Variant `accent`: `bg-accent-soft text-accent-strong`.
- `Field`-label: `text-[13px] md:text-sm font-bold`. Hint: `text-xs text-muted`.
- `Input`/`Textarea`/`Select`: `rounded-[10px] border border-border-strong bg-surface px-3.5 text-base`; focus `border-2 border-accent`.
- `Notice`: info `bg-surface-2 rounded-[10px] px-3.5 py-2.5 text-sm text-text-2`, geen rand. ok `bg-accent-soft text-accent-strong border border-accent`. warn (nieuw) `bg-warn-bg text-warn-text-strong`. error ongewijzigd qua betekenis.
- Nieuw `Segmented`: track `bg-surface-2 rounded-xl p-1 gap-1 grid grid-flow-col auto-cols-fr`; item `h-[38px] rounded-[9px] text-sm`; actief `bg-surface font-bold shadow-[0_1px_2px_rgb(0_0_0/.06)]`.
- Nieuw `Eyebrow`: `text-xs font-bold uppercase tracking-[.08em] text-muted`.
- Nieuw `Kbd`: `text-[11px] border border-border rounded-[5px] px-1.5 text-muted` (op primair: `border-white/40 text-white/80`).
- Nieuw `ProgressSegments` (zie 1f).

---

## Schermen

Paden verwijzen naar de bestaande repo. "Laptop" = `md:` en groter.

### 1b · App-shell en navigatie
Ontwerp: `designs/01-shell-inloggen.dc.html` (1b). Bronnen: `components/nav.tsx`, `components/nav-links.ts`, `app/(app)/layout.tsx`, `app/(app)/meer/page.tsx`, `app/(app)/themas/page.tsx`.

**Informatiearchitectuur** (vervangt `MAIN` en `MORE_LINKS`):

| Werkruimte | Routes | Subnav |
| --- | --- | --- |
| Vandaag | `/vandaag` | geen |
| Leren | `/casussen*`, `/oefentoets*` | Casussen · Oefentoets |
| Studiestof | `/themas`, `/thema/*`, `/scripts*`, `/goedkeuren`, `/kaart/*` | Thema's · Illness scripts · Goedkeuren {n} |
| Inzicht | `/overzicht` | geen |

`/instellingen` hoort bij geen werkruimte en is bereikbaar via de knop rechts in de bovenbalk (laptop) of rechtsboven in de paginakop (telefoon). Uitloggen verhuist naar Instellingen. `/meer` stuurt door naar `/themas`.

**Laptop, bovenbalk** (`h-[60px] bg-surface border-b border-border px-7 flex items-stretch gap-9`):
- Merk: blok 30 × 30, `rounded-lg bg-accent`, "PA" 11/700 wit; daarnaast "PA Studie" 15/700. Link naar `/vandaag`.
- Tabs: `px-3.5 text-[15px] text-muted flex items-center`. Actief: `text-text font-bold shadow-[inset_0_-2px_0_var(--accent)]`. Bij Vandaag een teller (te doen vandaag) `bg-accent text-white text-xs font-bold px-[7px] py-px rounded-full`, alleen als > 0.
- Rechts (`ml-auto gap-3.5`): chip "Toets {module} · {n} dagen" voor de eerstvolgende toetsdatum (`text-[13px] text-text-2 bg-bg border border-border px-3 py-1.5 rounded-full`), daarna een ronde knop 34 × 34 `bg-surface-2` met schuifjesicoon → `/instellingen` (`aria-label="Instellingen"`).

**Laptop, subnav** (alleen Leren en Studiestof; `h-12 bg-surface-sunk border-b border-border px-7 flex items-center gap-1.5`): items `px-3 py-1.5 rounded-lg text-sm text-text-2`; actief `bg-accent-soft text-accent-strong font-bold`. Goedkeuren toont het aantal concepten (`text-xs font-bold text-muted`).

**Laptop, inhoud**: gecentreerde kolom `max-w-[1120px] mx-auto px-6 pt-8`. De smalle `max-w-3xl` vervalt; formulieren en lijsten krijgen hun eigen maximale breedte waar nodig (720–820).

**Telefoon, onderbalk** (`fixed inset-x-0 bottom-0 bg-surface border-t border-border pb-[env(safe-area-inset-bottom)]`, `grid grid-cols-4 h-[60px]`):
- Vandaag (vinkje `M4 12l5 5L20 6`), Leren (`M3 8l9-4 9 4-9 4-9-4zM7 10v5c1.5 1.5 3 2 5 2s3.5-.5 5-2v-5`), Studiestof (`M6 3h9l3 3v15H6zM9 11h6M9 15h6`), Inzicht (`M5 20V10M12 20V4M19 20v-7`).
- Icoon 22 px, stroke 1.9 (actief 2.2). Label 11 px. Actief `text-accent font-bold`, anders `text-muted`.
- Teller op Vandaag: `absolute top-1.5 left-[56%] text-[10px] font-bold text-white bg-accent px-[5px] rounded-full`.
- Een tab gaat naar de eerste pagina van de werkruimte (Leren → `/casussen`, Studiestof → `/themas`).

**Telefoon, werkruimtewissel**: bovenaan Leren- en Studiestofpagina's een `Segmented` met de subnav-items (Studiestof: Thema's · Scripts · Goedkeuren {n}, teller als witte pil op accent). Paginakop: titel serif 32 + ronde instellingenknop 40 × 40 rechts.

**Thema's-pagina in deze shell (laptop)**: eyebrow "MODULE {n} · STUDIEJAAR {j}", titel serif 34 met modulenaam, rechts "Toets {datum} · **over {n} dagen**" (14, `text-text-2`) en secundaire knop "Module bewerken" (opent de bestaande formulieren in een dialoog of `<details>`). Thema's als raster `grid-cols-3 gap-4`. Kaart: `rounded-[14px] border bg-surface px-[22px] py-5 min-h-[150px] flex flex-col gap-3.5`:
- naam serif 23/1.2; rechtsboven pil "{due} vandaag" (`text-xs font-bold text-accent-strong bg-accent-soft px-[9px] py-[3px] rounded-full`);
- "{active} actieve kaarten · {draft} concept" 14 `text-muted`;
- onderaan dekkingsbalk `h-1.5 rounded bg-surface-2` met vulling `bg-accent` (breedte = gedekte / totale leerdoelen uit `objective_coverage`) en "{c}/{n} leerdoelen gedekt" 13 `text-text-2`.
Telefoon: één kaartlijst in een paneel, per rij naam 16/500 + "{active} actief" rechts + balk h-[5px] met "{c}/{n}".

### Focusmodus (nieuw, geldt voor 1f, 1h, 1r, 1t, telefoon-1n)
Een layout zonder bovenbalk, zijbalk of onderbalk. Maak een route group (bijv. `app/(focus)/`) met een eigen layout die wel `requireUser()` aanroept, en verplaats daarheen: de herhaalsessie, `/casussen/sessie`, `/oefentoets/proeftoets`, `/oefentoets/pretest/[topicId]`. URL's blijven gelijk.

- `/vandaag`: focusmodus zodra er een wachtrij of resultaat is. Zonder kaarten ("Niets te herhalen vandaag") geldt de gewone shell.
- **Stoppen** (×): met resultaten → sessie-einde (1h); zonder resultaten → `/overzicht`.
- Goedkeuren op de telefoon verbergt alleen de onderbalk (het scherm heeft een eigen actiebalk); op laptop blijft de shell.

### 1d · Inloggen
Ontwerp: `designs/01-shell-inloggen.dc.html` (1d). Bron: `app/(auth)/login/login-form.tsx`, `page.tsx`.

**Laptop** (`md:grid md:grid-cols-[560px_1fr] min-h-dvh`):
- Links `bg-accent-deep text-on-deep px-14 py-12 flex flex-col`: merk (blok `bg-white text-accent-deep`). Onderaan (`mt-auto gap-7`): eyebrow "MASTER PHYSICIAN ASSISTANT · HU" (`text-on-deep-muted tracking-[.1em]`); kop serif 48/1.08 "Eerst ophalen, dan pas zien."; drie regels 16/1.45 `text-on-deep-2`, nummers 01–03 700 `text-on-deep-accent`:
  1. FSRS plant je herhalingen; jij plant niets.
  2. Thema's worden door elkaar gehaald, zoals op de toets.
  3. AI maakt alleen concepten; jij keurt goed.
- Rechts, gecentreerd `w-[380px] flex flex-col gap-[26px]`: stappenindicator (cirkels 24, huidig `bg-accent text-white`, volgend `border-[1.5px] border-border-strong text-muted`, verbindingslijn 32 × 1) "1 E-mail · 2 Code"; titel serif 36 "Inloggen"; veld "E-mailadres" (h-[50px]); primaire knop h-[50px] "Stuur inlogcode"; "Alleen het vastgelegde adres kan inloggen." 14 `text-muted`.
- In de codestap toont de rechterkant het telefoonontwerp hieronder.

**Telefoon** (linkerpaneel verborgen):
- E-mailstap: zelfde velden, knoppen onderin (`px-6 pb-[34px]`).
- Codestap: terugknop "‹ E-mailadres" (15/500 `text-accent`, h-11; zelfde gedrag als "Ander e-mailadres of nieuwe code"); titel serif 34 "Vul je code in"; "We stuurden een code van zes cijfers naar **{email}**." 16/1.5 `text-text-2`; zes vakjes `grid grid-cols-6 gap-2`, elk `h-[62px] rounded-xl bg-surface border-[1.5px] border-border-strong text-[28px] font-medium`, actief vak `border-2 border-accent` met cursor; hint 14 `text-muted` "Werkt ook in de app op je beginscherm. Je kunt ook op de link in de mail tikken."; onderin primair h-[54px] "Inloggen" en tekstknop "Nieuwe code sturen".
- **Belangrijk**: bouw de vakjes als **één** `<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d*">` die visueel als zes vakjes wordt getoond (transparante input over het raster). Zo blijven plakken en iOS-autofill werken. Controleer de codelengte in `supabase/config.toml` (`otp_length`).

### 1f · Vandaag (herhalen)
Ontwerp: `designs/02-vandaag-sessie-einde.dc.html` (1f). Bronnen: `app/(app)/vandaag/review-session.tsx`, `answer-check.tsx`, `chain.tsx`, `components/error-chips.tsx`. Logica (wachtrij, offline, FSRS, A1/A3) blijft ongewijzigd; alleen de presentatie verandert.

**Laptop, header** (`h-16 px-7 flex items-center gap-7`, op `bg-bg`):
- Links knop "Stoppen" met ×-icoon 16 (`h-10 px-3 rounded-[10px] border border-border bg-surface text-sm text-text-2`).
- Midden (`flex-1 max-w-[640px] mx-auto flex items-center gap-3.5`): `ProgressSegments`, een segment per kaart in de sessie (`grid gap-[3px]`, segment `h-1.5 rounded-sm`): gedaan `bg-accent`, huidig `bg-accent-mid`, rest `bg-border`. Bij meer dan 40 kaarten: één doorlopende balk `h-1.5 rounded`. Daarnaast "{huidig} / {totaal}" 14/700 tabular. Kaarten die binnen de sessie terugkomen tellen niet als nieuw segment; ze verschijnen als huidig op hun oorspronkelijke plek of het totaal groeit; kies wat eerlijk is en vermeld het in de PR.
- Rechts opslaanstatus 13 `text-muted` met vinkje 14 `text-accent` "Opgeslagen". Bestaande toestanden en teksten van `SaveStatus` blijven ("Opslaan…", "Offline · {n} beoordelingen wachten op verbinding", fout in `text-danger` met "opnieuw proberen").

**Laptop, inhoud** (kolom `w-[820px] mx-auto pt-7 flex flex-col gap-[22px]`):
- Rij: eyebrow "{THEMA} · {TYPE}"; rechts de bestaande ⋯-menuknop (Bewerken, Schorsen, Klopt niet).
- Vraag: serif 38/1.2 500, `prose-card`, `text-wrap: pretty`.
- `needs_verification`: chip warn "Controleren" + `VERIFY_TEXT` 13 `text-warn-text`.
- **Vóór tonen**, bij typed types (`explain`, `chain`, `illness_script`, `compare`): tekstvak `min-h-[120px] rounded-xl p-3.5 px-4 text-base leading-[1.55]` met hint 13 `text-muted` "Optioneel. Typen helpt ophalen; de AI kijkt na vóór je het antwoord ziet." Ketenkaart: `ChainInput` in dezelfde stijl.
- **A3 herstel** (stap 1 niet goed): zie telefoonontwerp; op laptop in dezelfde kolom.
- **Na tonen**: raster `grid-cols-2 gap-3.5`:
  - "JOUW ANTWOORD" (`bg-surface-2 rounded-[14px] px-5 py-[18px]`; label 11/700 `tracking-[.07em] text-muted`; tekst 16/1.55 `text-text-2`).
  - "ANTWOORD" (`bg-surface border border-border rounded-[14px] px-5 py-[18px]`; label `text-accent-strong`; achterkant 16/1.55; daaronder "Bron: {source_label}" 12 `text-muted`).
  - Zonder getypt antwoord: alleen het antwoordvak, volle breedte. Ketenkaart: `ChainCompare` op de plaats van beide.
  - Uitleg (`card.explanation`) 15 `text-muted` onder het raster; afbeelding `max-h-80 rounded-xl border`.
- **AI-strook** (als `check.steps` bestaan): `flex gap-4 px-[18px] py-3.5 rounded-[14px] bg-accent-soft text-[15px] leading-normal`; label "AI" 11/700 `text-accent-strong`; daarnaast de uitkomsttekst (bestaande `CheckOutcome`-teksten) en "**Denk verder:** {follow_up}" in `text-text-2`.

**Laptop, dock onderin** (`border-t border-border bg-surface-sunk pt-4 pb-7`, binnenkolom 820):
- Vóór tonen: twee knoppen `grid-cols-2 gap-2.5 h-[54px] rounded-xl`: primair "Nakijken" met `Kbd` "⌘ ↵" (alleen als AI aan staat en er tekst is), secundair "Toon antwoord" met `Kbd` "spatie". Zonder AI of tekst: één primaire knop "Toon antwoord".
- Na tonen: `grid-cols-4 gap-2.5`, per knop `h-[68px] rounded-xl bg-surface border border-border-strong px-4 flex items-center gap-3`: `Kbd`-blok 24 × 24 met 1–4; label 15/700 in de beoordelingskleur (`text-again`, `text-hard`, `text-good`, `text-easy`); interval eronder 13 `text-muted` in lange vorm ("<10 min", "1 dag", "3 dagen").
- **AI-voorstel** (`check.last.result.suggested_rating`): die knop krijgt `bg-accent-soft border-2 border-accent`, het `Kbd`-blok `bg-accent text-white`, en een label "AI-voorstel" (`absolute -top-2.5 right-2.5 text-[11px] font-bold bg-accent text-white px-[7px] py-0.5 rounded-full`). `aria-describedby` blijft.
- Fouttype (na Opnieuw/Moeilijk): het dock toont "Wat ging er mis?" met de drie chips + Overslaan (`ErrorChips` in dezelfde knopstijl, sneltoetsen 1–3, Enter).

**Telefoon**:
- Header: knop × 44 × 44; `ProgressSegments` (`gap-0.5 h-[5px]`); "{n}/{totaal}" 13/700.
- Inhoud `px-5 pt-3 gap-4`: eyebrow 11; vraag serif 26/1.25.
- A3 herstel (het getoonde telefoonframe): "JOUW ANTWOORD"-vak (`bg-surface-2 rounded-xl px-3 py-2.5`, tekst 14); coachpaneel `bg-surface border rounded-[14px] p-4 gap-3`: titel 16/700 "Deels goed. Probeer het met een hint." of "Nog niet goed. Probeer het met een hint."; label "HINT" 11/700 `text-hard` + hint 15/1.5; herstelvraag als veldlabel 15/700; tekstvak `min-h-[84px]`.
- Onderin (`px-5 pb-[34px]`): primair `h-14 rounded-xl text-[17px]` "Nakijken" en tekstknop h-11 "Toon antwoord".
- Na tonen: vakken onder elkaar; daarna beoordelingsrij `grid-cols-4 gap-1.5`, knop `h-[58px] rounded-xl border-2` in beoordelingskleur, label 14/700, interval 12 `text-muted`. AI-voorstel: `bg-accent-soft` + ring `0 0 0 2px var(--bg), 0 0 0 4px var(--focus)`.

### 1h · Sessie-einde en stopcheck
Ontwerp: `designs/02-vandaag-sessie-einde.dc.html` (1h). Bronnen: `SessionEnd` in `review-session.tsx`, `stopcheck.tsx`.

**Laptop** (focuslayout):
- Header: merk links (link naar `/overzicht`), voortgang helemaal gevuld "{totaal} / {totaal}", rechts "Alles opgeslagen" (of de bestaande opslaanstatus).
- Inhoud `w-[1080px] mx-auto pt-9 grid grid-cols-[1fr_440px] gap-14`.
- Links (`gap-7`):
  - eyebrow "{WEEKDAG D MAAND} · SESSIE KLAAR";
  - kop serif 52/1.05 "{n} kaarten in {m} minuten.";
  - verdelingsbalk `flex h-3.5 rounded-[7px] overflow-hidden gap-0.5`, segmenten met `flex-grow` = aantal per beoordeling in `bg-again/hard/good/easy`; legenda 14 tabular met blokje 10 × 10 `rounded-[3px]`: "Opnieuw 2 · Moeilijk 2 · Goed 11 · Makkelijk 3";
  - twee statkaarten `grid-cols-2 gap-3` (`rounded-[14px] border bg-surface px-5 py-[18px]`, label 13 muted, waarde 32/700, noot 13 muted):
    - "Retentie deze sessie", "{x}%", "{k} van {n} herhalingen niet met Opnieuw". Zonder herhalingen: "–" en "Retentie telt alleen kaarten die al in herhaling waren."
    - "Morgen klaar", "{due}", "herhalingen en tot {fresh} nieuwe kaarten". Tijdens tellen "bezig met tellen…", offline "wordt geteld zodra je weer online bent".
  - Fouttypes: label 13/700 `text-text-2` "Wat ging er mis bij Opnieuw en Moeilijk"; chips 14 `px-3 py-1.5 rounded-full bg-surface border` "Wist ik niet · {n}", "Redenering fout · {n}", "Slordig of moe · {n}". Alleen tonen als er fouten waren.
- Rechts, stopcheckkaart (`rounded-2xl border bg-surface p-6 gap-4 self-start`):
  - titel serif 26 "Om te onthouden"; sub 14 muted "Uit je {n} fouten van vandaag. Schrijf zelf de vraag; de kaart komt op Goedkeuren.";
  - nog geen punten: knop "Wat moet ik onthouden?" (bestaand gedrag);
  - punten: `border-t border-border-subtle py-3.5 flex gap-3.5`, nummer serif 22 `text-accent w-[18px]`, tekst 15/1.5, actie "Maak kaart →" 14/700 `text-accent` die inline het formulier opent (veld "Vraag (voorkant)", hint "Zet het in je eigen woorden: een vraag die het antwoord afdwingt.", knop "Opslaan als concept"); klaar: vinkje + "Conceptkaart gemaakt; staat op Goedkeuren." `text-accent`;
  - zonder AI: lijst van voorkanten (bestaande fallback) onder dezelfde titel;
  - onderaan primair `h-[52px] rounded-xl w-full` "Klaar" → `/overzicht`.
- Wachttoestand "Even pauze": bestaande tekst, gecentreerd in de focuslayout.

**Telefoon**: zelfde volgorde onder elkaar; kop serif 36; legenda `grid-cols-2`; stats `grid-cols-2 gap-2`; stopcheckkaart; vaste knop "Klaar" `h-14` onderin.

### 1j · Overzicht
Ontwerp: `designs/03-overzicht-thema.dc.html` (1j). Bronnen: `app/(app)/overzicht/page.tsx`, `components/column-chart.tsx`, `lib/dashboard.ts`, `lib/data/dashboard.ts`.

**Laptop** (shell, Inzicht actief; `max-w-[1120px] pt-8 gap-6`):
- Koprij: eyebrow "AFGELOPEN 30 DAGEN"; zin serif 40/1.1 "Retentie {r}%, bij een doel van {d}%." (`d = settings.desired_retention × 100`; zonder herhalingen: "Nog geen herhalingen in de afgelopen 30 dagen."). Rechts inline 14 muted met vette waarden 18: "{n} herhalingen", "{streak} dagen streak", "{min} min vandaag".
- Raster `grid-cols-[1fr_400px] gap-5`.
- **Links, Per thema** (`rounded-2xl border bg-surface px-6 py-5`):
  - kopregel `grid-cols-[210px_1fr_90px] gap-5 text-xs font-bold text-muted`: "Thema" · as · "Leerdoelen". As `relative h-4` met "70%" links, "doel {d}%" gecentreerd op de doelpositie, "100%" rechts;
  - rij `py-[13px] border-t border-border-subtle`: naam 15/700 + advies 12 muted (`errorAdvice`, of "{n} leerdoelen zonder dekking");
  - spoor `relative h-[22px]`: lijn `top-2.5 h-[3px] rounded bg-surface-2`; doelstreep `w-0.5 h-[18px] bg-text/35` op de doelpositie; stip 14 × 14 `rounded-full border-2 border-white` met ring 1px in dezelfde kleur (`bg-accent` als r ≥ doel, anders `bg-hard`), links op de retentiepositie (−7 px); waarde 13/700 tabular in dezelfde kleur, 14 px rechts van de stip;
  - schaal: `pos(x) = (x − min) / (100 − min)`, `min = 70`, of lager (naar beneden afgerond op 10) als een thema onder 70 zit. Thema zonder herhalingen: geen stip, "–";
  - rechterkolom "{c}/{n}" 14 tabular (dekking leerdoelen).
- **Rechts**:
  - "Aandacht nodig" (`rounded-2xl border bg-surface px-[22px] py-5`): rijen `py-2.5 border-t border-border-subtle flex gap-3`, stip 8 (`bg-danger` voor leerdoel zonder dekking, `bg-hard` voor lastige kaart), tekst 14/1.4 ("**{code}** {omschrijving}" of de voorkant), meta 12 muted ("{thema} · geen kaart of casus" of "{thema} · {lapses}× vergeten · herschrijf of splits"). Eerst leerdoelen, dan lastige kaarten; maximaal 6, daarna "Alles bekijken". Rijen linken naar thema of kaart;
  - "Werklast, 14 dagen" met `ColumnChart` compact (staafgebied 70 px).
- Onder het raster: `<details>` "Alle cijfers per thema" met de bestaande tabel (Actief, Concept, Vandaag, Retentie, Laatste casus, Fouttypes met mini-balk `err-1/2/3`) en de studietijdgrafiek. Zo verdwijnt er geen data.

**`ColumnChart`**: asmaximum in een eigen kolom links (staafrij `ml-[26px]`, label `absolute -left-[26px]`), zodat het nooit over het piek-label valt. `niceMax`-stappen `[1, 2, 2.5, 5, 10]` (23 → 25 in plaats van 50). Staven `max-w-5 rounded-t` `bg-chart`, piek-label 11 muted. Tabelweergave blijft.

**Telefoon**: eyebrow "INZICHT · 30 DAGEN"; groot "{r}%" serif 56/1 met "retentie / doel {d}%" 14 `text-text-2` ernaast; meta 13 muted; "Aandacht nodig" samengevat per soort ("{n} leerdoelen zonder dekking · {thema}", "{n} lastige kaarten om te herschrijven") met chevron naar de lijst; "Per thema" met naam 14/500, waarde 14/700 in stipkleur en mini-spoor `h-3` (stip 10).

### 1l · Thema-pagina
Ontwerp: `designs/03-overzicht-thema.dc.html` (1l). Bron: `app/(app)/thema/[id]/page.tsx`.

**Laptop** (Studiestof › Thema's; `max-w-[1120px] pt-7 gap-5`):
- Kruimelpad 13 muted: "Thema's" (link, `text-accent`) · module · "toets over {n} dagen". Titel serif 42/1.1. "Thema bewerken" in een ⋯-menu naast de titel.
- Tabs (`border-b flex gap-1 text-[15px]`, `?tab=`; actief `font-bold` met onderlijn 2 px accent): "Leerdoelen" (+ " · {n} open" in `text-danger` als er ongedekte zijn) · "Kaarten {n}" · "Illness scripts {n}" · "Casussen {n}" · "Vragen {n}".
- Raster `grid-cols-[1fr_340px] gap-6`.
- **Tab Leerdoelen**: paneel met rijen `grid-cols-[36px_1fr_200px] gap-3.5 px-5 py-3.5 border-b border-border-subtle`: code 14/700 `text-text-2`; omschrijving 15/1.4; rechts gedekt → pillen "{n} kaarten" (`bg-accent-soft text-accent-strong text-xs px-[9px] py-[3px] rounded-full`) en "{n} casussen" (`bg-surface-2 text-text-2`); niet gedekt → knop "+ Kaart maken" (13/700 `text-accent border border-accent rounded-[9px] px-3 py-1.5`), die het formulier "Eigen kaart" opent met dit leerdoel aangevinkt. Leerdoel bewerken via ⋯ per rij; "Leerdoel toevoegen" onder de lijst.
- **Rechterkolom**:
  - "Volgende stap" (`bg-accent-deep text-on-deep rounded-2xl px-[22px] py-5 gap-2.5`): eyebrow `text-on-deep-muted`; titel serif 24 "Pretest {thema}"; 14/1.5 `text-on-deep-2` "{n} vragen, geen score. Proberen helpt je de stof daarna beter te onthouden."; knop `h-11 rounded-[10px] bg-white text-accent-deep font-bold` "Start pretest" → `/oefentoets/pretest/[id]`. Alleen tonen als er actieve pretestvragen zijn die nog niet allemaal geprobeerd zijn;
  - "Concepten": titel 15/700 + "Nakijken →" 13/700 `text-accent` → `/goedkeuren?thema={id}`; "{n} kaarten wachten op goedkeuring, waarvan {v} te controleren.";
  - "Bronnen": de bronnen die de kaarten van dit thema gebruiken (distinct `cards.source_id`), 14 `text-text-2`.
- **Andere tabs**: bestaande lijsten en formulieren in de nieuwe stijl. Bij Kaarten: statusfilter als `Segmented` (Actief {n} · Concept {n} · Geschorst {n}) en de knoppen "Kaarten maken uit brontekst (AI)" en "Eigen kaart" in de tabkop.

**Telefoon**: "‹ Studiestof", titel serif 32; tabs horizontaal scrollbaar (`overflow-x-auto whitespace-nowrap`, 14 px); compacte "Volgende stap"-rij (`bg-accent-deep rounded-[14px] px-4 py-3.5`, "Pretest · {n} vragen" 15/700, knop "Start" wit h-10); leerdoelen met pillen 11 px of "+ Kaart maken" 12/700.

### 1n · Goedkeuren
Ontwerp: `designs/04-goedkeuren-scripts.dc.html` (1n). Bronnen: `app/(app)/goedkeuren/page.tsx`, `draft-card.tsx`, `actions.ts`, `components/card-form.tsx`, `lib/labels.ts`.

**Schemawijziging nodig, vraag eerst toestemming**: om de bron naast het concept te tonen moet het brondeel bewaard worden. Voorstel: kolom `cards.source_excerpt text null` (migratie 0008, `npm run db:types`). `draft_cards` geeft per kaart een letterlijk citaat van maximaal ±400 tekens uit de meegegeven brontekst terug (zod-schema uitbreiden, `docs/AI_PROMPTS.md` bijwerken). Komt het citaat niet letterlijk voor in de brontekst, zet dan `needs_verification = true` (past bij principe 10). Import: optioneel veld `source_excerpt` in `docs/IMPORT_FORMAT.md`. Zonder excerpt toont het bronpaneel alleen de bronvermelding en "Brontekst niet bewaard bij dit concept."

**Laptop** (Studiestof › Goedkeuren; inhoud is `flex` over de volle breedte, niet de 1120-kolom):
- **Lijst links** (`w-[330px] bg-surface border-r flex flex-col`):
  - kop `p-4 gap-2.5 border-b`: `Segmented` (12 px) "Kaarten {n} · Scripts {n} · Casus {n} · Vragen {n}"; rij met themakeuze "Alle thema's ▾" 13 en filter "{n} te controleren" 13/700 `text-warn-text` (`?controleren=1`);
  - groepen per thema: label "DERMATOLOGIE · 5" (eyebrow, `px-4 pt-3.5 pb-1.5`); item `px-4 py-[11px] border-b border-border-subtle gap-1`: voorkant 14/1.4 (`line-clamp-2`), meta 12 muted "{type} · {AI|import|eigen}" + " · Controleren" 700 `text-warn-text`. Geselecteerd: `bg-accent-soft`. Selectie via `?id=`; ↑/↓ of j/k beweegt.
- **Editor rechts** (`grid grid-cols-2`):
  - Bronpaneel (`bg-surface-sunk border-r px-[30px] py-7 gap-3.5`): "BRON" eyebrow + rechts "{titel} · h. {hoofdstuk} · p. {pagina}" 13 muted; excerpt serif 18/1.6 `text-text-2`, gebruikte passage met `bg-highlight text-text rounded-[3px] px-0.5`; onderaan 13 muted "Gemarkeerd: waar de AI dit concept op baseerde."
  - Formulier (`px-[30px] py-7 gap-4`): rij met type-select (h-8 rounded-lg 13), leerdoelpillen (accent) en rechts "Herschreven" 12/700 `text-accent` zodra voor- of achterkant afwijkt van het origineel; bij `needs_verification` chip "Controleren" + `VERIFY_TEXT` 13 `text-warn-text`; "Voorkant" serif 20/1.35 met hint "Dwing ophalen af: geen ja/nee-vraag, het antwoord staat niet in de vraag."; "Achterkant" 15/1.55 met hint "Zet het in je eigen woorden; dat onthoud je beter."; "+ Uitleg · + Tags" 13 muted klapt uitleg, tags en bronvermelding uit.
  - Actiebalk (`h-[72px] border-t bg-surface px-[30px] flex items-center gap-2.5`): "{i} van {n}" 14 muted; rechts "Afwijzen" (`text-danger`, `Kbd` X), "Later" (secundair, `Kbd` L), "Goedkeuren" (primair, `Kbd` A). Na een actie direct naar het volgende item (optimistisch). Sneltoetsen alleen als de focus niet in een veld staat; in een veld ⌘/Ctrl+Enter = Goedkeuren.
- Tabs Scripts, Casus en Vragen: lijst links, rechts een alleen-lezenvoorbeeld met link "Openen". Bulk-goedkeuren met vinkjes alleen voor casussen en vragen (bestaande regel; nooit voor kaarten).
- Goedkeuren-logica (`approve_card`, `rewritten`, schema aanmaken) blijft ongewijzigd.

**Telefoon** (zonder onderbalk):
- Kop: terug 44 + "Goedkeuren" 17/700 + "{i} van {n}" 14 muted.
- Chips (thema, "{type} · {origin}", leerdoel accent).
- Bronkaart `bg-surface-sunk border rounded-[14px] px-3.5 py-3`: "BRON · P. {n}" + "Hele bron" 12/700 accent (opent een sheet); 2–3 regels excerpt serif 15/1.5.
- Velden zoals laptop (voorkant serif 18).
- Onderin `grid grid-cols-[56px_1fr_1.5fr] gap-2 h-14 rounded-xl`: ×-knop (icoon `text-danger`, `aria-label="Afwijzen"`) · "Later" · "Goedkeuren".

### 1p · Illness scripts vergelijken
Ontwerp: `designs/04-goedkeuren-scripts.dc.html` (1p). Bronnen: `app/(app)/scripts/vergelijk/page.tsx`, `script-labels.ts`, `compare-form.tsx`.

**Laptop** (Studiestof › Illness scripts; `max-w-[1160px] pt-[26px] gap-4`):
- Kop: titel serif 30 "Vergelijken"; aandoeningschips 13 (`px-3 py-1.5 rounded-full bg-surface border border-border-strong`, "×" `text-faint` haalt het id uit de URL); chip "+ Aandoening" gestippeld (`border-dashed border-border-dashed`, opent een kiezer, max 4). Rechts `Segmented` "Lezen · Overhoren" (`?modus=overhoren`) en de bestaande knop "Vergelijkingskaart (AI)".
- Matrix (`rounded-2xl border bg-surface overflow-hidden`):
  - kop `grid-cols-[190px_repeat(n,1fr)] border-b-2 border-border-strong`, aandoeningsnamen serif 20/500 `px-4 py-3` (link naar het script);
  - rijvolgorde: **Onderscheidende kenmerken eerst** (label "ONDERSCHEIDEND" `text-accent-strong`), dan Presentatie, Bevindingen, Pathofysiologie, Beleid, Epidemiologie;
  - labelcel 12/700 `tracking-[.04em] text-muted bg-surface-sunk px-4 py-3`; waardecellen 14/1.45 `prose-card px-4 py-3`; leeg "–" muted.
- **Overhoren**: de eerste kolom blijft zichtbaar. Andere cellen zijn afgedekt met een placeholder (`min-h-[42px] rounded-[10px] border-[1.5px] border-dashed border-err-3 bg-bg`, 13 `text-text-2` "Wat verwacht je? **Toon**", Toon 700 `text-accent`). Klik of Enter toont die cel; "Alles tonen" als link. Alleen clientstate, niets opslaan.
- Uitleg onder de matrix 13 muted: "Overhoren: zeg of typ eerst wat je verwacht, open dan de cel. Onderscheidende kenmerken staan bovenaan."

**Telefoon**: "‹ Illness scripts" + `Segmented` Lezen/Overhoren (12 px); titel serif 28; veldchips horizontaal scrollbaar (13, actief `bg-text text-white font-bold`): Onderscheidend, Presentatie, Bevindingen, Beleid, Pathofysiologie, Epidemiologie. Per aandoening een kaart (`rounded-[14px] border bg-surface px-4 py-3.5 gap-1.5`): naam serif 19 + waarde 15/1.5, of placeholder h-14. Vegen naar het volgende veld is optioneel.

### 1r · Casussen-sessie
Ontwerp: `designs/05-casus-oefentoets.dc.html` (1r). Bronnen: `app/(app)/casussen/sessie/case-session.tsx`, `lib/cases.ts`, `actions.ts`. **Behoud**: de differentiaal (`revealAlternativesAction`) komt pas op verzoek in de reflectiestap; de expert-uitwerking (`revealExpertAction`) pas na het rangschikken; maximaal 3 hints.

**Laptop** (focuslayout):
- Header `h-16 bg-surface border-b px-7 gap-6`: "Stoppen"; stappen gecentreerd, verbonden door lijntjes 20 × 1: Werkdiagnose · Reflectietabel · Expert · Zelfscore · Wat miste je? Gedaan: `text-accent` met vinkje 13; huidig: `bg-accent text-white font-bold px-3 py-1.5 rounded-full`; volgend `text-muted`. Rechts "Casus {i} van {n}" 13 muted.
- Inhoud `grid grid-cols-[380px_1fr]`:
  - **Vignetpaneel** (`bg-surface-sunk border-r px-[30px] py-7 gap-3`): eyebrow "{THEMA} · VIGNET"; titel serif 24/1.2; vignet serif 17/1.65; vraag 15/700. Onderaan (`mt-auto`) hints: `bg-warn-bg rounded-[10px] px-3 py-2.5 text-[13px] text-warn-text-strong`, "**Hint {i}:** {tekst}", daaronder knop "Nog een hint · {n} over" 700 `text-warn-text`. Zonder AI: "Hints vragen een API-key."
  - **Werkpaneel** (`px-[30px] py-7 gap-3.5`):
    - Stap Werkdiagnose: één veld + "Volgende" (zoals nu).
    - **Stap Reflectietabel** (vervangt stap 2, 3 en 4): titel 17/700 + 13 muted "Sleep om te rangschikken; bovenaan staat je eindantwoord.";
    - tabel `rounded-[14px] border bg-surface`, kolommen `grid-cols-[44px_170px_1fr_1fr_1fr]`, kop 12/700 muted op `bg-surface-sunk`: "#", "Diagnose", "Wat past erbij?", "Wat spreekt het tegen?", "Verwacht, maar ontbreekt";
    - rij: rang 15/700 + sleepgreep (6 stippen `text-faint`); voor toetsenbord ook ↑/↓-knoppen met `aria-label` (bestaande teksten "{d} omhoog/omlaag"). Diagnosecel: invoer 14/700; eerste rij tag "Werkdiagnose" 11 `text-accent-strong`. Cellen: meegroeiende tekstvakken 13/1.45 zonder eigen rand, `border-l border-border-subtle`, placeholder `text-faint`;
    - voetregel: "+ Alternatief" 14/700 `text-accent` en "Toon mogelijke alternatieven" 14 `text-text-2` (→ `revealAlternativesAction`, `cued = true`; chips "Tik om toe te voegen als alternatief" zoals nu);
    - knop rechtsonder primair `h-12 rounded-xl` "Vergelijk met de expert", actief zodra minstens één alternatief een diagnose heeft;
    - mapping: `rows` → `reflection`; rijvolgorde → `final_ranking`.
    - Stappen Expert, Zelfscore en Wat miste je: inhoud als in het telefoonontwerp hieronder, in het werkpaneel.

**Telefoon** (focuslayout):
- Header × + staptitel 14/700 + "{i} / {n}".
- Reflectie blijft stapsgewijs: één kaart per diagnose met de drie velden, daarna een rangschiklijst met ↑/↓ (slepen optioneel).
- **Expert** (het getoonde frame):
  - kaart "Juiste diagnose" (label 12 muted, naam serif 26, vinkje + "Jouw eindantwoord: {x}" 13 `text-accent-strong`; bij fout × in `text-danger`);
  - expertrijen: rang 1 `border-2 border-accent rounded-[14px] p-4` met definities (label 11/700 `tracking-[.06em] text-muted` "PAST ERBIJ", "SPREEKT TEGEN", "VERWACHT MAAR AFWEZIG"; tekst 13/1.45); overige rangen ingeklapt met "Toon";
  - "Lessen" 13/700 + `teaching_points` 14/1.5 `text-text-2`;
  - onderin secundair h-12 "Feedback van AI op je redenering" en primair h-[54px] "Verder".
- Zelfscore en Wat miste je: bestaande inhoud in de nieuwe knopstijl (Ja/Nee en 1–5 als `min-h-11` knoppen, gekozen `border-accent bg-accent-soft font-bold`).

### 1t · Oefentoets
Ontwerp: `designs/05-casus-oefentoets.dc.html` (1t). Bronnen: `app/(app)/oefentoets/page.tsx`, `proeftoets/exam-runner.tsx`, `pretest/[topicId]/pretest-runner.tsx`, `lib/exam.ts`. **Behoud**: geen juiste opties of modelantwoorden naar de browser vóór inleveren of antwoorden.

**Resultaat, laptop** (shell, Leren › Oefentoets; `max-w-[1120px] grid grid-cols-[1fr_420px] gap-7 pt-7`):
- **Links**:
  - eyebrow "PROEFTOETS · {n} THEMA'S · INGELEVERD {uu:mm}"; kop serif 44 "{c} van {t} goed" + 15 `text-text-2` "meerkeuze {a}/{b} · open {x}/{y}";
  - zijn er open vragen na te kijken: `Notice` warn "Kijk {n} open vragen zelf na met het modelantwoord; dan klopt de score per leerdoel.";
  - "Per leerdoel" (`rounded-2xl border bg-surface px-[22px] pt-1.5 pb-3`), uit `scoreByObjective`, gegroepeerd per thema. Rij `grid-cols-[1fr_140px_130px] gap-4 py-[9px] border-b border-border-subtle`:
    - thema 11 muted en "**{code}** {omschrijving}" 14/1.35;
    - één blokje per vraag (`flex gap-[3px] h-2.5 rounded-[3px]`): goed `bg-accent`, fout `bg-danger-soft`, na te kijken `bg-surface` met `border-[1.5px] border-dashed border-border-dashed`;
    - score rechts 14/700 tabular "{c}/{t}" of "{c}/{t} · {p} na te kijken", in `text-danger` als `c < t − p`.
- **Rechts**, "Fout beantwoord" (`rounded-2xl border bg-surface px-[22px] py-5 gap-3 self-start`) met aantal:
  - na te kijken open vragen bovenaan;
  - eerste foute vraag uitgeklapt (`border rounded-xl p-3.5 gap-2.5`): stam serif 16/1.4 (`line-clamp-2`); bij meerkeuze de gekozen optie doorgestreept in `text-danger` met "(jouw keuze)" en de juiste in `text-accent-strong font-bold` met ✓; bij open vragen jouw antwoord, het modelantwoord en "Had je het goed? Goed / Fout";
  - daaronder `ErrorChips` klein (12 px, `px-2.5 py-1.5 rounded-lg`, gekozen `border-[1.5px] border-accent bg-accent-soft font-bold`) en secundair h-10 "Maak kaart van deze vraag";
  - overige vragen ingeklapt: stam serif 15 + "✓ Op Goedkeuren" `text-accent` of "Maak kaart" 13/700 `text-accent`.

**Toets maken, telefoon** (focuslayout; op laptop hetzelfde patroon in een kolom van 720 breed):
- Header × + "Proeftoets" 15/700 + "Inleveren" 14/700 `text-accent` (met de bestaande bevestiging bij onbeantwoorde vragen).
- Vraagoverzicht `grid grid-cols-10 gap-[5px]`, vakje `h-[22px] rounded-md text-[10px] font-bold`: beantwoord `bg-accent text-white`; huidig `bg-accent-soft border-2 border-accent`; open `bg-surface border border-border-strong`. Tikken springt naar de vraag.
- "Vraag {i} van {n}" 13 muted + themachip; stam serif 22/1.35.
- Meerkeuze: opties `min-h-14 rounded-[14px] border border-border-strong bg-surface px-4 gap-3.5 text-base`; lettercirkel 28 `rounded-full border-[1.5px]`; gekozen `border-2 border-accent bg-accent-soft font-medium`, cirkel `bg-accent text-white`. Open vraag: tekstvak `min-h-40`.
- Onderin `grid-cols-[1fr_1.6fr] gap-2 h-[54px]`: "Vorige" (secundair) en "Volgende" (primair; bij de laatste vraag "Inleveren").
- Pretest-runner: zelfde patroon, zonder score (bestaande regel: "je hebt er X geprobeerd").
- **Startpagina `/oefentoets`**: geen apart b-ontwerp. Gebruik de b-shell en twee panelen naast elkaar (Pretest, Proeftoets) zoals in 1s, in de stijl van dit document.

---

## Interacties en gedrag

- Bestaande sneltoetsen blijven: spatie = antwoord tonen, 1–4 = beoordelen, ⌘/Ctrl+Enter in een tekstvak = nakijken/tonen, 1–3 en Enter bij fouttype. Nieuw: Goedkeuren A / L / X en ↑/↓ (alleen buiten velden).
- Overgangen: alleen `transition-colors` 150 ms op hover en actief. Geen bewegende animaties; de app moet rustig blijven. Respecteer `prefers-reduced-motion`.
- Hover (alleen op apparaten met een muis): secundaire knop `bg-surface-2`, lijstitem `bg-surface-sunk`, tab `text-text`.
- Laden: knoppen tonen de bestaande teksten ("Nakijken…", "Bezig…"). Geen skeletons nodig.
- Fouten: bestaande foutteksten in `Notice tone="error"`.
- Offline (fase 6): de focusmodus van Vandaag moet offline blijven werken. Laat `public/sw.js` ook de nieuwe layout en fonts cachen en controleer `tests/e2e/offline.spec.ts`.
- Toegankelijkheid: tabs als `role="tablist"` of links met `aria-current="page"`; `Segmented` als radiogroep; voortgang met `role="progressbar"` (`aria-valuenow`, `aria-valuemax`); afgedekte scriptcellen als knoppen met `aria-expanded`.

## State

Geen nieuwe serverstate behalve `cards.source_excerpt` (1n). Nieuwe clientstate:
- 1f: segmentvoortgang (afgeleid van `results` en de wachtrij).
- 1n: geselecteerd concept (`?id=`), filter (`?thema`, `?controleren`), "herschreven" (vergelijken met het origineel).
- 1p: `?modus=overhoren`, set van getoonde cellen (lokaal), gekozen veld op de telefoon.
- 1r: rijvolgorde in de reflectietabel (= rangschikking).
- 1t: huidige vraagindex (telefoon en laptop).
- Shell: actieve werkruimte, afgeleid van `usePathname()`.

## Assets

Geen afbeeldingen. Iconen zijn inline-SVG-paden (24 × 24, stroke, `stroke-linecap="round"`) zoals nu in `components/nav.tsx`; de paden staan hierboven bij 1b. Overige: × `M6 6l12 12M18 6L6 18`, chevron `M9 6l6 6-6 6`, terug `M15 6l-6 6 6 6`, omlaag `M6 9l6 6 6-6`, instellingen `M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4`. Fonts via `next/font/google` (zie Typografie).

## Bestanden

- `globals.css`: vervangt `app/globals.css`.
- `designs/01-shell-inloggen.dc.html`: tokens, 1b, 1d.
- `designs/02-vandaag-sessie-einde.dc.html`: 1f, 1h.
- `designs/03-overzicht-thema.dc.html`: 1j, 1l.
- `designs/04-goedkeuren-scripts.dc.html`: 1n, 1p.
- `designs/05-casus-oefentoets.dc.html`: 1r, 1t.
- `designs/support.js`: runtime om de ontwerpen te openen; niet in de app gebruiken.
- `PROMPT_CLAUDE_CODE.md`: de opdrachten per stap.
