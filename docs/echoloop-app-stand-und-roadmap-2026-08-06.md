# Echo-Loop Workplace-App — Stand, Architektur & Roadmap

**Für:** Sebastian (YNEO) — zur Konzeption der nächsten Erweiterungen
**Stand:** 2026-08-06 · Code-Basis verifiziert gegen `backend/src/apps/echoloop/` + `frontend/src/apps/echoloop/`
**Vorgänger-Doku:** `docs/echoloop-app-fundament-2026-07-30.md` (Bau-Chronologie). Dieses Dokument ist die **konsolidierte Referenz** des aktuellen Stands.

---

## 0. In einem Absatz

Echo-Loop läuft als **native Workplace-App** (nicht mehr als Agenten-/Skill-Bündel). Umgesetzt ist das **Fundament + Baustein a (RGA-Analyzer)** als voller Loop: EMMA-Prozess-Export hochladen → deterministischer Prüfmuster-Checker (PM-01…14) + Kennzahlen (RG/RGQ/SE) → deterministische Level-Hinweise → KI-Vor-Benotung D1–D10 (Adacor Qwen 3.5) → **Mensch-Review** → Freigabe. Dazu on-demand: **Kundenfassung** (Gold-Form, D-050) und **interaktive Bauanleitungen** (D-061). Die deterministische Ebene trifft die Gold-Note exakt (RG/RGQ) und die Ist-Level zu **9/10 Dimensionen** ohne LLM. Offen sind die Bausteine b–f (Bau-Board nativ, Verlauf/Vergleich, Zwilling-Graph, Compass, Kontext-Chat) sowie der K1-Report-Export.

---

## 1. Einordnung: Spec-Zielbild ↔ aktueller Stand

Das Zielbild der Spec (`docs/Echo-Loop-App/01_Spec`) ist dreistufig — **Kunden-Zwilling → Prozess-Akte → Ansichten A/B/C** — ausgebaut über 6 Bausteine. Status:

| Baustein | Spec | Stand | Wo im Code |
|---|---|---|---|
| **a · RGA-Analyzer** | Upload → Checker → Vor-Benotung → Review → Baustand | ✅ **vollständig** | `analysis.ts`, `checker/`, `scoring.ts`, `routes/analyse.ts` |
| **b · Bau-Board nativ** | D-061-Karten als Plattform-Feature, Ereignis-Historie append-only | 🟡 **Vorstufe**: Bauanleitung interaktiv (abhaken/Status/Feedback), am Baustand gespeichert — aber **kein** Ereignis-Log, kein geteiltes Board Kunde↔Team | `bauanleitung.ts`, `ProzessDetail.jsx` (Sub-Tab) |
| **c · Verlauf + Vergleich** | RGQ/SE-Zeitreihe, Baustand-Diff, Portfolio-Cockpit | 🔴 **offen** (Datenmodell trägt aber mehrere Baustände je Prozess) | Datenbasis: `elBaustaende` (append-only) |
| **d · Zwilling-Modul** | Kunden-Zwilling als Graph, Provenienz/🔒 | 🔴 **offen** (Kunde/Prozess sind die Wurzeln) | — |
| **e · Compass-Modul** | Umfrage → Ziele-Register → belegtes **Soll** je Dimension | 🔴 **offen** — Soll setzt derzeit der Analyst | `dimensionen[d].soll` |
| **f · Kontext-Chat** | „Echo fragen"-Panel, Kontext erbt vom Standort | 🔴 **offen** (Workplace-Assistants existieren nativ) | — |

**Zusätzlich umgesetzt (über die Baustein-a-Spec hinaus):**
- Deterministische **Level-Hinweise** je Dimension (Checker → Vorschlag + Beleg) mit **Fallback-Boden**, wenn kein LLM.
- **Kundenfassung** (Narrativ-Synthese, Gold-Form) — Vorwegnahme des K1-Report-Inhalts.
- **Bauanleitungen** (D-061) — Vorstufe zu Baustein b.

---

## 2. Architektur im Workplace

Echo-Loop ist eine reguläre Workplace-App nach dem Plattform-Muster (Referenz: `projektmanagement`):

- **Eigenes Postgres-Schema** `pgSchema('echoloop')` (`db/schema/echoloop.ts`), Migration `drizzle/0028_echoloop.sql`.
- **Hono-Sub-Router** unter `/api/apps/echoloop/*`, registriert in `apps/registry.ts` (`BUILT_IN_APPS`) + gemountet in `routes/apps.ts`.
- **Gruppenbasierte Berechtigung** (owner/editor/viewer) wie alle Apps — der Admin weist die App einer Gruppe zu (globale Admins haben **keinen** Auto-Zugriff).
- **Frontend** unter `frontend/src/apps/echoloop/`, Routen manuell in `App.jsx`, Sidebar-Icon in `Sidebar.jsx` (`echoloop`, Lila `#452C71`).
- Tech-Stack der Plattform: Bun + Hono (Backend), React 19 + Vite (Frontend), file-/DB-hybrid; LLM über `services/llm.ts` (Multi-Provider).

**Warum als App und nicht als Agent:** Produktanforderung „geführte App (Dropzone → Prozessliste → Detail), kein Chat-Interface" (Wissensbasis 62 §12.9). Der Workplace **führt** die Analyse-/Benotungs-Skills als Versionen aus; die Methodik-Hoheit bleibt bei YNEO (Gold-Standard-Governance).

---

## 3. Datenmodell — das zentrale Objekt für Erweiterungen

`pgSchema('echoloop')`, Spalten-Konvention: strukturierte Identitäts-/Filter-Spalten + `data`-jsonb + `permissions` + `version` (Optimistic-Locking).

```
kunden      (id, ownerId, name, data{branche,notizen}, version, ts)
  └─ prozesse   (id, kundeId→kunden, ownerId, name, emmaPlanNr, data{beschreibung,systeme,kritikalitaet}, version, ts)
       ├─ baustaende  (id, prozessId→prozesse, datum, status, quelle, data{…}, reviewerId, version, ts)
       └─ artefakte   (id, prozessId, baustandId?, filename, mimeType, s3Key, data{extractedText}, ts)
```

**Der Baustand ist das Herz.** `baustand.data` (jsonb) trägt:

| Feld | Inhalt | Quelle |
|---|---|---|
| `dimensionen` | je D1–D10 + D6b: `{ist, soll, relevanz, beleg, provenienz, konfidenz, maskeGrund}` | Checker-Hinweise + LLM + Analyst |
| `befunde` | `PMFinding[]` (Prüfmuster-Befunde mit Schwere/Provenienz/Empfehlung) | Checker |
| `kennzahlen` | `{gesamtRg, rgStar, rgq, seQuotient, limiter[], notenZeile}` | `scoring.ts` (deterministisch) |
| `llmBegruendung` | je Dim eine kurze Begründung (Entwurf) | LLM |
| `topHebel` | priorisierte Maßnahmen `{dim, titel, wirkung}[]` | deterministisch (`hints.ts`) |
| `narrativ` | Kundenfassung (Gold-Form): exec/prosa/je-Dim purpose+beleg+recs | LLM (on-demand) |
| `bauanleitung` | `{zielLevel, einleitung, karten[]}` — je Karte abhakbare Schritte + Status + Feedback (D-061) | LLM + Analyst-Edits |

**Statusmaschine des Baustands:** `entwurf → in_review → freigegeben` (Mensch-Review-Gate). Baustände sind **append-only je Prozess** — mehrere Stände tragen die spätere Verlaufs-/Vergleichs-Sicht (Baustein c) ohne Migration.

**Typen:** alle in `backend/src/apps/echoloop/types.ts` + `checker/types.ts`. Für Erweiterungen ist dies der erste Anlaufpunkt.

---

## 4. Die Analyse-Pipeline (Baustein a) — end-to-end

`analysis.ts` `analyseProzess()` orchestriert; die Route `POST /prozesse/:id/analyse` streamt den Fortschritt per SSE (Phasen-Events → Frontend-Stepper).

```
Upload (1..n PDFs, eine Prozess-Familie)
  → pdftotext -layout   (extract.ts, poppler; NICHT Markitdown — Layout bewahrt Key:Value)
  → runChecker()        (checker/) — deterministische Befunde + Call-Graph
  → deriveHints()       (checker/hints.ts) — Level-Vorschlag + Beleg je Dimension
  → LLM-Vor-Benotung    (Qwen 3.5 Instruct) — verfeinert Levels + Begründung, Hinweise als Ausgangspunkt
       ↳ FALLBACK: LLM nicht erreichbar → Ist = Checker-Vorschlag (nicht „alles 0")
  → computeScores()     (scoring.ts) — RG/RGQ/SE deterministisch
  → Baustand-Entwurf    (status 'entwurf') mit dimensionen/befunde/kennzahlen/topHebel/llmBegruendung
```

Danach im **RGA-Review** (Frontend): Analyst prüft/korrigiert Ist+Soll+Relevanz je Dimension (Live-Recompute über `POST /scoring`), erzeugt on-demand Kundenfassung/Bauanleitung, **gibt frei** (`POST /baustaende/:id/freigabe`).

**Kern-Trennung (verbindlich):** Prüfmuster + Kennzahlen-Mathematik sind **deterministisch** (Code). Das LLM liefert **nur** Level-Einordnung + Prosa. Zahlen nie vom LLM rechnen lassen.

---

## 5. Der Checker — Methodik-Kern (deterministisch)

`checker/` reimplementiert `PRUEFMUSTER-KATALOG.md` + Bautechnik-Signale in TypeScript, arbeitet auf dem `pdftotext -layout`-Text (property-zentrisch, robust gegen Spalten-Drift).

**Parser** (`parse.ts`): Prozessnummer/Name, Schritt-Blöcke, Call-Graph (TestCaseID), Schleifen (MaxLoopCount/ResetBeforeStart), OCR-Reads (Subject:Text/RegEx + Timeout + Mode), Variablen-Tabelle, **feste Wartezeiten** (Subject:Time + Timeout, ms→s), **feste Klick-Positionen** (X/Y ohne Anker), **Hardcoding-Pfade** (`C:\…`), **Klartext-Kennwort**, Datums-Literale.

**Prüfmuster** (`patterns.ts`):

| PM | Aspekt | Dimension | Entscheidbarkeit |
|---|---|---|---|
| PM-01 | Endlosschleife (`ResetBeforeStart:True` ohne gebundenen Zähler) | D2/D4 | maschinell 🔴 |
| PM-02 | Waise / Master / Referenz-ohne-Export (Call-Graph) | D9 | maschinell (🔴/⚪/❓) |
| PM-03 | Toter Aufruf (`TestCaseID:-1`) | D3/D9 | maschinell 🔴 |
| PM-04 | Feste `MaxLoopCount` — neutraler Prompt (Notdeckel vs. geraten) | D2 | ❓ (Mensch) |
| PM-04b | Reset-Vollständigkeit innere Schleife | D2/D3 | ❓ (Panel/Graph) |
| PM-09 | OCR/ABBYY-Kontingent (Aufruf-Baum-Multiplikator) | D2/D4 | maschinell (Rang) |
| PM-10 | Seed vs. gebunden (Datums-Kohorten) | D6b | 🟢 Kohorte / ❓ isoliert |
| **PM-13** | **Feste Wartezeiten** (blind ≥0,5 s, Manipulationsknoten abgegrenzt) | **D2** | maschinell |
| **PM-14** | **Feste Klick-Position** (absolut / X:0=Fund-Bindung ❓) | **D1** | maschinell / ❓ |

**Einheitliches Befund-Schema** `PMFinding`: `{pm, aspekt, prozessNr, schrittId?, befund, beleg, provenienz([G Text]/[Graph]/[Panel]/[Interview]), schwere(kritisch/hoch/mittel/frage/niedrig), seedOrBug?, empfehlung, dimensionen[]}`.

**Validierung:** PM-09 reproduziert auf realen Exporten den im Katalog dokumentierten Aufruf-Baum-Multiplikator **×16200** für Heinzl-1074 (Kette 1069→1070→1074). Getestet gegen synthetische Fixtures + reale Nacharbeit-Familie.

---

## 6. Scoring — Soll-Profil-Methode (D-062)

`scoring.ts` — reine Funktionen, `scoring.test.ts` sichert die Pilot-Rechnung.

- **RGQ** = Σ Ist(D1..D10) / 50 (absolute Quote, Maske zählt hier nicht)
- **Gesamt-RG** = höchste Stufe, deren Pflicht-Level-Raster (WB44 §3b) voll erfüllt ist (weakest link)
- **RG\*** = min{ Ist | relevanz=1 } über alle Dims inkl. D6b (relevanz-gefilterter harter Reifegrad)
- **SE-Quotient** = Σ r·min(Ist,Soll) / Σ r·Soll (Über-Soll gekappt; Anti-Over-Engineering eingebaut)
- **D6b** geht in SE + RG* ein, **nicht** in RGQ/Pflicht-Raster (Skalen-Kompatibilität)
- Maskierte Dimensionen (relevanz=0) nur mit Owner-Begründung; nie als 0 dargestellt

**Gold-Abgleich (IHK-DA Veranstaltungsfeedback):** Auf den Gold-Levels liefert das Scoring **exakt RG0 · RGQ 20 %** — identisch. Die Kennzahlen-Mathematik ist gold-konform; die Differenzen zum Gold liegen ausschließlich in der Evidenz-/Level-Ableitung (s. §7).

---

## 7. Level-Hinweise (deterministisch) + LLM-Zusammenspiel

`checker/hints.ts` `deriveHints()` übersetzt die Checker-Signale in einen **konservativen Ist-Level-Vorschlag + Belegzeilen je Dimension** + priorisierte **Top-Hebel**. Wo die Statik nichts entscheiden kann (D3/D4/D5/D7 Verzweigung/Recovery), niedriger Vorschlag + ❓-Beleg.

**Drei Funktionen der Hinweise:**
1. **Ausgangspunkt fürs LLM** (im Prompt) — das Modell verfeinert statt zu raten.
2. **Fallback-Boden** — LLM nicht erreichbar → Ist = Vorschlag (nicht „alles 0").
3. **Beleg-Vorbefüllung** im Reifegrad-Panel.

**Messung (real, ganz ohne LLM):** Der Checker-Boden trifft auf der Nacharbeit-Familie **9/10 Gold-Dimensionen exakt** (D1=2 D2=1 D3=1 D4=0 D5=1 D6=1 D7=1 D8=2 D10=0). Einzige Abweichung: **D9** (Modularität) — die Monolith-Heuristik greift familien-, nicht einzelprozess-weise. → konkrete Verbesserung, s. §12.

---

## 8. LLM-Nutzung & Modell-Konfiguration

Drei LLM-Schritte, alle über `services/llm.ts` mit **per-App-`modelOverride`** (keine Auswirkung auf andere Apps), per ENV umschaltbar:

| Schritt | Datei | Modell (Default) | Latenz (gemessen) |
|---|---|---|---|
| Vor-Benotung D1–D10 | `analysis.ts` | Qwen 3.5 **Instruct** (`qwen3-5-a3b-35b-256k`) | ~7 s |
| Kundenfassung (Narrativ) | `narrative.ts` | Qwen 3.5 **Instruct** | ~17 s |
| Bauanleitung | `bauanleitung.ts` | Qwen 3.5 **Instruct** | ~15 s |

**ENV-Overrides:** `ECHOLOOP_LLM_MODEL`/`_PROVIDER`/`_TIMEOUT_MS`, `ECHOLOOP_NARRATIV_MODEL`/`_TIMEOUT_MS`, `ECHOLOOP_BAUANLEITUNG_MODEL`/`_TIMEOUT_MS`.

**Wichtige Betriebsrealität:** Die **Reasoning-Variante** (`qwen3-5-a3b-35bthinking-256k`) ist am aktuellen Adacor-Endpoint **zu langsam** (>180 s, HTTP-Timeout „The operation timed out") und damit praktisch nicht nutzbar — deshalb überall Instruct als Default. Der Code ist auf Reasoning umschaltbar, sobald das Endpoint schneller ist. (Die Plattform standardisiert generell auf Adacor Qwen 3.5.)

**Governance-Hinweis (für Seb):** Die eingebetteten Prompts (Benotungs-Rubrik WB44, D-050-Schreibregeln, Bau-Methodik WB25/44d/50) sind **Arbeits-IP auf Basis der öffentlichen Standards** — nicht das finale Kern-IP-Prompt-Paket. Sie gehören perspektivisch unter die YNEO-Regel-Governance (K-Backlog) + einen Golden-Data-Runner (O-16), s. §13.

---

## 9. Kundenfassung (Narrativ-Synthese)

`narrative.ts` `synthesizeNarrativ()` — on-demand nach dem Review. Erzeugt die kundenfähige Gold-Fassung nach **D-050-Sprachregeln** (jargonfrei, wertschätzend, Anerkennung zuerst, ❓ ehrlich, „neue-Kollegin"-Bild, keine Benchmarks):

- `exec` (was die Prozesse tun · Stärken · Kern-Befunde)
- `prosa[]` (die „neue-Kollegin"-Erzählung)
- je Dimension: statische Zweck-Frage (Laiensprache) + Beleg-Prosa + 2–3 Empfehlungen
- `stabilityNote`

Route `POST /baustaende/:id/narrativ` als **SSE + Heartbeat** (für den Fall langsamer Modelle). Robuster Parser streift `<think>`-Blöcke ab. Verifiziert: gold-konforme Ausgabe.

---

## 10. Bauanleitungen (D-061 interaktiv)

`bauanleitung.ts` `generateBauanleitung()` — leitet aus der RGA (Reifegrad-Lücken Ist<Soll + Befunde + Top-Hebel + offene ❓) eine priorisierte, umsetzbare Bauanleitung zum Ziel-Reifegrad ab, **methodisch geerdet** in eingebettetem Wissen aus:
- **WB25** Bau-Prinzipien-Kanon + 7 Absicherungs-Muster
- **WB44d** Bau-Ansätze je Dimension
- **WB50** 6-Punkte-ToDo-Struktur

**Bau-Logik-Reihenfolge (wie Gold-Vorlage):** zuerst offene ❓ klären → kundenwirksame Fehler (z. B. Doppelversand D5) → Level-Blocker → Härtung (Timing D2, Anker D1, Konfig D6). Karten mit **Schritt-Zitaten aus den Befunden** (z. B. „P1074 S40/S43/S55").

**D-061 interaktiv:** je Karte abhakbare Schritte + Status (offen/in Arbeit/erledigt/Frage/anders gebaut) + Feedback-Feld; Stand am Baustand gespeichert (`baustand.data.bauanleitung`). Das ist die **Vorstufe zum nativen Bau-Board (Baustein b)** — es fehlt noch die append-only Ereignis-Historie und das geteilte Kunde↔Team-Board.

---

## 11. Frontend / UX

`frontend/src/apps/echoloop/` (Inline-Styles aus `theme.js`, deutsche UI, YNEO-Lila nur als Fills/Level-Rampe, nie als Card-Border):

- **`EcholoopPage.jsx`** — Übersicht: Kunden (aufklappbar) mit ihren Prozessen, Anlegen inline.
- **`ProzessDetail.jsx`** — die Prozess-Akte, Tabs **Übersicht · RGA-Review · Analysen**. Der RGA-Review ist in **Sub-Tabs** gegliedert: *Kennzahlen & Profil · Befunde · Bauanleitungen · Kundenfassung*.
- **`components/`**: `Dropzone` (Upload, SSE-Fortschritt), `ReifegradPanel` (Ist/Soll als Level-Rampe L0–L5, Relevanz-Maske, Live-RG/RGQ/SE), `KennzahlBadges`, `BefundeListe`.
- Header/Menü linksbündig, Trenner über volle Breite. Upload zeigt Phasen-Stepper mit Sekundenzähler.

---

## 12. Konkrete Erweiterungs-Andockpunkte (das Wichtigste für die Planung)

Für jede geplante Erweiterung — **wo genau** sie im Code andockt:

**Neues Prüfmuster / Bautechnik-Signal**
- Parser-Feld in `checker/parse.ts` (+ Typ in `checker/types.ts`) → Pattern-Funktion in `checker/patterns.ts` → in `runChecker()` (`checker/index.ts`) aufnehmen → optional Level-Hinweis in `checker/hints.ts`. Kein anderer Code muss angefasst werden.

**Compass → belegtes Soll (Baustein e)**
- Der SE-Quotient rechnet **bereits** gegen `dimensionen[d].soll`. Ein Compass-Modul muss nur die Soll-Werte (+ Evidenz-Kette, Konfidenz) je Dimension in den Baustand/Prozess schreiben. Andockpunkt: ein neuer Service, der `dimensionen[d].soll` + `beleg`/`konfidenz` setzt; das Ziele-Register als eigene Entität (analog Kunde/Prozess). Die Panel-UI (Ist/Soll/Relevanz/Beleg) rendert das Soll schon.

**Bau-Board nativ (Baustein b)**
- Die Bauanleitung ist schon interaktiv + persistiert. Für das „native Board" fehlen: (1) eine **Ereignis-Tabelle** (append-only: wer/wann Häkchen/Status/Feedback gesetzt) — neues `elEreignisse` im Schema; (2) ein geteilter Zugriff Kunde↔Team (eigene, engere Permission je Board). Andockpunkt: `bauanleitung`-Edits gehen heute über `PUT /baustaende/:id`; künftig über Board-Events.

**Verlauf + Vergleich (Baustein c)**
- Daten liegen vor (mehrere `baustaende` je Prozess, je mit `kennzahlen`). Andockpunkt: (1) eine Aggregat-Route `GET /prozesse/:id/verlauf` (Kennzahlen-Zeitreihe) + eine Diff-Route (Baustand A↔B je Dimension) + Portfolio-Aggregat über Prozesse eines Kunden; (2) Frontend: SVG-Trend (Muster: PM `GanttRoadmap`/`PhaseMixBar`). Ein neuer Sub-Tab „Verlauf" oder eine Kunden-/Portfolio-Ansicht.

**Zwilling-Graph (Baustein d)**
- Neu. Kunde/Prozess sind die Wurzeln. Andockpunkt: ein Graph-Speicher (ADACOR hat Neo4j/PG-Vector) + Import-Konverter aus den Echo-Loop-Registern; Rechte je 🔒-Stufe. **Gate O-14 zuerst** (Layer-Besitz/IP).

**Kontext-Chat „Echo fragen" (Baustein f)**
- Die Workplace-Assistants existieren nativ. Andockpunkt: ein Chat-Panel, das die Prozess-Akte (Baustand + Befunde + Ziele) als Kontext bekommt; Scope-Präfix Prozess ▸ Kunde ▸ Gesamt. Rückfluss von Chat-Ergebnissen als Bau-Karte/Ziel.

**K1-Report-Export (Kunden-Deliverable, P4)**
- Alles Nötige liegt im Baustand (`narrativ` + `bauanleitung` + `kennzahlen` + `dimensionen`). Andockpunkt: ein Renderer, der daraus das **YNEO-branded HTML/PDF** erzeugt (die Gold-HTMLs `_ORG-AUSWERTUNG…`/`_RGA_…` als Vorlage; Design-System WB57; HTML→Chrome-headless→PDF wie im Repo vorhanden). Neue Route `GET /baustaende/:id/report.(html|pdf)`.

---

## 13. Roadmap-Vorschlag (priorisiert, mit Begründung)

| Prio | Erweiterung | Warum jetzt | Aufwand | Abhängigkeit |
|---|---|---|---|---|
| **P1** | **Verlauf/Vergleich (c)** | Datenbasis liegt fertig vor; sofort sichtbarer Produkt-Wert (SE-Zeitreihe = Kern-Story der Spec); rein additiv | mittel | — |
| **P1** | **K1-Report-Export** | Baustand hat schon alle Inhalte; macht die App kundenfähig (Deliverable) | mittel | Design-System WB57 |
| **P2** | **Compass → Soll (e)** | Hebt den SE-Quotienten von „Ist=Soll-Default" auf **belegtes Soll** — erst dann misst die RGA gegen die Bestellung | groß | Compass-Fragebogen/Scoring portieren |
| **P2** | **Bau-Board nativ (b)** | Ereignis-Historie + geteiltes Board — löst den Rückläufer-Loop endgültig | mittel–groß | Ereignis-Tabelle |
| **P3** | **Checker-Feinschliff** | D9-Modularität je Einzelprozess (schließt die 10. Gold-Dimension); weitere Detektoren D3-Verzweigung, PM-05/06/08 | klein–mittel | — |
| **P3** | **Golden-Data-Runner (O-16)** | Regressions-Gate über LLM-Outputs (kein Skill-Release ohne grün) — Governance-Pflicht | mittel | Fixtures aus realen Analysen |
| **P4** | **Zwilling-Graph (d)** | Kern-IP, sensibel | groß | **Gate O-14, AVV, C5** |
| **P4** | **Kontext-Chat (f)** | Beratungs-Rückfluss | mittel | Assistants-Verdrahtung |

**Empfohlener nächster Schritt:** **Verlauf/Vergleich (c) + K1-Report-Export** — beide additiv, beide auf vorhandenen Daten, beide mit sofortigem Produkt-Wert (die Zeitreihe ist die Story der Spec; der Report macht die App verkaufbar). Compass (e) danach, weil es das methodische Fundament (belegtes Soll) trägt.

---

## 14. Methodik-Entscheidungen, die Seb validieren sollte

Wo die App pragmatische Setzungen getroffen hat, die YNEO-Governance-Entscheid brauchen:

1. **Interim-Soll = Ist** beim Entwurf (bis Compass): SE ist dadurch trivial 100 % im Entwurf. Soll-Herleitung ist eine Methodik-Frage (Kritikalität/Compass). → Soll die App ein Default-Soll aus der Kritikalität (WB44c) ableiten, bis Compass da ist?
2. **D9-Modularität-Heuristik** (familien- vs. einzelprozess-weise) — die einzige Gold-Abweichung.
3. **PM-04b / PM-10 als ❓** (kein Hard-Fail) — bewusst konform zum Katalog; ok?
4. **Eingebettete Prompts** (Benotung/Narrativ/Bauanleitung) sind Arbeits-IP auf Basis WB44/WB25/44d/50/D-050 — **nicht** das formalisierte Kern-IP-Prompt-Paket. Freigabe/Formalisierung über K-Backlog + Golden-Data-Runner offen (O-14-Klärung).
5. **Kein Golden-Data-Gate** aktiv: heute nur Unit-Tests (deterministische Ebene), keine Regressions-QS über die LLM-Ausgaben. Die Spec verlangt „kein Skill-Release ohne bestandenen Runner-Lauf".

---

## 15. Betrieb, Config, Gates

- **App freischalten:** Admin weist echoloop einer Gruppe zu (Einstellungen → App-Berechtigungen), sonst „Wartet auf Konfiguration".
- **System-Abhängigkeit:** `pdftotext` (poppler-utils) muss im Container liegen (wie ffmpeg/tesseract). Ohne → Extraktion schlägt fehl (sauberer Fehler).
- **S3:** optional. Konfiguriert (`FLOW_S3_*`) → Export-PDFs nach S3 (`s3Paths.echoloopExport`); sonst läuft die Analyse mit gecachtem Textextrakt weiter (kein Binär-Persist).
- **LLM:** Adacor Qwen 3.5 Instruct (s. §8). Timeouts großzügig; Fallback-Boden fängt Ausfälle.
- **Gates vor Produktivdaten (Spec):** O-14 (Layer-Besitz), AVV Art. 28(4), C5, Golden-Data-Runner grün. Zwilling-Rohdaten + Kern-IP-Prompts bewusst noch draußen.

---

## 16. Test-/Qualitätsstand

- **26 Unit-Tests** (`bun test src/apps/echoloop/`): Scoring (Pilot-Rechnung exakt), Checker (PM-01…14 gegen Fixtures + Katalog-Validierung), Hints (Level-Vorschläge), Parser (Narrativ/Bauanleitung `<think>`-robust). 0 tsc-Fehler.
- **HTTP-Smoke-Test** über den vollen Stack verifiziert (Auth → CRUD → Upload realer Exporte → Review → Freigabe).
- **Gold-Abgleich** dokumentiert (Scoring exakt, 9/10 Ist-Dimensionen deterministisch).
- **Lücke:** kein Golden-Data-Regressions-Gate über die LLM-Ausgaben (s. §14.5).

---

## 17. Dateiübersicht (Andockpunkte auf einen Blick)

**Backend** `backend/src/apps/echoloop/` (~2.7k Zeilen):
`index.ts` (AppConfig) · `types.ts` (Domänen-Typen) · `storage.ts` (CRUD + Optimistic-Locking) · `concurrency.ts` · `scoring.ts` (+test) · `extract.ts` (pdftotext) · `analysis.ts` (Pipeline-Orchestrierung + Vor-Benotung) · `narrative.ts` (+test, Kundenfassung) · `bauanleitung.ts` (+test) · `routes.ts` + `routes/{kunden,prozesse,baustaende,analyse,_shared}.ts` · `checker/{parse,patterns,hints,index,types}.ts` (+tests).
Geteilt: `db/schema/echoloop.ts` · `drizzle/0028_echoloop.sql` · `apps/registry.ts` · `routes/apps.ts` · `storage/paths.ts` (`echoloopExport`).

**Frontend** `frontend/src/apps/echoloop/` (~1.2k Zeilen):
`EcholoopPage.jsx` · `ProzessDetail.jsx` (Tabs + RGA-Sub-Tabs + Bauanleitung/Kundenfassung) · `api.js` · `components/{Dropzone,ReifegradPanel,KennzahlBadges,BefundeListe}.jsx`.
Geteilt: `App.jsx` (Routen) · `components/Sidebar.jsx` (Nav-Icon).

**Referenz-Material im Repo:** `docs/Echo-Loop-App/` (Spec, Standards, Wissensbasis, Gold-Analysen) · reale EMMA-Exporte `docs/EMMA-Echo-Loop/Input/Case-Klinik/` (Testdaten) · `docs/echoloop-app-fundament-2026-07-30.md` (Bau-Chronologie).
