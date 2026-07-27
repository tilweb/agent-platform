# Extraktion: Listen-Felder / Positionsdaten (Line-Items) — Ausbau-Welle 1

**Datum:** 2026-07-27
**Status:** Implementiert (main/Scalingo + demo/messe/Railway)
**Plan-Referenz:** `.claude/plans/dapper-wondering-oasis.md` (5-Wellen-Roadmap, W1)
**Fachkonzept:** `docs/fachkonzept-dokumenten-extraktion-2026-07-27.md` (Abschnitt „Vision & Ausbaustufen")

## Kontext

Eine Wettbewerbs-Analyse des Extraktions-Features (vs. Rossum, Azure Document Intelligence & Co.)
ergab vier strukturelle Lücken auf dem Weg zum „besten Tool im Space". Lücke Nr. 1: Das
Projekt-Feldmodell war **flach und skalar** — Rechnungen, Lieferscheine und Rezepte mit
**Positionen** (wiederholende Zeilen) waren nicht abbildbar. Dabei konnte die Engine
Array-of-Objects längst (`ArrayGroupDefinition`, Schema-Builder, Union-Merge, Validator) —
nur Projekt-Layer und UI nutzten es nicht. Welle 1 schließt genau diese Lücke.

Roadmap (mit dem User festgelegt): **W1 Line-Items → W2 Eval-Harness & Audit (Champion/
Challenger, automatisch) → W3 Review-Workflow im Batch → W4 Eingangsstrecke (Splitten/
Klassifizieren/Routen) → W5 API & Integration.**

## Was umgesetzt wurde

### Datenmodell (keine Migration)
- `ProjectFieldType = FieldType | 'list'`; `ProjectField.item_fields?: Record<string,
  ProjectItemField>` (`learning/types.ts`). Spalten sind skalar (text/number/date/boolean),
  genau **eine Ebene tief** — keine Listen in Listen.
- `fields` liegt als jsonb (Scalingo) bzw. YAML (Railway) → Listen-Definitionen reisen
  transparent durch Persistenz, Export/Import (`transfer.ts`) und beide Worktrees.

### Adapter & Engine-Anbindung
- `pipeline-adapter.ts buildProfile()`: Skalarfelder → synthetische Gruppe `felder` wie
  bisher; **jedes list-Feld → eigene Top-Level-Array-Gruppe** unter seiner fieldId
  (`_array/_item_fields`). `required` bleibt bewusst draußen (Vision-Kollaps-Schutz).
- `ArrayGroupDefinition` um optionale `_label`/`_hint` erweitert (`extraction/types.ts`);
  `schema-builder.ts` rendert sie als Array-Description. Additiv, Vertragsmanagement unberührt.
- `service.ts extract()`: entpackt Listen unter ihrer fieldId; fehlende Liste → immer `[]`.
  Listen-Confidence kommt präfixfrei an (`confidence.ts` führt Array-Gruppen unter dem
  Gruppennamen) — kein Zusatzcode nötig.

### Dedupe (`learning/list-utils.ts`)
Union-Merge der Engine konkateniert Chunk-/Seiten-Arrays ohne Dedupe (bestehender Kontrakt,
z.B. fürs Vertragsmanagement). Der Learning-Layer entfernt deshalb nach `runPipeline()`
**exakte** Duplikate: Vergleichs-Key über alle definierten Spalten (Strings trim+lowercase,
fehlend/null vereinheitlicht). **Bekannte Grenze:** fachlich echte, in allen Spalten
identische Positionen kollabieren — Ausweg: unterscheidende Spalte (Positionsnummer/Menge).
Seitenübergreifend *gesplittete* Zeilen fängt v1 nicht (per instructions mitigierbar).

### Lern-Loop
- `examples.ts` unverändert: der JSON-Diff erzeugt für Listen genau **einen** corrections-
  Eintrag `{field, was: Array, corrected_to: Array}`.
- Few-Shot-Rendering + Guideline-Generator rendern Objekte/Arrays als JSON (vorher
  `[object Object]`), bei Listen mit Positions-Zähler `(n → m Positionen)`.
- Guideline-System-Prompt: expliziter Auftrag zu Listen (fehlende/überzählige Positionen,
  Spalten-Zuordnung, was KEINE Position ist: Zwischensummen, Rabatte, Versandkosten).

### Validierung (`learning/validators.ts` → Routen + Import)
`validateProjectFields()`: Liste ⇒ `item_fields` nicht leer; Spalten skalar + Label;
**fieldId `felder` für Listen reserviert** (Namespace-Kollision mit der synthetischen
Skalar-Gruppe); keine Liste in Spalten. Greift in POST/PUT `/projects` und `validateBundle`.

### Exporte
- **XLSX**: `generateDocument` kann jetzt **Multi-Sheet** (`DocumentSection.sheet?`;
  `excelGenerator.ts` gruppiert Sections nach Blatt, Titel/Metadata nur aufs Default-Blatt
  „Daten", Spaltenbreiten dynamisch). Der Batch-Export legt **pro Listen-Feld ein
  Zusatzblatt** an (eine Zeile je Position, Spalte „Datei"; Sheet-Namen sanitisiert ≤31
  Zeichen). Hauptblatt zeigt „N Positionen". pdf/docx/md ignorieren `sheet` (rückwärtskompatibel).
- **to-table**: Listen als JSON-Text-Spalte (`FIELD_TYPE_TO_COLUMN.list = 'text'`).
- **CSV/JSON** (clientseitig): JSON-String in der Zelle bzw. voll strukturiert.

### Frontend (`ExtractionProjectsPage.jsx`)
- Feldtyp **„Liste / Positionen"** + `ItemFieldsEditor` (Spalten-Subeditor mit Label→ID-Slug,
  Typ, Hinweis, Pflicht) in Projektanlage **und** Einstellungen; Typwechsel weg von Liste
  verwirft die Spalten.
- `ListItemsEditor`: Positions-Tabelle mit typgerechten Zell-Inputs, Zeile löschen,
  „+ Position"; im Training editierbar, im Batch-Detail read-only.
- Batch-Tabelle zeigt Listen kompakt als „N Positionen".
- **Wichtiger Fix:** `editedValues` wird jetzt per `structuredClone` tief kopiert — vorher
  hätten Listen-Werte Referenzen mit `extractionResult` geteilt und der `hasChanges`-
  Vergleich hätte Zell-Änderungen nie erkannt.

## Wichtige Designentscheidungen

- **Dedupe im Learning-Layer, nicht in der Engine** — `pickUnion` bleibt unverändert
  (Kontrakt anderer Konsumenten); `extract()` ist der einzige nötige Hook (Training und
  Batch laufen beide hindurch).
- **Grobes Listen-Diff** (ein corrections-Eintrag statt Zell-Diff) — das LLM sieht ohnehin
  beide vollständigen Arrays; ein Zell-Diff hätte Speicherformat, Bundles und UI verkompliziert.
- **Keine Boxes für Listen** (OCR skippt Array-Gruppen) — bewusste v1-Grenze.
- **`required` in Spalten nur UI-Marker** — konsistent zum bestehenden Vision-Kollaps-Schutz.

## Verifikation

- **Tests:** 104 Backend-Tests grün (neu: Adapter mappt list-Feld → eigene `_array`-Gruppe;
  Round-trip gruppiert→flach; Few-Shot ohne `[object Object]` mit Count-Hinweis; 7 Dedupe-
  Fälle inkl. Normalisierung/Fremd-Keys). `tsc` ohne neue Fehler, Frontend-Builds beide grün.
- **E2E (lokal, Port 3011, Modell-Override Adacor Qwen 3.5 — lokaler Default Kimi K3 kann
  kein named tool_choice):** Projekt mit Liste „Positionen" (3 Spalten) → Text-Rechnung
  extrahiert (3 Positionen, DE-Zahlen `0,12`→`0.12`) → Korrektur (fehlende `menge` ergänzt)
  als **ein** Listen-Diff gespeichert → Batch-Zweitlauf extrahierte `menge` dank Few-Shot
  direkt mit → XLSX mit Blättern „Daten"+„Positionen" → to-table 2 Zeilen →
  Export/Import-Roundtrip (item_fields + Beispiel überleben) → Validierungs-400er (leere
  Spalten, fieldId `felder`).
- **Railway:** 16 Dateien 1:1 gespiegelt (Drift-Check vorher: alle identisch zu HEAD),
  Tests grün, YAML-Persistenz-Roundtrip per Smoke-Test bestätigt.

## Out-of-Scope / Folge-Wellen

- W2: Eval-Harness (Champion/Challenger bei Guideline-Regeneration, Audit-Metadaten).
- W3: Batch-Korrekturen → Trainingsbeispiele, Konfidenz-Triage (dafür muss `document_text`
  in Batch-Files gespeichert werden).
- W4: Splitten/Klassifizieren/Routen („Posteingang").
- W5: API-Batch + Webhooks, pageImages→S3, fachliche Validierungsregeln (u.a. Summen-Check
  Positionen ↔ Gesamtbetrag — baut direkt auf W1 auf), Ähnlichkeits-Few-Shot, Schema-Inferenz.
