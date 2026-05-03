# Scalingo Deployment

## Architektur-Annahmen

- **Code:** GitHub-Branch `main`.
- **Hosting:** Scalingo (Region Paris-DC, ISO 27001 + HDS).
- **DB:** Scalingo Postgres-Addon. Setzt `SCALINGO_POSTGRESQL_URL` automatisch — unser Code liest `SCALINGO_POSTGRES`, Aliasing erfolgt im Custom-Buildpack via `.profile.d/`-Script (siehe Section 6).
- **Object-Storage:** Flow.swiss S3-kompatibel (`os.alp1.flow.swiss`, GDPR/Schweiz).
- **Build:** Multi-Buildpack ueber `.buildpacks`-File. Erstes Buildpack `Scalingo/apt-buildpack` installiert ffmpeg + ca-certificates (siehe `Aptfile`). Zweites Buildpack ist unser Custom-Buildpack `tilweb/scalingo-agent-platform-buildpack` — installiert Node 20 LTS + Bun (gepinnt), baut Frontend (Vite), installiert Backend-Deps (Bun). Scalingo unterstuetzt KEIN Dockerfile-Build; das `Dockerfile` im Repo wird nur fuer Railway/lokale Container-Builds genutzt.
- **Persistenz:** vollstaendig in DB+S3 — kein Volume-Mount, kein Disk-State zwischen Deploys.

## Erst-Deploy Schritt-fuer-Schritt

### 1. Scalingo-App anlegen

```sh
# Login (einmalig)
scalingo login

# App erstellen
scalingo create workplace-prod --region osc-fr1

# Postgres-Addon hinzufuegen (Sandbox-Plan zum Start, spaeter scale-up moeglich)
scalingo --app workplace-prod addons-add postgresql postgresql-sandbox
```

Scalingo setzt `SCALINGO_POSTGRES` automatisch. Der Connection-String ist via `scalingo --app workplace-prod env-get SCALINGO_POSTGRES` einsehbar.

### 2. ENV-Variablen setzen

```sh
APP=workplace-prod

# Flow.swiss S3 (Zugangsdaten aus Flow-Console)
scalingo --app $APP env-set \
  FLOW_S3_ENDPOINT=https://os.alp1.flow.swiss \
  FLOW_S3_MASTER='<flow-access-key>' \
  FLOW_S3_SECRET='<flow-secret-key>' \
  FLOW_S3_BUCKET=workplace-prod

# Adacor AI API
scalingo --app $APP env-set \
  ADACOR_AI_API_KEY='<adacor-key>' \
  MARKITDOWN_API_URL=https://api.adacor.ai/v1/documentMarkdown/

# fal.ai (optional, fuer Bildgenerierung)
scalingo --app $APP env-set FAL_AI_API_KEY='<fal-key>'

# Encryption-Schluessel (KRITISCH — bei Verlust sind OAuth-Tokens nicht mehr lesbar)
# WICHTIG: CONNECTION_ENCRYPTION_KEY muss exakt 64 Hex-Zeichen sein (32 Bytes).
# scalingo.json hat `generator: secret` als Default — Format ist nicht garantiert,
# deshalb explizit per CLI mit openssl setzen.
scalingo --app $APP env-set \
  CONNECTION_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  SESSION_SECRET="$(openssl rand -hex 32)"

# Demo-Passworte (optional, Defaults sind in scalingo.json)
scalingo --app $APP env-set \
  DEMO_PASSWORD='Demo2026!' \
  MARKETING_PASSWORD='Marketing2026!'

# Branding (Customer-PoC)
scalingo --app $APP env-set \
  PLATFORM_TITLE='Workplace' \
  FRONTEND_URL='https://workplace-prod.osc-fr1.scalingo.io' \
  API_BASE_URL='https://workplace-prod.osc-fr1.scalingo.io'

# Apps-Whitelist (leer lassen = alle Apps aktiv)
# scalingo --app $APP env-set ENABLED_APPS='wzbar-matcher,vertragsmanagement'
```

### 3. Buildpack-Setup verifizieren

Scalingo deployed ueber **Multi-Buildpack** — wir kombinieren Scalingo's offiziellen `apt-buildpack` (fuer ffmpeg) mit unserem Custom-Buildpack (Node + Bun + App-Build).

Das `agent-platform`-Repo hat bereits am Root:
- `.buildpacks` — listet die Buildpack-URLs (apt + custom-bun)
- `Aptfile` — System-Pakete fuer apt-buildpack (ffmpeg, ca-certificates)
- `Procfile` — Start-Command (`web: cd backend && bun run src/index.ts`)

Falls auf der Scalingo-App vorher `CONTAINER_FILE` oder `BUILDPACK_URL` gesetzt war (z.B. von einem alten Deploy-Versuch), unbedingt entfernen — sonst kollidiert das mit dem `.buildpacks`-File:

```sh
scalingo --app $APP env-unset CONTAINER_FILE BUILDPACK_URL || true
```

Das Custom-Buildpack-Repo (`tilweb/scalingo-agent-platform-buildpack`) muss **public auf GitHub** liegen — die `.buildpacks`-Zeile referenziert es per `https://`-URL. Falls private: SSH-Private-Key-Buildpack als ersten Eintrag in `.buildpacks` ergaenzen, dann `git@github.com:...`-URLs verwenden.

### 4. GitHub-Integration einrichten

In der Scalingo-Web-Console:

1. **App** → **Deployments** → **Link with GitHub** → Repo `tilweb/agent-platform` waehlen.
2. **Deploy Branch** → `main` setzen.
3. **Auto-Deploy** aktivieren (jeder Push auf `main` triggert ein Rebuild).
4. **Manual deploy** klicken oder via CLI:
   ```sh
   scalingo --app $APP deployments-list
   ```

### 5. Erst-Boot beobachten

```sh
scalingo --app $APP logs --lines 200
```

Erwarteter Output:
```
[db] migrations applied in ~50ms (folder: ./drizzle)
[seed] Demo users created: 10
[skills] Seeded 9 custom skills from disk: ...
[projects] Seeded 2 projects from disk: ...
[chats] Seeded 213 chats from disk
[kb] Seeded 7 collections, 17 documents
[s3] bucket "workplace-prod" created.
LLM Service initialized: Adacor AI - Qwen 3 30B (256k)
Tools initialized: 23 total
🚀 Server starting on port 3001
```

### 6. Funktionstest

```sh
URL=https://workplace-prod.osc-fr1.scalingo.io

# Health-Check
curl -s ${URL}/health

# Branding (no-auth)
curl -s ${URL}/api/branding

# Security-Header-Check: HSTS muss in production gesetzt sein
curl -sI ${URL}/health | grep -i "strict-transport-security"
# Erwartet: Strict-Transport-Security: max-age=31536000; includeSubDomains

# Login
curl -s -X POST ${URL}/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo1","password":"Demo2026!"}' \
  -c /tmp/sc-cookies.txt

# Authenticated
curl -s -b /tmp/sc-cookies.txt ${URL}/api/auth/me
curl -s -b /tmp/sc-cookies.txt ${URL}/api/knowledge/collections
```

Browser: `${URL}` — Workplace-UI sollte erscheinen, Login mit `demo1` / `Demo2026!`, alle 5 Apps + KB-Collections + Chat-History sichtbar.

### 7. Audit-Logging (Compliance)

Audit-Eintraege werden in zwei Kanaele geschrieben:

1. **Disk** (`data/audit/audit_YYYY-MM-DD.jsonl`) — fuer schnelles lokales Querying via `getAuditLogs()`. **Wichtig:** dieser Pfad wird beim Container-Restart auf Scalingo verworfen.
2. **stdout** mit Marker `[AUDIT]` — wird vom Scalingo-Log-Aggregator persistiert. Das ist die *zuverlaessige* Quelle.

Stdout-Filterung lokal:
```sh
scalingo --app $APP logs --lines 1000 | grep '\[AUDIT\]'
```

Fuer Compliance-Long-Term-Archive die Logs an einen externen Aggregator
(Datadog, Logtail, Sentry) routen. Scalingo unterstuetzt das ueber
`Log-Drains`:
```sh
scalingo --app $APP log-drains-add --url 'syslog+tcp://logs.example.com:514'
```

Disk-Retention: `AUDIT_RETENTION_DAYS=90` (Default). Cleanup laeuft beim
Boot + alle 24h. `AUDIT_RETENTION_DAYS=0` deaktiviert die Disk-Logs ganz —
sinnvoll auf Customer-Instanzen die ohnehin Log-Drains nutzen.

## Update-Deploys

```sh
# Lokal arbeiten, commiten, push origin main → Auto-Deploy auf Scalingo
git push origin main
```

Migrations laufen bei jedem Boot idempotent durch — neue `drizzle/000X_*.sql` Files werden automatisch angewendet.

## Rollback

```sh
scalingo --app $APP deployments-list
scalingo --app $APP deployments-rollback <deployment-id>
```

DB-Schema-Aenderungen sind nicht durch App-Rollback rueckabwickelbar — additiv arbeiten (kein DROP COLUMN ohne `IF EXISTS`-Schutz, nicht-destruktive Defaults).

## Backups

Postgres-Backups: Scalingo erstellt automatisch tägliche Snapshots auf jeder Plan-Stufe ausser Sandbox. Auf Sandbox manuell:
```sh
scalingo --app $APP db-tunnel SCALINGO_POSTGRES_URL
# In zweiter Shell: pg_dump gegen den Tunnel-Endpoint
```

S3-Backups: Flow.swiss bietet Bucket-Versioning — in Flow-Console aktivieren falls noch nicht geschehen.

## Branding pro Customer-PoC

Pro Kundenumgebung eine eigene Scalingo-App. Code aus `main` → alle Kunden bekommen denselben Stand. Pro App eigene Postgres + S3-Bucket + eigene ENV-Vars.

### Customer-Instanz (kein Demo-Inhalt)

```sh
scalingo create workplace-customer-x
scalingo --app workplace-customer-x env-set \
  PLATFORM_TITLE='Workplace fuer Customer X' \
  PLATFORM_LOGO_URL='https://customer-x.de/logo.png' \
  PLATFORM_LOGIN_SUBTITLE='Wissensplattform Customer X' \
  FLOW_S3_BUCKET='workplace-customer-x' \
  ENABLED_APPS='wzbar-matcher,projektmanagement'
# SEED_DEMO_DATA bleibt 'false' (Default) → keine demo1..4, keine Demo-Projekte.
# Admin legt sich beim ersten Login selbst via Bootstrap-Form an.
```

### Demo-Instanz (mit allen Beispiel-Daten)

```sh
scalingo create workplace-demo
scalingo --app workplace-demo env-set \
  PLATFORM_TITLE='Workplace Demo' \
  PLATFORM_LOGIN_SUBTITLE='Demo-Plattform Adacor' \
  FLOW_S3_BUCKET='workplace-demo' \
  SEED_DEMO_DATA='true' \
  ALLOW_DEMO_SEED_IN_PRODUCTION='true' \
  DEMO_PASSWORD='Demo2026!' \
  MARKETING_PASSWORD='Marketing2026!'
# Beim Boot werden idempotent Demo-User + Beispiel-Projekte/Chats/KB
# in DB+S3 ingestiert. Reset durch DB-Drop + neu deployen.
#
# WICHTIG: ALLOW_DEMO_SEED_IN_PRODUCTION='true' ist Pflicht. Ohne diesen
# Opt-In bricht der Boot mit FATAL ab — Schutz gegen versehentliches Seeden
# bekannter Demo-Passwoerter in echten Customer-Deployments. Beide Flags
# muessen explizit gesetzt sein, damit der Demo-Modus laeuft.
```

### Recovery: verwaiste Instanz

Wenn alle Admins inaktiv/geloescht sind und niemand mehr reinkommt:

```sh
scalingo --app workplace-customer-x run \
  RECOVERY_USERNAME=neuer-admin \
  RECOVERY_PASSWORD='neues-pw-min-12-zeichen' \
  bun run scripts/create-admin.ts
```

Existierender User wird auf admin promoted + reaktiviert + optional Passwort-Reset; neuer User wird angelegt.

## Troubleshooting

| Symptom | Vermutliche Ursache | Loesung |
|---|---|---|
| Boot-Crash mit `SCALINGO_POSTGRES not set` | Postgres-Addon nicht gelinkt | `scalingo addons-add postgresql postgresql-sandbox` |
| Migrations-Timeout | Postgres unerreichbar oder schon migrating | `scalingo logs` checken; ggf. App restart |
| `[s3] FLOW_S3_* not set — skipping` | Bucket-Init uebersprungen | ENV-Variablen kontrollieren; restart |
| Login schlaegt fehl mit "User existiert nicht" | Demo-Seed haengt; `SCALINGO_POSTGRES` evtl. leer | Logs auf `[seed] Demo users created` checken |
| 500 bei `/api/knowledge/collections` | KB-Seed fehlgeschlagen | Logs auf `[kb] Seeded` checken; `data/knowledge-base/` muss in der Image sein |
| OAuth-Tokens nicht entschluesselbar | `CONNECTION_ENCRYPTION_KEY` veraendert | Key wiederherstellen — Tokens neu erfassen wenn endgueltig verloren |

## Migration von Railway → Scalingo

Da Postgres+S3 die Persistenz sind, wandern die *aktuellen* Daten so:

1. **Inhalts-Seed:** Beim ersten Scalingo-Boot ingestieren die `seedXxxFromDisk()`-Helper alle bundled `data/`-Files in DB+S3. Das sind die Files aus dem Image (also: was zum Build-Zeitpunkt in `main` lag).
2. **Live-Daten von Railway:** Falls Kollegen auf Railway noch arbeiten und neue Chats/Kollektionen erstellen, sind die nicht im Scalingo-Image. Zwei Optionen:
   - **Snapshot:** Vor dem Cutover Railway-Volume per `railway run rsync` lokal ziehen, in `data/` packen, neuen Build deployen.
   - **Cold cut:** Railway abschalten, Demo-Daten neu erstellen.
3. **DNS:** Wenn alles laeuft, CNAME des Customer-Hostnamens auf `workplace-prod.osc-fr1.scalingo.io` umstellen.
