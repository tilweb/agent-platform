# Manuelle Batch-Extraktions-UI ("Verarbeiten"-Tab)

**Datum:** 2026-06-15

## Kontext

Die Extraktions-Projekte-Funktion diente bisher nur dem Konfigurieren/Anlernen eines Projekts
(Training, Regeln, Einstellungen). Die Heavy-Extraction-Pipeline soll künftig in drei Dimensionen
genutzt werden: (a) via API, (b) eingebettet in Workplace-Apps/Agenten/Skills, (c) manuell über
eine UI. Diese Iteration baut **(c)**: eine Oberfläche, über die man per Multi-Upload mehrere
Dokumente durch ein angelerntes Projekt verarbeitet, den Status je Dokument verfolgt, Ergebnisse
prüft und exportiert.

## Entscheidungen

- **Serverseitige Persistenz** statt rein clientseitig: Lauf-Historie pro Projekt + pro-Datei-
  Status/Ergebnis, übersteht Reload/Navigation. Verarbeitung läuft als Hintergrund-Job
  (fire-and-forget), das Frontend pollt.
- **Export: CSV, Excel (.xlsx), JSON und „in Tabelle schreiben"** (Tables-Feature).
- **Detail-Vorschau** je Dokument: aufklappbare Tabellenzeile mit Bounding-Box-Overlay
  (wiederverwendet aus dem Training-Tab) + Feldwerten.

## Architektur

**Storage-Divergenz isoliert:** Nur `extraction/learning/batch-runs.ts` implementiert die
Persistenz unterschiedlich — Postgres (Scalingo) vs. YAML-Dateien (Railway). Route,
Hintergrund-Service und Frontend sind in beiden Worktrees identisch, weil sie nur die gemeinsamen
Funktions-Signaturen aus `batch-runs.ts` nutzen.

**Zwei Datentier pro Datei:**
- *Summary* (data, fieldConfidences, status, error, strategy) → Tabelle/Polling/Export.
- *Detail* (boxes, pageImages, base64-PNGs) → nur on-demand beim Aufklappen geladen, nie im
  Listen-/Polling-Response. Postgres: separate `detail`-jsonb-Spalte (im Summary-Select
  ausgelassen). YAML: in der Pro-Datei-YAML, nur vom Detail-Endpoint gelesen.

**Verarbeitungsmodell (fire-and-forget):**
1. Multi-Upload (`files`) → Temp-Ablage unter `/tmp/extraction-batch/<runId>/`, Lauf + Pro-Datei-
   Einträge (pending) anlegen, `void runBatchExtraction(...)`, sofort `{ runId }` zurück.
2. `runBatchExtraction`: Lauf → processing; pLimit(3)-Worker-Pool ruft den bestehenden
   `extract()`-Pfad je Datei, schreibt Summary+Detail (completed/failed), Fail-Soft. Am Ende
   Lauf → completed, Temp-Cleanup. Per-Call-Timeout/Retry steckt bereits in der Pipeline.
3. Frontend pollt `GET .../batches/:runId` (~2 s) bis completed/failed.

## Backend

- **`extraction/learning/batch-runs.ts`** (divergent): `createBatchRun`, `setRunStatus`,
  `upsertFileResult`, `listBatchRuns`, `getBatchRun` (Summaries), `getBatchRunFileDetail`
  (boxes+pageImages), `deleteBatchRun`.
- **`extraction/learning/batch-service.ts`** (identisch): `runBatchExtraction` mit pLimit(3),
  konfigurierbar über `EXTRACTION_BATCH_CONCURRENCY`.
- **Routen** (`routes/extraction-projects.ts`):
  `POST /projects/:id/batches` (multipart, fire-and-forget) · `GET …/batches` (Historie) ·
  `GET …/batches/:runId` (Run+Summaries) · `GET …/batches/:runId/files/:fileId` (Detail) ·
  `GET …/batches/:runId/export.xlsx` (`generateDocument` → XLSX-Buffer) ·
  `POST …/batches/:runId/to-table` (Felder→Tables-Columns, `createTable`+`addRow`) ·
  `DELETE …/batches/:runId`.
- **Postgres (Scalingo):** Tabellen `extraction.batch_runs` + `extraction.batch_run_files`,
  Migration `0024_extraction_batch_runs.sql` (+ `_journal.json` idx 24), Schema in
  `db/schema/extraction.ts`.
- **YAML (Railway):** `data/extraction-projects/{projectId}/batch-runs/{runId}/run.yaml` +
  `files/{fileId}.yaml`.

Keine neuen Dependencies — Wiederverwendung: `extract()`, `generateDocument`,
Tables-`createTable`/`addRow`, pLimit-Muster.

## Frontend

Neuer Tab **„Verarbeiten"** in `ProjectDetailView` → Komponente `BatchTab` (in
`ExtractionProjectsPage.jsx`): Multi-Dropzone, „Extraktion starten", Status-Polling mit
Fortschritt (x/n) und Status-Badges, Lauf-Historie (öffnen/löschen), Ergebnistabelle
(Zeile=Dokument, Spalten=Felder + Ø-Confidence), aufklappbare Detail-Vorschau mit
`BoxOverlay`, Export via `ExportDropdown` (CSV/XLSX/JSON, CSV+JSON clientseitig, XLSX als
Blob-Download) + Button „In Tabelle schreiben". Reine theme.js-Styles, deutsche UI-Texte.

## Verifikation (Scalingo, lokal)

E2E gegen das laufende Backend mit zwei Sani-Rezepten:
- `POST /batches` → `{ runId }`; Hintergrund-Lauf pollte `processing` → `completed` (2/2).
- Beide Dokumente voll extrahiert (17–18 Felder, strategy `vision-per-page`).
- `GET …/files/:fileId`: 11 Boxes, 1 Seitenbild (page/width/height/dataUri).
- `GET export.xlsx`: valides „Microsoft Excel 2007+" (Titel/Metadaten/Header/Zeilen).
- `POST to-table`: Tabelle mit 2 Zeilen (inkl. `quelldatei`, Boolean-Felder korrekt).
- `DELETE`: Lauf entfernt; Historie danach leer. (DELETE braucht Origin-Header — CSRF-Schutz.)
- `tsc` ohne neue Fehler in den berührten Dateien, Frontend-Build grün.

**Railway:** tsc/Build grün; YAML-Persistenz per isoliertem Bun-Smoke-Test bestätigt
(create → status → upsert → list/get/detail → delete, Counts korrekt, Summary ohne pageImages).
Voller Server-E2E im Railway-Worktree steht aus (Port-Konflikt mit laufendem Scalingo-Backend),
Route/Service/Frontend sind aber byte-identisch zur verifizierten Scalingo-Variante.

## Offene Punkte / spätere Iterationen

- Korrektur-Loop direkt aus der Batch-Detailansicht ins Training zurückspielen.
- Abbrechen eines laufenden Batches; Re-Run einzelner fehlgeschlagener Dateien.
- Nutzungsdimensionen (a) API und (b) App/Agent/Skill-Einbettung.
