# Document Processing – Paket B

Stand: 6. September 2026. Lokal implementiert, nicht deployed. Baut auf Paket A auf.

## Ergebnis

Die Qualität wird jetzt an einem getrennten Testbestand mit Originaldateien gemessen. Regeländerungen dürfen weder Ausfälle noch schlechtere Einzelfelder oder Dokumentvarianten hinter einem besseren Durchschnitt verstecken. Laufende Stapel, Reviews und Exporte verwenden den gespeicherten Profilstand.

### Lern- und Testbestand

Beim Freigeben stehen drei Möglichkeiten zur Verfügung:

- **Nur freigeben:** keine Aufnahme in einen Beispielbestand.
- **Als Lernbeispiel speichern:** fließt in Few-Shot und die Ableitung gelernter Regeln ein. Auch unverändert korrekte Ergebnisse sind geeignet.
- **Als unabhängiges Testbeispiel speichern:** wird ausschließlich zur Messung verwendet. Optional kann eine Dokumentvariante angegeben werden, etwa „Scan“, „Handschrift“ oder ein Lieferant.

Bestehende Beispiele bleiben Lernbeispiele. Testbeispiele benötigen ein neu verarbeitetes Original; ein alter Lernfall wird nicht nachträglich zu einem unabhängigen Testfall erklärt. Gleiche Originalbytes und übereinstimmende normalisierte Dokumenttexte werden erkannt. Gleichzeitige Speicheranfragen sind durch eine Datenbanktransaktion geschützt. Gespeicherte Fingerabdrücke verhindern einen Wechsel zwischen Lern- und Testzweck auch nach dem Löschen eines Beispiels. Unterschiedliche Scans desselben physischen Dokuments können diese Erkennung umgehen; die fachliche Auswahl neuer Testdokumente bleibt erforderlich.

### Produktionsgleiche Evaluation

Die Evaluation ruft denselben `extract()`-Einstieg wie die Verarbeitung auf. Sie rekonstruiert die Originaldatei in einem temporären Verzeichnis und nutzt das Profil mit seinen produktiven Strategieeinstellungen, Modell, Lernbeispielen und Referenzwerten. Die bisherige erzwungene Text-Single-Pass-Messung entfällt. Das temporäre Verzeichnis wird auch bei Fehlern entfernt.

Der gesamte aktuell gespeicherte Testbestand wird ausgewertet. Champion und Kandidat verwenden denselben Bestand. Fehlgeschlagene Fälle bleiben im Nenner: Ein korrektes Dokument plus ein Timeout ergeben 50 Prozent und einen Ausfall. Jeder Ausfall verhindert die Übernahme des Kandidaten. Zusätzlich darf kein Feld, keine Dokumentvariante und die Quote vollständig korrekter Dokumente schlechter werden.

Die Oberfläche zeigt Feldkorrektheit, vollständig korrekte Dokumente, Ausfälle und Ergebnisse je Dokumentvariante einschließlich Fallzahl. Ein 95-Prozent-Wilson-Intervall macht die Unsicherheit kleiner Testbestände sichtbar. Die frühere „Genauigkeit“ aus unkorrigierten Lernbeispielen heißt jetzt ausdrücklich „Lernbeispiele ohne Korrektur“.

### Versionierung und Nachvollziehbarkeit

Ein Stapellauf speichert seinen Profilstand einmalig. Dazu gehören Feldschema, Segmentdefinitionen, Anweisungen, Guidelines, wirksame Extraktionskonfiguration, aufgelöstes Modell, Lernbeispiele und verwendete Tabellenwerte. Nachträgliche Profiländerungen verändern diesen Stand nicht. Ergebnis-Auditdaten enthalten Profil- und Snapshot-Hashes. Review-Formulare und Exporte verwenden das Schema des ursprünglichen Laufs.

Jede Messung erhält ein eigenes unveränderliches Datenbankartefakt mit Original-Testdateien, bestätigten Werten, Ergebnissen und Fehlern pro Fall, Konfidenzen, Profilstand und Kennzahlen. Das Artefakt bleibt beim Löschen einzelner Beispiele erhalten; beim Löschen des Projekts wird es mit entfernt. Unter „Regeln & Qualität“ kann der letzte Messstand einschließlich Originalen heruntergeladen werden.

Cache-Identitäten berücksichtigen Beispielinhalte, Schema, Anweisungen, Einstellungen und Referenzwerte. Veraltete Messungen werden bei Änderungen am Profil oder Beispielbestand markiert. Während einer Messung geänderte Profile oder Beispiele verhindern die Übernahme der Kandidatenregeln. Lernmetadaten werden unter einer Zeilensperre aktualisiert, damit gleichzeitige Änderungen nicht verloren gehen.

### Kalibrierung

Die Konfidenzverteilung wird zusätzlich auf dem unabhängigen Testbestand gegen die bestätigten Werte gemessen. Beobachtungen aus Lernkorrekturen bleiben davon getrennt und werden nicht als repräsentativer Qualitätsnachweis bezeichnet. Fälle ohne Konfidenz sind in der Ausfallquote enthalten, können jedoch keinem Konfidenzbereich zugeordnet werden.

**Paket B aktiviert noch keine automatische Freigabe von Modellergebnissen.** Dafür müssen ausreichend viele repräsentative Originale mit dem tatsächlichen Modell gemessen und die zulässige Fehlerquote fachlich festgelegt werden. Eine kleine fehlerfreie Stichprobe oder die Selbsteinschätzung des Modells reicht dafür nicht.

## Verifikation

- 296 Tests bestanden, 0 fehlgeschlagen; 812 Assertions in 27 Testdateien.
- Zusätzliche Integration gegen eine neu angelegte lokale PostgreSQL-Instanz: Migration, konkurrierende Duplikatanfragen, dauerhafte Zwecktrennung, Few-Shot-Auswahl, atomare Metadatenänderungen, unveränderlicher Stapelstand, Originalerhalt beim Review, Messartefakte und Löschkaskade geprüft. Testinstanz anschließend gestoppt und entfernt.
- Frontend-Produktionsbuild erfolgreich. Bestehende Warnungen zu doppelten Objektschlüsseln und Bundlegrößen bleiben vorhanden.
- Globaler TypeScript-Check weiterhin durch bestehende Repository-Diagnosen blockiert; keine neuen Diagnosen in den geänderten Produktionsdateien. Im Extraktionsbereich bleibt der bereits vorhandene Test-Fixture-Fehler in `export-xlsx.test.ts`.
- Offline-Auditskript mit korrigierter Timeout-Erwartung erfolgreich.

Es gab keinen Live-Qwen-Lauf und keine Prüfung in eurer produktiven Oberfläche.

## Einführung und Praxistest

Die neue additive Migration ist `backend/drizzle/0035_extraction_dataset.sql`. Sie ergänzt Beispielmetadaten, den Stapel-Snapshot und die Tabelle für Messartefakte. Backend und Frontend müssen gemeinsam aktualisiert werden; die Migration muss vor Nutzung der neuen Speicherpfade erfolgreich angewandt sein. An eurer produktiven Datenbank wurde nichts geändert.

1. Mehrere neue, unterschiedliche Dokumente verarbeiten und vollständig am Original prüfen. Einen Teil als Lernbeispiele, andere als Testbeispiele speichern. Die Testdokumente dürfen zuvor nicht zum Lernen verwendet worden sein.
2. Unter „Regeln & Qualität“ neu messen. Fallzahlen, Fehler, Felder und Dokumentvarianten mit den bekannten Ergebnissen vergleichen.
3. Einen Messstand herunterladen und die enthaltenen Originale, Sollwerte und tatsächlichen Ergebnisse prüfen.
4. Nach einem Lauf ein Feld im Profil ändern. Beim Öffnen und Exportieren des alten Laufs muss weiterhin dessen ursprüngliches Schema verwendet werden.

## Bewusste Grenzen

- Die Verarbeitungswege sind gleich; gehostete Modelle und Konverter können trotzdem andere Antworten liefern. Modellrevisionen werden vom Anbieter nicht fest gepinnt. Der Snapshot hält Modellkennung, verfügbare Buildkennung, Sampling und Konverter-Konfigurationsfingerabdruck fest; er garantiert keine bitidentische Wiederholung.
- Originale und Messartefakte werden zunächst in JSONB gehalten. Das schafft eine transaktionale, selbständige Ablage, erhöht aber Datenbank- und Backupvolumen. Objektspeicher, Aufbewahrungspolitik und Langläufersteuerung gehören zur folgenden Betriebs-/Geschwindigkeitsarbeit.
- Wiederholte Kandidatenwahl auf demselben Testbestand kann diesen schrittweise zur Optimierungsgrundlage machen. Für belastbare Abnahmemessungen sollten regelmäßig neue, bisher unberührte Dokumente hinzukommen.
- Segmentergebnisse werden konservativ als vollständige Instanzen verglichen. Eine ausführliche Zellmetrik und die Bearbeitung von Segmentgrenzen sind damit noch nicht umgesetzt.
