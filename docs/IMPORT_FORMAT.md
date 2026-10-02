# Importformaat (versie 1)

Studiestof komt de app in als één JSON-bestand per thema of per module. De contentpipeline (`docs/CONTENT_PIPELINE.md`) maakt deze bestanden; de importer (`lib/import/`) leest ze in.

## Regels

- **Verwijzingen gaan via `external_id`.** Een kaart verwijst naar zijn thema met `"topic": "m1-ritme"`. Die id mag in hetzelfde bestand staan of al eerder geïmporteerd zijn.
- **Idempotent.** De importer doet een upsert op `(user_id, external_id)`. Hetzelfde bestand twee keer importeren geeft geen dubbele rijen.
- **Inhoud komt binnen als concept.** Kaarten, scripts, casussen en vragen krijgen altijd `status = 'draft'` en `origin = 'import'`. Structuur (modules, thema's, leerdoelen, bronnen) is direct actief.
- **Actieve items blijven staan.** Bestaat een item al met `status = 'active'`, dan slaat de importer het over en meldt het als conflict.
- **Alles of niets per bestand.** Eerst het hele bestand valideren met zod; bij één fout wordt niets geïmporteerd en krijg je per fout het pad (bijv. `cards[12].front`).
- **Volgorde van verwerken:** modules → topics → objectives → sources → illness_scripts → cards → cases → questions.

## Conventie voor `external_id`

Kleine letters, cijfers en koppeltekens. Opbouw: `<module>-<thema>-<type>-<nummer>`.

| Soort | Voorbeeld |
| --- | --- |
| Module | `m1` |
| Thema | `m1-ritme`, `m1-kno`, `m1-derm` |
| Leerdoel | `m1-ritme-ld-03` |
| Bron | `martini-h15`, `jongh-anamnese-h4` |
| Kaart | `m1-ritme-k-017` |
| Illness script | `m1-ritme-is-boezemfibrilleren` |
| Casus | `m1-ritme-c-004` |
| Vraag | `m1-ritme-pt-02` (pretest), `m1-ritme-tv-11` (toetsvraag) |

## Structuur

```jsonc
{
  "format": "pa-studie-import",
  "version": 1,

  "modules": [
    { "external_id": "m1", "name": "PA de eerste stap", "study_year": 1, "sort_order": 1, "exam_date": null }  // JJJJ-MM-DD uit de studiehandleiding
  ],

  "topics": [
    { "external_id": "m1-ritme", "module": "m1", "name": "Ritmestoornissen", "sort_order": 2 }
  ],

  "objectives": [
    { "external_id": "m1-ritme-ld-01", "topic": "m1-ritme", "code": "2.1", "description": "<leerdoel letterlijk uit de studiehandleiding>", "sort_order": 1 }
  ],

  "sources": [
    { "external_id": "martini-h15", "kind": "book", "title": "Anatomie en fysiologie, een inleiding", "author": "Martini", "chapter": "15", "pages": null, "url": null, "notes": null }
  ],

  "illness_scripts": [
    {
      "external_id": "m1-ritme-is-<aandoening>",
      "topic": "m1-ritme",
      "source": "<bron-id>",
      "source_locator": "p. 000-000",
      "condition": "<naam aandoening>",
      "epidemiology": "<wie krijgt het, risicofactoren>",
      "pathophysiology": "<wat gaat er mis>",
      "presentation": "<klachten, symptomen, beloop>",
      "findings": "<lichamelijk onderzoek en aanvullende diagnostiek>",
      "management": "<behandeling en beleid>",
      "key_discriminators": "<wat het onderscheidt van gelijkende aandoeningen>",
      "similar_conditions": ["<aandoening>", "<aandoening>"]
    }
  ],

  "cards": [
    {
      "external_id": "m1-ritme-k-001",
      "topic": "m1-ritme",
      "type": "fact",                 // fact | explain | chain | illness_script | compare | image | skill | communication
      "front": "<vraag>",
      "back": "<kort antwoord>",
      "explanation": "<waarom; optioneel>",
      "source": "<bron-id>",
      "source_locator": "p. 000",
      "objectives": ["m1-ritme-ld-01"],
      "tags": [],
      "image": null,                  // relatief pad in content/, alleen via het lokale importscript
      "source_excerpt": null          // optioneel: letterlijk brondeel (max. 600 tekens), getoond op Goedkeuren
    }
  ],

  "cases": [
    {
      "external_id": "m1-ritme-c-001",
      "topic": "m1-ritme",
      "source": "<bron-id>",
      "title": "<korte titel zonder de diagnose>",
      "vignette": "<leeftijd, geslacht, hulpvraag, anamnese, bevindingen>",
      "question": "Wat is je werkdiagnose?",
      "correct_diagnosis": "<diagnose>",
      "expert_reflection": [
        { "diagnosis": "<diagnose>", "supporting": "<bevindingen die passen>", "against": "<bevindingen die niet passen>", "missing": "<verwacht maar afwezig>", "rank": 1 },
        { "diagnosis": "<alternatief>", "supporting": "...", "against": "...", "missing": "...", "rank": 2 }
      ],
      "teaching_points": "<de 2-3 lessen van deze casus>",
      "difficulty": 2,                // 1 makkelijk, 2 gemiddeld, 3 moeilijk
      "objectives": ["m1-ritme-ld-01"]
    }
  ],

  "questions": [
    {
      "external_id": "m1-ritme-pt-01",
      "topic": "m1-ritme",
      "source": "<bron-id>",
      "kind": "pretest",              // pretest | exam
      "format": "open",               // open | mcq
      "stem": "<vraag>",
      "options": null,                // bij mcq: ["A", "B", "C", "D"]
      "correct_option": null,         // bij mcq: index, 0-based
      "model_answer": "<modelantwoord>",
      "explanation": "<uitleg>",
      "objectives": ["m1-ritme-ld-01"]
    }
  ]
}
```

Alle lijsten zijn optioneel; een bestand met alleen `cards` is geldig zolang de verwezen thema's al bestaan.

## Aanvulling 01

- `cards[].type` mag ook `"chain"` zijn (ketenkaart). Voorkant: begin en eind van de keten; achterkant: de stappen gescheiden door ` → `.
- Optioneel `"needs_verification": true` bij `cards`, `illness_scripts`, `cases` en `questions` (standaard `false`). Gebruik het voor alles wat niet aantoonbaar uit de bron komt, en altijd bij doseringen, contra-indicaties en richtlijnadviezen. In de app verschijnt dan het label "Controleren".

## Validatie (zod)

- `front`, `back`, `stem`, `vignette`, `condition`: niet leeg, maximaal 2.000 tekens.
- `type`, `kind`, `format`, `kind` van bron: alleen de waarden uit het schema.
- `mcq`: 3 tot 6 opties, `correct_option` binnen bereik.
- `expert_reflection`: minimaal 2 diagnoses, precies één met `rank: 1`, en die gelijk aan `correct_diagnosis`.
- Elke verwijzing (`module`, `topic`, `source`, `objectives`) bestaat in het bestand of in de database.
- `exam_date`: ISO-datum `JJJJ-MM-DD`.

## Afbeeldingen

`image` is een pad relatief aan `content/`, bijvoorbeeld `module-1/06-dermatologie/beelden/plaque.jpg`. Alleen het lokale script (`npm run import`) uploadt afbeeldingen, naar bucket `card-images` op pad `<user_id>/<external_id>.<ext>`, en vult `image_path`. De upload via de app negeert `image` en meldt dat.

Gebruik alleen afbeeldingen die je zelf mag gebruiken: eigen foto's zonder herkenbare patiënt, of open-access beeldbanken.

## Brondeel (ontwerp 1n)

- Optioneel `"source_excerpt"` bij `cards`: het letterlijke stuk brontekst (maximaal 600 tekens) waarop de kaart rust. Goedkeuren toont het naast het concept. Zonder excerpt toont het bronpaneel alleen de bronvermelding.
- Neem het woord voor woord over uit de brontekst; parafraseer niet. Kun je geen letterlijk stuk aanwijzen, laat het veld dan weg en zet `needs_verification` op true.
