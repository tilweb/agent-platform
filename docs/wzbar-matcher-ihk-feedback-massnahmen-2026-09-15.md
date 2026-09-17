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
| M2b | Produktions-Replay (Export `wzbar.matches` der 3 IHK-Instanzen, unüberwachte Metriken, Replay-Diff) | Messbarkeit auf Echtdaten | ~1 T | **umgesetzt (2026-09-16)** |
| M3 | Query-Expansion im Splitter (Normalisierungs-Variante mit-embedden, Union per Max-Similarity) | Fall 2 (konkret) | ~1 T | **umgesetzt (2026-09-15)** |
| M4 | Alias-Anreicherung des Katalogs (Destatis-Stichwörter `enrich`-Hälfte, separate Vektoren pro Code) | Fall 2 (Fehlerklasse) | ~2–3 T | **umgesetzt (2026-09-16)** |

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

### M4 — Umsetzung (2026-09-16)

**Design**: `alias-builder.ts` embeddet die **enrich-Hälfte** der Destatis-Stichwörter (17.934 Texte; der `splitOf`-Hash aus `eval/destatis.ts` ist die einzige Quelle der Wahrheit für den Split — die eval-Hälfte bleibt dem Harness vorbehalten, per Unit-Test abgesichert). Jeder Alias wird als **separater Vektor** gespeichert, nicht in den Katalogtext gemischt (Mischtexte verwässern den E5-Fingerabdruck). `topKWithAliases` nimmt pro Code die beste Similarity über Katalogtext + alle Alias-Vektoren; ohne Alias-Dateien läuft das Retrieval unverändert (Feature ist optional/abschaltbar). Modell-Guard: Aliase werden ignoriert, wenn sie nicht mit demselben Embedding-Modell gebaut wurden wie der Katalog-Index.

**Format-Entscheidung**: Float32-Binärdatei (`assets/alias-embeddings.bin`, 73,5 MB) + Meta-JSON (1,4 MB) statt JSON (~380 MB). Keine Kappung pro Code — die Sammel-Codes mit hunderten Produkt-Stichwörtern (46149 Handelsvermittlung sonstige Waren: 583) sind genau die, an denen das Retrieval scheiterte. Bewusster Trade-off: +73,5 MB im Repo/Image (unter GitHubs 100-MB-Dateilimit); bei Bedarf später Int8-Quantisierung (¼ Größe) oder Kappung. Build-Dauer: ~28 min bei ~10,5 Embeddings/s (API-bound); Rebuild dank Text+Modell-Reuse inkrementell. Retrieval-Latenz unkritisch: der Scan über ~20k statt 2,2k Vektoren kostet einstellige Millisekunden, die Embed-API dominiert.

**Messung (n=158, seed 42, je ein Lauf)**:

| Metrik (gesamt) | Ur-Baseline | vor M4 (M3 + Prompt-Fixes) | M4 |
|---|---|---|---|
| Recall@20 | 70,3 % | 78,5 % | **96,8 %** |
| Primary-Hit | 54,4 % | 55,7 % | **68,4 %** |
| davon exakt | 35,4 % | 43,7 % | **60,1 %** |
| Top-4-Hit | 63,9 % | 71,5 % | **90,5 %** |

Nur noch 5 Retrieval-Misses im gesamten Set (z. B. „Babymassage"), „zu flach" 0×. Der Engpass liegt jetzt eindeutig in Stufe 3: Von 46 verbleibenden Komplett-Fehlgriffen haben ~41 den richtigen Code in den Kandidaten — das LLM greift bei Produkt-Nuancen daneben. Hebel dafür wären ein stärkeres gepinntes Apps-Modell oder mehr Kandidaten-Kontext, beides via Harness messbar.

Kuratierte Fälle in diesem Lauf: 7/8 Primary (Top-4 8/8) — „Baulicher Brandschutz" kippte nichtdeterministisch auf `712009 Brandschutzberatung`, das über die Aliase neu in die Kandidaten kommt; über mehrere Läufe ist der Fall wechselhaft, der Soll-Code steht stets in den Top-4.

**Achtung fürs Deployment**: Die Alias-Dateien sind Build-Time-Assets wie `embeddings.json` — sie shippen mit dem Image. Nach einem Katalog-Rebuild mit anderem Embedding-Modell muss auch der Alias-Builder neu laufen (sonst greift der Modell-Guard und die Aliase sind wirkungslos).

### M2b — Umsetzung (2026-09-16)

**Werkzeuge** (`backend/src/apps/wzbar-matcher/eval/`): `export-prod-matches.ts` (Read-only-Export via `scalingo db-tunnel`, Connection Strings aus `backend/.env` — `SCALINGO_POSTGRES_IHKESSEN/IHKDARMSTADT/IHKLEIPZIG`, nie auf der Kommandozeile), `prod-analysis.ts` (unüberwachte Metriken), `replay.ts` (Replay-Diff gegen die aktuelle Pipeline, Differenzliste = Review-Menge). Zugang: SSH-Key `macbook-andreas` im Scalingo-Account registriert (Account hatte keinen; DBs sind ohne Internet-Zugriff konfiguriert). Die Export-/Diff-JSONs enthalten Kundendaten und bleiben bewusst außerhalb des Repos.

**Produktionsbefunde (Stand 2026-09-16, 1.932 Matches: Essen 19, Darmstadt 1.818, Leipzig 95)**:

- **Fall-1-Quote verifiziert**: 9,0 % (Darmstadt) / 8,8 % (Leipzig) / 16,2 % (Essen) aller Primaries sind 4-stellig — die IHK-Beschwerde quantifiziert. Nach M1-Deploy sollte der Wert auf ~0 fallen (Monitoring-Metrik).
- **Überspezifisch ist der häufigere Produktionsfehler**: bloßes „Abbrucharbeiten" → `431102 Demontage von Industrieanlagen` (85 %), mehrfach belegt; 50–60 % aller Primaries sind 6-/7-stellig. Bestätigt die Classifier-Prompt-Fixes.
- **Modell-Erklärung für den 4311-Lauf**: Die Instanzen liefen auf `adacor/mistral-3-24b-128k` bzw. `adacor/qwen3-5-a3b-35b-256k` — nicht auf dem lokal getesteten Qwen3 30B. Der Original-Lauf ist so plausibel erklärt (kleineres Modell, altes Prompt ohne Ebenen-Regel).
- **Nutzungsmuster**: ~1,9 Tätigkeiten/Match (Multi-Activity dominiert), Konfidenz fast uniform 0,95 (kaum kalibriert), Median-Dauer 5–6 s, Milieu v. a. Bau/Handwerk/Reinigung/Hausmeister. Sachbearbeiter stellen teils den erwarteten Code voran („43110 Abbrucharbeiten, …") — ein UI-Hinweis, dass ein „Soll-Code bestätigen"-Feedback-Feld gut angenommen würde.
- Essens „persönlich haftende"-Fall von 2026-08-06 wurde mit `70104` (95 %) korrekt beantwortet (Formulierung enthielt „Geschäftsführung").

**Replay-Diff** (119 jüngste Matches durch die aktuelle Pipeline M1+M3+M4): 98 geändert — davon 15 reine Ebenen-Lifts (M1), 27 innerhalb derselben Klasse (v. a. Überspezifisch→Unterklasse), 56 klassenübergreifend (Gemisch aus echten Verbesserungen wie „Planung Tiefengeothermie" `422101`→`71123 Ingenieurbüros` und modellbedingten Abweichungen — Produktions- und Lokal-Modell unterscheiden sich). Die 56 sind die priorisierte Hand-Review-Menge vor einem Deploy; Diff-Reports liegen lokal (`replay-{essen,darmstadt,leipzig}.json`).

### Modell-Benchmark (2026-09-16)

Alle chat-fähigen Kandidaten unter identischen Bedingungen (n=158, seed 42, volle Pipeline M1+M3+M4, Destatis-Teilset n=150):

| Modell | Primary-Hit | exakt | Top-4 | Anmerkung |
|---|---|---|---|---|
| Adacor Qwen 3.5 Instruct 35B | 70,0 % | **64,0 %** | 87,3 % | aktuell auf allen 3 Instanzen gepinnt |
| Adacor Qwen 3 30B | 70,0 % | 63,3 % | **92,0 %** | lokaler Referenz-Pin |
| Adacor Qwen 3.5 Thinking 35B | 68,7 % | 62,7 % | 89,3 % | kein Genauigkeitsgewinn, mehr Latenz/Kosten |
| Adacor Mistral 3 24B | 63,3 % | 56,0 % | 71,3 % | bis Ende 08/2026 auf den Instanzen; klar schwächer |
| Lyceum Qwen 3.8 27B / Flash Next | — | — | — | nicht messbar: reproduzierbare >120s-Timeouts des Endpoints (3 Versuche, auch Concurrency 3) — für die interaktive App disqualifizierend |

**Empfehlung**: Beim gepinnten **Adacor Qwen 3.5 Instruct 35B bleiben** — beste Exakt-Quote, gleichauf beim Primary-Hit, produktionserprobt; der Unterschied zu Qwen 3 30B liegt im Rauschbereich, ein Wechsel lohnt nicht. Die Thinking-Variante und Mistral sind für den Matcher raus. Wesentliche Einsicht: Die Modellwahl bewegt maximal ~7 pp — die Pipeline-Maßnahmen M1–M4 brachten +14 pp Primary/+27 pp Top-4. Nebenbefund: `run-eval.ts` ist jetzt fehlertolerant (Einzelfall-Fehler brechen den Lauf nicht mehr ab, werden gezählt und ausgewiesen).

## Analyse: Lange, detaillierte Gegenstandstexte (IHK-Rückmeldung 2, 2026-09-16 — nur Analyse, nicht umgesetzt)

**Meldung**: Bei sehr ausführlichen Unternehmensgegenständen (juristisch durchformulierte Texte mit Spiegelstrich-Aufzählungen) seien die Teiltätigkeiten „auch für Menschen nur beim genauen Durchlesen zu unterscheiden" — Verdacht: „Embedding funktioniert nicht gut, weil die Tätigkeiten zu nah beieinander sind." Beispiel: Tiefengeothermie-Erkundung, 1.548 Zeichen, 8 Spiegelstriche.

**Empirische Befunde** (3 Pipeline-Läufe + gezielte Embedding-Messungen mit dem Beispieltext):

1. **Primärdefekt ist der Splitter, nicht das Embedding**: Der Text ist fachlich EINE Tätigkeit (Geothermie-Erkundung; die 8 Spiegelstriche sind juristische Facetten davon). Der Splitter erkennt das korrekt — aber die Prompt-Regel „Bei einzelner Tätigkeit gibst du sie **unverändert** zurück" führt dann in 2 von 3 Läufen dazu, dass der **komplette 1.548-Zeichen-Text als eine ‚Activity' durchgereicht wird** (das `maxLength: 80` im Function-Schema wird von der API nicht erzwungen). In diesen Läufen liefert der Splitter zudem **keine Suchvarianten** — die M3-Expansion fällt komplett aus. In 1 von 3 Läufen verdichtet er dagegen sauber auf einen 120-Zeichen-Kern mit Varianten.
2. **Damit ist auch das Ergebnis nichtdeterministisch**: Lauf mit Verdichtung → `43130 Test- und Suchbohrung` (95 %, fachlich gut vertretbar); Läufe mit Volltext-Durchreichung → `09100 Dienstleistungen für die Gewinnung von **Erdöl und Erdgas**` (95 %, fachlich schief). Zweimal „95 % Konfidenz" für verschiedene Antworten — genau die Inkonsistenz, die beim Kunden ankommt.
3. **Die Embedding-Verwässerung ist real und messbar**, trifft aber den Volltext, nicht die Einzeltätigkeiten:
   | Query | Top-1 | Similarity-Spread Top1–Top20 | Fach-Kandidaten in Top-20 |
   |---|---|---|---|
   | Volltext (1,5k Zeichen) | 43130 @ 0,869 | **0,029 (flach)** | 4 von 7, plus Rauschen (62.20 IT, 26.70 Optik, 28.42 Werkzeugmaschinen) |
   | Nur Kernsatz („Erkundung geothermischer Ressourcen…") | 43130 @ 0,905 | 0,036 | sauber |
   | **Nur die Boilerplate-Verben** („Planung, Koordination, … von Maßnahmen") | Öffentliche Verwaltung / Hörfunk / Grundstücksverwaltung | **0,013 (reines Rauschen)** | KEINE |
   | Einzelner Spiegelstrich (geolog. Untersuchungen) | 43130 @ **0,930** | **0,051 (scharf)** | sauber |
   
   Die juristischen Rahmenverben (~40 % des Textes) ziehen den Volltext-Fingerabdruck in eine generische „Verwaltung von Maßnahmen"-Region; die Einzelpunkte für sich diskriminieren dagegen **gut** — die Kundenbeobachtung „zu nah beieinander" gilt für den Mischtext, nicht für die Teiltätigkeiten.
4. **Latente Grenze**: `multilingual-e5-large` kappt bei 512 Tokens. Das Beispiel (~450 Tokens) liegt knapp darunter — noch längere Gegenstände (im HR üblich) verlieren hintere Spiegelstriche **stillschweigend**.
5. **Fachliche Restunsicherheit unabhängig von der Technik**: Für „Aufsuchung eigener geothermischer Ressourcen" ist der Soll-Code auch für Menschen nicht eindeutig (vertretbar: 43130 Test-/Suchbohrung, 09900 DL sonstiger Bergbau, 42210 per amtlichem Stichwort „Bohrarbeiten für Geothermieanlagen", 35300 künftige Wärmeerzeugung). `09900` hat **null lexikalische Nähe** zu Geothermie und keinerlei Alias — selbst perfektes Retrieval kann ihn nicht anbieten. → Rückfrage an die IHK nach dem Soll-Code lohnt; der Fall ist zugleich das beste Argument für das „Soll-Code bestätigen"-Feedback-Feld.

**Lösungsoptionen (Skizze, bewusst nicht umgesetzt)**:

- **S1 — Splitter-Härtung für Langtexte** (adressiert Punkt 1+2, kleinster Eingriff): „unverändert zurückgeben" auf kurze Eingaben (~≤120 Zeichen) begrenzen; lange Ein-Tätigkeits-Texte werden auf einen prägnanten Kern verdichtet, Suchvarianten sind Pflicht. Zusätzlich **Code-seitiger Guard** statt Schema-Hoffnung: Activity-Text > ~200 Zeichen → Kernsatz-Verdichtung erzwingen. Erwartung: stellt Verhalten von „Lauf 1" deterministisch her.
- **S2 — Boilerplate-Dämpfung**: juristische Rahmenformeln („Planung/Koordination/Verwaltung von Maßnahmen", „Erwerb/Halten/Übertragung", „insbesondere") vor dem Embedden entfernen bzw. den Splitter Nominalkerne extrahieren lassen. Ergänzend zu S1, geringes Risiko.
- **S3 — Facetten-Modell statt Multi-Activity** (größerer Umbau, fachlich sauberste Lösung): Spiegelstriche einzeln retrieven (diskriminieren scharf, s. Messung), dann ein Aggregations-Schritt „eine Haupttätigkeit + unterstützende Facetten" statt heute „max. 3 gleichrangige Tätigkeiten". Liefert der IHK genau die Struktur, die ein Sachbearbeiter bildet (Haupt- vs. Nebentätigkeit).
- **S4 — Eval-Kategorie ‚Langtexte'**: die längsten echten Eingaben aus den Prod-Exporten (Darmstadt) als neue Golden-Set-Kategorie + **Konsistenz-Metrik** (3 Läufe → gleiche Antwort?). Ohne das bleibt die Fehlerklasse unbemessen und jede S1–S3-Änderung unverifizierbar.
- Flankierend: Token-Guard/Warnung bei Eingaben nahe der 512-Token-Grenze.

Empfohlene Reihenfolge bei Umsetzung: S4 (messen) → S1 (+S2) → S3 nur, falls S1/S2 die Klasse nicht schließen.

### S4 — Langtext-Eval umgesetzt (2026-09-16)

`eval/longtext-eval.ts` + `eval/cases-longtext.yaml`: misst die Langtext-Klasse über **Verhaltens-Metriken** (R Wiederholungen je Fall, bewusst sequenziell für ehrliche Nutzer-Latenz), da für Langtexte meist keine Soll-Codes existieren: Konsistenz des Primary-Sets, Passthrough-Quote (Splitter reicht Rohtext >200 Z. durch), Varianten-Quote (M3 aktiv?), Latenz p50/p90, Trunkierungs-Risiko (>~1800 Z. ≈ e5-512-Token-Grenze), optional Hit gegen eine any-of-Erwartungsmenge. Echtfälle kommen per `--from-export` aus den Prod-Exporten (Kundendaten bleiben lokal); kuratiert ist der Geothermie-Fall mit fachlich vertretbarer Erwartungsmenge (Soll-Code von IHK noch offen).

**Baseline (2026-09-16, 9 Fälle = Geothermie + 8 längste Darmstadt-Echtfälle, je 3 Läufe)**:

| Metrik | Wert | Einordnung |
|---|---|---|
| Konsistenz | **44 %** | 5 von 9 Fällen liefern über 3 Läufe unterschiedliche Primary-Sets |
| Passthrough-Quote | **56 %** der Läufe | Splitter verdichtet Langtexte mehrheitlich nicht |
| Varianten-Quote | 81 % | M3 fällt bei Passthrough teils aus |
| **Latenz** | **p50 9,0 s / p90 12,2 s / max 15,0 s** | **deutlich über dem UX-Budget von ~3–5 s** — Langtexte sind ~2× so langsam wie der Normalfall (Prod-Median 5,4 s) |
| Hit (nur Geothermie-Fall) | 3/3 | in dieser Messreihe verdichtete der Splitter den Fall jedes Mal (43130); tags zuvor 2/3 Passthrough — genau die gemessene Instabilität |

Damit ist die Fehlerklasse jetzt beziffert und jede S1–S3-Änderung nachweisbar. **Latenz-Befund für die S1-Umsetzung**: Die Verdichtung im Splitter (S1) kostet keine zusätzlichen Calls und dürfte die Latenz sogar senken (kürzere Classifier-Prompts, weniger Passthrough-Mehrfach-Activities); falls Langtexte trotzdem über ~5 s bleiben, braucht es UX-seitig eine Zwischenanzeige (z. B. erkannte Tätigkeiten streamen, bevor die Codes da sind).

### S1 — Splitter-Härtung umgesetzt (2026-09-16)

Drei Bausteine in `splitter.ts`:
1. **Prompt**: „unverändert zurückgeben" gilt nur noch für kurze Eingaben (≤ ~120 Z.); lange Ein-Tätigkeits-Texte werden zwingend auf einen ≤80-Zeichen-Kern verdichtet (Fachgebiet muss enthalten sein, juristische Rahmenformeln fallen weg), Suchvarianten sind bei Verdichtung Pflicht.
2. **Code-Guard**: Activities > 200 Zeichen (Schema-`maxLength` wird von der API nicht erzwungen) laufen durch einen dedizierten Verdichtungs-Call (`condense_activity`); bei dessen Scheitern Head-Truncation auf ~160 Z. (bei HR-Gegenständen trägt der Kopfsatz fast immer den Kern). Wichtig: auch der Kein-Output-Fallback des Splitters (LLM antwortet ohne `tool_calls` — kommt vor, ohne Exception) läuft jetzt durch den Guard; vorher war das ein stiller Passthrough-Pfad.
3. **Robustheits-Beifang**: `sanitizeResult` crashte, wenn das LLM `alternatives` als Nicht-Array lieferte (`?? []` schützt nicht vor falschem Typ) — trifft auch Produktion; jetzt hart abgesichert (Array-/Objekt-Check, Fallback Top-1). `longtext-eval.ts` ist zudem je Lauf fehlertolerant.

**Messung (gleiche 9 Fälle × 3 Läufe) — Baseline → S1**:

| Metrik | Baseline | S1 |
|---|---|---|
| Passthrough-Quote | 56 % | **0 %** |
| Varianten-Quote | 81 % | **96 %** |
| Latenz p50 / p90 | 9,0 s / 12,2 s | 8,8 s / 12,7 s |
| Konsistenz (n=9!) | 44 % | 22 % |
| Geothermie-Fall | 3/3 Hit (Glückslauf; tags zuvor 2/3 Passthrough) | 2/3 Hit, Verdichtung 3/3 sauber |

Regressionscheck Standard-Eval (n=158, full): Recall 97,5 %, Primary 67,7 %, Top-4 87,3 % — im Rauschband der M4-Werte, Normalfälle unberührt.

**Ehrliche Einordnung**: S1 erreicht sein mechanisches Ziel vollständig (kein Passthrough mehr, Expansion fast immer aktiv, Verdichtungsqualität stabil gut — z. B. „Erkundung und Aufsuchung geothermischer Ressourcen (Tiefengeothermie)"). Die **Konsistenz** verbessert sich dadurch aber nicht — der Flip sitzt nachweislich im **Classifier** bei Beinahe-Gleichstand der Kandidaten (Geothermie: 43130@0,900 vs. 09100@0,884; das Modell wählt mal so, mal so, jeweils „95 %"). Konsistenz-Hebel wäre deterministisches Decoding (temperature 0 / seed für `classify`/`condense`/`split`) bzw. eine Tie-Break-Regel — als Folgemaßnahme messbar. Die Metrik selbst ist bei n=9 grob (±11 pp je Fall).

**Zwei Latenz-Befunde für die UX-Diskussion**: (a) Langtexte bleiben bei ~9 s Median — die Zwischenanzeige (Tätigkeiten vor Codes) wird gebraucht. (b) Ein Lauf zeigte **482 s**: die Retry-Kette des OpenAI-Adapters (3 × 120 s Timeout + Backoff) kann einen interaktiven Nutzer im API-Störungsfall minutenlang blockieren — für die App wäre ein Fail-fast-Budget (z. B. max. 1 Retry, 30-s-Deckel) sinnvoll.

### Deterministisches Decoding (temperature 0) — Messung 2026-09-16

`temperature: 0` in allen drei Matcher-Calls (split/condense/classify; die Option wurde vom LLM-Service bereits durchgereicht). **Ergebnis: löst die Konsistenz NICHT** — Langtext-Konsistenz 33 % (Vorlauf 22 %, Rauschband bei n=9), der Geothermie-Fall flippt weiterhin 43130/09100/43130 bei identischer Eingabe. Der Adacor-Endpoint (vLLM-typisch: Continuous Batching, Floating-Point-Nichtdeterminismus) ist auch bei temperature 0 nicht deterministisch. Regressionscheck n=158: Recall 96,2 / Primary 69,6 / Top-4 86,7 % — Rauschband, kein Schaden; Varianten-Quote jetzt 100 %.

Bewertung: temperature 0 bleibt drin (korrekte Hygiene für eine Klassifikationsaufgabe, kein gemessener Nachteil), ist aber als Konsistenz-Hebel widerlegt. Echte Konsistenz braucht einen der folgenden Wege:
1. **Ergebnis-Cache** (empfohlen): identischer (normalisierter) `inputText` → gespeichertes Ergebnis aus `wzbar.matches` zurückgeben statt neu rechnen. Behebt das sichtbare Symptom („gleicher Text, andere Antwort") vollständig, senkt Latenz für Wiederholungen auf ~0, invalidierbar bei Pipeline-Updates (Versions-Feld im Record). Kein LLM-Verhalten nötig.
2. `seed`-Parameter (vLLM unterstützt seed; erfordert kleine Erweiterung des OpenAI-Adapters) — reduziert, garantiert aber unter Batching ebenfalls nicht vollständig.
3. Self-Consistency (3× klassifizieren, Mehrheitsentscheid) — 3× Kosten/Latenz, für die interaktive App unpassend.

### Ergebnis-Cache umgesetzt (2026-09-16)

- **Schlüssel**: sha256 über den normalisierten `inputText` (Whitespace kollabiert, lowercased) — dieselbe fachliche Eingabe trifft unabhängig von Formatierung. **Gültigkeit**: nur bei identischer `PIPELINE_VERSION` (Konstante in `service.ts`, aktuell `2026-09-16.1`) — **bei jeder verhaltensrelevanten Änderung an Prompts/Retrieval/Lift/Aliassen/Katalog hochzählen**, sonst liefert der Cache Alt-Ergebnisse.
- **Speicherung**: zwei neue Spalten `input_hash` + `pipeline_version` in `wzbar.matches` (Migration `0038_wzbar_match_cache.sql`, additiv/idempotent) + Index. Cache-Treffer legen **keinen neuen Record** an (History füllt sich nicht mit Duplikaten; Nutzungszählung wiederholter Anfragen entfällt dafür) und tragen transient `cached: true` in der API-Antwort. Leere Ergebnisse (0 Activities) werden nie wiederverwendet; Lookup-Fehler fallen auf Neuberechnung zurück. Escape-Hatch: `WZBAR_MATCH_CACHE=off`.
- Der Eval-Harness ist unberührt (nutzt `matchActivity` direkt, nicht `match()`).
- **Live-Test**: identische Eingabe mit anderer Formatierung/Groß-Kleinschreibung → zweiter Aufruf **4 ms statt 7,9 s**, gleiche Record-ID, `cached: true`.
- Optionaler UI-Folgeschritt: `cached`-Flag in der MatcherPage anzeigen („aus früherem Lauf"). *(Umgesetzt, s. Kleinmaßnahmen.)*

**„Neu ermitteln" (2026-09-17)**: Der Cache fror bislang die *erste* Antwort ein — bei einem Fehlgriff gab es für Sachbearbeiter keinen Ausweg. Statt „Cache leeren": `force`-Parameter in beiden Match-Endpoints (überspringt nur den Lookup) + „Neu ermitteln"-Link neben dem Cache-Badge. Da der Cache stets den **jüngsten** Record je Input-Hash nimmt, **ersetzt** die Neuberechnung den alten Eintrag automatisch — kein Löschen nötig, und der Nutzer kuratiert den Cache faktisch mit (Vorläufer der Feedback-Funktion aus dem IHK-Briefing). Live verifiziert: frisch → Cache-Hit → force (neue ID) → Cache liefert fortan die neue ID. Nebenwirkung dokumentiert: auch ein schlechteres Force-Ergebnis übernimmt den Cache; akzeptiert, weil der Button nur bei Cache-Treffern angeboten wird.

### Kleinmaßnahmen (2026-09-16): Fail-fast, cached-Badge, UX-Zwischenanzeige

1. **Fail-fast-Budget** (`MATCHER_LLM_BUDGET` in `classifier.ts`): alle drei Matcher-Calls laufen mit 30-s-Timeout und max. 1 Retry — Worst Case ~61 s statt ~480 s bei API-Störungen. Dafür wurde der OpenAI-Adapter minimal erweitert: `maxRetries` ist jetzt (wie `timeoutMs`) eine optionale Per-Call-Option; Default (3 Retries) für alle anderen Aufrufer unverändert.
2. **cached-Badge**: Die MatcherPage zeigt bei Cache-Treffern „aus früherem Lauf" in der Meta-Zeile.
3. **UX-Zwischenanzeige**: Neuer SSE-Endpoint `POST /match/stream` (Event `activities` sobald der Splitter fertig ist, dann `record`/`error`); `service.match()` hat dafür einen `onActivities`-Progress-Hook. Das Frontend zeigt die erkannten Tätigkeiten mit „WZ-Schlüssel wird ermittelt…", während die Klassifikation läuft — gemessen kommt der Zwischenstand nach **~1,9 s**, das Endergebnis nach ~6,6 s (gefühlte Wartezeit −70 %). Bei Transportproblemen (z. B. Proxy ohne SSE) fällt das Frontend automatisch auf den klassischen `POST /match` zurück; bei Server-Fehlern gibt es bewusst keinen Fallback-Rerun.

### G1 — Originaltext als Classifier-Kontext: Experiment 2026-09-17

Nach dem berechtigten Einwand, das S3-Facetten-Design sei auf den Geothermie-Fall zugeschnitten, wurde zuerst die reale Langtext-Verteilung erhoben (104 Fälle > 300 Z. = 5,4 % des Aufkommens: **55 Komma-Listen, 40 Prosa, 8 Pipe, 1 Spiegelstrich** — der Geothermie-Stil ist ein 1-von-104-Ausreißer) und das Langtext-Eval um drei synthetische Strukturfälle ergänzt (Komma/Prosa/Pipe, Codes amtlich verifiziert). Befund der diversifizierten Baseline: Die häufigen Strukturen funktionieren bereits ordentlich (alle 3 Strukturfälle 3/3 Hit); der Fehler konzentriert sich auf semantisch nahe Fälle ohne guten Kandidaten.

**G1** (Classifier bekommt den vollen Originaltext als Kontext, `classify(..., originalContext)`, gekappt 2.000 Z., nur wenn deutlich länger als die Activity): **löst den Zielfall nicht.** Geothermie weiter 3/3 → `09100`; Langtext-Aggregat unverändert (Konsistenz 36 %, Hit 75 %); Standard-Eval 70,3 % Primary (bester Einzelwert, aber Rauschband). G1 bleibt drin (konzeptionell richtig, kein Schaden, ~+400 Token/Call), ist aber als Hebel für die Fehlerklasse widerlegt.

**Der eigentliche Befund (per Reasoning-Trace)**: Das Modell versteht den Kontext („geothermische Ressourcen") vollständig und begründet wörtlich: *„Da es keinen spezifischen WZ-Code für Geothermie-Erkundung gibt, ist 09100 … der passendste Oberbegriff."* Es wählt bewusst einen falschen Oberbegriff, **weil der fachlich naheliegende Restklassen-Code `09900` nie Kandidat wird**. Warum, zeigt die Stichwort-Analyse: Jeder 5-stellige Code hat zwar amtliche Stichwörter (0 von 983 sind stichwortlos) — aber die 9 Stichwörter von 09900 decken nur den thematischen Kern **Steinbrüche/Kohle/Sprengungen** ab; die Breite der Restklasse („sonstiger Bergbau" inkl. Exploration) bilden sie nicht ab. Das semantisch nächste Stichwort („Suchbohrungen zur Unterstützung des Bergbaus") liegt zudem in der **eval-Hälfte** des Splits und ist damit designbedingt nicht im Alias-Index. Weder G1 noch das verworfene G2-Facetten-Modell können das heilen — kein Segment würde 09900 retrieven.

**Konsequenz — die Fehlerklasse heißt „thematisch enge Stichwort-Abdeckung bei Rest-/Sammelklassen"**. Zwei generische Hebel, beide ohne Testfall-Overfitting:
1. **Erläuterungstexte als zusätzliche Code-Vektoren** (stärkster Hebel): Der Klassifikationsserver bietet neben den Stichwörtern den Export „Gliederung mit Erläuterungen" — die amtlichen „Diese Klasse umfasst …"-Texte je Code. Diese beschreiben genau die Breite, die den Stichwörtern fehlt (für 09.90 z. B. Explorations-/Prospektionsdienstleistungen), und sind als eigene Quelle frei von Train-on-Test-Problemen (das Eval-Set besteht aus Stichwörtern, nicht aus Erläuterungen). Mechanik existiert (M4-Multi-Vektor je Code).
2. **Split-Design verfeinern**: Der globale 50/50-Hash-Split kann bei Codes mit wenigen Stichwörtern die einzig brauchbaren in die eval-Hälfte legen. Stratifiziert je Code splitten (z. B. mind. ⌈n/2⌉ Stichwörter je Code in enrich) behält die Messbarkeit und schließt solche Lücken.

Fachliche Randnotiz: Für Geothermie-Aufsuchung ist selbst amtlich kein eindeutiger Code ausgewiesen (das einzige Geothermie-Stichwort „Bohrarbeiten für Geothermieanlagen" zeigt auf 42.21.0) — die Soll-Code-Rückfrage an die IHK bleibt der einzige Weg zur echten Wahrheit für diesen Fall.

### Wirtschaftsformen-Split (2026-09-17, aus Nutzertest)

„Produktion von Spielwaren und Handel mit Spielwaren" wurde als **eine** Tätigkeit gebündelt — Nebenwirkung der M3-Regel „Produkt + Handelsform ist EINE Tätigkeit" (gedacht gegen das Zerreißen von „X, Handelsvermittlung", vom Modell aber auf „gleiches Produkt = gleiche Tätigkeit" übergeneralisiert). Fix: explizite Gegenregel im Splitter-Prompt („Verschiedene Wirtschaftsformen sind DISTINKTE Tätigkeiten — auch beim selben Produkt"), mit Klarstellung des Verhältnisses beider Regeln. Verifiziert: Spielwaren/Möbel jetzt 2 Tätigkeiten, die Handelsform-Fälle (Gemüsesalate, Fahrzeugbereifungen) bleiben korrekt 1, Dreifach-Split unverändert; Standard-Eval n=158: Primary 71,5 % (bester Wert), 0 Übersplittungen im Destatis-Set. Regressionsfall `wirtschaftsformen-spielwaren` im Langtext-Eval (neues Feld `minActivities`). **PIPELINE_VERSION → `2026-09-17.1`** (invalidiert auch bereits gecachte Fehlbündelungen).

Fachliche Nuance (ggf. fürs IHK-Gespräch): Nach WZ-Grundsatz gehört der Vertrieb **eigener** Erzeugnisse zur Herstellung — nur Handel mit Fremdware ist eigenständig. Der Gegenstandstext verrät das meist nicht; die Trennung in zwei Tätigkeiten lässt dem Sachbearbeiter die Entscheidung, statt sie zu verstecken.

## Offene Punkte

- **Deploy auf die drei IHK-Instanzen** (alle Maßnahmen sind bisher nur lokal/main): danach Fall-1-Quote (Anteil 4-stelliger Primaries) via `prod-analysis.ts` als Vorher/Nachher-Beleg ziehen — sollte von 9–16 % auf ~0 fallen.
- Hand-Review der 56 klassenübergreifenden Replay-Differenzen vor dem Deploy (Diff-Reports lokal; enthalten Kundendaten, nicht ins Repo).
- ~~Apps-Modell auf den Instanzen prüfen~~ → erledigt, siehe Modell-Benchmark: aktuelles Pin (Qwen 3.5 35B) ist die richtige Wahl; Lyceum-Endpoint bei Interesse später erneut testen (Timeouts am 16.09.).
- Produktidee aus den Echtdaten: Sachbearbeiter geben den erwarteten Code oft schon mit ein → ein „Soll-Code bestätigen/korrigieren"-Feedback-Feld hätte hohe Akzeptanz und liefert echte Gold-Labels.
- Beim WZ-2025-Katalog-Update prüfen, ob der Klassifikationsserver-Stichwörter-Export aktualisiert wurde (Stand der Datei: 2026-08-07); danach `alias-builder.ts` neu laufen lassen.
