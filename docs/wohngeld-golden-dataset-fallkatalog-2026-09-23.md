# Wohngeld — Golden Dataset: Fallkatalog (Entwurf zur Freigabe, 2026-09-23)

## 1. Ziel

30 synthetische Wohngeld-Anträge (Mietzuschuss) als **je eine Sammel-PDF**, wie sie in einer
Wohngeldstelle eingehen: Antrag + Anlagen + Nachweise hintereinander. Zu jedem Fall gibt es eine
**Erwartungsdatei** („richtige Antwort"), gegen die die Wohngeld-App gemessen wird:

| Messgröße | Frage | Erwartung aus |
|---|---|---|
| Split | Werden die Dokumentgrenzen richtig erkannt? | Seitenbereiche je Dokument |
| Klassifikation | Wird jedes Dokument dem richtigen Typ zugeordnet? | `DokumentTyp` je Dokument |
| Extraktion | Stimmen die ausgelesenen Werte? | Feldwerte (Antrag + Nachweise) |
| Prüfung | Findet die App die richtigen Lücken/Widersprüche — und keine falschen? | erwartete `regelId`s je Fall |

Alle Dokumente entstehen aus **einer Fallbeschreibung (JSON) je Fall**. Dadurch stimmen Zahlen über alle
Unterlagen eines Falls überein — und Widersprüche sind nur dort, wo sie gewollt und dokumentiert sind.

## 2. Konventionen

- **Vorlagen:** Offizieller Wohngeldantrag Mietzuschuss (11 S., 433 Formularfelder), Vermieterbescheinigung
  (2 S., 31 Felder), Anlage Unterhaltsverpflichtungen (2 S., 27 Felder), Hinweisblatt (1 S.) aus
  `docs/wohngeld/synth-antraege/`. Ausgefüllt wird programmatisch über die Formularfelder (pdf-lib), danach
  „flach" gemacht (keine editierbaren Felder mehr, wie ein Ausdruck).
- **Fiktive Daten:** erfundene Namen, Straßen und Arbeitgeber; reale Orte/PLZ (für Plausibilität der
  Mietstufe). IBANs mit gültiger Prüfziffer, aber fiktiven Bankleitzahlen. Kein Wasserzeichen im Bild
  (würde die Extraktion verfälschen) — Kennzeichnung „synthetisch" nur in den PDF-Metadaten.
- **Stichtag:** Antragsdatum August/September 2026. Beträge realistisch zum Stand 2026 (Mindestlohn
  13,90 €/h, Kindergeld 259 €/Kind, Freigrenze Vermögen 60.000 € + 30.000 € je weiterem Mitglied).
- **Zwei Varianten je Fall:**
  - **digital** — ausgefüllte, geflachte PDFs mit Textebene (Basis-Schwierigkeit);
  - **scan** — jede Seite gerastert (200 dpi, Graustufen, 0,3–1,5° Schieflage, leichtes Rauschen,
    keine Textebene). Testet den OCR-/Vision-Pfad wie bei echter Briefpost.
- **Handschrift:** 8 Fälle (in der Matrix markiert ✍) mit handschriftähnlicher Schrift in den Formularfeldern
  und einer gezeichneten Unterschrift. Bleibt eine Annäherung an echte Handschrift.
- **Unterschriften:** als gezeichnete Linie (SVG-Pfad) — fehlende Unterschrift ist ein gezielter Fehler.

## 3. Dokument-Bibliothek

Die Nachweise entstehen aus **7 Layout-Familien**, parametrisiert je Dokumentart. Jede Art ist einem
App-Dokumenttyp zugeordnet (Klassifikations-Erwartung).

| Layout-Familie | Dokumentarten | App-Typ |
|---|---|---|
| Amtliches Formular (Vorlage) | Wohngeldantrag · Vermieterbescheinigung · Anlage Unterhalt · Hinweisblatt | `wohngeldantrag` · `mietbescheinigung` · `unterhaltsnachweis` · `sonstiges` |
| Behördenbescheid (Briefkopf, Bescheidtext, Betragstabelle) | Rentenbescheid · ALG-I-Bescheid · Kindergeld · Unterhaltsvorschuss · Elterngeld · BAföG · Bürgergeld/Jobcenter · Pflegekasse (Pflegegrad) · Krankengeld | `rentenbescheid` · `verdienstbescheinigung`¹ · `kindergeldnachweis` · `unterhaltsnachweis` · `transferleistungsbescheid` · `pflegenachweis` |
| Entgeltabrechnung | Gehaltsabrechnung · Minijob-Abrechnung · Ausbildungsvergütung · Kurzarbeit | `gehaltsabrechnung` |
| Arbeitgeberbescheinigung / Brief | Verdienstbescheinigung · Mieterhöhung · Kita-Gebührenbescheid · Jobcenter-Aufforderung · Vollmacht · Betreuungsvereinbarung | `verdienstbescheinigung` · `mietvertrag`² · `sonstiges` |
| Kontoauszug (Bankformat, 1–2 S., teils quer) | Girokonto · Depot-/Sparkontoauszug | `kontoauszug` · `vermoegensnachweis` |
| Vertrag (mehrseitig, § -Gliederung, Unterschriftenblock) | Mietvertrag · Untermietvertrag · Heimvertrag | `mietvertrag` |
| Ausweiskarte (Vorder-/Rückseite auf einer Seite) | Personalausweis · Aufenthaltstitel · Schwerbehindertenausweis · Krankenversichertenkarte | `personalausweis` · `schwerbehindertenausweis` · `kv_pv_nachweis` |
| Sonstige | Steuerbescheid + EÜR (Selbständige) · Sterbeurkunde · Abfindungsvereinbarung · Betreuerausweis · fremdes Schreiben (Stromrechnung) | `verdienstbescheinigung` · `sonstiges` |

¹ Lohnersatzleistungen als Einkommensnachweis. ² Mieterhöhungsschreiben als Mietnachweis; ggf. eigener Typ nötig — siehe §7.

## 4. Fallmatrix

Kürzel: **A** Antrag (11 S.) · **VB** Vermieterbescheinigung · **UH** Anlage Unterhalt · **HB** Hinweisblatt ·
**MV** Mietvertrag · **KA** Kontoauszug · **GA** Gehaltsabrechnung (×n Monate) · **PA** Personalausweis.
Erwartete Befunde = `regelId` der App-Prüfung; *(keine App-Regel)* = fachlich zu erwartender Befund, für den
die App heute keine Regel hat (Lücke, die der Datensatz sichtbar machen soll).

### Gruppe A — vollständig und sauber (Referenzfälle, 7)

Erwartung: **keine Nachforderung**. Diese Fälle messen vor allem Split, Klassifikation und Extraktion ohne
Störungen — und dass die App keine falschen Befunde erzeugt.

| ID | Konstellation | Unterlagen im PDF | Formular-Pfade, die abgedeckt werden |
|---|---|---|---|
| F01 | Alleinstehende Rentnerin, 74, Altersrente, Sozialwohnung (WBS) | A, PA, Rentenbescheid, MV, VB, KA | Frage 3 gefördert = Ja; Rentner; Zahlung an mich |
| F02 | Ehepaar + 2 Kinder (3 und 7 J.). Er Vollzeit, sie Minijob, Kita-Kosten | A, PA ×2, GA ×3 (er), Minijob-Abrechnung ×3, Kindergeld, Kita-Gebührenbescheid, MV, VB, KA (teilweise geschwärzt) | 4 Haushaltsmitglieder; Frage 14 Kinderbetreuung; Frage 24 Heizkosten mit Betrag |
| F03 ✍ | Alleinerziehende Mutter, Teilzeit, 1 Kind, Unterhaltsvorschuss | A, PA, GA ×3, Kindergeld, UVS-Bescheid, MV, VB, KA | Frage 17 Unterhaltsanspruch nicht durchsetzbar |
| F04 | Rentnerehepaar, **Weiterleistungsantrag** mit Wohngeldnummer | A, Rentenbescheid ×2, VB, KA | Antragstyp Weiterleistung; kein Mietvertrag (liegt in Akte) |
| F05 | Mutter (Angestellte) + volljähriger Sohn in betrieblicher Ausbildung | A, PA ×2, GA ×3 (Mutter), Ausbildungsvergütung ×3, MV, VB, KA | Azubi im Haushalt; zwei Einkommen; Frage 5 Zweitwohnsitz des Sohns am Berufsschulort |
| F06 | Selbständiger Handwerker (Kleingewerbe) + Ehefrau Angestellte, hohe Fahrtkosten | A, PA ×2, Steuerbescheid 2025 + EÜR, KV-Beitragsnachweis (privat), GA ×3 (sie), MV, VB, KA | Selbständig; Frage 13 Werbungskosten; Frage 25 Stellplatz separat an Dritte (40 €) |
| F07 | Rentner, GdB 80, Pflegegrad 2 häuslich | A, PA, Rentenbescheid, Schwerbehindertenausweis, Pflegekassenbescheid, KV-Karte, MV, VB, KA | Frage 15 Schwerbehinderung + Pflegegrad |

### Gruppe B — unvollständig: Nachweise oder Angaben fehlen (10)

| ID | Konstellation | Unterlagen im PDF | Gezielte Lücke | Erwartete Befunde |
|---|---|---|---|---|
| F08 | Familie wie F02 (andere Personen) | A, PA ×2, GA ×3 (er), MV, VB, KA | Minijob-Nachweise der Ehefrau und Kindergeldbescheid fehlen | `verdienstbescheinigung` (Ehefrau), `kindergeld-nachweis` |
| F09 ✍ | Alleinstehender Rentner | A, PA, MV, VB, KA mit Renteneingang | Rentenbescheid fehlt; Rentenart im Antrag nicht angegeben | `rentenbescheid`, `plausi-rentenart-fehlt` |
| F10 | Alleinstehende Angestellte | A, PA, GA ×3, KA | Mietvertrag **und** Vermieterbescheinigung fehlen | `mietvertrag`, `vermieterbescheinigung` |
| F11 | Paar nach abgelehntem Bürgergeld-Antrag, Jobcenter fordert Wohngeld-Antrag | A, PA ×2, ALG-I-Bescheid, GA ×3, Ablehnungsbescheid Jobcenter, Jobcenter-Aufforderung, MV, VB | Kein Mietzahlungsnachweis | `mietzahlungsnachweis`, `plausi-mietzahlung-fehlt` |
| F12 | Alleinstehende Arbeitnehmerin | A, PA, GA ×3, MV, VB, KA | Antrag ohne Unterschrift und ohne Datum | `antrag-vollstaendig-unterschrieben`, `plausi-antrag-ohne-unterschrift`, `plausi-antrag-ohne-datum` |
| F13 ✍ | Paar, beide Arbeitnehmer | A, PA ×2, GA ×3 je Person, MV, VB, KA | Pflichtangaben leer: Geburtsdatum Partnerin, Wohnfläche, Gesamtmiete | `essenzielle-angaben` |
| F14 | Rentnerin mit angegebener Schwerbehinderung + Pflegegrad 3 | A, PA, Rentenbescheid, MV, VB, KA | Schwerbehindertenausweis und Pflegebescheid fehlen | `schwerbehinderung-nachweis`, `pflegegrad-nachweis` |
| F15 | Familie Yıldız (türkische Staatsangehörigkeit), 3 Personen, er Arbeitnehmer | A, PA (nur Antragsteller), GA ×3, Kindergeld, MV, VB, KA | Aufenthaltstitel und Identität der Ehefrau fehlen | `identitaet-jede-person` (Ehefrau); Aufenthaltstitel *(keine App-Regel)* |
| F16 | Geschiedener Vater zahlt Unterhalt für Kind aus erster Ehe, neue Partnerin im Haushalt | A, UH, PA ×2, GA ×3 je Person, MV, VB, KA | Zahlungsnachweis Unterhalt fehlt (nur Anlage ausgefüllt) | Unterhalt-Zahlungsnachweis *(keine App-Regel)* |
| F17 | Angestellter mit Abfindung (einmalige Einnahme), beantragte Rente ab 01.2027 | A, PA, GA ×3, MV, VB, KA | Abfindungsvereinbarung und Rentenantrag fehlen (Fragen 18 und 19 = Ja) | einmalige Einnahme / Einnahmeänderung *(keine App-Regel)* |

### Gruppe C — widersprüchlich: Angaben passen nicht zusammen (6)

| ID | Konstellation | Unterlagen im PDF | Gezielter Widerspruch | Erwartete Befunde |
|---|---|---|---|---|
| F18 | Paar, Mieterhöhung kürzlich | A, PA ×2, GA ×3, MV, Mieterhöhungsschreiben, VB, KA | Antrag 780 € Miete, VB 845 € (seit Erhöhung); Frage 27 fälschlich „Nein" | `plausi-miethoehe-abweichung` |
| F19 ✍ | Alleinstehender Arbeitnehmer | A, PA, GA ×3, MV, VB, KA | Wohnfläche Antrag 62 m², Mietvertrag und VB 72 m². Kürzlich umgezogen: für die alte Wohnung läuft noch Wohngeld (Frage 4 = Ja, Zuzugsdatum) | `plausi-wohnflaeche-abweichung` |
| F20 | Alleinerziehender Vater, 2 Kinder | A, PA ×3, GA ×3, Kindergeld, MV, VB, KA | Mietvertrag ohne Unterschriften | `plausi-mietvertrag-unsigniert` |
| F21 | Alleinstehende, angeblich nur Teilzeit | A, PA, GA ×3, MV, VB, KA ×2 Monate | Kontoauszug zeigt regelmäßigen, **nicht angegebenen** Minijob-Eingang; Miete bar bezahlt | `plausi-mietzahlung-fehlt`; nicht erklärte Einnahme *(keine App-Regel)* |
| F22 | Alleinstehender Rentner | A, PA, Rentenbescheid, MV, VB, KA, Depotauszug | Frage 20 „Nein", Depotauszug zeigt 140.000 € | `plausi-vermoegen-ueber-freigrenze`, `vermoegensnachweise` |
| F23 | Mischhaushalt: Mutter Arbeitnehmerin, erwachsene Tochter bezieht Bürgergeld | A, PA ×2, GA ×3, Bürgergeld-Bescheid, MV, VB, KA | Frage 10 = Ja (Transferleistung einer Person) | `ausschluss-person-transferbezug` |

### Gruppe D — Sonderkonstellationen und Grenzfälle (7)

| ID | Konstellation | Unterlagen im PDF | Besonderheit | Erwartete Befunde |
|---|---|---|---|---|
| F24 | Studentin mit BAföG in einer WG | A, PA, BAföG-Bescheid, MV (WG), VB, KA | Frage 7 Mitbewohner; alleinlebend mit BAföG ⇒ Ausschluss § 20 Abs. 2 WoGG | BAföG-Ausschluss *(keine App-Regel)* |
| F25 | Hauptmieter vermietet ein Zimmer unter | A, PA, GA ×3, MV, Untermietvertrag, VB, KA | Fragen 28 und 29 (Untervermietung, Entgelt 350 €) | Untermiete als Einnahme *(keine App-Regel)* |
| F26 ✍ | Heimbewohnerin, 88, Betreuer unterschreibt | A, Betreuerausweis, Heimvertrag, Rentenbescheid, Pflegekassenbescheid (PG 4), KA | Frage 21 Heimbewohnerin; Frage 30 Zahlung an Heim; Unterschrift durch Betreuer | keine (Heimvertrag ersetzt MV/VB) — prüft, ob die App das erkennt |
| F27 | Witwer, Ehefrau vor 5 Monaten verstorben | A, PA, Sterbeurkunde, Rentenbescheid (Witwerrente), Sterbegeld-Mitteilung, MV, VB, KA | Frage 8 verstorbenes Haushaltsmitglied; Frage 18 einmalige Einnahme | keine |
| F28 ✍ | Getrennte Eltern, Kind im Wechselmodell (40 % Betreuung) | A, UH (Variante b), PA ×2, Betreuungsvereinbarung, GA ×3, Kindergeld, MV, VB, KA | Kind lebt teils beim anderen Elternteil (Frage 6) | keine |
| F29 | Großfamilie mit 6 Personen: Elterngeld, Kurzarbeitergeld, Zuschuss der Großeltern, Geburt erwartet | A + Zusatzblatt Haushaltsmitglieder 5–6, PA ×2, Elterngeldbescheid, GA mit Kurzarbeit ×3, Kindergeld, Erklärung Großeltern, MV, VB, KA | Mehr als 4 Haushaltsmitglieder; Fragen 9, 26 und 27 (angekündigte Mieterhöhung); **über 40 Seiten** (Split-Grenze) | keine; Split-Hinweis „über 40 Seiten" erwartet |
| F30 | „Chaos-Einsendung": Paar, beide Arbeitnehmer | A (S. 7 fehlt, S. 4 doppelt), HB, GA ×3 je Person, KA quer eingescannt, Stromrechnung, MV, VB, leere Rückseite | Falsche Reihenfolge (Nachweise vor dem Antrag), fremdes Dokument, Leerseite | `essenzielle-angaben` (fehlende Seite); Split und Klassifikation unter Störung |

✍ = handschriftähnlich ausgefüllt.

## 5. Abdeckung

- **Prüfregeln der App:** Jede der 23 Regeln wird von mindestens einem Fall ausgelöst. Die häufigen Nachweisregeln
  (`verdienstbescheinigung`, `mietvertrag`, `identitaet-jede-person`) von mehreren. Zwei Regeln feuern
  praktisch immer und zählen als Standardbefund: der Hinweis `bwz-vorschlag-pruefen` bei jedem Antrag mit Datum
  und `krankenversicherung-nachweis` (siehe §7). Gruppe A prüft das Gegenteil: keine falschen Befunde.
- **Formularfragen:** Für jede der 30 Fragen des Antrags gibt es mindestens einen Fall mit „Ja"-Pfad. Ausnahme ist Frage 20 (Vermögen über Freigrenze): Sie kommt nur als Widerspruch vor, angekreuzt „Nein" trotz hohem Depot (F22). Nicht abgedeckt ist die Verpflichtungserklärung nach § 68 AufenthG.
- **Dokumenttypen:** jeder App-Typ kommt in mindestens zwei Fällen vor; `sonstiges` bewusst mit fremden
  Dokumenten (Hinweisblatt, Stromrechnung, Leerseite).
- **Haushaltsgrößen:** 1 Person (13 Fälle), 2 Personen (11), 3 (2), 4 (2), 6 (1), Heim (1). Der Schwerpunkt liegt wie in der Praxis auf kleinen Haushalten.
- **Einkommensarten:** Lohn, Minijob, Ausbildung, Selbständigkeit, Altersrente, Witwerrente, ALG I, Elterngeld,
  Kurzarbeit, BAföG, Bürgergeld, Unterhaltsvorschuss, Unterhalt, Kindergeld, Untermiete, Zuwendung Dritter, Abfindung.
- **Umfang:** ca. 18–35 Seiten je Sammel-PDF, F29 bewusst über 40. Insgesamt rund 800 Seiten je Variante.
- **Vollständigkeit:** 7 vollständig, 10 mit Lücken, 6 widersprüchlich, 7 Sonderfälle.

## 6. Erwartungsdatei (Format)

Je Fall `Fxx/expected.json` (erzeugt aus derselben Fallbeschreibung wie die PDF):

```json
{
  "fall": "F18",
  "variante": "digital",
  "seiten": 27,
  "dokumente": [
    { "seiteVon": 1, "seiteBis": 11, "typ": "wohngeldantrag" },
    { "seiteVon": 12, "seiteBis": 12, "typ": "personalausweis", "person": "P1" }
  ],
  "felder": {
    "antrag.antragsart": "erstantrag",
    "antrag.antragsteller.nachname": "…",
    "antrag.wohnung.miete": 780,
    "vermieterbescheinigung.miete": 845
  },
  "befunde": [
    { "regelId": "plausi-miethoehe-abweichung" }
  ],
  "befundeOhneAppRegel": [],
  "stoerungen": []
}
```

Die Feldpfade folgen den Extraktions-Feldern der App (`DokumentAnalyse`/Stammdaten). So lässt sich
später ein Messlauf direkt gegen die App-Ausgabe vergleichen.

## 7. Offene Punkte und Grenzen

- **Erwartung ist fachlich, nicht App-Verhalten.** Die Erwartungsdatei hält fest, was eine Wohngeldstelle
  nachfordern würde. Wo die App davon abweicht, meldet das Messwerkzeug die Abweichung. Zwei Abweichungen sind
  schon beim Katalogbau sichtbar geworden:
  - `krankenversicherung-nachweis` verlangt heute für **jede Person** ein eigenes KV-/PV-Dokument, auch für
    familienversicherte Kinder. In der Praxis ergeben sich die Beiträge meist aus der Gehaltsabrechnung oder dem
    Rentenbescheid. Fachliche Erwartung im Katalog: eigener KV-Nachweis nur bei Selbständigen und privat
    Versicherten (F06, F07). Alle anderen Fälle werden diese Regel heute als wahrscheinlich falschen Befund zeigen.
  - `identitaet-jede-person` verlangt einen Ausweis auch für Kinder. Fachliche Erwartung im Katalog: Ausweis
    für Erwachsene, für Kinder genügt die Angabe im Antrag. Ob das stimmt, sollte die Pilotkommune bestätigen.

- **Fachliche Validierung:** Die Fälle sind nach WoGG plausibel konstruiert, aber nicht von einer Wohngeldstelle geprüft.
  Die Einstufungen *(keine App-Regel)* und die Ausschlussfälle F23/F24 sollte jemand aus der Praxis bestätigen.
- **Dokumenttypen:** Mieterhöhung, Heimvertrag, Sterbeurkunde, Aufenthaltstitel und Untermietvertrag haben keinen eigenen
  App-Typ. Die Erwartung ordnet sie dem nächstliegenden Typ zu. Der Datensatz zeigt, ob eigene Typen nötig sind.
- **Handschrift und Scans** sind Annäherungen. Echte Belege aus einer Pilotkommune bleiben der
  bessere Abnahmetest.
- **Ablage:** Generator, Fallbeschreibungen und Erwartungsdateien kommen ins Repo (`tools/wohngeld-golden/`).
  Die erzeugten PDFs landen lokal in einem nicht eingecheckten Ausgabeordner und lassen sich jederzeit neu erzeugen.

## 8. Nächste Schritte

1. Freigabe dieses Katalogs.
2. Pilot mit F01 (einfach), F18 (Widerspruch) und F30 (Chaos): Generator, Vorlagen für die benötigten Layout-Familien,
   beide Varianten, Erwartungsdateien.
3. Ausbau auf alle 30 Fälle.
4. Messwerkzeug: App-Auswertung je Fall gegen `expected.json`, Trefferquoten je Messgröße.
