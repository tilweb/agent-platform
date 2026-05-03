# Scalingo Custom-Buildpack — Bun + Vite Production Deploy

**Datum**: 2026-05-03
**Branch**: `main`
**App**: `workplace-demo` (Scalingo Region `osc-fr1`, Frankreich)
**Buildpack-Repo**: `tilweb/scalingo-agent-platform-buildpack` (Tag `v0.1.0`)
**Status**: Production-verified (Login, HSTS, ffmpeg, statisches Asset-Serving)

## Kontext

Scalingo unterstuetzt laut offizieller Doku ([deployment-process](https://doc.scalingo.com/platform/deployment/deployment-process), [buildpacks/custom](https://doc.scalingo.com/platform/deployment/buildpacks/custom), [buildpacks/multi](https://doc.scalingo.com/platform/deployment/buildpacks/multi)) **ausschliesslich Buildpacks** — kein Dockerfile-Build. Die Plattform-Wahl (Scalingo FR + Flow.swiss S3 Schweiz) ist aus DSGVO/CLOUD-Act-Gruenden fix; Render und Fly.io scheiden aus.

Bun ist auf Scalingo offiziell nicht supported. Zwei Optionen standen zur Wahl:

1. **Bun→Node-Refactor** im Code (~50 Touchpoints, Argon2-Hash-Migrations-Risiko, Lokal-Dev waere weiter Bun → Drift zwischen Local und Prod).
2. **Eigenes Custom-Buildpack** das Bun zur Laufzeit installiert. Code unangetastet, Lokal/Prod identisch, ~80 Zeilen Bash einmalig auditierbar.

Wir haben uns fuer (2) entschieden. Vorteile:
- Bun-Code bleibt wie er ist — kein Refactor, kein Argon2-Risiko.
- Lokal-Dev und Production identisch (beides Bun 1.3.7).
- Wartung gepinnt: 1–2 Tag-Updates pro Jahr (Bun- bzw. Node-Bumps).
- Scalingo offiziell dokumentierter Pattern (Custom + Multi-Buildpack).

## Architektur

### Repo-Trennung

- **App-Repo** (`/agent-platform`, `main`): App-Code + Buildpack-Verweise (`.buildpacks`, `Aptfile`, `Procfile`).
- **Buildpack-Repo** (`tilweb/scalingo-agent-platform-buildpack`, separat): `bin/detect`, `bin/compile`, `bin/release`, `README.md`. Tag-versioniert. Public.
- **`demo/messe`-Worktree** (`/agent-platform-railway`, Railway, Bun + Dockerfile): vollstaendig unangetastet — separater Build-Pfad fuer Messe-Demo.

### Buildpack-Flow (Multi-Buildpack)

```
.buildpacks
  https://github.com/Scalingo/apt-buildpack.git
  https://github.com/tilweb/scalingo-agent-platform-buildpack.git#v0.1.0
```

1. **`apt-buildpack`** (Scalingo offiziell): liest `Aptfile` und installiert Pakete in `/app/.apt/`. Aktuell nur `ca-certificates`.
2. **Custom-Buildpack** (`bin/compile`):
   - Exportiert App-ENV-Vars (`$ENV_DIR/*`) in den Build-Prozess (z.B. fuer Build-time-Vars wie `VITE_*`).
   - Aliasiert `SCALINGO_POSTGRESQL_URL` ↔ `SCALINGO_POSTGRES` ↔ `DATABASE_URL` build-time.
   - Installiert **Node 22.13.0 LTS** (gepinnt, gecached unter `$CACHE_DIR/node-$NODE_VERSION`) — Vite 7 verlangt Engine `^20.19.0 || >=22.12.0`.
   - Installiert **Bun 1.3.7** (gepinnt, gecached unter `$CACHE_DIR/bun-$BUN_VERSION`).
   - Installiert **ffmpeg 7.0.2 static** (johnvansickle.com, gecached unter `$CACHE_DIR/ffmpeg-release`).
   - Frontend-Build: `cd frontend && NPM_CONFIG_PRODUCTION=false npm ci --no-audit --no-fund && npm run build`.
   - Cleanup: `rm -rf frontend/node_modules` (~200 MB Slug-Optimierung).
   - Backend-Install: `cd backend && bun install --frozen-lockfile --production`.
   - Kopiert `bun`, `ffmpeg`, `ffprobe` nach `/app/.bun/bin/` bzw. `/app/.ffmpeg/bin/` (Cache liegt ausserhalb `/app` und ist zur Runtime nicht da).
   - Schreibt `.profile.d/agent-platform.sh`: PATH-Setup + Postgres-Aliasing fuer Runtime.
3. **`bin/release`**: setzt `web: cd backend && bun run src/index.ts` als Default-Process-Type.

### App-Repo Files

- `.buildpacks` — Multi-Buildpack-Reihenfolge, Buildpack auf `#v0.1.0` gepinnt.
- `Aptfile` — `ca-certificates` (ffmpeg kommt aus dem Custom-Buildpack als Static-Binary).
- `Procfile` — `web: cd backend && bun run src/index.ts` (redundant zum Custom-Buildpack-Default, aber explizit ist sauberer).

## Entscheidungen

### Warum statisches ffmpeg statt apt-Paket

Ubuntu-22.04-`ffmpeg` aus dem apt-Repo hat eine Soft-Dependency auf `libpulse0` v16.x — die ist im `scalingo-22`-Stack-Image nicht standardmaessig drin. `libpulse0` aus apt liegt nur in v15.x vor, ergo Crash beim Start:

```
ffmpeg: error while loading shared libraries: libpulsecommon-16.1.so: cannot open shared object file
```

Manueller `libpulse0`-Eintrag in `Aptfile` half nicht (Versions-Mismatch). Statisches Binary von [johnvansickle.com](https://johnvansickle.com/ffmpeg/) hat keine System-Lib-Abhaengigkeiten und ist in vielen Production-Setups eingesetzt. Buildpack laedt das in den Cache, kopiert nach `/app/.ffmpeg/bin/`, profile.d setzt PATH.

### Warum `NPM_CONFIG_PRODUCTION=false`

Wenn die App-ENV `NODE_ENV=production` setzt (sollte sie), exportiert das Buildpack diese Var auch in den Build-Prozess. `npm ci` skipt dann `devDependencies` per Default. Vite und `@vitejs/plugin-react` liegen aber in `devDependencies` — Build bricht mit `vite: not found`. `NPM_CONFIG_PRODUCTION=false` ueberschreibt das fuer den einen Befehl. Vite-Build-Output ist trotzdem produktion-optimiert, das handhabt Vite intern unabhaengig von `NODE_ENV`.

### Warum Postgres-ENV-Aliasing

Drei Konsumenten, drei Variablen:
- Scalingo-Postgres-Addon **setzt** `SCALINGO_POSTGRESQL_URL`.
- Unser Code (`backend/src/db/index.ts`) **liest** `SCALINGO_POSTGRES`.
- Drizzle-Kit-CLI **liest** `DATABASE_URL`.

Ohne Aliasing scheitert der App-Boot mit "SCALINGO_POSTGRES not set". Unser `.profile.d/agent-platform.sh` mappt in alle drei Richtungen, und `bin/compile` macht das auch zur Build-Zeit fuer eventuelle Drizzle-Aufrufe.

### Warum `NODE_ENV` muss explizit gesetzt werden

`scalingo.json` definiert `env.NODE_ENV.value=production`, aber das ist nur Default fuer den **"Deploy on Scalingo"-Button**-Flow. Manuell angelegte Apps (was wir hier hatten) bekommen die Var nicht automatisch. Ohne `NODE_ENV=production` skipt `backend/src/index.ts` den `serveStatic`-Block und das Frontend wird nicht ausgeliefert (`/` → 404).

```sh
scalingo --app workplace-demo env-set NODE_ENV=production
```

### Warum Tag-Pinning des Buildpacks

Ohne Pinning auf `#v0.1.0` haengt jeder Buildpack-Commit unmittelbar an allen darauf zeigenden Apps. Buildpack-Updates werden somit ein bewusster Schritt: Buildpack-Repo committen, Tag erhoehen (`v0.2.0`), App-Repo `.buildpacks` aktualisieren, Deploy. Das gleiche Pattern wie bei Library-Versionen.

## Verifikation

End-to-end auf der Demo-Instanz nach Deploy `575dcdce` (App-Ref `8422255`, 2026-05-03 21:07):

```sh
curl https://workplace-demo.osc-fr1.scalingo.io/health
# {"status":"ok"}

curl -sI https://workplace-demo.osc-fr1.scalingo.io/health | grep strict-transport-security
# strict-transport-security: max-age=31536000; includeSubDomains

# Login + Session
curl -s -X POST .../api/auth/login -d '{"username":"demo1","password":"Demo2026!"}' -c jar
curl -s -b jar .../api/auth/me
# {"authenticated":true,"user":{...}}

# ffmpeg im Slug
scalingo --app workplace-demo run "which ffmpeg && ffmpeg -version | head -1"
# /app/.ffmpeg/bin/ffmpeg
# ffmpeg version 7.0.2-static https://johnvansickle.com/ffmpeg/
```

Slug-Groesse: 414 MiB (vor Cleanup-Loop 801 MiB).

## Wartung

- **Bun-Update**: `BUN_VERSION` in `bin/compile` aenderen, Buildpack-Repo committen, neuen Tag (`v0.2.0`), App-Repo `.buildpacks` aktualisieren, Deploy.
- **Node-Update**: dito, `NODE_VERSION`. Vite-Engine-Range pruefen.
- **ffmpeg**: derzeit `release` (johnvansickle "always latest stable"). Bei Bedarf auf konkretes Release pinnen (`ffmpeg-7.0.2-amd64-static.tar.xz`).
- **Stack-Image-Wechsel** (`scalingo-22` → `scalingo-24` o.ae.): Compile-Skript in lokalem `scalingo/scalingo-XX:latest`-Container testen (siehe `git archive`-Pattern in der Plan-Datei) bevor man pusht.

## Out-of-Scope (bewusst nicht adressiert)

- **Bun→Node-Refactor** — verworfen zugunsten Custom-Buildpack.
- **Plattform-Wechsel** (Render/Fly.io/Heroku) — verworfen aus DSGVO/CLOUD-Act-Gruenden.
- **Hono-Cookie-Vulns aus `bun audit`** — separater Dep-Update-Track, nicht mit Migrations-Risiko mischen.
- **TypeScript-Compile zu `dist/`** — nicht noetig, Bun transpiliert at runtime.
- **Healthcheck-Auto-Deploy-Trigger** — Auto-Deploy aus dem GitHub-Integration-Link triggert manchmal nicht; Workaround `scalingo --app X integration-link-manual-deploy main`. Scalingo-Support-Ticket optional.
