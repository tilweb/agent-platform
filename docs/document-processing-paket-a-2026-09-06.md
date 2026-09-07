# Document Processing – Paket A

Stand: 6. September 2026. Implementiert im lokalen Arbeitsverzeichnis, nicht deployed.

## Ergebnis

Paket A schließt die im Audit beschriebenen Freigabelücken F01–F08 und F12. Die Maßnahmen erhöhen insbesondere die Zuverlässigkeit der Fehlererkennung. Eine neu gemessene Modellgenauigkeit wird damit nicht behauptet.

**Bewusste Übergangsregel:** LLM-Ergebnisse benötigen eine menschliche Bestätigung. Ein unkalibrierter Modellscore oder ein OCR-Vorkommen allein gibt keine Daten frei. Eine empirisch abgesicherte automatische Modellfreigabe bleibt Gegenstand von Paket B. Der deterministische Templatepfad kann bei vollständigen Werten und erfolgreichen Prüfungen weiterhin automatisch freigegeben werden.

## Änderungen

| Audit | Implementierung |
|---|---|
| F01 | Hybrid-Default aktiviert Vision konsistent auch bei UI-/API-Konfigurationsobjekten. Explizites `vision_fallback: false` bleibt respektiert. |
| F02 | Bildquellen gehen direkt in die Visionstrategie. Die zusätzliche Lerntranskription bleibt best-effort mit Timeout; ihr Ausfall verhindert weder Pixelauswertung noch Review. |
| F03 | Modellheuristiken werden nicht mehr durch Wiederholung auf 1,0 angehoben. Ein eigener blockierender Prüfgrund fordert die Bestätigung der Feldzuordnung/Vollständigkeit. Alte modellbasierte Auto-OK-Ergebnisse werden ebenfalls nicht automatisch exportiert. |
| F04 | OCR-Nummern benötigen vollständige Übereinstimmung; mehrteilige Werte benachbarte vollständige Wörter. Befund heißt `located`, nicht `verified`, und erhöht den Score nicht. Ein verbrauchtes Zeilenanker-Vorkommen darf nicht erneut eine zweite Position belegen. |
| F05 | Rekursiver Ergebnisvalidator prüft Pflichtwerte, Listenzellen, Segmentfelder und Typen unabhängig vom Score. Leere Pflichtlisten und unbekannte Felder blockieren. |
| F06 | Wertgleiche Zeilen bleiben erhalten und behalten ihre Indizes. Der Merger erfasst Quellchunk/-seite und Zeilenindex in seiner Provenienz. Gleiche Positionen aus verschiedenen Quellen werden zur Prüfung markiert. |
| F07 | Gemeinsame strikte Zahlen-/Datumsparser; endliche Zahlen, echte Kalenderdaten, gültige Booleans/Positionsobjekte. Finale Enginefehler werden als blockierende Befunde weitergereicht. Reparierte Werte verlieren veraltete Boxen/Provenienz und Konfidenz. |
| F08 | Ausgefallene oder mangels Werten nicht mögliche Regeln erhalten `not_evaluated` und blockieren. Hybrid meldet Parse-/Render-/Seitenfehler. Bereits ein unsicheres Feld kann Vision auslösen. Unbekannte Dokumentgrenzen und fehlgeschlagene Trennung werden nicht als erfolgreiche Verarbeitung behandelt. PDF-Seitenlimits greifen bereits beim Renderprozess. |
| F12 | Review unabhängig vom Lernen; Validierung vor Training/Freigabe. Standardweitergabe nur freigegebener Ergebnisse. Fehlende Seiten und Segmentierungsfehler bleiben auch nach Feldkorrekturen blockierend. |

Zusätzlich: Textbasierte PDF-Extraktionen erhalten eine gerenderte Originalansicht für das Review. Bereits gespeicherte Seitenbilder bleiben beim Aktualisieren von Boxen erhalten. Wiederholte, widersprüchliche Template-Labels werden gemeldet, statt den ersten Wert still zu überschreiben.

## Freigabe und Schnittstellen

Die bestehenden Statusnamen bleiben kompatibel:

- `completed`: technische Extraktion beendet; keine fachliche Freigabe.
- `needs_review`: menschliche Prüfung erforderlich.
- `reviewed`: über den validierenden Reviewpfad bestätigt.
- `auto_ok`: für die Weitergabe nur bei deterministischer Templateextraktion und ohne blockierende Befunde akzeptiert.

Neuer Endpunkt:

`POST /api/extraction/projects/:id/batches/:runId/files/:fileId/review`

Payload:

```json
{
  "corrected": { "belegnummer": "LS-123" },
  "learn": false
}
```

`corrected` muss dem vollständigen erforderlichen Profil entsprechen. `learn` ist optional und standardmäßig aus. Ohne Lerntext ist Bestätigen möglich, Lernen nicht. Der bestehende `/learn`-Endpunkt verwendet dieselbe Freigabeprüfung und bleibt standardmäßig ein Lernaufruf.

Bei blockierenden Befunden erfolgt HTTP 422; das Ergebnis wird nicht freigegeben und nicht als Trainingsbeispiel gespeichert. Fehlende Pflichtwerte müssen korrigiert, nicht ausgeführte Regeln wieder ausführbar gemacht und unvollständige Dokumente neu verarbeitet werden. Ein allgemeiner „trotzdem freigeben“-Schalter wurde nicht eingeführt.

Nach einer menschlichen Freigabe werden alte Modellkonfidenzen und Boxen geleert. Die Originalseiten bleiben erhalten. Diese konservative Entwertung vermeidet, dass nach einer Korrektur die Evidenz eines anderen Werts angezeigt wird.

**Weitergabe:**

- Tabellenweitergabe und Standard-XLSX-/CSV-/JSON-Exporte enthalten nur freigegebene Ergebnisse.
- REST-XLSX/CSV unterstützen `scope=diagnostic` für alle Ergebnisse; die UI bietet „Diagnoseexport (alle)“. Diagnoseausgaben enthalten Prüfstatus/Befunde, UI-Dateinamen einen Diagnosezusatz.
- Die Public-XLSX-Funktion exportiert nur freigegebene Ergebnisse.
- Rohdaten-/Statusabfragen bleiben für Diagnose und Review vollständig abrufbar.
- `batch.completed`-Webhooks liefern nur freigegebene Dateien sowie Zähler für offenen Reviewbedarf.
- Nach erfolgreichem Review wird zusätzlich `file.reviewed` mit `file_id` und der freigegebenen Datei an den konfigurierten Webhook gemeldet. Empfänger müssen dieses neue Ereignis verarbeiten, wenn menschlich freigegebene Ergebnisse automatisiert weiterlaufen sollen.

## Verifikation

- **284 Tests, 0 Fehler**, über 26 Dateien: `bun test src/extraction src/services/extraction src/services/documentConverter.test.ts` im Backend.
- Darunter 20 gezielte Paket-A-Tests: Bildrouting; Hybrid mit genau einem unsicheren Feld; unlesbare Visionantwort; Rendering-/Seitenfehler; Pflichtlisten/-zellen/-segmente; strikte Werte; OCR-Teiltreffer/Ankerwiederverwendung; Repair-Evidenz; Zeilenprovenienz; Regel-Ausfall; Review- und UI/Backend-Freigabevertrag.
- Ein echter, synthetischer Zweitseiten-PDF-Test prüft Seitenzählung und Rendering mit Seitenlimit.
- Template-Test für widersprüchliche wiederholte Labels.
- Frontend: `bun run build` erfolgreich; bestehende Warnungen u. a. zu doppelten Objekt-Schlüsseln und großen Bundles.
- `git diff --check` erfolgreich.
- Globaler TypeScript-Check ist nicht grün: 128 aktuelle Diagnosen im Repository. Keine Diagnose in den geänderten Produktionsdateien. Im Extraktionsbereich bleibt eine Diagnose in der unveränderten `export-xlsx.test.ts`-Fixture wegen optionalem `segments`.
- Das ursprüngliche [Audit-Skript](/Users/andreasbachmann/Documents/Development/AgentWork/agent-platform/tools/document-processing-audit-2026-09-06.ts) wurde auf die behobenen Paket-A-Erwartungen umgestellt. Sein Eval-Gegenbeispiel bleibt bewusst sichtbar, weil F09 zu Paket B gehört.

Kein Live-Lauf am Qwen-/Adacor-Endpunkt, kein Lasttest, kein Browser-Nutzertest und kein Deployment in diesem Arbeitsschritt.

## Noch bewusst offen

**Paket B:** unabhängige produktionsgleiche Evaluation, sichere Challenger-Freigabe, empirische Konfidenzkalibrierung, unveränderliche Profilrevisionen und Originalarchivierung. Die aktuelle Modellfreigabe ist eine konservative Absicherung, kein fertig kalibriertes Qualitätsmodell.

**Paket C:** Segmentgrenzen/-typen im UI korrigieren und daraus lernen; Lernbeispiele mit passenden Bildausschnitten; Entwurfs-/Versionsworkflow. Segmentfelder werden jetzt validiert; der vorhandene Segmenteditor im Review bleibt read-only.

**Quellenidentität:** Es gibt noch keine allgemeine, verlässliche Zuordnung überlappender LLM-Zeilen zu derselben physischen Tabellenzeile. Deshalb bleibt im Zweifel jede Position erhalten und wird geprüft. Automatische Wert-Deduplizierung wurde ausdrücklich nicht durch eine weitere ungesicherte Heuristik ersetzt.

**OCR:** `located` belegt nur das Vorkommen eines vollständigen Werts. Label- und Spaltenzuordnung sind damit nicht unabhängig verifiziert; deshalb kein Confidence-Boost und keine automatische Modellfreigabe.

**Betrieb:** Webhooks und Hintergrundjobs verwenden weiterhin den vorhandenen Zustell-/Retrymechanismus. Dauerhafte Queue, transaktionale Veröffentlichung und Idempotenz gehören zum weiteren Ausbau.
