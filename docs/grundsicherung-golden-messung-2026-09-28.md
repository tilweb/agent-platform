# Grundsicherung — Golden-Messung der Posteingang-Erkennung (2026-09-28)

Erste Messung der Grundsicherungs-Erkennung (DP-Segmentprofil `grundsicherung-eingang`, Adapter
`apps/grundsicherung/dp-erkennung.ts`) gegen das echte Modell. Vorher gab es kein Testmaterial.

Werkzeug: `backend/scripts/grundsicherung-golden/` — `erzeuge.ts` (Generator), `messung.ts` (Messung),
`dokumente.ts`/`faelle.ts` (Vorlagen und Fälle), `vergleich.ts` (+ Test). Ausgaben unter
`tools/output/grundsicherung-golden/` (lokal, nicht eingecheckt).

## Kontext

- Die App erkennt Sammel-PDFs über das DP-Segmentprofil: Seiten werden per Bild klassifiziert,
  zu Abschnitten gruppiert und je Abschnitt ausgelesen. `dp-erkennung.ts` bildet das auf
  Dokumenttyp, DokumentAnalyse-Vertrag und Antrags-Stammdaten ab.
- Gemessen wird die ganze Kette bis zur Prüfung: Erkennung → Posteingang-Nachbau (dieselben reinen
  App-Funktionen wie `verteileDokumente`: `stammdatenUebernahme`, `personenAusAntrag`,
  `ordneNachweisZu`) → Regel-Engine (`pruefeVorgang`). Keine Datenbank für Vorgänge nötig.

## Aufbau des Testmaterials

Die drei Goldfälle der Spec (`docs/grundsicherung-app-spec-2026-09-27.md`), realistisch
ausgestaltet. Die PDFs sind born-digital und werden mit pdfmake erzeugt (vorhandene
Backend-Dependency, keine neue Dependency). Jedes Dokument wird einzeln gerendert, mit eigener
Kopf-/Fußzeile und Seitenzählung, und mit `pdfunite` (poppler) zur Sammel-PDF zusammengesetzt.
Jede Seite trägt „MUSTER · synthetische Testunterlage“. PDF-Metadaten: „SYNTHETISCH“. Personen,
Anschriften, Banken, Kassen und Vermieter sind erfunden (Institute mit „Muster“ im Namen).

| Fall | Seiten | Dokumente |
|---|---|---|
| GS01 Erika Schmidt: alleinstehende Rentnerin, Pauschalmiete | 20 | Antrag (8 Blatt, 18 nummerierte Abschnitte, gezeichnete Unterschrift) · Personalausweis · Rentenbescheid 03/2025 (Neuberechnung, 3 S.) · KVdR-Mitgliedsbescheinigung · Mietvertrag mit Pauschalmiete inkl. Heizung (3 S.) · Kontoauszüge 03/04/05-2026 (April 2 Blatt mit Übertrag), jeweils mit 112 € VBL-Betriebsrente |
| GS02 Klaus Berger: 58 J., EM-Rente befristet bis 31.12.2027 | 20 | Antrag (Partner-Abschnitt leer, verheiratet, befristet, kein Vermögen) · Personalausweis · EM-Rentenbescheid (Zeitrente, 3 S.) · Mitgliedsbescheinigung · Mietvertrag Klaus + Sabine Berger (3 S.) · Betriebskostenabrechnung 2025 (2 S.) · Kontoauszüge 07/08-2026 (mit „Haushaltsgeld“ von Sabine Berger) |
| GS03 Horst Lehmann: Rentner mit Wohngeld und Sparbuch | 28 | Antrag (Wohngeld nicht als Einkommen, Sparbuch 14.200 €) · Personalausweis · Rentenbescheid 2023 · Rentenanpassungsmitteilung 01.07.2026 (2 S.) · Mitgliedsbescheinigung · Mietvertrag 2004 mit alter Miete (3 S.) · Mietbescheinigung (aktuelle Miete, 2 S.) · Betriebskostenabrechnung 2025 (2 S.) · Wohngeldbescheid (2 S.) · Sparbuch mit Saldenbestätigung · Kontoauszüge 05/06/07-2026 (Rente vor und nach der Anpassung, Wohngeld) |

`expected.json` je Fall enthält:
- die Abschnitte mit Typ und Seitenbereich,
- **Kernfelder**, von Hand erwartet und unabhängig vom Mapping. Sie sind als Pfade in das
  App-Ergebnis angegeben, z. B. `stammdaten.personen[rolle=antragsteller].einkommen[art=altersrente].betrag_monat`.
  `null` bedeutet, dass das Feld nicht gesetzt sein darf (z. B. keine Partner:in, keine Kaltmiete bei Pauschalmiete).
  Insgesamt 197 Felder.
- die vollständigen Soll-Werte (ideale Profil-Rohwerte → `mappeAbschnitt`). Der Generator prüft,
  dass die Kernfelder mit dem Soll-Mapping übereinstimmen.
- die Befunde laut Spec und die Befunde, die aus den Soll-Werten entstehen („Soll-Befunde“).

Alle 12 Spec-Befunde entstehen aus den Soll-Werten. Weitere, fachlich berechtigte Soll-Befunde:
- GS01: `mietbescheinigung-aktuell`, `plausi-rentenanpassung-fehlt`
- GS02: `kontoauszuege` (nur 2 Monate), `mietbescheinigung-aktuell`, `plausi-kontostand-abweichung`
  (kein Vermögen angegeben, Guthaben 312 €) und `plausi-kontoauszug-unerklaerte-eingaenge` (Haushaltsgeld)

Aufruf (im `backend/`):
```sh
bun run scripts/grundsicherung-golden/erzeuge.ts
bun run scripts/grundsicherung-golden/messung.ts            # nutzt Cache
bun run scripts/grundsicherung-golden/messung.ts --ohne-cache [GS02] [--vorlage]
```
Das Profil wird wie in der App über `ladeProfil` geladen. Beim ersten Lauf hat das die lokale
DP-Datenbank angelegt, beim zweiten Lauf auf den neuen Vorlagenstand angehoben.
Die Modellantworten werden je PDF-Hash, Profil-Fingerabdruck und Modell gecacht. Das App-Mapping
wird bei jedem Lauf aus den gecachten Rohwerten neu berechnet. Mapping-Änderungen lassen sich
also ohne Modellkosten messen.

## Messergebnisse

Modell `adacor/qwen3-5-a3b-35b-256k`, 0 Lernbeispiele.

### Runde 1 — Vorlage 2026-09-27a (Lauf `2026-09-28T07-17-19`)

| Fall | Abschnitte korrekt | Typ | Schnitte | Fehlschnitte | Felder | Person zugeordnet | Spec-Befunde | ggü. Soll verfehlt / zusätzlich | Tokens (Aufrufe) | Dauer |
|---|---|---|---|---|---|---|---|---|---|---|
| GS01 | 6/8 | 7/8 | 6/7 | 0 | 49/65 | 5/6 | 3/4 | 1 / 2 | 225.235 (40) | 88 s |
| GS02 | 8/8 | 8/8 | 7/7 | 0 | 53/54 | 5/5 | 4/4 | 1 / 0 | 223.666 (40) | 85 s |
| GS03 | 13/13 | 13/13 | 12/12 | 0 | 78/78 | 8/8 | 4/4 | 0 / 0 | 301.328 (56) | 117 s |
| **Summe** | 27/29 | 28/29 | 25/26 | 0 | 180/197 (91 %) | 18/19 | **11/12** | 2 / 2 | 750.229 (136) | 290 s |

### Runde 2 — Mapping-Korrektur + Vorlage 2026-09-28a (Lauf `2026-09-28T07-23-17`, live)

| Fall | Abschnitte korrekt | Typ | Schnitte | Fehlschnitte | Felder | Person zugeordnet | Spec-Befunde | ggü. Soll verfehlt / zusätzlich | Tokens (Aufrufe) | Dauer |
|---|---|---|---|---|---|---|---|---|---|---|
| GS01 | 8/8 | 8/8 | 7/7 | 0 | 65/65 | 6/6 | 4/4 | 0 / 0 | 228.042 (40) | 90 s |
| GS02 | 8/8 | 8/8 | 7/7 | 0 | 53/54 | 5/5 | 4/4 | 0 / 1 | 226.181 (40) | 82 s |
| GS03 | 13/13 | 13/13 | 12/12 | 0 | 78/78 | 8/8 | 4/4 | 0 / 0 | 304.819 (56) | 108 s |
| **Summe** | 29/29 | 29/29 | 26/26 | 0 | 196/197 (99,5 %) | 19/19 | **12/12** | 0 / 1 | 759.042 (136) | 280 s |

Zwischenstand (nur Mapping-Korrektur, Rohwerte aus Runde 1 aus dem Cache): Die Felder stiegen
auf 186/197, die Spec-Befunde auf 12/12. Der Split-Fehler in GS01 blieb bis zur Vorlagenänderung.

Kosten: etwa 7 Aufrufe und 11.000 Tokens je Seite. Ein Fall mit 20–28 Seiten braucht 225.000–305.000 Tokens
und 1,5–2 Minuten. Die ganze Messung (Runde 1 + Probelauf GS01 + Runde 2) lag bei rund 1,7 Mio. Tokens.

## Gefundene Fehlerklassen

1. **Wiederkehrende Eingänge in Monatsauszügen nicht erkannt** (Wirkung: Spec-Befund
   `plausi-kontoauszug-unerklaerte-eingaenge` fehlte in GS01, der Soll-Befund fehlte in GS02).
   Jeder Monatsauszug zeigt die Betriebsrente nur einmal. Das Modell setzt dann durchgehend
   `wiederkehrend: false`, auch bei „BETRIEBSRENTE 03/2026“. Die Regel wertet nur wiederkehrende
   Eingänge aus. Das ist ein Strukturproblem: Die Wiederkehr zeigt sich erst über mehrere Auszüge.
2. **Split: zweiseitiger Kontoauszug mit dem Vormonat verschmolzen** (GS01, Seiten 17–19 statt 17 + 18–19).
   Die erste Seite des April-Auszugs endet mit „Übertrag auf Blatt 2“ und wurde als Fortsetzung
   gewertet. Folge: Ein Auszug fehlte, die Kontoauszugs-Zeitraumregel meldete einen Fehlalarm
   (`kontoauszuege`), die Personenzuordnung war 5/6.
3. **Doppelte Zeilen bei mehrseitigen Dokumenten.** Mieter:innen kamen doppelt (Vertragskopf und
   Unterschriftenblock, alle drei Mietverträge). Im verschmolzenen Kontoauszug kamen Eingänge doppelt.
4. **Unterschrift im Mietvertrag instabil** (Runde 1: GS01 falsch; Runde 2: GS02 falsch). Folge
   ist ein Fehlalarm `mietvertrag` („nicht unterschrieben“). Der Antrag wurde immer richtig erkannt.
5. **Art eines Eingangs schwankt** („Haushaltsgeld“ einmal `sozialleistung`, einmal `sonstige`).
   Für die Regel ist das hier folgenlos, weil beides nicht durch Einkommensangaben erklärt ist.

Fehlerfrei in beiden Runden: Antrag (alle Stammdaten inklusive Pauschalmiete ohne Kaltmiete,
fehlender Partner, EM-Befristung, „kein Vermögen“, Vermögenspositionen), Rentenbescheide,
Anpassungsmitteilung, Wohngeldbescheid, Sparbuch, Mietbescheinigung, Betriebskostenabrechnung,
Klassifikation aller 21 Nicht-Kontoauszug-Dokumente.

## Änderungen

**`apps/grundsicherung/dp-erkennung.ts`** (+ 5 Tests in `dp-erkennung.test.ts`):
- `fasseEingaengeZusammen`: In einem Auszug werden Zeilen desselben Absenders zu einer Zeile
  zusammengefasst (Anzahl addiert). Zwei oder mehr Buchungen gelten als wiederkehrend.
  Der Absender-Schlüssel sind die ersten zwei Wörter des Verwendungszwecks ohne Ziffern.
- `markiereWiederkehrendeEingaenge`: Kommt ein Absender in mindestens zwei Kontoauszügen
  derselben Sendung vor (gleiche IBAN oder ohne IBAN), wird er als wiederkehrend markiert.
  Das greift in `abschnitteAusErgebnis`, also für Posteingang und Upload gleich.
- Mietvertrag: Mieter:innen werden je Person nur einmal übernommen (Groß-/Kleinschreibung egal).

**`extraction/templates/grundsicherung-eingang.ts`** (Vorlagenstand `2026-09-28a`; nie bearbeitete
Profile werden automatisch angehoben):
- Kontoauszug-Neustart: Eine andere Auszugsnummer oder ein anderer Monat bedeutet immer einen
  neuen Auszug. Nur „Übertrag von Blatt …“ oben auf der Seite bzw. „Blatt 2 von 2“ ist eine
  Fortsetzung, „Übertrag auf Blatt 2“ am Seitenende nicht.
- Eingänge: je Absender genau eine Zeile. `wiederkehrend` gilt für erkennbar laufende Zahlungen
  auch bei einmaligem Vorkommen im Monat. Die Arten sind erläutert (u. a. `zuwendung` für Haushaltsgeld).
- Mietvertrag: Mieter nur aus dem Vertragskopf lesen. Die Unterschrift wird ausdrücklich im
  Unterschriftenblock über den Linien gesucht.

Der Generator wurde nicht an Modellschwächen angepasst. Dokumente und Erwartungen sind seit Runde 1 unverändert.

## Offene Punkte

- **Unterschrift im Mietvertrag** bleibt unzuverlässig (1 Fehlalarm `mietvertrag` in Runde 2, trotz
  präziserer Feldbeschreibung). Das ist dieselbe Klasse wie beim Wohngeld (Messung 2026-09-24).
  Vorschlag: Unterschriften gezielt per Vision auf der letzten Seite des Abschnitts prüfen oder
  die Regel bei `unterschrift_vorhanden: false` als Hinweis statt als Anforderung formulieren.
- **Nur 3 Fälle, nur born-digital, keine Störungen.** Keine Scans, keine fehlenden oder doppelten Seiten, keine
  Einrichtungs-, Eigentums- oder Paarfälle mit Partner:in im Antrag. Die sehr guten Werte in Runde 2
  sind also eine Obergrenze. Nächste Schritte: Scan-Variante (Rastern ohne Textebene) und weitere
  Fälle (Partner:in im Antrag, Schwerbehindertenausweis G, Betreuung, Weiterleitung).
- Die Stabilität ist nur mit je einem Live-Lauf je Runde belegt. Stichproben-Streuung (z. B. Unterschrift)
  sieht man erst über mehrere Läufe. Dazu `--ohne-cache` wiederholen.
- Der Absender-Schlüssel (erste zwei Wörter) ist eine Heuristik. Absender mit gleichem Anfang
  (z. B. zwei „Deutsche Rentenversicherung …“-Renten verschiedener Träger auf einem Konto) werden
  zusammengefasst. Für die Wiederkehr ist das unschädlich, für die Anzahl nicht exakt.
- `ladeProfil` legt das Profil in der lokalen DP-Datenbank an bzw. hebt es an. Das entspricht
  dem App-Verhalten. `--vorlage` misst ohne Datenbank.
