# Scalingo Deployment

## Architektur-Annahmen

- **Code:** GitHub-Branch `main` (entspricht `refactor/postgres-migration` nach Fast-Forward).
- **Hosting:** Scalingo (Region Paris-DC, ISO 27001 + HDS).
- **DB:** Scalingo Postgres-Addon (autom. `SCALINGO_POSTGRES`-ENV).
- **Object-Storage:** Flow.swiss S3-kompatibel (`os.alp1.flow.swiss`, GDPR/Schweiz).
- **Build:** Dockerfile.scalingo via Scalingo Docker-Deploy.
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
scalingo --app $APP env-set FAL_API_KEY='<fal-key>'

# Encryption-Schluessel (KRITISCH — bei Verlust sind OAuth-Tokens nicht mehr lesbar)
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

### 3. Dockerfile-Mode aktivieren

Scalingo erkennt das Repo automatisch als Docker-Build wenn `Dockerfile` im Root liegt. Da wir aber `Dockerfile.scalingo` haben, muessen wir den Pfad explizit setzen:

```sh
scalingo --app $APP env-set CONTAINER_FILE='Dockerfile.scalingo'
```

(Ohne diese Variable nimmt Scalingo den Standard-`Dockerfile` der Railway-Variante mit Volume-Sync — das funktioniert auf Scalingo nicht.)

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
  DEMO_PASSWORD='Demo2026!' \
  MARKETING_PASSWORD='Marketing2026!'
# Beim Boot werden idempotent Demo-User + Beispiel-Projekte/Chats/KB
# in DB+S3 ingestiert. Reset durch DB-Drop + neu deployen.
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
