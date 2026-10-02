# Installatie: Supabase, Vercel en lokaal ontwikkelen

Dit doe je één keer zelf. Claude Code kan het niet voor je doen, omdat het om je eigen accounts en sleutels gaat.

## 1. Supabase-project

1. Maak op [supabase.com](https://supabase.com) een nieuw project in regio **Frankfurt (eu-central-1)**.
2. Noteer onder **Project Settings → API** de project-URL, de `anon`/publishable key en de `service_role`/secret key.
3. **Database klaarzetten.** Kies één van twee manieren:
   - Met de terminal: `npx supabase login`, `npx supabase link --project-ref <ref>` en `npx supabase db push`.
   - Of in het dashboard: **SQL Editor**, plak `supabase/migrations/0001_init.sql`, voer uit, en daarna `0002_phase1.sql`.
4. **Authentication → URL Configuration**
   - *Site URL*: je Vercel-adres (bijv. `https://pa-studie.vercel.app`). Zolang je die nog niet hebt: `http://localhost:3000`.
   - *Redirect URLs*: `http://localhost:3000/**` en `https://<jouw-vercel-adres>/**`.
5. **Authentication → Emails → Templates.** Zet in **Magic Link** én **Confirm signup**:
   - Onderwerp: `Je inlogcode voor PA Studie`
   - Inhoud: de inhoud van `supabase/templates/magic_link.html` (voor Confirm signup: `confirmation.html`).

   Daardoor bevat de mail een **code**. Die heb je nodig op de telefoon: een app op het beginscherm deelt geen cookies met Safari of Chrome, dus een link uit de mail logt je daar niet in. De code werkt overal.
6. **Na je eerste login:** zet onder **Authentication → Sign In / Providers** de optie *Allow new users to sign up* uit. Dan kan niemand anders een account aanmaken, ook niet buiten de app om. De app controleert daarnaast altijd `ALLOWED_EMAIL`.

> **Mail-limiet.** De ingebouwde mailservice van Supabase verstuurt maar een paar mails per uur, en alleen naar adressen van je Supabase-team (dat ben jij). Inloggen gebeurt zelden, omdat je sessie blijft bestaan, dus meestal is dat genoeg. Loop je er toch tegenaan, stel dan onder **Authentication → Emails → SMTP Settings** een eigen SMTP-dienst in (bijv. Resend of Postmark).

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
- `npm run test:e2e`: rooktest in de browser tegen de lokale Supabase. Die wist de voorbeeldmodule en draait daarom alleen als `NEXT_PUBLIC_SUPABASE_URL` naar localhost wijst.
- `npm run db:types`: TypeScript-types opnieuw genereren na een migratie.
