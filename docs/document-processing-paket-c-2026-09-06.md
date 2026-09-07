# Document Processing – Paket C

Stand: 6. September 2026. Lokal implementiert, nicht deployed. Baut auf Paket A und B auf.

## Ergebnis

Paket C verbessert die Profileinrichtung, das Prüfen zusammengesetzter Dokumente und die kontrollierte Nutzung bestätigter Beispiele. Die Priorität bleibt Extraktionsqualität vor UX und Geschwindigkeit. Eine tatsächliche Qualitätssteigerung mit Qwen ist noch am unabhängigen Testbestand nachzuweisen.

## Änderungen

### Profile einrichten und bearbeiten

- „Einrichtung begleiten“ führt durch Feldschema, Lernbeispiele, unabhängige Testbeispiele und Qualitätsmessung. Die Schritte verlinken die jeweilige Bearbeitung und zeigen den aktuellen Stand.
- Das Bearbeiten von Feldern erhält Aliase, Kataloge, Listenunterfelder und weitere bestehende Eigenschaften. Eine geänderte Bezeichnung ändert nicht mehr automatisch die Feld-ID.
- Doppelte IDs, fehlende Bezeichnungen und Listen ohne Spalten werden vor dem Speichern gemeldet.
- Segmentprofile erhalten lokale Prüfregeln. Übergreifende Regeln können Felder verschiedener Abschnittstypen vergleichen; wiederholte Abschnitte werden vollständig berücksichtigt. Fehlende oder ungeeignete Vergleichswerte verhindern einen erfolgreichen Regelstatus.

### Dokumente prüfen

- Felder und Listen sind auch innerhalb von Segmenten editierbar.
- Feldkorrekturen werden als Prüfentwurf gespeichert, ohne das Dokument freizugeben. Beim normalen Schließen oder Blättern wartet die Oberfläche auf das Speichern. Entwürfe erhalten Original, Extraktion und bisherigen Prüfstatus.
- Abschnittstypen und Seitengrenzen lassen sich korrigieren; Abschnitte können geteilt oder zusammengeführt werden. Der Server prüft vollständige, lückenlose Seitenabdeckung, bekannte Typen und Pflichtabschnitte.
- Nur Abschnitte mit geändertem Typ oder Seitenbereich werden neu extrahiert. Unveränderte Abschnitte behalten ihre korrigierten Werte. Für neu extrahierte Abschnitte werden bisherige Feldkorrekturen ersetzt; die Oberfläche weist darauf hin.
- Anschließend werden Pflichtangaben, Kataloge und lokale sowie übergreifende Regeln erneut geprüft. Das Ergebnis benötigt weiterhin eine menschliche Bestätigung.

### Lernen kontrollieren

- Neu gespeicherte Lernbeispiele sind zunächst Kandidaten. Auch vollständig richtig erkannte Dokumente können als Lernbeispiele gespeichert werden.
- Erst der erfolgreiche Vergleich mit dem unabhängigen Testbestand aktiviert Kandidaten zusammen mit den vorgeschlagenen Guidelines. Ausfälle oder Verschlechterungen gemäß den Kriterien aus Paket B verhindern die Übernahme.
- Bestehende aktive Beispiele bleiben nutzbar. Testbeispiele sind aus Lernprompts ausgeschlossen.
- Textbeispiele verwenden passende Quellenausschnitte um bestätigte Werte, statt ausschließlich den Dokumentanfang. Nicht belegte Zielfelder und unvollständig belegte Listen werden aus dem Textbeispiel ausgelassen. Die Zeichenbudgets begrenzen die gesamte Beispielmenge.
- Bei Segmenten werden ausschließlich die Werte, Quellenausschnitte und Korrekturen des betreffenden Abschnitts verwendet.
- Kurze Dokumente beziehungsweise Abschnitte können zusätzlich mit ihren vollständigen Seitenbildern als visuelle Beispiele dienen: höchstens zwei Seiten pro Beispiel und zwei Beispiele pro visuellem Prompt. Beispielbilder und aktuelles Dokument werden getrennt übergeben.
- Die Snapshot-Pipelineversion wurde auf 3 angehoben, damit Messungen den geänderten Verarbeitungspfad berücksichtigen. Die Segmentklassifikation berücksichtigt nun ebenfalls das im Profil gewählte Modell.

## Prüfung

- Extraktionssuite einschließlich Dokumentkonverter: **307 Tests erfolgreich, 0 Fehler, 855 Assertions** (`bun test src/extraction src/services/extraction src/services/documentConverter.test.ts`).
- Darunter elf gezielte Paket-C-Tests für Editor-Roundtrips, ID-Kollisionen, begrenzte Quellausschnitte, Kandidatenfreigabe, visuelle Beispiele, Abschnittspläne, segmentbezogene Beispiele und Regeln. Ein echter zweiseitiger PDF-Fall mit kontrolliertem Extraktionsrunner prüft die selektive Neuverarbeitung und den Erhalt unveränderter Korrekturen.
- Integration mit einer temporären lokalen PostgreSQL-Instanz erfolgreich: Kandidatentrennung, Freischaltung und Entwürfe zusätzlich zu den Persistenzprüfungen aus Paket B. Dabei gefundener Fehler behoben: Teilupdates dürfen nicht mitgesendete Ergebnisfelder nicht leeren.
- Frontend-Produktionsbuild erfolgreich; `git diff --check` ohne Befund.
- Der globale TypeScript-Check bleibt wegen bestehender Repository-Fehler rot. Im Extraktionsbereich verbleibt der bekannte Testfixture-Fehler in `export-xlsx.test.ts:29`; die neuen Paket-C-Dateien verursachen keine gemeldeten Typfehler.

## Konkreter manueller Abnahmetest

1. Ein Profil öffnen und „Einrichtung begleiten“ durchgehen. Eine Feldbezeichnung ändern, speichern und erneut öffnen: ID, Aliase, Katalog und Listenspalten müssen erhalten bleiben.
2. Ein Dokument prüfen, einen Wert ändern und ohne Freigabe schließen. Erneut öffnen: Die Korrektur muss sichtbar sein, das Dokument weiterhin ungeprüft.
3. Ein segmentiertes Dokument mit mindestens zwei Abschnitten öffnen. Ein Feld im ersten Abschnitt korrigieren und nur den zweiten Abschnitt neu zuordnen. „Zuordnung anwenden & betroffene Abschnitte neu auslesen“ ausführen: Die erste Korrektur bleibt erhalten; der geänderte Abschnitt muss erneut geprüft werden.
4. Eine übergreifende Gleichheitsregel, beispielsweise für eine Vorgangsnummer, mit passenden, abweichenden und fehlenden Werten prüfen. Eine Abweichung in einer wiederholten Instanz darf nicht übergangen werden.
5. Ein korrektes Dokument als Lernbeispiel speichern: Es erscheint als Kandidat. Ein anderes Original als unabhängiges Testbeispiel speichern. Unter „Regeln & Qualität“ mit „Neu ableiten & messen“ prüfen. Aktivierung beziehungsweise Ablehnung muss anhand der Messergebnisse nachvollziehbar sein.

## Grenzen und Betrieb

Keine produktiven Dokumente verarbeitet, keine echten Qwen-Aufrufe und keine vollständige Browser-Abnahme durchgeführt. Die automatisierten Tests belegen die Programmlogik, nicht die fachliche Extraktionsgüte des Modells. Diese ist mit repräsentativen, unabhängigen Originalen je Dokumentvariante zu messen.

Seitengrenzen werden erst mit „Zuordnung anwenden“ gespeichert; automatisches Speichern betrifft Feldkorrekturen. Ein sofortiges Beenden des Browsers während einer noch nicht abgeschlossenen Speicherung kann die letzte Änderung verlieren.

Visuelle Beispiele benötigen zusätzlichen Speicher und Modellkontext. Längere Dokumente verwenden belegte Textausschnitte; unbegrenzt viele Beispielseiten werden nicht übertragen. Die umfassende Geschwindigkeitsoptimierung bleibt einem späteren Paket vorbehalten.

Paket C benötigt keine zusätzliche Datenbankmigration; die noch nicht produktiv ausgeführte Migration `0035_extraction_dataset.sql` aus Paket B bleibt Voraussetzung. Keine Änderungen committed oder deployed.
