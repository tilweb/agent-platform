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
| M2a | Eval-Harness + Seed-Golden-Set (Recall@20 + Precision@1) | Messbarkeit | ~1 T | **umgesetzt (2026-09-15)** |
| M2b | Produktions-Replay (Export `wzbar.matches` der 3 IHK-Instanzen, unüberwachte Metriken, Replay-Diff) | Messbarkeit auf Echtdaten | ~1 T | offen |
| M3 | Query-Expansion im Splitter (Normalisierungs-Variante mit-embedden, Union per Max-Similarity) | Fall 2 (konkret) | ~1 T | **umgesetzt (2026-09-15)** |
| M4 | Alias-Anreicherung des Katalogs (Destatis-Stichwörter `enrich`-Hälfte + kuratierte IHK-Begriffe, separate Vektoren pro Code) | Fall 2 (Fehlerklasse) | ~2–3 T | offen |

Reihenfolge: M1 → M2 → M3 → M4. LLM-berührende Änderungen (Prompt-Korrekturen, M3, M4) erst mit M2-Messung verifizieren.

### M2a — Umsetzung (2026-09-15)

Da von den IHKen kurzfristig keine Soll-Codes zu bekommen sind (Nutzung von drei IHKen vorhanden, aber keine Korrektheits-Rückmeldungen), speist sich das Golden Set aus zwei Quellen ohne IHK-Beteiligung:

1. **Destatis-Stichwörter als echtes Gold**: Der Klassifikationsserver (klassifikationsserver.de, Betrieb: Bayerisches Landesamt für Statistik) bietet zur WZ 2025 einen Stichwörter-Export — **36.184 Paare** `Stichwort → 5-stelliger WZ-2025-Code`, amtlich kuratiert. Abgelegt als `docs/WZ2025-Stichwoerter.csv` (Stand 2026-08-07); alle Codes existieren im App-Katalog. Ein Destatis-Stichwortverzeichnis als eigenständiges Dokument gibt es zur WZ 2025 (noch) nicht — der Klassifikationsserver-Export ist die Quelle.
2. **Kuratierte Fälle** (`eval/cases-curated.yaml`): die beiden IHK-Fälle, die dokumentierten Schwächen (Brandschutz, Umgangssprache) — mit auf WZ 2025 verifizierten Codes. Fachliche Nuance aus den Stichwörtern: „Komplementärgesellschaft" mit reiner Haftungsfunktion → `69.10.3` (juristische Dienstleistungen), mit Verwaltung/Führung → `70.10.4`; beide gelten als korrekt (any-of).

**Eval/Enrich-Split (kritisch für M4)**: `destatis.ts` teilt die Stichwörter per deterministischem Text-Hash hälftig in `eval` und `enrich`. M4 darf **ausschließlich** die `enrich`-Hälfte in die Embedding-Anreicherung einbauen — sonst misst das Eval-Set später seine eigenen Trainingsdaten.

**Harness** (`backend/src/apps/wzbar-matcher/eval/`): `run-eval.ts` misst zweistufig — `--mode retrieval` nur Recall@20 (Embedding-Calls, ~15 s), `--mode full` zusätzlich Precision@1 End-to-End (LLM-Calls, ~3 min bei n=158). Deterministisches Sampling (`--sample`, `--seed`). Vergleichslogik: Labels sind 5-stellig, tiefere Vorhersagen innerhalb der erwarteten Unterklasse zählen als Treffer (`deeper`); `shallower` ist exakt die IHK-Fehlerklasse „zu flach". Eval und Produktion teilen denselben Code-Pfad (`service.ts` exportiert jetzt `buildMatchDeps`/`retrieveCandidates`/`matchActivity`; der Eval-Pfad umgeht nur den Splitter).

**Baseline (2026-09-15, Qwen3 30B, n=158: 8 curated + 150 Destatis seed 42)**:

| Metrik | curated | destatis | gesamt |
|---|---|---|---|
| Recall@20 | 87,5 % | 69,3 % | 70,3 % |
| Primary-Hit (exact+deeper) | 75,0 % | 53,3 % | 54,4 % |
| davon exakt | 37,5 % | 35,3 % | 35,4 % |
| Top-4-Hit | 87,5 % | 62,7 % | 63,9 % |

Diagnose (gesamt): exact 56, deeper 30, **shallower 2** (M1 wirkt — „zu flach" ist praktisch eliminiert), same-class 8, wrong 62. Von den 62 wrong entfallen 47 auf Retrieval-Misses (richtiger Code nicht in Top-20) — **die Fehlermasse liegt in Stufe 2**, nur ~9 %-Punkte sind LLM-Fehlgriffe trotz korrektem Kandidaten. Das bestätigt die M3/M4-Priorisierung.

Einordnung: Die Destatis-Stichwörter sind produktspezifische Kurzformen („Rheumadecken, Herstellung", „X, Handelsvermittlung") — als Paraphrase-Stresstest härter als typische IHK-Freitexte. Die Baseline ist eine konservative Untergrenze, kein Produktions-Precision-Wert.

### M3 — Umsetzung (2026-09-15)

**Design**: Die Query-Expansion reitet auf dem Splitter-Call mit — das `split_activities`-Schema liefert pro Tätigkeit zusätzlich 0–2 `searchVariants` in amtlicher Fachsprache („persönlich haftender Gesellschafter" → „Komplementärgesellschaft"). **Kein zusätzlicher LLM-Call, keine zusätzliche Latenz** (nur +1–2 parallele Embedding-Calls, ~150 ms). `retrieveCandidates` embeddet Original + Varianten, vereinigt die Trefferlisten per Max-Similarity je Code (Reuse von `aggregateRetrievalHits`) und kappt wieder auf Top-20; danach greift der M1-Lift wie gehabt. `ActivityMatch.queryVariants` macht die Varianten im Audit-Record nachvollziehbar. `splitActivities` liefert jetzt `SplitActivity[]` (`{text, searchVariants}`) statt `string[]`.

**Befund aus der ersten Messung**: Expansion v1 verschlechterte das Destatis-Set (Primary-Hit 53,3 → 48,7 %), obwohl die kuratierten Fälle profitierten. Ursache (per Einzelfall-Analyse): Der Splitter zerriss die Handelsform-Muster der Stichwörter — „Gemüsesalate, Handelsvermittlung" wurde in die zwei unklassifizierbaren Tätigkeiten „Gemüsesalate" + „Handelsvermittlung" gesplittet; außerdem wechselten Varianten teils die Handelsform („Einzelhandel" → „Großhandel"). Beide Fehler treffen auch echte Handelsregister-Texte. Fix: zwei zusätzliche Prompt-Regeln (Produkt + Handels-/Tätigkeitsform ist EINE Tätigkeit; Varianten behalten Handelsform und Produkt bei).

**Messung (gleiches Setup wie Baseline: n=158, seed 42, Qwen3 30B; je ein Lauf, LLM-Nichtdeterminismus ±1–2 pp)**:

| Metrik (gesamt) | Baseline (ohne Expansion) | M3 final |
|---|---|---|
| Recall@20 | 70,3 % | **77,8 %** (+7,5 pp) |
| Primary-Hit (exact+deeper) | 54,4 % | **56,3 %** (+1,9 pp) |
| davon exakt | 35,4 % | 38,0 % |
| Top-4-Hit | 63,9 % | **72,8 %** (+8,9 pp) |

Kuratierte Fälle: Recall 8/8 (vorher 7/8 — **der IHK-Komplementär-Fall ist gelöst**, Splitter liefert exakt „Komplementärgesellschaft" als Variante), Primary-Hit 87,5 %, Top-4 100 %. Einziger verbleibender kuratierter Primary-Fehlgriff: „Baulicher Brandschutz" → `439991 Brandsanierung` statt `43230` (der richtige Code steht in den Alternativen).

Interpretation: Das Retrieval verbessert sich deutlich (+7,5 pp Recall, +8,9 pp Top-4); der Primary-Hit steigt moderat, weil nun häufiger das LLM der Engpass ist (richtiger Kandidat vorhanden, falsche Wahl). Das verschiebt die Priorität für die nächste Iteration Richtung Classifier-Prompt (Few-Shot, Ebenen-Beschreibung) — jetzt via Harness messbar. Für die Produkt-Kurzformen („Rheumadecken") bleibt M4 (Alias-Anreicherung) der richtige Hebel.

### Classifier-Prompt-Fixes (2026-09-15, nach M3)

Die bei M1 zurückgestellten Prompt-Korrekturen, jetzt harness-verifiziert. Drei Änderungen in `classifier.ts`:

1. **Hierarchie korrekt beschrieben**: 4-stellig Klasse, 5-stellig Unterklasse (amtliche Verschlüsselungsebene), 6-/7-stellig nationale **Spezialfälle ohne vollständige Aufteilung** — vorher stand dort „6-stellig = feinste Ebene" mit erfundenem „a.n.g."-Beispiel. Neue Ebenen-Regel: Unterklasse wählen, Spezialfall nur wenn die Beschreibung ihn ausdrücklich benennt; dazu zwei Few-Shot-Beispiele (Abbrucharbeiten → 43110 statt 431101; Reifendienst → 953131). Kandidatenliste kennzeichnet jetzt jede Ebene (`Klasse`/`Unterklasse`/`Spezialfall`).
2. **Wirtschaftsform-Regel**: Herstellung/Reparatur/Einzelhandel/Großhandel/Handelsvermittlung sind getrennte Zweige — der Code muss zur Form der Tätigkeit passen (häufige Destatis-Fehlerklasse).
3. **Suchvarianten in den Classifier-Prompt**: Zwischenmessung zeigte, dass die strengere Spezialfall-Regel den Komplementär-Fall kippte — die Variante „Komplementärgesellschaft" benennt den Spezialfall `701041` wörtlich, aber der Classifier sah nur den Originaltext. Die Splitter-Varianten stehen jetzt als „gleichwertige Umformulierungen" im User-Prompt (`classify(text, candidates, searchVariants)`).

**Messung (n=158, seed 42, je ein Lauf)**:

| Metrik (gesamt) | M3 | + Prompt-Fixes |
|---|---|---|
| Recall@20 | 77,8 % | 78,5 % (Rauschen) |
| Primary-Hit | 56,3 % | 55,7 % (Rauschen) |
| davon exakt | 38,0 % | **43,7 %** (+5,7 pp) |
| Top-4-Hit | 72,8 % | 71,5 % (Rauschen) |
| curated Primary-Hit | 87,5 % | **100 %** (8/8) |

Die Ebenen-Disziplin wirkt: „deeper"-Treffer (richtige Unterklasse, aber unbelegter Spezialfall) sinken von 29 auf 19, exakte Treffer steigen von 60 auf 69 — die IHK bekommt häufiger genau die amtliche Verschlüsselungsebene. Alle kuratierten Fälle (beide IHK-Fälle, Brandschutz, Umgangssprache) sitzen end-to-end. Verbleibende Destatis-Fehler: ~34 Retrieval-Misses (M4-Territorium) und ~29 LLM-Fehlwahlen bei Produkt-Nuancen (z. B. „Kräcker" → 10710 Brot statt 10720 Dauerbackwaren).

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
- M2b: `wzbar.matches` der drei IHK-Instanzen exportieren (unüberwachte Metriken, Replay-Diff-Werkzeug); die echten Eingabetexte werden zugleich Basis für spätere Gold-Labels, falls die IHKen doch Soll-Codes liefern.
- M3/M4 gegen die M2a-Baseline umsetzen (Ziel: Recall@20 deutlich über 70 %; jede Änderung mit identischem seed/sample vergleichen).
- Beim WZ-2025-Katalog-Update prüfen, ob der Klassifikationsserver-Stichwörter-Export aktualisiert wurde (Stand der Datei: 2026-08-07).
