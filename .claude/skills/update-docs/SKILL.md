---
name: update-docs
description: Aktualisiere die Anwenderdokumentation basierend auf dem tatsächlichen Code-Stand.
argument-hint: "[check|full|section:NAME]"
disable-model-invocation: true
---

Aktualisiere die Anwenderdokumentation basierend auf dem tatsächlichen Code-Stand.

Argument: `$ARGUMENTS` (default: `full`. Mögliche Werte: `check` — nur Analyse ohne Änderungen, `full` — Analyse + Update, `section:NAME` — nur eine bestimmte Sektion aktualisieren, z.B. `section:chat`)

---

## Vorgehen

Arbeite die folgenden 5 Schritte sequenziell ab. Gib nach jedem Schritt eine kurze Zusammenfassung.

---

## Schritt 1: Feature-Inventar erstellen

Erstelle ein vollständiges Inventar aller Features der Plattform. Analysiere dazu systematisch:

### Frontend-Struktur
- **Routes**: Lies `frontend/src/App.jsx` und extrahiere alle registrierten Routes (Pfade + Komponenten)
- **Navigation**: Lies `frontend/src/components/Sidebar.jsx` und extrahiere alle Navigationseinträge
- **Settings-Tabs**: Lies `frontend/src/pages/SettingsPage.jsx` und extrahiere alle Tabs (inkl. adminOnly-Tabs)

### Backend-Funktionen
- **API-Endpunkte**: Lies alle Dateien in `backend/src/routes/` und extrahiere die Endpunkte (Methode + Pfad + Kurzbeschreibung)
- **Skills**: Lies alle Dateien in `backend/data/skills/` und extrahiere Skill-Namen und -Beschreibungen
- **Tools**: Lies `backend/src/tools/` (insbesondere Registry und Kategorien) und extrahiere verfügbare Tool-Kategorien
- **Slash-Commands**: Lies `backend/src/commands/` und extrahiere registrierte Befehle

### Inventar-Format

Erstelle eine Tabelle:

```
| Feature | Typ | Frontend-Route | Backend-Route | Beschreibung |
|---------|-----|---------------|---------------|--------------|
```

---

## Schritt 2: Bestehende Dokumentation einlesen

Lies alle Dokumentationsdateien:

### Anwenderdoku
1. **NAV-Struktur**: Lies `frontend/src/pages/DocsPage.jsx` — extrahiere die `ANWENDERDOKU_NAV`-Konstante (Sektionen, Slugs, Titel) und die `FEATURES`-Konstante
2. **Markdown-Dateien**: Lies alle `.md`-Dateien unter `docs/anwenderdoku/docs/` rekursiv
3. **Verzeichnisstruktur**: Prüfe welche Unterverzeichnisse existieren

### Entwickler-Dokumentation
1. **NAV-Struktur**: Extrahiere die `ENTWICKLER_NAV`-Konstante aus `DocsPage.jsx`
2. **Markdown-Dateien**: Lies alle `.md`-Dateien unter `docs/entwickler/docs/` rekursiv
3. **Trigger**: Entwickler-Doku aktualisieren bei Änderungen in `backend/src/plugins/`, `backend/src/connections/`, oder Plugin-Manifesten unter `data/plugins/builtin/`

Erstelle eine Übersicht:

```
| Datei (Slug) | Titel | Sektion | Wortanzahl (ca.) |
|--------------|-------|---------|------------------|
```

---

## Schritt 3: Gap-Analyse

Vergleiche Feature-Inventar (Schritt 1) mit Dokumentation (Schritt 2) und erstelle eine Vergleichsmatrix:

```
| Feature | Doku-Status | Details |
|---------|-------------|---------|
| Chat | aktuell | Alle Funktionen dokumentiert |
| Tools-Seite | fehlt | Keine Doku-Seite vorhanden |
| MCP Servers | fehlt | Kein Abschnitt in Settings-Doku |
| Agenten erstellen | veraltet | Neue Felder fehlen (z.B. ...) |
| ... | verwaist | Doku existiert, Feature wurde entfernt |
```

Status-Kategorien:
- **aktuell** — Doku deckt alle aktuellen Features ab
- **veraltet** — Doku existiert, aber Funktionen haben sich geändert
- **fehlt** — Feature existiert, aber keine Doku vorhanden
- **verwaist** — Doku existiert, aber Feature wurde entfernt oder umbenannt

**Wenn `$ARGUMENTS` = `check`**: Gib die Vergleichsmatrix als Report aus und STOPPE hier. Nimm keine Änderungen vor.

**Wenn `$ARGUMENTS` = `section:NAME`**: Filtere die Matrix auf die angegebene Sektion und fahre nur für diese fort.

---

## Schritt 4: Dokumentation aktualisieren

Für jeden Eintrag mit Status `veraltet` oder `fehlt`:

### Bestehende Seiten aktualisieren (Status: veraltet)
- Lies die bestehende Markdown-Datei
- Lies den zugehörigen Frontend- und Backend-Code, um den aktuellen Stand zu ermitteln
- Aktualisiere die Doku-Datei: Neue Features ergänzen, entfernte Features entfernen, geänderte Beschreibungen anpassen
- Behalte den bestehenden Stil und die Struktur bei

### Neue Seiten erstellen (Status: fehlt)
- Erstelle eine neue Markdown-Datei im passenden Unterverzeichnis von `docs/anwenderdoku/docs/`
- Orientiere dich an Stil und Struktur der bestehenden Seiten (gleiche Überschriften-Hierarchie, gleicher Detailgrad)
- Inhalt auf Deutsch
- Struktur einer typischen Seite:
  ```
  # Seitentitel

  Kurze Einleitung (1-2 Sätze)

  ## Überblick / Zugang

  Wie erreicht man das Feature?

  ## Funktionen

  Detaillierte Beschreibung der Funktionen

  ## Tipps / Hinweise (optional)
  ```

### NAV-Struktur aktualisieren
- Wenn neue Seiten erstellt wurden: Füge sie in die `NAV`-Konstante in `frontend/src/pages/DocsPage.jsx` ein (passende Sektion, korrekter Slug)
- Wenn neue top-level Features dokumentiert wurden: Ergänze die `FEATURES`-Konstante in `DocsPage.jsx`
- Wenn verwaiste Seiten entfernt wurden: Entferne sie aus `NAV` und `FEATURES`

### Verwaiste Seiten behandeln (Status: verwaist)
- Frage den Benutzer, ob verwaiste Seiten gelöscht oder beibehalten werden sollen
- Wenn löschen: Entferne die Datei und den NAV-Eintrag

---

## Schritt 5: Konsistenzprüfung

Führe folgende Prüfungen durch:

1. **ANWENDERDOKU_NAV ↔ Dateien**: Jeder Slug in `ANWENDERDOKU_NAV` hat eine zugehörige `.md`-Datei unter `docs/anwenderdoku/docs/`. Jede `.md`-Datei hat einen NAV-Eintrag.
2. **ENTWICKLER_NAV ↔ Dateien**: Jeder Slug in `ENTWICKLER_NAV` hat eine zugehörige `.md`-Datei unter `docs/entwickler/docs/`. Jede `.md`-Datei hat einen NAV-Eintrag.
3. **FEATURES ↔ NAV**: Jeder Slug in `FEATURES` existiert auch in `ANWENDERDOKU_NAV`
4. **Interne Links**: Prüfe ob Markdown-Dateien auf andere Doku-Seiten verlinken und ob diese Links gültig sind (Ziel-Slugs existieren)
5. **Verzeichnisstruktur**: Keine leeren Verzeichnisse unter `docs/anwenderdoku/docs/` oder `docs/entwickler/docs/`

### Prüfungs-Report

```
Konsistenzprüfung:
- NAV-Einträge: X
- Doku-Dateien: X
- NAV ohne Datei: [liste oder "keine"]
- Datei ohne NAV: [liste oder "keine"]
- FEATURES-Einträge: X
- Ungültige interne Links: [liste oder "keine"]
```

---

## Abschluss-Report

Erstelle eine Zusammenfassung:

```
# Dokumentations-Update Report

**Modus:** [check / full / section:NAME]
**Datum:** [heute]

## Zusammenfassung
- Features im Inventar: X
- Dokumentierte Features: X
- Aktualisierte Seiten: X
- Neue Seiten: X
- Verwaiste Seiten: X

## Änderungen
| Datei | Aktion | Beschreibung |
|-------|--------|-------------|
| docs/.../datei.md | aktualisiert | Neue Felder ergänzt |
| docs/.../neu.md | erstellt | Neue Seite für Feature X |
| DocsPage.jsx | aktualisiert | NAV um X Einträge erweitert |

## Offene Punkte (falls vorhanden)
- [Punkte die manuelle Nacharbeit erfordern]
```
