# WZ-Branchen-Matcher — IHK-Feedback: Analyse & Maßnahmen (2026-09-15)

## Kontext

Feedback der IHK zur `wzbar-matcher`-App:

1. **Verschlüsselungstiefe**: Es wird nicht immer die tiefstmögliche/spezifischste Ebene ausgegeben. Beispiel: Für „Abbruch" wäre `43110` möglich, ausgegeben wird `4311`.
2. **Synonymik**: „Persönlich haftender Gesellschafter" wird nicht als dasselbe wie „Komplementär" erkannt.

Beide Fälle wurden lokal mit der echten Pipeline (Splitter → Embedding-Retrieval → LLM-Classifier, ohne Persistenz) reproduziert bzw. analysiert.

## Analyse

### Fall 1: „Abbruch" → 4311 statt 43110 (Ebenen-Problem)

- Der Katalog enthält `4311` und `43110` mit **exakt identischem Text** („Abbrucharbeiten"). Systematisch: Jede nicht weiter untergliederte Klasse hat genau eine textgleiche Unterklasse (`XXXX0`) — **474 solcher textgleichen Einzelkind-Paare** im Katalog.
- Identischer Text → identisches Embedding → Similarity-Gleichstand (je 0.9214). Beide landen in den Top-20; durch den Tie-Break (stabile Sortierung, Katalogreihenfolge) steht die **4-stellige immer auf Platz 1**.
- Die Ebenen-Entscheidung hing damit allein am LLM-Prompt („bei Unsicherheit die kürzere Ebene") — bei zwei textidentischen Kandidaten hat das Modell außer der Codelänge kein Signal.
- Verstärker: Der `sanitizeResult`-Fallback (LLM liefert ungültigen Code → Top-1-Retrieval) landete wegen des Tie-Breaks ebenfalls immer auf der 4-stelligen.
- Lokal (Qwen3 30B) wählte das LLM in 3/3 Läufen `43110`; die IHK-Ausgabe `4311` ist dennoch plausibel (anderes gepinntes Apps-Modell, Nichtdeterminismus, Fallback-Pfad). Die Audit-Records der IHK-Instanz (`wzbar.matches`, inkl. `retrievalTopK`) können den konkreten Lauf zeigen.
- **Gegenbefund**: Bei „Abbrucharbeiten" wählte das LLM 3/3 die **zu spezifische** `431101 Entkernung von Gebäuden` (95 %). Die Tiefen-Heuristik ist in beide Richtungen wacklig.

**Fachlicher Kern**: Die offizielle Verschlüsselungsebene ist die Unterklasse (5-stellig). Wenn eine Klasse nicht untergliedert ist, ist die Wahl zwischen `XXXX` und `XXXX0` keine fachliche Entscheidung — sie sollte dem LLM gar nicht gestellt werden. Das ist deterministisch lösbar.

**Wichtige Einschränkung für die Lift-Regel**: „Genau ein Kind" allein reicht NICHT als Bedingung. Die nationalen 6-/7-stelligen Codes sind **keine vollständigen Partitionen** ihrer Elternebene — 110 Fälle mit genau einem Kind, aber abweichendem Text (z. B. `10510 Herstellung von Milcherzeugnissen` → einziges Kind `105101 Käserei`; Molkerei ≠ Käserei). Sicher ist nur: **genau ein Kind UND textgleich**.

### Fall 2: „persönlich haftender Gesellschafter" (Retrieval-Recall-Problem)

- „Komplementär" → `701041 Komplementärgesellschaften` auf Retrieval-Platz 1 (0.908), LLM wählt 3/3 korrekt.
- „persönlich haftender Gesellschafter" → `701041` ist **gar nicht in den Top-20**. Der Katalogeintrag besteht nur aus dem einen Wort „Komplementärgesellschaften" (Kurz- = Langtext, keine Synonyme); die juristische Paraphrase hat weder lexikalische noch ausreichende Embedding-Nähe. Der Whitelist-Schutz verhindert (korrekt) die Nennung, das LLM weicht auf `682023 Besitzunternehmen` aus — mit 95 % Konfidenz, überkonfident-falsch.
- Das ist ein **Stufe-2-Problem** (Retrieval): Prompt-Tuning kann es prinzipiell nicht heilen; BM25-Hybrid hilft ebenfalls nicht (null Wort-Überlappung). Es ist eine Fehlerklasse, kein Einzelfall — der Katalog hat viele Ein-Wort-Einträge.

## Maßnahmen

| # | Maßnahme | Löst | Aufwand | Status |
|---|----------|------|---------|--------|
| M1 | Ebenen-Normalisierung (deterministischer Lift) | Fall 1 | ~0,5 T | **umgesetzt (2026-09-15)** |
| M2 | Eval-Harness / Golden Set (Recall@20 + Precision@1) | Messbarkeit | ~1 T | offen |
| M3 | Query-Expansion im Splitter (Normalisierungs-Variante mit-embedden, Union per Max-Similarity) | Fall 2 (konkret) | ~1 T | offen |
| M4 | Alias-Anreicherung des Katalogs (Destatis-Stichwortverzeichnis + kuratierte IHK-Begriffe, separate Vektoren pro Code) | Fall 2 (Fehlerklasse) | ~2–3 T | offen |

Reihenfolge: M1 → M2 → M3 → M4. LLM-berührende Änderungen (Prompt-Korrekturen, M3, M4) erst mit M2-Messung verifizieren.

### M1 — Umsetzung (dieses Dokument begleitender Commit)

Neue Datei `backend/src/apps/wzbar-matcher/level-lift.ts`:

- `buildLiftMap(catalog)`: Map `code → tiefster textgleicher Einzelkind-Nachfahre`. Kettenfähig (474 direkte Paare; Ketten über zwei textgleiche Ebenen kommen im aktuellen Katalog nicht vor, werden aber unterstützt). Lift NUR bei genau einem Kind mit identischem `kurztext`.

Integration in `service.ts` (`match()`):

- **Kandidaten-Normalisierung vor dem LLM**: Jeder Retrieval-Hit wird über die Lift-Map angehoben, Duplikate (z. B. `4311` + `43110` → beide `43110`) werden dedupliziert. Das LLM *kann* die zu flache Ebene nicht mehr wählen; deckt zugleich den `sanitizeResult`-Fallback ab (Top-1-Kandidat ist jetzt die Unterklasse).
- `retrievalTopK` im Audit-Record bleibt bewusst roh (unverändert), damit die Retrieval-Diagnose nicht verfälscht wird.

Flankierende Fixes (Bestandsaufnahme):

- `backend/data/apps/registry.yaml`: Beschreibung „WZ-2008" → „WZ-2025" (war bei der WZ2025-Migration übersehen worden).
- `public-functions.ts` (getNeighborhood): Input-`maxLength` 6 → 7, `level`-Schema `maximum` 6 → 7, falsche Beschriftung („6=Wirtschaftsabteilung") korrigiert, `indent`-Maximum 2 → 3.
- `backend/src/db/schema/wzbar.ts`: veralteter Kommentar `{primary, alternatives}` → `{activities: [...]}`.

Bewusst NICHT angefasst: der Classifier-System-Prompt (beschreibt Hierarchie nur bis 6-stellig, „a.n.g."-Beispiel) — Prompt-Änderungen erst mit M2-Golden-Set verifizierbar.

### Verifikation M1

- Unit-Tests `level-lift.test.ts` gegen den echten Katalog: `4311→43110` wird geliftet, `10510` (Einzelkind mit anderem Text) NICHT, `43110` (zwei Kinder) NICHT.
- Pipeline-Test „Abbruch": Kandidatenliste enthält nach Lift nur noch `43110` (nicht mehr `4311`); LLM-Primary = `43110`.

## Offene Punkte

- Audit-Records der IHK-Instanz einsehen, um den originalen `4311`-Lauf zu verifizieren (welches Modell, welcher Pfad).
- IHK um weitere Soll-Codes für das M2-Golden-Set bitten.
- M3/M4 nach M2-Baseline umsetzen.
