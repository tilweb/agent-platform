# Fachkonzept: Dokumenten-Extraktion (Feature + Pipeline)

**Datum:** 2026-07-27
**Autor:** Andreas Bachmann
**Adressat:** Produkt-/Dev-Team, Fachanwender
**Status:** Fachkonzept / technische Referenz zum bestehenden Feature

---

## 1. Kontext & Zweck dieses Dokuments

Der Workplace kann aus unstrukturierten Dokumenten (PDFs, Scans, Bilder, Office-Dateien)
**strukturierte Felder** herausziehen — z. B. aus einem Sanitätshaus-Rezept die Positionen,
aus einem Lieferschein die Artikel oder aus einem Vertrag Laufzeit und Vertragspartner.
Das Feature besteht aus zwei Bausteinen:

1. **Extraktions-Projekte** (der „Anlern-" und Bedien-Layer): Ein Fachanwender definiert ein
   Feld-Schema, lernt das Projekt anhand von Beispieldokumenten an und nutzt es dann produktiv.
2. **Heavy-Extraction-Pipeline** (die Engine): Ein strategiebasierter Motor, der ein Dokument
   je nach Beschaffenheit unterschiedlich verarbeitet (reiner Text, langes Dokument mit Chunking,
   gescanntes PDF mit Vision, oder eine Kombination) und dabei zusätzlich **Konfidenzwerte** und
   **Fundstellen (Bounding-Boxes)** liefert.

Dieses Dokument beschreibt **wie beide Bausteine funktionieren und ineinandergreifen** — als
fachliche Referenz und als Einstieg für Entwickler. Es enthält Ablauf-Schaubilder und verweist
auf die relevanten Code-Stellen (Abschnitt 13).

**Einordnung:** Das Feature existiert produktiv in beiden Worktrees (main/Scalingo mit Postgres,
demo/messe/Railway mit YAML-Dateien). Nur die **Persistenzschicht** unterscheidet sich; Engine,
Logik und UI sind identisch (s. Abschnitt 9).

---

## 2. Überblick — was das Feature fachlich leistet

| Fähigkeit | Beschreibung |
|-----------|--------------|
| **Schema definieren** | Freie Feldliste (Name, Typ, Pflicht, Beschreibung/Hinweis für die KI) — ohne Programmierung. |
| **Positionsdaten (Line-Items)** | Feldtyp „Liste / Positionen" mit frei definierbaren Spalten — Rechnungs-/Lieferschein-/Rezeptpositionen als wiederholende Zeilen (seit Ausbau-Welle 1). |
| **Anlernen (Lern-Loop)** | Beispieldokument hochladen, KI-Vorschlag korrigieren; das Projekt leitet daraus **Regeln (Guidelines)** ab und wird mit jedem Beispiel besser. |
| **Extrahieren** | Ein Dokument durch das angelernte Projekt schicken → strukturierte Felder + Konfidenz je Feld. |
| **Fundstellen anzeigen** | Bei visueller Verarbeitung wird jeder Wert im Dokument-Bild **markiert** (Bounding-Box, per OCR verortet) — nachvollziehbar und korrigierbar. |
| **Massenverarbeitung** | Multi-Upload vieler Dokumente durch ein Projekt („Verarbeiten"-Tab), serverseitig, mit Status und Export. |
| **Export/Import** | Ein gut angelerntes Projekt als portables `.json`-Paket weitergeben (Vorlage für andere Instanzen). |
| **Modellwahl** | Pro Projekt ein KI-Modell wählbar (analog zu Agenten); sonst System-Standard. |

**Drei Nutzungsdimensionen** derselben Pipeline (Abschnitt 8):
**(a)** via API · **(b)** eingebettet in Apps/Agenten/Skills · **(c)** manuell über die UI.

---

## 3. Zwei-Schichten-Architektur

Der Kern-Gedanke: Der **Projekt-Layer** kennt die fachlichen Felder und den Lern-Loop, weiß aber
nichts über Chunking, Vision oder OCR. Er baut aus dem Projekt ein generisches **Schema** und
ruft die **Engine** auf. Die Engine kennt keine „Projekte", nur Schemata und Dateien.

```
┌───────────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (ExtractionProjectsPage.jsx)                                     │
│  Schema-Editor · Training-Tab (Boxes) · "Verarbeiten"-Tab · Export/Import   │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │  REST  (routes/extraction-projects.ts)
                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  PROJEKT- / LEARNING-LAYER   backend/src/extraction/learning/               │
│                                                                             │
│   projects.ts   examples.ts   guideline-generator.ts   transfer.ts          │
│   batch-runs.ts   batch-service.ts        service.ts  ←  extract()          │
│                                                                             │
│   • kennt Felder, Guidelines, Trainingsbeispiele, Lern-Metadaten            │
│   • baut Schema + Few-Shot + Guidelines  (pipeline-adapter.ts)              │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │  runPipeline(files, schema, userId)
                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  HEAVY-EXTRACTION-PIPELINE (Engine)   backend/src/services/extraction/       │
│                                                                             │
│   pipeline.ts (Orchestrator)                                                │
│     └─ Strategien:  single-pass · long-text-chunked · vision-per-page ·     │
│                     hybrid                                                   │
│     └─ Bausteine:  chunker · tokenizer · merger · confidence · pdf · ocr ·  │
│                    extract-call (LLM + Repair)                              │
│                                                                             │
│   • kennt nur Schema + Dateien, keine "Projekte"                            │
│   • liefert: data · fieldConfidences · boxes · pageImages · strategyUsed    │
└───────────────────────────────┬───────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
   LLM (Chat/Vision)        poppler (pdftocairo)      tesseract (OCR)
   Adacor AI / Override     PDF → PNG-Seiten          Wort-Boxen für Fundstellen
   + Markitdown (Text)
```

Der Projekt-Layer wird auch vom **Vertragsmanagement** genutzt (andere Profile, dieselbe Engine);
das Extraktions-Projekte-Feature ist die generische, anlernbare Variante.

---

## 4. Datenmodell: das Extraktionsprojekt

Ein Projekt ist eine **flache** Feldliste plus Lern-Zustand
(`extraction/learning/types.ts`):

```
ExtractionProject
├─ id            kebab-case, z. B. "sanitaetshaus-rezepte"
├─ name          Anzeigename
├─ fields        { fieldId → { type, required, label, description? } }   ← FLACH
├─ instructions  hand-gepflegte Domänen-Anweisungen (vom Lern-Loop UNBERÜHRT)
├─ guidelines    automatisch gelernte Regeln (aus Korrekturen abgeleitet)
├─ learning      { total_examples, accuracy_estimate, guideline_version }
└─ extraction?   ExtractionConfig  (Strategie + Parameter + model_override)
```

**Feldtypen:** `text` · `number` · `date` · `boolean` · `list` (`extraction/learning/types.ts`).
Jedes Feld hat ein `label` (für Mensch + KI) und optional eine `description` als Hinweis an die KI.
Ein `list`-Feld trägt zusätzlich `item_fields` (skalare Spalten, eine Ebene tief) und wird vom
Adapter als eigene Array-Gruppe an die Engine gegeben; nach dem Union-Merge entfernt der
Learning-Layer exakte Duplikate (`list-utils.ts`). Details: `docs/extraktion-line-items-2026-07-27.md`.

**Wichtige Trennung:**
- `instructions` = **stabile** Anweisungen, die der Anwender selbst pflegt (z. B. „Datumsangaben
  immer als Rezeptdatum, nicht Druckdatum interpretieren").
- `guidelines` = **gelernte** Regeln, die der Lern-Loop aus Korrekturen selbst schreibt und
  versioniert. Beide fließen zusammen in den KI-Prompt (Abschnitt 6.2 / 7).

**ExtractionConfig** (Auszug, `services/extraction/types.ts`) steuert die Engine pro Projekt:

| Parameter | Default | Wirkung |
|-----------|---------|---------|
| `strategy` | `hybrid` (Projekte) | Verarbeitungsstrategie (Abschnitt 6.2). |
| `chunk_size_tokens` / `chunk_overlap_tokens` | 8000 / 500 | Chunk-Größe bei langen Texten. |
| `merge_strategy` | `first-non-null` | Zusammenführung mehrerer Chunk-/Seiten-Ergebnisse. |
| `confidence_threshold` | 0.6 | Ab wann ein Feld als „unsicher" gilt (Hybrid-Fallback). |
| `vision_fallback` | (Projekte: an) | Bei unsicheren Feldern zusätzlich Vision-Pass. |
| `max_pages` | 500 | Schutzgrenze bei PDF-Rendering. |
| `max_concurrent` | 4 | Parallele Chunks/Seiten. |
| `validation_repair` | Projekte: an | Optionaler Korrektur-Pass nach Validierung. |
| `model_override` | `null` | Projekt-eigenes KI-Modell statt System-Standard. |

---

## 5. Ende-zu-Ende: Ablauf einer Extraktion

Einstiegspunkt `extract(projectId, source, userId?)`
(`extraction/learning/service.ts`). Rückgabe:
`{ success, data, document_text, fieldConfidences, boxes, pageImages, strategyUsed, error }`.

```
 extract(projectId, source, userId)
        │
        ▼
 (1) Projekt laden ────────────────────── getProject()  [DB oder YAML]
        │
        ▼
 (2) INGESTION  ── ingest(source) ─────────────────────────────────────────────┐
        │   • Text   → Markitdown-API (PDF/DOCX/XLSX → Markdown)                 │
        │   • reines Bild → Vision-LLM beschreibt Text (nur für document_text)   │
        │   • rawBuffer (PDF/Bild-Bytes) bleibt erhalten für Vision-Strategien   │
        │                                                                        │
        ▼                                                                        │
 (3) PreparedFile bauen  { filename, text, mimeType, rawBuffer? }  ←────────────┘
        │
        ▼
 (4) FEW-SHOT wählen ── selectFewShotExamples()  (max 5, Korrekturen zuerst, ~4000 Tok)
        │
        ▼
 (5) SCHEMA adaptieren ── extractionProjectToExtractionSchema()
        │   • flache Felder → synthetische Gruppe "felder"
        │   • instructions + guidelines + Few-Shot  →  profile.guidelines
        │   • Strategie aus project.extraction (Default hybrid)
        │
        ▼
 (6) runPipeline(files, schema, userId) ──────────────►  HEAVY-PIPELINE (Abschnitt 6)
        │                                                 wählt Strategie, extrahiert,
        │                                                 merged, scored, ggf. Repair
        ▼
 (7) Ergebnis entpacken ("felder."-Präfix → flach)
        │
        ▼
 Rückgabe: data · document_text · fieldConfidences · boxes · pageImages · strategyUsed
```

Der Schritt **(5)** ist die Brücke: Der Projekt-Layer verpackt seinen flachen Feldsatz in ein
gruppiertes Engine-Schema (die Engine erwartet Gruppen) und packt allen Lern-Kontext in das
`guidelines`-Feld, das die Strategien an ihren System-Prompt hängen.

---

## 6. Die Heavy-Pipeline im Detail

### 6.1 Dokument → Text / Bild (Ingestion)

| Quelle | Weg | Zweck |
|--------|-----|-------|
| PDF, DOCX, XLSX … | **Markitdown-API** (`api.adacor.ai/v1/documentMarkdown`, Bearer `ADACOR_AI_API_KEY`, Timeout 15 s) | Markdown-Text für Text-Strategien. |
| reines Bild | **Vision-LLM** (Mistral 3 24B o. Override) beschreibt den sichtbaren Text | `document_text` für den Lern-Loop. |
| PDF (Vision) | **pdftocairo** (poppler) rendert Seiten zu PNG @ 200 DPI | Bild-Input für Vision-Strategien. |
| PNG-Seiten | **tesseract** OCR (deu+eng) | Wort-Boxen für Bounding-Boxes. |

Die Roh-Bytes (`rawBuffer`) bleiben durchgehend erhalten, damit Vision-Strategien direkt auf dem
Original arbeiten — unabhängig davon, was Markitdown als Text geliefert hat.

### 6.2 Die vier Strategien

Die Strategie wird aus `schema.config.strategy` gewählt (`pipeline.ts`). Läuft `single-pass` in
einen `ContextOverflowError` (Dokument > Modellkontext), **eskaliert** der Orchestrator einmalig zu
`long-text-chunked`. Die anderen drei Strategien sind terminal (kein Auto-Fallback; Fehler
propagiert bzw. Hybrid fängt fehlendes poppler selbst ab).

| Strategie | Wann | Kern |
|-----------|------|------|
| **single-pass** | kurze Dokumente | Ein LLM-Call (Function-Calling) über den ganzen Text. Konfidenz trivial (1.0 gesetzt / 0.0 leer). |
| **long-text-chunked** | lange Texte | Section-aware Chunking (~8000 Tok, 500 Overlap, an Markdown-Überschriften), 1 Call je Chunk (parallel, `max_concurrent`), dann Merge + Konfidenz-Scoring. |
| **vision-per-page** | Scans / handschriftlich | PDF → PNG-Seiten, **1 Vision-Call je Seite** als **Freitext-JSON** (kein Function-Calling — Vision-Modelle hängen bei erzwungenem FC auf Bildern), 45 s Timeout + 1 Retry, Merge (`union` für Listen), OCR-Boxen, pageImages. |
| **hybrid** *(Default für Projekte)* | gemischt | Zuerst `long-text-chunked` (Text). Für Felder unter `confidence_threshold` zusätzlich ein Vision-Pass; beim Merge **gewinnt Vision nur für die unsicheren Felder** (Konfidenz 0.85), sichere Textwerte bleiben. |

**Schaubild Strategie-Dispatch:**

```
                     runPipeline(files, schema)
                              │
                schema.config.strategy?
        ┌───────────────┬────────────────┬────────────────┐
        ▼               ▼                ▼                ▼
   single-pass   long-text-chunked  vision-per-page     hybrid
        │               │                │                │
   1 LLM-Call      chunk → N Calls   PDF→PNG,          Text-Pass
   (Function-      (parallel) →      1 Vision-Call/    (chunked)
    Calling)       merge → score      Seite (JSON) →      │
        │               │            merge → OCR-Boxen  low-conf-Felder?
   ContextOverflow?     │                │             ┌────┴─────┐
        │ ja            │                │            nein       ja
        └──► eskaliert  │                │             │          │
             zu chunked │                │        Text-Result   Vision-Pass
        │               │                │                       auf Seiten →
        └───────────────┴────────────────┴───────────────────────┘
                              │            mergeTextAndVision
                              ▼            (Vision gewinnt nur
                  optional: Validation-Repair    unsichere Felder)
                  (falls validation_repair &&
                   Strategie ≠ vision-per-page; max. 1 Pass)
                              │
                              ▼
        { extracted, fieldConfidences, provenance, boxes?, pageImages?,
          warnings, llmCalls, strategyUsed, strategyOriginal? }
```

### 6.3 Merge & Konfidenz

**Merge** (`merger.ts`) führt Ergebnisse aus mehreren Chunks/Seiten je Feld zusammen:
`first-non-null` (Default), `majority-vote`, `priority-by-section` (Chunk, dessen Überschrift zum
Feld passt) oder `union` (Listen zusammenführen). Zu jedem Feld wird die **Herkunft** (Provenance,
z. B. `c:0+1` bzw. seitenbezogen `p:datei.pdf:3`) protokolliert.

**Konfidenz** (`confidence.ts`) je Feld auf Skala 0..1:
- **Heuristik:** 1.0 wenn ≥2 Chunks denselben Wert liefern · 0.7 wenn genau ein Chunk · niedriger
  bei Konflikten · 0.0 wenn leer.
- **LLM-Selbstbewertung** (optional, pro Feld*gruppe*): Das Modell bewertet den finalen Wert gegen
  alle Chunk-Kandidaten; Fallback auf die Heuristik, wenn der Call scheitert.

### 6.4 Fundstellen / Bounding-Boxes (OCR)

Nur bei Vision-Verarbeitung (`vision-per-page`, `hybrid`). Nach der Extraktion läuft **tesseract**
über jede gerenderte Seite und liefert Wort-Boxen (TSV, nur Wörter mit `conf > 30`). `locateValue()`
sucht jeden extrahierten Wert per Token-Matching (normalisiert; Datums-Varianten berücksichtigt) und
gibt eine **auf 0..1 normalisierte** Box `{ page, x, y, w, h }` zurück (auflösungsunabhängig fürs
Frontend). Fehlt tesseract, läuft die Extraktion normal weiter — nur ohne Boxen.

Das Frontend nutzt diese Boxen im Training-Tab für die **bidirektionale Klick-Navigation**
(Markierung ↔ Eingabefeld).

### 6.5 Validierung & Repair-Pass

`validateExtraction()` (`extraction/validator.ts`) prüft Pflichtfelder/Typen und korrigiert Formate
**in-place**: deutsche Zahlen (`1.234,56` → `1234.56`), Datumsformate (`31.12.2024` → `2024-12-31`),
String-Booleans (`ja`/`nein` → `true`/`false`), Null-Strings (`n/a`, `-` → `null`).

Ist `validation_repair` aktiv (Projekte: an) **und** die Strategie nicht `vision-per-page`, folgt bei
verbleibenden echten Fehlern **ein** gezielter LLM-Reparatur-Call, der die Fehlerliste + bisherige
Extraktion + Dokumenttext bekommt (max. 1 Pass, kein Retry-Loop). Ohne Dokumenttext (reine
Bildquelle) entfällt der Call.

### 6.6 Modell-Override

Priorität: `input.modelOverride` › `schema.config.model_override` › aktives System-Modell. Der
Override wird an alle Strategien **und** den Repair-Call durchgereicht. In der UI ist er pro Projekt
wählbar (Dropdown „KI-Modell (optional)"); vision-fähige Modelle sind markiert, weil Vision-Strategien
ein solches brauchen.

---

## 7. Der Lern-Loop

Das Projekt wird nicht programmiert, sondern **angelernt**: Der Anwender korrigiert KI-Vorschläge,
und das System leitet daraus wiederverwendbare Regeln ab.

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │  1. Beispiel hochladen  →  extract() liefert initial_extraction        │
 │  2. Anwender korrigiert Werte im UI                                    │
 │  3. train()  speichert Beispiel:                                       │
 │        { document_text, initial_extraction, corrected_extraction,      │
 │          corrections:[{field, was, corrected_to}] }                    │
 │                                                                        │
 │  4. Wenn  corrections>0  UND  total_examples ≥ 3:                       │
 │        generateGuidelines()  ── LLM analysiert alle Korrekturen ──►    │
 │        neue, versionierte "guidelines" (Regeln) am Projekt             │
 │                                                                        │
 │  5. Nächste Extraktion:                                                │
 │        selectFewShotExamples()  (Korrekturen zuerst) + guidelines      │
 │        fließen in profile.guidelines → System-Prompt der Strategie     │
 └──────────────────────────────────────────────────────────────────────┘
                          ▲                                   │
                          └───────────  wird mit jedem  ◄─────┘
                                        Beispiel besser
```

- **Trainingsbeispiele** (`examples`) speichern den vollen Dokumenttext, den KI-Erstvorschlag, die
  Korrektur und das Delta. Ein Beispiel ohne Korrektur gilt als „bestätigt korrekt".
- **Guidelines** werden erst ab 3 Beispielen und nur bei tatsächlichen Korrekturen (neu) generiert;
  `regenerate` erlaubt manuelles Neu-Ableiten. Seit Welle 2 laufen Regel-Updates als
  **Champion/Challenger-Eval** gegen die Beispiele (Hintergrund; nur messbar bessere/gleiche
  Regeln werden übernommen — Details: `docs/extraktion-eval-harness-2026-07-27.md`).
- **Few-Shot-Auswahl** priorisiert Beispiele *mit* Korrekturen (informativer) und bleibt in einem
  Token-Budget (~4000, max. 5).

---

## 8. Nutzungsdimensionen

Dieselbe Engine, drei Zugänge:

| # | Dimension | Zugang | Status |
|---|-----------|--------|--------|
| a | **API** | `POST /projects/:id/extract` (JSON `{text}` oder Datei-Upload) | vorhanden |
| b | **Eingebettet** | Apps/Agenten/Skills rufen `extract()` bzw. `runPipeline()` direkt auf (z. B. Vertragsmanagement) | vorhanden |
| c | **Manuelle UI** | „Verarbeiten"-Tab: Multi-Upload → Batch (Abschnitt 8.1) | vorhanden |

### 8.1 Batch / Massenverarbeitung („Verarbeiten"-Tab)

```
 POST /projects/:id/batches   (multipart: viele Dateien)
        │
        ▼
 createBatchRun()  → Run (status pending) + je Datei ein Eintrag (pending)
        │
        ▼
 void runBatchExtraction()   ── FIRE-AND-FORGET (kein await) ──┐
        │  Run → processing                                    │
        │  pLimit(3)  ·  EXTRACTION_BATCH_CONCURRENCY           │
        │    je Datei:  pending → processing                   │
        │               extract(projectId, {file}) →           │
        │               upsertFileResult(...) → completed|failed│
        │  Fail-Soft (eine Datei scheitert ≠ ganzer Lauf)      │
        │  Temp-Cleanup · Run → completed                      │
        └──────────────────────────────────────────────────────┘
        ▲
        │ FRONTEND pollt ~alle 2 s:
        │   GET  /projects/:id/batches/:runId          (Summaries, OHNE Bilder)
        │   GET  .../files/:fileId                     (Detail: boxes + pageImages, on-demand)
```

**Zwei Datentiers:** Der Summary-Response (fürs Polling/die Tabelle) enthält **keine** schweren
Seitenbilder; Boxen, `pageImages` und `document_text` werden erst beim Aufklappen einer Zeile
nachgeladen.

**Review-Workflow (seit Welle 3):** Jede Datei bekommt eine Konfidenz-Triage
(`auto_ok`/`needs_review`, Schwelle konfigurierbar) mit Filter/Zählern; die Detailansicht ist
ein Korrektur-Formular — „Übernehmen & lernen" macht die Korrektur zum Trainingsbeispiel und
setzt die Datei auf „Geprüft". Eine Kalibrierungs-Statistik (RulesTab „Qualität") zeigt, ob
die Konfidenz echte Fehler voraussagt. Details:
`docs/extraktion-review-workflow-2026-07-28.md`.

**Export:** CSV/JSON (clientseitig), XLSX (`GET .../export.xlsx` via `generateDocument`) und
**„In Tabelle schreiben"** (`POST .../to-table`: Projekt-Felder → Tabellen-Spalten, je Dokument
eine Zeile).

### 8.2 Export/Import von Projekten

`GET /projects/:id/export?examples=true|false` erzeugt ein portables `.json`-Paket (Schema +
`instructions` + gelernte `guidelines` immer; rohe Trainingsbeispiele nur auf Wunsch, da PII).
`POST /projects/import` legt **immer ein neues** Projekt an (frische ID, Namens-Dedup mit
„(Import)"). Baut nur auf bestehendem CRUD auf → **keine** zusätzliche Storage-Divergenz.

---

## 9. Persistenz & Datenbank

Einzige Divergenz zwischen den Worktrees: **wo** gespeichert wird. Signaturen und Logik sind gleich.

| Datenobjekt | Scalingo (Postgres, Schema `extraction`) | Railway (YAML-Dateien) |
|-------------|------------------------------------------|------------------------|
| Projekt | Tabelle `projects` (`fields`, `instructions`, `guidelines`, `learning`, `extraction` jsonb) | `data/extraction-projects/<id>/project.yaml` |
| Trainingsbeispiele | Tabelle `examples` (`documentText`, `initialExtraction`, `correctedExtraction`, `corrections`, `confirmedCorrect`) | `.../examples/*.yaml` |
| Batch-Lauf | Tabelle `batch_runs` (`status`, `fileCount`) | `.../batch-runs/<runId>/run.yaml` |
| Batch-Datei | Tabelle `batch_run_files` (`extractedData`, `fieldConfidences`, `strategy`, `error`, **`detail` jsonb** = boxes+pageImages, on-demand) | `.../batch-runs/<runId>/files/<fileId>.yaml` |

Postgres-Migration `0024_extraction_batch_runs.sql` legt die beiden Batch-Tabellen an (Projekt-/
Beispiel-Tabellen bestanden bereits; Strategie-Feld kam mit `0020`). Die schwere `detail`-Spalte
wird im Summary-`SELECT` bewusst ausgelassen.

---

## 10. Externe Abhängigkeiten

| Abhängigkeit | Zweck | Optional? | Verhalten wenn fehlt |
|--------------|-------|-----------|----------------------|
| **LLM Chat/Vision** (Adacor AI, o. Override) | Extraktion, Konfidenz, Repair | nein | Extraktion nicht möglich |
| **Markitdown-API** | Office/PDF → Markdown-Text | für Text-Strategien | kein Text → Vision nötig |
| **poppler / pdftocairo, pdfinfo** | PDF → PNG-Seiten, Seitenzahl | ja | `vision-per-page` schlägt fehl; `hybrid` fällt auf Text zurück |
| **tesseract** (deu+eng) | Wort-Boxen für Fundstellen | ja | Extraktion ok, nur keine Boxen |

Installation der Binaries: macOS `brew install poppler tesseract`; Linux/Scalingo/Railway
`apt-get install -y poppler-utils tesseract-ocr tesseract-ocr-deu`.

---

## 11. API-Routen (Referenz)

`backend/src/routes/extraction-projects.ts`:

| Methode | Pfad | Zweck |
|---------|------|-------|
| GET | `/projects` · `/projects/:id` | Liste · Detail |
| POST | `/projects` | anlegen |
| PUT | `/projects/:id` | ändern (inkl. `extraction`/`model_override`) |
| DELETE | `/projects/:id` | löschen (+ Beispiele) |
| POST | `/projects/import` | Paket importieren (JSON oder Datei) → neues Projekt |
| GET | `/projects/:id/export?examples=` | Paket herunterladen |
| POST | `/projects/:id/extract` | **Einzel-Extraktion** (JSON `{text}` oder Datei) |
| POST | `/projects/:id/train` | Trainingsbeispiel speichern (triggert Guidelines) |
| GET | `/projects/:id/examples` | Beispiele auflisten |
| DELETE | `/projects/:id/examples/:exId` | Beispiel löschen |
| POST | `/projects/:id/regenerate` | Guidelines manuell neu ableiten |
| POST | `/projects/:id/batches` | **Batch starten** (multipart, fire-and-forget) |
| GET | `/projects/:id/batches` · `/…/:runId` | Historie · Lauf-Status (Polling) |
| GET | `/…/:runId/files/:fileId` | Datei-Detail (boxes + pageImages) |
| GET | `/…/:runId/export.xlsx` | XLSX-Download |
| POST | `/…/:runId/to-table` | Ergebnisse in eine Tabelle schreiben |
| DELETE | `/…/:runId` | Lauf löschen |

---

## 12. Betrieb, Grenzen, Fehlerfälle

- **Kosten/Latenz** skalieren mit der Strategie: `single-pass` = 1 Call; `chunked` ≈ Chunks +
  Konfidenz-Calls; `vision-per-page`/`hybrid` = 1 Call je Seite plus Text — bei vielen Seiten
  deutlich teurer/langsamer. `max_pages` (500) und `max_concurrent` begrenzen.
- **Vision hängt gelegentlich** (beobachtet ~290 s Endpoint-Hänger): abgesichert durch 45 s Timeout
  + 1 Retry je Seite.
- **Repair max. 1 Pass** — keine Endlosschleifen; reine Format-Fehler werden ohnehin ohne LLM
  in-place korrigiert.
- **PII:** Trainingsbeispiele enthalten Originaldokumente; beim Export sind sie deshalb opt-in.
  Guidelines sind generalisiert/PII-frei.
- **Idempotenz Batch:** Ein Lauf-Fehler einer Datei stoppt die anderen nicht (Fail-Soft); Läufe
  überstehen Reload/Navigation (serverseitig persistiert).

---

## 13. Code-Landkarte

**Projekt-/Learning-Layer** — `backend/src/extraction/learning/`
- `service.ts` — `extract()`, `ingest()`, `train()`
- `pipeline-adapter.ts` — Projekt → Engine-Schema (flach ↔ Gruppe „felder", Guidelines-Rendering)
- `projects.ts` · `examples.ts` — CRUD (divergiert Postgres/YAML)
- `guideline-generator.ts` — Regel-Ableitung aus Korrekturen
- `batch-runs.ts` (divergiert) · `batch-service.ts` (identisch) — Massenverarbeitung
- `transfer.ts` — Export/Import
- `prompt-builder.ts` · `validators.ts` · `types.ts`

**Engine** — `backend/src/services/extraction/`
- `pipeline.ts` — Orchestrator (`runPipeline`, Strategie-Wahl, Eskalation, Repair-Hook)
- `strategies/` — `single-pass.ts` · `long-text-chunked.ts` · `vision-per-page.ts` · `hybrid.ts` · `prompt.ts` (`appendGuidelines`)
- `chunker.ts` · `tokenizer.ts` — Chunking & Token-Budget
- `merger.ts` · `confidence.ts` — Zusammenführung & Konfidenz
- `pdf.ts` (pdftocairo) · `ocr.ts` (tesseract) — Bild & Fundstellen
- `extract-call.ts` — LLM-Call, Vision-JSON, `repairExtraction()`
- `defaults.ts` · `types.ts`

**Sonstiges**
- `backend/src/routes/extraction-projects.ts` — REST-API
- `backend/src/db/schema/extraction.ts` — Postgres-Tabellen (nur Scalingo)
- `backend/src/extraction/validator.ts` · `schema-builder.ts` — Validierung & Function-Schema
- `frontend/src/pages/ExtractionProjectsPage.jsx` — gesamtes UI (Editor, Training, Batch, Export/Import)

**Weiterführend:** `docs/extraction-projects-heavy-pipeline-2026-06-04.md` (Engine-Migration),
`docs/batch-extraktion-ui-2026-06-15.md` (Batch-UI),
`docs/extraktion-line-items-2026-07-27.md` (Listen-Felder, Welle 1).

---

## 14. Vision & Ausbaustufen (Roadmap)

Eine Wettbewerbs-Analyse (vs. Rossum, Azure Document Intelligence, Instabase u.a.) ergab vier
strukturelle Lücken zwischen „gutem Werkzeug" und „bestem Tool im Space". Daraus wurde ein
**5-Wellen-Ausbau** abgeleitet (Reihenfolge mit Produktentscheidung festgelegt):

| Welle | Titel | Kern | Status |
|-------|-------|------|--------|
| **W1** | **Line-Items / Positionsdaten** | Feldtyp `list` mit Spalten; Adapter → Array-Gruppe; Dedupe; Positions-Tabellen in Training/Batch; XLSX-Zusatzblätter | **umgesetzt (2026-07-27)** |
| **W2** | **Eval-Harness & Audit** | Jede Guideline-Regeneration läuft automatisch als **Champion/Challenger** gegen bestätigte Beispiele (text-only, gedeckelt ~20); nur messbar bessere/gleiche Regeln werden übernommen. Feld-Accuracy-Metriken; Audit-Metadaten (guideline_version + Modell je Ergebnis) | **umgesetzt (2026-07-27)** — `docs/extraktion-eval-harness-2026-07-27.md` |
| **W3** | **Review-Workflow im Batch** | Batch-Ergebnisse korrigierbar → Korrekturen werden Trainingsbeispiele (Batch speichert dafür künftig `document_text`); Konfidenz-Triage (auto-ok / Review-Queue); Kalibrierungs-Messung | **umgesetzt (2026-07-28)** — `docs/extraktion-review-workflow-2026-07-28.md` |
| **W4** | **Eingangsstrecke** | Mehrfach-PDF **splitten** (Seitenpaar-Vision, Vorarbeit `tools/document-split-test.ts`) → **klassifizieren** (Muster `classifyContract`) → aufs passende Projekt **routen**; „Posteingang"-UI | geplant |
| **W5** | **API & Integration** | API-Batch + Webhooks; `pageImages` → S3; fachliche Validierungsregeln (Summen-Check Positionen↔Gesamtbetrag, Stammdaten-Abgleich via Tables); Ähnlichkeits-Few-Shot (Embeddings); Schema-Inferenz beim Onboarding | geplant |

Leitgedanke: Der Lern-Loop ist das Differenzierungsmerkmal — W2 macht ihn **beweisbar**
(kein Regressions-Risiko durch Guideline-Updates), W3 macht ihn zum **Schwungrad** (jede
Korrektur im Produktivbetrieb verbessert das Projekt), W4 macht aus dem Werkzeug eine
**Dokumenten-Eingangsstrecke**, W5 öffnet alles für **Integration**. Das Fundament
(Engine, Strategien, Lern-Idee) bleibt unangetastet — die Wellen sind Ausbau, kein Rewrite.
</content>
</invoke>
