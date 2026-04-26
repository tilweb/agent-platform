# Customer-PoC-Setup — Workplace als Basis für individuelle Kunden-Projekte

Dieses Dokument beschreibt das Vorgehen, um die Workplace-Plattform als PoC-Basis für einen neuen Kunden bereitzustellen. Eine Code-Basis, ein Railway-Service je Kunde, Konfiguration ausschließlich über Environment-Variablen.

## Architektur-Prinzipien

- **Single-Branch-Workflow**: alle Customer-Services deployen vom selben Branch (heute `demo/messe`, später `main`). Eine Feature-Entwicklung ist automatisch für alle Kunden verfügbar — was sie sehen, regelt nur die ENV-Whitelist.
- **Ein Railway-Service pro Kunde**: eigenes Volume → komplette Datentrennung (User, Sessions, Chats, API-Keys, Audit-Logs).
- **Per-Customer-Konfiguration via ENV**: aktive Apps, Branding, LLM-Provider — alles in den Railway-Environment-Variablen.
- **Customer-spezifische Apps liegen im Haupt-Repo** unter `backend/src/apps/<kunde-x>/` und `frontend/src/apps/<kunde-x>/`. Damit Erweiterungen, die im PoC #N entstehen, automatisch auch in PoC #N+1 nutzbar werden.

---

## Schritt 1 — Railway-Service anlegen

1. Im Railway-Project (oder neues Project) einen neuen Service aus dem Repo `tilweb/agent-platform` erstellen.
2. **Branch wählen**: `demo/messe` (bzw. später `main`).
3. **Volume mounten**: Pfad `/app/data`, Größe nach Bedarf (1–5 GB für PoCs reichen typischerweise).

> **Wichtig**: Volumes sind per Service eindeutig — pro Kunde ein eigenes Volume, kein Sharing.

---

## Schritt 2 — Environment-Variablen setzen

### Pflicht (Standard-Workplace-Betrieb)

```sh
# Adacor AI Provider — Chat + Vision + Audio nutzen denselben Key
ADACOR_AI_API_KEY=<dein-adacor-key>

# Embedding-Provider (für RAG, wzbar-matcher etc.)
PLATFORM_EMBEDDINGS_PROVIDER_ID=adacor-embeddings
PLATFORM_EMBEDDINGS_MODEL_ID=multilingual-e5-large

# Frontend-URL des Service (Railway-URL oder Custom-Domain)
FRONTEND_URL=https://<service-host>
```

Optional je nach Anwendungsfall: `GOOGLE_AI_API_KEY`, `FAL_AI_API_KEY`, `TAVILY_API_KEY`, etc. (siehe `backend/.env.example`).

### Customer-spezifisch (das Herzstück dieses Setups)

```sh
# App-Whitelist — nur die hier gelisteten Apps sind im Workplace sichtbar.
# Format: kommagetrennte Liste der App-IDs.
# Wenn nicht gesetzt: alle Built-In-Apps verfügbar (Demo-Mode).
ENABLED_APPS=wzbar-matcher,kunde-x-app

# Branding (Login, Sidebar, Browser-Tab-Title)
PLATFORM_TITLE=Workplace — Kunde X
PLATFORM_LOGO_URL=https://cdn.example.com/kunde-x/logo.svg
PLATFORM_LOGIN_SUBTITLE=PoC für Kunde X    # optional, kleiner Text unter dem Login-Header

# Demo-Passwort für die geseedeten Standard-User (demo1-demo4 etc.)
DEMO_PASSWORD=<gewähltes-passwort>
```

### Aktuelle App-IDs (Stand 2026-04-26)

| ID | Name | Sinnvoll für PoC? |
|---|---|---|
| `vertragsmanagement` | Vertragsmanagement | ja, falls Use-Case passt |
| `projektmanagement` | Projektmanagement | ja |
| `lieferantenmanagement` | Lieferantenmanagement | ja |
| `vsm` | Value Stream Mapping | ja |
| `wzbar-matcher` | WZ-Branchen-Matcher | nur für IHK-Use-Case |

Custom-Apps (z.B. `kunde-x-app`) ergänzen sich dynamisch — siehe Schritt 5.

---

## Schritt 3 — Erstes Deployment

1. Railway triggert beim Push auf den Branch automatisch einen Build.
2. Beim ersten Start initialisiert das Backend das Volume aus dem Seed-Image (Provider-Configs, leere User-DB).
3. Das `seed-demo-users.ts`-Script legt die Standard-Demo-User an (`demo1-demo4`, `marketing1-3`, `ruhrpm`, `people1`, `yneo-ai`) — alle mit dem oben gesetzten `DEMO_PASSWORD` (außer `ruhrpm`/`people1`/`yneo-ai`, die haben fixe Passwörter im Script).
4. `syncBuiltInApps()` wertet `ENABLED_APPS` aus und aktiviert nur die freigegebenen Apps.

---

## Schritt 4 — Initial-Admin sicherstellen

Aktuell hat `seed-demo-users.ts` keinen `role: admin` als Default. Empfohlen:

1. Mit `demo1` einloggen (hat in der Demo `role: admin`, übernehme das ggf. ins Seed-Script).
2. Oder via Setup-API direkt einen Admin anlegen (siehe `backend/src/routes/auth.ts` → Self-Registration ist erlaubt, wenn `REGISTRATION_DISABLED` nicht gesetzt ist).
3. Über die Admin-UI in Einstellungen → Benutzer dann weitere Accounts anlegen.

> **Tipp**: Falls der Kunde eine kontrollierte User-Base will, `REGISTRATION_DISABLED=true` setzen und User nur per Admin-UI anlegen.

---

## Schritt 5 — Customer-spezifische App entwickeln

Für eine neue App (z.B. `kunde-x-app`):

### Backend

1. Verzeichnis anlegen: `backend/src/apps/kunde-x-app/`
2. Pflicht-Dateien (analog zu `wzbar-matcher`):
   - `index.ts` — exportiert `kundeXAppConfig: AppConfig`
   - `routes.ts` — Hono-Router mit den App-spezifischen Endpoints
   - `service.ts` — Business-Logik
   - `storage.ts` — Datenpersistenz (YAML/JSON unter `data/apps/kunde-x-app/`)
   - `types.ts` — TypeScript-Typen
3. In `backend/src/apps/registry.ts`:
   - Import der Config: `import { kundeXAppConfig } from './kunde-x-app';`
   - Eintrag im `BUILT_IN_APPS`-Array ergänzen
4. In `backend/src/routes/apps.ts`:
   - Import: `import { kundeXAppRoutes } from '../apps/kunde-x-app/routes';`
   - Mount: `apps.route('/kunde-x-app', kundeXAppRoutes);`
   - In den Sub-Route-Filter (Zeile ~60) den App-Namen ergänzen, damit `GET /api/apps/:appId` nicht fälschlich matcht.

### Frontend

1. Verzeichnis: `frontend/src/apps/kunde-x-app/`
2. Mindestens eine Komponente, z.B. `MainPage.jsx`, theme-konform mit Inline-Styles.
3. In `frontend/src/App.jsx`:
   - Lazy-Import: `const KundeXAppPage = lazy(() => import('./apps/kunde-x-app/MainPage'));`
   - Route ergänzen: `<Route path="/apps/kunde-x-app" element={<KundeXAppPage />} />`

### Optional — als Public-API freigeben

Wenn die App-Logik auch von externen Systemen aufrufbar sein soll (oder als Agent-Tool nutzbar):

```typescript
// backend/src/apps/kunde-x-app/public-functions.ts
export const myFunction: PublicFunction = {
  id: 'my-function',
  description: 'Was die Funktion macht',
  input: { type: 'object', properties: { ... }, required: [...] },
  output: { type: 'object', ... },
  defaultRateLimit: { requests: 60, windowSec: 60 },
  handler: async (input, ctx) => { /* ... */ },
};

// In backend/src/apps/kunde-x-app/index.ts:
import { myFunction } from './public-functions';
export const kundeXAppConfig: AppConfig = {
  id: 'kunde-x-app',
  ...
  publicFunctions: [myFunction],
};
```

Damit ist die Funktion automatisch:
- per HTTP unter `POST /api/public/v1/kunde-x-app/my-function` erreichbar (mit API-Key)
- als Agent-Tool `kunde-x-app__my-function` registriert (für Agents)
- in der OpenAPI-Spec unter `GET /api/public/v1/openapi.json` dokumentiert

API-Keys werden über das Admin-UI angelegt (Einstellungen → API-Keys).

### Aktivieren im Customer-Service

Im Railway-ENV `ENABLED_APPS` die neue ID ergänzen:

```sh
ENABLED_APPS=wzbar-matcher,kunde-x-app
```

Service einmal redeployen — die App taucht in der Sidebar auf.

---

## Schritt 6 — Updates & Roll-out

- **Default**: alle Customer-Services deployen vom Tip des konfigurierten Branches. Push auf den Branch → alle Services rebuilden parallel.
- **Frozen-State**: einen Service auf einen spezifischen Git-Commit/Tag pinnen, wenn man ein bestimmtes Setup für eine Demo "einfrieren" will.
- **Cross-Customer-Refactoring**: wenn Kunde-Y später eine App nutzen will, die für Kunde-X gebaut wurde — einfach `ENABLED_APPS` erweitern. Code lebt schon im Repo.

---

## Schritt 7 — Troubleshooting

### App ist nach Deploy nicht in der Sidebar sichtbar
- Server-Log prüfen: `[apps] Built-in sync (ENV filter: ...)` zeigt, welche IDs durchgelassen werden.
- Settings → Apps → falls App dort als `enabled: false` mit dem Hinweis "via ENV deaktiviert" steht, fehlt sie in der `ENABLED_APPS`-Liste.

### Logo lädt nicht
- Browser-Console nach CSP-Fehlern absuchen.
- Wenn `PLATFORM_LOGO_URL` extern ist: das Backend fügt die Origin automatisch zur CSP `img-src`-Whitelist hinzu — nur eine HTTPS-URL muss angegeben werden, kein zusätzlicher CSP-Header.

### Demo-User können sich nicht einloggen
- Volume neu? `seed-demo-users.ts` läuft beim Container-Start einmal — Logs prüfen.
- Falls User existiert aber Login schlägt fehl: `DEMO_PASSWORD` ENV setzen und Service neu starten (idempotenter Skip — User wird NICHT überschrieben). Wenn das Passwort schon falsch persistiert ist, muss der User-File im Volume manuell gelöscht und der Seed-Script neu laufen.

### Public-API gibt 401 zurück trotz Bearer-Token
- Key prüfen: `bun run scripts/api-keys.ts list` im Service-Container.
- ENV `PLATFORM_EMBEDDINGS_*` prüfen — fehlt das, schlägt der wzbar-matcher zur Laufzeit fehl (aber das wäre 500, nicht 401).

---

## Out-of-Scope für PoC-Setups

- Color-Theme & Custom-Domain (nur Title + Logo derzeit)
- Eigener Login-Screen pro Kunde mit Texten/AGB
- Auto-Scaling, Multi-Region
- Zentrale Telemetry über alle Customer-Services hinweg

Diese Punkte machen Sinn, wenn ein PoC zur Produktion wird — dann lohnt sich der zusätzliche Aufwand.
