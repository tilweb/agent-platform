# Extraktions-Projekte auf die Heavy-Pipeline migriert

**Datum**: 2026-06-04
**Status**: Implementiert (main/Scalingo + demo/messe/Railway)
**Plan-Referenz**: `.claude/plans/dapper-wondering-oasis.md`

## Kontext

Das Extraktions-Projekte-Feature (Learning/Few-Shot, `backend/src/extraction/learning/`)
fuhr einen eigenen Extraktionspfad: `extract()` machte einen einzelnen LLM-Call mit
eigenem Prompt-/Schema-Builder — ohne Chunking, ohne echtes Confidence-Scoring, ohne
vision-per-page. Die generische Heavy-Pipeline (`backend/src/services/extraction/`)
kann all das, wurde aber bisher nur vom Vertragsmanagement genutzt.

Ziel: Das Projekte-Feature nutzt jetzt `runPipeline()` als Engine. API, UI und der
Learning-Zyklus (train/guidelines) bleiben erhalten — nur die Engine wurde getauscht.

## Was umgesetzt wurde

### P0 — Migration auf die Pipeline
- **Neuer Adapter** `learning/pipeline-adapter.ts`: `extractionProjectToExtractionSchema()`
  (analog `vertragsmanagement/extraction-adapter.ts`). Wickelt die FLACHEN Projekt-Felder
  in eine synthetische Gruppe (`PROJECT_FIELD_GROUP = 'felder'`), weil
  `ExtractionProfile.fields` gruppiert ist. `extract()` entpackt das `felder.`-Praefix
  nach `runPipeline()` wieder zu flach.
- **Guidelines-Hook**: Das Learning (gelernte Guidelines + Few-Shot) wird in das bereits
  existierende, bis dato ungenutzte `ExtractionProfile.guidelines`-Feld gerendert. Die
  Strategien haengen es via neuem Helfer `strategies/prompt.ts:appendGuidelines()` an
  ihren System-Prompt. Backward-safe: Vertragsmanagement-Profile haben kein `guidelines`.
- **`extract()` umverdrahtet** (`learning/service.ts`): `ingest()` → `PreparedFile[]` →
  `runPipeline()` → entpacken. Fuer Bildquellen bleibt `prepareVision()` erhalten — nur
  zur Erfassung des `document_text` fuer den Learning-Loop (die Extraktion selbst macht
  die Pipeline via vision-per-page/hybrid ueber den `rawBuffer`).

### P1 — Strategie pro Projekt konfigurierbar
- `ExtractionProject.extraction?: ExtractionConfig` (`learning/types.ts`). Default `hybrid`.
- **Scalingo (DB)**: Migration `0020_extraction_project_strategy.sql` (additiv,
  `ADD COLUMN IF NOT EXISTS extraction jsonb`), Schema + Storage-Round-Trip in
  `db/schema/extraction.ts` + `learning/projects.ts`.
- **Railway (YAML)**: kein DB-Change — das Feld wird in `data/extraction-projects/<id>/
  project.yaml` mit-persistiert.
- Routes (`routes/extraction-projects.ts`) akzeptieren `extraction` in POST/PUT.
- Frontend (`ExtractionProjectsPage.jsx`): Strategie-Dropdown in Create-View + Settings-Tab.

### P2 — Retry-mit-Validierungs-Feedback in die Pipeline
- Strategie-agnostischer Repair im Orchestrator (`pipeline.ts`), ausgelagert nach
  `extract-call.ts:repairExtraction()`. Validiert das gemergte Ergebnis; bei Fehlern ein
  gezielter LLM-Call (max. 1). Format-Issues (DE-Zahlen/Daten) korrigiert `validateExtraction`
  bereits in-place — der Call faellt nur bei echten Fehlern an. Ohne Dokumenttext (reine
  Bildquelle) kein Call.
- **Opt-in** via `config.validation_repair` (Default `false`): Vertragsmanagement bleibt
  unveraendert; der Projekt-Adapter setzt es auf `true` (faithful port des alten Retry).

## Wichtige Designentscheidungen

- **Flach ↔ gruppiert**: synthetische Gruppe `felder` + Entpacken — haelt DB-Examples
  (`initial_extraction`/`corrected_extraction` flach) und `train()` kompatibel.
- **`profile.guidelines` wiederverwendet** statt neuem Pipeline-Input — minimaler Eingriff,
  nutzbar fuer alle Konsumenten.
- **Repair opt-in** statt default-on — keine Verhaltens-/Kostenaenderung fuer Vertragsmanagement.

## Tests

- `learning/pipeline-adapter.test.ts` (7): flach→Gruppe→flach Round-trip, Default-Strategie,
  Guidelines-Rendering.
- `services/extraction/extract-call.test.ts` (6): Repair-Logik (valide → kein Call,
  fehlendes Pflichtfeld → 1 Call, kein Text → kein Call, DE-Zahl-Autokorrektur).
- Bestehende `services/extraction/`-Tests (31) unveraendert gruen. Total 43.

## Out-of-Scope / Folge-Schritte

- **Confidence-UI** im Projekte-Feature (gelbe Wellenlinie wie ContractDetail) — `extract()`
  liefert `fieldConfidences` bereits zurueck, das UI nutzt es noch nicht.
- Pro-Chunk-Repair fuer `long-text-chunked` (heute nur Post-Merge-Repair via Orchestrator).
