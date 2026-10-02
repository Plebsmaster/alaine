# PA Studie-app — start hier

Dit pakket is alles wat Claude Code nodig heeft om je studie-app te bouwen: een Next.js-webapp met Supabase die je op je laptop en telefoon gebruikt. De leermethode komt uit het leerplan: overhoren met feedback, gespreid herhalen met FSRS, illness scripts, casussen met gestructureerde reflectie en interleaving.

## Wat er in dit pakket zit

| Bestand | Waarvoor |
| --- | --- |
| `CLAUDE.md` | Projectinstructies die Claude Code bij elke sessie automatisch leest |
| `docs/SPEC.md` | Functionele en technische specificatie, per fase met acceptatiecriteria |
| `docs/IMPORT_FORMAT.md` | Het JSON-formaat waarmee studiestof in de app komt |
| `docs/AI_PROMPTS.md` | De AI-functies, hun prompts en de vangrails |
| `docs/CONTENT_PIPELINE.md` | Hoe Claude Code van jouw pdf's en leerdoelen importbestanden maakt |
| `supabase/migrations/0001_init.sql` | Het databaseschema met beveiliging per gebruiker |
| `content/README.md` | Waar je je studiestof neerzet |
| `content/voorbeeld-import.json` | Een klein voorbeeldbestand om de import mee te testen |
| `.gitignore` | Houdt je studiestof en geheime sleutels buiten GitHub |

## Stap 1: regel dit zelf, vóór je Claude Code start

1. **GitHub**: maak een **privé** repository, bijvoorbeeld `pa-studie-app`, en zet de inhoud van dit pakket erin.
2. **Supabase**: maak een nieuw project in regio **Frankfurt (eu-central-1)**, zodat je data in de EU blijft.
   - Noteer de project-URL, de `anon`-key en de `service_role`-key (Project Settings → API).
   - Zet bij Authentication → URL Configuration je lokale URL (`http://localhost:3000`) en later je Vercel-URL.
3. **Anthropic API-key** (console.anthropic.com) voor de AI-functies. Pas nodig vanaf fase 2.
4. **Vercel**: koppel later de GitHub-repo voor de online versie.

## Stap 2: maak `.env.local` aan (deel deze nooit in een chat of commit)

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

**Fase 0 en 1: basis en herhalen**
```
Lees CLAUDE.md en docs/SPEC.md. Bouw fase 0 en fase 1 volgens de spec, inclusief
de migratie in supabase/migrations. Werk de acceptatiecriteria af en test de import
met content/voorbeeld-import.json. Stel vragen als iets in de spec onduidelijk is.
```

**Fase 2: goedkeuren en AI-concepten**
```
Bouw fase 2 uit docs/SPEC.md. Gebruik de prompts en vangrails uit docs/AI_PROMPTS.md.
```

**Studiestof omzetten (kan parallel aan fase 2)**
```
Volg docs/CONTENT_PIPELINE.md voor thema <naam> in content/module-1/.
Maak het importbestand en laat me de samenvatting zien voordat je importeert.
```

**Fase 3 tot en met 6**
```
Bouw fase <n> uit docs/SPEC.md.
```

## Wat je níet deelt

- Keys in de chat of in Git (alleen in `.env.local` en in Vercel).
- Patiëntgegevens. Stagecasussen schrijf je altijd geanonimiseerd.
- Boek-pdf's in Git. Ze blijven lokaal in `content/`.
