# Extraktions-Projekt: Sanitätshaus-Rezepte (erstes produktives Projekt)

**Datum**: 2026-06-04
**Status**: Eingerichtet (Code + Setup-Skript), E2E-Feinschliff über Lern-Loop offen
**Plan-Referenz**: `.claude/plans/dapper-wondering-oasis.md`

## Kontext

Erstes echtes Extraktions-Projekt auf der Heavy-Pipeline: strukturierte Daten aus
**Sanitätshaus-Rezepten** (gescannte PDFs, Muster 16 / Privat). Beispiele in
`docs/sani_rezepte/`. Strategie **vision-per-page** (reine Vision pro Seite), weil
der PDF-Textlayer der Scans verstümmelt ist.

Kern-Challenges (aus den Beispielen): **Versatz** (Druck gegen Formularfelder
verschoben), **Unterschrift überschreibt Infos** (BSNR/Stempel), Schräglage,
blasser Druck, Durchscheinen, mehrseitig (Seite 2 = Sani-Stempel), Diagnose mal
ICD-10 mal Freitext, HMV-Nummer.

## Code-Änderungen (Voraussetzungen)

### 1. Stabiles `instructions`-Feld am Projekt
Hand-gepflegte Domänen-Anweisungen, die der Lern-Loop NICHT überschreibt (anders als
`guidelines`, das `regenerateGuidelines()` komplett neu generiert).
- `ExtractionProject.instructions?: string` (`learning/types.ts`).
- Adapter (`pipeline-adapter.ts:buildLearningGuidelines`) rendert **instructions →
  gelernte guidelines → Few-Shot** in `profile.guidelines`; die Strategien hängen das
  via `appendGuidelines()` an den Vision-Prompt.
- Storage: Scalingo DB-Spalte + Migration `0021_extraction_project_instructions.sql`;
  Railway YAML (`project.yaml`). Routes (POST/PUT) + Frontend-Textarea (Create + Settings).

### 2. PDF-`rawBuffer` im Projekte-`extract()`
Vorher wandelte `ingest()` PDFs nur in (verstümmelten) Markitdown-Text → `vision-per-page`
hatte keine visuelle Quelle. Jetzt liefert `ingest()` für PDFs zusätzlich `rawBuffer` +
`mimeType: application/pdf`; `extract()` baut daraus eine vision-fähige `PreparedFile`.
Verifiziert: `pdftocairo` rendert die Beispiel-Scans korrekt (Klemme 1 S., Test_01 2 S.).

## Das Projekt

Angelegt per **`backend/scripts/create-sani-rezepte-project.ts`** (idempotent —
erneuter Lauf aktualisiert Felder/instructions/Strategie, lässt gelernte Guidelines +
Examples unberührt). Lauf: `bun run scripts/create-sani-rezepte-project.ts` im `backend/`
(Scalingo: mit DB-Env via `scalingo run`; Railway: schreibt `project.yaml`).

- **Strategie**: `vision-per-page`, `vision_detail: high`, `max_pages: 5`, `validation_repair: true`.
- **21 Felder** (flach, je mit Format-`description`): Patient (Name/Vorname/Geburtsdatum/
  Adresse), Versicherung (Rezepttyp, Kasse, IK, Versicherten-Nr, Status), Arzt (BSNR,
  LANR, Name, Fachrichtung), Verordnung (Datum, Rp-Text, HMV-Nr, Menge, ICD, Diagnose-Text,
  gebührenbefreit, Hinweis).
- **`instructions`**: Domänen-Regeln zu Versatz (nach Format statt Position zuordnen),
  Unterschrift (darunter lesen + BSNR quer-prüfen + bei Verdeckung null/niedrige Confidence),
  blasser Druck/Durchscheinen, Mehrseitigkeit, Diagnose ICD vs Klartext, HMV-Format.

## Verifikation / nächste Schritte

1. Skript ausführen → Projekt erscheint im Extraktions-UI mit Feldern + Strategie + instructions.
2. Beispiel-Rezepte im Training-Tab hochladen → extrahieren. Schwierige Fälle gezielt:
   `Klemme_Kompression` (Versatz), `Bönning` (blass + Durchscheinen), `Test_01` (schräg + Seite-2-Stempel).
3. Ergebnisse korrigieren + „Trainieren" → Few-Shot greift; `instructions` bleiben nach
   Guideline-Regeneration erhalten.
4. `instructions` / Feld-`description`s iterativ nachschärfen.

Live-Extraktion (Vision-LLM) wurde noch nicht ausgeführt (braucht laufende App + Provider-Key);
PDF-Rendering-Pfad ist verifiziert.
