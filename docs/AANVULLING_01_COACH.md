# Aanvulling 01 — coachprincipes en gespreksoefening

Versie 1 · 2 oktober 2026 · hoort bij `docs/SPEC.md`

> **Stand van de bouw (2 oktober 2026)**
>
> | Onderdeel | Status |
> | --- | --- |
> | A1. Fouttypes | Gebouwd: herhaalscherm (na Opnieuw/Moeilijk, toetsen 1–3, Enter), casusmodus, proeftoets, overzicht per thema met advies |
> | A2. Ketenkaarten | Gebouwd: type `chain`, pijlknop, stappen naast elkaar, nakijken in ketenmodus, `draft_cards`, import |
> | A3. Hint, herstelvraag, dan uitleg | Gebouwd: `explain_check` vervangt `explain_feedback`; Toon antwoord blijft altijd beschikbaar |
> | A4. Variantvragen | Bewust later (kost een AI-aanroep per sessie; ongecontroleerde vragen) |
> | A5. Vermoeidheidscheck | Nog niet gebouwd |
> | A6. Stoplicht per leerdoel | Nog niet gebouwd (drempels pas bij te stellen met echte data) |
> | A7. Bron tegenover extern | Gebouwd: `needs_verification`, label en filter in Goedkeuren, label bij herhalen, vinkje "gecontroleerd", import |
> | A8. Coachmodus en begeleide studiesessie | Bewust later; alleen de **stopcheck** is gebouwd (einde van een herhaalsessie) |
> | B1. Gespreksoefening | Bewust later (effect op leren nog niet aangetoond) |
>
> De migratie heet `supabase/migrations/0005_aanvulling_a.sql` (niet `0002_coach_and_consult.sql`: die naam botst met de bestaande migratie en het bestand ontbrak). Er zijn nog geen tabellen voor coach, varianten of gesprekken.

## Waarom deze aanvulling

Een externe werkwijze ("PA AI-studiecoach") bevat sterke principes voor de manier waarop een tutor vragen stelt en feedback geeft. Die nemen we over. Wat we níet overnemen is het idee dat de chat zelf onthoudt wat je fout had: in deze app zit dat geheugen in de database en blijft FSRS de planning doen.

Daarnaast vult deze aanvulling een gat in de breedte: gespreksvoering (anamnese) kon je tot nu toe alleen met kaarten oefenen.

## Hoe Claude Code dit toepast

1. Inventariseer wat al gebouwd is. Geef per onderdeel hieronder aan of het een wijziging van bestaande code is of nieuw werk.
2. Maak de fase waar je nu mee bezig bent eerst af.
3. Voer `supabase/migrations/0002_coach_and_consult.sql` uit. Die voegt alleen toe; bestaande data blijft intact.
4. Werk `CLAUDE.md` bij (zie onderaan).
5. Bouw de onderdelen in de volgorde van de tabel. Onderdelen voor een fase die nog niet gebouwd is, neem je mee wanneer je die fase bouwt.

| Onderdeel | Raakt aan | Hoort bij fase |
| --- | --- | --- |
| A1. Fouttypes | herhaalscherm, casusmodus, proeftoets, dashboard | 1, 4, 5, 6 |
| A2. Ketenkaarten | kaarttypes, herhaalscherm, AI-concepten, import | 1–2 |
| A3. Hint, herstelvraag, dan uitleg | herhaalscherm | 2 |
| A4. Variantvragen | herhaalscherm | 2 |
| A5. Vermoeidheidscheck | herhaalscherm, coach | 1, 5b |
| A6. Stoplicht per leerdoel | `/thema/[id]`, `/overzicht` | 2, 6 |
| A7. Bron tegenover extern | alle AI-prompts, goedkeuren, import | 2 |
| A8. Coachmodus, begeleide studiesessie, stopcheck | nieuw: `/coach` | 5b (na fase 5) |
| B1. Gespreksoefening met gesimuleerde patiënt | nieuw: `/gesprek` | 7 (optioneel) |

---

## A1. Fouttypes

Een fout is niet altijd een kennisgat. We onderscheiden drie types:

| Waarde | Label in de UI | Betekenis |
| --- | --- | --- |
| `knowledge_gap` | Wist ik niet | De kennis ontbreekt |
| `reasoning_error` | Redenering fout | De kennis is er, maar de redenering of richting klopt niet |
| `slip` | Slordig of moe | Vergissing; de rest laat zien dat de kennis er is |

- **Herhaalscherm:** na "Opnieuw" of "Moeilijk" verschijnen drie chips. Eén tik, overslaan mag. Als de AI heeft nagekeken (A3), staat zijn suggestie al geselecteerd.
- **Casusmodus en proeftoets:** dezelfde chips bij een fout antwoord.
- **Opslag:** `error_type` in `review_logs`, `case_attempts`, `question_attempts`, `coach_turns`.
- **Dashboard:** per thema de verdeling van fouttypes in de laatste 30 dagen. Veel redeneerfouten betekent: meer casussen. Veel kennisgaten: terug naar de stof.
- **Belangrijk:** het fouttype verandert de FSRS-beoordeling niet. FSRS krijgt altijd de eerlijke beoordeling, ook bij een slordigheidsfout.

**Klaar als:** na een foute beoordeling kan het fouttype in één tik worden vastgelegd, en het dashboard toont de verdeling per thema.

## A2. Ketenkaarten (`type = 'chain'`)

Voor mechanismen in fysiologie en farmacotherapie. De student zet de keten zelf op een rij.

- **Voorkant:** begin en eind van de keten, bijvoorbeeld "ACE-remmer → serumkalium: leg de keten uit."
- **Achterkant:** de stappen gescheiden door ` → `, bijvoorbeeld "ACE-remming → minder angiotensine II → minder aldosteron → minder K⁺-uitscheiding → hoger serum-K⁺".
- **Herhaalscherm:** tekstveld met een knop die `→` invoegt. Na het tonen van het antwoord staan de stappen van de student en de juiste keten naast elkaar, stap voor stap.
- **Nakijken:** via A3 in ketenmodus. De AI let op ontbrekende stappen, verkeerde volgorde en omkeringen (stijgt/daalt, stimulatie/remming, retentie/uitscheiding, preload/afterload). Een omkering wordt altijd expliciet genoemd en geldt als `reasoning_error`.
- **AI-concepten (`draft_cards`):** maak voor elk mechanisme in de bron een ketenkaart. Bij farmacologie in vaste volgorde: geneesmiddelgroep en voorbeeldmiddel (fact), kernmechanisme (chain), belangrijkste effect en bijwerking (chain). Interacties pas daarna.
- **Import:** `"type": "chain"` is toegestaan (zie A7 voor de andere importwijziging).

**Klaar als:** een ketenkaart is te maken, te importeren en te herhalen, en een omgekeerde richting wordt bij nakijken herkend.

## A3. Hint, herstelvraag, dan pas uitleg

Dit **vervangt punt 3 van SPEC 5.3**. Geldt voor kaarten van type `explain`, `chain`, `illness_script` en `compare` als de student een antwoord typt.

1. De student typt een antwoord en kiest **Nakijken**. Het juiste antwoord is nog niet zichtbaar.
2. **Correct:** korte bevestiging, de achterkant wordt getoond, plus één verdiepende vervolgvraag (optioneel om te beantwoorden). Suggestie: Goed of Makkelijk.
3. **Deels of fout:** géén uitleg. De AI geeft één korte hint en een kleinere herstelvraag.
4. De student beantwoordt de herstelvraag. Daarna volgen de volledige uitleg en de achterkant. Suggestie: Moeilijk als het na de hint lukte, anders Opnieuw.
5. **Toon antwoord** blijft altijd beschikbaar voor wie zonder AI wil werken.

De student kiest altijd zelf de beoordeling; de suggestie is alleen voorgeselecteerd. Prompt: `explain_check` hieronder.

**Klaar als:** bij een fout antwoord verschijnt eerst een hint met herstelvraag en pas daarna de uitleg; het juiste antwoord is nooit eerder zichtbaar dan na de eigen poging.

## A4. Variantvragen

Een kaart die je kent, toets je ook in een andere context. Zo leer je het begrip in plaats van de kaart.

- **Welke kaarten:** type `explain` en `chain`, in staat Review, met `reps >= 3`.
- **Hoe vaak:** om en om. Was de vorige herhaling het origineel, dan nu een variant, en andersom.
- **Aanmaken:** bij de start van een sessie maximaal 10 varianten vooraf genereren met `variant_question` (snel model) en opslaan in `card_variants`. Eerst een ongebruikte, niet-gemarkeerde variant hergebruiken; pas een nieuwe maken als alle varianten minstens twee keer zijn gebruikt.
- **UI:** label "Variant". Nakijken via A3 met het modelantwoord van de variant. De beoordeling telt voor de oorspronkelijke kaart.
- **"Variant klopt niet":** zet `flagged = true` en toont direct het origineel.
- **Instelling:** `settings.variants_enabled`, standaard aan.

**Klaar als:** een geleerde uitlegkaart verschijnt afwisselend als origineel en als variant, en een gemarkeerde variant komt niet meer terug.

## A5. Vermoeidheidscheck

- **Wanneer kijken:** pas na minimaal 15 kaarten in de sessie, over de laatste 10 beoordelingen.
- **Signaal als een van deze geldt:**
  - het aandeel "Opnieuw" is minstens 40%, en minstens 20 procentpunt hoger dan het eigen gemiddelde van de laatste 30 dagen;
  - twee of meer fouten met type `slip`;
  - de mediane antwoordtijd is meer dan twee keer zo hoog als in de eerste 10 kaarten van de sessie.
- **Melding (één keer per sessie):** "Je maakt meer fouten dan aan het begin van de sessie. Even stoppen?" met de knoppen *Alleen nog herhalen* (geen nieuwe kaarten meer), *Stoppen* (naar stopcheck, A8) en *Doorgaan*.
- **Handmatig:** "Ik ben moe" in het sessiemenu doet hetzelfde als *Alleen nog herhalen*.
- Beoordelingen worden nooit aangepast.
- **Instelling:** `settings.fatigue_check`, standaard aan.

**Klaar als:** een gesimuleerde reeks fouten geeft de melding één keer, en na *Alleen nog herhalen* komen er geen nieuwe kaarten meer.

## A6. Stoplicht per leerdoel

Groen, geel of rood per leerdoel, berekend uit data (`lib/objectives.ts`). De AI schat hier niets.

Gekoppelde items van een leerdoel: actieve kaarten (`card_objectives`), casussen (`case_objectives`), vragen (`question_objectives`) en coachvragen (`coach_turns.objective_id`).

Een *toepassing* is een correct beantwoorde casus, toetsvraag of coachvraag zonder hint, minstens 2 dagen na de eerste keer dat het leerdoel werd geoefend. Dat volgt het principe: "beheerst is wat je later zelfstandig in een andere context kunt toepassen".

| Status | Regel |
| --- | --- |
| Rood | Geen actieve gekoppelde items, of nog nooit geoefend, of gemiddelde actuele herinneringskans < 0,70, of de laatste drie toepassingspogingen overwegend fout |
| Groen | ≥ 80% van de gekoppelde kaarten in staat Review, gemiddelde herinneringskans ≥ 0,85, geen lapse in de laatste 14 dagen, en minstens één toepassing in de laatste 30 dagen |
| Geel | Alles daartussen |

- Herinneringskans per kaart: `f.get_retrievability(card, now, false)` uit `ts-fsrs` (geeft een getal tussen 0 en 1).
- Zet de drempels als constanten bovenin `lib/objectives.ts`, zodat ze bij te stellen zijn.
- **Observatie** (regelgebaseerd, geen AI): bijvoorbeeld "12 kaarten, gemiddeld 81% herinneringskans; laatste casus: redeneerfout".
- **Herhaalactie** per situatie:

| Situatie | Actie in de UI |
| --- | --- |
| Rood, geen items | "Pretest maken en stof bestuderen" |
| Rood, lage herinneringskans | "Kaarten herhalen" (met aantal dat klaarstaat) |
| Geel, nog geen toepassing | "Eén casus of coachsessie op dit leerdoel" |
| Geel, recente redeneerfouten | "Casus met reflectiestappen" |
| Groen | "Meenemen in een integratievraag" |

**Klaar als:** `/thema/[id]` toont per leerdoel status, observatie en actie; met testdata klopt elke status met de regels.

## A7. Bron tegenover extern

- **Nieuwe kolom** `needs_verification` op `cards`, `illness_scripts`, `cases` en `questions`.
- **AI:** alles wat niet uit de meegegeven bron komt, krijgt `needs_verification = true`. Doseringen, contra-indicaties en richtlijnadviezen alleen als ze in de bron staan, en dan ook altijd `needs_verification = true`.
- **UI:** chip "Controleren" in `/goedkeuren` en op de kaart bij herhalen, met de tekst "Controleer in het Farmacotherapeutisch Kompas, de NHG-Standaard of de FMS-richtlijn." Filter "Te controleren" in `/goedkeuren`.
- **Import:** optioneel veld `"needs_verification": true` bij kaarten, scripts, casussen en vragen. De contentpipeline zet het op `true` voor alles met de tag `controleren`.

**Klaar als:** te controleren items zijn herkenbaar en filterbaar, en een AI-concept met een dosering die niet in de bron stond is gemarkeerd.

## A8. Coachmodus, begeleide studiesessie en stopcheck

### Coachmodus (`/coach`)

Een gesprek waarin de AI één vraag tegelijk stelt binnen gekozen leerdoelen. Het verschil met een losse chat: het geheugen zit in de database.

- **Start** vanuit `/thema/[id]` → "Coach". Standaard zijn de rode en gele leerdoelen geselecteerd.
- **Modi**, als knoppen:

| Knop | Modus | Wat er gebeurt |
| --- | --- | --- |
| Leren | `learn` | Afwisselend kennis-, mechanisme-, casus- en integratievragen |
| Herhaal fouten | `repeat_errors` | Alleen onderwerpen met recente fouten, in nieuwe bewoordingen |
| Zonder hint | `no_hints` | Actieve reproductie, geen hints en geen herstelvragen |
| Integratie | `integration` | Combineert leerdoelen uit verschillende thema's in één vraag of casus |
| Casus | — | Opent de casusmodus met een casus bij deze leerdoelen |
| Voortgang | — | Toont het stoplicht (A6) voor deze leerdoelen |
| Stopcheck | — | Beëindigt de sessie met maximaal vijf punten om te onthouden |

- **Context per beurt (server-side):** de systeemprompt `coach_system`; de geselecteerde leerdoelen; goedgekeurde inhoud bij die leerdoelen (kaarten, scripts, casussamenvattingen; maximaal ongeveer 6.000 woorden); recente fouten uit de database (coachvragen die niet correct waren en kaartbeoordelingen 1–2 in de laatste 14 dagen); de laatste 10 beurten van deze sessie; de vermoeidheidsstatus.
- **Beurt:** AI stelt een vraag → student antwoordt → AI beoordeelt. Bij deels of fout eerst hint en herstelvraag (zoals A3), daarna de volledige redenering.
- **Fouten worden conceptkaarten:** bij `make_card` maakt de server een concept (`status = 'draft'`, `origin = 'ai'`, tag `coach`) gekoppeld aan het leerdoel. Het verschijnt in `/goedkeuren`.
- **Vermoeidheid:** de knop "Ik ben moe", of drie fouten in de laatste vijf vragen over onderwerpen die eerder goed gingen, zet `fatigue_mode = true`. Daarna alleen korte consolidatievragen, en na drie vragen het voorstel om te stoppen.
- **Opslag:** `coach_sessions` en `coach_turns`. Correcte antwoorden zonder hint tellen als toepassing in A6.

### Begeleide studiesessie

Een knop "Studiesessie (45–60 min)" op `/vandaag` die bestaande modi achter elkaar zet:

1. **Ophalen, 5 min:** de kaarten van vandaag met recente lapses eerst. Zijn die er niet, dan drie coachvragen in `repeat_errors`.
2. **Nieuwe stof, 20–30 min:** kies één leerdoelcluster; pretest; dan bestuderen in je boek (timer en bronverwijzing); daarna concepten van dat cluster goedkeuren.
3. **Toepassen, 15–20 min:** één of twee casussen, of coach in `learn` op dat cluster.
4. **Gemengd herhalen, 5–10 min:** de overige kaarten van vandaag.
5. **Stopcheck, 2 min.**

Sessietype `guided` in `study_sessions`.

### Stopcheck

Aan het eind van elke sessie (herhalen, coach, studiesessie): maximaal vijf punten op basis van de fouten van vandaag, elk als één zin. Elk punt heeft een knop "Maak kaart". Prompt: `stopcheck`.

**Klaar als:** een coachsessie stelt vragen binnen de gekozen leerdoelen, onthoudt fouten tussen sessies via de database, maakt bij fouten conceptkaarten, en sluit af met een stopcheck.

---

## B1. Gespreksoefening met een gesimuleerde patiënt (`/gesprek`, optioneel)

Voor de leerlijn gespreksvoering: anamnese oefenen met een AI die een patiënt speelt, met feedback op basis van de beoordelingscriteria uit je eigen lesboek.

**Bewijs:** een studie met 106 geneeskundestudenten liet zien dat een GPT-4-patiënt in meer dan 99% van de gevallen medisch plausibel antwoordde. De automatische feedback kwam goed overeen met menselijke beoordelaars (κ = 0,83), maar bij 8 van de 45 criteria minder goed ([Holderried e.a. 2024](https://doaj.org/article/65abad4aa7d3455e85c1e9cc02d60c52)). Of studenten er beter van leren, is nog niet aangetoond. Daarom is dit optioneel, en blijft oefenen met echte mensen in het practicum leidend.

- **Rubric (`rubrics`):** de student voert de criteria in uit zijn eigen lesboek, bijvoorbeeld hulpvraagverheldering, open en gesloten vragen, samenvatten en afronden. De AI beoordeelt alleen op die criteria en voegt geen eigen gespreksmodel toe.
- **Scenario (`consult_scenarios`):**
  - `student_brief` is zichtbaar: setting en reden van komst.
  - `patient_script` is verborgen: leeftijd, achtergrond, klachten en beloop, hulpvraag en verwachting, zorgen, wat pas op navraag verteld wordt, emotie en taalniveau.
  - `must_elicit` bevat de informatie die de student moet uitvragen.
  - Scenario's komen als concept van `draft_scenarios` op basis van goedgekeurde illness scripts, of worden handmatig gemaakt. Altijd fictief, nooit een echte patiënt.
- **Gesprek:** de student typt en de AI antwoordt in zijn rol (`consult_patient`). Spraakinvoer via de Web Speech API kan later.
- **Afronden:** eerst schrijft de student een zelfreflectie (drie vragen: wat ging goed, wat miste je, wat doe je volgende keer anders). Daarna pas de feedback (`consult_feedback`): per criterium gezien, deels of niet gezien met een citaat, uitgevraagde en gemiste informatie, een reactie op de zelfreflectie en twee tips.
- **Opslag:** `consult_attempts`, sessietype `consult`.

**Klaar als:** een scenario is te doorlopen, de patiënt onthult informatie op navraag pas als ernaar gevraagd wordt, en de feedback volgt na de zelfreflectie.

## Bewust buiten de app

- **Lichamelijk onderzoek:** je oefent het in het practicum. De app helpt alleen met de volgorde en de kennis (vaardigheidskaarten).
- **EPA's en portfolio:** daarvoor gebruik je het systeem van de opleiding.
- **Echte patiëntcasussen:** alleen geanonimiseerd, als casus vanuit stage.

---

## Wijzigingen in CLAUDE.md

Voeg toe aan "Niet-onderhandelbare principes":

```
8. Fouttype is analyse, geen planning. FSRS krijgt altijd de eerlijke beoordeling, ook bij een slordigheidsfout.
9. Het geheugen zit in de database, niet in de chat. Coach en tutor krijgen bij elke beurt de relevante fouten en items uit de database mee.
10. Bron of extern. De AI markeert alles wat niet uit de bron komt (needs_verification). Doseringen, contra-indicaties en richtlijnadviezen alleen uit de bron, en dan ook altijd gemarkeerd.
11. Bij een fout eerst een hint en een herstelvraag, pas daarna de volledige uitleg.
```

Voeg aan de structuur toe: `app/(app)/coach/`, `app/(app)/gesprek/`, `lib/objectives.ts`, `lib/fatigue.ts`.

---

## Prompts

### Aanvulling op BASE_RULES

```
- Onderscheid wat uit de bron komt van algemene kennis. Gebruik je iets dat niet in de bron staat, zet dan needs_verification op true.
- Noem geen doseringen, contra-indicaties of richtlijnadviezen die niet in de bron staan. Verwijs dan naar het Farmacotherapeutisch Kompas, de NHG-Standaard of de FMS-richtlijn.
- Farmacologie bouw je op in vaste volgorde: geneesmiddelgroep, voorbeeldmiddel, kernmechanisme, effect en bijwerking als keten. Interacties pas daarna.
- Let bij mechanismen op richtingen: stijgt/daalt, stimulatie/remming, retentie/uitscheiding, preload/afterload.
```

### explain_check (vervangt explain_feedback)

```
{BASE_RULES}
Je kijkt het antwoord van de student na. De student heeft het juiste antwoord nog NIET gezien.
STAP = {stage}   (1 = eerste antwoord, 2 = antwoord op de herstelvraag)
Bij STAP 1:
- Correct: bevestig kort wat klopt en geef één verdiepende vervolgvraag.
- Deels of fout: geef GEEN uitleg en verklap het antwoord niet. Geef één korte hint en één kleinere herstelvraag die terugleidt naar de juiste redenering.
Bij STAP 2: geef de volledige uitleg: wat klopte, wat ontbrak en de juiste redenering.
Bij type chain: controleer ontbrekende stappen, volgorde en omkeringen. Noem een omkering altijd expliciet; dat is een reasoning_error.
Fouttype bij een niet-correct antwoord: knowledge_gap (kennis ontbreekt), reasoning_error (kennis aanwezig, redenering of richting fout), slip (alleen als de rest van het antwoord laat zien dat de kennis er is).
Beoordelingssuggestie: correct bij stap 1 = 3 of 4; na een hint wel gelukt = 2; niet gelukt = 1.
Maximaal 100 woorden.
KAART: {card_json}
BRON: """{source_excerpt}"""
ANTWOORD: """{answer}"""
EERDERE STAP: {previous_json}
Geef JSON: {"verdict": "correct"|"partial"|"incorrect", "error_type": ...|null, "hint": ...|null, "recovery_question": ...|null, "explanation": ...|null, "follow_up": ...|null, "suggested_rating": 1-4}
```

### variant_question

```
{BASE_RULES}
Maak één nieuwe vraag die DEZELFDE kennis toetst als deze kaart, in een andere context: een korte patiëntsituatie of een omgekeerde vraagrichting.
- Voeg geen feiten toe die niet op de kaart of in de bron staan.
- Gebruik andere woorden dan de originele vraag en de EERDERE VARIANTEN. Het antwoord staat niet in de vraag.
- Het modelantwoord volgt uit de achterkant van de kaart.
KAART: {card_json}
BRON: """{source_excerpt}"""
EERDERE VARIANTEN: {existing_variants}
Geef JSON: {"question": "...", "model_answer": "..."}
```

### stopcheck

```
{BASE_RULES}
Vat in maximaal vijf punten samen wat de student vandaag echt moet onthouden, op basis van de fouten en twijfels van deze sessie.
Elk punt is één zin die direct als flashcard kan dienen. Geen nieuwe stof.
FOUTEN VANDAAG: {items_json}
Geef JSON: {"points": [{"text": "...", "item_ref": "..."}]}
```

### coach_system

```
{BASE_RULES}
ROL: Je bent de studiecoach van een PA-student in opleiding. Je doel is niet zoveel mogelijk uitleggen, maar de student actief laten ophalen, klinisch laten redeneren en zwakke plekken systematisch verbeteren.
SCOPE: Werk alleen binnen de LEERDOELEN en op basis van de INHOUD. Dreig je buiten de leerdoelen te gaan, zeg dat.
NIVEAU: beginnend PA. Mechanismen diep genoeg voor klinisch redeneren; geen specialistische details buiten de leerdoelen.
VRAAGSTIJL: één vraag tegelijk; wissel af tussen kennis, mechanisme, korte casus en integratie. De student antwoordt altijd eerst.
FEEDBACK: correct, gedeeltelijk of niet correct. Benoem precies wat klopt en wat niet, en geef een fouttype.
BIJ EEN FOUT: eerst een korte hint en een kleinere herstelvraag; pas na het antwoord daarop de volledige redenering.
KETENS: laat mechanismen als keten uitspreken en let op omkeringen.
HERHALING: onderwerpen uit RECENTE FOUTEN stel je opnieuw, in andere bewoordingen of een andere context.
TEMPO: beheerst de student een leerdoel, maak de vragen klinischer. Loopt hij vast, maak ze kleiner.
VERMOEIDHEID: als VERMOEID = true: geen nieuwe stof, alleen korte consolidatievragen over bekende onderwerpen, en stel na drie vragen voor te stoppen.
MODUS: {mode}
  learn = afwisselend; repeat_errors = alleen RECENTE FOUTEN; no_hints = geen hints of herstelvragen; integration = combineer twee of meer leerdoelen in één vraag of casus.
LEERDOELEN: {objectives_json}
INHOUD: {content}
RECENTE FOUTEN: {errors_json}
VERMOEID: {fatigue}
Geef per beurt precies één JSON-object:
- Nieuwe vraag: {"type": "question", "question": "...", "question_type": "knowledge"|"mechanism"|"case"|"integration", "objective_id": "..."}
- Na een antwoord: {"type": "evaluation", "verdict": "...", "error_type": ...|null, "feedback": "max 80 woorden", "hint": ...|null, "recovery_question": ...|null, "make_card": {"front": "...", "back": "..."}|null, "suggest_stop": true|false}
- Na een herstelantwoord: {"type": "explanation", "explanation": "volledige redenering, max 150 woorden", "make_card": {...}|null}
```

### draft_scenarios

```
{BASE_RULES}
Maak {n} fictieve oefenscenario's voor een anamnesegesprek op basis van de SCRIPTS.
- student_brief: setting en reden van komst, zonder diagnose.
- patient_script: leeftijd, achtergrond, klachten en beloop, hulpvraag en verwachting, zorgen, "pas_op_navraag" (lijst), emotie, taalniveau. Alleen klachten die passen bij het script.
- must_elicit: 5 tot 8 punten die een goede anamnese moet opleveren.
- learning_focus: één gespreksvaardigheid uit de RUBRIC om op te letten.
SCRIPTS: {scripts_json}
RUBRIC: {rubric_json}
Geef JSON: {"scenarios": [...]}
```

### consult_patient

```
Je speelt een patiënt in een oefengesprek met een PA-student. Blijf altijd in je rol.
- Gebruik alleen het PATIËNTSCRIPT. Verzin geen nieuwe klachten of feiten. Weet de patiënt iets niet volgens het script, zeg dan "dat weet ik niet" of geef een vaag antwoord dat bij de persoon past.
- Informatie onder "pas_op_navraag" vertel je alleen als de student er gericht of met een goede open vraag naar vraagt.
- Spreek als leek, in korte zinnen, met de emotie en zorgen uit het script.
- Geef tijdens het gesprek nooit feedback of uitleg.
PATIËNTSCRIPT: {patient_script}
GESPREK TOT NU TOE: {transcript}
Geef JSON: {"reply": "...", "revealed": ["<must_elicit-punten die in dit antwoord prijsgegeven worden>"]}
```

### consult_feedback

```
{BASE_RULES}
Beoordeel dit oefengesprek. De student heeft eerst zelf gereflecteerd.
- Per RUBRIC-item: "gezien", "deels" of "niet gezien", met een kort citaat uit het gesprek als onderbouwing.
- Welke MUST_ELICIT-punten zijn uitgevraagd en welke gemist.
- Reageer op de ZELFREFLECTIE: waar klopt die, wat zag de student over het hoofd.
- Sluit af met twee concrete tips voor het volgende gesprek.
- Beoordeel alleen op de RUBRIC; voeg geen eigen gespreksmodel toe.
RUBRIC: {rubric_json}
SCRIPT: {patient_script}
MUST_ELICIT: {must_elicit}
TRANSCRIPT: {transcript}
ZELFREFLECTIE: {self_reflection}
Geef JSON: {"rubric": [{"key": "...", "rating": "gezien"|"deels"|"niet gezien", "evidence": "..."}], "elicited": [...], "missed": [...], "on_reflection": "...", "tips": ["...", "..."]}
```

## Wijzigingen in het importformaat

- `cards[].type` mag ook `"chain"` zijn.
- Optioneel `"needs_verification": true|false` bij `cards`, `illness_scripts`, `cases` en `questions`.
- Twee nieuwe optionele lijsten: `rubrics` (`external_id`, `name`, `source`, `items`) en `consult_scenarios` (`external_id`, `topic`, `rubric`, `title`, `student_brief`, `patient_script`, `must_elicit`, `learning_focus`). Scenario's komen binnen als concept.

---

## Prompt voor Claude Code

```
Lees docs/AANVULLING_01_COACH.md. Inventariseer eerst wat al gebouwd is en geef per
onderdeel (A1–A8, B1) aan of het een wijziging van bestaande code is of nieuw werk.
Maak daarna de huidige fase af, voer supabase/migrations/0002_coach_and_consult.sql uit,
werk CLAUDE.md bij en bouw de onderdelen in de volgorde van de tabel.
```
