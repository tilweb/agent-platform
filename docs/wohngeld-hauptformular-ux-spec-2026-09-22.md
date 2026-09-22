# Spec: Hauptformular (Vorgang-Übersicht) — Konsistenz-UX + forml-Feldset

**Stand:** 2026-09-22 · **Status:** ENTWURF → Umsetzung · **App:** `wohngeld`
**Anlass:** Nutzer-Feedback — inkonsistente Editierbarkeit, KI-Punkt-Verhalten, fehlende Felder,
Geburtsdatum-Format; Angleichung an forml-Screenshots (`docs/wohngeld/`).

## Leitentscheidungen
1. **Editieren pro Block** (nicht global, nicht pro Feld). Jeder Übersicht-Block hat im Kopf einen
   eigenen **„Bearbeiten"** → im Bearbeiten-Modus werden die Felder des Blocks zu Eingaben/Dropdowns
   + der Kopf zeigt **„Verwerfen"/„Speichern"** (statt „Bearbeiten"). Kein globaler Bearbeiten-Button.
   Konsequenz: **nichts** ist direkt editierbar ohne den Bearbeiten-Modus des jeweiligen Blocks —
   einheitlich (behebt „manche direkt, manche erst nach Klick").
2. **KI-Bestätigung ≠ Bearbeiten.** Die Freigabe (✓/✗) eines KI-Vorschlags bleibt **immer** am Wert
   verfügbar (auch außerhalb des Bearbeiten-Modus) — es ist Bestätigen, nicht Ändern.

## KI-Vorschlag-Indikator (blauer Punkt)
- **Punkt an den Zeilenanfang** (vor das Label), nicht mehr am Wert.
- Punkt **pulsiert** (dezente CSS-Animation).
- **Zusätzlicher Punkt rechts neben der Block-Headline**, wenn der Block ≥1 unbestätigten
  KI-Vorschlag enthält → bei **eingeklapptem** Block sichtbar, wo noch etwas zu bestätigen ist.
- Die Freigabe-Buttons (✓ bestätigen / ✗ verwerfen) bleiben am Wert.

## Editierbarkeit (Blöcke)
Alle folgenden Blöcke bekommen konsistent den Bearbeiten-Modus:
- **Allgemein** (Antragsdatum, Wohngeldart, Antragsart …) — bereits editierbar, auf Block-Muster umstellen.
- **Wohnung & Miete** — dito.
- **Bewilligungszeitraum & Zahlung** — dito.
- **Personen → je Person:**
  - **Persönliches:** Nachname, Vorname, Geburtsname, Titel, **Geburtsdatum** (Datum, Anzeige
    `TT.MM.JJJJ`, Eingabe Datepicker, Platzhalter `tt.mm.jjjj`), Geburtsort, **Geschlecht** (Dropdown),
    **Familienstand** (Dropdown), Telefon, E-Mail, **Erwerbsstatus** (Dropdown), Bemerkung.
  - **Sonstiges:** Checkboxen Erhält Kindergeld / Werbungskosten / Aufforderung Wohngeld / EU-EWR;
    **Staatsangehörigkeit**.
  - **Pflege & Behinderung:** **Schwerbehinderungsgrad** (Dropdown – /20…100), **Pflegegrad**
    (Dropdown – /1…5), Pflegebedürftig (Checkbox).
  - **Einkommen:** Positionen editierbar — Liste add/edit/remove: **Art** (Dropdown), Bezeichnung,
    Betrag **monatlich/jährlich**. (behebt „Einkommen gar nicht bearbeitbar")

## forml-Listenblöcke je Person (Welle 2) — „+"-Listen, Items einklappbar
Jeder Eintrag als aufklappbarer Unter-Block, „+" zum Hinzufügen, Zeilen mit dünner Trennlinie:
- **Vermögen:** `{ art, betrag }`.
- **Kinderbetreuungskosten:** `{ frequenz, bemerkung, betrag }`.
- **Unterhaltsverpflichtungen:** `{ verwandtschaft, empfaengerVorname, empfaengerNachname, frequenz, betrag }`.
- **Unterhaltsansprüche:** `{ vonVorname, vonNachname, frequenz, betrag }`.
- **Ausschlüsse (§7):** `{ grund, von, bis, freitext }`.

### Vorgaben (Dropdown-Enums)
- **Frequenz:** täglich, wöchentlich, 14-täglich, monatlich, vierteljährlich, jährlich, einmalig,
  schwankend, sonstige.
- **Ausschluss-Grund (§7):** Leistung nach SGB II (Bürgergeld); Grundsicherung im Alter/bei
  Erwerbsminderung; Hilfe zum Lebensunterhalt (SGB XII); Ergänzende Hilfe zum Lebensunterhalt
  (nach BVG); Hilfe in einer stationären Einrichtung zum Lebensunterhalt; Leistungen der Kinder- und
  Jugendhilfe (SGB VIII); Grundleistungen nach dem AsylbLG; Ausbildungsförderung (BAföG/BAB, § 20
  Abs. 2 WoGG); Sonstiger Grund.
- **Verwandtschaft (Unterhaltsverpflichtung):** Kind; getrennt lebender/früherer Ehegatte/
  Lebenspartner; Elternteil; Person in auswärtiger Ausbildung; sonstige.
- **Familienstand:** ledig; verheiratet; eingetragene Lebenspartnerschaft; getrennt lebend;
  geschieden; verwitwet.
- **Geschlecht:** männlich; weiblich; divers.
- **Schwerbehinderungsgrad:** – / 20 / 30 / 40 / 50 / 60 / 70 / 80 / 90 / 100.
- **Pflegegrad:** – / 1 / 2 / 3 / 4 / 5.

## Fachlogik-Anbindung (Welle 2, Backend)
- **§7-Ausschluss:** neue `ausschluesse[]` lösen den Ausschluss-Hinweis aus (ersetzt/ergänzt das
  bisherige `transferleistungenDetail.kduEnthalten`). Checker `plausibilitaet.ts` anpassen (rückwärtskompatibel).
- **§18-Unterhalt:** `unterhaltsverpflichtungen[]` → Jahresbetrag aus `frequenz`×`betrag`;
  Kappung je `verwandtschaft` gemäß §18-Höchstbeträgen (`einkommen.ts` anpassen + Tests).
- **§13-Einkommen:** Kinderbetreuungskosten sind kein Einkommen — nur Erfassung/Anzeige (kein
  Abzug im §13 im Scope; ggf. Hinweis). Vermögen weiter für §21-Freigrenze.
- Datenhaltung: alles in `person.data` (kein Migration).

## Datpenmodell (Person, types.ts — in `data`)
Neue/erweiterte optionale Arrays: `kinderbetreuungskosten[]`, `ausschluesse[]`, erweiterte
`unterhaltsverpflichtungen[]`/`unterhaltsansprueche[]`; `vermoegenPositionen[]` bleibt. Bestehende
Felder rückwärtskompatibel (Legacy weiter lesbar).

## Umsetzung in 2 Wellen
- **U1 (Konsistenz-Kern):** Bearbeiten-Modus pro Block; alle bestehenden Person-Felder + Einkommen
  editierbar (Dropdowns Geschlecht/Familienstand/Erwerbsstatus/Schwerbehinderung/Pflegegrad);
  Geburtsdatum-Format; KI-Punkt (Zeilenanfang + Pulsieren + Headline-Punkt); Zeilentrennlinien
  konsistent. Freigabe bleibt am Wert.
- **U2 (forml-Feldset):** die „+"-Listenblöcke (Vermögen/Kinderbetreuung/Unterhalt×2/Ausschlüsse)
  mit Vorgaben-Dropdowns + Fachlogik-Anbindung (§7/§18) + Tests.

## Nicht-Ziele
- Keine eigene „Einkommensberechnung"-Vollansicht in diesem Schritt (die §13-Herleitung bleibt wie
  gebaut). Keine Migration (alles in `data`).
