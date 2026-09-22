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
  Das Datenbankschema fuer Push-Abos und interne Nachrichten
- `supabase/migrations/20260428204158_new-migration.sql`
  Das Datenbankschema fuer das Website-Menue
- `supabase/migrations/20260429_site_settings.sql`
  Das Datenbankschema fuer globale Website-Einstellungen wie Wartungsmodus
- `supabase/migrations/20260525180000_menu_periods.sql`
  Erweitert das Website-Menue um Zeitfenster wie Fruehstueck, Mittag und Abend
- `supabase/migrations/20260525193000_menu_period_arrays.sql`
  Erweitert die Zeitfenster auf Mehrfachauswahl wie Mittag und Abend gleichzeitig
- `supabase/migrations/20260605190000_menu_item_types_orders.sql`
  Fuegt `item_type` fuer Speisen und Getraenke hinzu und legt die Bestell-Tabelle an
- `supabase/migrations/20260922000000_posters_stickers.sql`
  Erweitert die Website-Inhalte um Poster und Sticker
- `supabase/functions/push-api/index.ts`
  Die HTTP-API fuer
  - `GET /menu`
  - `GET /drinks`
  - `GET /print-products`
  - `GET /site-settings`
  - `GET /menu-admin`
  - `GET /orders-admin`
  - `GET /staff-auth`
  - `GET /site-settings-admin`
  - `GET /subscriptions-admin`
  - `POST /menu-admin`
  - `POST /orders`
  - `POST /orders-admin`
  - `POST /site-settings-admin`
  - `POST /subscriptions-admin`
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
- `EMPLOYEE_CODE_HASH` fuer das Mitarbeiterportal (nur Bestellungen und Website-Inhalte)
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
  EMPLOYEE_CODE_HASH="SHA256_HASH_DES_MITARBEITERCODES" \
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

## Mitarbeiter-Code einrichten

Erzeuge den SHA-256-Hash des Mitarbeiter-Codes mit demselben PowerShell-Befehl und speichere ihn ausschließlich als Supabase Secret `EMPLOYEE_CODE_HASH`. Der Code wird nicht in `app-config.js` hinterlegt. Mitarbeitende melden sich dann unter `mitarbeiter/index.html` an und können nur Bestellungen sowie Menü-, Poster- und Sticker-Inhalte verwalten.

## Danach auf GitHub Pages

Diese Dateien muessen im Pages-Repo liegen:

- `index.html`
- `service-worker.js`
- `manifest.webmanifest`
- `app-config.js`
- `inbox/index.html`
- `admin/index.html`
- `mitarbeiter/index.html`
- `poster-sticker/index.html`
- `sticker/index.html`
- `apple-touch-icon.png`
- `icon-192.png`
- `icon-512.png`
- `winkelwerlk.png`
- `.nojekyll`

## Wichtiger Hinweis

Die Portale sind statische Seiten. Die echte Sicherheitsprüfung liegt im Backend: Der Admin-Code schützt Push, Wartungsmodus und Abonnenten; der Mitarbeiter-Code schützt Bestellungen sowie Menü-, Poster- und Sticker-Inhalte.
