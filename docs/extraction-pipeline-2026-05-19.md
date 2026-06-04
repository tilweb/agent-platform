# Heavy Extraction Pipeline (Phase D)

**Datum**: 2026-05-19
**Status**: Implementiert (P0–P5 committed in main + demo/messe)
**Plan-Referenz**: `.claude/plans/woolly-popping-pony.md`

## Kontext

Die alte Extraktion-Pipeline (`vertragsmanagement/extraction.ts:extractWithSchema`)
hatte drei harte Caps in `multiFileImporter.ts`: 30k Zeichen kombiniert, 20k für
XLSX, 3k für Vision-Beschreibungen. Bei laengeren Dokumenten wurden Inhalte mit
`[... gekuerzt]` einfach truncated. Das ist mit dem Anspruch „hochwertige
Datenextraktion aus Lieferscheinen, Handschrift und 400-Seiten-Vertraegen"
inkompatibel.

Neue Pipeline:
- Eigenes Service-Modul `backend/src/services/extraction/` mit Strategy-Pattern
- Vier Strategien: `single-pass`, `long-text-chunked`, `vision-per-page`, `hybrid`
- Per-Schema-Konfiguration via `extraction:`-Block im YAML
- **Truncation ist verboten** — `multiFileImporter` bekommt `unbounded: true` von der Pipeline
- Auto-Eskalation `single-pass → long-text-chunked` bei Kontext-Ueberlauf
- Confidence-Scoring per LLM-Self-Reflection + Heuristik
- Provenance pro Feld (Chunk-Indizes oder Page-Numbers)

## Architektur-Layout

```
backend/src/services/extraction/
├── pipeline.ts                 — Orchestrator (waehlt Strategy, eskaliert)
├── types.ts                    — Strategy-Vertrag, Result-Shapes, Error-Klassen
├── defaults.ts                 — applyExtractionDefaults
├── tokenizer.ts                — 3.5-Chars/Token-Heuristik, Budget-Helper
├── chunker.ts                  — Section-aware Markdown-Chunker
├── merger.ts                   — 4 Merge-Strategien (first-non-null /
│                                  majority-vote / priority-by-section / union)
├── confidence.ts               — LLM-Self-Reflection + Heuristik
├── pdf.ts                      — pdftocairo-Wrapper (renderPdfToImages)
├── strategies/
│   ├── index.ts                — Registry
│   ├── single-pass.ts          — ein LLM-Call
│   ├── long-text-chunked.ts    — Tokenize + Chunk + Map-Reduce
│   ├── vision-per-page.ts      — PDF→PNG/Seite → Vision-LLM → Merge
│   └── hybrid.ts               — Text-Pass + selektives Vision-Fallback
└── index.ts                    — Public-API-Re-Exports
```

## Strategien

### `single-pass`

Ein LLM-Call ueber den gesamten kombinierten Markdown-Text. Function-Calling mit
dem aus dem Schema gebauten ExtractionProfile. Bei Kontext-Ueberlauf wirft die
Strategy `ContextOverflowError` → Orchestrator eskaliert auf `long-text-chunked`.

**Wann verwenden**: kurze Dokumente (Default-Strategy fuer Schemas ohne
expliziten `extraction:`-Block).

### `long-text-chunked`

```
combinedText
   │
   ▼  chunkText (section-aware, mit Overlap)
[chunk0, chunk1, ..., chunkN]
   │
   ▼  pLimit(max_concurrent) → llmService.chat pro Chunk
[result0, result1, ..., resultN]
   │
   ▼  mergeChunks (merge_strategy aus Schema)
mergedResult
   │
   ▼  scoreConfidences (Heuristik + LLM-Self-Reflection)
{ extracted, fieldConfidences, provenance, warnings }
```

**Merge-Strategien**:
- `first-non-null` (Default): erster Chunk mit Wert wins
- `majority-vote`: haeufigster Wert (case-insensitive Normalization)
- `priority-by-section`: bevorzugt Chunks deren Heading zum Feld-Gruppen-Namen
  passt (z.B. „Finanzen"-Heading bevorzugt fuer `finanzen.*`-Felder)
- `union`: nur fuer Array-Felder — alle Werte konkatenieren

**Wann verwenden**: lange Dokumente (Vertraege > 20 Seiten, lange XLS). Beispiel
in `data/apps/vertragsmanagement/schemas/mietvertrag.yaml`.

### `vision-per-page`

Fuer gescannte / handschriftliche Dokumente:

```
PDF (rawBuffer)
   │
   ▼  pdftocairo (System-Tool, poppler-utils)
[page1.png, page2.png, ..., pageN.png]
   │
   ▼  pLimit(max_concurrent) → Vision-LLM pro Page (Function-Calling)
[result1, result2, ..., resultN]
   │
   ▼  mergeChunks (oft `union` fuer Tabellen-Zeilen)
mergedResult
```

**System-Requirement**: `pdftocairo` (Teil von poppler-utils) muss im PATH sein.

- macOS: `brew install poppler`
- Ubuntu/Scalingo: `apt-get install poppler-utils`
- Railway/Docker: `RUN apt-get install -y poppler-utils`

Bei fehlendem Binary wirft die Strategy `StrategyExecutionError` mit
Installations-Hinweis.

**Wann verwenden**: Lieferscheine, Akten-Scans, handschriftliche Nachtraege.

### `hybrid`

Kombination aus Text + Vision:

```
Pass 1: long-text-chunked
        ↓
Felder mit confidence < threshold sammeln
        ↓
        ┌─ keine → Text-Result behalten
        │
        └─ vorhanden + vision_fallback + PDF + pdftocairo da:
              ↓
           Pass 2: alle Pages rendern, Vision-LLM pro Page
              ↓
           mergeTextAndVision: Vision-Werte fuer low-confidence-Felder,
                               Text-Werte fuer high-confidence-Felder
              ↓
           Re-Score Confidences
```

**Wann verwenden**: Vertraege mit Mix aus Druck + Stempel/Unterschrift/
handschriftlichen Nachtraegen.

## Schema-Konfiguration

Im YAML-Schema unter `extraction:`-Block:

```yaml
extraction:
  strategy: long-text-chunked        # | single-pass | vision-per-page | hybrid
  chunk_size_tokens: 8000             # nur long-text-chunked
  chunk_overlap_tokens: 500           # nur long-text-chunked
  section_aware: true                 # nur long-text-chunked
  merge_strategy: priority-by-section # | first-non-null | majority-vote | union
  confidence_threshold: 0.7           # Felder darunter → UI markiert
  vision_fallback: false              # nur hybrid: Vision-Pass bei low-conf
  vision_detail: high                 # nur vision-* : 'low' | 'high'
  max_pages: 500                      # Schutz gegen 1000-Seiten-Vertraege
  max_concurrent: 4                   # pLimit pro Job
  model_override:                     # optional eigenes Modell fuer dieses Schema
    provider_id: adacor
    model_id: mistral-3-24b-128k
```

Defaults siehe `services/extraction/defaults.ts`. Schema ohne `extraction:`-Block
→ `single-pass` mit Defaults.

## Backend-Integration

### Vertragsmanagement (`apps/vertragsmanagement/`)

- **import-service.ts**: `importContract` und `reextractContract` rufen
  `runPipeline()` statt der alten `extractWithSchema`-Logik. Truncation ist
  weg — wir reichen `processedFiles[].text` (volle per-File-Markdowns) plus
  optionale `rawBuffer`s in die Pipeline.
- **extraction-adapter.ts**: `contractSchemaToExtractionSchema()` baut ein
  `ExtractionSchema` aus dem User-`ContractSchema` (UI-Felder + mapping).
- **schema-validation.ts**: validiert mapping-Pfade beim Save → User kann
  keine kaputten Schemas in DB schreiben.
- **storage.ts**: `rowToContract` + `saveContract` round-trippen die neuen
  Felder `field_confidences`, `extraction_provenance`, `extraction_strategy`.

### DB-Migrationen

| Migration | Zweck |
|---|---|
| `0015_contract_schema_extraction.sql` | `schemas.extraction` jsonb-Spalte |
| `0016_contract_field_confidences.sql` | `contracts.field_confidences` + `extraction_provenance` + `extraction_strategy` |

Beide idempotent (`ADD COLUMN IF NOT EXISTS`).

### Provider-Profil

`data/config/providers.yaml` enthaelt einen `active.extraction_heavy`-Block als
Default-Empfehlung. Strategien lesen den Override aus dem Schema-Config
(`extraction.model_override`), nicht direkt aus diesem Profil. Wenn ein Schema
keinen Override hat, faellt es auf den `chat`-Provider zurueck.

## Frontend-Integration

### ContractDetail

Im „Extrahierte Daten"-Tab bekommt jedes Feld:
- Tooltip mit Konfidenz-Prozent + Quelle
- Bei `confidence < 0.7`: gelbe Wellenlinie als Underline (`text-decoration:
  underline wavy`)

Quell-Format: `c:N` = Chunk-Index, `c:N+M` = Union ueber mehrere Chunks,
`p:vision` = Vision-Override, `text` = Text-Pass.

### Routes

```
POST /api/extraction/jobs/run-sync           — synchroner Debug-Endpoint
GET  /api/extraction/jobs/strategies          — registrierte Strategien
POST /api/extraction/jobs                     — async-Stub (501)
GET  /api/extraction/jobs/:id                 — async-Stub
GET  /api/extraction/jobs/:id/stream          — async-Stub
POST /api/extraction/jobs/:id/cancel          — async-Stub
GET  /api/extraction/jobs/:id/result          — async-Stub
```

Async-Job-Backend ist bewusst deferred — Vertragsmanagement-Import laeuft
synchron via SSE-Stream mit Heartbeats, das reicht fuer Dokumente bis ca. 60
Seiten. Fuer 400-Seiten-PDFs braucht es bei Bedarf einen separaten Job-Backend
(taskService-Integration).

## Tests

```
backend/src/services/extraction/
├── tokenizer.test.ts     —  9 Tests
├── defaults.test.ts      —  4 Tests
├── chunker.test.ts       —  7 Tests
├── merger.test.ts        —  8 Tests
└── pdf.test.ts           —  3 Tests
backend/src/apps/vertragsmanagement/
└── schema-validation.test.ts —  6 Tests

Total: 37 passed.
```

## Verifikation (Browser)

1. **Kurzes Dokument (1-10 Seiten)**: Vertragsmanagement-Import laeuft via
   `single-pass`. ContractDetail zeigt Felder mit Konfidenz-Tooltip.
2. **Langes Dokument (>10 Seiten)**: Schema mit `extraction.strategy: long-text-
   chunked` (z.B. `mietvertrag`) — Pipeline chunked + merged automatisch.
3. **Gescannter Lieferschein**: Schema mit `strategy: vision-per-page` →
   pdftocairo rendert Pages, Vision-LLM extrahiert pro Seite.
4. **Vertrag mit handschriftlichem Nachtrag**: Schema mit `strategy: hybrid,
   vision_fallback: true` — Text-Pass schafft das meiste, Vision korrigiert
   low-confidence-Felder.
5. **ContractDetail**: Felder mit gelber Wellenlinie + Tooltip „Konfidenz: 45%
   · Quelle: c:2" sind low-confidence; bitte User-Review.

## Adapter-Howto fuer kuenftige Apps

Andere Apps (z.B. eine geplante Lieferschein-App) folgen demselben Pattern:

```typescript
// 1. App-Schema-Typ erweitern um optional extraction-Config
interface LieferscheinSchema {
  id: string;
  fields: { ... };
  extraction?: ExtractionConfig;
}

// 2. Adapter schreiben
function lieferscheinSchemaToExtractionSchema(s: LieferscheinSchema): ExtractionSchema {
  return {
    id: s.id,
    name: s.name,
    profile: buildProfile(s),               // App-spezifisch
    config: applyExtractionDefaults(s.extraction),
  };
}

// 3. Import-Service ruft runPipeline()
const result = await runPipeline({
  files: preparedFiles,
  schema: lieferscheinSchemaToExtractionSchema(schema),
  userId,
});
```

## Out-of-Scope (deferred)

- Async-Job-Backend mit taskService + SSE-Stream pro Job
- Multi-Sample-Voting fuer Confidence
- Live-Streaming einzelner Felder ins UI
- Per-Page-Selective-Vision-Fallback (heute rendert hybrid alle Pages)
- OCR-Pre-Processing (Tesseract) — wir setzen voll auf Vision-LLM
- PDF-Tabellen-Extraktion mit Camelot/Tabula
- Page-Image-Cache in S3 (vision-per-page rendert heute jedes Mal neu)

## Risiken / Bekannte Einschraenkungen

1. **pdftocairo-Abhaengigkeit**: poppler-utils muss installiert sein. Strategie
   vision-per-page wirft sonst klaren Fehler. Auf Mac via brew; Scalingo
   braucht einen aptfile-Eintrag.
2. **LLM-Rate-Limits**: bei 4 parallelen Calls × 50 Chunks = 200 Calls in
   kurzer Zeit. Provider koennte rate-limiten. Heute kein Retry-mit-Backoff.
3. **Token-Approximation**: 3.5-chars/token-Heuristik kann bei dichten Tabellen
   um +/- 20% danebenliegen. Chunk-Sizes mit Sicherheits-Margins ausgelegt.
4. **Vision auf Handschrift**: Mistral 3 ist okay fuer Druckschrift, schwach
   bei kursiver Handschrift. Schema kann via `model_override` einen besseren
   Vision-Provider waehlen, sobald verfuegbar.
5. **Migration ist destruktiv-frei**: 0015 + 0016 fuegen nur Spalten hinzu —
   bestehende Vertraege bleiben unangetastet, Daten haben einfach `null` in
   den neuen Feldern.
