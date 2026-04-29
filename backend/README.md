# Kostenloses Backend fuer GitHub Pages

Die Website kann komplett auf GitHub Pages liegen. Fuer echte Web-Push-Nachrichten brauchst du zusaetzlich ein kleines Backend.

## Empfohlene Gratis-Loesung

Am einfachsten ist **Supabase Free**:

- eine kostenlose Postgres-Datenbank
- Edge Functions fuer deine Push-API
- genug fuer ein kleines privates Projekt

Offizielle Infos:

- GitHub Pages ist statisches Hosting: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Supabase Edge Functions Pricing: https://supabase.com/docs/guides/functions/pricing
- Supabase Edge Function Limits: https://supabase.com/docs/guides/functions/limits

## Was in diesem Ordner schon fertig ist

- `supabase/migrations/20260427_push.sql`
  Das Datenbankschema fuer Push-Abos, interne Nachrichten und das Website-Menue
- `supabase/functions/push-api/index.ts`
  Die HTTP-API fuer
  - `GET /menu`
  - `GET /menu-admin`
  - `POST /menu-admin`
  - `POST /subscribe`
  - `POST /unsubscribe`
  - `POST /send`

## So bekommst du das Backend gratis

1. Erstelle ein kostenloses Projekt bei Supabase.
2. Installiere lokal die Supabase CLI.
3. Fuehre die SQL-Datei aus oder nutze eine Migration:

```sql
-- Inhalt aus backend/supabase/migrations/20260427_push.sql
```

4. Erzeuge VAPID-Keys fuer Web Push.

Wenn du Node installiert hast:

```bash
npx web-push generate-vapid-keys
```

5. Hinterlege die Secrets in Supabase.

Du brauchst nur diese eigenen Secrets:

- `ADMIN_CODE_HASH`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_CONTACT_EMAIL`

Hinweis:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

sind in Edge Functions bereits als Standard-Umgebungsvariablen verfuegbar und muessen nicht extra gesetzt werden.

Beispiel:

```bash
supabase secrets set \
  ADMIN_CODE_HASH="DEIN_SHA256_HASH" \
  VAPID_PUBLIC_KEY="DEIN_VAPID_PUBLIC_KEY" \
  VAPID_PRIVATE_KEY="DEIN_VAPID_PRIVATE_KEY" \
  VAPID_CONTACT_EMAIL="du@beispiel.de"
```

6. Deploye die Function:

```bash
supabase functions deploy push-api --no-verify-jwt
```

7. Trage die Werte in deine Website ein:

Datei: `app-config.js`

```js
window.WINKELWERK_APP_CONFIG = {
  pushApiBaseUrl: "https://DEIN-PROJEKT.functions.supabase.co/push-api",
  vapidPublicKey: "DEIN_VAPID_PUBLIC_KEY",
  adminCodeHash: "DEIN_SHA256_HASH"
};
```

## Admin-Code hashen

Wenn du deinen Admin-Code aendern willst, kannst du den SHA-256-Hash in PowerShell so erzeugen:

```powershell
$code = 'DEIN-CODE'
$sha = [System.Security.Cryptography.SHA256]::Create()
$bytes = [System.Text.Encoding]::UTF8.GetBytes($code)
($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
```

Den erzeugten Hash traegst du dann ein in:

- `app-config.js` als `adminCodeHash`
- Supabase Secret `ADMIN_CODE_HASH`

## Danach auf GitHub Pages

Diese Dateien muessen im Pages-Repo liegen:

- `index.html`
- `service-worker.js`
- `manifest.webmanifest`
- `app-config.js`
- `inbox/index.html`
- `admin/index.html`
- `apple-touch-icon.png`
- `icon-192.png`
- `icon-512.png`
- `winkelwerlk.png`
- `.nojekyll`

## Wichtiger Hinweis

Die Admin-Seite selbst ist weiterhin eine statische Seite. Die echte Sicherheitspruefung fuer das Versenden liegt deshalb im Backend ueber `x-admin-code` + `ADMIN_CODE_HASH`.
