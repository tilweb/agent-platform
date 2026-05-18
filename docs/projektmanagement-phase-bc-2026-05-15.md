# Projektmanagement Phasen B + C — UI-Restruktur

**Datum**: 2026-05-15
**Status**: committed + gepusht (beide Worktrees)
**Commits**: `ccf9f12` / `8475c1e` (Phase B), `7060f46` / `3ab44f8` (Phase C)
**Vorlauf**: [Phase A](./projektmanagement-entity-restruktur-2026-05-06.md)

## Kontext

Phase A brachte die `Projekt`-Entity ins Backend, aber die UI blieb noch auf das alte „Projektauftrag"-Modell ausgelegt. Konkrete Schmerzpunkte:

- **`WizardPage.jsx`** (44 KB) trug einen Header-Toggle „Projektauftrag / Statusbericht" — ein Symptom dafür, dass zwei Entities in einer Komponente vermischt waren.
- **`ProjektePage.jsx`** zeigte Tabs auf der Listen-Page, von denen vier eigentlich Sub-Views eines Projekts sein sollten (`Ideen | Aufträge | Statusberichte | Abschluss (Soon) | Portfolio (Soon)`).
- Beim Öffnen eines Projekts landete der User immer im Wizard, nicht in einer Projekt-Übersicht.

## Phase B — Tab-Container im Projekt-Detail

### Änderungen

- **WizardPage.jsx** in-place refaktoriert (nicht aufgespalten — siehe Trade-off unten):
  - Mode-Toggle aus dem Header entfernt
  - Top-Level-Tab-Bar **`Übersicht | Projektauftrag | Statusberichte`** unter dem Header
  - URL-Sync: `?tab=uebersicht|auftrag|statusberichte`
  - Default beim Öffnen eines existierenden Projekts: `uebersicht` (Browser-Back/Bookmarks funktionieren)
  - Bei `/apps/projektmanagement/neu` bleibt die Tab-Bar ausgeblendet (Wizard ist allein zuständig für die Erstanlage)

- **`ProjektUebersichtPanel.jsx`** (neu, ~250 Zeilen): vier Karten
  1. Projektstatus (aus `auftrag.project_status`)
  2. Schlüsseldaten (Projektleitung, Auftraggeber, Zeitraum)
  3. Letzter Statusbericht (Nummer, Datum, Ampel, Status)
  4. Abschluss (Platzhalter mit Phase-E-Badge)

- **Hook-Erweiterung** `useProjektmanagement.js`:
  - `getProjekt(id)` neu (best-effort, returnt `null` wenn nicht migriert)

### Trade-off: in-place statt File-Split

Der ursprüngliche Plan sah eine Aufspaltung in `ProjectDetailPage.jsx` + `AuftragTab.jsx` + `StatusberichteTab.jsx` vor. Stattdessen wurde `WizardPage.jsx` in-place refaktoriert, weil:

- 1349 Zeilen mit eng verwobenem State (Auftrag/SB/KI-Analysen/Dirty-Tracking)
- Risiko einer Aufspaltung höher als der unmittelbare Nutzen
- Der UX-Schmerz (Mode-Toggle weg, Übersicht als Default) ist auch in-place fixbar
- File-Split kann später nachgeholt werden, wenn LL/Abschluss-Tabs in Phase E/F ohnehin neue Komponenten brauchen

Diese Entscheidung wurde später durch Phase E + F bestätigt — beide brachten ihre eigenen Komponenten (`LessonsLearnedView`, `AbschlussberichtView`) ohne dass `WizardPage` aufgespalten werden musste.

## Phase C — Listen-Page-Restruktur

### Änderungen

- **`ProjektePage.jsx`** Tabs umgestellt:
  - Vorher: `Ideen | Aufträge | Statusberichte | Abschluss (Soon) | Portfolio (Soon) | Einstellungen`
  - Nachher: `Projekte | Projektideen | Portfolios | Einstellungen`
- **„Statusberichte"** als Top-Level-Tab entfernt (Cross-Project-Dashboard war konzeptionell eine Sub-Resource)
- **„Projektabschluss"** als Top-Level-Tab entfernt (gehört in die Projekt-Detail-Ansicht)
- **„Coming Soon"-Badges** entfernt; `Portfolios`-Tab zeigt einen ordentlichen Empty-State mit Phase-D-Hinweis
- **URL-Aliase** für alte Bookmarks: `?tab=auftraege`/`statusberichte`/`abschluss`/`portfolio` mappen automatisch auf die neuen Tab-IDs
- **Action-Buttons**: „Neuer Projektauftrag" → „Neues Projekt"
- **Subtitle**: „Projektaufträge erstellen, analysieren und verwalten" → „Projekte, Ideen und Portfolios verwalten"

### Bewusst nicht gemacht

- **Liste-Datenquelle**: bleibt `paProjektauftraege` (mit Status-Badge, Vollständigkeits-Bar). Migration auf `paProjekte` (mit Lifecycle-Badge) kommt erst, wenn Felder vom Auftrag aufs Projekt umziehen — out-of-scope für Phase C.

## Wirkung

Der User landet nach den beiden Phasen in einer konsequenten Hierarchie:

```
/apps/projektmanagement          Liste mit Top-Level-Entities
  └─ /apps/projektmanagement/:id Projekt-Detail mit Sub-Tabs
       ├─ Übersicht (Default)
       ├─ Projektauftrag
       └─ Statusberichte
```

Sub-Resources (LL, Abschluss) wurden in Phase E + F als weitere Tabs angedockt.

## Verifikation

| Test | Erwartet |
|---|---|
| `/apps/projektmanagement/<id>` (Bookmark) | Lädt Übersicht-Tab; alter Bookmark funktioniert |
| Tab-Wechsel + Browser-Back | URL-Sync funktioniert, Browser-Back springt richtig |
| `/apps/projektmanagement?tab=auftraege` | Mappt auf `projekte`, Tab aktiv |
| `/apps/projektmanagement/neu` | Wizard standalone, keine Tab-Bar |
| `Coming Soon`-Badges sichtbar? | Nein — Portfolios hat Empty-State |
