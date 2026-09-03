# Grundsteuer-Messbescheide (GMBX) — Massen-Extraktion in die Plattform

**Datum:** 2026-09-03
**Anlass:** Kundenanfrage — automatische Verarbeitung von Grundsteuermessbescheiden in grossem
Umfang fuer kommunale Verwaltungen (eine Gemeinde: schnell **25.000 Bescheide**). Ziel: alle Werte
als Spalten in eine **CSV/Excel, eine Zeile je Bescheid**. Kundenkriterium: **Extraktions-
geschwindigkeit bei hoher Qualitaet**.
**Ist-Loesung des Kunden:** ausschliesslich **regex-basiert**, **~12 s je Bescheid**, Bau und Pflege
sehr aufwaendig (alles haendisch, auch die Regex).
**Weichenstellung (mit User abgestimmt, 2026-09-03):** Eingabe bleibt **PDF** (keine Quell-XML
verfuegbar); Loesung wird als **Extraktions-Profil in der Plattform** gebaut.
**Beispieldaten:** `docs/Grundsteuer/` — 13 ZIPs (2 vorab entpackt); insgesamt **341 echte Bescheide**
ausgewertet.

---

## 1 — Der entscheidende Befund: born-digital, nicht Scan

Die Bescheide sind **keine Scans**. Es sind **born-digital PDFs**, erzeugt von `jsPDF 2.5.1`, laut
Kopfzeile jedes Dokuments:

> „Grundsteuermessbetraege nach GrStRefG von 2019 (GMBX) — Dieses PDF-Dokument wurde **automatisiert
> aus uebermittelten Grundsteuer-XML-Daten erzeugt**. Das Verfahren ELSTER ist nicht verantwortlich
> fuer Inhalt und Aufbau der bereitgestellten XML-Daten."

Konsequenz: **sauberer Textlayer**, strikte **Label→Wert-Struktur** (rechtsbuendige Label-Spalte,
Wert-Spalte). Es braucht **weder OCR noch Vision noch einen LLM-Call pro Dokument**. Das verlagert die
Aufgabe von „Dokument verstehen" zu „bekanntes Formular deterministisch auslesen".

`pdfinfo` einer Beispieldatei: `Producer: jsPDF 2.5.1`, 2 Seiten A4, ~5 KB, kein eingebettetes XML
(die XML-Quelle steckt **nicht** in der PDF — nur ihr gerendertes Abbild).

---

## 2 — Datenbestand und Feld-Universum (341 Bescheide)

Ein PDF = **ein Bescheid** (ein Aktenzeichen, 1–2 Seiten). Alle 341 stammen aus AGS `06435012`
(Gemeinde in Hessen; Schluechtern/Gruendau-Raum), Finanzamt 2619.

### Abschnittsstruktur (durchnummeriert, aber die Nummern verschieben sich)

| Abschnitt | Vorkommen | Bemerkung |
|---|---|---|
| (Kopf, ohne Nummer) | 341/341 | Stammdaten des Bescheids |
| `N – Zerlegungsbescheid` | 20/341 | nur bei Zerlegung; **schiebt alle Folgenummern um +1** |
| `N – Lage der wirtschaftlichen Einheit` | 341/341 | Ort/Strasse/Gemarkung |
| `N – Eigentuemer` + `N.1 – Name E` | **489** Blöcke / 341 | **wiederholbar**, 1–8 je Bescheid |

Genau diese **variable Nummerierung** ist der Hauptgrund, warum eine positionsbasierte Regex-Loesung
teuer ist: „2 – Lage" (mit Zerlegung) vs. „1 – Lage" (ohne) — jeder Anker muss beide Faelle kennen.

### Vollstaendiges Label-Universum (Haeufigkeit von 341)

**Kopf / immer (341):** Aktenzeichen · AGS · Bundesland des Finanzamtes · Finanzamtsnummer ·
Erklaerungs-ID · Vorgangs-ID · Datum der Berechnung des Bescheids · Grund der Veranlagung ·
Feststellungszeitpunkt · Art der wirtschaftlichen Einheit · Eigentumsverhaeltnis · Datum des
Messbetragsbescheids · Anzahl der Eigentuemer · **Messbetrag** (in Cent).

**Kopf / konditional:** Abweichende Gueltigkeit des Messbetrags (303) · Grundsteuerwert (33) **oder**
Bisheriger Grundsteuermessbetrag (38) · Grundsteuerbefreit (47) · Zusatzangabe (42) ·
Empfangsvollmacht (72) · Grundsteuerverguenstigt (1).

**Lage:** Ort (341) · Erste Gemarkung (341) · Strasse (293) · PLZ (290) · Hausnummer (258) ·
Erster Flur (48).

**Zerlegung (20):** Anteil Zaehler (11) · Anteil Zaehler-Reinertrag (20) · Anteil Nenner (20) ·
Zugewiesener Zerlegungsanteil (20) · Anzahl Zerlegungsgemeinden (20) · Zerlegungsanteil Messbetrag
laut Massstab (20) · Zerlegungsanteil Messbetrag (20).

**Eigentuemer (wiederholbar):** Anrede (489) · Strasse · Hausnummer · Ort · PLZ Inland · Zusatz
Hausnummer (25) · PLZ Ausland (1) · Staatenschluessel (1). Davon:
- **natuerliche Person:** Nachname (395) · Vorname (395) · Geburtsdatum (388) · Titel (7)
- **juristische Person / Gemeinschaft:** Namenszeile 1 (94) · 2 (50) · 3 (8) · 4 (1)

### Wertformate (aus den Beleg-Legenden im Dokument)

- **Messbetrag**: Ganzzahl in **Cent** (`9600` → `96,00 €`).
- **Grundsteuerwert**: in Euro ohne Cent. **Bisheriger Grundsteuermessbetrag**: Ganzzahl inkl. Cent.
- **Datum**: teils `DDMMYYYY` (`06022024`), teils `DD.MM.YYYY` (`01.01.2022`) → ISO normalisieren.
- **Codefelder mit Legende** im Dokument mitgeliefert: Grund der Veranlagung (0–9), Art der
  wirtschaftlichen Einheit (1–4), Eigentumsverhaeltnis (0–9), Anrede. → als **kontrollierte
  Werteliste (W6-Katalog)** hinterlegbar, damit die CSV Klartext **oder** Code liefern kann.

---

## 3 — Warum label-verankert gewinnt

| Herausforderung | Regex-Ist-Loesung | Label-verankerter Parser (Plattform-Profil) |
|---|---|---|
| Abschnitte umnummeriert (Zerlegung → +1) | bricht / Sonderfaelle je Anker | ignoriert Nummern, ankert am Label |
| Eigentuemer 1–8, wiederholbar | haendisch je Anzahl | Segmentierung ueber Abschnitts-Header → **`list`-Feld** |
| natuerl. vs. jurist. Person, befreit, Zerlegung | Regex je Variante | **optionale Felder** im Schema |
| Werte-Normalisierung (Cent, Datum, Codes) | im Regex verdrahtet | zentrale Normalisierung + W6-Katalog |
| Pflege bei neuer Variante | Entwickler baut neue Regex | Review korrigiert 1 Beispiel → Lern-Loop pflegt den Label-Katalog |

---

## 4 — Messung: deterministischer Prototyp ueber alle 341

Standalone-Prototyp (Bun, `pdftotext -layout` + label-verankerter Parser, kein LLM):

| Metrik | Ergebnis |
|---|---|
| Verarbeitete Bescheide | **341 / 341** |
| Textgewinnung (`pdftotext -layout`) | **~11 ms / Bescheid** (341 in 3,76 s) |
| Parsen (Label→Wert + Normalisierung) | **0,12 ms / Bescheid** (341 in 40 ms) |
| **Gesamt** | **~11 ms / Bescheid** gegen **12 s** der Ist-Loesung → **~1000×** |
| Auto-abgeleitete Spalten | **167** (Kopf + Lage + Zerlegung + E1..E8) |
| Max. Eigentuemer je Bescheid | **8** (natuerliche + juristische Personen gemischt) |
| Integritaets-Check „Anzahl der Eigentuemer" == geparste Bloecke | **0 / 341 Abweichung** |
| Normalisierung | Datum → ISO, Messbetrag Cent → Euro verifiziert |

**Fuer 25.000 Bescheide:** statt rechnerisch **~83 h** (12 s) rund **~5 min** reine Verarbeitung.
Der schwierigste Teil (wiederholbare Eigentuemer-Segmentierung) sitzt ohne Tuning fehlerfrei —
inklusive Erbengemeinschaft („nach Paul Peter Laubach" als Namenszeile) und 8-Eigentuemer-Fall.

Prototyp + CSV liegen im Scratchpad (`scratchpad/grundsteuer/`) — **Wegwerf-Beweis**, kein
Produktionscode.

---

## 5 — Zielarchitektur: deterministische Strategie als Plattform-Profil

Die Extraktions-Engine ist heute LLM-basiert (Strategien `single-pass`, `long-text-chunked`,
`vision-per-page`, `hybrid`; Registry in `services/extraction/strategies/index.ts`, Auswahl je
Projekt ueber `project.extraction.strategy`). Der GMBX-Fall braucht eine **neue, nicht-LLM
Strategie** — sonst laueft pro Bescheid ein Modell-Call, was Geschwindigkeit **und** Kosten bei
25.000 Dokumenten ruiniert.

### 5.1 Neue Strategie `template-labelmap` (kein LLM pro Dokument)

- Neuer `StrategyId`-Eintrag; Implementierung erfuellt das bestehende `ExtractionStrategy`-Interface
  (`run(input) → StrategyResult`), registriert in der Strategy-Registry.
- **`llmCalls: 0`**, `strategyUsed: 'template-labelmap'`. Konfidenz **1.0** fuer per Label belegte
  Felder (das Aequivalent zur OCR-Fusion „verified" aus W7 — hier ist der Textlayer die Quelle).
- Eingabe: eine **Template-Definition** (Label→Feld-Mapping + Abschnitts-/Wiederhol-Regeln +
  Normalisierer). Fuer GMBX ein fertiges Template; generisch fuer weitere born-digital-Formulare.

### 5.2 Kritischer Integrationspunkt: layout-erhaltende Textquelle

Der Standard-Textpfad der Engine geht ueber **Markitdown/Docling → Markdown** und **linearisiert**
die zweispaltige Struktur — die Label/Wert-Trennung ginge verloren. Die neue Strategie **darf diesen
Text nicht nutzen**, sondern braucht **layout-erhaltenden Text**:

- **Option A (schnell):** `pdftotext -layout` (poppler-utils). Die Plattform nutzt bereits
  `pdftocairo` aus **demselben Paket** (`services/extraction/pdf.ts`) — die Dependency ist auf allen
  Ziel-Umgebungen (macOS/Scalingo/Railway-Dockerfile) vorhanden. Geringster Aufwand.
- **Option B (robusteste):** positionierte Text-Tokens aus der PDF (Label und Wert per Zeilen-
  y-Koordinate paaren). jsPDF setzt Text an festen x/y — Paarung ist unabhaengig von Spalten-
  Whitespace-Heuristik. Mehr Aufwand, dafuer immun gegen enge Spaltenabstaende.

Empfehlung: **A zuerst** (Prototyp belegt 0/341), B als Haertung, falls andere Gemeinden/FA-
Versionen engere Layouts liefern. Die Strategie braucht dazu Zugriff auf die **Roh-PDF-Bytes**
(nicht nur `PreparedFile.text`) — ein kleiner Zusatz am `StrategyInput`/an der Datei-Vorbereitung.

### 5.3 GMBX-Profil (Schema)

- **Kopf-/Lage-/Zerlegungs-Felder** als flache `ProjectField` (konditionale als optional).
- **Eigentuemer** als **`list`-Feld** mit Spalten (Anrede, Nachname, Vorname, Geburtsdatum,
  Namenszeile 1–4, Titel, Strasse, Hausnummer, Zusatz-Hausnummer, Ort, PLZ Inland/Ausland,
  Staatenschluessel) — 1 Ebene tief, exakt das bestehende Listen-Feature (Positionslisten).
- **Codefelder** optional mit W6-Katalog (Grund der Veranlagung, Art der wE, Eigentumsverhaeltnis,
  Anrede) fuer Klartext-Ausgabe.
- Normalisierer je Feldtyp (Cent→Euro, Datum→ISO).

### 5.4 Rolle des LLM: einmalig, nicht pro Dokument

- **Schema-/Template-Inferenz einmalig:** die bestehende `schema-infer` leitet aus wenigen
  Beispielen Felder + Labels ab (statt haendischer Regex). Ein Mensch bestaetigt einmal.
- **Anomalie-Review im Lern-Loop:** trifft der Parser ein **unbekanntes Label** oder passt „Anzahl
  der Eigentuemer" nicht zur geparsten Zahl, entsteht ein Befund → `needs_review`. Die Korrektur
  erweitert den Label-Katalog des Templates (das Aequivalent zu „neue Regex", aber deklarativ und
  ohne Entwickler). Optionaler LLM-Fallback nur fuer die unklare Einzelseite, nie fuer den Stapel.

### 5.5 Review / Triage / Batch / Export — erben aus dem Unterbau

- **Triage `needs_review`** bei: unbekanntes Label, Owner-Anzahl-Mismatch, fehlendes Pflichtfeld
  (z.B. Aktenzeichen/Messbetrag leer), Wert nicht normalisierbar. Sonst `auto_ok` — die W7-
  Philosophie (Unsicherheit vorlegen, nie verschlucken) gilt unveraendert.
- **Batch + flacher XLSX-Export** und **Webhook** funktionieren bereits fuer `list`-Felder und
  Segment-Profile (W10.4) → eine Zeile je Bescheid, Eigentuemer als nummerierte Spalten **oder**
  als Zeilen-Aufloesung. Kein neuer Export-Code.

---

## 6 — Offene Fragen / Risiken

1. **Label-Drift ueber Gemeinden/Bundeslaender/FA-Versionen:** die 341 Beispiele sind **eine**
   Gemeinde (AGS 06435012, HE). GMBX ist bundeseinheitlich formatspezifiziert, aber Landeswerte und
   FA-Software-Versionen koennen Labels/Reihenfolge minimal aendern. → Template label-basiert (nicht
   positionsbasiert) halten; Lern-Loop faengt Neues. Zweiten Gemeinde-Stapel zur Haertung anfragen.
2. **Layout-Text auf dem Server:** `pdftotext` muss im PATH sein (kommt mit poppler-utils, s. 5.2) —
   im Docling/Railway-Dockerfile explizit sicherstellen.
3. **Codefelder Klartext vs. Code:** liefert der Kunde lieber Schluesselwerte (`2`) oder Klartext
   („bebautes Grundstueck")? → Katalog macht beides moeglich; Default mit Kunde klaeren.
4. **Eigentuemer-Ausgabeform:** nummerierte Spalten (E1_…E8_…, 167 Spalten) vs. eine Zeile je
   Eigentuemer vs. beides (Haupt- + Detailblatt). → Kundenpraeferenz.
5. **Aktenzeichen-Dubletten / Neuveranlagungen:** „Grund der Veranlagung" unterscheidet Haupt-/Neu-/
   Nachveranlagung — bei mehreren Bescheiden je Aktenzeichen ist die Dedup-/Versionsregel eine
   Fachfrage an den Kunden.

---

## 7 — Wellenplan

| Welle | Inhalt | Verifikation |
|---|---|---|
| **G1** GMBX-Profil + Template | Schema (Kopf/Lage/Zerlegung/`list`-Eigentuemer), Label-Katalog, Normalisierer | Schema deckt 167 Spalten der Messung |
| **G2** Strategie `template-labelmap` | neue nicht-LLM-Strategie, layout-Textquelle (pdftotext -layout), Roh-PDF an `StrategyInput` | 341-Regression: 0/341 Owner-Mismatch reproduziert **in der Engine** |
| **G3** Triage/Review | Befunde bei unbekanntem Label / Owner-Mismatch / Pflichtfeld; Review-Korrektur erweitert Template | Durchklick an Anomalie-Faellen |
| **G4** Batch/Export/Webhook | eine Zeile je Bescheid, Eigentuemer-Ausgabeform je Kundenwahl | Export als echtes XLSX gelesen, 341-Batch |
| **G5** Haertung + zweite Gemeinde | Label-Drift, `pdftotext`-Verfuegbarkeit im Deploy, ggf. Option B (positionierte Tokens) | Messung gegen zweiten Stapel |

**Messplan (analog Ehinger/Segmentierung):** Feld-Recall je Spalte gegen manuell gelabelte
Stichprobe, Owner-Anzahl-Treffer, Normalisierungs-Korrektheit, Durchsatz (Bescheide/s), 0 stille
Fehler. Baseline ist die 12-s-Regex-Loesung — der Durchsatz-Gewinn ist das Verkaufsargument.

---

## 8 — G1+G2 umgesetzt + gegen die 341-Regression verifiziert (2026-09-03)

**G1 — GMBX-Profil** (`backend/src/extraction/templates/grundsteuer-gmbx.ts`): Kopf-/Lage-/
Zerlegungsfelder als flache `ProjectField` (Label = exaktes Dokument-Label), **Eigentuemer als
`list`-Feld** mit 16 Spalten. Als Factory: seedbar via `createProject(GRUNDSTEUER_GMBX_SPEC)` oder
DB-frei via `buildGrundsteuerGmbxProject()` (Tests/Harness). `extraction.strategy = 'template-labelmap'`.

**G2 — Strategie `template-labelmap`** (`backend/src/services/extraction/strategies/template-labelmap.ts`,
registriert in `strategies/index.ts`, `StrategyId` erweitert, terminal in `ESCALATION_PATH`):
- **Kein LLM/OCR/Vision.** `llmCalls: 0`, Konfidenz 1.0 fuer jedes per Label belegte Feld.
- **Layout-erhaltende Textquelle:** `pdftotext -layout` (poppler, via stdin) auf `PreparedFile.rawBuffer`
  — bewusst NICHT der linearisierende Markitdown/Docling-Markdown (`PreparedFile.text`).
- **Label-verankert:** Maps werden aus dem Profil abgeleitet (scalar-Labels → Feld; `list`-Gruppe:
  `_label` = Instanz-Startsignal am Abschnitts-Header „N – <Label>", `_item_fields`-Labels → Spalten).
  Ergebnis exakt in Engine-Form: `{ felder: {...}, eigentuemer: [...] }`. Unbekannte Labels → `warn`-Befund.
- **Kern-Parser `parseLabelmap(text, profile)`** rein herausgeloest (5 Unit-Tests, kein pdftotext noetig).
- Anzahl-Plausibilitaeten (z.B. „Anzahl der Eigentuemer" == Instanzen) bleiben bewusst aus der
  Strategie heraus — sie gehoeren als W5-Pruefregel ans Projekt (heute nur `sum`/`lookup`; ein
  `count`-Regeltyp waere G3-Folgearbeit).

**Feld-Aliasse (neu, `FieldDefinition.aliases` + `ProjectField`/`ProjectItemField`):** Anker-Alternativen
fuer mehrzeilige Labels (das PDF-Label „Sonstige Bescheidkennzeichnungen … Nebenbestimmungen …
Billigkeitsangaben" traegt den Wert auf der Mittelzeile → Alias auf genau dieses Fragment) und fuer
den in §6.1 benannten Label-Drift. Durch den Adapter durchgereicht, von LLM-Strategien ignoriert.

**Messung in der Engine** (Profil → `extractionProjectToExtractionSchema` → Strategie, alle 341):

| Metrik | Ergebnis |
|---|---|
| Aktenzeichen + Messbetrag gesetzt | **341 / 341** |
| Owner-Anzahl-Abweichung (deklariert vs. geparst) | **0 / 341** |
| Unbekannte Labels | **0** |
| Eigentuemer gesamt / max je Bescheid | 489 / **8** |
| Durchsatz inkl. pdftotext | **~9 ms / Bescheid** |
| Unit-Tests / gesamte Extraction-Suite | 5 / 5 · **247 / 247** grün |

Werte-Spot-Checks bestaetigt: Datum → ISO, Messbetrag als Cent-Ganzzahl, Zerlegungsblock, natuerliche
(Nachname/Vorname/Geburtsdatum) und juristische (Namenszeilen) Eigentuemer korrekt getrennt, keine
Feld-Leckage zwischen Instanzen. Der Regressions-Harness liegt im Scratchpad (Wegwerf).

**Offen (nach G2):** flacher CSV/XLSX-Export mit Eigentuemer-Ausgabeform je Kundenwahl (G4);
`count`-Pruefregel fuer die Owner-Anzahl (G3); Persistenz-Seed in die DB + UI-Durchklick;
Haertung gegen einen zweiten Gemeinde-Stapel (G5). Kundenfragen aus §13 bleiben offen.

---

## 9 — G4: Export „eine Zeile je Dokument" + CSV (2026-09-03)

Der Kunde will „ein Datensatz je Bescheid, alle Werte als Spalten". Die bestehenden Formen passten
nicht: `flat` = eine Zeile je **Position** (= je Eigentuemer), `grouped` = Haupt- + Listenblatt.
Neue Form im gemeinsamen Baustein `extraction/learning/export-xlsx.ts`:

- **`flat-wide`** (`buildFlatWideSection`): EIN Blatt, **eine Zeile je Dokument**. Jede Positionsliste
  wird in **nummerierte Spalten** aufgefaltet — Instanz 1..Batch-Max, Spaltenkopf
  `"<Listenlabel> <n> – <Spaltenlabel>"` (z.B. „Eigentuemer 1 – Nachname des Eigentuemers"), plus
  eine „(Anzahl)"-Spalte je Liste. Faltet **alle** Listen auf (nicht nur die erste wie `flat`) und
  multipliziert keine Zeilen. Fehlende Instanzen → leere Zellen; positionslose Dokumente behalten ihre Zeile.
- **CSV** (`sectionToCsv`): `;`-getrennt (DE-Excel), UTF-8-**BOM**, RFC-Quoting. `flat`/`flat-wide`
  liefern genau EINE Section → direkt serialisierbar.
- **Routen:** `export.xlsx?format=flat-wide` (neben `flat`/`grouped`); neuer `export.csv?format=flat-wide|flat`.
  Public-API `batch.export` um `flat-wide` erweitert (Parität, XLSX-base64).
- **Frontend:** Export-Menue um „Excel breit", „CSV breit" ergaenzt (`ExportDropdown` +
  `handleExport`); die zuvor unkonfigurierten „CSV"/„JSON" bekommen ihre Menue-Eintraege.

**E2E-Messung** (341 → Strategie → `BatchFileSummary[]` → `flat-wide` → CSV):

| Metrik | Ergebnis |
|---|---|
| Zeilen (= Bescheide) | **341** |
| Spalten | **169** (Kopf/Lage/Zerlegung + „Eigentuemer (Anzahl)" + E1–E8 × 16) |
| 8-Eigentuemer-Fall | Anzahl-Spalte „8", E8-Nachname korrekt befuellt |
| CSV | BOM gesetzt, `;`-getrennt, Sonderzeichen gequotet |
| Unit-Tests / Extraction-Suite | +6 · **251/251** grün |

Beispiel-CSV im Scratchpad (`bescheide-flat-wide.csv`).

---

## 10 — DB-Seed + Live-Durchklick (2026-09-03)

**Seed** (`backend/scripts/seed-grundsteuer-gmbx.ts`, idempotent via `createProject`): das GMBX-Profil
liegt jetzt in der DB (id `grundsteuermessbescheide-gmbx`, 37 Felder / 1 Liste, Strategie
`template-labelmap`) — das laufende Backend serviert es.

**Live gegen das laufende System** (Backend :3001 / Postgres :5432): ein echter Batch ueber den
vollen Service-Layer — `createBatchRun` → `runBatchExtraction` → `extract` (Ingest + Konverter) →
Pipeline → `template-labelmap`. Damit ist auch die Integration jenseits der Strategie bewiesen:
der `extract`-Service reicht den `rawBuffer` korrekt an die Strategie, Persistenz und Review-Triage
laufen produktiv.

| Metrik (8er-Stichprobe, echter Lauf) | Ergebnis |
|---|---|
| Status | **8/8 completed** |
| Triage | **8 auto_ok** · 0 LLM-Calls · 0 Warnungen |
| Strategie | `template-labelmap` |
| `flat-wide`-CSV | 8 Zeilen · 137 Spalten (Owner bis „Eigentuemer 6" = Batch-Max), Anzahl je Zeile korrekt (1/6/2/…) |

Der Lauf ist in der UI sichtbar (Extraktions-Projekte → „Grundsteuermessbescheide (GMBX)" → Lauf).
Der finale Menue-Klick „CSV breit" im Browser laeuft ueber dieselbe Route/den Baustein, der hier
headless verifiziert wurde.

**Offen weiter:** G3 (`count`-Pruefregel fuer die Eigentuemer-Anzahl), G5 (Haertung gegen eine
zweite Gemeinde); Eigentuemer-Ausgabeform final mit dem Kunden bestaetigen (nummerierte Spalten vs.
Zeilen).

---

## 11 — Konverter-Umgehung: Live-Durchsatz eingeloest (2026-09-03)

**Messung des Live-Pfads** (10 Bescheide sequentiell, echter `extract()`-Service) zeigte: die eigentliche
Extraktion kostet **~22 ms**, der Live-`extract()` aber **~2.919 ms** — davon **~100 % ein Markitdown-
Konverter-HTTP-Call** (best-effort im generischen Ingest fuer JEDES PDF), den `template-labelmap` gar
nicht nutzt (es liest den Textlayer via `pdftotext` aus dem `rawBuffer`).

**Fix:**
- `ingest(source, { skipPdfConvert })` ueberspringt `convertDocument`; `extract()` setzt das Flag, wenn
  `project.extraction.strategy === 'template-labelmap'`, und fuellt `document_text` guenstig aus
  `pdftotext` (~10 ms) statt aus Markitdown.
- Geteilte `pdfToLayoutText(buffer)` in `services/extraction/pdf.ts` (poppler, `pdftotext -layout` via
  stdin) — genutzt von der Strategie UND vom Ingest (eine Quelle, kein Duplikat).

**Gemessen nach dem Fix:**

| | vorher | nachher |
|---|---|---|
| voller `extract()`-Live-Pfad je Bescheid | ~2.919 ms | **~33 ms** (~88×) |
| ganzer 8er-Batch inkl. DB-Persistenz (parallel) | — | **266 ms** |
| 341-Regression Owner-Abweichung | 0/341 | **0/341 (unveraendert)** |

Damit loest der Live-Betrieb die ~1000×-Geschichte gegen die 12-s-Regex-Loesung ein: fuer 25.000
Bescheide faellt die reine Konverter-Wartezeit (rechnerisch ~20 h sequentiell) komplett weg. Der
Markitdown-Call ist auch in Produktion (Scalingo) real — der Fix wirkt dort genauso. Bewusst: fuer
`template-labelmap` steht `document_text` aus dem Textlayer (nicht Markdown) — exakt der geparste Text.

---

## 12 — G3: `count`-Pruefregel fuer die Eigentuemer-Anzahl (2026-09-03)

Die deterministische Extraktion liest exakt, was im Bescheid steht — sie kann daher nicht erkennen,
wenn eine Eigentuemer-Instanz **fehlt oder erfunden** wurde (die OCR-Fusion prueft nur GELIEFERTE
Werte). Genau dafuer der neue W5-Pruefregeltyp:

- **`CountRule`** (`extraction/learning/types.ts`): `list_field` ↔ `target_field`, Default-Severity
  `error`. Auswertung `evaluateCountRule` (`rules.ts`): fehlt die Soll-Anzahl → nicht pruefbar;
  sonst `Array.length` vs. Soll (deutsche Zahlformate via `correctNumber`). Dispatch in
  `evaluateRules`, plus `describeRule` und `validateProjectRules` erweitert (Feldtyp-Checks).
- **GMBX-Profil**: Regel `eigentuemer-anzahl` (Eigentuemer-Liste ↔ „Anzahl der Eigentuemer"). Das
  Seed-Skript ist jetzt ein **Upsert** — bestehende Profile bekommen neue Regeln nachgezogen, der
  Lern-Zustand bleibt unberuehrt.

**Verifiziert:**
- +9 Unit-Tests (`rules.test.ts`), gesamte Extraction-Suite **260/260** grün, tsc-clean.
- Live gegen das geseedete DB-Profil: 8er-Batch weiterhin **8/8 auto_ok** (kein Fehlalarm auf den
  konsistenten 341); bei manipuliertem Soll≠Instanzen ein **blockierender** Befund
  („‚Anzahl der Eigentuemer' nennt 2, extrahiert wurde aber 1 Eigentuemer-Eintrag.") → erzwingt
  „Zu pruefen".

Damit ist auch der letzte Blindfleck aus §4 (Fusion sieht keine fehlenden Werte) fuer den
Eigentuemer-Fall geschlossen. **Offen weiter:** G5 (Haertung gegen eine zweite Gemeinde/Label-Drift);
Eigentuemer-Ausgabeform final mit dem Kunden.
