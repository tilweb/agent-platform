# Wohngeld — Erkennung über ein Document-Processing-Segmentprofil (Spec, 2026-09-24)

## Kontext

Die erste Golden-Dataset-Messung (`wohngeld-golden-messung-ergebnis-2026-09-24.md`) zeigt: Scans werden nicht
klassifiziert (4 %), der Split schneidet Formulare auseinander und fasst gleichartige Dokumente zusammen, die Miete
wird mit falscher Bedeutung gelesen. Wohngeld nutzt vom Document Processing (DP) bisher nur die Engine
(`runPipeline`) und die Grenzprüfung der Inbox, dazu eine eigene, rein textbasierte Klassifikation. Die DP-Schicht
mit Profilen, **Segmentierung** (W10), Lern-Loop und Eval bleibt ungenutzt. Die Spec vom 20.09. hat Inbox/Projekte
bewusst ausgeschlossen, weil sie in fremde DP-Projekte routen. Die Segmentierung selbst ist davon nicht betroffen:
Sie nimmt Profil + PDF und liefert typisierte Abschnitte; die Zuordnung zur Wohngeld-Akte bleibt bei Wohngeld.

## Ziel

1. **Segmentprofil „Wohngeld-Eingang"** ersetzt die eigene Klassifikation und die Grenzprüfung im Posteingang.
2. **Golden Dataset als Testbestand** des Profils — Eval im DP und Messwerkzeug messen jede Profiländerung.
3. **Bestätigungen der Sachbearbeitung** werden (opt-in) zu Lernbeispielen des Profils.

## Entscheidungen

### 1. Profil

- **Vorlage im Code** (`extraction/templates/wohngeld-eingang.ts`, wie `grundsteuer-gmbx.ts`), Projekt-ID
  `wohngeld-eingang`. Beim ersten Gebrauch legt Wohngeld das Profil in der DP-Datenbank an, danach ist es in der
  DP-Oberfläche pflegbar (Beschreibungen, Felder, Anweisungen, Strategie, Modell) — ohne Code und Deployment.
  Ist keine Datenbank erreichbar (Messwerkzeug, Tests), läuft dieselbe Vorlage im Speicher.
- **Abschnittstypen** je Dokumentart mit Prosa-Beschreibung für die Seitenklassifikation (Bilderkennung, auch für
  Scans). Wiederholbar sind alle Nachweise, die mehrfach vorkommen (Abrechnungen je Monat, Ausweise je Person,
  Kontoauszüge, Bescheide). Der Antrag ist genau einmal vorhanden; das Zusatzblatt ist ein eigener Typ.
- **Abbildung auf App-Dokumenttypen** im Wohngeld-Code (`dp-erkennung.ts`), z. B. Aufenthaltstitel → Personalausweis,
  Heim-/Untermietvertrag → Mietvertrag, Bescheide über Lohnersatz → Verdienstbescheinigung. Fremde Dokumente
  (Hinweisblatt, Stromrechnung, Sterbeurkunde …) sind `classify-only` und werden `sonstiges`.
- **Felder je Abschnitt** entsprechen den bisherigen Wohngeld-Extraktionsfeldern. **Neu:** Die Miete wird in
  Bestandteilen gelesen (Gesamtmiete, Heizkosten, Warmwasser); die Bruttokaltmiete berechnet Wohngeld im Code —
  für Antrag, Mietvertrag und Vermieterbescheinigung gleich.
- **Leerseiten** gehören zu keinem Dokument; `unbekannt` wird als `sonstiges` ausgewiesen.
- **Umschaltbar:** `WOHNGELD_ERKENNUNG=profil` (Standard) oder `legacy` (bisheriger Weg) — für Vergleich und Rückfall.
  Nicht-PDF-Dateien (Fotos) laufen weiter über den bisherigen Weg.
- **Manuelle Trennkorrektur** bleibt; ein manuell gebildeter Teil wird mit dem Profil ausgewertet, der größte
  erkannte Abschnitt bestimmt Typ und Felder, die Grenzen der Sachbearbeitung gelten.

### 2. Testbestand

- Skript `backend/scripts/wohngeld-golden/testbestand.ts` legt je Golden-Fall die digitale und die Scan-PDF als
  **Testbeispiel** (`purpose: test`, mit Original, Gruppe `digital`/`scan`) im Profil an. Wahrheit
  (`corrected_extraction`) je Abschnittstyp aus Erwartungsdatei und Fallbeschreibung. Danach misst die DP-Eval das
  Profil (Champion/Challenger). Idempotent: vorhandene Testbeispiele werden übersprungen.
- **Messwerkzeug** bekommt die Stufe `profil`: Split, Typ und Felder aus einem Profil-Durchlauf, Vergleich über
  Seitenüberlappung wie bei `--ende-zu-ende`. So bleibt der Vergleich mit dem Messstand vom 24.09. direkt möglich.

### 3. Lernbeispiele aus Bestätigungen

- **Opt-in** über `WOHNGELD_LERNBEISPIELE=true` (Standard aus): Lernbeispiele speichern Dokumenttext im DP-Bestand;
  bei Sozialdaten nur mit Freigabe durch Datenschutz/Kommune (DSFA-Ergänzung).
- Beim Posteingang speichert Wohngeld am Antragsdokument die **Roh-Werte des Profils** und den Abschnittstext.
- Jede Entscheidung „bestätigen"/„verwerfen" wird am Dokument vermerkt. Sind alle KI-Vorschläge des Antrags
  entschieden, entsteht **ein** Lernbeispiel für den Abschnitt `wohngeldantrag`: bestätigte Werte bleiben,
  verworfene werden durch den aktuellen Wert im Vorgang ersetzt (oder leer). Status `candidate` — aktiv wird es erst
  nach bestandenem Testlauf im DP (bestehende Regel der Plattform).
- **Löschen:** Wird Dokument oder Vorgang gelöscht bzw. läuft die Aufbewahrung ab, wird das Lernbeispiel mitgelöscht.

## Nicht im Umfang

- Personen aus dem Antrag anlegen und Dokumente Personen zuordnen (eigener Schritt, Messung Befund 3).
- Korrekturen der Einzelregeln (Messung Befund 6).
- Lernbeispiele für Nachweise (nur der Antrag hat heute Feld-Bestätigungen).
