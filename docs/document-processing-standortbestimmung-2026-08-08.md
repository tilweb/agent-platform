# Document Processing: Standortbestimmung + Welle 7 (Vertrauen & Grounding)

**Datum:** 2026-08-08
**Anlass:** Anspruch „bestes Document Processing Tool" — sehr kritische Prüfung des
Extraktionsprozesses gegen den Stand der Technik (Mistral Document AI, Azure Document Intelligence,
AWS/Google, Docling), vor dem geplanten Konverter-Wechsel Markitdown → Docling.
**Ergebnis:** Ehrliche Lückenanalyse (Teil A), umgesetzte Qualitäts-Welle W7 (Teil B, gemessen),
Roadmap W8/W9 (Teil C).

---

## Teil A — Wo wir stehen (ehrlich)

### Der Markt (recherchiert 2026-08-08)

| Anbieter | Preis / 1.000 Seiten | Stärken | Schwächen aus unserer Sicht |
|---|---|---|---|
| **Mistral OCR 4 / Document AI** (6/2026) | $4 (Batch $2) / $5 | **Wort-Level-Konfidenz aus Pixeln**, BBoxes, Block-Klassifikation, 170 Sprachen; OmniDocBench 93,07; 72 % Win-Rate in Blind-Evals; Self-Host-Container | Kein Lern-Loop, statische JSON-Schemata, Cloud oder eigener GPU-Container |
| **Azure Document Intelligence** | Custom $30 (Commit $18); Query Fields $10 | Training auf eigenen Belegen, EU Data Boundary | Teuerste Option; Training je Dokumenttyp; keine DE-Souveränität |
| **AWS Textract** | Forms+Tables $65–70; Invoices ~$10 | AWS-Integration | Englisch-zentriert, generische Schemata |
| **Google Document AI** | Form Parser $30; OCR $1,50 | Vortrainierte Prozessoren | Cloud, generisch |
| **Docling (IBM, OSS)** | eigene Infra | TableFormer TEDS 0,97 (FinTabNet); beste OSS-Tabellenstruktur; granite-docling-258M | **Schwach auf Scans/Handschrift** (Default EasyOCR, ~30 s/Seite CPU); Markdown-first |
| **Markitdown (heute, Adacor-API)** | inklusive | schnell, viele Formate | flache Tabellen; **verstümmelt gescannte PDFs** (dokumentiert: Sani-Rezepte, CHANGELOG) |

**Ehrliches Fazit:** Auf rohen OCR-Benchmarks schlagen wir Mistral OCR 4 nicht — dagegen anzutreten
wäre vermessen. Unser echter, verteidigbarer Vorsprung ist der **geschlossene Kreis**: Profile +
Lern-Loop + Review-UI mit Fundstellen + deterministische Prüfungen (Kataloge, Regeln, Triage) +
API/Webhook — auf **souveräner DE-Infrastruktur** (Adacor), mit gemessen exzellenter
Handschrift-Semantik (durchgestrichene Menge → korrigierter Wert), die keiner der Generalisten
mitbringt. Die messbare Lücke zum Stand der Technik lag bei **pixel-verankertem Vertrauen**
(Mistral: Wort-Konfidenz aus dem OCR-Kopf; wir: LLM-Selbsteinschätzung) und bei der
**Tabellenstruktur im Textpfad** (Docling schließt das in W8).

### Die kritischen Befunde in unserer Pipeline (Code-Kartierung 2026-08-08)

Qualität/Vertrauen:

1. **Konfidenz war teils fiktiv:** single-pass vergab pauschal 1.0; der Hybrid-Vision-Override
   pauschal 0.85; Einseiter landeten konstruktionsbedingt bei 0.7 und dann in einer
   LLM-Selbstbewertung — notorisch unkalibriert. Die gesamte Review-Triage stand auf diesem
   Fundament. *(→ W7: OCR-Fusion)*
2. **Tesseract-Text wurde weggeworfen:** OCR lief ohnehin über alle Seiten (für die
   Fundstellen-Rahmen), trug aber nichts zur Verifikation bei. *(→ W7: OCR-Fusion)*
3. **Positionen hatten keine Fundstellen:** `computeOcrBoxes` übersprang Array-Gruppen — das
   Vollbild-Review zeigte für die Positionstabelle keine Boxen. *(→ W7)*
4. **Temperatur/max_tokens ungesetzt:** Extraktion lief auf der Server-Default-Temperatur; kein
   Limit gegen Runaway-Antworten. *(→ W7)*
5. **Stille Fehler:** Seiten-Timeout → leere Seite ohne Befund; Chunk-Parse-Fehler → stiller
   Datenverlust; Seiten über `max_pages` still verworfen. *(→ W7)*
6. **Hybrid (Default neuer Profile) war konzeptionell defekt:** Vision-Pass ohne `model_override`
   (**brach die Modellbindung**), immer alle Seiten, Low-Confidence-Menge enthielt jedes nicht
   gefundene optionale Feld (Fallback feuerte fast immer), keine Boxen/Seitenbilder. *(→ W7)*
7. **Eval misst die falsche Pipeline:** Champion/Challenger re-extrahiert text-basiert single-pass
   aus `document_text` — bei Vision-Profilen ein anderer Pfad als die Produktion. *(→ W9, offen)*
8. **Freitext-JSON ohne Schema-Erzwingung** im Vision-Pfad (Function-Calling hängt auf dem
   vLLM-Serving mit Bildern). *(→ W7: guided decoding)*

Kosten/Performance:

9. 95 % der Token sind Bild (≈ 3.720/Seite @200 dpi); DPI hart kodiert. *(→ W9: Messung 150 dpi)*
10. Der Konfidenz-LLM-Call feuerte praktisch immer. *(→ W7: Fusion ersetzt ihn im Normalfall)*
11. **Tesseract lief `spawnSync`** — blockiert den Bun-Event-Loop je Seite. *(→ W9)*
12. `withTimeoutRetry` bricht den HTTP-Request nicht ab; Text-Calls ohne Client-Timeout. *(→ W9)*
13. Totes Steuerwerk: `estimateCost`/`SYNC_THRESHOLD_TOKENS`/`CONTEXT_USAGE_THRESHOLD` ohne
    Konsumenten — keine Vorab-Kostenschätzung im Betrieb. *(dokumentiert, bewusst offen)*

Konverter-Landschaft:

14. Markitdown ist der Adacor-HTTP-Endpunkt; der Fetch ist **9× kopiert** ohne gemeinsamen Wrapper,
    SSRF-Allowlist nur an 2 von 9 Stellen. *(→ W8: ein Wrapper)*
15. Docling ist stark, wo Markitdown schwach ist (Tabellenstruktur, born-digital), und schwach, wo
    unser Vision-Pfad stark ist (Scans, Handschrift). Der Wechsel ist ein **Ersatz im Textpfad**,
    kein Ersatz der Vision-Strategie. *(→ W8)*

---

## Teil B — Welle 7: Vertrauen & Grounding (umgesetzt 2026-08-08)

### 1. Deterministisches Sampling

Alle Extraktions-Calls (Strategien, Konfidenz, Repair, Posteingang-Klassifikation, Split-Urteil,
Guideline-Generierung, Schema-Inferenz) laufen jetzt mit `temperature: 0` und `max_tokens: 8192`
(`EXTRACTION_SAMPLING` in `services/extraction/extract-call.ts`). Der Chat-Pfad bleibt unberührt.

### 2. Serverseitig erzwungenes JSON (guided decoding)

Am Adacor-vLLM verifiziert (Protokoll unten): `response_format: json_schema` wird **hart
durchgesetzt** — auch gegen einen Prompt, der ausdrücklich Prosa verlangt, und **auch mit Bild**
(~2 s/Seite, kein Hänger; das nackte vLLM-`guided_json`-Feld wird dagegen still ignoriert).
Vision-Pfad jetzt: Versuch 1 mit erzwungenem Schema, Versuch 2 als Freitext-JSON (deckt zugleich
transiente Endpoint-Hänger ab). Kill-Switch: `EXTRACTION_GUIDED_JSON=0`.

Wichtig: eigenes Schema (`buildGuidedJsonSchema`) mit `[typ, "null"]` je Feld — das
Function-Calling-Schema hätte beim Guided Decode Nicht-null-Werte erzwungen und damit
Halluzinationen für nicht sichtbare Felder provoziert. Struktur erzwungen
(`required` alle Schlüssel, `additionalProperties: false`), Inhalt frei.

Messprotokoll der Probe (Adacor `qwen3-5-a3b-35b-256k`):

| Test | Ergebnis |
|---|---|
| temperature 0 + max_tokens (Text) | 200, korrektes JSON, 1,3 s |
| `guided_json` (vLLM-Feld) | 200, aber Markdown-Fences → **still ignoriert** |
| `response_format: json_schema` (Text) | 200, nacktes JSON, 1,1 s |
| Erzwingungs-Beweis: Prompt verlangt Prosa | **JSON kommt trotzdem** — Schema greift |
| Vision (150-dpi-Scan) + `response_format` | 200, valides JSON, 2,0 s — **kein Hänger** |
| Vision ohne `response_format` (Kontrolle) | Markdown-Prosa ohne `{}` — Freitext-Parse wäre leer |

### 3. OCR-Fusion (`services/extraction/fusion.ts`)

Die Tesseract-Wörter (bisher nur Fundstellen-Rahmen) verifizieren jetzt die Extraktion:

- **`verified`** — Wert wörtlich auf der Seite belegt → Konfidenz ≥ 0.95, **kein LLM-Konfidenz-Call**
  mehr für dieses Feld. Zahl-Zellen werden numerisch verglichen (auf dem Papier „5,00", Modell
  liefert 5) inkl. DE-Formaten („1.234,56").
- **`not_found_numeric`** — zahlenartiger Wert ohne OCR-Beleg → Konfidenz ≤ 0.4 (unter der
  Review-Schwelle) + Befund „Wert … ist im OCR-Text nicht belegt". Bewusst kein hartes 0:
  **Handschrift liest Tesseract nicht** — der handschriftlich korrigierte Wert bleibt stehen und
  geht mit Begründung in die Prüfung. Genau das richtige Verhalten für den Ehinger-Fall.
- **`not_found_text`** — Freitext ohne Beleg → keine harte Aussage (OCR-Rauschen), LLM darf urteilen.
- **Listen-Zeilen bekommen Fundstellen:** je Zeile verankert der markanteste **ziffernhaltige**
  Zellwert (Artikelnummer) die Zeilen-Bande; kurze Werte (Mengen) werden nur innerhalb der Bande
  gesucht. Banden werden durch die Anker der Nachbarzeilen begrenzt; identische Anker-Werte (zwei
  Positionen mit derselben Artikelnummer, Fall 2921) bekommen der Reihe nach das 1., 2., …
  Vorkommen.

Zwei Fehlversuche auf dem Weg, festgehalten weil lehrreich: (a) String-Vergleich für Mengen
scheiterte am gedruckten „5,00" vs. extrahiertem `5` → numerischer Vergleich; (b) „längster Wert als
Anker" wählte die Beschreibung, deren Markenwörter („PHOENIX") sich über Zeilen wiederholen — der
Anker von Zeile 2 griff Wörter aus Zeile 1 und die Banden zerschnitten sich → Anker müssen
ziffernhaltig und eindeutig sein.

### 4. Stille Fehler sind jetzt Befunde

Übersprungene Seite (Timeout), unlesbare Modellantwort (Seite/Chunk), gekappte Seiten
(`max_pages`) → `processingIssues` mit `severity: error` am Ergebnis → Befund in der UI +
erzwungenes „Zu prüfen". Vorher: `console.warn`, Ergebnis sah vollständig aus.

### 5. Hybrid repariert

- **Scan-Router:** PDF ohne brauchbaren Textlayer (< 200 Zeichen) → direkt die volle
  vision-per-page-Strategie (inkl. Fusion, Boxen, Seitenbilder) statt Text-Pass auf Müll-Text +
  Vision-Pass ohne Boxen. Gemessen am Scan: 3 LLM-Calls statt vorher Text-Pass + alle Seiten + Konfidenz.
- **Modellbindung:** der Vision-Fallback lief auf dem aktiven **Session-Modell** — jetzt
  `model_override` wie überall.
- Fallback erst ab 2 offenen Feldern (die bisher ungenutzte Konstante greift jetzt);
  Pauschal-Konfidenz 0.85 ersetzt durch 0.7 + hartes Fusion-Urteil; Boxen + Seitenbilder werden
  geliefert; übersprungene Seiten → Befunde.

### 6. Messung (Ehinger-Regression, alle 24 Belege neu gelaufen)

**Qualität unverändert auf Maximum** (12 gelabelte Belege, 39 Positionen): Lieferscheinnummer,
Lieferdatum, Positionsanzahl 12/12 · Recall 39/39 · Mengen und Einheiten 100 % · 0 erfundene
Positionen · Referenznummer 10/12 (unverändert; s. u.) · Klassifikation 24/24. Laufzeit **17,7 s je
Beleg** (vorher 20,3 — guided JSON antwortet knapper, ein Konfidenz-Call entfällt meist).

**Review-Triage: auto_ok 18 · zu prüfen 5** (vorher 21/2). Die 5 sind genau die richtigen:

| Beleg | Grund (Befund am Ergebnis) |
|---|---|
| 2923 | Handschrift: durchgestrichene „6" — Tesseract kann sie nicht belegen |
| 1904 | Handschrift: korrigierte Menge Zeile 18 |
| 2922 | roter ERLEDIGT-Stempel verdeckt die Lieferanten-Artikelnummer |
| 1907 | fremde Einheit „VPE" (Werteliste) + 2 unbelegte Mengen |
| 2913 | Listen-Konfidenz 0.3 (LLM-Urteil) |

Beide Handschrift-Belege — vorher stille auto_oks — werden jetzt mit Begründung vorgelegt. Auf dem
Weg dorthin eine gemessene Korrektur: **Null-Mengen** („Rückstand: 0") standen zunächst als
„unbelegt" im Befund — auf dem Papier ist eine Null aber meist eine leere Zelle. Nach der Ausnahme
(0 → nicht prüfbar) fiel die Triage von 15/8 auf 18/5, ohne einen echten Fall zu verlieren.

**Grenze, ehrlich benannt:** Die zwei bekannten Referenznummer-Fehler (1898/2921: Modell liefert
`null`, Nummer steht aber auf dem Beleg) bleiben auto_ok. Die Fusion prüft *gelieferte* Werte —
„Wert existiert auf dem Papier, Modell hat ihn nicht geliefert" kann sie prinzipiell nicht erkennen.
Der Mechanismus dafür ist das **Pflichtfeld** (`referenznummer` als Pflicht markieren → beide
gefangen, gemessen in der Analyse vom 2026-08-04). Das ist kein Trick, sondern die fachliche
Aussage „diese Nummer steht auf jedem Beleg" — Empfehlung an Ehinger unverändert.

**Token je Beleg** (gleiche Stichprobe wie 2026-08-07): 1898: 9.167 → 8.796 · 1899: 8.622 → 8.447 ·
1900: 20.806 → 20.545 · 2915: 15.450 → 15.440. Ersparnis 0–4 % (ein Konfidenz-Call entfällt, wo die
Fusion alles entscheidet) — der Gewinn von W7 ist Vertrauen, nicht Kosten.

Rohdaten: `tools/ehinger-pilot/results/run.json` (neu), `run-vor-w7.json` (Vergleichsstand),
`tokens.json` / `tokens-vor-w7.json`.

---

## Teil C — Roadmap W8/W9

### W8 — Konverter: ein Wrapper, dann Docling — **umgesetzt 2026-08-08**

1. **Zentraler `services/documentConverter.ts`** (ein Fetch, EINE SSRF-Allowlist, ein Timeout,
   zentrale MIME-Erkennung, JSON-oder-Text-Antwortbehandlung). Alle **9** Callsites umgestellt
   (attachments, multiFileImporter, indexer, Vertragsmanagement, extraction/service,
   learning/service, Profil-Generierung, Gmail-Attachment, Google-Drive-Fetch); die kopierten
   Fetches, drei private URL-Konstanten-Paare und zwei doppelte Allowlist-Implementierungen sind
   weg. Live geprüft: Scan konvertiert unverändert über den Adacor-Endpunkt; eine Allowlist-fremde
   URL wird **jetzt an jeder Stelle** abgewiesen (vorher nur an 2 von 9). Der VM- und der
   Profil-Generierungs-Pfad verlieren nebenbei ihren Temp-Datei-Umweg.
2. **Routing implementiert** (aktiv, sobald `DOCLING_API_URL` gesetzt ist): Office/HTML/CSV/RTF →
   Docling; PDF **mit** Textlayer (pdftotext-Stichprobe, Seite 1, > 50 Zeichen) → Docling; Scans →
   Markitdown/Vision-Pfad (Docling-OCR/EasyOCR bewusst nicht genutzt). Jeder Docling-Fehler fällt
   einzeln auf Markitdown zurück — der Wechsel kann keine bestehende Strecke brechen.
   **Vertrag an Adacor** (dokumentiert in `.env.example`): wie documentMarkdown — PUT,
   multipart-Feld `document`, Bearer `ADACOR_AI_API_KEY`, Antwort Markdown.
3. **Benchmark-Werkzeug** `tools/konverter-benchmark/run.ts` (Dauer, Zeichen, Tabellenzeilen,
   Überschriften je Backend). Der Docling-Endpunkt existiert noch nicht — gemessen ist die
   **Markitdown-Baseline**, die den Wechsel bereits begründet: die born-digitale PM-Spezifikation
   (PDF) kommt mit **0 Tabellenzeilen und 0 Überschriften** zurück (1.682 Zeichen Fließtext);
   XLSX liefert Pipes, aber ohne Struktur-Reihenfolge (Sheets werden heuristisch umsortiert).
   Sobald Adacor den Endpunkt stellt, liefert derselbe Aufruf den direkten Vergleich
   (`results/vergleich-*-baseline.md`).

### W9 — Kosten & Robustheit

1. DPI-Messung 150 vs. 200 auf der Ehinger-Ground-Truth (−24 % Token je Beleg, wenn die Qualität hält).
2. Tesseract async (`Bun.spawn`), AbortSignal-Timeouts für alle LLM-Calls.
3. Eval-Alignment: Champion/Challenger optional auf der Produktionsstrategie messen (Befund 7).
4. Optional: Barcode-Dekodierung als deterministischer Anker (neue System-Dependency, nur nach
   Rückfrage).
