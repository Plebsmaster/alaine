# Installatie: Supabase, Vercel en lokaal ontwikkelen

Dit doe je één keer zelf. Claude Code kan het niet voor je doen, omdat het om je eigen accounts en sleutels gaat.

## 1. Supabase-project

1. Maak op [supabase.com](https://supabase.com) een nieuw project in regio **Frankfurt (eu-central-1)**.
2. Noteer onder **Project Settings → API** de project-URL, de `anon`/publishable key en de `service_role`/secret key.
3. **Database klaarzetten.** Kies één van twee manieren:
   - Met de terminal: `npx supabase login`, `npx supabase link --project-ref <ref>` en `npx supabase db push`.
   - Of in het dashboard: **SQL Editor**: voer de bestanden in `supabase/migrations/` één voor één uit, in volgorde (`0001_init.sql`, `0002_phase1.sql`, `0003_phase3.sql`, `0004_phase2.sql`, `0005_aanvulling_a.sql`, …). Komt er later een nieuw bestand bij, voer dan alleen dat uit.
4. **Authentication → URL Configuration**
   - *Site URL*: je Vercel-adres (bijv. `https://pa-studie.vercel.app`). Zolang je die nog niet hebt: `http://localhost:3000`.
   - *Redirect URLs*: `http://localhost:3000/**` en `https://<jouw-vercel-adres>/**`.
5. **Authentication → Emails → Templates.** Zet in **Magic Link** én **Confirm signup**:
   - Onderwerp: `Je inlogcode voor PA Studie`
   - Inhoud: de inhoud van `supabase/templates/magic_link.html` (voor Confirm signup: `confirmation.html`).

   Daardoor bevat de mail een **code**. Die heb je nodig op de telefoon: een app op het beginscherm deelt geen cookies met Safari of Chrome, dus een link uit de mail logt je daar niet in. De code werkt overal.

   Controleer onder **Authentication → Sign In / Providers → Email** dat *Email OTP Length* op **6** staat: het inlogscherm heeft zes vakjes (`OTP_LENGTH` in `app/(auth)/login/otp.ts`, gelijk aan `otp_length` in `supabase/config.toml`).
6. **Na je eerste login:** zet onder **Authentication → Sign In / Providers** de optie *Allow new users to sign up* uit. Dan kan niemand anders een account aanmaken, ook niet buiten de app om. De app controleert daarnaast altijd `ALLOWED_EMAIL`.

> **Mail-limiet.** De ingebouwde mailservice van Supabase verstuurt maar een paar mails per uur, en alleen naar adressen van je Supabase-team (dat ben jij). Inloggen gebeurt zelden, omdat je sessie blijft bestaan, dus meestal is dat genoeg. Loop je er toch tegenaan, stel dan onder **Authentication → Emails → SMTP Settings** een eigen SMTP-dienst in (bijv. Resend of Postmark).


### AI lokaal zonder API-key (Claude Code)

Draai je de app lokaal, dan kan de AI ook via je eigen Claude-account lopen in plaats van met een API-key:

1. Log op deze laptop in met de Claude Code-CLI: `claude auth login` (eenmalig; controleer met `claude auth status`).
2. Zet in `.env.local`: `AI_PROVIDER=claude-code` en laat `ANTHROPIC_API_KEY` leeg (een key gaat altijd voor).
3. Herstart de server.

De server roept dan per AI-aanroep `claude -p` aan, zonder tools, projectinstellingen of MCP, met dezelfde prompts en dezelfde controle van de uitvoer. Het gebruik telt mee in de limieten van je Claude-account en wordt net zo gelogd in `ai_usage`. Een aanroep duurt een paar seconden langer dan via de API. Online (Vercel) werkt dit niet; daar blijft `ANTHROPIC_API_KEY` nodig. Staat `claude` niet in je PATH, zet dan `CLAUDE_CODE_BIN` op het volledige pad.

## 2. Vercel

1. Importeer de GitHub-repository op [vercel.com](https://vercel.com/new).
2. Zet onder **Settings → Environment Variables** (Production en Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ALLOWED_EMAIL`
   - vanaf fase 2: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_MODEL_FAST`

   De `SUPABASE_SERVICE_ROLE_KEY` hoort **niet** in Vercel; die gebruik je alleen lokaal voor `npm run import`.
3. `vercel.json` zet de serverfuncties in Frankfurt (`fra1`), dicht bij je database.
4. Na de eerste deploy: zet het Vercel-adres als *Site URL* en *Redirect URL* in Supabase (stap 1.4).

## 3. Op je telefoon

Open je Vercel-adres in Safari (iPhone) of Chrome (Android) en kies **Zet op beginscherm** / **App installeren**. Log daarna in de app in met de code uit de mail.

## 4. Lokaal ontwikkelen (optioneel)

Met Docker kun je een volledige Supabase op je laptop draaien, inclusief een testmailbox.

```bash
npm install
npx supabase start          # database, auth, storage en Mailpit; past de migraties toe
cp .env.example .env.local  # vul in met de lokale waarden die supabase start toont
npm run dev                 # http://localhost:3000
```

- Inlogmails lokaal lezen: http://127.0.0.1:54324 (Mailpit).
- `npm test`: unit tests (FSRS, wachtrij, importer).
- `npm run test:e2e`: rooktest in de browser tegen de lokale Supabase. Draait met een eigen testgebruiker (`e2e@pa-studie.test`, of `E2E_EMAIL`) op een eigen productieserver (poort 3100), zodat je eigen data onaangeroerd blijft. Wist alleen de voorbeeldmodule van die testgebruiker en draait alleen als `NEXT_PUBLIC_SUPABASE_URL` naar localhost wijst.
- AI-tests zonder echte API-key: start de app met `ALLOWED_EMAIL=e2e@pa-studie.test ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm run start -- -p 3001` en draai `E2E_AI=1 E2E_BASE_URL=http://localhost:3001 npx playwright test tests/e2e/ai.spec.ts`. De test start zelf een nagebootste API op poort 4010.
- `npm run db:types`: TypeScript-types opnieuw genereren na een migratie.
