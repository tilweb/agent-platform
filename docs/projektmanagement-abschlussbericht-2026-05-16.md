# Projektmanagement — Abschlussbericht (Phase F)

**Datum**: 2026-05-16
**Status**: committed + gepusht (beide Worktrees)
**Commits**: `e11e75d` main; `d942dc1` demo/messe; plus diverse Folge-Fixes (Risiko-Tabellen, Projektstatus statt Lifecycle)
**Vorlauf**: [Phase A](./projektmanagement-entity-restruktur-2026-05-06.md), [Phase B+C](./projektmanagement-phase-bc-2026-05-15.md), [Phase E](./projektmanagement-lessons-learned-2026-05-16.md)

## Kontext

Der Abschlussbericht ist die formale Schluss-Sicht auf ein Projekt — 1:1 zum Projekt, einmalig erstellt. Drei Quellen werden zusammengeführt:

1. **Letzten Statusbericht** als Vorbefüllung (Ampel, Management-Summary, Goals-/Roadmap-/Risiko-Tracking, EVM-Kosten)
2. **Projektauftrag-Felder** die nicht im SB sind (Scope-Texte, Stakeholder, Organisation, Budget-Detail, Original-Risiken — als Vergleichsbasis)
3. **Abschluss-spezifische Felder** (Key-Findings, Stakeholder-Akzeptanz, Übergabe, Empfehlung, Abnahme)

Plus KI-Entwurf-Funktion analog Lessons-Learned-Suggest.

## Entscheidungen aus dem Plan-Mode

| Frage | Entschieden |
|---|---|
| Stakeholder-Akzeptanz: pro Stakeholder oder Freitext? | **Pro Stakeholder** mit Ampel + Bemerkung (konkreter für PMO-Reviews) |
| Lessons Learned im Bericht: alle oder kuratiert? | **Alle automatisch**, live aus paLessonsLearned geladen (kein Drift) |
| Abnahme-Block: nötig? | **Ja**, mit Name/Datum/Häkchen — kein eIDAS-Verfahren |
| Lifecycle-Hook beim Final-Save: automatisch oder manuell? | **Manueller Modal-Vorschlag**, User confirmed |
| KI-Entwurf: was wird automatisch befüllt? | **Nur** management_summary, key_findings, folgeprojekt_empfehlung. Übergabe und Abnahme bleiben User-Input (Halluzinations-Risiko bei Namen) |

## Datenmodell

### Main (Drizzle/Postgres) — `projektmgmt.abschlussberichte`

```
id            text PRIMARY KEY
pa_id         text NOT NULL UNIQUE FK paProjektauftraege(id) ON DELETE CASCADE
data          jsonb NOT NULL              — alle Inhalts-Felder (analog Statusbericht)
status        text NOT NULL DEFAULT 'draft' — 'draft' | 'final'
finalized_at  timestamptz NULL            — gesetzt beim Übergang draft→final
version       integer NOT NULL DEFAULT 1   — Optimistic-Concurrency
created_by    text
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

`UNIQUE(pa_id)` erzwingt die 1:1-Kardinalität.

Migration: `0012_abschlussbericht.sql`, läuft beim Boot-Hook.

### Demo/messe (YAML)

`data/apps/projektmanagement/projektauftraege/{id}/abschlussbericht.yaml` (Singular).

## Pre-Fill-Logik

`createAbschlussbericht` lädt:
1. Den letzten Statusbericht (bevorzugt `status='final'`, sonst neuester)
2. Den Projektauftrag

Und befüllt 30+ Felder im `data`-jsonb. Wichtig: `risk_tracking` aus dem SB wird **bei jedem Render live nachgeladen** (nicht aus dem Snapshot), damit nachträgliche SB-Änderungen sofort sichtbar sind. Plan-Risiken kommen ebenfalls live aus `projektauftrag.risks`.

Stakeholder-Akzeptanz wird mit einem Eintrag pro Stakeholder vorbereitet (`bewertung: 'gelb'` als „noch zu bewerten"-Default).

## API-Endpoints

```
GET    /projektauftraege/:projektId/abschlussbericht                  → Bericht oder null (Viewer+)
POST   /projektauftraege/:projektId/abschlussbericht                  → Erstanlage mit Pre-Fill (Editor+); 409 wenn schon existiert
PUT    /projektauftraege/:projektId/abschlussbericht                  → Update (Editor+, expectedVersion)
DELETE /projektauftraege/:projektId/abschlussbericht                  → Owner-only
POST   /projektauftraege/:projektId/abschlussbericht/finalize         → status='final' (Editor+)
POST   /projektauftraege/:projektId/abschlussbericht/reopen           → Owner-only, zurück auf 'draft'
POST   /projektauftraege/:projektId/abschlussbericht/suggest          → KI-Entwurf (Editor+) — withLlmTimeout 30s
GET    /projektauftraege/:projektId/abschlussbericht/export/:format   → PDF/DOCX/XLSX
```

## Frontend

- **`AbschlussberichtView.jsx`** (~1250 Zeilen): Single-Form (kein Blade — 1:1) mit Akkordeon-Sektionen
  - **Empty-State**: prominenter „Erstellen"-Button
  - **Header-Bar**: Status-Badge, Save, „Als Final markieren", Wiedereröffnen (Owner, nur final), „KI-Entwurf", Export
  - **Soll/Ist-Dashboard** als oberste Sektion: computed-Karten für Termin-Abweichung, Budget-Abweichung %, Ziel-Erfüllung, Risiko-Bilanz, Stakeholder-Zufriedenheit
  - **Akkordeon-Sektionen**: Basis, Key Findings, Ziele, Scope (aus Auftrag), Roadmap, Kosten (EVM), Risiken (Plan vs Ist), Stakeholder-Akzeptanz, Übergabe, Folgeprojekt-Empfehlung, Abnahme, Lessons Learned (live)

- **Lifecycle-Modal beim „Als Final markieren"**: zeigt eine Selectbox mit `project_status`-Optionen (Initiierung/Planung/…/Gestoppt). User wählt selbst, ob „Abschluss" oder „Gestoppt" passt; Callback schreibt via `updateProjektauftrag` (mit `expectedVersion`).

- **Übersicht-Tab**: Abschluss-Karte aktualisiert — zeigt Status („Entwurf"/„Final"/„nicht angelegt") + finalized_at + „Zum Bericht"-/„Bericht anlegen"-Link.

## Status-Modell

- **draft**: bearbeitbar, alle Editor+ können speichern
- **final**: read-only; `finalized_at` gesetzt. Nur Owner kann reopen → zurück zu draft.
- Übergang draft→final öffnet ein Modal mit Selectbox für `project_status`; Bestätigen schreibt den Wert in `auftrag.project_status`.

## Export

`mapAbschlussberichtToDocument()` erzeugt einen `DocumentData`-Output mit:
1. Berichts-Informationen
2. Soll/Ist-Dashboard
3. Management Summary
4. Key Findings
5. Ziele + Tracking
6. Scope
7. Roadmap (Soll vs Ist)
8. Kosten (EVM)
9. Risiken (Plan vs Ist) — Werte aus App-Config aufgelöst
10. Stakeholder-Akzeptanz
11. Übergabe
12. Folgeprojekt-Empfehlung
13. Lessons Learned (gruppiert nach SWOT)
14. Abnahme

Wird gerendert als PDF/DOCX/XLSX via gemeinsamem Generator.

## Folge-Fixes seit dem Initial-Commit

In den Tagen danach wurden mehrere Bugs aus User-Tests gefixt (Commits `99e748a`, `1abf77a`, `c43a043`, `7bf6e1b`, `2cc98c5`):

- Risiko-Tabellen zeigten Rohwerte (`technisch`, `medium`) statt Labels aus App-Config → behoben mit `configLabel`-Helper + Risk-Type-Mapping
- Risk-Plan-Tabelle zeigte `r.type` (Risikotyp), Risk-Tracking-Tabelle zeigte `r.type` (Art = Bedrohung/Chance) — gleicher Header „Typ" für unterschiedliche Semantik → vereinheitlicht auf **Art** (Bedrohung/Chance)
- `risk_tracking` wurde aus dem Snapshot gerendert → User-SB-Änderungen waren unsichtbar → jetzt live aus letztem SB (auch im Export)
- LLM-Prompts enthielten selbst ASCII-Umlaute (`Saetze`, `fuer`) → LLM ahmte das nach → echte Umlaute in den Prompts + explizite System-Anweisung
- Projektstatus statt Lifecycle in der UI: Phase-A-`lifecycle` wurde aus dem UI verbannt zugunsten von `auftrag.project_status` (manuell pflegbar, ein einheitliches Status-Konzept)
- Input/Textarea-Hintergrund war `theme.colors.background` (gleicher Grauton wie Layout) → auf `theme.colors.surface` umgestellt

## Out-of-Scope (für jetzt)

- **Refresh-Button** „Felder aus aktuellem SB neu laden" — bewusst nicht; Snapshot-Charakter (außer `risk_tracking` wird live geladen)
- **Digitale Signatur** — `abnahme_signiert` ist nur boolean, kein eIDAS
- **Mehrere Versionen** des Berichts — 1:1, nur Optimistic-Counter
- **Cross-Project-Auswertung** der Abschlussberichte — eigener PMO-Bedarf, später

## Verifikation

```sh
# main: Migration 0012 läuft beim nächsten Boot
curl /api/apps/projektmanagement/projektauftraege/<id>/abschlussbericht
# → 200 { abschlussbericht: null }

curl -X POST /api/apps/projektmanagement/projektauftraege/<id>/abschlussbericht
# → 201 mit Pre-Fill (management_summary aus SB, in_scope aus Auftrag, …)

curl -X POST /api/apps/projektmanagement/projektauftraege/<id>/abschlussbericht/finalize
# → 200 mit status='final', finalized_at gesetzt

curl /api/apps/projektmanagement/projektauftraege/<id>/abschlussbericht/export/pdf -o out.pdf
```

| Frontend-Test | Erwartet |
|---|---|
| Projekt mit ≥1 SB → Abschluss-Tab → „Erstellen" | Bericht entsteht mit Pre-Fill |
| Bericht editieren → „Als Final markieren" | Modal mit Projektstatus-Selectbox |
| Final-Bericht | Felder read-only; Wiedereröffnen-Button nur für Owner |
| LL anlegen, dann Abschluss öffnen | LL-Sektion zeigt die LL live |
| Export PDF/DOCX/XLSX | Datei enthält Dashboard + alle Sektionen + LL-Tabelle |
