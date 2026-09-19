# Umbau-Spec: Wohngeld-Posteingang auf das Plattform-Extraction-Feature

**Stand:** 2026-09-20 · **Status:** ENTWURF → Umsetzung · **Grundlage:** Integrations-Analyse (dieser Session)

## Ausgangslage / Problem

Der Wohngeld-Posteingang nutzt aktuell **eigene** Extraktion:
- `backend/src/apps/wohngeld/extract.ts` — `pdftotext -layout` (nur born-digital, **kein OCR**).
- `backend/src/apps/wohngeld/extraction.ts` — ein LLM-Call, der Typ **und** Stammdaten/Analyse per
  Freitext-JSON liefert (`parseExtraktion`), **ohne Confidence/Provenienz**.

Die Plattform hat ein reiferes, **DB-frei aufrufbares** Extraktions-Kernstück (`runPipeline` in
`src/services/extraction/`) mit Vision-Strategien (OCR für Scans), Confidence-Scoring,
Provenienz (Quellseite), DE-Zahl/Datum-Reparatur. Doppelarchitektur → wir stellen um.

## Ziel

Die **schema-gebundene Stammdaten-/Analyse-Extraktion** durch `runPipeline` ersetzen und dabei:
- **OCR/Scan-Fähigkeit** gewinnen (Vision-Strategie bei Scans/Bildern).
- **Confidence pro Feld** gewinnen → fließt direkt in `feld_status` (KI-Vorschlag-Bestätigung).
- **Provenienz (Quellseite)** pro Feld als Zusatznutzen speichern.
- Die wohngeld-spezifische Logik behalten: **DokumentTyp-Klassifikation** (enum-strikt), die
  **Enum-Guards** (`pickStammdaten`/`pickAnalyse`), das `DokumentAnalyse`-Modell, `feld_status`.

## Scope

**MINIMAL (dieser Umbau):** eine Datei = ein Dokument. Klassifikation bleibt wohngeld-eigen;
Stammdaten/Analyse via `runPipeline`. Deckt born-digital **und** Scans (Vision-Fallback).

**Nicht in diesem Umbau (bewusst):**
- **Inbox/Projekte/Batch-Runs** der Plattform (`processInboxUpload`, `extraction-inbox`,
  `enqueueBatch`) — stark an `extraction.projects`/Jobs/S3 gekoppelt, routet in fremde DB-Projekte,
  nicht in Wohngeld-Akten. **Nicht übernehmen.**
- **Mehrdokument-Split** eines Sammel-PDF (VOLL) — additive Erweiterung später (Bausteine
  `renderPdfToImages`/`judgeBoundaries`/`rangesFromBoundaries`/`buildPartPdf` sind DB-frei verfügbar).

## Zielarchitektur

`routes/posteingang.ts` → `klassifiziereUndExtrahiere(fileBytes, mimeType, opts)` (in `extraction.ts`,
umgebaut):

1. **Text gewinnen:** born-digital PDF → `pdfToLayoutText(bytes)` (Plattform, ersetzt die eigene
   `extract.ts`-Funktion). Office → `documentConverter`. Ergebnis = `text`.
2. **Scan-Erkennung (pragmatisch):** liefert `pdftotext` (nahezu) keinen Text **oder** ist die Datei
   ein Bild → als **Scan** behandeln: `PreparedFile` mit `rawBuffer` + Strategie `hybrid`. Sonst
   born-digital: `PreparedFile.text` + Strategie `single-pass`.
3. **Klassifikation (wohngeld-eigen, bleibt):** eigener, enum-strikter LLM-Call → `DokumentTyp`
   (`typ`) + `titel`. (Der bestehende Klassifikations-Prompt, entschlackt um die Stammdaten.)
4. **Schema-gebundene Extraktion (neu):** nur wenn `typ === 'wohngeldantrag'` →
   `runPipeline({ files:[prepared], schema: WOHNGELD_SCHEMA, userId, modelOverride })`.
5. **Mapping:** `PipelineRunResult.extracted` → `ExtrahierteStammdaten` + `DokumentAnalyse`
   (via `pickStammdaten`/`pickAnalyse` als Normalisierer/Enum-Guards, wiederverwendet);
   `fieldConfidences` → pro Feld-Confidence; `provenance` → Quellseite (optional am Dokument).
6. **Graceful degradation:** Provider/Poppler nicht verfügbar oder Pipeline wirft → Fallback
   `{ typ:'sonstiges', analyse:{} }` (wie heute), Upload bricht nicht ab.

### Schema (inline, kein DB-Projekt)

`WOHNGELD_SCHEMA: ExtractionSchema` in neuer Datei `extraction-schema.ts`, Feldgruppen so benannt,
dass das Mapping zu den bestehenden `feld_status`-Pfaden (`feldstatus-mapping.ts`) passt bzw. über
eine kleine Übersetzungs-Map. Felder: antragsteller (vorname/nachname/geburtsdatum),
adresse (strasse/hausnummer/plz/ort), wohnung (miete/wohnflaeche_qm), antrag
(antragsdatum/wohngeldart/antragsart), analyse (unterschrift_vorhanden/datum_vorhanden).
Config: `applyExtractionDefaults({ strategy, model_override: extractionModelConfig(),
validation_repair: true, llm_confidence: true })`. Enum-Werte nur als `hint` → harte Prüfung
bleibt im App-Code (`pickStammdaten`).

### Confidence → `feld_status`

Beim Verteilen (`posteingang.ts` → `setFeldStatus`) die je-Feld-Confidence mitgeben:
- `conf === 0` (von `finalizeResult` bei Reparatur/Änderung gesetzt) → `bestaetigt=false`, klar „prüfen".
- niedrige Confidence (< `confidence_threshold`) → `bestaetigt=false` (Vorschlag, prüfen).
- hohe Confidence → weiterhin `quelle='llm', bestaetigt=false` (Human-in-the-Loop bleibt!), aber die
  Confidence wird gespeichert und im UI als Sicherheit angezeigt. (KI entscheidet nie automatisch.)

## Betroffene Dateien

| Datei | Änderung |
|---|---|
| `extraction-schema.ts` (neu) | `WOHNGELD_SCHEMA` (inline ExtractionProfile+Config) + Feld↔feld_status-Pfad-Map |
| `extraction.ts` | Umbau: Klassifikator behalten; Stammdaten/Analyse via `runPipeline`; Mapping `extracted`+`fieldConfidences` → `ExtrahierteStammdaten`/`DokumentAnalyse` (+conf); Fallback |
| `extract.ts` | `pdfToText` → durch Plattform `pdfToLayoutText` ersetzen ODER als dünnen Scan-Detektions-Helfer behalten |
| `routes/posteingang.ts` | `rawBuffer`/mimeType durchreichen; Confidence in `setFeldStatus` |
| `storage.ts`/`types.ts` | `feld_status.confidence` bereits vorhanden — nur befüllen; ggf. Provenienz am Dokument (`analyse`/`data`) |
| `extraction.test.ts` | anpassen: `parseExtraktion` wird nur noch für den Klassifikator-JSON genutzt (Typ/Titel); Pipeline-Mapping mit gemocktem `PipelineRunResult` testen (rein) |

## Nicht-Ziele / Risiken

- **Kosten:** Vision-Pfad (`hybrid`) macht O(Seiten) LLM-Calls — nur bei Scans. Born-digital bleibt
  ein günstiger Text-Call (`single-pass`). Strategie datenabhängig wählen.
- **Systemabhängigkeiten:** poppler-utils (`pdftotext`, `pdftocairo`), optional tesseract (nur Boxen).
- **Provider:** `EXTRACTION_LLM_*` (default adacor/qwen) muss erreichbar sein — sonst Fallback.
- **Kein** Übernehmen der DB-gekoppelten Inbox/Projekte.

## Abnahme

- `bun test src/apps/wohngeld/` grün (Mapping-Tests mit gemocktem Pipeline-Ergebnis; Klassifikator-Parse).
- `tsc`/Frontend-Build grün. Bestehendes Posteingang-Verhalten (Preview → Verteilen → Prüfung) bleibt.
- Manuell/Seed: born-digital Antrag füllt Stammdaten mit Confidence in `feld_status`.
