# Runbook: Neue Kunden-Instanz auf Scalingo

**Geführter Ablauf zum Aufsetzen einer neuen Workplace-Instanz** — mit Fragebogen,
Variablen-Klassen, manuellen Toren und CLI-Schritten.

> **Verhältnis zu anderen Docs:**
> - `docs/scalingo-deploy.md` = **Referenz** für Deploy-Mechanik (Buildpack, GitHub-Integration, Boot, Rollback). Hier nicht dupliziert.
> - `backend/.env.example` = **kanonische Liste** aller ENV-Variablen inkl. Beschreibung. Dieses Runbook klassifiziert sie nur nach Aufsetz-Gefahr.
> - **Dieses Runbook** = der *operative Ablauf*, der die Fehlerklasse „env von anderer Instanz kopiert" (→ S3-/Secret-Kollision) per Design verhindert.
>
> Begleitender Skill: `/neue-instanz` führt diesen Ablauf interaktiv.

---

## 0. Die goldene Regel (Cofermin-Lehre)

> **Niemals die env einer bestehenden Instanz 1:1 kopieren.** Beim Cofermin-Setup wurde
> der `FLOW_S3_*`-Block aus `workplace-demo` übernommen → beide Instanzen schrieben in
> **denselben Flow.swiss-Account + Bucket** (Keys sind nicht instanz-präfixiert → echte
> Datenkollision). Erst auffällig geworden, als der S3-Account ohnehin fehlte.

Jede Variable fällt in **eine von vier Klassen** — die ersten beiden sind die Gefahrenzone:

| Klasse | Bedeutung | Regel |
|---|---|---|
| 🔴 **Generieren** | Pro Instanz frisch erzeugen | **Nie** von einer anderen Instanz übernehmen |
| 🟡 **Instanz-spezifisch** | An Domain/Kunde gebunden | Pro Instanz bewusst setzen |
| 🔵 **Connection/OAuth** | Pro aktivierter Integration | Redirect-URI = manuelles Tor (Abschnitt 4) |
| ⚪ **Geteilt/Standard** | Über Instanzen gleich | Aus zentralem Vault übernehmbar |

---

## 1. Fragebogen (vor dem Start ausfüllen)

| Frage | Antwort (Beispiel) |
|---|---|
| Kunden-Slug (`workplace-<slug>`) | `cofermin` |
| Modus: **Customer** (Admin self-register) oder **Demo** (Seed-Daten)? | Customer |
| Custom-Domain gewünscht? Welche? | `cofermin.workplace-lab.adacor.dev` |
| Welche Connections aktiv? (DocuWare/Confluence/Jira/Google/Pipedrive/YouTrack) | DocuWare |
| DocuWare-Org-URL (falls DocuWare) | `cofermin-rohstoffe.docuware.cloud` |
| Branding (Titel / Logo-URL / Login-Subtitle)? | „Workplace Cofermin" / – / – |
| Welche Apps aktiv (`ENABLED_APPS`, leer = alle)? | alle |
| LLM-Provider: zentrale Adacor-Keys oder eigene? | zentral |

Aus dem Slug leiten sich ab: App-Name `workplace-<slug>`, interim-URL
`https://workplace-<slug>.osc-fr1.scalingo.io`, DNS-CNAME-Ziel (= dieselbe interim-URL).

---

## 2. Variablen-Katalog nach Klasse

Vollständige Beschreibungen in `backend/.env.example`. Hier die Einordnung der **realen**
Keys (Stand: Produktiv-Instanzen):

### 🔴 Generieren — frisch pro Instanz, nie kopieren
| Variable | Erzeugung |
|---|---|
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `CONNECTION_ENCRYPTION_KEY` | `openssl rand -hex 32` (**genau 64 Hex**, sonst sind OAuth-Tokens unlesbar) |
| `FLOW_S3_MASTER` / `FLOW_S3_SECRET` | **Neuer Flow.swiss Object-Storage-Account** (Abschnitt 4.1) |
| `DEMO_PASSWORD` / `MARKETING_PASSWORD` | nur Demo-Modus; frisch generieren (`openssl rand -hex 12`) |
| `DATABASE_URL` / `SCALINGO_POSTGRESQL_URL` | **automatisch vom Postgres-Addon** — nicht manuell setzen |

### 🟡 Instanz-spezifisch — an Domain/Kunde/Modus gebunden
| Variable | Wert |
|---|---|
| `APP_URL`, `FRONTEND_URL`, `API_BASE_URL`, `VITE_API_URL` | finale Instanz-URL (interim: scalingo-URL, nach DNS: Custom-Domain) |
| `ALLOWED_OAUTH_HOSTS` | Host(s) der Instanz — **muss zum tatsächlich aufgerufenen Host passen** (siehe Stolperfalle CSRF) |
| `DOCUWARE_ORG_URL` | Kunden-eigene DocuWare-Org |
| `SEED_DEMO_DATA` / `ALLOW_DEMO_SEED_IN_PRODUCTION` | `false` (Customer) bzw. beide `true` (Demo) |
| `PLATFORM_TITLE` / `PLATFORM_LOGO_URL` / `PLATFORM_LOGIN_SUBTITLE` | Branding (optional) |
| `ENABLED_APPS` | Komma-Liste oder ungesetzt (= alle) |
| `FLOW_S3_BUCKET` | **optional**; Default `workplace-poc-demo`. Trennung läuft primär über den eigenen Account. Explizit `workplace-<slug>` setzen = Defense-in-Depth (empfohlen) |

### 🔵 Connection/OAuth — pro aktivierter Integration
DocuWare: `DOCUWARE_CLIENT_ID`, `DOCUWARE_CLIENT_SECRET`, `DOCUWARE_AUTHORIZATION_URL`,
`DOCUWARE_TOKEN_URL`, `DOCUWARE_SCOPES` (+ `DOCUWARE_ORG_URL` oben).
Weitere: `CONFLUENCE_CLIENT_ID/SECRET`, `JIRA_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`,
`PIPEDRIVE_CLIENT_ID/SECRET`, `YOUTRACK_CLIENT_ID` + `YOUTRACK_URL`.
→ **Redirect-URI pro Instanz-Domain registrieren** (Abschnitt 4.3). Client-ID/Secret können
zentral (eine Adacor-OAuth-App) **oder** kundeneigen sein — pro Provider entscheiden.

### ⚪ Geteilt/Standard — aus zentralem Vault übernehmbar
LLM/Tools: `ADACOR_AI_API_KEY`, `ADACOR_AI_API_URL`, `ADACOR_AI_MODEL`, `MARKITDOWN_API_URL`,
`FAL_AI_API_KEY`, `GOOGLE_AI_API_KEY`, `NEBIUS_API_KEY`, `TAVILY_API_KEY`.
Model-Routing: `PLATFORM_*_PROVIDER_ID/MODEL_ID`, `SYSTEM_*_PROVIDER_ID/MODEL_ID`,
`PLATFORM_EMBEDDINGS_*`, `PLATFORM_SEARCH_*`.
Infra: `FLOW_S3_ENDPOINT` (`https://os.alp1.flow.swiss`), `NODE_ENV=production`,
`TRUST_PROXY`, `SSRF_ALLOW_LOCALHOST`, `SSRF_CHECK_MALWARE`.

---

## 3. Ablauf per Scalingo CLI

```sh
SLUG=cofermin                      # <-- anpassen
APP=workplace-$SLUG
URL=https://$APP.osc-fr1.scalingo.io
```

### 3.1 App + Postgres anlegen
```sh
scalingo create $APP --region osc-fr1
# Projekt-Zuordnung (workplace-pilots) ggf. in der Console.
```
> ⚠️ **Kosten-Gate:** Es gibt **keinen kostenlosen Sandbox-Plan mehr** (Stand 2026-06).
> Der kleinste Plan ist **`postgresql-starter-512`** (Starter 512M) — **kostenpflichtig**.
> Vor dem nächsten Schritt explizit bestätigen lassen. Plan-Liste:
> `scalingo --app $APP addons-plans postgresql`.
```sh
scalingo --app $APP addons-add postgresql postgresql-starter-512   # Plan je nach Kunde
# DB-URLs (DATABASE_URL / SCALINGO_POSTGRESQL_URL) setzt das Addon automatisch.
# Der Code liest SCALINGO_POSTGRES — das Custom-Buildpack aliased es beim Boot aus
# SCALINGO_POSTGRESQL_URL. Also NICHTS DB-bezogenes manuell setzen.
```

### 3.2 Generierte Secrets (🔴) — frisch, in einem Rutsch
> 🔐 **`scalingo env-set` gibt die gesetzten Werte im Klartext aus.** Bei Secrets daher
> **immer `>/dev/null 2>&1`** anhängen und separat per Key-Name (gehasht) verifizieren —
> sonst landen die Secrets im Terminal/Transkript.
```sh
scalingo --app $APP env-set \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  CONNECTION_ENCRYPTION_KEY="$(openssl rand -hex 32)" >/dev/null 2>&1
# Verifikation ohne Klartext:
scalingo --app $APP env 2>/dev/null | grep -E '^(SESSION_SECRET|CONNECTION_ENCRYPTION_KEY)=' \
  | cut -d= -f1
```
`FLOW_S3_MASTER/SECRET` erst nach Abschnitt 4.1 (neuer Account) setzen — **ebenfalls mit
`>/dev/null`**.

### 3.3 Instanz-spezifisch (🟡) — interim auf die Scalingo-URL
> ⚠️ **`VITE_API_URL` ist `/api` (relativ), NICHT die volle URL.** Das Frontend nutzt den
> Wert direkt als API-Base (`AuthContext.jsx`: `import.meta.env.VITE_API_URL || '…/api'`).
> Eine volle URL ohne `/api` lässt `/auth/status` ins Leere laufen → Frontend zeigt **Login
> statt Erst-Registrierung**. Relativ (`/api`, same-origin) ist zudem domain-unabhängig —
> überlebt den späteren Custom-Domain-Wechsel ohne Rebuild. **`VITE_API_URL` wird zur
> Build-Zeit ins Bundle gebacken** → Änderung erfordert einen **Rebuild** (§3.6), kein bloßes
> Restart.
```sh
scalingo --app $APP env-set \
  APP_URL="$URL" FRONTEND_URL="$URL" API_BASE_URL="$URL" \
  VITE_API_URL=/api \
  ALLOWED_OAUTH_HOSTS=$APP.osc-fr1.scalingo.io \
  NODE_ENV=production TRUST_PROXY=true \
  SEED_DEMO_DATA=false
# Branding optional:
#  PLATFORM_TITLE='Workplace <Kunde>' PLATFORM_LOGO_URL=... PLATFORM_LOGIN_SUBTITLE=...
# Defense-in-Depth (empfohlen): FLOW_S3_BUCKET=workplace-$SLUG
```

### 3.4 Geteilt/Standard (⚪) — aus Vault
```sh
scalingo --app $APP env-set \
  FLOW_S3_ENDPOINT=https://os.alp1.flow.swiss \
  ADACOR_AI_API_KEY='<vault>' ADACOR_AI_API_URL='<vault>' ADACOR_AI_MODEL='<vault>' \
  MARKITDOWN_API_URL='<vault>' \
  FAL_AI_API_KEY='<vault>' GOOGLE_AI_API_KEY='<vault>' \
  NEBIUS_API_KEY='<vault>' TAVILY_API_KEY='<vault>'
# Model-Routing (PLATFORM_*/SYSTEM_*) + SSRF_* analog aus einer Referenz-Instanz
# uebernehmen (das sind ⚪ geteilt, kein Geheimnis-Risiko).
```

### 3.5 Connections (🔵) — nur die aktivierten Provider
```sh
# Beispiel DocuWare:
scalingo --app $APP env-set \
  DOCUWARE_ORG_URL='<kunden-org>.docuware.cloud' \
  DOCUWARE_CLIENT_ID='<...>' DOCUWARE_CLIENT_SECRET='<...>' \
  DOCUWARE_AUTHORIZATION_URL='<...>' DOCUWARE_TOKEN_URL='<...>' DOCUWARE_SCOPES='<...>'
```

### 3.6 Build-Reste entfernen + Deploy
```sh
scalingo --app $APP env-unset CONTAINER_FILE BUILDPACK_URL >/dev/null 2>&1 || true
```
**GitHub-Deploy geht vollständig per CLI** (die SCM-Integration ist bereits am Account) —
keine Console nötig:
```sh
scalingo --app $APP integration-link-create --branch main --auto-deploy \
  https://github.com/tilweb/agent-platform
scalingo --app $APP integration-link-manual-deploy main   # ersten Build triggern
```
Build-Status pollen: `scalingo --app $APP deployments` (Status `building` → `success`).

---

## 4. Manuelle externe Tore (nicht CLI-automatisierbar)

Genau hier passieren die Fehler — jedes Tor mit **Verifikation**.

### 4.1 Flow.swiss Object-Storage-Account 🔴
- In der Flow.swiss-Konsole einen **neuen, eigenen** Storage-Account (Access-Key/Secret) anlegen — **nicht** den einer anderen Instanz wiederverwenden.
- `FLOW_S3_MASTER/SECRET` per `env-set … >/dev/null 2>&1` setzen (Klartext-Echo vermeiden).
- **Verifikation (Hash-Vergleich gegen Nachbar-Instanz):**
  ```sh
  for a in workplace-demo $APP; do
    scalingo --app $a env 2>/dev/null | grep '^FLOW_S3_MASTER=' | cut -d= -f2- | shasum -a256 | cut -c1-12
  done   # die beiden Hashes MÜSSEN unterschiedlich sein
  ```
- Bucket: legt der Boot via `ensureBucket()` an (oder 403 → in Flow-UI manuell anlegen).

### 4.2 DNS-CNAME (Custom-Domain) 🟡
- CNAME `cofermin.workplace-lab.adacor.dev` → `workplace-<slug>.osc-fr1.scalingo.io`.
- Dann: `scalingo --app $APP domains-add cofermin.workplace-lab.adacor.dev`
- **Verifikation:** `dig +short <domain>` zeigt das CNAME-Ziel; TLS-Zertifikat von Scalingo provisioniert (kann einige Minuten dauern).
- **Danach** `APP_URL/FRONTEND_URL/API_BASE_URL/ALLOWED_OAUTH_HOSTS` von der interim-URL auf die Custom-Domain umstellen (sonst CSRF-„Forbidden"). **`VITE_API_URL=/api` bleibt unverändert** (relativ, same-origin) → kein Rebuild beim Domain-Wechsel nötig.
- > 🔁 **Pflicht: expliziter Restart nach dem URL-Umstellen.** `index.ts` friert `ALLOWED_ORIGINS`
  > (aus `FRONTEND_URL`+`API_BASE_URL`) **beim Prozessstart** ein — kein Re-Read pro Request. Der
  > `env-set`-Auto-Restart propagiert die neuen Origins nicht zuverlässig, der laufende Container
  > hält weiter die alten (interim-)Origins → Login liefert weiter CSRF-„Forbidden". Daher nach dem
  > Umstellen **immer** `scalingo --app $APP restart`. Verifikation (kein 403, sondern 400/401):
  > ```sh
  > curl -s -o /dev/null -w '%{http_code}\n' -X POST https://<domain>/api/auth/login \
  >   -H "Origin: https://<domain>" -H "Content-Type: application/json" -d '{"email":"x","password":"x"}'
  > ```

### 4.3 OAuth-Redirect-URIs pro Provider 🔵
- Für jeden aktivierten Provider die **Redirect-URI auf die finale Instanz-Domain** in der jeweiligen Provider-App/Org registrieren (z. B. DocuWare-Org des Kunden).
- **Verifikation:** Connection in der Instanz als User verbinden → Token wird gespeichert.

---

## 5. Verifikation nach Deploy

```sh
curl -s $URL/health                       # 200
curl -sI $URL/health | grep -i strict-transport-security   # HSTS gesetzt (production)
scalingo --app $APP logs --lines 200 | grep -E '\[s3\]|migrations|Server starting'
# Erwartet u.a.: [s3] bucket "<bucket>" exists/created · migrations applied · Server starting
```
- Customer-Modus: erster Login legt den **Admin per Bootstrap-Form** an.
- Connections in Settings → Admin **freischalten**, dann als User verbinden.

---

## 6. Stolperfallen (aus der Praxis)

| Symptom | Ursache | Fix |
|---|---|---|
| **S3-Kollision / fremde Daten** | `FLOW_S3_*` von anderer Instanz kopiert (Keys nicht präfixiert) | Eigener Flow.swiss-Account (4.1); Hash-Verifikation |
| **„Forbidden" beim Login** | CSRF: `FRONTEND_URL`/`API_BASE_URL` ≠ aufgerufener Host — **oder** Prozess hält nach `env-set` noch die alten, eingefrorenen `ALLOWED_ORIGINS` | URLs auf den realen Host stellen **und** `scalingo --app $APP restart` (Origins werden beim Boot eingefroren, siehe 4.2) |
| **Boot bricht FATAL ab (Demo)** | `SEED_DEMO_DATA=true` ohne `ALLOW_DEMO_SEED_IN_PRODUCTION=true` | beide Flags setzen (Guard gegen versehentliches Demo-Seed) |
| **OAuth-Tokens unlesbar nach Redeploy** | `CONNECTION_ENCRYPTION_KEY` geändert oder ≠ 64 Hex | Key stabil halten, `openssl rand -hex 32` |
| **Build kollidiert** | alte `CONTAINER_FILE`/`BUILDPACK_URL` auf der App | `env-unset` (3.6) |
| **Secret im Terminal/Transkript geleakt** | `scalingo env-set` echot gesetzte Werte im Klartext | bei Secrets `>/dev/null 2>&1`; falls geleakt: Secret **rotieren** (3.2) |
| **Login-Maske statt Erst-Registrierung** | `VITE_API_URL` ≠ `/api` (volle URL ohne `/api`) → `/auth/status` 404 → `initialized` bleibt null | `VITE_API_URL=/api` + **Rebuild** (build-time-baked, §3.3/§3.6) |

---

## 7. Checkliste (Kurzform)

- [ ] Fragebogen ausgefüllt
- [ ] `scalingo create` + Postgres-Addon (Kosten-Gate bestätigt)
- [ ] 🔴 `SESSION_SECRET` + `CONNECTION_ENCRYPTION_KEY` frisch generiert
- [ ] 🔴 **Eigener** Flow.swiss-Account → `FLOW_S3_MASTER/SECRET` (Hash ≠ Nachbar verifiziert)
- [ ] 🟡 URL-Variablen + `ALLOWED_OAUTH_HOSTS` + Modus-Flags + Branding
- [ ] ⚪ Vault-Keys (LLM, Tools, Model-Routing, Infra)
- [ ] 🔵 aktivierte Connections + Redirect-URIs registriert
- [ ] `env-unset CONTAINER_FILE BUILDPACK_URL`
- [ ] GitHub-Integration + Auto-Deploy `main`
- [ ] Health 200 + S3-Boot-Log + erster Admin-Login
- [ ] (später) DNS-CNAME → `domains-add` → URLs auf Custom-Domain umstellen → Cert geprüft
