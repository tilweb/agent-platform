Erstelle ein Release mit Version Bump, Changelog, Doku-Update und Build-Verifizierung.

Argument: `$ARGUMENTS` (default: `patch`. Mögliche Werte: `major`, `minor`, `patch`, oder eine explizite Version wie `1.2.3`)

---

## Vorgehen

Arbeite die folgenden 10 Schritte sequenziell ab. Bei einem Fehler in einem Hard-Gate-Schritt: STOPPE und berichte den Fehler.

---

## Schritt 1: Git-Status prüfen (Hard Gate)

```bash
git status --porcelain
```

- Wenn die Ausgabe NICHT leer ist: **STOPPE** und weise den Benutzer darauf hin, dass uncommitted Changes existieren. Zeige die betroffenen Dateien an.
- Wenn leer: Weiter.

Prüfe außerdem den aktuellen Branch:
```bash
git branch --show-current
```

Melde den Branch-Namen.

---

## Schritt 2: Aktuelle Version ermitteln

Lies die aktuelle Version aus drei Quellen:

1. **frontend/package.json** → `version`-Feld
2. **backend/package.json** → `version`-Feld
3. **Git-Tags**:
```bash
git tag --list 'v*' --sort=-version:refname | head -5
```

Prüfe Konsistenz:
- Wenn Frontend- und Backend-Version unterschiedlich sind: Melde die Diskrepanz und verwende die höhere Version als Basis
- Wenn keine Version gesetzt ist (z.B. `0.0.0`): Verwende `0.0.0` als Basis
- Wenn Git-Tags existieren, die höher sind als die package.json-Version: Melde die Diskrepanz

Melde die ermittelte Basisversion.

---

## Schritt 3: Neue Version berechnen

Basierend auf `$ARGUMENTS` und der Basisversion:

- `patch` (default): `X.Y.Z` → `X.Y.(Z+1)`
- `minor`: `X.Y.Z` → `X.(Y+1).0`
- `major`: `X.Y.Z` → `(X+1).0.0`
- Explizite Version (z.B. `1.2.3`): Verwende diese direkt. Prüfe dass sie höher als die aktuelle ist.

Melde: `Aktuelle Version: X.Y.Z → Neue Version: A.B.C`

---

## Schritt 4: Changelog generieren

### Commits seit letztem Release sammeln

```bash
git log --pretty=format:"%h %s" $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD
```

Falls kein vorheriger Tag existiert, verwende alle Commits.

### Commits kategorisieren

Ordne jeden Commit einer Kategorie zu basierend auf dem Commit-Message-Prefix oder Inhalt:

| Kategorie | Erkennung |
|-----------|-----------|
| Neue Features | `Add`, `Implement`, `Introduce`, `New` |
| Verbesserungen | `Update`, `Improve`, `Enhance`, `Refactor`, `Optimize` |
| Fehlerbehebungen | `Fix`, `Bugfix`, `Resolve`, `Repair` |
| Dokumentation | `Doc`, `Docs`, `README`, `CLAUDE.md` |
| Infrastruktur | `CI`, `Build`, `Deploy`, `Config`, `Dependency` |
| Sonstiges | Alles andere |

### CHANGELOG.md erstellen oder erweitern

Format: [Keep a Changelog](https://keepachangelog.com/de/) auf Deutsch.

Wenn `CHANGELOG.md` bereits existiert: Neuen Eintrag am Anfang einfügen (nach dem Header).
Wenn nicht: Neue Datei erstellen.

Struktur:

```markdown
# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/).

## [A.B.C] - YYYY-MM-DD

### Neue Features
- Beschreibung (Commit-Hash)

### Verbesserungen
- Beschreibung (Commit-Hash)

### Fehlerbehebungen
- Beschreibung (Commit-Hash)

### Dokumentation
- Beschreibung (Commit-Hash)

### Infrastruktur
- Beschreibung (Commit-Hash)

### Sonstiges
- Beschreibung (Commit-Hash)
```

Leere Kategorien weglassen. Commit-Beschreibungen auf Deutsch formulieren (ggf. vom englischen Commit-Message übersetzen). Jeder Eintrag sollte verständlich und benutzerfreundlich formuliert sein — keine reinen Commit-Messages, sondern lesbare Beschreibungen.

---

## Schritt 5: Dokumentation aktualisieren

Führe die gleiche Logik wie der `/update-docs`-Command im Modus `full` aus:

1. Lies `.claude/commands/update-docs.md` für die vollständige Anleitung
2. Führe die 5 Schritte aus (Feature-Inventar → Doku einlesen → Gap-Analyse → Aktualisieren → Konsistenzprüfung)
3. Melde die Doku-Änderungen im Release-Report

Falls keine Doku-Änderungen nötig sind (alles aktuell): Melde das und fahre fort.

---

## Schritt 6: Version in package.json setzen

Aktualisiere das `version`-Feld in beiden Dateien:

1. **`frontend/package.json`**: Setze `"version": "A.B.C"`
2. **`backend/package.json`**: Setze `"version": "A.B.C"` (Feld hinzufügen falls nicht vorhanden, direkt nach dem `"name"`-Feld)

Prüfe nach dem Schreiben, dass die JSON-Dateien valide sind.

---

## Schritt 7: Build verifizieren

### Frontend Build (Hard Gate)
```bash
cd frontend && npm run build
```
- Bei Fehler: **STOPPE** und berichte den Fehler. Der Release kann nicht fortgesetzt werden.

### Frontend Lint (Soft Gate)
```bash
cd frontend && npm run lint
```
- Bei Fehler: Melde die Lint-Warnings/-Errors, aber fahre fort.

### Backend Tests (Soft Gate)
```bash
cd backend && bun test
```
- Bei Fehler: Melde die fehlgeschlagenen Tests, aber fahre fort.
- Wenn kein Test-Script konfiguriert ist oder keine Tests existieren: Überspringe und melde das.

Melde das Ergebnis jeder Prüfung.

---

## Schritt 8: Release-Commit und Git-Tag erstellen

### Alle Änderungen stagen

Stage alle durch den Release-Prozess geänderten Dateien:
- `frontend/package.json`
- `backend/package.json`
- `CHANGELOG.md`
- Alle geänderten/neuen Doku-Dateien unter `docs/`
- `frontend/src/pages/DocsPage.jsx` (falls geändert)

```bash
git add frontend/package.json backend/package.json CHANGELOG.md docs/ frontend/src/pages/DocsPage.jsx
```

### Commit erstellen

```bash
git commit -m "Release vA.B.C"
```

### Tag erstellen

```bash
git tag -a vA.B.C -m "Release vA.B.C"
```

---

## Schritt 9: Push zum Remote

**WICHTIG:** Frage den Benutzer VOR dem Push um Bestätigung.

Zeige dem Benutzer:
- Branch-Name
- Neuer Tag: `vA.B.C`
- Anzahl der Commits seit dem letzten Tag

Wenn der Benutzer bestätigt:
```bash
git push origin <branch> --tags
```

Wenn der Benutzer ablehnt: Überspringe den Push und weise darauf hin, dass der Commit und Tag lokal existieren und später manuell gepusht werden können.

---

## Schritt 10: Abschluss-Report

Erstelle eine vollständige Zusammenfassung:

```
# Release Report

**Version:** vA.B.C
**Datum:** [heute]
**Branch:** [branch-name]

## Versionsänderung
- Vorherige Version: X.Y.Z
- Neue Version: A.B.C
- Typ: [major / minor / patch]

## Changelog-Einträge
- Neue Features: X
- Verbesserungen: X
- Fehlerbehebungen: X
- Dokumentation: X
- Infrastruktur: X

## Dokumentation
- Aktualisierte Seiten: X
- Neue Seiten: X
- Konsistenzprüfung: bestanden / [Probleme]

## Build-Verifizierung
- Frontend Build: bestanden / fehlgeschlagen
- Frontend Lint: bestanden / X Warnings
- Backend Tests: bestanden / X fehlgeschlagen / übersprungen

## Git
- Commit: [hash]
- Tag: vA.B.C
- Push: erfolgt / ausstehend

## Nächste Schritte (falls relevant)
- [z.B. "Push ausstehend: git push origin main --tags"]
- [z.B. "Lint-Warnings beheben: npm run lint"]
```
