# Railway Demo Deployment (Messe-Pilot)

**Datum:** 2026-03-14

## Kontext

Deployment der Agent Platform als Demo-Instanz fuer Messe-Praesentationen auf Railway.

## Architektur-Entscheidungen

### Single-Service (Backend servt Frontend)
- Multi-Stage Dockerfile: Frontend-Build mit node:20-alpine, Runtime mit oven/bun:1-alpine
- `VITE_API_URL=/api` beim Build → alle Frontend-API-Calls gehen an same-origin `/api/*`
- Backend nutzt Hono `serveStatic` fuer Assets + SPA-Fallback (index.html)
- Kein CORS-Problem, da alles same-origin

### Volume-Strategie
- 2 Railway Volumes: `/app/data` (Hauptdaten) und `/app/backend/data` (App-spezifische Daten)
- Dockerfile CMD initialisiert Volumes beim ersten Start aus Seed-Verzeichnissen
- Seed-Daten werden im Image mitgeliefert (backend-data-seed, data-seed)

### Demo-Accounts
- Seed-Script `scripts/seed-demo-users.ts` erstellt demo1-demo4 (idempotent)
- Passwort aus ENV `DEMO_PASSWORD` (Default: Demo2026!)
- Gleiche Argon2id-Parameter wie auth/password.ts (m=65536, t=3)

### Registration-Guard
- ENV `REGISTRATION_DISABLED=true` blockiert Self-Registration (403)
- `/api/auth/status` liefert `registrationEnabled` Feld
- Frontend versteckt Register-Link wenn deaktiviert

## Aenderungen

| Datei | Aenderung |
|-------|-----------|
| `Dockerfile` | Neu: Multi-Stage Build |
| `.dockerignore` | Neu: node_modules, .git, .env* |
| `railway.toml` | Neu: Build + Deploy Config |
| `scripts/seed-demo-users.ts` | Neu: Idempotentes Seed-Script |
| `backend/src/index.ts` | Static-File-Serving in Production |
| `backend/src/routes/auth.ts` | Registration-Guard + registrationEnabled |
| `frontend/src/context/AuthContext.jsx` | registrationEnabled State |
| `frontend/src/pages/LoginPage.jsx` | Register-Link bedingt anzeigen |

## Deploy-Workflow

1. Code auf Branch `demo/messe` pushen
2. Railway Service erstellen, GitHub-Repo + Branch verbinden
3. 2 Volumes anlegen: `/app/data` und `/app/backend/data`
4. ENV-Variablen setzen (siehe CLAUDE.md Plan oder railway.toml)
5. Deploy triggern

## Verification

- `/health` → `{"status":"ok"}`
- `/` → Login-Seite ohne Register-Link
- Login mit `demo1` / `Demo2026!` → Dashboard
