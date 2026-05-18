# Projektmanagement — Lessons Learned (Phase E)

**Datum**: 2026-05-16
**Status**: committed + gepusht (beide Worktrees)
**Commits**: `11cf8e1` main; `65bcbab` demo/messe
**Vorlauf**: [Phase A](./projektmanagement-entity-restruktur-2026-05-06.md), [Phase B+C](./projektmanagement-phase-bc-2026-05-15.md)

## Kontext

Nach Phase A–C war die Hierarchie sauber, aber die Sub-Resource „Lessons Learned" fehlte noch. Die soll Erkenntnisse aus dem Projekt strukturiert erfassen — SWOT-orientiert (Strength/Weakness/Opportunity/Threat) pro Themengebiet (Basis, Stakeholder, Ziele, …, Projektabschluss).

Besonderheit: der User wollte einen **KI-Vorschlags-Button**, der auf Basis der letzten Statusberichte konkrete Lessons-Learned-Entwürfe vorschlägt — damit der User nicht aus dem Nichts schreiben muss.

## Datenmodell

### Main (Drizzle/Postgres) — `projektmgmt.lessons_learned`

```
id            text PRIMARY KEY
pa_id         text NOT NULL REFERENCES paProjektauftraege(id) ON DELETE CASCADE
title         text NOT NULL
themengebiet  text NOT NULL                 — Default-Liste aus App-Config
kategorie     text NOT NULL                 — SWOT-Wert (strength/weakness/opportunity/threat)
beschreibung  text NOT NULL DEFAULT ''      — "Worum geht es?"
auswirkung    text NOT NULL DEFAULT ''      — "Was ist die Folge?"
empfehlung    text NOT NULL DEFAULT ''      — "Was geben wir an andere weiter?"
version       integer NOT NULL DEFAULT 1    — Optimistic-Concurrency
created_by    text
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

Plus 3 Indexes: `pa_id`, `themengebiet`, `kategorie`.

Migration: `0011_lessons_learned.sql`, läuft beim Boot-Hook automatisch.

### Demo/messe (YAML)

`data/apps/projektmanagement/projektauftraege/{id}/lessons-learned/{ll-id}.yaml`

## API-Endpoints

Alle unter `/api/apps/projektmanagement/projektauftraege/:projektId/lessons-learned`:

```
GET    /                   → Liste aller LL (Viewer+)
GET    /:llId              → Einzelner LL (Viewer+)
POST   /                   → Neu anlegen (Editor+)
PUT    /:llId              → Update (Editor+, expectedVersion)
DELETE /:llId              → Löschen (Editor+)
POST   /suggest            → KI-Vorschläge (Editor+) — LLM analysiert letzte 5 SBs
```

Permissions erben vom Auftrag (analog Statusberichte): Viewer liest, Editor+ schreibt/löscht.

## Konfigurierbare Werte (App-Config)

Zwei neue Keys in `DEFAULT_CONFIG` (`storage.ts`), pflegbar im Einstellungen-Tab:

- **`lesson_themengebiet`** (13 Default-Werte): Basis, Stakeholder, Organisation, Ziele, Inhalt, Roadmap, Kosten, Risiko, Lessons Learned, Projektidee, Auftragsklärung, Umsetzung, Projektabschluss.
- **`lesson_kategorie`** (4 SWOT-Werte): Strength, Weakness, Opportunity, Threat.

Admin kann beides ändern; UI nutzt die App-Config zur Label-Auflösung.

## KI-Suggest

`POST /lessons-learned/suggest` lädt die letzten 5 Statusberichte des Projekts, aggregiert Highlights (Management-Summary, Goals-/Roadmap-/Risiko-Bemerkungen, Risiko-Tracking-Einträge), und schickt sie an das LLM (Adacor AI Qwen3-30B). Der Prompt verlangt 3–7 SWOT-orientierte Lessons-Learned-Vorschläge im JSON-Format.

Wichtig: Vorschläge werden **nicht persistiert** — der User entscheidet pro Vorschlag, ob er ihn als echte LL übernimmt (dann landet er im Edit-Form mit vorbefüllten Feldern).

Seit dem P2-Block ist der LLM-Call mit `withLlmTimeout` (30s) abgesichert — bei Timeout antwortet das Endpoint mit 504.

## Frontend

- **`LessonsLearnedView.jsx`** (neu, ~700 Zeilen): Blade-Layout
  - Links: Liste vorhandener LL + „+ Neu"-Button (Editor+)
  - Rechts: Default-Ansicht zeigt den prominenten **„KI-Vorschläge aus Statusberichten"**-Button. Nach Klick werden Vorschläge als Karten gerendert; pro Karte „Übernehmen" oder „Verwerfen".
  - Bei LL ausgewählt/neu: Edit-Form mit Titel, Themengebiet-Select, SWOT-Kategorie-Select, drei Textareas.

- **Hook**: `useProjektmanagement.js` exportiert jetzt `getLessonsLearned`, `getLessonLearned`, `createLessonLearned`, `updateLessonLearned`, `deleteLessonLearned`, `suggestLessonsLearned`.

- **WizardPage**: 4. Tab `Lessons Learned` mit URL-Sync `?tab=lessons`.

- **SWOT-Farb-Mapping**: Strength=success, Weakness=warning, Opportunity=primary, Threat=error.

- **Einstellungen-Tab**: die zwei neuen Config-Keys (`lesson_themengebiet`, `lesson_kategorie`) sind in `FIELD_LABELS`/`FIELD_ORDER` aufgeführt und nutzen die generische Auswahl-Pflege-UI.

## Verifikation

```sh
# main: Migration läuft beim nächsten Boot
curl /api/apps/projektmanagement/projektauftraege/<id>/lessons-learned
# → 200 { lessons: [] }

curl -X POST /api/apps/projektmanagement/projektauftraege/<id>/lessons-learned \
  -d '{"title":"Test","themengebiet":"risiko","kategorie":"weakness"}'
# → 201 mit lesson-Objekt

curl -X POST /api/apps/projektmanagement/projektauftraege/<id>/lessons-learned/suggest
# → 200 { suggestions: [...] } nach 2–10s
# → 504 wenn LLM > 30s braucht
```

| Frontend-Test | Erwartet |
|---|---|
| Projekt → Lessons-Learned-Tab, keine LL vorhanden | Default-Pane mit großem KI-Suggest-Button |
| KI-Suggest klicken | 2–10s Warten, dann Vorschlags-Karten erscheinen |
| Vorschlag „Übernehmen" | Edit-Form öffnet sich mit vorbefüllten Feldern |
| Speichern | LL landet in der linken Liste |

## Bekannte Verbesserungspotenziale

- KI-Vorschläge nicht persistiert: bei Reload sind sie weg. Akzeptabler Trade-off, weil der User sie sowieso einzeln annehmen oder verwerfen soll.
- Themengebiete sind ein freier String mit Default-Liste; Admin kann die Liste in den Einstellungen erweitern. Ältere LL mit obsoleten Themengebieten bleiben aber bestehen (rückwärtskompatibel).
