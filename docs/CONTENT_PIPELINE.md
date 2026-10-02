# Contentpipeline: van studiestof naar importbestand

Claude Code zet de stof in `content/` om naar importbestanden volgens `docs/IMPORT_FORMAT.md`. Dat gebeurt buiten de app, één thema per keer, zodat de student na elk thema kan bijsturen. Alles komt als concept binnen; de student keurt goed in `/goedkeuren`.

## Invoer

```
content/module-1/<nr>-<thema>/
  leerdoelen.md        leerdoelen letterlijk uit de studiehandleiding, met nummer
  *.pdf | *.jpg        hoofdstukken, slides, practicumhandleiding, aantekeningen
  notities.md          optioneel: wat de docent benadrukte, toetstips
content/module-1/00-studiehandleiding/   toetsvorm en toetsdata
```

## Werkwijze per thema

1. **Lees** `leerdoelen.md`, de studiehandleiding (toetsvorm, toetsdatum) en alle bronnen in de themamap.
2. **Bronnen:** maak per hoofdstuk, collegereeks of handleiding een `sources`-item.
3. **Leerdoelen:** neem ze letterlijk over in `objectives`.
4. **Illness scripts:** één per aandoening die in de leerdoelen of de stof centraal staat. Vul alleen wat de bron onderbouwt.
5. **Kaarten:** per leerdoel de kaarten die nodig zijn om het te beheersen. Richtlijn: 40 tot 80 per thema, afhankelijk van de hoeveelheid stof.
6. **Casussen:** 5 tot 8 per thema, op basis van de scripts, met gelijkende alternatieven in de differentiaal.
7. **Vragen:** 8 tot 10 pretestvragen (open) en 10 tot 20 toetsvragen in het formaat van de echte toets.
8. **Dekking controleren:** elk leerdoel heeft minstens drie kaarten of één casus. Meld leerdoelen die de stof niet dekt.
9. **Valideren:** `npm run import -- --dry-run content/out/module-1/<thema>.json` (de importer heeft een dry-run-optie).
10. **Samenvatting tonen** aan de student en pas importeren na akkoord.

## Kwaliteitsregels

- **Alleen uit de bron.** Elk item is herleidbaar tot een bron met pagina of dia (`source_locator`). Geef bij kaarten ook `source_excerpt`: het letterlijke stuk brontekst (max. 600 tekens) waarop de kaart rust; dat staat op Goedkeuren naast het concept. Twijfel je, zet dan de tag `controleren` én `"needs_verification": true`, en noem het in de samenvatting. Doseringen, contra-indicaties en richtlijnadviezen krijgen altijd `"needs_verification": true`.
- **Mechanismen als keten.** Maak voor elk mechanisme een kaart van type `chain`. Farmacologie in vaste volgorde: geneesmiddelgroep en voorbeeldmiddel (fact), kernmechanisme (chain), belangrijkste effect en bijwerking (chain); interacties pas daarna.
- **Eigen formulering.** Parafraseer kort; neem geen lange passages letterlijk over uit het boek.
- **Eén idee per kaart.** Lijsten van meer dan drie punten splitsen.
- **Ophalen afdwingen.** Geen ja/nee-vragen; het antwoord staat niet in de vraag.
- **Toepassing boven reproductie.** Casussen en toetsvragen vragen om redeneren, niet om herkennen.
- **Nederlands**, met gangbare Latijnse of Engelse termen tussen haakjes.
- **Geen patiëntgegevens**, ook niet uit aantekeningen van stage.

## Uitvoer

`content/out/module-1/<nr>-<thema>.json` volgens `docs/IMPORT_FORMAT.md`, met `external_id`'s volgens de conventie daar.

## Samenvatting voor de student (na elk thema)

```
Thema: <naam>
Bronnen gelezen: <lijst>
Gemaakt: <n> kaarten, <n> illness scripts, <n> casussen, <n> pretestvragen, <n> toetsvragen
Leerdoelen zonder dekking: <lijst of "geen">
Te controleren (tag 'controleren'): <n> items, met reden
```

## Prompt om te gebruiken in Claude Code

```
Volg docs/CONTENT_PIPELINE.md voor thema <nr>-<thema> in content/module-1/.
Maak content/out/module-1/<nr>-<thema>.json, valideer met --dry-run
en laat me de samenvatting zien. Importeer pas als ik akkoord geef.
```
