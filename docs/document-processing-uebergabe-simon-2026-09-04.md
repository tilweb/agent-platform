# Document Processing — Technische Übergabe an Simon (KI-Architektur)

**Datum:** 2026-09-04
**Von:** Andreas (Piloten-/Experiment-Repo `agent-platform`)
**An:** Simon (KI-Architekt) + Dev-Team Produktiv-Workplace
**Zweck:** Anders als bei bisherigen Feature-Übergaben (nur fachliches Konzept) wird hier **der Code
übergeben** — er ist an echten Kundenpiloten battle-tested. Das Dev-Team soll ihn **einpassen**, nicht
neu bauen: nur die Teile anfassen, die für die Produktion angepasst werden müssen (die
„Integrationsnähte", §7). Dieses Dokument liefert die Landkarte: Architektur, Konzepte, Entscheidungen,
Datenflüsse, Nähte, ENV, Sicherheit, Reifegrad, offene Punkte.

> **Lies zuerst §3 (Repo-Kontext) und §7 (Integrationsnähte).** Der Rest ist Nachschlagewerk.

---

## 1. Was Document Processing kann (in einem Absatz)

Aus beliebigen Dokumenten (PDF born-digital, Scans, Fotos, Office, XLSX) **strukturierte Daten nach
Schema extrahieren** — mit einem geschlossenen Qualitätskreis: **Profile** (Feld-Schema + Prosa-
Anweisungen), **Multi-Strategie-Engine** (Text/Vision/Hybrid + neu: deterministisch), **OCR-Fusion**
als Zahlenprüfer, **Review-Triage** (auto_ok vs. „zu prüfen") mit Fundstellen, **Lern-Loop** (Few-Shot
aus Korrekturen), **fachliche Prüfregeln**, **Posteingang** (Sammel-Scan → getrennte Dokumente),
**Segmentierung** (ein Vorgang → typisierte Abschnitte), **Batch**, **Export** (XLSX/CSV) und
**Public-API + Webhook**. Alles auf **souveräner DE-Infrastruktur** (Adacor-LLM), file- **oder**
DB-basiert.

---

## 2. Umfang / Code-Karte

Zwei Schichten (bewusst getrennt — die Engine kennt keine App-Begriffe):

### 2a. Engine — `backend/src/services/extraction/` (~3.980 Zeilen, generisch)
| Datei | Rolle |
|---|---|
| `types.ts` | `ExtractionStrategy`-Vertrag, `StrategyInput/Result`, `PreparedFile`, `ExtractionConfig` |
| `pipeline.ts` | Orchestrator: wählt Strategie, Auto-Eskalation bei Context-Overflow, Repair-Call |
| `strategies/` | `single-pass`, `long-text-chunked`, `vision-per-page`, `hybrid`, **`template-labelmap`** (neu, deterministisch) + Registry |
| `fusion.ts` | **OCR-Fusion** (W7): Tesseract-Wörter verifizieren extrahierte Werte (Zahlen numerisch) |
| `pdf.ts` | poppler: `pdftocairo` (Render→PNG), `pdftotext -layout`, `pdfinfo`; `pdfToLayoutText` |
| `pdf-split.ts` | `pdfunite` — Sub-PDFs (Segment-Scoping) |
| `ocr.ts` | Tesseract async (`Bun.spawn`, Parallelität 2) |
| `merger.ts`, `chunker.ts`, `confidence.ts`, `tokenizer.ts`, `guided-json.ts`, `extract-call.ts`, `defaults.ts` | Merge-Strategien, Chunking, Konfidenz, Token-Budget, erzwungenes JSON, Sampling-Defaults |

### 2b. Learning / Orchestrierung — `backend/src/extraction/` (~8.150 Zeilen, App-Layer)
| Bereich | Dateien | Rolle |
|---|---|---|
| Kern | `service.ts` (456), `learning/service.ts` (833) | `extract()` — Ingest → PreparedFiles → Pipeline → Entpacken → Triage/Regeln |
| Profile | `learning/projects.ts`, `learning/pipeline-adapter.ts`, `schema-builder.ts`, `validator.ts`, `profiles.ts` | Projekt-CRUD, Projekt→ExtractionSchema, Function-/Guided-JSON-Schema |
| Lern-Loop | `learning/examples.ts`, `guideline-generator.ts`, `prompt-builder.ts`, `similarity.ts`, `embeddings.ts`, `schema-infer.ts` | Few-Shot-Auswahl, gelernte Guidelines, Schema-Vorschlag |
| Qualität | `learning/rules.ts` (sum/lookup/**count**), `catalog.ts` (Wertelisten W6), `review.ts` (Triage), `eval.ts` (Champion/Challenger) | Prüfregeln, Kataloge, Review-Status, Eval |
| Batch | `learning/batch-runs.ts`, `batch-service.ts`, `page-store.ts`, `export-xlsx.ts` | Läufe, Worker-Pool, Seitenbild-Refs, XLSX/CSV |
| Posteingang | `inbox/` (classify, split, service, store) | Sammel-Scan → Dokumentgrenzen → getrennte Teile |
| Segmentierung | `segmentation/segmenter.ts`, `segment-extract.ts` | Seiten-Klassifikation → typisierte Segmente → gescopte Extraktion |
| Schnittstellen | `public-functions.ts`, `learning/webhook.ts`, `learning/transfer.ts` | Public-API-Funktionen, Webhook (HMAC), Profil-Export/Import |
| Betrieb | `model.ts` | **LLM-Bindung** (Adacor Qwen 3.5 Instruct 35B, ENV-tunebar) |
| Templates | `templates/grundsteuer-gmbx.ts` | Beispiel-Profil-Factory (born-digital, deterministisch) |

### 2c. Routen & Frontend
- `backend/src/routes/extraction-projects.ts` · `extraction-jobs.ts` · `extraction-inbox.ts` — alle unter **`/api/extraction`** gemountet, hinter `authMiddleware` auf `/*`.
- Public-API: `/api/public/v1` (API-Key-authentifiziert, eigenes Rate-Limit).
- Frontend: `pages/ExtractionProjectsPage.jsx` (Haupt-UI, groß), `ExtractionProfilesPage.jsx`, `components/InboxDropdown.jsx` (+ Segment-Review-Pane in der Projektseite).

### 2d. Persistenz
Postgres-Schema `extraction` (`db/schema/extraction.ts`), 7 Tabellen: `profiles`, `projects`,
`examples`, `batch_runs`, `batch_run_files`, `inbox_uploads`, `inbox_parts`. Migrations
**0015, 0020, 0021, 0024, 0027, 0029, 0030, 0032** (drizzle). **Wichtig:** Der zweite Worktree
(`demo/messe`, Railway) fährt dieselbe Logik **YAML-basiert** — die CRUD-Funktionen kapseln die
Storage-Divergenz. Für die Produktion ist genau diese Kapselung die Anpassungsstelle (§7).

---

## 3. Repo-Kontext: dieses Repo ≠ das Produkt

Dieses `agent-platform` ist das **Experiment-/Piloten-Repo**. Es ist vom Produktiv-Workplace vor
~6 Monaten divergiert und dient dazu, Kunden-Experimente schnell zu fahren und daraus Konzepte (und
jetzt: erprobten Code) fürs Produkt-Team abzuleiten. Konsequenz für die Übergabe:

- **Portierbar als Fachlogik:** Engine (`services/extraction/`) und der größte Teil des Learning-Layers
  sind self-contained und hängen nur an schmalen Schnittstellen (LLM, Konverter, Storage, Poppler).
- **Nicht 1:1 übernehmbar:** alles, was an *diese* Instanz gebunden ist — Auth, DB-Zugriff, Provider-
  Registry, Storage-Namespace, Frontend-Design-System. Das sind die Nähte in §7.
- Der Code ist **battle-tested** (echte Kundenpiloten, gemessene Regressionen — §9), aber gegen *dieses*
  Repos Infrastruktur. Die Aufgabe des Dev-Teams ist das **Einpassen an die Produkt-Infrastruktur**,
  nicht die Neuentwicklung der Fachlogik.

---

## 4. Datenflüsse

### 4a. Einzel-Extraktion (`extract()`, das Herz)
```
Datei ─► ingest() ──────────────────────────────────────────────┐
          • Bild → base64 ; Text → raw                           │
          • PDF  → rawBuffer (+ Markitdown-Text, best-effort)    │
          • template-labelmap: Markitdown SKIP, Text via pdftotext│
                                                                 ▼
   PreparedFile[] ─► runPipeline(schema) ─► Strategie.run() ─► StrategyResult
                        │ (Strategie aus project.extraction.strategy)   │
                        │ Auto-Eskalation single→chunked bei Overflow   │
                        ▼                                               ▼
   Entpacken (felder.* → flach, Listen dedupe) ◄── extracted{felder,listen}
                        │
                        ├─ OCR-Fusion-Befunde (W7)
                        ├─ Kataloge (W6) + Prüfregeln (W5: sum/lookup/count)
                        ├─ Review-Triage (Konfidenz-Schwelle + Befunde → auto_ok | needs_review)
                        ▼
   Ergebnis {data, fieldConfidences, boxes, pageImages, validations, segments, audit}
```

### 4b. Batch
`POST /projects/:id/batches` (multipart, Limits) → `createBatchRun` (Zeilen anlegen) →
`runBatchExtraction` (Worker-Pool `EXTRACTION_BATCH_CONCURRENCY`, je Datei `extract()`) →
`batch_run_files` (data/boxes/segments/reviewStatus/validations) → `notifyWebhook`. Watchdog
`recoverStaleRuns()` beim Start (Crash/Deploy → verwaiste Läufe auf `failed`).

### 4c. Posteingang (W4) & Segmentierung (W10) — zwei bewusst getrennte Ebenen
- **Posteingang:** Sammel-Scan → je Seitenübergang ein Vision-Urteil „Schnitt?" → getrennte
  `InboxPart`s, jede eigenständig klassifiziert & in ein Profil geroutet. Frage: *verschiedene Vorgänge?*
- **Segmentierung:** EIN Vorgang → jede Seite gegen Prosa-Typbeschreibungen klassifiziert (guided_json,
  150 dpi) → deterministische Grenzbildung → je `extract`-Segment gescopte Extraktion über die
  bestehende Pipeline (Sub-PDF + Sub-Schema). Frage: *welche Rolle haben die Seiten innerhalb des Vorgangs?*

### 4d. Lern-Loop
Prüfer korrigiert im Review → `TrainingExample` (mit Embedding) → bei der nächsten Extraktion
ähnlichkeitsbasierte Few-Shot-Auswahl + periodisch regenerierte `guidelines`. Stabile
`instructions` (hand-gepflegt) werden davon nie überschrieben.

---

## 5. Kernkonzepte & Entscheidungen (das „Warum")

1. **Strategie-Pattern statt Monolith.** Eine Datei = eine Extraktionsart; Registry + Orchestrator.
   Erweiterbar ohne die anderen anzufassen (so kam `template-labelmap` dazu). Kein Truncation je erlaubt
   — sprengt ein Doc den Kontext, wirft die Strategie `ContextOverflowError` und der Orchestrator
   eskaliert. Merge-Strategien pro Feld.
2. **Vertrauen ist verankert, nicht behauptet (W7).** OCR-Fusion vergleicht extrahierte Werte mit den
   Tesseract-Wörtern (Zahlen numerisch, DE-Formate). „verified" → Konfidenz ≥0.95 ohne LLM-Call;
   „zahlenartig & unbelegt" → unter die Review-Schwelle. Bewusst kein hartes 0, weil Handschrift von
   OCR nicht gelesen wird (Ehinger-Fall: durchgestrichene Menge → korrigierter Wert bleibt, geht mit
   Begründung in die Prüfung). Sampling `temperature:0`. Serverseitig **erzwungenes JSON**
   (`response_format: json_schema`) mit eigenem `[typ,"null"]`-Schema — verhindert Halluzination
   nicht-sichtbarer Felder.
3. **Stille Fehler sind Befunde (W7).** Timeout/unlesbare Antwort/gekappte Seiten → `processingIssues`
   (severity error erzwingt Review) statt `console.warn`. Grundhaltung: Unsicherheit wird vorgelegt und
   begründet, nie verschluckt.
4. **Ein Dokument-Konverter (W8).** `services/documentConverter.ts` — EIN Fetch, EINE SSRF-Allowlist,
   EIN Timeout, Routing born-digital/Office→Docling, Scan→Markitdown/Vision. Docling ist verdrahtet,
   aktiv sobald `DOCLING_API_URL` gesetzt ist; jeder Docling-Fehler fällt einzeln auf Markitdown zurück.
5. **Kosten & Robustheit (W9).** DPI gemessen (200 bleibt Default; 150 verliert Referenznummern),
   echte Request-Timeouts (AbortSignal), Tesseract async.
6. **Segmentierung (W10)** — Reducto-Ansatz auf unserem Stack: >95 % Seitentyp-Accuracy, 0 Fehlalarme.
7. **Deterministischer Pfad (neu, G1–G4).** Für born-digital Formulare mit stabiler Label→Wert-Struktur
   (z.B. Grundsteuerbescheide) eine **nicht-LLM Strategie `template-labelmap`**: `pdftotext -layout` +
   label-verankertes Parsen (robust gegen verschobene Abschnittsnummern; wiederholbare Blöcke = list-
   Felder). `llmCalls: 0`, Konfidenz 1.0 bei Label-Beleg. Der LLM läuft nur EINMAL (Schema-Inferenz) +
   für Anomalien im Lern-Loop — nicht pro Dokument. Gemessen ~1000× schneller als eine Regex-Lösung.
   Feld-`aliases` fangen mehrzeilige Labels & Label-Drift. **G3:** `count`-Prüfregel (Listenlänge ==
   Zielfeld) fängt den einen Fall, den die deterministische Extraktion selbst nicht sieht — verpasste/
   erfundene Instanz.
8. **LLM-Bindung ans Feature, nicht an die Session (`model.ts`).** Extraktion bindet Adacor Qwen 3.5
   Instruct 35B fest (ENV-tunebar, projekteigenes Modell schlägt das). Grund: Qualität und Betrieb
   dürfen nicht davon abhängen, welches Chat-Modell der Nutzer gerade eingestellt hat.

---

## 6. ENV-Variablen

| Variable | Default | Zweck |
|---|---|---|
| `EXTRACTION_LLM_PROVIDER` / `EXTRACTION_LLM_MODEL` | `adacor` / `qwen3-5-a3b-35b-256k` | Feste Modell-Bindung der Extraktion |
| `MARKITDOWN_API_URL` | Adacor `documentMarkdown` | Konverter (Markdown-Text) |
| `DOCLING_API_URL` | — (aus) | Docling-Konverter; solange leer, immer Markitdown |
| `EXTRACTION_GUIDED_JSON` | an | Kill-Switch serverseitig erzwungenes JSON |
| `EXTRACTION_VISION_DPI` | 200 | Render-DPI Vision (150 gemessen schlechter) |
| `EXTRACTION_BATCH_CONCURRENCY` | (Pool) | Parallele Dateien je Batch |
| `EXTRACTION_SIMILARITY_FEWSHOT` | — | Ähnlichkeits-Few-Shot an/aus |
| `EXTRACTION_EMBED_TIMEOUT_MS` / `EXTRACTION_EVAL_CAP` / `EXTRACTION_EVAL_CONCURRENCY` | — | Embeddings/Eval-Tuning |
| `EXTRACTION_PUBLIC_API` | — | Public-API-Funktionen an/aus |
| `INBOX_SPLIT_CONCURRENCY` / `INBOX_MAX_PAGES` / `INBOX_AUTO_ROUTE_THRESHOLD` | 2 / — / — | Posteingang |
| `WEBHOOK_ALLOW_INTERNAL` | aus | SSRF-Allowlist-Ausnahme (nur Dev) |
| `ADACOR_AI_API_KEY` | — | Auth für Adacor LLM + Konverter |

**System-Dependencies (müssen im Production-Image sein):** `poppler-utils` (`pdftocairo`, `pdftotext`,
`pdfinfo`, `pdfunite`) und `tesseract-ocr` (inkl. `deu`-Sprachdaten). Ohne poppler fällt Vision/
`template-labelmap` aus; ohne Tesseract entfällt die OCR-Fusion (Extraktion läuft, aber ohne
Zahlen-Verifikation).

---

## 7. Die Integrationsnähte (**der wichtigste Abschnitt**)

Was das Dev-Team anfassen muss, um den Code ins Produkt einzupassen — von „nur verdrahten" bis
„echte Anpassung":

| # | Naht | Hier im Repo | Anpassung im Produkt |
|---|---|---|---|
| 1 | **LLM-Provider** | `resolveModel(provider,model)` + `model.ts` | An die Provider-/Modell-Registry des Produkts binden. Schnittstelle ist schmal: ein OpenAI-kompatibler Adapter mit `chat()` (Function-Calling + Vision + `response_format`). **Modell muss Function-Calling UND Vision UND guided JSON können.** |
| 2 | **Dokument-Konverter** | `documentConverter.ts` (Markitdown/Docling HTTP) | Auf den Konverter-Dienst des Produkts zeigen (gleicher Vertrag: PUT multipart → Text). SSRF-Allowlist übernehmen. |
| 3 | **Persistenz** | `learning/projects.ts`, `batch-runs.ts`, `page-store.ts`, `inbox/store.ts` (Postgres `extraction`-Schema, Migrations 0015–0032) | An das ORM/Migrations-Regime des Produkts anpassen. CRUD ist bereits gekapselt (der Railway-Worktree beweist YAML als Alternative) — die Funktions-Signaturen sind die stabile Grenze. |
| 4 | **Auth** | `authMiddleware` auf `/api/extraction/*` (Cookie-Session) | An das Auth-/RBAC-Modell des Produkts hängen. **Kritisch (Code-Review P0):** die Router NIEMALS ohne Auth mounten. Wenn Projekte user-/mandantengebunden sein sollen, hier scopen (heute global sichtbar). |
| 5 | **Seiten-/Bild-Storage** | `page-store.ts` (S3-Keys für gerenderte Seiten) | An den Storage des Produkts binden (S3-Namespace ist pro Instanz eindeutig zu halten). Für den Segment-Review-Lern-Loop wird zusätzlich das **Originaldokument** am Lauf gebraucht (heute offen, §10). |
| 6 | **Public-API + Webhook** | `public-functions.ts`, `webhook.ts` (HMAC-SHA256, SSRF-Allowlist) | An das API-Key-/Webhook-Framework des Produkts. |
| 7 | **Frontend** | `ExtractionProjectsPage.jsx` u.a. (Inline-Styles/`theme.js`) | Ans Design-System des Produkts überführen. Fachlogik/Datenflüsse der UI sind übernehmbar, das Styling nicht. |
| 8 | **Rate-Limit / Betrieb** | `middleware/rateLimit.ts` (global `/api/*`), `recoverStaleRuns()` | An die Betriebs-Konventionen des Produkts. (Hinweis: rein IP-basiertes Limit ist für daten-schwere UIs zu knopf — im Produkt ggf. pro Session/User schlüsseln.) |

**Empfohlene Reihenfolge:** erst Nähte 1–4 (LLM, Konverter, DB, Auth) — dann läuft die Engine im Produkt
—, dann 5–8. Die Engine (`services/extraction/`) selbst sollte **nahezu unverändert** übernommen werden;
die Anpassungen konzentrieren sich auf den Learning-Layer-Rand und die Routen.

---

## 8. Sicherheit

Vollständiger Code-Review am 2026-08-08 (`docs/code-review-document-processing-2026-08-08.md`), alle
Befunde behoben: P0 Auth-Lücke (Router ohne Auth) ✅, P1 SSRF-Webhook ✅, P1 Upload-Limits/RAM ✅,
P2 tmp-Leak ✅, P2 Watchdog ✅, P2 Triage-Loch bei Listen-Positionen ✅, P3 crypto-IDs ✅. **Beim
Einpassen unbedingt erhalten:** Auth auf allen Routen, SSRF-Allowlist im Konverter UND Webhook,
Upload-Limits, `crypto.randomUUID()` für Temp-Pfade.

---

## 9. Reifegrad / battle-tested (Messungen)

- **Ehinger (Elektrogroßhandel, Lieferscheine, Vision+Handschrift):** 12 gelabelte Belege / 39 Positionen
  — Positionsanzahl 12/12, Recall 39/39, Mengen/Einheiten 100 %, 0 erfundene Positionen; Triage legt
  genau die Handschrift-/Stempel-Fälle vor. `tools/ehinger-pilot/`.
- **Grundsteuer-GMBX (born-digital, deterministisch):** 341 echte Bescheide — 341/341 Kernfelder,
  0/341 Owner-Anzahl-Abweichung, ~9–33 ms/Bescheid (Live-Pfad), `count`-Regel greift.
  `docs/grundsteuer-gmbx-extraktion-2026-09-03.md`.
- **Segmentierung:** 18 Dokumente / 179 Seiten — 95,5 % Seitentyp-Accuracy, Grenzen P92/R95, 0 Fehlalarme.
- **Tests:** ~260 Unit-Tests über die Extraktions-Strecke (`bun test src/extraction src/services/extraction`).

---

## 10. Bekannte Grenzen / offene Punkte

- **Docling** ist verdrahtet, aber der Adacor-Endpunkt existiert noch nicht (`DOCLING_API_URL` leer →
  Markitdown). Sobald da, born-digital/Tabellen-Pfad testen.
- **Segment-Review-Lern-Loop** braucht das **Originaldokument am Lauf gespeichert** (heute nur die
  gerenderten 150-dpi-Seiten) — Voraussetzung für Grenz-/Typkorrektur → Re-Extraktion. Speicher-
  Entscheidung (S3/DB/Aufbewahrung) ist die Vorbedingung.
- **Eval misst die Regel-/Textstrecke**, nicht die Vision-Strecke (ehrlich ausgewiesen); echte Vision-
  Eval bräuchte gespeicherte Seitenbilder je Trainingsbeispiel.
- **GMBX:** Label-Drift über Gemeinden/Bundesländer/FA-Versionen nur gegen EINE Gemeinde gehärtet (G5
  offen); Eigentümer-Ausgabeform (Spalten vs. Zeilen) mit Kunde final zu klären.
- Barcode-Anker im Posteingang bewusst nicht umgesetzt (neue System-Dependency).

---

## 11. Doku-Landkarte (Detail-Tiefe, chronologisch)

| Dokument | Inhalt |
|---|---|
| `extraction-pipeline-plan-2026-03-13.md`, `extraction-pipeline-2026-03-13.md`, `learning-extraction-2026-03-13.md` | Ursprung: Pipeline-Plan + Lern-Loop |
| `extraction-pipeline-2026-05-19.md` | Pipeline-Ausbau |
| `extraction-projects-heavy-pipeline-2026-06-04.md` | Projekte-Feature + Heavy-Pipeline |
| `extraktion-posteingang-2026-07-29.md` | Posteingang (W4) |
| `document-processing-standortbestimmung-2026-08-08.md` | **Marktvergleich + W7/W8/W9 (Vertrauen, Konverter, Kosten)** — Kern-Lektüre |
| `document-processing-segmentierung-konzept-2026-08-08.md` | Segmentierung (W10) inkl. Messungen |
| `code-review-document-processing-2026-08-08.md` | Vollständiger Security-/Code-Review |
| `grundsteuer-gmbx-extraktion-2026-09-03.md` | **Deterministischer Pfad (G1–G4) + count-Regel (G3) + Konverter-Umgehung** |
| *dieses Dokument* | Übergabe-Landkarte |

---

## 12. Nächster Schritt mit Simon

1. Repo-Zugang + dieses Dokument.
2. Gemeinsamer Walkthrough entlang §4 (Datenflüsse) und §7 (Nähte) am laufenden lokalen System
   (Backend `:3001`, Frontend `:5173`, ein Batch über ein Beispielprofil).
3. Simon entscheidet, welche Nähte das Dev-Team in welcher Reihenfolge anpasst; die Engine geht möglichst
   unverändert mit.
