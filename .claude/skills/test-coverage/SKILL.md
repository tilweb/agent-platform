---
name: test-coverage
description: Analysiere die Testabdeckung, identifiziere Lücken, und erstelle oder aktualisiere Tests.
argument-hint: "[report|fix|backend|frontend|<file-path>]"
disable-model-invocation: true
---

# Test-Coverage

Analysiere die Testabdeckung, identifiziere Lücken, und erstelle oder aktualisiere Tests.

## Argument: $ARGUMENTS (optional)

Standard: Analyse + Report. Optionen:
- `report` — Nur Analyse, keine Änderungen
- `fix` — Analyse + fehlende Tests erstellen + veraltete Tests aktualisieren
- `backend` — Nur Backend analysieren/fixen
- `frontend` — Nur Frontend analysieren/fixen
- Dateipfad (z.B. `backend/src/routes/chat.ts`) — Einzelne Datei analysieren/fixen

## Vorgehen

### Schritt 1: Test-Infrastruktur prüfen

#### Backend
1. Prüfe ob `bun test` funktioniert: `cd backend && bun test 2>&1 | tail -5`
2. Prüfe ob Test-Dateien existieren: Suche nach `**/*.test.ts` und `**/*.spec.ts` in `backend/src/`
3. Zähle Source-Dateien vs. Test-Dateien

#### Frontend
1. Prüfe ob vitest installiert ist: `cat frontend/package.json | jq '.devDependencies.vitest'`
2. Prüfe ob Test-Dateien existieren: Suche nach `**/*.test.{js,jsx}` in `frontend/src/`
3. Falls vitest nicht installiert: Melde das als Setup-Lücke

### Schritt 2: Coverage-Inventar erstellen

Erstelle eine vollständige Matrix aller Source-Dateien und ihrer Test-Companions:

#### Backend Source-Dateien scannen

Für jeden Ordner in `backend/src/`:
- `routes/*.ts` — API-Endpunkte (höchste Priorität)
- `services/*.ts` — Business-Logik (hohe Priorität)
- `tools/*.ts` — Tool-Implementierungen (mittlere Priorität)
- `agents/*.ts` — Agent-Logik (mittlere Priorität)
- `middleware/*.ts` — Middleware (mittlere Priorität)
- `utils/*.ts` — Hilfsfunktionen (niedrige Priorität)
- `mcp/*.ts` — MCP-Integration (niedrige Priorität)

Erwartete Test-Datei-Konvention:
```
backend/src/routes/chat.ts        → backend/src/routes/__tests__/chat.test.ts
backend/src/services/memory.ts    → backend/src/services/__tests__/memory.test.ts
```

#### Frontend Source-Dateien scannen

- `hooks/*.js` — Custom Hooks (höchste Priorität)
- `utils/*.js` — Hilfsfunktionen (hohe Priorität)
- `context/*.jsx` — Context Provider (mittlere Priorität)
- `pages/*.jsx` — Seiten (niedrige Prio, UI-lastig)
- `components/*.jsx` — Komponenten (niedrige Prio, UI-lastig)

Erwartete Test-Datei-Konvention:
```
frontend/src/hooks/useChats.js    → frontend/src/hooks/__tests__/useChats.test.js
frontend/src/utils/apiFetch.js    → frontend/src/utils/__tests__/apiFetch.test.js
```

### Schritt 3: Coverage-Report

```
## Test-Coverage Report

### Übersicht
- Backend Source-Dateien: X
- Backend Test-Dateien: X
- Backend Coverage: X% (Dateien mit Tests / Gesamt)
- Frontend Source-Dateien: X
- Frontend Test-Dateien: X
- Frontend Coverage: X% (Dateien mit Tests / Gesamt)

### Backend Coverage nach Modul

| Modul | Dateien | Mit Tests | Coverage | Priorität |
|-------|---------|-----------|----------|-----------|
| routes/ | X | X | X% | Hoch |
| services/ | X | X | X% | Hoch |
| tools/ | X | X | X% | Mittel |
| middleware/ | X | X | X% | Mittel |
| utils/ | X | X | X% | Niedrig |

### Frontend Coverage nach Modul

| Modul | Dateien | Mit Tests | Coverage | Priorität |
|-------|---------|-----------|----------|-----------|
| hooks/ | X | X | X% | Hoch |
| utils/ | X | X | X% | Hoch |
| context/ | X | X | X% | Mittel |

### Fehlende Tests (nach Priorität sortiert)

| # | Datei | Priorität | Exportierte Funktionen | Empfehlung |
|---|-------|-----------|----------------------|------------|
| 1 | backend/src/routes/auth.ts | Kritisch | login, register, ... | Auth-Tests sind sicherheitskritisch |
| 2 | backend/src/routes/chat.ts | Hoch | ... | Größte Route, meiste Endpoints |
```

### Schritt 4: Veraltete Tests erkennen

Für jede existierende Test-Datei:

1. Lies die Test-Datei und extrahiere getestete Funktionen/Endpoints
2. Lies die zugehörige Source-Datei und extrahiere aktuelle Exports/Endpoints
3. Vergleiche:
   - **Nicht getestete Exports**: Funktion existiert in Source, aber kein Test
   - **Verwaiste Tests**: Test referenziert Funktion die nicht mehr existiert
   - **Signatur-Änderungen**: Funktionsparameter haben sich geändert

```
### Veraltete Tests

| Test-Datei | Problem | Details |
|------------|---------|---------|
| routes/__tests__/chat.test.ts | Nicht getestete Exports | sendMessage, deleteChat |
| routes/__tests__/chat.test.ts | Verwaister Test | test('old endpoint') |
```

### Schritt 5: Tests erstellen/aktualisieren (nur bei Modus `fix`)

Wenn `$ARGUMENTS` `fix` enthält oder ein Dateipfad angegeben ist:

1. **Für Dateien ohne Tests**: Führe die Logik aus `/test-scaffold` aus
   - Lies `.claude/skills/test-scaffold/SKILL.md` für die vollständige Anleitung
   - Erstelle `__tests__/` Verzeichnis falls nötig
   - Generiere Test-Datei mit realistischen Tests

2. **Für veraltete Tests**: Aktualisiere die bestehende Test-Datei
   - Füge Tests für nicht getestete Exports hinzu
   - Entferne oder markiere verwaiste Tests
   - Aktualisiere Signaturen

3. **Reihenfolge** (bei vollem Fix):
   - Beginne mit der höchsten Priorität (auth, dann routes, dann services)
   - Maximal 5 Dateien pro Durchlauf (um Übersichtlichkeit zu wahren)
   - Nach jeder Test-Erstellung: `bun test` laufen lassen um zu verifizieren

### Schritt 6: Tests ausführen

Nach dem Erstellen/Aktualisieren:

```bash
cd backend && bun test 2>&1
```

Berichte:
- Anzahl Tests gesamt
- Bestanden / Fehlgeschlagen
- Neue Tests die fehlschlagen (mit Fehlerdetails)

### Schritt 7: Zusammenfassung

```
## Test-Coverage Zusammenfassung

### Vorher → Nachher
- Backend Coverage: X% → Y%
- Frontend Coverage: X% → Y%
- Neue Test-Dateien erstellt: X
- Tests aktualisiert: X
- Tests gesamt: X (Y bestanden, Z fehlgeschlagen)

### Nächste Schritte
1. Fehlgeschlagene Tests fixen: [Details]
2. Nächste Priorität: [Dateien]
3. Frontend Test-Setup installieren: npm install -D vitest @testing-library/react
```

## Wichtig

- Bei `report` Modus: **Nur lesen, nicht ändern**
- Bei `fix` Modus: Tests erstellen und ausführen
- **Keine Mocks für interne Funktionen** — teste den öffentlichen Contract
- **File-basierte Persistence mocken** — kein echtes `data/` Verzeichnis in Tests
- **Testbeschreibungen auf Deutsch**, Variablennamen auf Englisch
- Maximal **10-15 Tests pro Datei** — Qualität vor Quantität
- Fokus auf **kritische Pfade**: Auth, Validation, Happy Path, Error Cases
- Bei großen Dateien (>500 Zeilen): Nur die wichtigsten Exports testen
