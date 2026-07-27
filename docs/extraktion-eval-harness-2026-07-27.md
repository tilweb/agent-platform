# Extraktion: Eval-Harness & Audit (Champion/Challenger) — Ausbau-Welle 2

**Datum:** 2026-07-27
**Status:** Implementiert (main/Scalingo + demo/messe/Railway)
**Plan-Referenz:** `.claude/plans/dapper-wondering-oasis.md` (5-Wellen-Roadmap, W2)
**Fachkonzept:** `docs/fachkonzept-dokumenten-extraktion-2026-07-27.md` §14

## Kontext

Der Lern-Loop war das Differenzierungsmerkmal des Extraktions-Features — aber er hat sich
nie selbst gemessen: `generateGuidelines()` überschrieb die Regeln ungeprüft. Eine
schlechte Regel-Generation konnte die Extraktionsqualität **verschlechtern, ohne dass es
jemand merkte**; `accuracy_estimate` (Anteil unkorrigierter Beispiele) war nur ein
schwacher Proxy. Welle 2 macht den Lern-Loop **beweisbar**: Guideline-Updates werden
gegen die Trainingsbeispiele gemessen und nur bei ≥ Champion-Accuracy übernommen.
Zusätzlich trägt jedes Extraktionsergebnis **Audit-Metadaten** (Regel-Version, Modell,
Strategie) — Voraussetzung für Nachvollziehbarkeit und für die Kalibrierung in W3.

## Wie es funktioniert

### Eval-Mechanik (`learning/eval.ts`)
- **Ground Truth** = `corrected_extraction` der Trainingsbeispiele.
- Jedes Beispiel wird **text-only re-extrahiert** (gespeicherter `document_text`,
  `single-pass` mit Auto-Eskalation zu chunked, `llm_confidence: false`, Projekt-Modell
  bzw. Override). Cap `EXTRACTION_EVAL_CAP` (Default 20, neueste zuerst), Concurrency
  `EXTRACTION_EVAL_CONCURRENCY` (Default 3, pLimit-Muster).
- **Bewusst OHNE Few-Shot:** Few-Shot speist sich aus demselben Beispiel-Pool — ein
  Beispiel sähe sich selbst (Leakage). Gemessen wird genau das, was sich bei einem
  Update ändert: instructions + guidelines.
- **Vergleich je (Beispiel, Feld), typ-normalisiert:** DE-Zahlen via `correctNumber` +
  Epsilon 0.005; Datum via `correctDate`; Text trim/Whitespace-Collapse/lowercase;
  Bool-Varianten (ja/nein/true/false); leere Werte (`null`/`''`/undefined) äquivalent;
  **Listen als ordnungs-unabhängiges Multiset** über normalisierte Zeilen-Keys
  (Duplikate zählen). Metriken: Accuracy je Feld + **Overall = Mittel über alle
  (Beispiel, Feld)-Paare**, in Prozent.
- Fail-Soft je Beispiel; **>50 % Ausfälle ⇒ Eval `failed`** (Ergebnis unbrauchbar).

### Champion/Challenger (`learning/service.ts runGuidelineUpdate`)
- Trigger wie bisher: `train()` ab 3 Beispielen mit Korrektur — jetzt aber
  **fire-and-forget im Hintergrund** (Eval dauert 30–90 s; der train-Request blockiert
  nicht mehr). Ebenso „Neu ableiten & messen" (`/regenerate`) und „Voll-Eval"
  (`POST /projects/:id/evaluate`, misst nur den Champion).
- Ablauf: Kandidat generieren → Champion-Score holen (Cache) oder messen → Challenger
  messen → `decideAcceptance`: **übernehmen wenn `challenger.overall >=
  champion.overall`** (Gleichstand zählt — neuere Regeln spiegeln mehr Beispiele),
  sonst verwerfen (Regeln bleiben, Ablehnung wird protokolliert).
- **Champion-Score-Cache:** Hash über sortierte Beispiel-IDs + Modell + Cap
  (`evalSetHash`). Nur bei geändertem Eval-Set/Modell wird der Champion neu gemessen —
  Kosten je Update: ≤20 (Cache-Hit) bzw. ≤40 (Miss) günstige text-only Calls.
- **Sicherer Default bei Eval-Fehlern** (z.B. LLM down): Regeln werden NICHT geändert,
  Action `error`; nachholbar über den Button.
- **In-Memory-Lock je Projekt** (Backend ist single-process): parallele Läufe werden
  abgewiesen (`{started:false}`); persistierter `running`-Status älter 10 min gilt als
  stale (Crash) und wird ignoriert/überschrieben.

### Zustand & Audit
- `learning.eval` (jsonb/YAML — **keine Projekt-Migration**): `status`, `champion`
  (Overall, je Feld, Beispiele, Eval-Set-Hash, Regel-Version, Modell, Zeitpunkt),
  `last_run` (accepted/rejected/measured/initial/error inkl. Delta), `history` (Cap 20).
- `extract()` liefert zusätzlich `audit { guideline_version, model, strategy }`
  (model = Override `provider/model`, sonst `system-standard`). Batch speichert es je
  Datei: **Migration `0025_batch_file_audit.sql`** (Spalte `audit` jsonb, Scalingo);
  Railway: Feld im File-YAML. Summary + Detail geben es zurück.
- Engine additiv erweitert: `ExtractionConfig.llm_confidence` (Default true) — die
  einzige Engine-Änderung; Vertragsmanagement unberührt.

### UI (RulesTab)
- Neuer Abschnitt **„Qualität (gemessen)"**: gemessene Genauigkeit groß (+ Beispiele,
  Regel-Version, Modell, Zeitpunkt), **Feld-Accuracy-Grid** (grün ≥90 / gelb ≥60 / rot),
  letzter Lauf als Satz („Regel-Update verworfen: −3,2 Pp auf 18 Beispielen —
  bestehende Regeln bleiben aktiv."), kompakter Verlauf.
- Buttons „Voll-Eval starten" + „Neu ableiten & messen" (disabled während eines Laufs);
  **Live-Polling** des Projekts alle 3 s solange `eval.status==='running'`.
- TrainingTab meldet „Beispiel gespeichert — Regeln werden im Hintergrund geprüft".
- BatchFileDetail zeigt die Audit-Zeile (Strategie · Modell · Regeln vN).
- Bestehende Kachel „~x %" umbenannt in „ohne Korrektur (Schätzung)" — klar getrennt
  von der gemessenen Genauigkeit.

## Wichtige Designentscheidungen

- **Hintergrund statt synchron** — UX: train antwortet sofort; Polling-Muster wie Batch.
- **Eval ohne Few-Shot** — Leakage-frei; absolute Scores sind dadurch konservativ,
  der Champion/Challenger-Vergleich bleibt fair.
- **Gleichstand akzeptiert** — sonst friert das System bei gesättigter Accuracy ein und
  neue Beispiele fließen nie in die Regeln.
- **Text-only-Näherung** — Beispiele haben keine Originaldatei (nur `document_text`);
  Vision-Qualität wird nicht mitgemessen (bekannte Grenze, dokumentiert).
- **Fehler schützen den Champion** — kein stilles Übernehmen bei kaputtem Eval.

## Verifikation

- **Tests:** 123 Backend-Tests grün, davon 19 neue (`eval.test.ts`): Normalisierung
  (DE-Zahl/Datum/Whitespace/Bool/Null-Familie), Listen-Multiset (Reihenfolge egal,
  Duplikate zählen), Accuracy-Mathe, Hash-Stabilität, Akzeptanzregel. tsc ohne neue
  Fehler; Frontend-Builds beide grün.
- **E2E (lokal, Port 3011, Override Adacor Qwen 3.5):** Projekt + 3 korrigierte
  Trainings → train #3 startete den Hintergrund-Lauf → `running`→`idle` nach ~135 s →
  Regeln v1 übernommen (Champion leer 100 % vs. Challenger 100 % auf 3 Beispielen,
  by_field je 100), generierte Regel fachlich sinnvoll („Empfänger inkl.
  Werk-Bezeichnung") und **griff nachweislich im Folge-Batch**; Voll-Eval → `measured`;
  paralleles regenerate → `{started:false}` (Lock); Batch-Datei trug `audit` in
  Summary + Detail; Migration 0025 lief beim Boot.
- **Railway:** 12 Dateien 1:1 gespiegelt, `batch-runs.ts` (YAML) um `audit` erweitert,
  123 Tests grün, YAML-Audit-Roundtrip per Smoke-Test.

## Out-of-Scope / Folge-Wellen

- Tatsächlich aufgelöstes Modell je Strategie-Call (heute: Override oder
  `system-standard`).
- W3 nutzt die Audit-/Eval-Basis: Batch-Korrekturen → Trainingsbeispiele,
  Konfidenz-Triage, Kalibrierungs-Report (Konfidenz vs. gemessene Fehler).
