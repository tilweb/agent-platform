# Consistency-Audit

Prüfe die gesamte Codebase auf Duplikate, Pattern-Abweichungen und Inkonsistenzen.

## Argument: $ARGUMENTS (optional)

Standard: vollständiger Audit. Optionen: `icons`, `errors`, `styles`, `components`, `summary`

## Vorgehen

### Schritt 1: Design-Vorgaben laden

Lies `frontend/CLAUDE.md` vollständig — das ist die Single Source of Truth für UI-Patterns.
Lies `backend/src/utils/errorHandler.ts` — das ist der Standard für Error-Handling.

### Schritt 2: Icon-Duplikate finden

Suche nach lokalen Icon-Definitionen die in `components/Icons.jsx` zentralisiert sein sollten:

1. **Grep** nach `function.*Icon\s*\(` in `frontend/src/pages/*.jsx` und `frontend/src/components/*.jsx` (NICHT in Icons.jsx)
2. **Grep** nach `function.*Icon\s*\(` in `frontend/src/apps/**/*.jsx`
3. Für jede gefundene Icon-Funktion:
   - Prüfe ob ein gleichnamiges Icon in `Icons.jsx` existiert
   - Zähle in wie vielen Dateien dasselbe Icon dupliziert ist
   - Prüfe ob der SVG-Inhalt identisch ist

**Ausgabe:**
```
| Icon-Name | Definiert in (Dateien) | In Icons.jsx? | Aktion |
|-----------|----------------------|---------------|--------|
| ToggleOnIcon | 5 Dateien | Nein | Zentralisieren |
```

### Schritt 3: Error-Message Konsistenz

Analysiere alle Backend-Route-Dateien (`backend/src/routes/*.ts`):

1. **Grep** nach `c.json\(\s*\{.*error` — direkte Error-Responses
2. **Grep** nach `errorResponse\(|notFoundError\(|validationError\(|forbiddenError\(|internalError\(|serviceError\(` — korrekte Helper-Nutzung
3. Für jede Route-Datei: Zähle direkte vs. Helper-Aufrufe
4. **Grep** nach englischen Error-Strings in `c.json({ error: '...' })` Aufrufen
5. Prüfe ob `errorHandler` importiert wird

**Ausgabe:**
```
| Route-Datei | Direkte c.json | errorHandler Helper | Import vorhanden? | Englische Messages |
|-------------|---------------|--------------------|--------------------|-------------------|
| chat.ts     | 12            | 3                  | Nein               | 4                 |
```

### Schritt 4: Style-Pattern Konsistenz

Prüfe alle Frontend-Dateien auf Abweichungen von den CLAUDE.md Patterns:

1. **Cards**: Suche nach `backgroundColor: theme.colors.surface` + `borderRadius` — weichen Cards vom Standard (`borderRadius.xl`, `padding: spacing.xl`, `border: 1px solid border`) ab?
2. **Buttons**: Suche nach `cursor: 'pointer'` + `border` Kombinationen — folgen Buttons dem Primary/Secondary/Danger Pattern?
3. **Modals**: Suche nach `position: 'fixed'` + `zIndex` — folgen Modals dem Standard-Overlay-Pattern?
4. **Toggle/Enable-Disable**: Suche nach `type="checkbox"` oder CSS-Toggle-Patterns — wird stattdessen ToggleOnIcon/ToggleOffIcon verwendet?
5. **Status-Badges**: Suche nach `borderRadius.*full` + `fontSize.*xs` — folgen Badges dem Standard?

**Ausgabe:**
```
| Datei | Pattern | Abweichung | Empfehlung |
|-------|---------|------------|------------|
```

### Schritt 5: Komponenten-Duplikate

Suche nach Funktionen/Komponenten die in mehreren Dateien identisch oder fast identisch definiert sind:

1. **Grep** nach `function [A-Z]` in Pages und Components — exportierte Komponenten
2. Vergleiche Funktionsnamen über Dateigrenzen hinweg
3. Identifiziere Kandidaten für Extraktion in eigene Komponenten

Typische Kandidaten:
- Markdown-Renderer (ReactMarkdown mit theme-Styles)
- Bestätigungs-Dialoge
- Lade-Indikatoren
- Leere-Zustands-Anzeigen (Empty States)

**Ausgabe:**
```
| Komponente | Definiert in | Identisch? | Aktion |
|------------|-------------|------------|--------|
```

### Schritt 6: Zusammenfassung

```
## Consistency-Audit Ergebnis

Geprüfte Dateien: X

### Icon-Duplikate
- X Icons in Y Dateien dupliziert
- X davon fehlen in Icons.jsx

### Error-Handling
- X Route-Dateien mit direkten c.json({ error }) Aufrufen
- X englische Error-Messages (sollten Deutsch sein)
- X Dateien ohne errorHandler Import

### Style-Abweichungen
- X Cards weichen vom Standard ab
- X Buttons folgen nicht dem Pattern
- X Toggle-Implementierungen sind nicht Standard

### Komponenten-Duplikate
- X Komponenten in mehreren Dateien definiert

### Top-Priorities
1. ...
2. ...
3. ...
```

## Wichtig

- **Nur lesen, nicht ändern** — der Audit ist read-only
- Jedes Finding mit **exakter Datei und Zeilennummer** angeben
- Bei `$ARGUMENTS` = `summary` nur die Zusammenfassung ausgeben
- Bei `$ARGUMENTS` = `icons` nur Schritt 2 ausführen
- Bei `$ARGUMENTS` = `errors` nur Schritt 3 ausführen
- Bei `$ARGUMENTS` = `styles` nur Schritt 4 ausführen
- Bei `$ARGUMENTS` = `components` nur Schritt 5 ausführen
