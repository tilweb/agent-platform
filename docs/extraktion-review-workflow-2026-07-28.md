# Extraktion: Review-Workflow im Batch (Triage + Lernen + Kalibrierung) — Ausbau-Welle 3

**Datum:** 2026-07-28
**Status:** Implementiert (main/Scalingo + demo/messe/Railway)
**Plan-Referenz:** `.claude/plans/dapper-wondering-oasis.md` (5-Wellen-Roadmap, W3)
**Fachkonzept:** `docs/fachkonzept-dokumenten-extraktion-2026-07-27.md` §14

## Kontext

Der Volumen-Traffic des Extraktions-Features läuft durch den „Verarbeiten"-Tab — aber
Korrekturen waren nur im Training-Tab möglich: Der Produktivbetrieb lernte nichts, und
bei 50 Dokumenten sah niemand, WELCHE geprüft werden müssen. Welle 3 schließt beide
Lücken: **Konfidenz-Triage** (welche Dateien brauchen ein Review?) und **Lernen aus dem
Batch** (jede Korrektur wird Trainingsbeispiel → Schwungrad Nutzung→Lernen, das direkt
in den W2-Champion/Challenger-Mechanismus speist). Dazu die **Kalibrierungs-Statistik**:
Sagt die Konfidenz echte Fehler voraus — oder ist das Modell überkonfident?

## Wie es funktioniert

### Triage (`learning/review.ts`)
- Nach jeder Batch-Extraktion: `computeReviewStatus(project, data, fieldConfidences)`
  → `needs_review`, wenn irgendein Feld Konfidenz < Schwelle hat **und** (Wert
  vorhanden ODER Pflichtfeld). Leere optionale Felder mit Konfidenz 0 lösen bewusst
  kein Review aus (sonst Dauer-Alarm bei selten belegten Feldern). Fehlgeschlagene
  Dateien: kein Status.
- Schwelle: `extraction.review_threshold` (neu, optional, in den Einstellungen) →
  sonst `confidence_threshold` → 0.6. `review_threshold` liegt als Konsumenten-Feld
  in `ExtractionConfig` (Engine ignoriert es, wie `model_override`).
- Nach „Übernehmen & lernen": `reviewed`.

### Lernen aus dem Batch
- Batch-Dateien speichern jetzt den **`document_text`** (Trainings-Grundlage):
  Postgres Migration `0026_batch_review.sql` (Spalten `document_text`,
  `review_status`); Railway: Felder im File-YAML. `document_text` wird NUR vom
  Detail-Endpoint geliefert (nicht im Polling-Summary — Payload-Disziplin wie bei
  `detail`); `review_status` in Summary und Detail.
- Neue Route `POST /projects/:id/batches/:runId/files/:fileId/learn`
  (`{ corrected }`): lädt das Detail, ruft `train()` mit
  `initial_extraction = data` (Original) + `corrected_extraction` +
  `field_confidences`, setzt dann `data := corrected` und `review_status :=
  'reviewed'`. **Das Original bleibt im Trainingsbeispiel erhalten** — Tabelle und
  Exporte zeigen den geprüften Stand. Alte Läufe ohne Dokumenttext → 400 mit klarer
  Meldung (UI zeigt Hinweis, Button inaktiv).
- Ab dem dritten Beispiel greift automatisch der W2-Hintergrund-Lauf
  (Champion/Challenger) — Korrekturen aus dem Batch verbessern die Regeln also nur
  dann, wenn sie messbar helfen.

### Kalibrierung (`learning.calibration`)
- Aggregat, kein neuer Storage: 5 Konfidenz-Buckets (0–0.2 … 0.8–1.0) mit
  `{ total, correct }` + `samples`.
- `train()` nimmt optional `field_confidences` (Konfidenzen der initialen
  Extraktion) und zählt je Feld, ob die initiale Extraktion korrekt war —
  **typ-normalisiert via W2-`compareField`** (DE-Zahlen/Datumsformate/Listen-Multiset;
  reine Formatabweichungen zählen nicht als Fehler).
- Gespeist aus beiden Korrekturwegen: der Training-Tab sendet seine Konfidenzen
  jetzt mit, der Batch-Review nutzt die gespeicherten.
- UI: RulesTab „Qualität" zeigt ab 10 Stichproben je Bucket
  „Konfidenz X–Y% → Z% tatsächlich korrekt (n)"; liegt die beobachtete Korrektheit
  deutlich unter dem Bucket, wird die Zeile als überkonfident markiert + Hinweis,
  die Review-Schwelle zu erhöhen. (Bewusst nur Report — keine Auto-Anpassung.)

### UI (Verarbeiten-Tab)
- Spalte **„Prüfung"** mit Badges (Zu prüfen = warning, Auto-OK = success,
  Geprüft = primary), Zähler im Lauf-Header, **Filter-Chips**
  (Alle/Zu prüfen/Auto-OK/Geprüft, clientseitig).
- Die Datei-Detailansicht ist jetzt ein **Korrektur-Formular**: je Feld Konfidenz-%
  und (korrigiert)-Markierung, Skalare über die neue gemeinsame
  **`FieldInputControl`** (das Training-Formular wurde darauf umgestellt —
  eine Quelle für die Input-Logik), Listen über `ListItemsEditor`. Button
  „Korrektur übernehmen & lernen" bzw. „Als korrekt bestätigen & lernen"
  (bestätigte Beispiele stützen den Few-Shot ebenfalls).
- `BatchTab` bekommt `onProjectUpdated` durchgereicht, damit Lern-Zähler und
  Eval-Status nach einem Review sofort aktuell sind.

## Wichtige Designentscheidungen

- **Leere optionale Felder triggern kein Review** — Konfidenz 0 bei „Feld kommt im
  Dokument nicht vor" ist der Normalfall, kein Fehler-Signal.
- **`data := corrected` nach Review** — die Batch-Tabelle ist das Arbeitsergebnis;
  das unkorrigierte Original ist als `initial_extraction` im Trainingsbeispiel
  archiviert (und im Audit nachvollziehbar).
- **Doppel-Lernen derselben Datei** wird per UI verhindert (Status `reviewed` →
  Button weg); die API erlaubt es bewusst (Beispiele sind einzeln löschbar).
- **Kalibrierung als Report, nicht Auto-Tuning** — erst Daten sammeln; automatische
  Schwellen-Anpassung wäre W5+-Material.

## Verifikation

- **Tests:** 136 Backend-Tests grün, davon 13 neue (`review.test.ts`): Triage
  (Schwellen-Auflösung, leeres optionales vs. Pflichtfeld, fehlende Konfidenzen,
  eigene Schwelle), Kalibrierung (Bucket-Zuordnung, Format-Normalisierung
  „30,90"≙30.9, Aggregat-Fortschreibung, Overflow-Bucket). tsc ohne neue Fehler,
  Frontend-Builds beide grün.
- **E2E (lokal, Port 3011, Override Qwen 3.5):** Projekt mit `review_threshold` 0.9,
  Batch mit 2 Text-Gutschriften → beide `needs_review` (Pflichtfeld IBAN leer,
  Konfidenz 0 — Regel greift), `document_text` NUR im Detail-Response; learn-Route →
  Trainingsbeispiel mit 2 Korrekturen, Datei `reviewed` mit korrigierten Werten in
  der Summary, `learning.calibration` gefüllt (belegnummer conf 1.0 → Bucket 4,
  korrekt); Migration 0026 lief beim Boot.
- **Railway:** 9 Dateien 1:1 gespiegelt, `batch-runs.ts` (YAML) um beide Felder
  erweitert; 136 Tests grün; YAML-Smoke bestätigt: `reviewStatus` in der Summary,
  `documentText` nur im Detail.

## Out-of-Scope / Folge-Wellen

- Auto-Anpassung der Review-Schwelle aus der Kalibrierung (bewusst Report-only).
- Sammel-Aktionen („alle Auto-OK bestätigen") — Kandidat für W5-Feinschliff.
- W4: Eingangsstrecke (Splitten → Klassifizieren → Routen, „Posteingang").
