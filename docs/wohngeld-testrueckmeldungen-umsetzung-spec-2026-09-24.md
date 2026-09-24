# Wohngeld — Umsetzung erster Testrückmeldungen, Punkte 1–5 (Spec, 2026-09-24)

Bezug: Rückmeldungen aus dem ersten Anwendungstest (kritische Bewertung im Gespräch am 2026-09-24),
`docs/wohngeld-posteingang-haushalt-zuordnung-spec-2026-09-24.md`.

Umgesetzt werden die fünf Punkte mit dem höchsten Nutzen. Offen bleiben rechtssichere Brieftexte
(§ 66 SGB I) mit Druck-Button, Benachrichtigungen über die Workplace-Glocke, Mehrfachfilter und
Mail-Vorlage für die BundID.

## 1. „Noch nicht geprüft" statt Grün

**Problem.** Die Ampel an den Sektionen zählt offene Prüfschritte. Ohne Prüflauf gibt es keine,
also zeigt sie Grün („vollständig") — auch bei einem leeren Vorgang. Das täuscht Vollständigkeit vor.

**Lösung.**
- Der Vorgang merkt sich den Zeitpunkt des letzten Prüflaufs (`geprueftAm`, ISO). Gesetzt von jedem
  Prüflauf (manuell, automatisch, Posteingang). Das Setzen erhöht die Vorgangsversion **nicht**, damit parallel
  offene Formulare nicht in einen Versionskonflikt laufen.
- Ohne `geprueftAm` zeigen die Sektionen „nicht geprüft" (neutral, nicht grün), die Prüfschritte-Leiste
  zeigt einen Hinweis mit Button „Jetzt prüfen".
- Mit `geprueftAm` steht „zuletzt geprüft am …" über den Prüfschritten.

## 2. Stammdaten und Haushalt auch beim Upload am Vorgang übernehmen

**Problem.** Nur der Posteingang übernimmt Antragsdaten (Antragsdatum, Adresse, Miete, Haushalt). Der Upload
direkt am Vorgang klassifiziert nur — wer einen Vorgang von Hand anlegt und den Antrag hochlädt, muss alles
abtippen.

**Lösung.** Der Upload am Vorgang nutzt denselben Weg wie der Posteingang: Erkennung über das DP-Segmentprofil
(Sammel-PDFs werden getrennt), danach `verteileDokumente` an den bestehenden Vorgang. Damit gelten dort dieselben
Regeln wie bei einer Nachreichung:
- Personen/Haushalt werden nur angelegt, wenn der Vorgang noch keine Personen hat (manuell angelegte
  Vorgänge haben keine).
- **Bestehender Vorgang: nur leere Felder füllen.** Antragsdatum, Adresse, Miete, Wohnfläche, Wohngeldnummer
  werden nur gesetzt, wenn sie leer sind; von Hand erfasste Werte bleiben. Wohngeldart und Antragsart
  überschreibt ein gelesener Antrag (das Anlegeformular setzt sie nur als Vorbelegung).
  Nur tatsächlich übernommene Felder werden als KI-Vorschlag markiert.
- Nachweise werden Personen zugeordnet, danach wird geprüft.
Neue Vorgänge aus dem Posteingang verhalten sich unverändert (alles wird übernommen).

## 3. Automatisch neu prüfen

**Problem.** Die Prüfung läuft nur nach Posteingang, Upload, Löschen eines Dokuments und per Button.
Änderungen an Personen, Vorgangsfeldern oder Zuordnungen lassen veraltete Prüfschritte stehen.

**Lösung.** Das Backend prüft nach jeder fachlich relevanten Änderung selbst neu (deterministisch, schnell,
idempotent — manuelle und erledigte Schritte bleiben): Person anlegen/ändern/löschen, Dokument
anlegen/ändern/löschen, Vorgang ändern, Feld-Status bestätigen/verwerfen, BWZ-Vorschlag übernehmen.
Nicht bei eingeschränkter Verarbeitung (Art. 18). Die Oberfläche lädt danach die Prüfschritte nach.
Ein automatischer Lauf wird nicht einzeln protokolliert — protokolliert ist die auslösende Änderung.

## 4. Sachbearbeitung zuweisen, Aufgaben je Person

**Problem.** Das Feld „Sachbearbeiter" wird angezeigt, lässt sich aber nicht setzen; die Aufgabenliste zeigt
alles von allen.

**Lösung.**
- Auswahlliste der Nutzer, die über ihre Gruppen Bearbeitungsrechte an der App haben (Rolle editor/owner),
  per `GET /sachbearbeitung`. Gespeichert werden `sachbearbeiterId` (Nutzer-ID) und `sachbearbeiter`
  (Anzeigename, wie bisher).
- „Übernehmen" setzt die eigene Person; auswählbar sind auch Kolleginnen und Kollegen; „nicht zugewiesen"
  hebt die Zuweisung auf. Die Änderung wird wie jede Vorgangsänderung protokolliert.
- Manuell angelegte Vorgänge sind der anlegenden Person zugewiesen; Vorgänge aus dem Posteingang bleiben
  unzugewiesen, bis jemand sie übernimmt.
- Übersicht und Aufgaben: Filter „Meine", „Nicht zugewiesen", „Alle" sowie je Sachbearbeiter/in.
  Aufgaben starten mit „Meine".

## 5. Vorgangsnummer und Wohngeldnummer trennen

**Problem.** Die „Antrags-ID" ist eine intern erzeugte Nummer (aus der Uhrzeit). Die Wohngeldnummer bzw. das
Aktenzeichen vergibt die Behörde; beim Weiterleistungsantrag steht sie im Antrag und wird gelesen, aber nicht
gespeichert. Der Nachreichungs-Abgleich vergleicht eine im Dokument genannte Nummer mit der internen ID —
das kann nie passen.

**Lösung.**
- Bezeichnung in der Oberfläche und in Exporten: „Vorgangsnummer (intern)" statt „Antrags-ID".
- Neues Feld `wohngeldnummer` am Vorgang (Wohngeldnummer/Aktenzeichen der Behörde), bearbeitbar im Block
  „Antrag", in Übersicht und Suche sichtbar. Aus dem Antrag übernommen (KI-Vorschlag), wenn leer.
- Nachreichungs-Abgleich vergleicht die im Dokument genannte Nummer mit der Wohngeldnummer des Vorgangs
  (Rückfall: interne Nummer).
- Schreiben/Verfügung führen die Wohngeldnummer als Aktenzeichen, wenn vorhanden.

## Technik

| Punkt | Dateien |
|---|---|
| 1, 3 | `apps/wohngeld/pruefung.ts` (neu: `pruefeUndSynchronisiere`, `pruefeAutomatisch`), `storage.ts` (`setzeGeprueftAm` ohne Versionssprung), Routen personen/dokumente/vorgaenge/feldstatus/posteingang, `VorgangDetail.jsx`, `SektionCard.jsx` |
| 2 | `routes/posteingang-queue.ts` (Upload am Vorgang über Profil-Erkennung + `verteileDokumente`), `routes/posteingang.ts` (`nurLeereFelder`) |
| 4 | `routes/sachbearbeitung.ts` (neu), `types.ts` (`sachbearbeiterId`), `WohngeldPage.jsx`, `VorgangDetail.jsx` |
| 5 | `types.ts`, `extraction.ts`, `dp-erkennung.ts`, `feldstatus-mapping.ts`, `routes/posteingang.ts` (Abgleich), Exporte, Frontend-Labels |

Keine Migration: `geprueftAm`, `sachbearbeiterId`, `wohngeldnummer` liegen im `data`-jsonb des Vorgangs.

## Abnahme

- Unit-Tests: Übernahme nur leerer Felder, Sachbearbeiter-Liste aus Gruppenrechten, Abgleich über
  Wohngeldnummer, Prüfzeitpunkt ohne Versionssprung (soweit DB-frei testbar).
- Bestehende Tests grün, Frontend-Lint sauber.
