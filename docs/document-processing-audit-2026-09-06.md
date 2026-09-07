# Document Processing: Konzept- und Code-Audit

**Stand:** 6. September 2026
**Prüfbasis:** Arbeitsverzeichnis auf Commit `7f56911104e4d9507832ca8cff91dc530ba66684`; bestehende uncommittete Änderungen anderer Arbeiten blieben unberührt.
**Priorität:** 1. Extraktionsqualität, 2. intuitive Profileinrichtung und Lernen, 3. Geschwindigkeit.

## 1. Entscheidungsvorlage

**Die Plattform besitzt eine brauchbare, erweiterbare Grundlage für hochwertige Dokumentenextraktion. Der aktuelle Stand rechtfertigt jedoch noch keine allgemeine „Best in Class“-Aussage und keine ungeprüfte automatische Weiterverarbeitung kritischer Felder.**

Die wesentlichen Grenzen liegen momentan im Zusammenspiel der Komponenten: Dokumente erreichen nicht immer den richtigen Extraktionspfad; Konfidenzen überschätzen die Verlässlichkeit; Pflichtprüfungen haben Lücken; und die Lern-Evaluation misst nicht hinreichend, was produktiv passiert. Diese Probleme lassen sich auch mit Qwen 3.5 35B beheben. Ein größeres Modell würde sie nicht beseitigen.

**Empfehlung:** Engine und Adapterstruktur erhalten, aber Qualitätssicherung, Routing, Ergebnisvertrag und Lernfreigabe gezielt überarbeiten. Die Empfehlung der Übergabe, die Engine „nahezu unverändert“ zu übernehmen, sollte angesichts der hier belegten Fehler eingeschränkt werden.

| Kriterium | Einschätzung | Konsequenz |
|---|---|---|
| Extraktionsqualität | Gute Pilotresultate; erhebliche Lücken bei Fehlererkennung, Vollständigkeit und Freigabe | Zuerst die nachgewiesenen Fehlpfade schließen und produktionsgleiche Evaluation aufbauen |
| Profile und Lernen | Nützliche Einzelbausteine, aber Nutzer müssen technische Entscheidungen treffen; Lernversprechen teilweise nicht eingelöst | Dokumentgeführte Einrichtung, unabhängig speicherbare Korrekturen, versionierte Freigabe |
| Geschwindigkeit | Parallelisierung und deterministischer Pfad vorhanden; vermeidbare Vorarbeit und Ressourcenverbrauch | Nach Qualität: gemeinsame Dokumentaufbereitung, gezielte Ausschnitte, globale Laststeuerung |

„Best in Class“ sollte für **klar definierte Dokumenttypen und Varianten** nachgewiesen werden, etwa Lieferscheine ausgewählter Lieferanten oder ein bestimmtes Rezeptformular. Eine universelle Zusage für beliebige Scans, Handschriften und Formularvarianten lässt sich aus den Piloten nicht ableiten.

## 2. Umfang und Beweislage

Geprüft wurden die generische Engine, alle Strategiearten, OCR/Fusion, Validierung, Merge, Learning-Service, Beispiele und Evaluation, Segmentierung, Posteingang, wesentliche Batch-/Review-/Export-Routen sowie der React-Code für Profileinrichtung, Training und Review. Die technische Übergabe vom 4. September und die August-/September-Konzepte wurden mit der Implementierung abgeglichen.

**Ausgeführt:**

- Bestehende Suite: `bun test src/extraction src/services/extraction src/services/documentConverter.test.ts` im Backend. Zunächst 263 erfolgreiche Tests und drei Fehler beim Öffnen lokaler Webhook-Testserver.
- Separater Webhook-Lauf mit erlaubtem lokalen Server: 12/12 erfolgreich. Damit sind alle 266 unterschiedlichen Tests über die beiden Läufe erfolgreich abgedeckt. Die drei Erstfehler waren eine Ausführungsbeschränkung, kein nachgewiesener Webhook-Defekt.
- Zusätzlich zehn lokal ausführbare Gegenbeispiele: [Audit-Skript](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/tools/document-processing-audit-2026-09-06.ts). Ausführung aus dem Repository: `bun tools/document-processing-audit-2026-09-06.ts`. Das Skript importiert die realen Funktionen und ersetzt nur beim Bildrouting die Modellgrenze durch einen lokalen Stub. Es prüft ausdrücklich das heute fehlerhafte Verhalten; seine Assertions sind keine Soll-Regressionstests.

**Grenzen:** Keine erneute Live-Evaluation der Kundenbelege, keine produktiven Datenänderungen, keine Modell- oder Lastmessung am Adacor-Endpunkt und kein beobachteter Nutzertest im Browser. UX-Befunde stammen aus dem implementierten Interaktions- und Datenfluss. Die Pilotkennzahlen werden als dokumentierte Resultate eingeordnet, nicht als in diesem Audit neu gemessen.

### Was bereits gut ist

Die Trennung zwischen generischer Engine und Profil-/App-Layer ist sinnvoll. Nullable Guided JSON im Visionpfad, explizite Verarbeitungsbefunde, OCR-Fundstellen, Kataloge, fachliche Regeln, Batch-Verarbeitung und Import/Export sind wertvolle Bestandteile. Insbesondere das Prinzip, feste Formulare deterministisch zu lesen, statt jede Information durch ein LLM zu schicken, passt zur verfügbaren Modellklasse.

Der Korrekturkreislauf ist als Produktidee richtig. Ebenso die Trennung zwischen Dokumentgrenzen und Abschnitten innerhalb eines Vorgangs. Beide benötigen jedoch einen durchgängigen Korrektur- und Freigabepfad.

## 3. Befunde nach Priorität

**P1:** Vor automatisierter produktiver Weiterverarbeitung beheben.
**P2:** Für verlässliche Einrichtung, Lernen und Skalierung als Nächstes umsetzen.
Die Priorisierung bezieht sich auf dieses Feature, nicht auf eine allgemeine Security-Schweregradskala.

### F01 · P1 · Das empfohlene Hybrid-Profil aktiviert seinen Vision-Fallback nicht zuverlässig

**Beleg:** [UI-Anlage](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/frontend/src/pages/ExtractionProjectsPage.jsx:1685), [Profiladapter](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/pipeline-adapter.ts:166), [Engine-Defaults](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/services/extraction/defaults.ts:9).

Die UI sendet `extraction: {strategy: 'hybrid'}`. Der Adapter ergänzt `vision_fallback: true` nur, wenn überhaupt keine Extraktionskonfiguration existiert. In allen anderen Fällen greift der Engine-Default `false`.

**Reproduziert:** Mit dem UI-Payload ergibt sich `vision_fallback=false`; ohne Konfigurationsobjekt `true`. PDFs mit weniger als 200 Zeichen werden im Hybridrouter separat direkt zu Vision geschickt. Betroffen sind daher insbesondere PDFs mit vorhandenem, aber unzureichendem Text oder zusätzlichen handschriftlichen Inhalten.

**Änderung:** Strategieabhängige Defaults zentral definieren. „Automatisch“ muss dieselbe Semantik in UI, Import, API und Engine haben. Ein Regressionstest muss den vollständigen Create-Payload bis zur aufgelösten Strategie prüfen.

### F02 · P1 · Bilder erreichen im Hybridpfad die eigentliche Extraktion nicht

**Beleg:** [Bildvorbereitung](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/service.ts:362), [Hybridrouter](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/services/extraction/strategies/hybrid.ts:308).

Der Service lässt ein Bild zunächst durch Vision beschreiben, speichert diesen Text für das Lernen, übergibt an die Pipeline aber `text: ''` und die Bildbytes. Hybrid erkennt nur PDFs als direkte Visionquelle. Der Textpfad erhält damit lediglich den Dateikopf; ein Vision-Fallback für PNG/JPEG existiert dort nicht.

**Reproduziert:** Bei einer Bildquelle ruft Hybrid das Modell ohne `image_url` auf und liefert im kontrollierten Gegenbeispiel ein leeres Ergebnis. Das Bild selbst wird nicht ausgewertet.

**Änderung:** Alle visuellen Quellen über einen gemeinsamen Dokumentrouter behandeln. Reine Bilder direkt visuell extrahieren. Die zusätzliche Volltranskription für das Lernen darf diesen Pfad nicht blockieren.

### F03 · P1 · Konfidenz wird mit Korrektheit verwechselt

**Beleg:** [Single-Pass](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/services/extraction/strategies/single-pass.ts:184), [Konfidenzheuristik](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/services/extraction/confidence.ts:71), [Triage](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/review.ts:47).

Single-Pass setzt für vorhandene Werte pauschal 1,0. Im Chunkpfad erhält ein Wert aus einer Quelle 0,7; zwei übereinstimmende Chunks können 1,0 erzeugen. Überlappende Chunks sind jedoch keine unabhängigen Belege. Die nachgeschaltete Modellbewertung sieht Kandidatenwerte, nicht die Originalausschnitte. Bei Review-Schwelle 0,6 kann schon die einfache Heuristik automatisch freigeben.

Die Kalibrierung wird in fünf aggregierten Buckets fortgeschrieben, steuert aber die Freigabe nicht. Aus korrigierten Review-Fällen allein entsteht zudem keine repräsentative Kalibrierung des Gesamtbestands.

**Änderung:** Verifikationsstatus von numerischer Konfidenz trennen. Automatische Freigabe aus empirisch geprüften Merkmalen ableiten: Quellenzuordnung, Lesbarkeit, Konflikte, Vollständigkeit, Regelstatus und Dokumentvariante. Schwellen pro kritischem Feld und Dokumenttyp bestimmen. Stichproben aus automatisch freigegebenen Ergebnissen nachprüfen.

### F04 · P1 · OCR-„verified“ kann eine falsche Nummer oder die falsche Feldrolle bestätigen

**Beleg:** [Wertsuche](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/services/extraction/ocr.ts:95), [Fusion](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/services/extraction/fusion.ts:102), [Konfidenzanhebung](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/services/extraction/fusion.ts:318).

Die Skalarsuche erlaubt Substrings und teilweise Wortübereinstimmung über eine Seite. Sie beweist weder eine vollständige Nummer noch deren Zugehörigkeit zu einem bestimmten Label. Auch eine auf dem Dokument vorhandene Kundennummer kann dadurch eine falsch zugeordnete Rezept-/Belegnummer „bestätigen“.

**Reproduziert:** Extrahiert wird `12345`, OCR enthält ausschließlich `991234599`. Ergebnis: `verified`, Konfidenz steigt auf 0,95.

In Listen begrenzt der Code die Suche vertikal, aber nicht auf die richtige Spalte. Bestellte und gelieferte Menge können innerhalb derselben Zeile verwechselt werden. Bei mehr extrahierten Wiederholungen als OCR-Vorkommen wird über `Math.min` das letzte Anker-Vorkommen erneut verwendet.

**Änderung:** Für IDs vollständige normalisierte Zeichenfolge verlangen; Zahlen typ- und formatgerecht vergleichen. Label, Region, Tabellenzeile und Spalte zum Beleg machen. Ein OCR-Anker darf nicht unbegrenzt mehrere Positionen bestätigen. Rohwert und normalisierten Wert getrennt speichern.

### F05 · P1 · Pflichtfelder und Pflichtpositionen können trotz Fehlens Auto-OK werden

**Beleg:** [Triage](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/review.ts:47), [Adapter-Pflichtfelder](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/pipeline-adapter.ts:98).

Die Triage prüft zuerst die Konfidenz und überspringt dann das Feld. Ein Pflichtfeld mit hoher Konfidenz wird deshalb nicht unabhängig auf Inhalt geprüft. In nicht segmentierten Profilen gibt es keine rekursive Pflichtprüfung der Listenzellen. In Segmenten werden niedrige Konfidenzen nur bei vorhandenen Werten beanstandet; fehlende Pflichtwerte bleiben unberücksichtigt. Der Adapter setzt Engine-`required` überall auf `false`.

**Reproduziert:** Alle drei Fälle ergeben `auto_ok`:

1. Pflichtliste ist leer, Listen-Konfidenz 1,0.
2. Eine erforderliche Mengen-Zelle ist null, Listen-Konfidenz 0,99.
3. Erforderliche Nummer in einem vorhandenen Segment ist null, Feldkonfidenz 0.

**Änderung:** Einen rekursiven fachlichen Ergebnisvalidator anhand des ursprünglichen Projekts ausführen. Pflichtfeld, Mindestanzahl und Pflichtzelle müssen unabhängig von Konfidenz gelten. Nullable Modelloutput ist weiterhin richtig; fehlende Pflichtwerte müssen anschließend explizit blockieren.

### F06 · P1 · Globale Deduplizierung löscht echte Positionen und kann Fundstellen verschieben

**Beleg:** [Deduplizierung](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/list-utils.ts:24), [Ergebnisentpackung](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/service.ts:418).

Alle Listen werden nach den definierten Feldwerten dedupliziert, einschließlich Single-Pass und deterministischer Ergebnisse. Dabei gehen fachlich legitime identische Positionen verloren. Anschließend bleiben die indizierten Boxen unverändert: Nach dem Entfernen einer Zeile kann die nächste sichtbare Zeile auf die falsche ursprüngliche Fundstelle zeigen.

**Reproduziert:** Zwei reale identische Zeilen werden zu einer.

**Änderung:** Quellidentität statt Wertgleichheit verwenden: Seite, Zeilen-ID, Region und Chunk-Überlappung. Nur dieselbe Quellposition aus überlappenden Extraktionen zusammenführen. Kandidaten, finaler Zeilenindex und Fundstelle gemeinsam remappen. Identische wiederholte Positionen ausdrücklich erhalten.

### F07 · P1 · Validierung und Reparatur bilden keine belastbare Freigabegrenze

**Beleg:** [Typvalidator](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/validator.ts:14), [Repair-Orchestrierung](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/services/extraction/pipeline.ts:93), [Ergebnisrückgabe](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/service.ts:445).

Zahlen werden teilweise mit `parseFloat` akzeptiert, Datumswerte nur auf ihr Format geprüft. Engine-Validierungsfehler landen in `warnings`; der Learning-Service protokolliert deren Anzahl, übernimmt sie aber nicht als eigene blockierende Validierungen in die Antwort. Nach einem LLM-Repair werden Daten ersetzt, Konfidenzen und Fundstellen stammen weiterhin aus dem vorherigen Ergebnis.

**Reproduziert:** `12abc` wird zu 12 normalisiert; `2026-02-31` gilt als gültiges Datum.

**Änderung:** Strikte Parser für Zahlen, Datumswerte und Booleans, fachlich definierte Normalisierung, keine stille Teilinterpretation. Nach jeder Datenmutation finale Validierung ausführen; veränderte Felder neu verifizieren oder deren alte Konfidenz/Fundstelle entwerten. Alle ungelösten Validierungsfehler in einen einheitlichen Ergebnisvertrag übernehmen.

### F08 · P1 · Nicht durchführbare Prüfungen und Teile des Hybrid-Fallbacks bleiben nicht blockierend

**Beleg:** [Lookup-Regel](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/rules.ts:155), [Hybrid-Antwortparse](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/services/extraction/strategies/hybrid.ts:166), [Hybrid-Fallback](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/services/extraction/strategies/hybrid.ts:328), [Posteingangsgrenzen](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/inbox/split.ts:141).

Ein nicht verfügbarer Lookup wird selbst bei einer als `error` definierten Regel nur `warn`. Unlesbare Hybrid-Visionantworten werden zu `{}`, ohne den Verarbeitungsfehler auszuweisen. Fehlendes Rendering fällt auf Text zurück; im Hybridpfad fehlt die Seitenzahlkontrolle der reinen Visionstrategie. Im Posteingang wird ein fehlgeschlagenes Grenzurteil zu „kein Schnitt“, ohne Unsicherheitsstatus für die spätere Freigabe.

**Reproduziert:** Ausgefallene Pflicht-Stammdatenprüfung plus hohe Konfidenz ergibt `auto_ok`.

**Änderung:** Prüfstatus `passed / failed / not_evaluated` modellieren. Vorgeschriebene, nicht ausgeführte Prüfungen blockieren. Grenzentscheidungen brauchen `unknown`; diese Unsicherheit muss bis zur Ergebnisfreigabe erhalten bleiben. Ein einzelnes kritisches Feld muss den gezielten Vision-Nachlauf auslösen dürfen; die heutige Mindestzahl von zwei unsicheren Feldern priorisiert Kosten vor Qualität.

### F09 · P1 · Evaluation kann eine Regression als Verbesserung akzeptieren

**Beleg:** [Score und Akzeptanz](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/eval.ts:144), [Kandidatenerzeugung](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/service.ts:540).

Fehlgeschlagene Beispiele werden aus dem Genauigkeitsnenner entfernt. Erst mehr als 50 % Ausfälle machen den Lauf unbrauchbar. Ein Kandidat kann dadurch auf einem einfacheren Restbestand besser erscheinen. Zudem entsteht der Kandidat aus demselben Beispielpool, aus dem die Evaluation stammt: Der Verzicht auf Few-Shot in der Evaluation verhindert nicht das indirekte Lernen aus den Testkorrekturen.

**Reproduziert:** Ein korrektes Dokument und ein Timeout ergeben 100 % Genauigkeit und einen akzeptierten Challenger gegenüber einem Champion mit 99 %.

**Änderung:** Gleiche vollständige Testfälle für beide Versionen, Ausfälle als Misserfolg zählen und separat ausweisen. Einen getrennten, versionierten Testbestand verwenden, der weder in Guidelines noch Few-Shot gelangt. Kritische Felder und Dokumentvarianten dürfen nicht hinter einer besseren Durchschnittskennzahl verschwinden.

### F10 · P1 · Produktive Lernwirkung und angezeigte Qualität stimmen nicht überein

**Beleg:** [Text-Eval](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/eval.ts:243), [Persistenz der Scores](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/service.ts:588), [Genauigkeitsschätzung](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/service.ts:769), [UI-Hinweis](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/frontend/src/pages/ExtractionProjectsPage.jsx:3927).

Die Evaluation erzwingt Text-Single-Pass ohne Few-Shot, unabhängig von der Produktionsstrategie. Ihre Alignment-Felder werden berechnet, aber beim Speichern des Champion-Objekts weggelassen. Der dafür vorgesehene auffällige UI-Hinweis auf die abweichende Strategie wird für neu gespeicherte Scores somit nicht aktiviert; der allgemeine Text-Hinweis bleibt vorhanden.

Die prominente „~X % Genauigkeit“ beruht auf dem Anteil bisher unkorrigierter Trainingsbeispiele, nicht auf einem unabhängigen Test der aktuellen Version. Je gezielter Nutzer schwierige Beispiele hinzufügen, desto schlechter kann diese Zahl aussehen, obwohl das Profil besser wird.

Der Eval-Cache berücksichtigt Beispiel-IDs, Modell und Guideline-Version, aber nicht alle qualitätsrelevanten Änderungen wie Feldschema und manuelle Anweisungen.

**Änderung:** Historische Korrekturquote so benennen oder entfernen. Evaluation auf Originaldateien mit exakt produktiver Konfiguration ausführen. Score immer mit Version, Testbestand, Fehlern, Strategie und Unsicherheit anzeigen. Cache an einen vollständigen Konfigurations-/Datenhash binden.

### F11 · P1 · Segmentprofile umgehen wichtige Teile des Lern- und Prüfkreislaufs

**Beleg:** [Segmentextraktion](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/segmentation/segment-extract.ts:117), [Segmentreview](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/frontend/src/pages/ExtractionProjectsPage.jsx:2776).

Segmentläufe entfernen Guidelines und Few-Shot ausdrücklich. Fachliche Projektregeln werden dort nicht ausgewertet; Kataloge bleiben aktiv. OCR-Findings werden nicht als entsprechende Befunde weitergereicht. Das Segmentreview ist read-only; Grenzen und Typen lassen sich nicht korrigieren. Diese Einschränkungen sind teilweise dokumentiert, bleiben aber für einen zentralen Anwendungsfall – Antrag mit Anlagen, Rezeptpaket – wesentlich.

**Änderung:** Jede Segmentinstanz braucht ein korrekturfähiges Ergebnis und einen eigenen Beispielkontext. Segmentlokale sowie dokumentübergreifende Regeln ermöglichen, etwa identische Vorgangsnummer und erwartete Anlagen. Nach Grenzkorrektur nur betroffene Segmente neu auslesen. Bis dahin segmentierte Profile als eingeschränkt lernfähig kennzeichnen.

### F12 · P1 · Review und Weitergabe besitzen keinen konsistenten Freigabevertrag

**Beleg:** [Review-Endpunkt](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/routes/extraction-projects.ts:556), [Tabellenweitergabe](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/routes/extraction-projects.ts:681), [Lernbedingung im UI](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/frontend/src/pages/ExtractionProjectsPage.jsx:2943).

Eine Korrektur wird als Trainingsbeispiel gespeichert, bevor die fachlichen Regeln neu bewertet werden. Das Dokument erhält danach auch bei verbleibenden Fehlerbefunden `reviewed`. Es fehlt eine strikte Schema-/Vollständigkeitsprüfung der korrigierten Nutzereingabe. Korrigierte Daten behalten außerdem alte Konfidenzen.

Korrigieren und Bestätigen sind an vorhandenen Dokumenttext gebunden. Ein frisch erfolgreich per Vision extrahierter PDF-Scan mit fehlgeschlagener Textkonvertierung kann deshalb nicht über diesen Pfad bestätigt werden; die UI erklärt dies irreführend als „älterer Lauf“.

Die Tabellenweitergabe übernimmt alle technisch `completed` Ergebnisse, auch `needs_review`, ohne Reviewstatus als Tabellenspalte. Webhooks enthalten immerhin den Reviewstatus, senden aber ebenfalls alle Ergebnisse. Das ist kein heimlicher Versandfehler, wohl aber eine fehlende klare Trennung zwischen Ergebnisbereitstellung und fachlicher Freigabe.

**Änderung:** `extracted / needs_review / approved / rejected` getrennt von technischem Laufstatus führen. Review unabhängig vom Lernen speichern; Training explizit auswählbar. Unaufgelöste Pflichtfehler blockieren oder verlangen eine begründete, auditierte Ausnahme. Standardweitergabe nur freigegebener Daten; vollständige Diagnoseexporte ausdrücklich als solche kennzeichnen.

### F13 · P2 · UI-Speichern kann Profilwissen verlieren

**Beleg:** [Feldserialisierung](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/frontend/src/pages/ExtractionProjectsPage.jsx:394), [Settings-State](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/frontend/src/pages/ExtractionProjectsPage.jsx:4593), [Update-Payload](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/frontend/src/pages/ExtractionProjectsPage.jsx:4693).

Die Engine unterstützt `aliases` für Labelvarianten. Die UI übernimmt diese weder vollständig in den Editorstate noch in die Feldserialisierung. Da das gesamte Feldobjekt ersetzt wird, kann das Speichern eines importierten Templateprofils dessen Aliasse entfernen. Kollidierende Feld-IDs werden beim Aufbau des Objekts überschrieben; eine explizite Kollisionsprüfung fehlt dort.

**Änderung:** Unbearbeitete Eigenschaften verlustfrei erhalten, strukturierte Änderungen statt impliziter Komplettrekonstruktion, stabile interne Feld-IDs und Kollisionsprüfung. Roundtrip-Tests „Import → öffnen → unverändert speichern → exportieren“ für alle Profilmerkmale.

### F14 · P2 · Lernen verwendet oft den falschen Dokumentausschnitt

**Beleg:** [Few-Shot-Prompt](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/pipeline-adapter.ts:70), [Guideline-Generator](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/guideline-generator.ts:66), [Beispielauswahl](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/examples.ts:172).

Few-Shot bekommt die ersten 500 Zeichen, Guidelines meist die ersten 800 Zeichen, aber jeweils die vollständigen Zielwerte. Die tatsächlich korrigierte Tabellenzeile, zweite Seite oder Handschrift ist damit oft nicht sichtbar. Visionbeispiele fehlen als Bilder. Alle korrigierten Beispiele fließen ohne übergreifendes Tokenbudget in die Guidelinegenerierung ein.

Neue Beispiele beeinflussen Few-Shot unmittelbar und umgehen damit das Champion/Challenger-Gate der Guidelines. „Mehr Beispiele“ ist deshalb kein hinreichender Qualitätsnachweis.

**Änderung:** Korrektur mit Feld, Quellausschnitt, Bildregion und Fehlerart speichern. Beispiele nach Layout, Dokumentvariante und Fehlerart auswählen. Kandidatenbeispiele und produktive Beispiele trennen. Visuelle Ausschnitte gezielt verwenden; semantische Textähnlichkeit allein reicht bei Formularen nicht.

### F15 · P2 · Lauf und Profil besitzen keinen unveränderlichen gemeinsamen Stand

**Beleg:** [Batch-Service](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/batch-service.ts:127), [Projekt-Updates](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/projects.ts:99), [Auditdaten](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/extraction/learning/service.ts:480).

Der Batch lädt das Projekt für die Triage einmal, während jede Extraktion das aktuelle Projekt erneut lädt. Während eines laufenden Batches können daher Extraktion und Triage unterschiedliche Felddefinitionen oder Schwellwerte verwenden. Die Auditdaten enthalten Modellname, Strategie und Guideline-Version, aber keinen vollständigen Snapshot von Schema, Anweisungen, Beispielen, Konverter und Modellrevision. Lern-/Kalibrierungsupdates erfolgen teilweise als Read-modify-write ohne gemeinsame Transaktion.

**Änderung:** Unveränderliche Profilrevision je Batch und Ergebnis. Atomare Veröffentlichung eines getesteten Profils; aktive Läufe behalten ihre Revision. Transaktionen beziehungsweise optimistische Versionsprüfung für Lernmetadaten. Rollback auf einen früheren Stand ermöglichen.

## 4. Zielkonzept für hohe Qualität mit Qwen 3.5 35B

Das offizielle Qwen-Modell besitzt einen Visionencoder und 35 Milliarden Gesamtparameter mit 3 Milliarden aktivierten Parametern. Das macht dokumentorientierte multimodale Verarbeitung grundsätzlich plausibel; es belegt keine konkrete Rezept- oder Lieferscheingenauigkeit. Welche Revision und Serving-Konfiguration hinter dem Adacor-Alias tatsächlich laufen, wurde hier nicht verifiziert. [Offizielle Modellkarte](https://huggingface.co/Qwen/Qwen3.5-35B-A3B)

Meine Empfehlung ist eine **belegorientierte, mehrstufige Pipeline**, die das Modell auf überschaubare Entscheidungen beschränkt:

1. **Original sichern und Eingangsqualität prüfen.** Dateityp tatsächlich erkennen, Seiten vollständig erfassen, Rotation/Schieflage und Lesbarkeit bestimmen. Textlayer und visuelle Ergänzungen seitenweise beurteilen. Ein vorhandener Textlayer beweist nicht, dass Handschrift enthalten ist.
2. **Dokumenttyp und Variante feststellen.** Profilzuordnung, Dokumentgrenzen und Segmentgrenzen mit Begründung und Unsicherheit festhalten. Nicht unterstützte Layouts erkennen, statt sie automatisch als bekannten Typ zu behandeln.
3. **Felder lokalisieren.** Native PDF-Positionen, OCR-Layout und Tabellenstruktur als gemeinsame Repräsentation verwenden. Für stabile Formulare Label-/Bereichsanker, für variable Dokumente visuelle Lokalisation einsetzen.
4. **Kleine Feldgruppen aus geeigneten Ausschnitten extrahieren.** Beispielsweise Patientenkopf, Verordnungszeile, Datum/Unterschrift oder Lieferpositionen getrennt. Mehrseitige Tabellen brauchen Nachbarseitenkontext und wiedererkennbare Zeilenidentitäten.
5. **Rohwerte nachvollziehbar normalisieren.** Beispiel: „1.234,50“ → 1234.50, aber Rohtext und Einheit behalten. `null`, „nicht vorhanden“, „unlesbar“ und „nicht anwendbar“ fachlich unterscheiden.
6. **Unabhängig prüfen.** Vollständigkeit, Quellenzuordnung, Schema und Domänenregeln. Unterschiedliche Hinweise nutzen; zwei Antworten desselben Modells sind kein Ersatz für unabhängige Evidenz.
7. **Nur unsichere Regionen nachlesen.** Kritische Zahl in höher aufgelöstem Ausschnitt erneut extrahieren, alternative OCR-/Visionansicht verwenden, Widersprüche sichtbar lassen.
8. **Gezielt menschlich prüfen und anschließend freigeben.** Unlesbares bleibt unlesbar. Review ist ein regulärer Qualitätspfad, kein verstecktes Scheitern.

Ein Feld sollte mindestens `raw_value`, `normalized_value`, Status, Dokument-/Seitenreferenz, Region, Extraktionsmethode, Prüfergebnisse und Profilrevision besitzen. Für Listen zusätzlich eine stabile Quellzeilen-ID.

**Wichtig für diese Modellklasse:** Zuerst den vollständigen Ergebnisvertrag und kurze, relevante Eingaben verbessern. Fine-Tuning/LoRA erst prüfen, wenn ein ausreichend großer, sauber gelabelter Bestand einen wiederkehrenden Fehler zeigt, der durch Routing, Ausschnitte und Regeln nicht gelöst wird. Ein Modellwechsel oder andere Quantisierung darf nur nach demselben Regressionstest freigegeben werden.

Temperatur 0 und Guided JSON reduzieren bestimmte Ausgabeprobleme, garantieren aber weder inhaltliche Korrektheit noch identische Ausgaben über Serving-Versionen. Sampling, Thinking-Modus und Bildauflösung mit dem tatsächlich betriebenen Modell vergleichen, statt einen generellen Parameterwert als Qualitätsbeweis zu behandeln.

### Domänenspezifische Anforderungen

| Dokumenttyp | Kritische Qualitätsfragen | Konsequenz für das Profil |
|---|---|---|
| Arztrezept | Richtiger Patient; vollständige Verordnungszeilen; Wirk-/Artikelbezeichnung, Stärke, Menge und Einheit; Datum; Änderungen/Streichungen; angekreuzte Felder | Fachlich kritische Felder markieren, Handschrift gezielt nachlesen, keine automatische Ergänzung aus Plausibilität; nicht lesbare Angaben in Review |
| Antrag | Antragsteller versus Vertreter; Auswahlfelder einschließlich leerer Felder; Pflichtangaben und bedingte Anlagen; konsistente Vorgangsidentität | Bedingte Pflichtregeln, explizite Checkboxzustände, Segmentkorrektur und segmentübergreifende Prüfungen |
| Lieferschein | Bestellt versus geliefert; wiederholte Artikel; Mengen und Einheiten; fortgesetzte Tabellen; Stempel/Handschrift | Tabellenrollen, Quellzeilenidentität, Mengen-/Einheitsprüfung und Vollständigkeitskontrolle |

Das sind Anforderungen an die technische Extraktion, keine medizinische oder rechtliche Bewertung eines Belegs. Welche Informationen nachgelagerte Prozesse zwingend benötigen, muss je Profil festgelegt sein.

## 5. UX: Profile mit Dokumenten einrichten

Heute stehen Strategie, Modell und Prosa-Anweisungen sehr früh im Anlageprozess. Gleichzeitig liefert die Oberfläche Feldvorschläge, Korrekturtabellen, Fundstellensprünge und eine brauchbare Trennung zwischen Betrieb und Einstellungen. Darauf lässt sich aufbauen.

### Empfohlener Ablauf

**Schritt 1: „Zeige uns typische Dokumente.“** Mehrere Beispiele hochladen oder ein fachliches Ausgangsprofil wählen. Varianten und schlecht lesbare Beispiele ausdrücklich einschließen. Ein Dokument reicht für einen ersten Vorschlag, nicht als Qualitätsnachweis.

**Schritt 2: „Welche Angaben brauchst du?“** Felder direkt neben markierten Fundstellen vorschlagen. Nutzer benennt Felder, entfernt unnötige Angaben und markiert kritische Informationen. Technische Feld-ID, Strategie und Modell kommen in erweiterte Einstellungen. Verschachtelte Fachstruktur wird verständlich als „Kopfdaten“, „Positionen“ und „Anlagen“ gezeigt.

**Schritt 3: „Prüfe die Beispiele.“** Original links, Werte rechts. Jede Korrektur führt zur betreffenden Region. Für Fehler auswählbar: falsch gelesen, falsches Feld, falsche Zeile, fehlende Position, falsche Grenze. Fehlende Angaben unterscheiden von nicht lesbaren Angaben.

**Schritt 4: „Teste neue Dokumente.“** Klarer separater Testbestand. Die Oberfläche zeigt erkannte Varianten, kritische Fehler, vollständig richtige Dokumente und geschätzten Reviewbedarf. Keine grüne Prozentzahl ohne Nenner und Versionsbezug.

**Schritt 5: „Profil veröffentlichen.“** Geprüfte Revision aktivieren. Neue Korrekturen ändern einen Entwurf; eine neue Revision geht erst nach bestandenem Test in die Automatik.

### Konkrete UX-Änderungen

- **„Prüfung speichern“ und „Für Verbesserung verwenden“ trennen.** Ein Ausnahmefall muss korrigierbar sein, ohne allgemeines Verhalten zu verändern.
- **Originale erhalten.** Auch Text-/Templatepfade müssen später anhand des Originals prüfbar sein; nicht erst dann Bilder bereitstellen, wenn Vision nötig war.
- **Ungespeicherte Korrekturen schützen.** Aktuell schließen Escape und Navigation das Review ohne Schutz. Entwürfe automatisch erhalten oder beim Verlassen eine konkrete Speicherentscheidung anbieten.
- **Geprüfte Ergebnisse wieder öffnen können.** Heute sperrt `isReviewed` die Bearbeitung. Revisionshistorie statt endgültigem UI-Lock verwenden.
- **Grenzen und Typen im Dokument ändern.** Danach betroffene Teilbereiche neu auslesen; alte Korrekturen nicht unbemerkt verlieren.
- **Lernfortschritt ehrlich erklären.** „Beispiel gespeichert“, „Regelvorschlag erstellt“, „auf 80 unabhängigen Dokumenten geprüft“, „neue Version veröffentlicht“ sind unterschiedliche Zustände.
- **Start mit Fachvorlagen.** Rezept, Antrag und Lieferschein mit sinnvollen Feldgruppen und Regelvorschlägen anbieten. Die heutige technisch generische Strategieauswahl ersetzt keine Domänenvorlage.
- **Schema-Inferenz transparent machen.** Der Scanpfad liest standardmäßig nur zwei Seiten für den Vorschlag. Dem Nutzer den betrachteten Umfang zeigen und spätere Tabellen/Anlagen ergänzen lassen.
- **Widersprüche klar benennen.** „Gelieferte Menge stimmt nicht mit dieser Tabellenzelle überein“ hilft mehr als ein abstrakter Konfidenzbalken.

Die große Projektseite mit rund 4.900 Zeilen sollte entlang dieser Schritte und fachlichen Datenverträge zerlegt werden. Entscheidend ist, die wiederholten Feld-Serializer zu vereinheitlichen; ein reines Komponenten-Refactoring behebt die Qualitätsprobleme nicht.

## 6. Evaluation und Nachweis der Automatisierungsqualität

Die dokumentierten Piloten sind ermutigend, aber eng: Ehinger umfasst 12 gelabelte Belege mit 39 Positionen; die 341 Grundsteuerbescheide stammen laut Dokumentation aus einer Gemeinde. Die Segmentierungskennzahlen beschreiben Seiten-/Grenzerkennung, nicht die Korrektheit der anschließend extrahierten Pflichtfelder.

Für den Anspruch „Best in Class“ braucht es einen wiederholbaren Vergleich auf **demselben repräsentativen Testbestand**. Solange kein solcher Vergleich vorliegt, ist „gute Ergebnisse im Pilotbestand“ die belastbare Aussage.

### Messgrößen in der Reihenfolge ihrer Bedeutung

| Messgröße | Definition und Nutzen |
|---|---|
| Kritische Fehler unter automatisch freigegebenen Dokumenten | Wie oft geht trotz Freigabe eine falsche kritische Angabe weiter? Hauptkennzahl |
| Vollständig korrekte Dokumente | Alle erforderlichen Felder und Positionen korrekt, ohne fehlende oder erfundene Zeilen |
| Feldpräzision und Recall | Getrennt nach Feld, Dokumentvariante, Handschrift, Scanqualität; fehlende Werte nicht wegmitteln |
| Positionsqualität | Zeilen-Recall, zusätzliche Zeilen, richtige Zell-/Spaltenzuordnung und Vollständigkeit über Seiten |
| Automatisierungsquote bei festem Fehlerziel | Welcher Anteil kann bei nachgewiesenem Qualitätsniveau ohne Review verarbeitet werden? |
| Reviewaufwand | Zeit und Interaktionen bis zur korrekten Freigabe; übersehene Fehler im Review |
| Laufzeit | Ende-zu-Ende p50/p95, Warteschlange und Zeit je Stufe; erst nach den Qualitätsgrößen optimieren |

Externe Dokumentation trennt ebenfalls Modellgenauigkeit und Ergebnis-Konfidenz und betont dokumenttypische Variationen sowie anwendungsabhängige Schwellwerte. Daraus folgt kein passender Schwellenwert für diese Plattform; der muss lokal ermittelt werden. [Microsoft: Accuracy und Confidence](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/concept/accuracy-confidence?view=doc-intel-4.0.0), [AWS: Textract Best Practices](https://docs.aws.amazon.com/textract/latest/dg/textract-best-practices.html)

**Testbestand:** Nach Aussteller, Layoutfamilie, Zeitraum und Dokumentqualität trennen. Nahezu identische Kopien nicht zwischen Lern- und Testbestand verteilen. Fehlerfälle und unbekannte Varianten einbeziehen. Originaldateien und fachlich geprüfte Zielwerte versionieren; kritische Felder möglichst unabhängig zweitprüfen.

**Akzeptanzregel:** Kein Kandidat darf die kritische Fehlerrate oder definierte kritische Teilgruppen verschlechtern. Technische Ausfälle zählen im Gesamtvergleich. Höhere Vollautomatisierung ist nur bei eingehaltenem Fehlerziel ein Gewinn.

**Statistische Einordnung:** Null beobachtete Fehler sind nicht null Fehlerrisiko. Unter vereinfachter Annahme unabhängiger, repräsentativer Fälle liegt die einseitige 95-%-Obergrenze bei null Fehlern ungefähr bei `3/n`. Bei 39 Fällen sind das rund 7,7 %, bei 341 rund 0,88 %. Die 39 Positionen sind zudem in nur 12 Dokumenten gruppiert. Für ein beispielhaftes Ziel unter 0,1 % kritischen Fehlern wären ungefähr 3.000 repräsentative, unabhängige, fehlerfreie Freigaben nötig. Das ist eine Planungsgröße, kein bereits vereinbartes Freigabekriterium.

## 7. Geschwindigkeit: nach Qualität gezielt optimieren

**S01 · PDF-Seitenlimit greift zu spät.** [Renderer](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/backend/src/services/extraction/pdf.ts:130): `pdftocairo` rendert im normalen Pfad alle Seiten; erst beim Einlesen wird `maxPages` angewendet. Das begrenzt den CPU-/Plattenverbrauch nicht. Seitenlimit an den Prozess übergeben, Prozesszeit und Ressourcen begrenzen; ausgelassene Seiten sichtbar als unvollständig behandeln.

**S02 · Aufbereitung wird wiederholt.** PDF-Konvertierung wird vor der Strategie abgewartet; Segmentierung rendert zunächst alle Seiten und lässt Sub-PDFs erneut rendern. Bilder bekommen eine vorgeschaltete Volltranskription für den Lerntext. Eine gemeinsame Dokumentrepräsentation mit Original, Text, Seitenbildern und OCR-Layout einmal erzeugen und wiederverwenden.

**S03 · Parallelität ist lokal statt global.** Drei Batchdateien und vier Seiten je Datei können bereits zwölf Modellaufrufe parallel auslösen; mehrere Batches und Evals multiplizieren dies. Eine begrenzte globale Queue je Modell, faire Prioritäten für interaktives Review und getrennte CPU-/GPU-Budgets einführen.

**S04 · Kostenschätzung ist kein Betriebsnachweis.** Retry-Aufrufe werden teilweise als ein Seitenaufruf gezählt. Ergebnisse benötigen echte Zeiten, Tokens, Retries, verarbeitete Seiten und Infrastrukturversion. Erst danach Parallelität, DPI, Caching und Konfidenz-Calls vergleichen.

**S05 · Deterministische Strategie gezielt halten.** `template-labelmap` ist für getestete Label-/Layoutfamilien sinnvoll, aber kein universeller Formularparser. Wiederholte Labels überschreiben skalare Werte; unbekannte Labels erzeugen nur Warnungen. Variantenerkennung und Regeln müssen den Einsatz begrenzen. Die Millisekundenwerte dieses Pfads sind kein Maßstab für Scan-/Vision-Ende-zu-Ende-Latenz.

**Kein pauschales DPI-Senken:** Die vorhandene Ehinger-Dokumentation zeigt bei 150 dpi einen Rückgang des Positions-Recalls. Besser zuerst passende Regionen auswählen und kritische Stellen hochauflösend nachlesen.

## 8. Betrieb und sensible Dokumente

Das aktuelle Datenmodell ist instanzweit und nicht mandantenbezogen; Projektabfragen filtern nach ID, nicht nach Nutzer/Mandant. Dies wird bereits in der Übergabe als Integrationsnaht benannt. Für eine gemeinsame produktive Plattform mit Rezepten und Anträgen sind mandantenbezogene Autorisierung, Original-/Beispielspeicherung, Aufbewahrung und Auditierung Teil des Ergebnisvertrags. Hier wurde keine neue Auth-Umgehung nachgewiesen.

Weitere Produktionsanforderungen sind persistente Jobs mit Retry-/Abbruchsemantik, Idempotenz bei Wiederholung, atomare Review-/Trainingupdates und dauerhafte Webhook-Zustellung. Die heutige Fire-and-forget-Verarbeitung mit Stale-Recovery ist eine Pilotlösung; ein Prozessneustart ermöglicht keine reguläre Fortsetzung der ursprünglichen Batchdateien.

Dokumenttext und Few-Shot-Beispiele dürfen außerdem nicht als vertrauenswürdige Anweisungen behandelt werden. Der aktuelle Adapter hängt Beispieltexte in den Systemkontext. Dokumentbasierte Prompt-Injection und das Übernehmen falscher Regeln gehören deshalb in den Regressionstest. Das ist ein Prüfbedarf aus dem Codeaufbau, kein hier nachgewiesener erfolgreicher Angriff.

## 9. Umsetzungsreihenfolge und Abnahmekriterien

| Paket | Inhalt | Abnahme |
|---|---|---|
| A · Automatik absichern | F01–F08, F12: Routing, Pflichtprüfung, Evidenz, Zeilenidentität, Fehlerstatus und Freigabe | Alle Gegenbeispiele als Soll-Regressionstests; Bilder/PDFs/Listen/Segmente korrekt; keine Freigabe bei unvollständiger Pflichtprüfung |
| B · Qualität messbar machen | F09–F10, F15: Originale, versionierter Testbestand, produktionsgleiche Evaluation und Profilsnapshot | Fehlgeschlagene Fälle zählen; keine Trainingsdaten im Test; kritische Teilgruppen sichtbar; Ergebnis reproduzierbar |
| C · Profil- und Lernprozess | F11, F13–F14: verlustfreie Editoren, Feld-/Segmentkorrektur, getrenntes Review und Lernen, geführte Einrichtung | Fachanwender richten mit Beispielen ein Profil ein; Korrekturen bleiben erhalten; veröffentlichte Version besteht unabhängigen Test |
| D · Geschwindigkeit und Betrieb | Gemeinsame Aufbereitung, gezielte Nachläufe, globale Queue, persistente Jobs | Gleiche Qualitätsziele bei besserer p95-Latenz; Lastgrenzen und Wiederanlauf nachgewiesen |

**Erster konkreter Meilenstein:** Ein Lieferscheinprofil und ein Rezept- oder Antragsprofil durch dieselbe abgesicherte Pipeline führen. Dabei Originale, Pflichtfelder, doppelte Positionen, Handschrift, eine ausgefallene Prüfung und eine falsche Segmentgrenze bewusst testen. Danach erst weitere Dokumenttypen verbreitern.

**Produktentscheidung:** „Automatisch freigegeben“ darf künftig ausschließlich bedeuten: vollständig geprüft nach einer getesteten, unveränderlichen Profilrevision. Ein hoher Modellscore allein darf diese Aussage nicht tragen.
