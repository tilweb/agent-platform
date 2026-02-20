---
name: critical-code-audit
description: Führe ein kritisches Code-Audit der Codebase durch. Analysiere den Code systematisch in 9 Bereichen und liefere konkrete Findings.
argument-hint: "[backend|frontend|routes]"
---

Führe ein kritisches Code-Audit der Codebase durch. Analysiere den Code systematisch in 9 Bereichen und liefere konkrete, umsetzbare Findings mit Dateinamen, Zeilennummern und Verbesserungsvorschlägen.

Optionaler Scope: $ARGUMENTS (default: gesamte Codebase. Mögliche Werte: backend, frontend, routes)

---

## Vorgehen

1. Verschaffe dir zuerst einen Überblick über die Projektstruktur (Glob/Grep)
2. Analysiere dann systematisch jeden der 9 Bereiche
3. Erstelle am Ende einen strukturierten Report

---

## Audit-Bereich 1: Doppelter / Redundanter Code (DRY-Violations)

Prüfe systematisch auf:

- **Kopierte Funktionen**: Gleiche oder fast gleiche Funktionsblöcke in verschiedenen Dateien
- **Wiederholt definierte Hilfsfunktionen**: z.B. Datum-Formatierung, String-Manipulation, Validierung, die an mehreren Stellen neu implementiert wird statt zentral bereitgestellt zu werden
- **Duplizierte Business-Logik**: Gleiche Geschäftsregeln in Routes UND Services, oder in Frontend UND Backend
- **Copy-Paste Patterns**: Ähnliche Codeblöcke die sich nur in 1-2 Variablen unterscheiden (Kandidaten für Abstraktion)
- **Mehrfach definierte Types/Interfaces**: Gleiche Typdefinitionen in verschiedenen Dateien statt in einem shared Types-Modul
- **Redundante API-Aufrufe**: Frontend-Code der den gleichen Fetch-Pattern immer wieder schreibt statt einen gemeinsamen Helper zu nutzen

**Vorgehen:** Lies Dateien mit ähnlichem Zweck und vergleiche deren Implementierung. Achte besonders auf:
- Services die ähnliche YAML-Dateioperationen durchführen
- Route-Handler mit wiederkehrenden Patterns (Auth-Check, Validierung, Response-Format)
- Frontend-Hooks und Komponenten mit überlappender Logik

---

## Audit-Bereich 2: Unauthentifizierte Endpunkte

Dies ist ein **sicherheitskritischer** Prüfpunkt.

**Architektur-Kontext dieser Codebase:**
- Auth-Middleware: `authMiddleware` aus `backend/src/auth/middleware.ts`
- Routes werden in `backend/src/index.ts` gemountet
- Manche Routes nutzen `authMiddleware` als Route-Level Middleware, andere auf App-Level

**Prüfe:**
- **Jede Route-Datei in `backend/src/routes/`**: Hat sie `authMiddleware` importiert und angewendet?
- **Einzelne Endpunkte ohne Auth**: Auch wenn die Route-Datei generell Auth hat — gibt es einzelne Endpunkte die es umgehen?
- **Bewusste Ausnahmen identifizieren**: Login/Register/Health-Endpunkte SOLLEN unauthentifiziert sein — markiere diese als "bewusst offen"
- **Middleware-Reihenfolge**: Wird `authMiddleware` VOR den Route-Handlern angewendet?
- **RBAC ohne Auth**: Wird `requireRole`/RBAC-Middleware ohne vorherige Auth-Middleware genutzt? Das wäre ein kritischer Fehler.

**Vorgehen:**
1. Lies `backend/src/index.ts` um zu verstehen wie Routes gemountet werden
2. Lies jede Route-Datei und prüfe ob/wie `authMiddleware` verwendet wird
3. Erstelle eine vollständige Matrix: Route -> Auth-Status -> Bewertung

---

## Audit-Bereich 3: Zirkuläre Abhängigkeiten (Circular Imports)

Zirkuläre Imports führen in TypeScript/Bun zu subtilen Laufzeitfehlern: ein Import ist `undefined` weil das Modul noch nicht fertig geladen ist.

**Prüfe:**
- **Import-Ketten nachverfolgen**: Wenn A -> B -> C -> A importiert, entsteht ein Zyklus
- **Service-Abhängigkeiten**: Besonders anfällig sind Services die sich gegenseitig aufrufen (z.B. `llm.ts` <-> `agentLoop.ts`, oder `taskService.ts` <-> `taskExecutor.ts`)
- **Type-only vs. Value Imports**: `import type { X }` verursacht KEINE Zyklen — nur Value-Imports. Unterscheide klar.
- **Barrel-Exports (`index.ts`)**: Re-Export-Dateien sind häufige Auslöser von Zyklen weil sie alles bündeln
- **Lazy Imports als Workaround**: Wenn ein `require()` oder dynamisches `import()` mitten in einer Funktion steht, ist das oft ein Hinweis auf einen umgangenen Zyklus

**Vorgehen:**
1. Starte bei zentralen Modulen (`index.ts`, `services/`, `tools/`)
2. Verfolge Import-Ketten über 3-4 Ebenen
3. Markiere verdächtige Zyklen und prüfe ob es Value- oder Type-Imports sind

---

## Audit-Bereich 4: Inkonsistente Fehlerbehandlung

Inkonsistente Error-Responses machen das Frontend fragil — es muss verschiedene Formate parsen.

### A) Zentrales Error-Handling — Architektur-Check

Prüfe ob eine einheitliche Error-Handling-Architektur existiert:

- **Globaler Error-Handler**: Gibt es einen `app.onError()` Handler in Hono der alle ungefangenen Fehler einheitlich behandelt? Wenn nicht, fallen Fehler als generische 500er durch.
- **Zentrale Error-Klasse**: Existiert eine `AppError` / `HttpError` Klasse mit strukturierten Feldern (statusCode, errorCode, message, details)? Oder wirft jede Route eigene Error-Objekte/Strings?
- **Error-Response-Helper**: Gibt es eine zentrale Funktion wie `errorResponse(c, status, code, message)` die alle Routes nutzen? Oder baut jeder Handler seine Error-Response selbst zusammen?
- **Error-Codes**: Gibt es ein definiertes Set von Error-Codes (z.B. `AUTH_REQUIRED`, `NOT_FOUND`, `VALIDATION_FAILED`) das Frontend und Backend teilen? Oder nur Freitext-Messages?
- **Strukturiertes Error-Logging**: Werden Fehler über einen zentralen Logger mit Kontext geloggt (Request-ID, User-ID, Timestamp, Stack-Trace)? Oder nur verstreute `console.error()` Aufrufe?
- **Error-Propagation**: Wenn ein Service einen Fehler wirft — wie kommt der zum Client? Wird der Original-Fehler verschluckt und durch einen generischen ersetzt, oder leakt er Details (Stack Traces, interne Pfade)?

**Bewertung:** Wenn es KEINE zentrale Error-Architektur gibt, ist das ein HOCH-Finding mit konkretem Vorschlag zur Implementierung (Error-Klasse + globaler Handler + Response-Helper).

### B) Inkonsistenzen im bestehenden Error-Handling

**Prüfe:**
- **Response-Format**: Nutzen alle Endpunkte das gleiche Error-Schema? z.B. `{ error: string }` vs. `{ message: string }` vs. `{ error: { code, message } }`
- **HTTP Status Codes**: Werden die richtigen Codes verwendet? (400 vs. 500, 404 vs. 403)
- **Try-Catch Konsistenz**: Haben alle Route-Handler try-catch? Oder fangen manche Fehler nicht ab und lassen sie als 500 durchfallen?
- **Error-Logging**: Werden Fehler konsistent geloggt? Manche Routes loggen mit `console.error`, andere gar nicht
- **Fehlende Error-Handler**: Endpunkte die bei `Bun.file().text()` keinen Fehler abfangen wenn die Datei nicht existiert
- **Stille Fehler**: `catch (e) {}` oder `catch (e) { /* ignore */ }` — verschluckte Fehler die Debugging unmöglich machen
- **Error-Leaking**: Werden interne Details (Stack Traces, Dateipfade, SQL-Queries) an den Client weitergegeben? Das ist ein Sicherheitsrisiko.

**Vorgehen:**
1. Prüfe zuerst ob ein globaler `app.onError()` Handler, eine zentrale Error-Klasse oder ein Error-Response-Helper existiert
2. Lies alle Route-Dateien und extrahiere die Error-Handling-Patterns
3. Vergleiche Response-Formate und Status-Codes
4. Identifiziere Endpunkte ohne jegliches Error-Handling
5. Wenn keine zentrale Architektur existiert: Erstelle einen konkreten Vorschlag mit Codebeispiel

---

## Audit-Bereich 5: Fehlende Input-Validierung

Über Auth hinaus: Jede Benutzereingabe ist ein Angriffsvektor.

**Prüfe:**
- **Request Body**: Endpunkte die `c.req.json()` nutzen ohne das Ergebnis zu validieren (fehlende Felder, falsche Typen, zu lange Strings)
- **URL-Parameter**: `c.req.param('id')` — wird geprüft ob die ID ein gültiges Format hat? Oder wird sie direkt als Dateipfad verwendet (Path Traversal!)?
- **Query-Parameter**: `c.req.query('limit')` — wird geprüft ob es eine Zahl ist? Kann ein Angreifer `limit=999999` setzen?
- **File-Upload**: Werden Dateigrößen und -typen validiert?
- **Path Traversal**: Wird bei Dateioperationen geprüft, dass der Pfad nicht aus dem erlaubten Verzeichnis ausbricht? (z.B. `../../etc/passwd`)
- **Injection in YAML**: Da die Codebase YAML für Persistenz nutzt — wird User-Input sanitized bevor er in YAML geschrieben wird?

**Vorgehen:**
1. Identifiziere alle Stellen wo User-Input gelesen wird
2. Prüfe ob zwischen Input und Verarbeitung eine Validierung stattfindet
3. Besonderes Augenmerk auf Dateipfad-Konstruktion mit User-Input

---

## Audit-Bereich 6: Type-Safety Lücken

TypeScript bietet nur Sicherheit wenn es nicht umgangen wird.

**Prüfe:**
- **`as any`**: Jede Stelle wo `as any` verwendet wird — warum? Gibt es einen sichereren Weg?
- **`@ts-ignore` / `@ts-expect-error`**: Unterdrückte Compiler-Fehler die auf echte Probleme hinweisen könnten
- **Type Assertions (`as SomeType`)**: Besonders gefährlich wenn der tatsächliche Typ zur Laufzeit anders ist (z.B. `JSON.parse(data) as UserConfig` ohne Validierung)
- **`any`-Parameter**: Funktionen die `any` akzeptieren statt spezifische Typen
- **Fehlende Return-Types**: Öffentliche Funktionen ohne expliziten Return-Type — TypeScript inferiert, aber das kann sich unbemerkt ändern
- **Non-null Assertions (`!`)**: `user!.name` — Annahme dass der Wert nie null ist, ohne das zu prüfen

**Vorgehen:**
1. Suche systematisch nach `as any`, `@ts-ignore`, `@ts-expect-error`, `as `, `!.`
2. Bewerte jede Stelle: Gibt es einen sichereren Weg?
3. Priorisiere Stellen an System-Grenzen (API-Input, Datei-Lesen, externe Daten)

---

## Audit-Bereich 7: Race Conditions bei File-Persistenz

Diese Codebase nutzt dateibasierte Speicherung (YAML/JSON in `data/`). Bei gleichzeitigen Requests entsteht ein klassisches Read-Modify-Write Problem.

**Prüfe:**
- **Read-Modify-Write ohne Locking**: Code der eine Datei liest, modifiziert, und zurückschreibt — ohne sicherzustellen dass kein anderer Request dazwischen geschrieben hat
- **Betroffene Operationen**: Chat-Nachrichten anhängen, Task-Status ändern, User-Einstellungen aktualisieren, Session-Management
- **Kritische Pfade identifizieren**: Welche Dateien werden von mehreren Endpunkten gleichzeitig geschrieben?
- **Concurrent Chat-Messages**: Wenn zwei Nachrichten gleichzeitig an denselben Chat gesendet werden — geht eine verloren?
- **Task-Queue**: Können zwei Worker denselben Task greifen?
- **Atomic Operations**: Nutzt der Code `Bun.write()` (überschreibt atomar) oder schrittweises Schreiben?

**Vorgehen:**
1. Identifiziere alle Schreiboperationen auf `data/`-Dateien
2. Prüfe ob es Locking/Mutex-Mechanismen gibt
3. Simuliere mental: Was passiert bei 2 gleichzeitigen Requests auf denselben Endpunkt?

---

## Audit-Bereich 8: Fehlende Middleware-Abdeckung

Über Auth hinaus gibt es weitere Middleware die konsistent angewendet werden muss.

**Prüfe:**
- **CSRF-Schutz**: Ist `csrfProtection` auf alle state-ändernden Endpunkte (POST/PUT/DELETE) angewendet? Ausnahmen nur für API-Token-basierte Zugriffe
- **Rate-Limiting**: Sind sensible Endpunkte (Login, Register, API-Calls zu externen LLMs) rate-limited?
- **Security Headers**: Wird `securityHeaders` global angewendet oder fehlt es auf manchen Routes?
- **CORS**: Ist die CORS-Konfiguration restriktiv genug? Werden Wildcard-Origins vermieden?
- **Request Size Limits**: Gibt es Limits für Request-Body-Größe? Kann ein Angreifer 100MB JSON senden?
- **Middleware-Reihenfolge**: Wird Security-Middleware VOR Business-Logic angewendet?

**Vorgehen:**
1. Lies `backend/src/index.ts` und identifiziere welche Middleware global vs. route-spezifisch ist
2. Prüfe jede Route-Datei auf fehlende Middleware
3. Vergleiche die Middleware-Anwendung zwischen verschiedenen Route-Dateien

---

## Audit-Bereich 9: Verwaister / Toter Code

Prüfe auf:

- **Unexportierte Funktionen die nie intern aufgerufen werden**: Funktionen die weder exportiert noch in der eigenen Datei verwendet werden
- **Exportierte Funktionen ohne Imports**: Module die Funktionen exportieren, die nirgendwo importiert werden
- **Auskommentierter Code**: Codeblöcke die auskommentiert sind und nie aufgeräumt wurden
- **Unused Imports**: Import-Statements für Module die in der Datei nicht verwendet werden
- **Feature-Flags / Konstanten die nie abgefragt werden**: Konfigurationen die definiert aber nie gelesen werden
- **Verwaiste Dateien**: Dateien die von keiner anderen Datei importiert oder referenziert werden
- **Deprecated Code mit TODO/FIXME**: Alter Code der als deprecated markiert ist aber nie entfernt wurde
- **Unerreichbarer Code**: Code nach early returns, nach throw-Statements, in unmöglichen Branches

**Vorgehen:**
1. Erstelle eine Dateiliste
2. Prüfe Exports und Imports systematisch
3. Suche nach auskommentiertem Code und TODO/FIXME-Markierungen

---

## Audit-Bereich 10: Testabdeckung

Tests sind die einzige Garantie, dass Refactorings und Bugfixes keine Regressionen verursachen.

### A) Ist-Zustand der Tests

- **Testdateien finden**: Suche nach `*.test.ts`, `*.spec.ts`, `*.test.js`, `*.spec.js` in Backend und Frontend
- **Test-Framework**: Welches Framework wird genutzt? (Backend: `bun:test`, Frontend: vitest/jest?)
- **Anzahl Tests**: Wie viele Testdateien und Testfälle existieren insgesamt?
- **Test-Infrastruktur**: Gibt es Test-Utilities, Mocks, Fixtures, Test-Factories?

### B) Abdeckungslücken identifizieren

Vergleiche die vorhandenen Tests mit dem tatsächlichen Code:

- **Routes ohne Tests**: Welche Route-Dateien in `backend/src/routes/` haben KEINE zugehörige Testdatei? Besonders kritisch bei auth-relevanten und daten-mutierenden Endpunkten
- **Services ohne Tests**: Welche Services in `backend/src/services/` sind ungetestet? Priorisiere nach Komplexität und Kritikalität (LLM-Orchestrierung, Task-Queue, Auth)
- **Sicherheitskritische Pfade**: Sind Auth-Middleware, RBAC, Session-Management, Input-Validierung durch Tests abgesichert?
- **Edge Cases**: Werden Fehlerpfade getestet (ungültige Eingaben, fehlende Dateien, Berechtigungsfehler)?
- **Frontend-Tests**: Gibt es Tests für Hooks, Utility-Funktionen, oder kritische Komponenten?
- **Integration vs. Unit**: Gibt es nur Unit-Tests oder auch Integrationstests die das Zusammenspiel von Routes -> Services -> Persistenz prüfen?

### C) Test-Qualität

- **Assertions**: Testen die Tests tatsächlich etwas Sinnvolles oder sind es nur "smoke tests" die prüfen ob kein Error fliegt?
- **Mocking**: Werden externe Abhängigkeiten (LLM-APIs, Dateisystem) korrekt gemockt? Oder greifen Tests auf echte Dateien/APIs zu?
- **Test-Isolation**: Können Tests parallel laufen oder beeinflussen sie sich gegenseitig (z.B. durch gemeinsame Dateien in `data/`)?
- **Flaky Tests**: Gibt es Tests die von Timing, Netzwerk oder Dateisystem-Zustand abhängen?

**Vorgehen:**
1. Suche alle Test-Dateien und erstelle eine Übersicht
2. Erstelle eine Matrix: Source-Datei -> zugehöriger Test -> Abdeckungsgrad (keine Tests / nur Happy Path / inkl. Edge Cases)
3. Identifiziere die kritischsten ungetesteten Module und priorisiere nach Risiko

**Bewertung:**
- KRITISCH: Sicherheitsrelevanter Code komplett ohne Tests (Auth, RBAC, Input-Validierung)
- HOCH: Kernlogik ohne Tests (LLM-Orchestrierung, Task-Queue, Daten-Persistenz)
- MITTEL: Services/Routes mit nur oberflächlichen Tests (kein Error-Path-Testing)
- NIEDRIG: Utility-Code oder UI-Komponenten ohne Tests

---

## Bewertungsschema

Jedes Finding bekommt eine Severity:

- KRITISCH: Sicherheitsrelevant — sofort beheben (offene Endpunkte, Path Traversal, fehlende Validierung an System-Grenzen, Race Conditions mit Datenverlust)
- HOCH: Funktional problematisch oder hohes Risiko (50+ Zeilen Duplikate, zirkuläre Abhängigkeiten die Runtime-Fehler verursachen, inkonsistente Fehlerbehandlung die Bugs maskiert)
- MITTEL: Code-Qualität beeinträchtigt (kleinere Duplikate, `as any` an unkritischen Stellen, fehlende Rate-Limits auf nicht-sensiblen Endpunkten)
- NIEDRIG: Kosmetisch / Aufräum-Kandidat (auskommentierter Code, veraltete TODOs, unused exports, fehlende Return-Types)

## Subagenten

Nutze spezialisierte Subagenten (via Task-Tool) für die folgenden Audit-Bereiche — sie laufen als haiku und sind kostengünstiger:

- **Bereich 2 (Unauthentifizierte Endpunkte)**: `auth-auditor` Subagent (subagent_type: `auth-auditor`)
- **Bereich 9 (Verwaister Code)**: `dead-code-finder` Subagent (subagent_type: `dead-code-finder`)
- **Bereiche 2, 5, 8 (Security-relevante Checks)**: `security-scanner` Subagent (subagent_type: `security-scanner`)

Starte die Subagenten parallel wo möglich und konsolidiere deren Ergebnisse im Gesamt-Report.

## Wichtige Regeln

- **Sei spezifisch**: Nenne immer Dateiname, Zeilennummern und den betroffenen Code
- **Zeige Paare**: Bei Duplikaten zeige BEIDE Stellen und was identisch/ähnlich ist
- **Keine False Positives**: Ein Pattern das 3x vorkommt aber jeweils leicht anders ist, ist kein Duplikat — es ist ein Kandidat für Abstraktion. Unterscheide klar.
- **Kontext beachten**: Manche "Duplikate" sind bewusst (z.B. ähnliche aber fachlich verschiedene Validierungen)
- **Actionable Output**: Zu jedem Finding gehört ein konkreter Verbesserungsvorschlag

## Output-Format

Erstelle den Report in folgendem Format:

```
# Kritisches Code Audit Report

**Datum:** [heute]
**Scope:** [scope]
**Geprüfte Dateien:** [anzahl]

## Zusammenfassung

| Kategorie | Kritisch | Hoch | Mittel | Niedrig |
|-----------|----------|------|--------|---------|
| Unauthentifizierte Endpunkte | | | | |
| Fehlende Input-Validierung | | | | |
| Race Conditions | | | | |
| Middleware-Abdeckung | | | | |
| Doppelter Code | | | | |
| Zirkuläre Abhängigkeiten | | | | |
| Fehlerbehandlung (Architektur) | | | | |
| Fehlerbehandlung (Inkonsistenzen) | | | | |
| Type-Safety Lücken | | | | |
| Verwaister Code | | | | |
| Testabdeckung | | | | |

## [Pro Bereich: Findings mit Severity, Datei, Zeile, Beschreibung, Empfehlung]

## Priorisierte Handlungsempfehlungen
[Top-10 Maßnahmen nach Impact sortiert mit geschätztem Aufwand]

## Metriken
- Geschätzter redundanter Code: ~X Zeilen
- Potenziell unsichere Endpunkte: X
- Endpunkte ohne Input-Validierung: X
- Race-Condition-Kandidaten: X Stellen
- Zirkuläre Import-Ketten: X
- Type-Safety Umgehungen: X Stellen
- Dead Code Kandidaten: X Stellen
- Testdateien: X (von Y Source-Dateien)
- Ungetestete kritische Module: X
```
