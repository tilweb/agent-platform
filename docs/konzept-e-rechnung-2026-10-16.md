# Konzept: E-Rechnungen (XRechnung, ZUGFeRD/Factur-X) im Document Processing

Stand: 2026-10-16 · Status: **Konzept, nicht entschieden, nicht umgesetzt**

## 1. Ausgangsfrage

Was passiert, wenn ein Kunde E-Rechnungen durch DP schickt, und wie sollte DP damit umgehen?

Kurzantwort: Heute würde DP eine XRechnung wie einen unbekannten Text behandeln und ein Sprachmodell die
Rechnungsdaten aus dem XML **nachraten** lassen, obwohl sie dort exakt und maschinenlesbar stehen. Bei ZUGFeRD liest
DP das Seitenbild und **übersieht** die eingebettete XML-Rechnung. Beides ist fachlich falsch. E-Rechnungen
brauchen eine eigene Strategie **ohne Sprachmodell** (wie `template-labelmap` bei Grundsteuer). Der eigentliche
Mehrwert liegt danach, beim Abgleich der Rechnung mit Bestellung und Lieferschein.

## 2. Rahmen

### 2.1 Rechtslage (Deutschland, B2B)

- **Seit 01.01.2025** müssen alle inländischen Unternehmen E-Rechnungen **empfangen** können.
- **Ausstellen:** Übergangsfristen bis Ende 2026, ab **01.01.2027** Pflicht für Unternehmen mit mehr als
  800.000 € Vorjahresumsatz, ab **01.01.2028** für alle.
- Eine E-Rechnung im Sinne des § 14 UStG ist ein **strukturiertes Format nach EN 16931**. Ein PDF allein ist ab
  dann eine „sonstige Rechnung".
- Bei **hybriden Formaten** (ZUGFeRD/Factur-X) ist der **XML-Teil führend**. Weichen Bild und XML voneinander
  ab, gilt das XML (BMF-Schreiben vom 15.10.2024; vor Umsetzung fachlich gegenprüfen).
- Die ZUGFeRD-Profile **MINIMUM** und **BASIC WL** sind **keine** gültige E-Rechnung (zu wenig Inhalt). Profile
  ab **BASIC/EN 16931** sind gültig.

### 2.2 Formate

| Format | Gestalt | Syntax |
|---|---|---|
| **XRechnung** | reine XML-Datei, kein Seitenbild | UBL 2.1 (`Invoice`/`CreditNote`) **oder** UN/CEFACT CII (`CrossIndustryInvoice`) |
| **ZUGFeRD 2.x / Factur-X** | PDF/A-3 mit eingebetteter XML (`factur-x.xml`, `zugferd-invoice.xml`, `xrechnung.xml`) | CII |
| PDF-, Papier- oder Bildrechnung | wie bisher | – |

Beide Syntaxen bilden dasselbe **semantische Modell EN 16931** ab, mit Geschäftsbegriffen `BT-1` (Rechnungsnummer),
`BT-2` (Datum), `BG-4` (Verkäufer), `BG-25` (Positionen) usw. XRechnung ist die deutsche Ausprägung (CIUS) mit
Zusatzregeln, z. B. Leitweg-ID (`BT-10`) für Behörden.

### 2.3 Folge für den Markt

Klassische Rechnungs-Extraktion aus PDF und Papier ist im deutschen B2B-Geschäft ein **schrumpfender Markt**. Sie
bleibt noch einige Jahre relevant: Auslandsrechnungen, Kleinunternehmer, Übergangsfristen, Belege und Quittungen.
Ein Rechnungsprodukt muss deshalb **beides** können und darf den Kunden nicht zwingen, je nach Format einen anderen
Weg zu nehmen.

## 3. Heutiges Verhalten (Code-Stand 2026-10-16)

### 3.1 Reine XRechnung (`.xml`)

1. Posteingang (`extraction/inbox/service.ts`, `processInboxUpload`): Die Datei ist weder PDF noch Bild. Klassifiziert
   wird nur bei Bildern, deshalb gibt es **keine Zuordnung**.
2. `autoRoute`: Ohne sichere Zuordnung landet die Datei im **Basisprofil „Allgemein"** (`general-document`), Status
   `kein_profil`.
3. Vorbereitung (`extraction/learning/service.ts`): Für Nicht-PDF- und Nicht-Bild-Dateien ist der Konverter
   (Markitdown) die einzige Quelle. Er liefert im besten Fall den Roh-XML-Text, im schlechtesten einen Fehler.
4. Ein Sprachmodell liest die Felder aus dem XML-Text. Die Prüfansicht hat keine Seiten zum Anzeigen. Abgerechnet
   wird als „Standard" (Kostenfaktor 1,0).

**Probleme:** Erfundene oder falsch zugeordnete Werte sind möglich, obwohl die Daten exakt vorliegen. Die
Token-Kosten fallen für nichts an. Für den Menschen gibt es keine Sichtprüfung, und die Rechnung bekommt fälschlich
den Status „kein Profil".

### 3.2 ZUGFeRD/Factur-X (`.pdf`)

DP verarbeitet die Datei wie jede PDF: Seiten werden gerendert, die Bildauslese läuft über die gewählte Strategie.
Die **eingebettete XML wird ignoriert**. Das Ergebnis ist also im besten Fall eine teure Kopie der XML-Daten, im
schlechtesten eine Abweichung vom rechtlich führenden Teil.

## 4. Zielbild

> **Ein Eingang, ein Ergebnis:** Egal ob die Rechnung als Papier, PDF, ZUGFeRD oder XRechnung kommt, am Ende steht
> dasselbe Schema „Rechnung" mit denselben Exporten, Webhooks und Tabellen. Wo strukturierte Daten vorliegen,
> werden sie **gelesen, nicht geraten**.

### 4.1 Formaterkennung vor der Klassifikation

Die Erkennung ist deterministisch, kostet nichts und läuft im Posteingang **vor** der Bild-Klassifikation:

| Eingang | Erkennung | Weg |
|---|---|---|
| `.xml` | Wurzelelement + Namespace: `urn:oasis:names:specification:ubl:schema:xsd:Invoice-2` / `…CreditNote-2`, `urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100` | Strategie `e-rechnung` |
| `.pdf` | eingebettete Datei mit bekanntem Namen und passendem Wurzelelement (Auflisten per `pdfdetach -list`, poppler, schon Plattform-Abhängigkeit) | Strategie `e-rechnung` mit Seitenbild als Sicht |
| sonst | wie heute | wie heute |

Erkannte E-Rechnungen gehen an ein Rechnungsprofil des Kunden, falls es eines gibt, sonst an ein mitgeliefertes
**Basisprofil „Rechnung"**, nicht an „Allgemein".

### 4.2 Strategie `e-rechnung` (ohne Sprachmodell)

- **Parser für beide Syntaxen** (UBL, CII), Ziel ist ein gemeinsames internes Modell entlang EN 16931 (BT/BG-Nummern
  als stabile Schlüssel).
- **Abbildung auf die Profilfelder** über die BT-Nummer statt über eine Feldbeschreibung. Das Profilfeld bekommt
  z. B. `quelle: { en16931: "BT-1" }`. Felder ohne BT-Zuordnung bleiben leer. Ein Sprachmodell wird nicht still
  nachgeschaltet (siehe 4.4).
- **Konfidenz 1,0** für jedes Feld aus dem XML (die Daten sind die Quelle), analog `template-labelmap`.
- **Positionen** (`BG-25`) als Liste, Steueraufschlüsselung (`BG-23`), Zu- und Abschläge (`BG-20`/`BG-21`),
  Zahlungsinformationen (`BG-16`, IBAN).
- **Anhänge** in der XRechnung (`BG-24`, eingebettete Base64-Dokumente wie Stundennachweis oder Lieferschein)
  werden als eigene Teile ausgewiesen. Bei Bedarf laufen sie durch ihre eigene Pipeline.

### 4.3 Sichtprüfung

Die Prüfoberfläche erwartet Seitenbilder.

- **ZUGFeRD:** Das PDF-Seitenbild ist da. Die Felder kommen aus dem XML, die Fundstelle ist „XML" statt einer
  Bildkoordinate.
- **XRechnung:** Es gibt keine Seite. Nötig ist eine **lesbare Darstellung** (Rechnungsbild aus den Daten). Optionen:
  (a) eigene schlichte HTML-Ansicht aus dem internen Modell (keine Abhängigkeit, unser Layout), (b) die
  KoSIT-Visualisierung (XSLT, Java, offizielle Darstellung). Empfehlung: **(a)**, (b) nur wenn Kunden die amtliche
  Darstellung verlangen.

### 4.4 Validierung

| Stufe | Was | Werkzeug | Empfehlung |
|---|---|---|---|
| V1 Wohlgeformt + Pflichtangaben | XML lesbar, Pflicht-BTs vorhanden (Nummer, Datum, Verkäufer, Käufer, Summen, Steuer) | eigener Code | **ja**, Teil der Strategie |
| V2 Rechenprüfung | Summe der Positionen = Nettosumme, Steuer = Basis × Satz, Zahlbetrag stimmt | eigener Code | **ja**, deterministischer Befund |
| V3 Formale Konformität | XSD + Schematron (EN 16931 + XRechnung-CIUS) | KoSIT-Validator (Java) als eigener Dienst daneben | erst auf Kundenwunsch |
| V4 Hybrid-Abgleich | Bild-Inhalt gegen XML (z. B. Gesamtbetrag im Bild ≠ XML) | Sprachmodell auf Seite 1, wenige Felder | optional, als Befund `hybrid_abweichung` |

Befunde werden markiert, nicht bearbeitet (wie bei Verträgen). Eine Rechnung mit Befund geht in „Zu prüfen".

### 4.5 Sicherheit

Fremde XML-Dateien sind eine Angriffsfläche: Externe Entitäten (XXE) und Entitäten-Expansion („Billion Laughs")
müssen **abgeschaltet** sein, dazu Größenlimit und Tiefenlimit. Bei eingebetteten Anhängen (`BG-24`) Größe und
MIME-Typ prüfen, bevor sie weiterverarbeitet werden.

### 4.6 Abrechnung

Das Produktmodell zählt Seiten, XML hat keine. Vorschlag: **Eine E-Rechnung zählt als eine Seite** im Produkt
**„Formular (digital)"** (Kostenfaktor 0,1). Bei ZUGFeRD zählt das XML, nicht die PDF-Seitenzahl. Der optionale
Hybrid-Abgleich (V4) ist ein Zusatzposten. Ein neues Produkt `e-rechnung` (statt Mitnutzung von `formular`) wäre
transparenter für Kunden und Preislisten. **Entscheidung offen.**

## 5. Der eigentliche Mehrwert: nach dem Lesen

Das Auslesen ist ohne Sprachmodell trivial und wird bald Massenware (jede Buchhaltungssoftware kann es). Wert
entsteht beim **Abgleich mit anderen Dokumenten**, und das passt zu DP als Pipeline für Dokumente unbekannter
Zusammensetzung:

1. **Rechnungsabgleich (Three-Way-Match):** Rechnung ↔ Bestellung ↔ Lieferschein. Mengen, Preise, Positionen,
   Teillieferungen. Lieferscheine kommen weiter als Papier oder PDF, dort hat DP schon seine Stärke. Abweichungen
   werden Befunde.
2. **Vertragsabgleich:** Rechnung ↔ Vertrag (aus `contract-structured`: Entgelte, Preisgleitklauseln, Laufzeit).
   „Wird nach Vertrag richtig abgerechnet?" ist eine Frage, die nur DP mit beiden Auswertungen beantworten kann.
3. **Kontierungsvorschlag:** Sachkonto oder Kostenstelle aus Position, Lieferant und Historie. Hier hilft ein
   Sprachmodell, als Vorschlag, nicht als Buchung.

Das ist eine **eigene Ausbaustufe**. Sie setzt voraus, dass Rechnungen aus allen Kanälen im selben Schema ankommen
(§4).

## 6. Abgrenzung

- **Keine Buchhaltung**, keine Archivierung nach GoBD, keine Zahlungsfreigabe. DP liefert Daten und Befunde.
- **Kein Peppol-Zugangspunkt.** Wie Rechnungen ankommen (E-Mail, Peppol, Portal), regelt der Kunde oder eine
  vorgelagerte Lösung. DP nimmt die Datei entgegen.
- **Kein Ausstellen** von E-Rechnungen.

## 7. Aufwand und Abhängigkeiten

| Baustein | Aufwand (grob) | Abhängigkeit |
|---|---|---|
| Formaterkennung XML/PDF im Posteingang | klein | `pdfdetach` (poppler, vorhanden) |
| XML-Parser UBL + CII → internes Modell | mittel (zwei Syntaxen, Positionen, Gutschriften) | **XML-Bibliothek nötig → neue Dependency, Rückfrage** (Bun hat keinen eingebauten XML-Parser; Kandidat `fast-xml-parser`, sichere Grundeinstellung) |
| Strategie `e-rechnung` + Basisprofil „Rechnung" | mittel | – |
| V1/V2 Prüfungen + Befunde | klein | – |
| Sicht-HTML für XRechnung in der Prüfansicht | mittel | – |
| V3 KoSIT-Validator | mittel + Betrieb | Java-Dienst, eigener Prozess |
| V4 Hybrid-Abgleich | klein | Sprachmodell (vorhanden) |
| Rechnungsabgleich (§5) | groß, eigenes Konzept | Lieferschein-Pipeline |

**Testbestand:** Die offiziellen KoSIT-Testsuites (XRechnung-Testdaten) und die ZUGFeRD-Beispieldateien des FeRD
decken beide Syntaxen und viele Sonderfälle ab. Sie können als eigenes Set in die DP-Qualitätssuite. Damit hätten wir
erstmals einen **unabhängigen** Testbestand mit amtlichen Erwartungswerten.

## 8. Empfehlung

1. **Stufe 1 (klein, sofort sinnvoll):** Formaterkennung + Strategie `e-rechnung` + V1/V2 + einfache Sicht. Damit
   verarbeitet DP E-Rechnungen richtig statt falsch. Voraussetzung ist die Freigabe der XML-Bibliothek.
2. **Stufe 2:** Hybrid-Abgleich (V4) und, falls ein Kunde es verlangt, der KoSIT-Validator (V3).
3. **Stufe 3:** Rechnungsabgleich mit Lieferschein und Vertrag. Das ist das Produktargument, mit eigenem Konzept,
   sobald ein Pilot mit Lieferscheinen läuft.

## 9. Offene Fragen

1. Gibt es einen Pilotkunden mit Eingangsrechnungen? Ohne ihn ist Stufe 1 Vorleistung, sinnvoll vor allem, damit
   DP E-Rechnungen nicht falsch verarbeitet.
2. Neues Produkt `e-rechnung` oder Mitnutzung von „Formular (digital)" (§4.6)?
3. Freigabe einer XML-Bibliothek als neue Dependency.
4. Sicht für XRechnung: eigene HTML-Ansicht oder amtliche KoSIT-Darstellung?
5. Soll eine E-Rechnung mit Befund aus V2 (Rechenfehler) anders behandelt werden als „Zu prüfen", z. B. mit eigenem
   Status für die Rückweisung an den Lieferanten?
