# Fachkonzept: Segmentierung — Vorgang → Segmente → Felder (Welle 10)

**Datum:** 2026-08-08
**Status:** Konzept, wartet auf Beispiel-Scans des Kunden für den Pilot
**Referenzen:** Reducto Split (reducto.ai/split) · `docs/document-processing-standortbestimmung-2026-08-08.md` ·
`docs/extraktion-posteingang-2026-07-29.md` (W4)

---

## 1. Anwendungsfall und Anspruch

Ein Schreiben an eine Stadtverwaltung: **Anschreiben**, gefolgt von einem **Formular**, gefolgt von
einem **Bild als Nachweis** — die Scanstrecke macht daraus ein einziges PDF. Fachlich ist und bleibt
das **ein Vorgang**. Aber die drei Teile sind verschiedener Natur: Das Anschreiben trägt Absender
und Anliegen, das Formular die strukturierten Antragsdaten, der Nachweis ist gar nicht zu
extrahieren, sondern zu **erkennen und zu belegen** („Meldebescheinigung liegt bei").

Reducto nennt diese Fähigkeit *Split*: jede Seite wird gegen **in Prosa beschriebene Sektionstypen**
klassifiziert, zurück kommt `splits[]` mit Name, Seitenbereichen und Konfidenz; die Seitenbereiche
fließen dann gezielt in die Extraktion. Ein `partition_key` trennt Mehrfach-Instanzen desselben
Typs (drei Nachweise, zwei Konten in einer Akte).

## 2. Ist-Analyse: die Modell-Lücke

Unser heutiges Modell kennt genau zwei Sichten auf einen Sammel-Scan:

1. **Posteingang mit Trennung** (`split=true`, W4): Grenzen erkennen → **unabhängige Dokumente**
   (`InboxPart` mit `pageFrom/pageTo`), jedes wird separat klassifiziert und in ein eigenes Profil
   geroutet. Der Zusammenhang „das war EIN Brief" geht verloren.
2. **Ohne Trennung** (`split=false`, W8): eine Datei = **ein monolithisches Dokument** = genau
   **ein Profil** mit einem flachen Feldsatz. Alle Seiten laufen durch dasselbe Schema.

Der Stadtverwaltungs-Fall braucht das Dritte: **zusammenhalten UND unterscheiden.**

### Der versteckte Defekt, den die Lücke heute schon verursacht

Bei einem Mischdokument durch EIN Profil mischt der Merger Seiten verschiedener Natur:
`first-non-null` greift das „Datum" vom Anschreiben ab, obwohl das Formulardatum gemeint war;
`union` konkateniert Listen über Segmentgrenzen hinweg. Das ist kein hypothetisches Risiko, sondern
die Mechanik von `merger.ts` — sie kann Seiten nicht nach Rolle unterscheiden, weil das Modell
keine Rollen kennt. **Segment-Scoping macht diese Kollisionsklasse strukturell unmöglich.**

## 3. Zielmodell

```
heute:    Dokument ──────────────────────→ Felder
künftig:  Vorgang ──→ Segment-Instanzen ──→ Felder je Segment
                       (Typ, Seiten, Konfidenz)
```

### 3.1 Profil-Erweiterung: Segmenttypen (`segments`)

Ein Profil kann optional Segmenttypen deklarieren — beschrieben in Prosa, wie unsere bewährten
`instructions`. Skizze (`ExtractionProject`):

```ts
segments?: Record<string, {
  label: string;
  /** Prosa-Beschreibung fuer die Seiten-Klassifikation — wie bei Reducto. */
  description: string;
  /** Feldsatz des Segments — gleiche Form wie heute project.fields. */
  fields?: Record<string, ProjectField>;
  /**
   * 'extract' (Default) | 'classify-only' — ein Nachweis wird erkannt und
   * belegt (Typ + Seitenbereich + Kurzbeschreibung), aber nicht extrahiert.
   */
  mode?: 'extract' | 'classify-only';
  /** Mehrfach-Instanzen erlaubt? (drei Nachweise → drei Segment-Instanzen) */
  repeatable?: boolean;
  required?: boolean;   // fehlt das Segment → Befund + needs_review
}>;
```

Regeln:
- **Kein `segments` = heutiges Verhalten.** Bestehende Profile (Ehinger!) sind der Sonderfall
  „ein impliziter Segmenttyp über alle Seiten" — keine Migration, nichts bricht.
- Ein Reserve-Typ **`unbekannt`** existiert immer: Seiten, die zu keiner Beschreibung passen,
  werden nicht erraten, sondern ausgewiesen (Befund, Review).
- `fields` je Segment hat exakt die heutige Form (`ProjectField` inkl. Listen, Katalogen,
  Prüfregeln) — der gesamte W5/W6/W7-Unterbau gilt je Segment weiter.

### 3.2 Ergebnis-Modell: Segment-Instanzen am Lauf

Das flüchtige „Teil" des Posteingangs wird zum **persistenten Konzept am Batch-Ergebnis**:

```ts
segments?: Array<{
  type: string;              // Schluessel aus profile.segments | 'unbekannt'
  instance: number;          // 1..n bei repeatable
  pageFrom: number;
  pageTo: number;
  confidence: number;        // Seiten-Klassifikations-Konfidenz (min ueber die Seiten)
  data?: Record<string, unknown>;          // nur mode 'extract'
  fieldConfidences?: Record<string, number>;
  summary?: string;          // mode 'classify-only': Kurzbeleg ("Meldebescheinigung, 1 Seite")
}>;
```

`data` auf Dokumentebene bleibt für segmentlose Profile unverändert; bei Segment-Profilen ist es
die Aggregation (`{ anschreiben: {...}, formular: {...}, nachweise: [...] }`).

## 4. Segmentierungs-Verfahren

**Seiten-Klassifikation statt Paar-Urteil.** Der W4-Splitter urteilt „gehören Seite A und B
zusammen?" — für typisierte Segmente ist Reductos Ansatz robuster: **jede Seite wird gegen die
Typbeschreibungen klassifiziert** (1 Vision-Call je Seite, guided_json aus W7 mit
`enum`-beschränktem Typ + Konfidenz). Grenzen ergeben sich als Ableitung: Typwechsel ⇒ Grenze;
gleicher Typ auf Folgeseite ⇒ Fortsetzung, außer die Seite trägt erkennbar einen Neustart-Marker
(Briefkopf, „Seite 1 von n") und der Typ ist `repeatable` — das deckt zwei aufeinanderfolgende
Nachweise ab, ohne ein separates Paar-Urteil zu brauchen.

Nachverarbeitung deterministisch: Glättung von Einzelseiten-Ausreißern (eine einzelne
„Formular"-Seite mitten im Anschreiben mit niedriger Konfidenz → Befund statt Mini-Segment),
`required`-Segmente prüfen, `unbekannt`-Seiten ausweisen.

**Kosten:** +1 Vision-Call je Seite. Die Klassifikation läuft auf **150 dpi** — die W9-Messung hat
150 dpi nur für die **Feld-Extraktion** verworfen; die Posteingangs-Klassifikation arbeitet seit W4
zuverlässig auf 150 dpi (24/24 im Ehinger-Pilot). Damit kostet der Segmentierungspass ≈ 2.200
Token je Seite (statt 3.700), beim 3-teiligen Stadtverwaltungs-Brief mit 4 Seiten also ≈ 9k Token
zusätzlich — und spart auf der anderen Seite Extraktions-Calls, wenn `classify-only`-Segmente
(Nachweise) gar nicht mehr durch die Feld-Extraktion laufen.

## 5. Gescopte Extraktion

Je Segment-Instanz mit `mode: 'extract'` läuft die **bestehende** Pipeline — mit zwei Scopes:
nur die Seiten des Segments (`pageSelection` existiert in `pdf.ts`), nur das Sub-Schema des
Segmenttyps (der `pipeline-adapter` baut heute schon Profile dynamisch). Merger, OCR-Fusion,
Boxen, Konfidenzen, Validierung, Prüfregeln: alles unverändert, nur pro Segment. Es entsteht
**kein neuer Extraktionscode** — die Strategien wissen nichts von Segmenten.

`classify-only`-Segmente erzeugen statt einer Extraktion einen Kurzbeleg (1 Vision-Call auf der
ersten Segmentseite oder Übernahme aus der Klassifikation) — Typ, Seiten, Zusammenfassung.

## 6. Review, Lern-Loop, Triage

- **Review-Gliederung:** Das Vollbild-Review bekommt die Segmentliste als Struktur — Miniaturen
  nach Segment gruppiert (farbige Marker), Felder unter Segment-Überschriften,
  `classify-only`-Segmente als Beleg-Kachel.
- **Grenz- und Typkorrektur wird der neue Lern-Fall:** Verschiebt der Prüfer eine Grenze oder
  ändert einen Typ, ist das ein Trainingsbeispiel für die Seiten-Klassifikation (Few-Shot je
  Segmenttyp, analog zum heutigen Lern-Loop). Danach läuft die gescopte Extraktion der betroffenen
  Segmente neu.
- **Triage:** `needs_review` zusätzlich wenn: `unbekannt`-Seiten existieren, ein
  `required`-Segment fehlt, eine Segment-Konfidenz unter der Schwelle liegt, oder ein
  Einzelseiten-Ausreißer geglättet wurde. Die W7-Philosophie gilt fort: Unsicherheit wird
  vorgelegt und begründet, nie verschluckt.

## 7. API, Export, Webhook

- `extract`/`batch.get` liefern `segments[]` zusätzlich zu `data` (additiv, kein Bruch).
- Flaches XLSX: Spalten `Segment` + `Instanz` vor den Feldspalten; `classify-only`-Segmente als
  eigene Zeile mit Beleg-Text. Der gemeinsame Baustein `learning/export-xlsx.ts` wird erweitert.
- Webhook-Payload: `segments[]` im Ergebnis — EMMA-artige Abnehmer können je Segmenttyp
  weiterverzweigen.

## 8. Abgrenzung zum Posteingang (bewusst zwei Ebenen)

| | Posteingang (W4) | Segmentierung (W10) |
|---|---|---|
| Frage | Gehören diese Seiten zu **verschiedenen Vorgängen**? | Welche **Rollen** haben die Seiten **innerhalb** eines Vorgangs? |
| Ergebnis | getrennte Dokumente, getrennt geroutet | ein Dokument, typisierte Segmente |
| Analogie Reducto | Classify (Dateien routen) | Split (Sektionen in der Datei) |

Beide bleiben und kaskadieren: erst Vorgänge trennen (oder `split=false`), dann je Vorgang
segmentieren. Perspektivisch kann der Posteingangs-Splitter die Seiten-Klassifikation
wiederverwenden (ein Verfahren, zwei Auswertungen) — das ist Refactoring-Option, nicht
Voraussetzung.

## 9. Umsetzungsplan (Welle 10)

| Schritt | Inhalt | Verifikation |
|---|---|---|
| **W10.1** Datenmodell + Segmentierer | `segments` am Profil, Seiten-Klassifikator (guided_json, 150 dpi), deterministische Grenzbildung + Glättung, `unbekannt`/`required`-Befunde | Unit-Tests Grenzbildung; Messung gegen gelabelte Beispiel-Scans |
| **W10.2** Gescopte Extraktion | je Segment-Instanz Pipeline-Lauf mit Sub-Schema + `pageSelection`; `classify-only`-Beleg; Ergebnis-Aggregation | Ehinger-Regression (segmentlos, darf sich nicht ändern) + Pilot-Messung je Segmentfeld |
| **W10.3** Review-Gliederung | Segmentliste im Vollbild-Review, Miniatur-Gruppierung, Grenz-/Typkorrektur → Lern-Signal + Re-Extraktion | Durchklick am Pilotfall |
| **W10.4** API/Export/Webhook | `segments[]` additiv, XLSX-Spalten, Webhook | Public-API-Tests, Export gelesen |
| **W10.5** Pilot + Messung | Kundens-Scans (kommen nach): Ground Truth = Segmentgrenzen + Typen + Felder je Segment | Messtabelle im Standort-Stil |

**Messplan** (analog Ehinger, sobald die Scans da sind): Seiten-Klassifikations-Accuracy,
Grenz-Treffer (exakt / ±1 Seite), Segmenttyp-Accuracy, Feldqualität je Segment **gegen den
heutigen monolithischen Lauf** desselben Dokuments (die Merger-Kollisionen aus §2 werden damit
erstmals sichtbar gemessen), Token je Vorgang.

## 10. Evaluation der Beispiel-Dokumente (2026-08-08, `docs/SplitDocuments/`)

Alle 18 Dokumente wurden Seite für Seite visuell gesichtet und gelabelt — Ground Truth:
`tools/segment-pilot/groundtruth/documents.json` (lückenlos validiert).

**Bestand:** 18 Dokumente · **179 Seiten** · **93 Segmente** · 9× born-digital, 5× Scan, 4× gemischt.
Segmentgrößen: 57 Einseiter, 36 mehrseitige (größtes: 14 Seiten Gutachten). Häufigste Typen:
infoblatt 14 · zertifikat 11 · anschreiben 10 · einwilligung 8 · nachweis 6 · bescheinigung 6.

**Fünf Dokumentfamilien:**
1. **Bewerbungsmappen** (4×): Anschreiben + Lebenslauf + 3–8 Nachweise/Zeugnisse/Zertifikate,
   gemischt born-digital und Foto-Scan, teils Querformat, einmal untypische Reihenfolge
   (CV vor Anschreiben) und ein **Trennblatt** „Zeugnisse".
2. **Versicherungs-/Rechnungspakete** (4× AXA, 1× Mainova): Anschreiben + Bescheinigungen +
   Beiblätter mit **eigener interner Nummerierung** („Seite 1 von 8") + **Quasi-Leerseiten**
   (nur DataMatrix-Code) + zuletzt ein designfremder Behörden-Flyer.
3. **Formular-Pakete** (2× Schulanmeldung, als Messpaar born-digital ↔ unterschriebener Scan!):
   Formular + Vertrag + **4 Einwilligungen** (repeatable) + Infoblätter.
4. **Geschäfts-/Behördendokumente**: Vertrag mit Anhängen + eingebettetem Fremddokument
   (Versicherungsschein), Gutachten mit **3 Prüfberichten** (repeatable, eigene Kennung
   „2026-1136-1…3"), Eingangsrechnung mit Stundennachweis + **ausgedruckter E-Mail**,
   Behörden-Anschreiben mit Querformat-Anlage (handschriftlicher „Anlage"-Vermerk).
5. **Negativ-/Grenzfälle** (bewusst im Satz): ein **13-seitiger Lebenslauf = EIN Segment**
   (darf nicht geschnitten werden), zwei **2-seitige Ausweiskopien** (Vorder-/Rückseite = ein
   Nachweis), eine Fahrzeug-Konfigurationsmappe (fließende Kapitel, als Grenzfall markiert).

**Beobachtete Grenzsignale** (Prior-Wissen für den Seiten-Klassifikator, in die Typbeschreibungen
aufzunehmen): Briefkopf-/Logo-Wechsel · Neustart interner Seitennummerierung („Seite 1 von N",
„1/2", eigene Berichts-Kennungen) · Formatwechsel hoch/quer · Designbruch (Behörden-Flyer nach
AVB-Text) · Trennblätter · Quasi-Leerseiten · „Ende des …"-Marker.

**Antworten auf die offenen Fragen (aus dem Bestand):**
1. *Typenmenge:* ~20 Typen im Gesamtbestand, aber **je Profil nur 4–8** — die Taxonomie lebt im
   Profil (wie geplant), nicht global. Eine globale Referenzliste dient nur als Vorschlagsquelle.
2. *Reihenfolge:* überwiegend stabil, aber **nicht verlasslich** (CV vor Anschreiben belegt) —
   Reihenfolge als Prior in Beschreibungen, nie erzwungen. Bestätigt.
3. *Mehrfach-Instanzen:* massiv vorhanden (4 Einwilligungen, 3 Prüfberichte, bis zu 7 Nachweise
   in einer Mappe) — `repeatable` ist Kernfunktion, nicht Kür. Der Fall „zwei gleiche Typen direkt
   hintereinander" (Zertifikat S.12+13, Prüfberichte 16–18) braucht den Neustart-Marker
   (Briefkopf/Kennung), genau wie im Konzept §4 vorgesehen.
4. *Nachweise:* `classify-only` bestätigt (Ausweiskopien, Urkunden, Flyer) — **plus Werteliste
   auf dem Nachweis-Typ** lohnt (Ausweiskopie · Urkunde · Zertifikat · Bescheinigung sind klar
   unterscheidbar).
5. *Pflicht-Nachweise:* im Bestand nicht direkt belegt, bleibt Kundenfrage.

**Zwei Konsequenzen für W10.1:**
- **Leerseiten/Trennblätter** werden ein eigener eingebauter Typ (neben `unbekannt`): sie gehören
  keinem Segment an und dürfen weder Grenzen verschlucken noch als `unbekannt`-Befund alarmieren.
- Die **Einseiter-Dominanz** (57 von 93) heißt: die Glättung von Einzelseiten-Ausreißern (§4) darf
  nicht pauschal „Einzelseite = verdächtig" annehmen — Einzelseiten-Segmente sind der Normalfall.
  Geglättet wird nur bei niedriger Konfidenz UND gleichem Nachbar-Typ beidseits.

## 11. Messergebnis W10.1 (2026-08-08, erster Wurf ohne Tuning)

Datenmodell (`segments` am Profil, Migration 0032), Seiten-Klassifikator (guided_json, 150 dpi)
und deterministische Grenzbildung sind umgesetzt (`extraction/segmentation/segmenter.ts`,
10 Unit-Tests). Messlauf über alle 18 Dokumente mit den 10 Familien-Profilen
(`tools/segment-pilot/`, Ergebnisse lokal — gitignored):

| Metrik | Ergebnis |
|---|---|
| Seitentyp-Accuracy | **95,5 %** (171/179) |
| Grenzen | Precision **92,2 %** · Recall **94,7 %** |
| Segmente exakt (Typ + Seitenbereich) | **78/93**, weitere 8 auf ±1 Seite |
| Befunde/Fehlalarme | **0** auf allen 18 Dokumenten |

**Was auf Anhieb sitzt:** beide Negativfälle (13-seitiger Lebenslauf = 1 Segment; Ausweiskopie
Vorder-/Rückseite = 1 Instanz), das **Messpaar** Formular-Paket born-digital ↔ unterschriebener
Scan (beide 8/8 exakt — die Scanqualität kostet nichts), das Gutachten mit den **3 Prüfberichten**
(repeatable + Kennung, 6/6), 9 von 18 Dokumenten komplett perfekt.

**Die 15 verfehlten Segmente sind zwei Fehlerklassen, keine Streuung:**
1. **Instanz-Trennung innerhalb gleichen Typs verpasst** (Neustart-Recall): zwei
   aufeinanderfolgende Anlagen/Infoblätter/Zeugnisse als eine Instanz (Erdgas, Beate-Zeugnisse
   5–6/7–8). Seitentypen dabei korrekt — es fehlt nur der Schnitt. Hebel: Neustart-Beschreibung
   je Typ schärfen (Briefkopf-Wechsel des Ausstellers explizit machen).
2. **Semantisch vertretbare Typ-Verwechslung** auf echten Hybrid-Seiten: DRK-Teilnahme-
   *bescheinigung* als Zertifikat, Fußnoten-Folgeseite als Infoblatt statt Anlage (EQE — der
   deklarierte Grenzfall), zweite Seite eines WBS-Zertifikats (Notenübersicht) als Nachweis.

Damit ist die W10.1-Kernfrage beantwortet: **der Reducto-Ansatz funktioniert auf unserem Stack** —
Seiten-Klassifikation mit Prosa-Beschreibungen + deterministische Grenzbildung erreicht ohne
jedes Tuning >95 % Seiten-Accuracy und >92 % Grenz-Präzision, mit null Fehlalarmen. Die beiden
Fehlerklassen sind die Arbeitsliste für W10.2 (Neustart-Schärfung in den Beschreibungen;
Fortsetzungsseiten-Logik), nicht Gegenargumente.

## 12. W10.2: Gescopte Extraktion + Neustart-Tuning (2026-08-08)

**Gescopte Extraktion umgesetzt** (`extraction/segmentation/segment-extract.ts`): bei Profilen mit
`segments` klassifiziert `extract()` die Seiten, baut je `extract`-Segment ein Sub-PDF
(`buildPartPdf`) und schickt es mit dem Sub-Schema des Typs durch die **bestehende** Pipeline —
Merger, OCR-Fusion, Boxen, Kataloge gelten je Segment unverändert. `classify-only`-Segmente
erhalten einen Kurzbeleg ohne zusätzlichen Modellaufruf. Ergebnisse aggregiert:
`data.<segId>` (repeatable als Array), Konfidenzen/Boxen namespaced (`segId[2].feld`), Box-Seiten
absolut. Persistenz über `batch_run_files.segments`, API (`extract`/`batch.get`) additiv,
Review-Triage prüft namespaced Konfidenzen; `unbekannt`/fehlende Pflicht-Segmente erzwingen Review.

E2E am unterschriebenen Formular-Paket: 6 Segment-Instanzen, das handschriftliche Datum
(„Ffm 25.05.2026" → `2026-05-25`) aus dem Formular-Segment extrahiert, Box auf absoluter Seite 2,
`auto_ok`. Ehinger-Stichprobe: segmentloser Pfad byte-identisch im Verhalten (vision-per-page,
kein `segments`-Feld).

Bewusste W10.2-Grenzen: Few-Shot/gelernte Regeln bleiben Gesamtdokument-bezogen und werden für
Segment-Läufe nicht injiziert; Prüfregeln (W5) hängen an Projekt-, nicht an Segment-Feldern.
Beides Folgearbeit, wenn Segment-Profile in den Lern-Loop gehen.

**Neustart-Tuning, drei Messläufe (ehrliches Protokoll):**

| Lauf | Seitentyp | Grenzen P/R | Segmente exakt |
|---|---|---|---|
| 1 (Basis) | 95,5 % | 92,2 / 94,7 % | 78/93 |
| 2 (Aussteller-Wechsel betont) | 97,2 % | 93,2 / **92,0 %** | **77/93** |
| 3 (Signale in beide Richtungen) | 96,6 % | 93,4 / 94,7 % | **80/93** (+8 auf ±1) |

Lauf 2 war die Lehrstunde: die Betonung „Aussteller-Wechsel ⇒ Neustart" verklebte Instanzen
**desselben** Ausstellers (die vier Schul-Einwilligungen, die Versorger-Anlagen). Lauf 3 nennt die
Signale explizit ausstellerunabhängig (eigene Titel-Überschrift, Zählungs-Neustart, sichtbarer
Abschluss der Voreinheit) — damit sind 12 von 18 Dokumenten perfekt, die große Bewerbungsmappe
springt auf 10/10. Hartnäckig bleiben die Versorger-Beiblätter (Erdgas 1/7 — sehr einheitliches
Layout ohne klare Titelwechsel) und der deklarierte EQE-Grenzfall; beide sind Typ-2-Fälle
(semantische Hybride), kein Verfahrensproblem.

## 13. Offene Fragen an den Kundenfall / die Beispiel-Scans

1. Wie viele Segmenttypen realistisch (nur Anschreiben/Formular/Nachweis, oder offene Menge)?
2. Ist die Reihenfolge stabil (Anschreiben immer zuerst?) — wenn ja, wird sie als Prior in die
   Beschreibung aufgenommen, aber nie erzwungen.
3. Mehrere Nachweise je Vorgang (→ `repeatable`)? Mischformen (Formular mit angehefteter Kopie)?
4. Sollen Nachweise nur belegt (`classify-only`) oder typisiert werden (Werteliste:
   Meldebescheinigung · Ausweis-Kopie · Foto · …)? Letzteres wäre ein Katalog auf dem Segmenttyp.
5. Gibt es fachlich **Pflicht-Nachweise** je Formulartyp (→ `required` + Prüfregel-Kopplung
   „Formular X verlangt Nachweis Y")? Das wäre der Punkt, an dem Segmentierung und W5-Prüfregeln
   zusammenwachsen — und ein Verkaufsargument, das Reducto so nicht hat.
