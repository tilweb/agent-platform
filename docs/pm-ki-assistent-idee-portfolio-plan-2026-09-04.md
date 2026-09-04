# PM-App: KI-Assistent für Projektidee & Portfolio (+ generalisiertes Masterclass-Wissen)

**Datum:** 2026-09-04
**Status:** Plan (freigegeben), Umsetzung startet mit PM1
**Worktrees:** main (Postgres) **und** `../agent-platform-railway` (`demo/messe`, YAML) — beide!

---

## 1. Motivation

Wir sind nach dem Start mit dem **Projektauftrag** zunehmend in eine klassische PM-Management-Anwendung
abgedriftet und haben die ursprüngliche Idee — **Projektmanagement mit KI neu zu denken und zu
unterstützen** — aus dem Blick verloren. Erster Schritt zurück: Die KI-Unterstützung, die der
Projektauftrag über **Wissen, Chat und Analyse** (der „KI-Balken") bereits hat, auch auf
**Projektidee** und **Portfolio** bringen. RuhrPM bereitet dafür zwei neue Masterclass-Wissenssektionen
(Idee, Portfolio) auf. **Statusbericht** ist durch die aktuelle Masterclass gut genug abgedeckt und wird
separat im Nachgang behandelt.

## 2. Ist-Zustand (Code-Analyse 2026-09-04)

Der KI-Balken beim Projektauftrag ist die Komponente **`KnowledgePanel`** (Wissen + Analyse + Chat),
gemountet in `WizardPage` für Step 1–7. Das Masterclass-Wissen ist **pro Step** organisiert und wird
**gezielt** in Chat und Analyse dieses Steps injiziert:

- **Wissen:** 7 YAML-Dateien `backend/data/apps/projektmanagement/knowledge/step_0X_*.yaml`
  (~1–2 KB je Step, ~9.500 Tokens für die gesamte Masterclass). `knowledge.ts` → `getStepKnowledge(step)`.
- **Analyse:** `POST /analyse/step/:stepNumber` prüft die Step-Eingaben gegen die step-eigenen
  Prüfkriterien, liefert `masterclassAnalysis` (Stärken/Schwächen/Hinweise/Score) + `konsistenzAnalysis`.
- **Chat:** `POST /knowledge/:step/chat` (SSE-Stream), geerdet auf Step-Wissen + aktuelle Eingaben.
- **Verdrahtung ist an jeder Ebene hart auf die 7 Auftrag-Steps gebunden:** `STEP_FILES` (knowledge.ts),
  `STEP_LABELS` (MasterclassEditor), `BACKEND_STEP_MAP` (KnowledgePanel), `:stepNumber` (routes.ts).
- **Wissen ist file-basiert in BEIDEN Worktrees** (kein Postgres) → die Wissens-/Editor-/KI-Balken-
  Logik ist weitgehend worktree-identisch.
- **Analysen:** `StoredStepAnalysis` (step, stepName, timestamp, masterclassAnalysis, konsistenzAnalysis).
  `AnalysisResult.jsx` zeigt bereits „Analyse vom {timestamp}". **Keine** Stale-Erkennung
  (der analysierte Datenstand wird nicht mitgespeichert).

**Kernbefund zur Granularität:** Es wird NICHT „das komplette Wissen" injiziert, sondern pro Step —
diese Feinkörnigkeit existiert also schon. Die Wissensdateien sind klein; ein ganzes Element-Wissen
komplett zu injizieren wäre kontext-/kostentechnisch unproblematisch.

## 3. Designentscheidung: „(Element, Segment)" mit Fallback

Statt einer vollen „welches Segment für welchen Step/Tab"-Matrix (unnötig kleinteilig) generalisieren wir
von **Step-Nummer** auf **`element` × `segment`** mit **Fallback**:

- `element ∈ {projektauftrag, projektidee, portfolio, statusbericht}` (Statusbericht vorerst nur
  registriert, nicht verdrahtet).
- `segment` = Wissensschlüssel im Element. **Wizards** (Auftrag, Idee) → ein Segment je Step; **Portfolio**
  (Dashboard) → ein einziges Segment `_general`.
- **Wissens-Layout:** `knowledge/<element>/<segment>.yaml`; fehlt ein Segment → Fallback auf
  `knowledge/<element>/_general.yaml`. Bestehende `step_0X_*.yaml` werden als `projektauftrag/step_0X`
  weitergeführt (Back-Compat, kein Verhaltenswechsel für den Auftrag).
- Eine zentrale **Element-Registry** (Segmente + Labels je Element) ersetzt `STEP_FILES`, `STEP_LABELS`,
  `BACKEND_STEP_MAP`.

**Begründung:** Granularität lohnt bei Ausfüll-**Wizards** (gezielte Analyse je Step gegen step-eigene
Kriterien) — bei **Portfolio** (Analyse-Dashboard) genügt ein Element-Wissen. Der Fallback macht per-
Segment-Dateien optional statt Pflicht.

## 4. Persistenz + Zeitstempel + Stale-Erkennung

Analysen werden **persistiert** — aber bewusst nur als **Sicherung**, damit man die Empfehlungen
abarbeiten kann, ohne die Analyse versehentlich zu verlieren. **Nicht** als „Wahrheit": Sobald die
zugrunde liegenden Daten geändert wurden, ist die Analyse veraltet und wird ehrlich so markiert.

- **Zeitstempel:** „Analyse vom {Datum, Uhrzeit}" (existiert bereits, wird für alle Elemente genutzt).
- **Stale-Erkennung (neu, präzise pro Segment):** `StoredStepAnalysis` um **`dataHash`** erweitern —
  Hash genau der Daten, die in diese Segment-Analyse geflossen sind (Output des Element-Daten-Extraktors).
  Beim Anzeigen: aktuellen Segment-Daten-Hash neu berechnen; `stale = gespeicherter ≠ aktueller Hash`.
  - Nicht stale → nur Zeitstempel.
  - Stale → Analyse bleibt sichtbar (Empfehlungen abarbeitbar) **plus** Badge „⚠ Daten seit der Analyse
    geändert — ggf. veraltet, neu analysieren".
  - Präzise pro Segment (Änderung an Idee-Step 3 macht nicht Step 5 veraltet). Da `AnalysisResult`
    geteilt ist, bekommt der **Auftrag das Badge automatisch mit** (Konsistenz-Bonus).
- **Speicherort (worktree-divergent):** `StoredStepAnalyses` (keyed by Segment) an der jeweiligen
  Entität — **main: Postgres** (jsonb-Update), **railway: YAML**.

## 5. Umsetzung in Wellen (jede in BEIDEN Worktrees, Commit je Branch)

| Welle | Inhalt | Worktree-Charakter |
|---|---|---|
| **PM1** | Backend-Generalisierung: Element-Registry + `(element, segment)`-Auflösung mit Fallback in `knowledge.ts`; `analysis.ts`-Prompts auf `(element, segment, entity)`; Endpunkte `/analyse/:element/:segment`, `/knowledge/:element[/:segment]`, `/knowledge/:element/:segment/chat` **+ Auftrag-Alias**; `dataHash` in `StoredStepAnalysis`. | identisch |
| **PM2** | `MasterclassEditor` + Einstellungen: Element-Umschalter; 2 neue Sektionen (Idee, Portfolio). | identisch |
| **PM3** | KI-Balken in **Projektidee**: `KnowledgePanel` generalisiert (`element`+`segment`+`entity`), in `IdeeWizardPage` je Step gemountet; **Idee-Daten-Extraktor**; Analyse-Persistenz + Stale. | Logik identisch · **Storage divergent** |
| **PM4** | KI-Balken in **Portfolio**: ein Element-Wissen (`_general`), im passenden Tab; **Portfolio-Daten-Extraktor** (Kennzahlen/Projektliste); Analyse-Persistenz + Stale. | Logik identisch · **Storage divergent** |
| **PM5** | RuhrPM-Wissensinhalte (Idee/Portfolio) einspielen (bis dahin Platzhalter) + End-to-End-Durchklick in beiden Worktrees. | identisch |
| — | **Stale-Badge + Timestamp** im geteilten `AnalysisResult` (in PM1/PM3 mitgezogen). | identisch |

## 6. Zwei-Worktree-Bilanz

- **Identisch** (einmal denken, in beide übertragen, je Branch committen): `knowledge.ts`, `analysis.ts`,
  `routes.ts`, gesamtes Frontend (`KnowledgePanel`, `AnalysisResult`, `MasterclassEditor`,
  `IdeeWizardPage`, `PortfolioDetail`, Einstellungen), die Wissens-YAMLs.
- **Divergent** (nur PM3/PM4, nur die Persistenz der Analysen): Postgres-Update (main) vs. YAML (railway)
  an Idee/Portfolio-Entität. Beim Stagen in beiden Worktrees **nur die eigenen PM-Dateien** explizit —
  der railway-Worktree hat vorbestehende fremde Änderungen (CHANGELOG, registry.yaml,
  Connection-Provider), die nicht mit reindürfen.

## 7. Verifikation je Welle

- **PM1:** Projektauftrag-Analyse/Chat unverändert (gleiche Prompts/Scores; Alias-Routen greifen);
  Stale-Badge greift bei simulierter Datenänderung; tsc + Tests grün.
- **PM2:** Editieren/Speichern der neuen Element-Wissensdateien; Auftrag-Editor unverändert.
- **PM3/PM4:** Durchklick; Persistenz übersteht Reload; nach Edit korrekt „veraltet"; tsc + Tests grün in
  **beiden** Worktrees.

## 8. Offene Abhängigkeiten / Annahmen

- **RuhrPM-Wissen** (Idee-/Portfolio-Masterclass) kommt nach — bis dahin Platzhalter-YAMLs; Editor macht
  sie befüllbar.
- **Portfolio-Datenmodell:** Dashboard mit 4 Tabs; die Analyse arbeitet auf Portfolio-Kennzahlen +
  Projektliste (Extraktor in PM4 zu definieren).
- Statusbericht bleibt bewusst außen vor (nur Registry-Eintrag), separate Verdrahtung im Nachgang.
- `data/config/` und `backend/data/apps/registry.yaml` sind Deployment-Seeds — bei Berührung aufpassen.
