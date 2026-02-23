---
name: quality-gate
description: Führe alle relevanten Qualitäts-Audits durch und erstelle einen konsolidierten Report mit Ampel-Ergebnis.
argument-hint: "[quick|strict]"
---

# Quality Gate

Führe alle relevanten Qualitäts-Audits durch und erstelle einen konsolidierten Report mit Ampel-Ergebnis.

## Argument: $ARGUMENTS (optional)

Standard: vollständiger Gate-Check. Optionen: `quick` (nur kritische Checks), `strict` (Warnings blockieren)

## Vorgehen

Arbeite die 7 Audit-Kategorien sequenziell ab. Jede Kategorie liefert ein Ampel-Ergebnis.

**Ampel-Logik:**
- **PASS** — Keine Findings
- **WARN** — Findings vorhanden, aber nicht kritisch (Release möglich)
- **FAIL** — Kritische Findings (Release sollte nicht erfolgen)

---

### Kategorie 1: Design-Konsistenz

Prüfe die wichtigsten Design-Regeln aus `frontend/CLAUDE.md`:

1. **Grep** nach hardcoded Hex-Farben in `frontend/src/pages/*.jsx` und `frontend/src/components/*.jsx` (außer `#fff`, `#000`, `transparent`)
   - Ignoriere Opacity-Suffixe wie `${theme.colors.error}30`
   - Ignoriere `theme.js`, `Icons.jsx`
2. **Grep** nach CSS-Toggle-Switch Patterns (position + toggleDot) — Standard ist ToggleOnIcon/ToggleOffIcon
3. **Grep** nach CSS-Datei-Imports (`import.*\.css`)
4. **Grep** nach externen Icon-Library-Imports

**Ampel:**
- PASS: 0 Findings
- WARN: 1-3 Findings
- FAIL: >3 Findings oder CSS-Import/Toggle-Switch gefunden

---

### Kategorie 2: Icon-Duplikate

1. **Grep** nach `function [A-Z][a-zA-Z]*Icon\s*\(` in `frontend/src/pages/` und `frontend/src/components/` (NICHT Icons.jsx)
2. Zähle unique Icon-Namen und in wie vielen Dateien sie vorkommen
3. Prüfe ob die Icons in `Icons.jsx` existieren

**Ampel:**
- PASS: Alle Icons zentral in Icons.jsx
- WARN: Icons in 1-2 Dateien dupliziert
- FAIL: Icons in >2 Dateien dupliziert

---

### Kategorie 3: Error-Handling

1. **Grep** nach `c.json\(\s*\{.*error` in `backend/src/routes/*.ts` — direkte Error-Responses
2. **Grep** nach `errorResponse\(|notFoundError\(|validationError\(|forbiddenError\(|internalError\(|serviceError\(` — korrekte Helper
3. Berechne Verhältnis: direkte vs. Helper-Aufrufe
4. **Grep** nach englischen Error-Messages in Routes

**Ampel:**
- PASS: >80% Helper-Nutzung, 0 englische Messages
- WARN: 50-80% Helper-Nutzung oder 1-5 englische Messages
- FAIL: <50% Helper-Nutzung oder >5 englische Messages

---

### Kategorie 4: Auth-Abdeckung

1. Lies `backend/src/index.ts` für alle gemounteten Routes
2. Für jede Route-Datei in `backend/src/routes/*.ts`:
   - Prüfe ob `authMiddleware` oder `optionalAuthMiddleware` importiert wird
   - Prüfe ob die Middleware angewendet wird (`.use()` oder per Endpoint)
3. Bekannte Ausnahmen: `auth.ts` (Login-Endpoints), Health-Checks, OAuth-Callbacks

**Ampel:**
- PASS: Alle Routes haben Auth (außer bekannte Ausnahmen)
- WARN: 1 Route ohne Auth (mit Begründung)
- FAIL: >1 Route ohne Auth

---

### Kategorie 5: API-Konsistenz

1. Extrahiere alle Backend-Endpoints (Methode + Pfad) aus Route-Dateien
2. Extrahiere alle Frontend API-Calls (apiGet/apiPost/etc.) aus `frontend/src/hooks/*.js` und `frontend/src/pages/*.jsx`
3. Matche Frontend-Calls mit Backend-Endpoints
4. Identifiziere verwaiste Frontend-Calls (kein Backend-Endpoint)

**Ampel:**
- PASS: 0 verwaiste Frontend-Calls
- WARN: 1-2 verwaiste Frontend-Calls
- FAIL: >2 verwaiste Frontend-Calls (potentiell kaputte Features)

Hinweis: Verwaiste Backend-Endpoints sind nur WARN (können intern genutzt werden).

---

### Kategorie 6: Code-Qualität

1. **Backend TypeScript**: `cd backend && bunx tsc --noEmit 2>&1 | tail -5` — kompiliert es?
2. **Frontend Lint**: `cd frontend && npx eslint --quiet src/ 2>&1 | tail -5` — Lint-Errors?
3. **Backend Tests**: `cd backend && bun test 2>&1 | tail -5` — Tests bestanden?

**Ampel:**
- PASS: Alles grün
- WARN: Lint-Warnings, aber keine Errors; Tests übersprungen (keine vorhanden)
- FAIL: TypeScript-Fehler oder Lint-Errors oder Test-Failures

---

### Kategorie 7: Docs-Integrität

Prüfe ob die NAV-Strukturen in `DocsPage.jsx` mit dem Dateisystem übereinstimmen. Es gibt zwei Doku-Bereiche:

**Anwenderdoku (`ANWENDERDOKU_NAV` ↔ `docs/anwenderdoku/docs/`):**

1. **Grep** nach `slug:` innerhalb von `ANWENDERDOKU_NAV` in `frontend/src/pages/DocsPage.jsx` — extrahiere alle NAV-Slugs (nicht aus `FEATURES`-Cards o.ä.)
2. Für jeden NAV-Slug prüfen ob `docs/anwenderdoku/docs/{slug}.md` existiert
3. Alle `.md`-Dateien unter `docs/anwenderdoku/docs/` auflisten (rekursiv, relativ zum docs-Root, ohne `.md`-Extension)
4. Prüfen ob jede gefundene Datei als Slug in der NAV referenziert ist

**Entwickler-Doku (`ENTWICKLER_NAV` ↔ `docs/entwickler/docs/`):**

1. **Grep** nach `slug:` innerhalb von `ENTWICKLER_NAV` in `frontend/src/pages/DocsPage.jsx` — extrahiere alle Entwickler-NAV-Slugs
2. Für jeden NAV-Slug prüfen ob `docs/entwickler/docs/{slug}.md` existiert
3. Alle `.md`-Dateien unter `docs/entwickler/docs/` auflisten
4. Prüfen ob jede gefundene Datei als Slug in der `ENTWICKLER_NAV` referenziert ist

**Ampel:**
- PASS: Alle NAV-Slugs (beide Bereiche) haben eine Datei UND alle Dateien sind in der NAV referenziert
- WARN: Verwaiste Dateien vorhanden (Datei existiert, aber kein NAV-Eintrag) — kein kritisches Problem
- FAIL: Fehlende Dateien (NAV-Slug vorhanden, aber keine `.md`-Datei) — Benutzer sieht "Seite nicht gefunden"

---

## Ergebnis-Report

Erstelle den konsolidierten Report:

```
## Quality Gate Report

| # | Kategorie | Status | Findings |
|---|-----------|--------|----------|
| 1 | Design-Konsistenz | PASS/WARN/FAIL | Details |
| 2 | Icon-Duplikate | PASS/WARN/FAIL | Details |
| 3 | Error-Handling | PASS/WARN/FAIL | Details |
| 4 | Auth-Abdeckung | PASS/WARN/FAIL | Details |
| 5 | API-Konsistenz | PASS/WARN/FAIL | Details |
| 6 | Code-Qualität | PASS/WARN/FAIL | Details |
| 7 | Docs-Integrität | PASS/WARN/FAIL | Details |

### Gesamtstatus: PASS / WARN / FAIL

- PASS: Alle Kategorien PASS → Release freigegeben
- WARN: Mindestens 1x WARN, 0x FAIL → Release möglich mit Hinweis
- FAIL: Mindestens 1x FAIL → Release blockiert

### Handlungsbedarf (falls WARN/FAIL)
1. [Kategorie]: [konkreter Fix]
2. ...
```

## Modus: `quick`

Bei `$ARGUMENTS` = `quick` nur die kritischen Kategorien prüfen:
- Kategorie 4: Auth-Abdeckung
- Kategorie 6: Code-Qualität

## Modus: `strict`

Bei `$ARGUMENTS` = `strict` wird WARN wie FAIL behandelt — der Gate blockiert bei jeder Abweichung.

## Wichtig

- **Nur lesen und prüfen, nicht ändern** — der Quality Gate ist read-only
- Findings mit **Datei und Zeilennummer** angeben
- Bei FAIL: Konkrete Handlungsempfehlungen geben
- Dieser Skill wird automatisch als Pflichtschritt im `/release` Workflow aufgerufen
