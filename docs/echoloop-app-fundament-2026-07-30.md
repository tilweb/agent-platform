# Echo-Loop Workplace-App — Fundament + Baustein a (RGA-Analyzer)

**Datum:** 2026-07-30 · **Status:** umgesetzt & verifiziert (erste Scheibe)

## Kontext

Echo-Loop (RPA-Prozess-Reifegradanalyse für EMMA-Studio-Prozesse, von YNEO.ai) existierte bisher als lose
Agenten-/Skill-Implementierung (`data/agents/echo-loop-*`, `data/skills/custom/emma-*`,
`backend/src/tools/special/reifegrad-score.ts`). Auf Kundenwunsch wird das Thema **neu als native
Workplace-App** aufgebaut — nicht als Agent — auf Basis des erweiterten Übergabe-Pakets
`docs/Echo-Loop-App/` („Echo im Workplace V0.1", 30.07.2026). Die Alt-Implementierung ist Referenz, nicht
Blaupause.

Zielbild der Spec ist dreistufig — **Kunden-Zwilling → Prozess-Akte → Ansichten A (RGA/Verlauf) · B (Bau-Board)
· C (Vergleich)** — ausgebaut über 6 Bausteine a–f. Explizite Produktanforderung (Wissensbasis 62 §12.9):
*geführte App (Dropzone → Prozessliste → Detail), kein Chat-Interface.*

Diese erste Scheibe baut **Fundament + Baustein a** als vollen Loop von Ansicht A.

## Entscheidungen

- **Native App nach dem Workplace-App-Muster** (Referenz: `projektmanagement`): eigenes `pgSchema`, Hono-Sub-Router,
  Registrierung in `registry.ts` + `routes/apps.ts`, Frontend manuell in `App.jsx` verdrahtet.
- **PDF→Text via `pdftotext -layout`** (poppler, bereits System-Abhängigkeit) — **nicht** Markitdown: der
  `-layout`-Modus bewahrt die `Key:Value`-Spaltenstruktur des EMMA-Exports, die der Checker braucht (verifiziert:
  `ResetBeforeStart:True`, `TestCaseID:-1`, `MaxLoopCount`, `Subject:RegEx` bleiben erhalten).
- **Checker als Reimplementierung aus der Spezifikation** `PRUEFMUSTER-KATALOG.md` in TypeScript — der Original-
  Python-Checker liegt nicht im Paket (nur die Spec + reale Test-Exporte). Kein Python-Runtime im Backend (kein
  Präzedenzfall); deterministische Logik komplett in TS, testbar via `bun test`.
- **Scoring erweitert `reifegrad-score.ts`** (dessen Pflicht-Raster WB44 + RGQ + Gesamt-RG + Limiter) um
  SE-Quotient, Relevanz-Maske und die Zusatz-Dimension D6b.
- **Deterministisch vs. LLM strikt getrennt**: Prüfmuster + Kennzahlen-Mathematik sind Code; das LLM liefert nur
  die Level-Einordnung D1–D10 + Belegtexte (Entwurf). **Mensch-Review-Gate** an jeder Benotung.
- **Soll-Quelle bis Compass (Baustein e)**: der Analyst setzt Soll je Dimension im Review (versioniert);
  Default beim Entwurf = Ist (Startpunkt), Konfidenz „offen".
- **S3 optional mit lokalem Fallback**: Upload persistiert nach S3 wenn konfiguriert, sonst läuft die Analyse
  ohne Binär-Persistenz weiter (Textextrakt im Artefakt gecacht).

## Änderungen

### Datenmodell — `pgSchema('echoloop')`
`backend/src/db/schema/echoloop.ts` + Migration `backend/drizzle/0028_echoloop.sql` (+ Journal-Eintrag).
Konvention wie `projektmgmt`: Identitäts-/Filter-Spalten + `data` jsonb + `permissions` + `version`.
- **kunden** · **prozesse** (FK kunde, cascade) · **baustaende** (FK prozess; Status `entwurf|in_review|freigegeben`;
  `data` = Dimensionen D1–D10+D6b {ist/soll/relevanz/beleg/provenienz/konfidenz} + Befunde + Kennzahlen) ·
  **artefakte** (S3-Key + gecachter Textextrakt). Baustand append-only je Prozess → Baustein c dockt später an.

### Backend — `backend/src/apps/echoloop/`
- `index.ts` (AppConfig `id:'echoloop', icon:'echoloop'`), `types.ts`, `storage.ts` (CRUD + Optimistic-Locking),
  `concurrency.ts`, `routes.ts` + `routes/{kunden,prozesse,baustaende,analyse}.ts` + `_shared.ts`.
- `scoring.ts` (+ `scoring.test.ts`): Kennzahlen-Kern. Formeln:
  `RGQ = ΣIst(D1..D10)/50` · `Gesamt-RG` = höchste Stufe mit erfülltem Pflicht-Raster (weakest link) ·
  `RG* = min{Ist | relevanz=1}` · `SE = Σr·min(Ist,Soll) / Σr·Soll` (Über-Soll gekappt).
- `checker/` (+ `checker.test.ts`): `parse.ts` (Export-Text → Schritte/Call-Graph/Schleifen/OCR/Variablen),
  `patterns.ts` (PM-01/02/03/04/04b/09/10), `index.ts` (`runChecker`). Einheitliches `PMFinding`-Schema mit
  Schweregrad + Provenienz-Tag; nicht-statisch-entscheidbare Muster (PM-04b, PM-10, Referenz-ohne-Export) als
  ❓-Panel-Frage, kein Hard-Fail.
- `extract.ts` (`pdftotext -layout` via `Bun.spawn`), `analysis.ts` (Orchestrierung Upload→Text→Checker→LLM→Baustand,
  LLM mit Timeout-Fallback). Neuer S3-Key-Builder `s3Paths.echoloopExport` in `storage/paths.ts`.
- Registriert: `registry.ts` (BUILT_IN_APPS) + `routes/apps.ts` (`apps.route('/echoloop', …)`).

### Frontend — `frontend/src/apps/echoloop/`
- `api.js` (API-Wrapper + Dimensions-/Level-Metadaten), `EcholoopPage.jsx` (Kunden/Prozesse-Übersicht),
  `ProzessDetail.jsx` (Tabs Übersicht · RGA-Review · Analysen; Live-Recompute debounced über `/scoring`; Speichern
  + Freigabe).
- `components/`: `ReifegradPanel.jsx` (interaktives Soll-Profil: Ist/Soll als YNEO-Lila-Level-Rampe L0–L5,
  Relevanz-Maske, Beleg, Konfidenz, LLM-Begründungs-Hinweis) · `KennzahlBadges.jsx` · `BefundeListe.jsx` ·
  `Dropzone.jsx`. Styles ausschließlich aus `theme.js`, keine farbigen Card-Border (CLAUDE.md-Regel).
- Verdrahtet in `App.jsx` (`/apps/echoloop`, `/apps/echoloop/prozess/:id`, gate `RequireAppPermission`),
  Sidebar-Nav-Icon `echoloop` (Loop-Symbol, `#452C71`).

## Verifikation / Messergebnisse

- **Unit-Tests (13 grün, `bun test src/apps/echoloop/`)**:
  - Scoring reproduziert die Pilot-Rechnung SOLL-PROFIL_METHODE §4 exakt: **SE 95 % · RG* 1 · RGQ 44 %**; What-if
    (D3→2/2, D7→4/4, D6b→3/3) → RG* 2 · SE 100 %; weakest-link (D8 L0 → RG0).
  - Checker gegen synthetische Fixtures im realen Export-Format (PM-01/02/03/04/09 + Call-Graph).
- **Realdaten-Validierung** (Signal-Nacharbeit-Familie, `docs/EMMA-Echo-Loop/Input/Case-Klinik/…`): Parser liest
  alle 12 Prozesse; PM-09 errechnet den im Katalog dokumentierten **Aufruf-Baum-Multiplikator ×16200** für
  Prozess 1074 (Kette 1069→1070→1074) und ×1800 für 1070; PM-02 erkennt 1069 korrekt als Master (kein Waise) und
  1116 als Referenz-ohne-Export.
- **HTTP-Smoke-Test über den vollen Stack** (Auth → Permission → Kunde/Prozess-CRUD → Upload zweier realer
  EMMA-Export-PDFs → Live-Scoring → Review-Edit mit serverseitigem Recompute → **Freigabe** mit Reviewer →
  Cascade-Cleanup): alle Schritte grün.
- **Production-Build** (`npm run build`): Exit 0, EcholoopPage- + ProzessDetail-Chunks gebaut, keine Resolve-/
  Export-Fehler. echoloop-TypeScript: 0 tsc-Fehler.

## Offene Punkte / Rahmen

- **Gate O-14 / Kern-IP**: die eigentlichen Benotungs-Prompt-Pakete sind laut Spec noch nicht freigegeben — der
  eingebettete LLM-Prompt ist ein Arbeitsstand auf Basis der öffentlichen WB44-Level-Definitionen.
- **App-Permission**: globale Admins haben keinen Auto-Zugriff — der Admin muss echoloop einer Gruppe zuweisen
  (Einstellungen → App-Berechtigungen), sonst „Wartet auf Konfiguration".
- **Migrations-Snapshot**: das Repo pflegt handgeschriebene Migrationen ohne Per-Migration-Snapshot (nur
  `meta/0000_snapshot.json`); `0028_echoloop.sql` folgt diesem Muster.
- **Nächste Bausteine**: b (Bau-Board nativ), c (Verlauf/Vergleich-Charts auf der Baustand-Historie), d
  (Zwilling-Graph), e (Compass → belegte Soll-Werte), f (Kontext-Chat „Echo fragen").

## Goldstandard-Abgleich (IHK-DA Veranstaltungsfeedback) + P1

Verglichen gegen den verifizierten Gold-Report `04_Referenz-Analysen/_RGA_Veranstaltungsfeedback_KUNDENFASSUNG_IHK-DA_v1.html`
(Prozesse 138/157, RG0 · RGQ 20 %):

- **Deckungsgleich**: Unser Scoring auf den Gold-Levels ergibt **exakt RG0 · RGQ 20 %**. Datenmodell (ist/soll/
  relevanz/beleg/konfidenz), Maskierung (Gold D10 Ziel 0 = unsere `relevanz=0`) und Evidenz-Disziplin (❓) passen.
- **Lücken**: (A) Checker-Evidenz-Breite — der Gold stützt D1–D10 auf Bautechnik-Signaturen (feste Waits, feste
  Klicks, Hardcoding, Verzweigungsstruktur), die unser PM-01…10 (stille Killer) nicht abdeckte. (B) Level-Zuweisung
  ohne deterministische Stützen (LLM-only, lokal Timeout→0). (C) Narrativ-Tiefe/D-050 (Gold: purpose/beleg/recs/
  topHebel je Dim). (D) Soll-Herleitung (Compass, Baustein e). (E) K1-Report-Export.

**P1 umgesetzt (Checker-Bautechnik-Detektoren):** `PM-13` (feste Wartezeiten → D2, ms→s, blind ≥0,5 s, WB50-
Manipulationsknoten abgegrenzt) + `PM-14` (feste Klick-Position → D1, absolute X/Y ohne Anker, X:0/Y:0 = Fund-
Bindung ❓, Anker-Klicks nicht geflaggt). Verifiziert gegen echte Exporte (gold-analoge Dauer-Listen + Koordinaten).

**P2 umgesetzt (deterministische Level-Hinweise + Fallback-Boden):** `checker/hints.ts` `deriveHints` mappt alle
Checker-Signale auf einen Ist-Level-Vorschlag je Dimension + Belege; zwei neue Detektoren (Hardcoding-Pfade → D6,
Klartext-Kennwort → D8). Die Vorschläge gehen als Ausgangspunkt in den LLM-Prompt UND dienen als **Fallback-Boden**
(LLM down → Hinweis-Levels statt „alles 0"). Deterministische **Top-Hebel** am Baustand + im Review angezeigt.
**Messung:** auf der echten Signal-Nacharbeit-Familie trifft der reine Checker-Boden **9/10 Gold-Dimensionen exakt**
(nur D9 weicht ab).

**P2-Rest umgesetzt (Narrativ-Synthese, Reasoning):** `narrative.ts` `synthesizeNarrativ` erzeugt on-demand die
kundenfähige Gold-Fassung (exec/prosa/je-Dim purpose+beleg+recs, D-050) via Adacor Qwen 3.5 **Thinking**
(ENV-umschaltbar). Route `POST /baustaende/:id/narrativ` als SSE+Heartbeat; Frontend-Button + Kundenfassungs-Abschnitt.
`<think>`-robuster Parser (4 Tests). **Latenz-Realität:** Thinking-Modell hier sehr langsam (>180 s Timeout);
Pipeline mit Instruct-Platzhalter verifiziert (~19 s, gold-konform), Produktiv-Default Reasoning.

**Modell-Konfiguration (Adacor Qwen 3.5):** Vor-Benotung → Instruct (`qwen3-5-a3b-35b-256k`, ~7 s); Narrativ →
Thinking (`qwen3-5-a3b-35bthinking-256k`). ENV: `ECHOLOOP_LLM_MODEL` / `ECHOLOOP_NARRATIV_MODEL` /
`ECHOLOOP_NARRATIV_TIMEOUT_MS`. Der Kimi-K3-System-Default (Nebius) war zu langsam (~85 s) und ist ersetzt.

**Offen (Roadmap):** weitere Detektoren (Verzweigung D3, Modularität D9 je Einzelprozess). P3 — Soll via Compass (e).
P4 — K1-Report-Export (Gold-HTML als Vorlage).
