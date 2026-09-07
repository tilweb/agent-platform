# Document Processing – Paket D

Stand: 6. September 2026. Lokal umgesetzt, nicht deployed. Voraussetzung: Pakete A bis C und ihre Datenbankmigrationen.

## Ergebnis und Nachweisgrenze

Die Verarbeitung erhält wiederverwendbare Dokumentaufbereitung, gemeinsame Lastgrenzen, dauerhaft gespeicherte Batch-Jobs und Laufzeitmessungen. Feldschema, DPI, Vollständigkeitsprüfung und menschliche Freigabe werden dafür nicht reduziert.

Die funktionalen Tests und ein lokaler Aufbereitungsbenchmark bestehen. **Eine bessere Ende-zu-Ende-p95 bei gleicher fachlicher Qualität auf euren Qwen-Modellen ist noch nicht nachgewiesen.** Dafür muss derselbe unabhängige Dokumentbestand vor und nach der Umstellung unter vergleichbarer Last gemessen werden. Das vollständige fachliche Abnahmekriterium aus dem Audit bleibt bis dahin offen.

## Umsetzung

### Gemeinsame Aufbereitung

- PDF-Seitenzahl, Layouttext und Rendering werden innerhalb einer Dokumentverarbeitung anhand identischer Originalbytes und Parameter wiederverwendet. Gleichzeitig angeforderte identische Aufbereitung läuft einmal; Fehler werden nicht dauerhaft zwischengespeichert.
- Der Cache ist auf die einzelne Dokumentverarbeitung begrenzt. Unterschiedliche Dokumente, Auflösungen oder Seitenauswahlen werden nicht verwechselt.
- Segment-Sub-PDFs behalten ihren eigenen Text und greifen auf die passenden Seitenbilder des Originals zurück. Die Seitennummern werden für die Teilverarbeitung neu gezählt. Die ursprüngliche Auflösung bleibt erhalten.
- Für explizite Vision-PDF-Profile startet das Rendering parallel zur vorhandenen Textkonvertierung. Der bisherige Lerntext und dessen Auswahlwirkung bleiben erhalten.
- PDF-Aufbereitungen haben eine gemeinsame CPU-Queue. Die Poppler-Prozesse werden nach spätestens 120 Sekunden beendet.
- Die gezielte Neuverarbeitung geänderter Abschnitte aus Paket C bleibt erhalten. Unveränderte Abschnitte benötigen keine neuen Extraktionsaufrufe.

### Modelllast und Messung

- Gemeinsame Modellqueues begrenzen Aufrufe über Dokumente, Batches, Evaluation und interaktive Verarbeitung hinweg. Interaktive Anfragen haben innerhalb eines Prozesses Vorrang; Alterung schützt länger wartende Arbeit vor dauerhaftem Zurückstellen.
- Bei konfigurierter PostgreSQL-Verbindung begrenzen geleaste Modellslots die Gleichzeitigkeit auch über Backend-Replikate hinweg. Alle Replikate müssen dieselben Limits verwenden. Ohne PostgreSQL greift nur die Prozessgrenze.
- Queue-Wartezeit löst keinen vermeintlichen Provider-Timeout und keinen zusätzlichen Retry aus. Der eigentliche HTTP-Aufruf verwendet den abbrechenden Provider-Timeout.
- Auditdaten enthalten Verarbeitungsdauer, Modellwartezeit, Modellaufrufe und -fehler, Aufbereitungszeit und Cache-Treffer. Für den OpenAI-kompatiblen Adapter werden tatsächliche HTTP-Versuche einschließlich Retries sowie vom Provider gemeldete Tokens erfasst. Fehlende Tokenangaben bleiben unbekannt; Tokenberichte werden separat gezählt.
- Die Stapelansicht zeigt Median und 95. Perzentil der gespeicherten Dateiverarbeitungszeiten einschließlich Fallzahl. Diese Werte beginnen beim Start der Datei und enthalten nicht die vorherige Wartezeit des Stapels. Stufenzeiten können wegen Parallelität nicht zur Gesamtzeit addiert werden.

### Dauerhafte Jobs und Wiederanlauf

- UI-Uploads, öffentliche Batch-API und die Weiterleitung aus dem Posteingang speichern Originale, Prüfsummen, Profilsnapshot, Dateizeilen und Job atomar, bevor sie Erfolg melden.
- Der Worker beansprucht einen Job atomar mit `FOR UPDATE SKIP LOCKED`. Eine 90-Sekunden-Lease wird alle 20 Sekunden erneuert. Nach einem Prozessausfall kann ein anderer Worker die abgelaufene Lease übernehmen.
- Fertige und bereits fehlgeschlagene Dateien werden beim automatischen Wiederanlauf übersprungen. Nur offene Dateien werden aus den gespeicherten Originalen rekonstruiert; deren Prüfsummen werden kontrolliert.
- Ergebnisupdates sperren die zugehörige Jobzeile und prüfen Besitz sowie Lease. Alte Worker können nach Übernahme oder Abbruch keine Ergebnisse mehr überschreiben. Nach drei unterbrochenen Versuchen wird der automatische Wiederanlauf gestoppt.
- „Verarbeitung abbrechen“ stoppt die Annahme weiterer Ergebnisse. Bereits laufende Provider-Aufrufe können bis zu ihrem Timeout weiterlaufen; noch nicht gestartete Modellaufrufe prüfen erneut den Jobbesitz.
- „Fehlgeschlagene Dateien erneut verarbeiten“ startet gezielt die fehlgeschlagenen Dateien mit dem ursprünglichen Profilsnapshot und den gespeicherten Originalen. Fertige beziehungsweise geprüfte Dateien bleiben erhalten.
- Webhook-Ereignisse erhalten eine stabile `event_id` pro Lauf und Wiederholungsgeneration. Nach einem Absturz ist doppelte Zustellung möglich; Empfänger können diese ID zur Deduplizierung verwenden. Eine bewusste Wiederholung erhält eine neue Generation. Dies ist keine Exactly-once-Zustellung und kein eigenständiger dauerhafter Webhook-Outbox-Dienst.

## Verifikation

- Extraktionssuite: **313 Tests erfolgreich, 0 Fehler, 878 Assertions**, einschließlich lokaler Webhook-Tests. Die Datenbankverbindung wurde für diesen Lauf explizit deaktiviert; Providerantworten in den Regressionstests sind simuliert.
- Neue Tests prüfen gemeinsame Parallelitätsgrenzen, Priorität interaktiver Arbeit, Wiederverwendung und Isolation der Aufbereitung, Fehlerbereinigung, Queue-Wartezeit versus Retry sowie tatsächliche Adapter-Retry- und Tokenmessung mit simuliertem HTTP.
- Integration in einer temporären lokalen PostgreSQL-Instanz: Migration, konkurrierende Jobübernahmen, simulierte Lease-Abläufe und Wiederübernahme, Zurückweisung alter Worker, Erhalt fertiger Ergebnisse, Originalrekonstruktion, Abbruch, selektive Wiederholung, Wiederholungsgeneration und gemeinsame Modellslots erfolgreich. Die Instanz wurde danach entfernt.
- Frontend-Produktionsbuild erfolgreich. `git diff --check` ohne Befund. Der globale TypeScript-Check hat weiterhin bekannte Repository-Fehler; im Extraktionsbereich betrifft dies die bestehende Fixture in `export-xlsx.test.ts:29`.

### Lokaler Teilbenchmark

Reproduzierbar mit `SCALINGO_POSTGRES= bun tools/document-processing-paket-d-benchmark.ts`: zwölf Durchläufe, synthetisches PDF mit zwei unterschiedlich großen Seiten, zweimalige Aufbereitung mit 200 dpi. Verglichen werden getrennte Aufbereitung und Wiederverwendung; zusätzlich werden Pixelgleichheit, Abmessungen und die Seitenzuordnung einer Teilansicht geprüft.

| Aufbereitung | Median | p95 |
|---|---:|---:|
| Zweimal separat | 36,6 ms | 64,6 ms |
| Wiederverwendet | 18,5 ms | 20,5 ms |

Das ist eine lokale Messung der Aufbereitung eines sehr kleinen Dokuments, kein Modellbenchmark und keine Prognose für produktive Gesamtlaufzeiten.

## Migration und Betrieb

Vor dem Start dieses Backendstands muss **`0036_extraction_jobs.sql`** nach der Migration aus Paket B ausgeführt werden. Sie ergänzt `extraction.jobs` und `extraction.model_slots`. Es wurde keine produktive Migration ausgeführt.

| Einstellung | Standard | Bedeutung |
|---|---:|---|
| `EXTRACTION_MODEL_CONCURRENCY` | 4 | Slots je Provider/Modell; replikatübergreifend bei PostgreSQL |
| `EXTRACTION_CPU_CONCURRENCY` | 2 | Gleichzeitige PDF-Aufbereitungen je Backendprozess |
| `EXTRACTION_BATCH_CONCURRENCY` | 3 | Gleichzeitig verarbeitete Dateien innerhalb des aktuellen Jobs |
| `EXTRACTION_WORKER_DISABLED=1` | aus | Workerstart unterbinden, etwa für isolierte Tests |

Ungültige Parallelitätswerte fallen auf den Standard zurück. Modellslots haben eine zehnminütige Lease mit Heartbeat; nach einem harten Prozessausfall kann ein belegter Slot daher bis zum Ablauf fehlen. Die CPU-Grenze gilt pro Prozess; Host-/Container-Ressourcenlimits bleiben erforderlich.

Job-Ergebnisbilder werden zunächst inline gespeichert, damit ein verspäteter Worker keine gemeinsam benannten Bildobjekte überschreiben kann. Zusammen mit den gespeicherten Originalen erhöht das die Datenbankgröße. Eine spätere Auslagerung sollte unveränderliche, versuchsbezogene Objekt-IDs verwenden. Das Posteingang-Splitting vor der Übergabe an die Batch-Verarbeitung und laufende Evaluationsaufträge sind noch keine dauerhaft fortsetzbaren Jobs.

## Manuelle Abnahme nach Bereitstellung

1. Zwei Stapel hochladen und zusätzlich ein Dokument interaktiv prüfen. Unter Last müssen Modell- und CPU-Grenzen eingehalten werden; die interaktive Verarbeitung darf nicht hinter allen wartenden Evaluationen stehen.
2. Einen mehrteiligen Stapel starten und das Backend nach dem ersten fertigen Dokument neu starten. Nach Ablauf der Lease werden offene Dateien fortgesetzt; die erste Datei und ihr Profilstand bleiben unverändert.
3. Einen laufenden Stapel abbrechen. Späte Ergebnisse dürfen nicht mehr erscheinen. Anschließend nur die fehlgeschlagenen Dateien wiederholen und den Erhalt fertiger Ergebnisse kontrollieren.
4. Geänderte Abschnittsgrenzen anwenden. Unveränderte Korrekturen bleiben erhalten; Seiten und Fundstellen müssen weiterhin zum Original passen.
5. Den unabhängigen Testbestand mit Qwen erneut auswerten. Vollständig korrekte Dokumente, Einzelfelder, Varianten und Ausfälle mit dem bisherigen Stand vergleichen. Danach p50/p95 einschließlich Upload-, Stapelwarte- und Extraktionszeit unter derselben Last messen.

Keine echten Qwen-Aufrufe, kein Deployment und keine vollständige Browser-Abnahme durchgeführt. Änderungen sind nicht committed.
