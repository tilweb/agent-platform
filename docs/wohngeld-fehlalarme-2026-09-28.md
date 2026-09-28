# Wohngeld — Fehlalarme der Prüfung senken (2026-09-28)

Ausgangslage: Golden-Messungen `tools/wohngeld-golden/out/messung/` (Posteingang 60 PDFs vom 24.09.,
Regelwerk 30 Fälle, Live-Stichprobe 8 Fälle). Ziel: Fehlalarme senken, ohne echte Treffer zu verlieren.
Grundsicherung zieht die Unterschrifts-Fehlerklasse mit.

Regelkatalog Wohngeld `2026-09-28a`, Grundsicherung `2026-09-28`; Profil-Vorlage „Wohngeld-Eingang"
`2026-09-28b`. Tests: `wohngeld/checker/fehlalarme.test.ts` (positiv/negativ je Änderung),
`wohngeld/dp-erkennung.test.ts`, `grundsicherung/checker/goldfaelle.test.ts`, `grundsicherung/dp-erkennung.test.ts`.

## 1. Ursachen und Änderungen

### 1.1 Unterschrift im Mietvertrag (`plausi-mietvertrag-unsigniert`) — Wohngeld und Grundsicherung

- **Ursache: Erkennung.** Das Profil liest `unterschrift_vorhanden` beim Mietvertrag unzuverlässig
  (24.09.: 35 von 60 unterschriebenen Verträgen als `false`; Live 28.09.: 1 von 8; Grundsicherung:
  je Runde ein Fehlgriff). Der Antrag wurde in allen Messungen fehlerfrei erkannt (60/60, 8/8, GS 3/3) —
  `plausi-antrag-ohne-unterschrift` (WG) und `antrag-vollstaendig-unterschrieben` (GS) bleiben deshalb
  unverändert Anforderungen (F12 ist ein echter Treffer).
- **Änderung:** Standard ist ein **Hinweis** (`info`) „Unterschrift im Mietvertrag bitte sichten" mit
  Seitenangabe. Als **Anforderung** „Mietvertrag ohne Unterschrift" nur, wenn die Extraktion das leere
  Feld mit Konfidenz ≥ `UNTERSCHRIFT_LEER_MIN_KONFIDENZ` meldet (Standard 0,9; Env
  `WOHNGELD_UNTERSCHRIFT_LEER_MIN_KONFIDENZ` bzw. `GRUNDSICHERUNG_…`).
- **Konfidenz:** kommt an — `mappeAbschnitt` erhält die Feld-Konfidenzen des DP-Ergebnisses und legt
  sie jetzt als `analyse.unterschrift_konfidenz` ab (Mietvertrag, Untermiet-, Heimvertrag). Sie ist aber
  **kein Bildbefund**: `services/extraction/confidence.ts` bewertet Textkandidaten per
  Selbsteinschätzung und deckelt bei 0,7. Mit der Schwelle 0,9 bleibt es daher konsequent beim Hinweis;
  der Weg zur Anforderung ist vorbereitet (z. B. für eine spätere Bildprüfung, 1.6).
- **Seite:** `analyse.unterschrift_seite` = Fundstelle der Extraktion (`boxes[<abschnitt>.unterschrift_vorhanden].page`,
  relativ zum Abschnitt), sonst die letzte Seite des Vertrags (Unterschriftenblock am Vertragsende).
  Wird die Datei nicht getrennt, rechnet der Posteingang auf die Dateiseite um. Die Seite steht im
  Belegtext und in der Extraktions-Übersicht (Feld „Unterschrift": Seite + Konfidenz → Sprung in der
  Dokumentansicht). Die Provenienz `p:N` gibt es nur im Legacy-Pfad, nicht im DP-Profil.
- **Grundsicherung:** der Fall „alle Mietverträge unsigniert" hing an der Vollständigkeitsregel
  `mietvertrag` (Anforderung). Er ist jetzt die eigene Regel `plausi-mietvertrag-unsigniert`
  (Plausibilität, gleiche ID und Logik wie Wohngeld); `mietvertrag` meldet nur noch „kein Mietvertrag".
- **Bestehende Vorgänge (Wohngeld):** `syncPruefschritte` gleicht offene automatische Prüfschritte an,
  wenn sich Typ oder Titel eines Befunds geändert hat (sonst bliebe die alte Anforderung stehen). In der
  Grundsicherung entfällt das: alte `mietvertrag`-Schritte verschwinden beim Neu-Prüfen, der Hinweis
  entsteht neu.
- Profil-Vorlage: Beschreibung des Mietvertrag-Unterschriftsfelds wie in der Grundsicherung präzisiert
  („über den Linien gezeichnete Unterschriften von Vermieter UND Mieter; gedrucktes Ort/Datum ist keine
  Unterschrift").

### 1.2 `vorrang-grundsicherung-mitpruefen` (Wohngeld, `checker/vorrang.ts`)

Ursache: **Regel** — sie prüfte nur Merkmale (Altersgrenze, keine Erwerbseinkünfte, erfasstes Vermögen),
nicht die Einkommenshöhe; Vermögen nur aus der Antragsangabe; Heimfälle nicht ausgenommen.

- **Einkommens-Orientierungswert** (keine Bedarfsberechnung, nur eine Schwelle): Summe der
  Monatseinkommen (brutto) der Einsatzgemeinschaft-ähnlichen Personen (antragstellende Person +
  Ehe-/Lebenspartner) gegen `GRUNDSICHERUNG_ORIENTIERUNG_PERSON_EUR` = 1.250 € bzw.
  `…_PAAR_EUR` = 1.900 € (Env `WOHNGELD_GRUNDSICHERUNG_ORIENTIERUNG_*`, im Katalog als „kommunal
  festzulegen"). Herleitung des Standards (nur Orientierung): Regelbedarfsstufe 1 563 € + örtlich
  angemessene Bruttowarmmiete ≈ 550 € ≈ 1.113 € netto, + ≈ 11 % KVdR/PV ⇒ ≈ 1.250 € brutto; Paar
  2 × 506 € + ≈ 650 € ⇒ ≈ 1.900 €. Bewusst eher hoch (Hinweis lieber einmal zu viel). Fehlt bei einer
  Einkommensposition der Betrag, bleibt der Hinweis (Einkommen unbekannt). Der Belegtext nennt Summe
  und Orientierungswert.
- **Vermögen aus Belegen:** dieselbe Quelle wie `plausi-vermoegen-beleg-abweichung`
  (`belegtesVermoegen()` in `abgleich.ts`: Vermögensnachweise + letzter Endsaldo je Konto), beschränkt
  auf Belege der Einsatzgemeinschaft bzw. ohne Personenbezug. Über 10.000 € je Person ⇒ kein Hinweis (F22).
- **Heim-/Einrichtungsfälle** (Heimvertrag liegt vor, `analyse.mietdokument = 'heimvertrag'`) sind
  ausgenommen (F26).

### 1.3 `identitaet-jede-person`

Die Ausweis-**Zuordnung** hat in keinem Golden-Fall versagt: alle 86 Ausweise des 24.09.-Laufs sind
über das Geburtsdatum der richtigen Person zugeordnet. Die Fehlalarme haben andere Ursachen:

| Fälle | Ursache | Änderung |
|---|---|---|
| F04 (d+s, live) | **Regel**: Weiterleistungsantrag ohne Ausweis — die Identität ist aus dem Vorverfahren belegt | Beim Weiterleistungsantrag kein Ausweis verlangt (Katalog-Hinweis: neue Haushaltsmitglieder manuell) |
| F24 (d+s) | **Extraktion/Haushalt**: WG-Mitbewohner (Antrag Frage 7) als Haushaltsmitglieder gelesen | Profil liest Frage 7 (`weitere_personen`) und Frage 8 (`verstorbene`) eigens; `haushaltAusRohwerten` entfernt diese Personen aus Frage 6; Frage-6-Beschreibung schließt sie aus |
| F27 (d+s, live) | **Extraktion/Haushalt**: verstorbene Ehefrau (Frage 8) als Haushaltsmitglied gelesen | wie oben |

Zusätzlich (Robustheit, Test): `ordneNachweisZu` ordnet bei fehlendem/unlesbarem Geburtsdatum auch mit
einem abweichenden Buchstaben je Namensteil zu — dieselbe Lesetoleranz wie der Namensabgleich
(`fastGleich`, jetzt in `haushalt.ts`), nur bei eindeutigem Treffer und ohne Geburtsdatums-Widerspruch.

### 1.4 Kontoeingänge (`plausi-kontoauszug-unerklaerte-eingaenge`, alt `…-einkuenfte`)

Neue, konkret begründete Ausnahmen (`eingangAusnahme()` in `abgleich.ts`, Stichwortlisten in `konstanten.ts`):

- **Umbuchung eigener Konten**: Stichwort „Umbuchung", „Übertrag", „Eigenübertrag" oder die IBAN eines
  anderen Kontoauszugs im Haushalt im Verwendungszweck (das Profil liest keine eigene Gegen-IBAN).
- **Erstattungen/Rückbuchungen**: Erstattung, Steuererstattung/Finanzamt, Rückbuchung/Rücklastschrift,
  Storno, Nebenkosten-/Betriebskostenguthaben bzw. -abrechnung, Versicherungsleistung. „Krankenkasse"
  allein zählt nicht (Krankengeld ist Einkommen — Test).
- **Kein Einkommen**: Kindergeld/Familienkasse, Wohngeld; **Pflegegeld** nur bei erfasstem Pflegegrad.
- **Zahlung eines Haushaltsmitglieds** (Vor- und Nachname im Verwendungszweck), nur bei Eingangsarten
  Mieteinnahme/Zuwendung/Sonstiges/Erstattung — nie bei Erwerb, Rente, Unterhalt (Test: Lohn mit eigenem
  Namen bleibt prüfbar).
- **Angegebene Transferleistung** (Jobcenter, Bürgergeld, BAföG …), wenn im Antrag eine Transferleistung
  bzw. ein Ausschluss oder eine passende Einkommensart erfasst ist.
- Nachvollziehbarkeit: meldet die Regel für die Person trotzdem, nennt der Belegtext die Eingänge, die
  sonst gemeldet worden wären, mit Grund („Nicht als Einkommen gewertet: … (Umbuchung zwischen eigenen
  Konten)").
- Alte Ja/Nein-Regel `…-einkuenfte:v_und_v`: „Mieteinnahme" gilt als erklärt, wenn ein Untermietvertrag
  vorliegt (F25) oder ein anderes Haushaltsmitglied Bürgergeld/Grundsicherung/HLU bezieht (Mietanteil aus
  den Unterkunftskosten, F23).

In der Messung wirken diese Ausnahmen nur eingeschränkt: die 60 gespeicherten Ergebnisse vom 24.09.
enthalten noch keine Eingangsliste (ältere Profil-Vorlage); die Live-Stichprobe hatte mit den
Abgleichsregeln vom 28.09. bereits keine Eingangs-Fehlalarme mehr.

### 1.5 Übrige Posten

| Regel | Fälle | Ursache | Behoben? |
|---|---|---|---|
| `essenzielle-angaben` | F12 | **Regel** (Doppelmeldung): Antrag ohne Datum meldet schon `plausi-antrag-ohne-datum` (erwartet) | ja — Antragsdatum wird dann nicht zusätzlich als essenzielle Angabe geführt |
| `essenzielle-angaben` | F26 | **Regel**: Heimbewohner geben keine Miete an (Katalog kannte das als Grenze) | ja — bei Heimvertrag keine fehlende Miethöhe |
| `vermieterbescheinigung` | F26 | **Regel**: Heimvertrag ersetzt die Vermieterbescheinigung | ja |
| `mietvertrag` | F04 | **Regel**: Weiterleistungsantrag — Vertrag liegt aus dem Vorverfahren vor | ja — nicht verlangt, wenn eine Vermieterbescheinigung vorliegt |
| `rentenbescheid` | F17 | **Extraktion**: die künftige Änderung aus Frage 13 („Altersrente ab 01.2027") wird als laufende Einnahme (Frage 12) gelesen | nein (Erkennung; Kandidat für die Profilbeschreibung „nur Frage 12") |

Messwerkzeug: der Heimfall braucht `analyse.mietdokument`, das die App aus dem erkannten Abschnitt
setzt. `regelwerkSnapshot` leitet es jetzt aus der Dokumentart der Erwartung ab, die Nachbewertung
gespeicherter Ergebnisse aus dem Abschnittstyp (Ergebnisse vor Vorlage 2026-09-28 hatten das Feld
noch nicht). Vorher-Werte sind mit demselben Werkzeug gegen den unveränderten Code (HEAD) gerechnet.

### 1.6 Option: Bildprüfung des Unterschriftsbereichs (nicht gebaut)

Ein zusätzlicher Vision-Aufruf je Mietvertrag, dessen Unterschrift als fehlend gelesen wurde: Bild der
letzten Vertragsseite (bzw. der Fundstelle), auf das untere Drittel zugeschnitten, Frage „Sind über den
Linien ‚Vermieter' und ‚Mieter' handschriftliche Unterschriften zu sehen? ja/nein/unklar".

- Aufwand je Aufruf: ≈ 1.500–2.500 Tokens (Bild ≈ 1.000–1.600 bei 150 dpi, Prompt ≈ 300, Antwort < 50),
  ≈ 3–6 s mit dem Vision-Modell (Adacor Mistral 3 24B).
- Häufigkeit: nur bei `unterschrift_vorhanden = false` — im Golden-Datensatz ≈ 0,6 Aufrufe je Sammel-PDF
  (37 von 60 Verträgen) gegenüber ≈ 25 Aufrufen der Profil-Extraktion (+2–3 %).
- Nutzen: ein eindeutiges „nein" könnte dann die Anforderung begründen (Konfidenz über der Schwelle),
  „ja" den Hinweis unterdrücken. Vorher mit den 60 Golden-PDFs messen (F20 ist der echte unsignierte Fall).

## 2. Messung vorher/nachher

„Fehlalarm" wie `werteBefundeAus`: App-Regel, die im Fall weder erwartet noch als bekannte Übermeldung
vermutet ist, je Fall (und Variante) und Regel einmal gezählt — unabhängig vom Typ. Deshalb zusätzlich
die Aufteilung **Anforderung** (geht an den Antragsteller) / **Hinweis** (nur Sachbearbeitung).
Werkzeug: `backend/scripts/wohngeld-golden/nachbewertung.ts` (gespeicherte Profil-Ergebnisse, ohne KI).

### 2.1 Übersicht

| Stufe | Stand | Treffer | Verfehlt | Fehlalarme | davon Anforderung | davon Hinweis |
|---|---|---|---|---|---|---|
| Regelwerk (30 Fälle, erwartete Werte, ohne KI) | vorher | 49 | 3 | 12 | 5 | 7 |
| | nachher | 49 | 3 | **3** | 0 | 3 |
| Posteingang, gespeicherte Profil-Ergebnisse vom 24.09. (Lauf 2026-09-24T05-40-28, 60 PDFs, ohne KI) | vorher | 97 | 7 | 70 | 56 | 14 |
| | nachher | 97 | 7 | **49** | **8** | 41 |
| Posteingang, gespeicherte Live-Ergebnisse (Lauf 2026-09-28T10-49-39, 8 Fälle, ohne KI) | vorher | 12 | 1 | 6 | 4 | 2 |
| | nachher | 12 | 1 | **2** | 1 | 1 |
| Posteingang **live**, Profil-Vorlage 2026-09-28b (Lauf 2026-09-28T12-12-52, 8 Fälle digital: F02, F04, F18, F21, F22, F25, F27, F29) | nachher | 12 | 1 | **0** | 0 | 0 |
| Posteingang live, zusätzlich F24 (Frage 7, Lauf 2026-09-28T12-28-27) | nachher | — | 0 | **0** | 0 | 0 |

„Vorher" beim Posteingang vom 24.09. = heutiger Regelstand vor dieser Änderung (≈ 70; der ursprüngliche
Bericht jenes Laufs zählte mit den damaligen Regeln 56). Live-Aufwand: 8 Sammel-PDFs, **198 LLM-Aufrufe**
(`audit.usage_log`, source `extraction`), **≈ 15 min**; F24 zusätzlich 20 Aufrufe, 87 s. Nebenwirkung wie
beim letzten Lauf: `ladeProfil()` hat das unbearbeitete lokale DP-Profil auf die Vorlage 2026-09-28b angehoben.

### 2.2 Fehlalarme je Regel (Anforderung/Hinweis)

Regelwerk (30 Fälle):

| Regel | vorher | nachher |
|---|---|---|
| `vorrang-grundsicherung-mitpruefen` | 7 (0/7) | 3 (0/3) — F01, F09, F14 |
| `essenzielle-angaben` | 2 (2/0) | 0 |
| `identitaet-jede-person` | 1 (1/0) | 0 |
| `mietvertrag` | 1 (1/0) | 0 |
| `vermieterbescheinigung` | 1 (1/0) | 0 |

Posteingang 60 PDFs (24.09.):

| Regel | vorher | nachher | Rest-Ursache |
|---|---|---|---|
| `plausi-mietvertrag-unsigniert` | 35 (35/0) | 35 (0/35) | Erkennung; nur noch Hinweis zum Sichten |
| `vorrang-grundsicherung-mitpruefen` | 14 (0/14) | 6 (0/6) | F01, F09, F14 — fachlich zu entscheiden (2.3) |
| `identitaet-jede-person` | 6 (6/0) | 4 (4/0) | F24, F27: alte Profil-Vorlage ohne Frage 7/8 — live behoben |
| `plausi-kontoauszug-unerklaerte-einkuenfte` | 5 (5/0) | 2 (2/0) | F29: Zuschuss der Großmutter als „Mieteinnahme" (nur Ja/Nein-Erkennung; mit Eingangsliste live behoben) |
| `essenzielle-angaben` | 4 (4/0) | 0 | |
| `mietvertrag` | 2 (2/0) | 0 | |
| `rentenbescheid` | 2 (2/0) | 2 (2/0) | F17: Erkennung (Frage 13 als Einnahme gelesen) |
| `vermieterbescheinigung` | 2 (2/0) | 0 | |

Live 8 Fälle (gespeicherte Ergebnisse 10-49-39 → neuer Live-Lauf 12-12-52): `identitaet-jede-person`
2 → 1 → 0 (F04 Regel, F27 Profil), `vorrang-grundsicherung-mitpruefen` 2 → 0 (F04 Paar über
Orientierungswert, F22 Depot), `mietvertrag` 1 → 0 (F04), `plausi-mietvertrag-unsigniert` 1 (Anforderung)
→ 1 (Hinweis) → 0 (im neuen Lauf alle Unterschriften richtig oder nicht gelesen: 8/9 richtig, 1 leer).

Grundsicherung (Golden-Messung aus dem Cache, Lauf `tools/output/grundsicherung-golden/messung/2026-09-28T12-13-34`):
Spec-Befunde unverändert 4/4 je Fall; der Fehlalarm in GS02 ist jetzt `plausi-mietvertrag-unsigniert`
als **Hinweis** statt `mietvertrag` als Anforderung (die Zählung „zusätzlich 1" bleibt, weil sie Regel-IDs zählt).

### 2.3 F01 und F14 — fachlich zu entscheiden (Erwartungen unverändert)

| Fall | Einkommen (brutto) | Orientierungswert | Befund nachher |
|---|---|---|---|
| F01 Waltraud Kessler, alleinstehend | Rente 1.184,20 € | 1.250 € | Hinweis bleibt |
| F14 Hildegard Moosbauer, alleinstehend, Pflegegrad 3 | Rente 1.078,40 € | 1.250 € | Hinweis bleibt |
| F09 Gerhard Altmeyer, alleinstehend | Rente 1.147,60 € | 1.250 € | Hinweis bleibt (gleiche Lage — liegt sogar unter F01) |

Die Golden-Erwartungen führen den Hinweis für diese Fälle nicht; mit Regelbedarf 563 € und den
Mieten der Fälle liegt das bereinigte Einkommen aber nahe am oder unter dem Grundsicherungsniveau —
der Hinweis ist vermutlich fachlich berechtigt. **Entscheidung beim User:** Erwartung um
`vorrang-grundsicherung-mitpruefen` ergänzen (dann 3 zusätzliche Treffer, Fehlalarme Regelwerk 0) oder
Orientierungswert senken (≤ 1.078 € unterdrückt alle drei). F09 ist ausdrücklich mit aufgeführt, weil eine
reine Schwelle F09 nicht anders behandeln kann als F01.

Ausgeschieden: F07 (1.265,30 € — nur knapp über dem Orientierungswert; bei niedrigerem kommunalem Wert
kommt der Hinweis zurück), F04 (Paar 2.061,30 € > 1.900 €), F22 (Depot 140.216,84 € laut Beleg), F26 (Heim).

### 2.4 Treffer

Keine echte Treffer-Regel verloren (Regelwerk 49 → 49, Posteingang 97 → 97, Live 12 → 12). Typwechsel:
F20 `plausi-mietvertrag-unsigniert` (echter unsignierter Vertrag) wird weiter gemeldet, aber als Hinweis
„bitte sichten" statt als Anforderung — gewollt, solange die Erkennung keinen verlässlichen Leer-Befund
liefert (1.1, Option 1.6). Verfehlt bleiben unverändert F12 `antrag-vollstaendig-unterschrieben` (bekannt),
F21 (Erwartungsdatei ohne Kontoeingänge bzw. Mietzahlung im alten Lauf), F22 `plausi-vermoegen-ueber-freigrenze`
(rechnet absichtlich nur mit erfasstem Vermögen).

## 3. Offen

- F01/F09/F14: Erwartung oder Orientierungswert entscheiden (2.3); Orientierungswerte mit Pilotkommune festlegen.
- F17: Profilbeschreibung „Einnahmen nur Frage 12, nicht die künftigen Änderungen aus Frage 13" — Erkennung,
  hier nicht geändert.
- Die 60er-Messung läuft auf Ergebnissen der Profil-Vorlage vom 24.09.; ein voller Live-Lauf (60 PDFs,
  ≈ 1.500 Aufrufe, ≈ 2 h) würde die Wirkung von Frage 7/8, Eingangsliste und Unterschrift-Beschreibung auf
  allen Fällen zeigen.
- Bildprüfung des Unterschriftsbereichs (1.6) — nur nach Entscheidung.
- CHANGELOG-Eintrag und Muster-Dokument (Prüfschritt-Typ wird beim Neu-Prüfen angeglichen) nicht Teil dieses Auftrags.
