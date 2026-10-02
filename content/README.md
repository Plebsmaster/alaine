# Studiestof

Zet hier je studiestof neer. Deze map staat in `.gitignore`: niets hieruit gaat naar GitHub, behalve dit bestand en `voorbeeld-import.json`.

## Indeling

```
content/
  module-1/
    00-studiehandleiding/        studiehandleiding (pdf): leerdoelen, toetsvorm, toetsdata
    01-geneeskundig-proces/
    02-ritmestoornissen/
    03-kno/
    04-lage-rugklachten/
    05-hypertensie/
    06-dermatologie/
      beelden/                   eigen of open-access afbeeldingen voor beeldkaarten
    practica/                    handleidingen lichamelijk onderzoek
  leerlijnen/
    farmacotherapie/
    vaardigheden/
  out/                           gegenereerde importbestanden (niet zelf aanpassen)
```

## Per themamap

| Bestand | Inhoud |
| --- | --- |
| `leerdoelen.md` | De leerdoelen van dit thema, letterlijk en met nummer |
| Hoofdstukken | Alleen de hoofdstukken die bij dit thema horen, als pdf of foto's, bijv. `martini-h15-ademhalingsstelsel.pdf` |
| Slides | Collegeslides als pdf |
| `notities.md` | Optioneel: wat de docent benadrukte, eigen aantekeningen, toetstips |
| Opdrachten | Opdrachten die je al gemaakt hebt; goed materiaal voor uitlegkaarten |

Tips:
- Zet het hoofdstuknummer of de paginanummers in de bestandsnaam; dan krijgen kaarten een goede bronverwijzing.
- Liever drie relevante hoofdstukken dan een heel boek.
- Geen patiëntgegevens, ook niet in notities van stage.
