# Quality Improvements — Hooks, Commands & Skills

## Ist-Zustand (Februar 2026)

### Hooks (12 aktiv)

| Hook | Trigger | Typ | Prüft |
|------|---------|-----|-------|
| `security-review.sh` | PreToolUse Edit/Write | Soft | Auth-Middleware, XSS, Secrets, eval() |
| `design-check.sh` | PreToolUse Edit/Write | Soft | Hardcoded Farben, CSS-Toggles, Emojis, CSS-Imports |
| `error-consistency-check.sh` | PreToolUse Edit/Write | Soft | errorHandler Usage, dt. Error-Messages |
| `icon-duplication-check.sh` | PreToolUse Edit/Write | Soft | Lokale Icon-Definitionen statt Icons.jsx |
| `i18n-check.sh` | PreToolUse Edit/Write | Soft | Englische UI-Texte, Platzhalter, Error-Messages |
| `auth-check.sh` | PreToolUse Bash (git commit) | Hard | Auth-Import + Anwendung in Routes, RBAC-Reihenfolge |
| `docker-infra-check.sh` | PreToolUse Bash (git commit) | Hard | ENV-Sync, Port-Sync, Helm-Konsistenz |
| `quality-check.sh` | PostToolUse Edit/Write | Soft | TypeScript-Kompilierung, ESLint |
| `run-tests.sh` | PostToolUse Edit/Write (async) | Soft | bun test Ergebnisse |
| `test-coverage-check.sh` | PostToolUse Edit/Write | Soft | Fehlende Tests, veraltete Test-Signaturen |
| `post-commit-docs.sh` | PostToolUse Bash (git commit) | Soft | Doku-Update Erinnerung |
| `security-stop-check.sh` | Stop | Soft | Kritische Datei-Änderungen |

### Commands (11 aktiv)

| Command | Zweck |
|---------|-------|
| `/app` | Backend + Frontend starten/stoppen/status |
| `/auth-audit` | Endpoint-Auth-Matrix aller Routes |
| `/critical-code-audit` | 9-Kategorien Code-Audit |
| `/design-audit` | Frontend Design-Konsistenz |
| `/consistency-audit` | Duplikate, Patterns, Error-Konsistenz |
| `/api-audit` | Frontend↔Backend API-Verträge |
| `/test-scaffold` | Test-Boilerplate generieren |
| `/test-coverage` | Testabdeckung analysieren, Lücken finden, Tests erstellen/aktualisieren |
| `/quality-gate` | Konsolidierter Audit (6 Kategorien, Ampel) — Pflichtschritt in /release |
| `/release` | Version Bump + Quality Gate + Changelog + Build + Tag (11 Schritte) |
| `/update-docs` | Doku-Sync mit Code-Stand |

### Coverage-Matrix

| Dimension | Hooks | Commands | Status |
|-----------|-------|----------|--------|
| Security | auth-check, security-review, security-stop-check | /auth-audit, /critical-code-audit | Stark |
| Design | design-check, icon-duplication-check | /design-audit, /consistency-audit | Stark |
| Infrastruktur | docker-infra-check | /release, /app | Gut |
| Dokumentation | post-commit-docs | /update-docs | Gut |
| Code-Qualität | quality-check, run-tests | /critical-code-audit, /quality-gate | Gut |
| API-Konsistenz | — | /api-audit, /quality-gate | Gut |
| Error-Handling | error-consistency-check | /consistency-audit, /quality-gate | Gut |
| i18n | i18n-check | /consistency-audit | Gut |
| Testing | run-tests, test-coverage-check | /test-scaffold, /test-coverage | Gut |
| **Performance** | — | — | **Offen** |

---

## Konkrete Findings aus dem Codebase-Scan

| Finding | Dateien | Impact |
|---------|---------|--------|
| ToggleOnIcon/ToggleOffIcon in 5 Dateien dupliziert, nicht in Icons.jsx | ToolsPage, ConnectionsPage, ProvidersPage, SettingsPage, AgentsPage | Konsistenz |
| Gemischte Fehler-Sprache: 70% Deutsch, 30% Englisch | auth.ts, apps.ts, tables.ts u.a. | UX-Inkonsistenz |
| 0 automatisierte Tests | Gesamtes Projekt | Kein Safety Net |
| 350 Error-Responses, viele umgehen errorResponse() Helper | Alle Route-Dateien | Inkonsistente API |
| 543 inline style={{}} statt const styles = {} | Frontend Pages | Code-Qualität |

---

## Vorschläge

### 1. Hook: `i18n-check.sh` (PreToolUse, Edit|Write)

**Problem:** Backend mischt Deutsch und Englisch in Fehlermeldungen. Convention: UI-Text = Deutsch, Code/Variablen = Englisch. Error-Messages an den User sind UI-Text.

**Was es prüft:**
- Backend-Routes: Englische Error-Strings in `c.json({ error: '...' })` erkennen
- Frontend: Englische UI-Strings in JSX (Button-Labels, Überschriften, Platzhalter)

**Gate:** Soft (systemMessage Warnung)

**Aufwand:** Klein | **Impact:** Hoch — verhindert neue Sprachmixe

---

### 2. Hook: `error-consistency-check.sh` (PreToolUse, Edit|Write)

**Problem:** 350 Error-Responses, viele direkt `c.json({ error: '...' }, 4xx)` statt dem zentralen `errorResponse()` Helper aus `utils/errorHandler.ts`.

**Was es prüft:**
- Neue Route-Code: `c.json.*error` ohne `errorResponse()` erkennen
- Fehlende HTTP-Status-Codes
- Error-Messages die nicht dem deutschen Standard entsprechen

**Gate:** Soft (systemMessage Warnung)

**Aufwand:** Klein | **Impact:** Hoch — erzwingt einheitliche API-Antworten

---

### 3. Command: `/consistency-audit`

**Problem:** Duplizierter Code (Toggle-Icons 5x), inkonsistente Patterns.

**Was es prüft:**
- Duplizierte Komponenten-Definitionen (gleiche Funktion in mehreren Dateien)
- Nicht-zentralisierte Icons (SVG in Pages statt Icons.jsx)
- Inkonsistente Error-Nachrichtensprache (Deutsch/Englisch Mix)
- Inkonsistente Button/Card/Modal Styles die vom CLAUDE.md Pattern abweichen

**Aufwand:** Mittel | **Impact:** Hoch — findet Duplikate und Pattern-Abweichungen

---

### 4. Hook: `icon-duplication-check.sh` (PreToolUse, Edit|Write)

**Problem:** Icons werden in einzelnen Pages definiert statt zentral in Icons.jsx (5x ToggleIcon, diverse lokale SVGs).

**Was es prüft:**
- Neue `function.*Icon()` Definitionen in Pages/Components (statt Import aus Icons.jsx)
- SVG-Elemente direkt in Pages die als Icon-Komponente existieren sollten

**Gate:** Soft (systemMessage: "Icon in Page-Datei definiert. Bitte in Icons.jsx zentralisieren.")

**Aufwand:** Klein | **Impact:** Mittel — verhindert neue Icon-Duplikate

---

### 5. Command: `/api-audit`

**Problem:** 161 Backend-Endpoints, 20+ Frontend-Hooks mit API-Calls — kein Check ob die zusammenpassen.

**Was es prüft:**
- Extrahiert alle Backend-Routes (Methode + Pfad + Parameter)
- Extrahiert alle Frontend apiGet/apiPost/etc. Calls (URL + Parameter)
- Erstellt Mapping-Matrix: Frontend-Call → Backend-Endpoint
- Findet: verwaiste Endpoints, verwaiste Calls, Typ-Mismatches

**Aufwand:** Mittel | **Impact:** Mittel — Frontend↔Backend Vertragsprüfung

---

### 6. Command: `/test-scaffold`

**Problem:** 0 Tests im gesamten Projekt.

**Was es tut:**
- Analysiert eine Route/Seite/Hook
- Generiert Test-Boilerplate (bun:test für Backend, vitest für Frontend)
- Fokus auf: API-Contract-Tests, Hook-Behavior-Tests, kritische Business-Logik

**Aufwand:** Mittel | **Impact:** Mittel — senkt Hürde für Testabdeckung

---

## Priorisierung

| Prio | Maßnahme | Typ | Aufwand | Impact |
|------|----------|-----|---------|--------|
| 1 | `i18n-check.sh` | Hook | Klein | Hoch |
| 2 | `error-consistency-check.sh` | Hook | Klein | Hoch |
| 3 | `/consistency-audit` | Command | Mittel | Hoch |
| 4 | `icon-duplication-check.sh` | Hook | Klein | Mittel |
| 5 | `/api-audit` | Command | Mittel | Mittel |
| 6 | `/test-scaffold` | Command | Mittel | Mittel |

---

## Umsetzungs-Status

- [x] 1. i18n-check Hook
- [x] 2. error-consistency-check Hook
- [x] 3. /consistency-audit Command
- [x] 4. icon-duplication-check Hook
- [x] 5. /api-audit Command
- [x] 6. /test-scaffold Command
