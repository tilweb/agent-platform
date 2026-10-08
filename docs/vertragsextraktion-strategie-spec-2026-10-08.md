# Spezifikation: DP-Strategie `contract-structured` (2026-10-08)

Bezug: `docs/konzept-vertragsextraktion-2026-10-08.md` (Befunde aus 10 Realverträgen, Entscheidungen §9).
Diese Spezifikation beschreibt den ersten Umsetzungsschnitt im Document Processing (Engine + Lern-Schicht + API).
Die Oberfläche der Vertrags-App („Ask the contract", Fristenradar, Pflichten/Risiken/Abweichungen) ist **nicht**
Teil davon — sie konsumiert das Ergebnis.

---

## 1. Ziel und Abgrenzung

**DP liefert je Vertragsdokument:**
1. den **Klausel-Strukturbaum** (stabile IDs, Titelpfad, Seiten, Wortlaut) — Grundlage für „Ask the contract";
2. die **Gültigkeitsangaben** (gestrichene Passagen, nicht angekreuzte Optionen, handschriftliche Nachträge);
3. den **Katalog** fester Vertragselemente, jedes mit Wertstatus und Fundstellen;
4. die **Erweiterungsfelder** des Profils (heutige Profilfelder, unverändert pflegbar);
5. das **Klausel-Inventar** (Pflichten, Rechte, Fristen, Ausschlüsse …) mit Partei, Modalität, Auslöser, Fundstelle;
6. **Fristinformationen** als strukturierte Regeln — **ohne Datumsberechnung** (macht das Fristenradar);
7. **Verknüpfungsschlüssel** zu anderen Verträgen (Vertragsnr., „Rahmenvertrag vom …") — Auflösung macht die App;
8. **Befunde** (fehlende Anlage, fehlende Gegenzeichnung, Verweis ins Leere, Platzhalter, Widerspruch) — nur markiert.

**Nicht in diesem Schnitt:** Vorlagenabgleich (keine Vorlagen vorhanden), Fristberechnung, Verknüpfung von
Vertragsfamilien, Workflow, eigene UI über das bestehende DP-Projekt hinaus, Lern-Loop für Katalog/Inventar
(Korrekturen/Few-Shot wirken zunächst nur auf die Erweiterungsfelder).

## 2. Ablauf der Strategie

```
PDF ─▶ P1 Seiten rendern ─▶ P2 Transkription je Seite (Bild, parallel)
     ─▶ P3 Strukturbaum (deterministisch, seitenübergreifend)
     ─▶ P4 Auswertung (Text, Klausel-IDs): Katalog · Inventar (in Abschnittsgruppen) · Erweiterung
     ─▶ P5 Konsolidierung (deterministisch): IDs prüfen · Verweise · Anlagen · Unterschriften · Befunde · Dubletten
     ─▶ Ergebnis: data (Erweiterungsfelder) + vertrag (alles Übrige) + Befunde
```

### P1 Seiten rendern
`renderPdfToImages` mit der DP-Vision-Auflösung (150 dpi). Bilder (`image/*`) als eine Seite.
Seitenbilder gehen wie bei `vision-per-page` ins Ergebnis (Belegansicht).

### P2 Transkription je Seite (Qwen 3.5, Bild)
**Immer über das Bild**, auch bei Textlayer: Im Korpus sind 8/10 Scans, V10 hat einen fehlerhaften OCR-Layer, V4 hat
Unterschrift/Datum nur im Bild. Ist ein Textlayer vorhanden (> 200 Zeichen), geht er als **Hilfstext** mit
(„kann Fehler enthalten, das Bild gilt").

Antwort (erzwungenes JSON): `{ rolle, text, fusszeile }`.
- `rolle`: `vertragstext` · `deckblatt` · `unterschriften` · `anlage` · `mandat` (SEPA o. ä.) · `muster` (Musterrechnung,
  Beispiel) · `vorlage` (leeres Formular) · `datenblatt` (technisch, Hersteller) · `sonstiges` · `leer`.
- `text`: Wortlaut der Seite als Markdown in Lesereihenfolge (auch gedrehte Seiten), mit Auszeichnung:
  | Auszeichnung | Bedeutung |
  |---|---|
  | `## …` | Überschrift eines Paragraphen/einer Ziffer/einer Anlage (Nummer + Titel) |
  | `~~…~~` | durchgestrichen (maschinell oder von Hand) |
  | `[x]` / `[ ]` | angekreuzt / nicht angekreuzt |
  | `{{hs: …}}` | handschriftlicher Eintrag |
  | `{{unterschrift: …}}` | Unterschrift (mit erkennbarem Namen/Partei, sonst leer) |
  | `{{stempel: …}}` | Stempel (lesbarer Text) |
  | `{{unleserlich}}` | nicht lesbar |
  | Markdown-Tabelle | Tabellen |
- **Wiederkehrender Briefkopf/Fußzeile** (Register, Bank, Geschäftsführer) **nicht** in `text`, sondern einmal in
  `fusszeile` — verhindert, dass die IBAN/Registerdaten des Ausstellers als Vertragsinhalt gelten.
- Seitenzahlen weglassen.

Fehler/Timeout einer Seite → Seite fehlt, `processingIssue` (error), Rest läuft weiter (wie `vision-per-page`).

### P3 Strukturbaum (deterministisch)
Eingabe: Seiten-Transkripte mit Seitennummer. Ausgabe: `klauseln[]` mit
`{ id, ebene, nummer, titel, titelpfad[], text, seiten: [von, bis], rolle, eltern?, definitionen?: true }`.

Erkennung (in dieser Reihenfolge):
1. **Abschnittsköpfe**: `##`-Zeilen oder Zeilen, die mit `§ n`, `Ziffer n`, `Ziff. n`, `Artikel n`, `Art. n`,
   `Anlage n`, `Anhang n`, `Präambel` beginnen. Nummer + Titel werden getrennt.
2. **Unterpunkte** innerhalb eines Abschnitts: `1.` / `(1)` / `Abs. 1` am Zeilenanfang → Absatz; mehrstufige
   Nummern `2.5.3` → Klausel mit Ebene = Anzahl Stellen; Buchstabenlisten `a)` bleiben Teil des Absatzes.
3. **Unnummerierte Absätze** (Leerzeilen-Blöcke) bekommen **implizite Absatznummern** — damit „Ziffer 8 Abs. 3"
   auflösbar ist, obwohl der Vertrag die Absätze nicht nummeriert.
4. **Seitenübergreifend**: Seiten werden vor dem Parsen verkettet; ein Absatz, der auf Seite n beginnt und auf n+1
   endet, ist eine Klausel mit `seiten [n, n+1]`.
5. Text vor dem ersten Abschnitt → `rubrum`; Unterschriftsseite → `unterschriften`; Anlagen → eigene Wurzeln
   `Anlage n`. Seiten mit Rolle `muster`/`vorlage`/`datenblatt`/`mandat` werden **eigene Wurzeln** und speisen weder
   Katalog noch Inventar (bleiben aber im Baum für „Ask the contract").
6. **IDs**: `§6`, `§6.3` (Abs. 3), `Z7.2` (Ziffer 7 Abs. 2), `2.5.3`, `Anl1`, `rubrum`, `praeambel`, `unterschriften`.
   Doppelte IDs werden mit Suffix eindeutig gemacht.
7. **Definitionen**: Abschnitt mit „Definition"/„Begriffsbestimmung" im Titel wird markiert und in P4 jedem
   Inventar-Aufruf als Kontext mitgegeben.

### P4 Auswertung (Qwen 3.5, Text)
Das Modell sieht die Klauseln als `[ID] Titelpfad: Text` und antwortet **nur mit IDs als Fundstellen**
(gleiches Prinzip wie das Gesetzes-Nachschlagen der Wohngeld-App).

- **Katalog** (1 Aufruf über den ganzen Vertragstext; bei sehr langen Verträgen > ~60k Token: Rubrum, Definitionen,
  Laufzeit-/Kündigungs-/Entgelt-/Haftungs-/Schluss-Abschnitte nach Titel-Stichworten vorausgewählt).
- **Inventar** (Abschnittsgruppen ≤ ~6k Token, parallel; jeder Aufruf bekommt Rubrum/Parteirollen + Definitionen
  als Kontext). Vollständigkeit ist Ziel: „jede Pflicht, jedes Recht, jede Frist, jeder Ausschluss".
- **Erweiterung** (1 Aufruf, nur wenn das Profil Felder hat): Profilfelder inkl. Listen; Feldbeschreibung dient als
  Fundort-Hinweis.

Alle Aufrufe mit erzwungenem JSON-Schema, Temperatur 0, Modell-Slots, Timeout, ein Wiederholversuch.

### P5 Konsolidierung (deterministisch)
- Fundstellen gegen den Baum prüfen; unbekannte IDs verwerfen (Befund `verarbeitung`).
- **Querverweise** per Muster aus dem Wortlaut (`§ 6 Abs. 3`, `Ziffer 8 Abs. 3`, `Ziff. 2.4`, `Anlage 3`, `Anhang 1`)
  auf IDs auflösen → `verweise[]`; nicht auflösbar → Befund `verweis_ins_leere`.
- **Anlagen**: referenziert, aber nicht im Dokument → Befund `anlage_fehlt` (häufigster Fall im Korpus).
- **Unterschriften**: Partei ohne Unterschrift → Befund `unterschrift_fehlt`.
- **Platzhalter** (`XXX`, `____`, `[ ]` in Ausfüllfeldern, „8.X") → Befund `platzhalter`.
- **Gültigkeit**: alle `~~…~~` und nicht angekreuzten Optionen mit Klausel-ID → `gueltigkeit`.
- **Inventar-Dubletten** (gleiche Klausel, gleicher Typ, gleicher normalisierter Inhalt) zusammenführen.
- Widersprüche, die das Modell meldet (Katalog-Feld `auffaelligkeiten`), werden Befund `widerspruch`.

## 3. Ergebnisformat

`StrategyResult.contract` (neu, optional) → `PipelineRunResult.contract` → `extract()`-Ergebnis `vertrag` →
Batch-Ergebnis `detail.vertrag` (jsonb, keine Migration) → öffentliche API `vertrag`.

```ts
interface VertragsAuswertung {
  version: 1;
  seiten: Array<{ seite: number; rolle: SeitenRolle }>;
  klauseln: Klausel[];                       // Strukturbaum
  gueltigkeit: Array<{ art: 'gestrichen' | 'nicht_angekreuzt' | 'handschriftlich'; text: string; klausel: string }>;
  katalog: Record<KatalogElement, KatalogWert>;
  inventar: InventarEintrag[];
  fristen: FristRegel[];                     // aus Katalog (Laufzeit/Kündigung) + Inventar, ohne Berechnung
  verknuepfungen: Array<{ art: 'vertragsnummer' | 'kundennummer' | 'rahmenvertrag' | 'zusatz_zu' | 'ersetzt' | 'sonstige'; wert: string; klausel?: string }>;
  verweise: Array<{ von: string; text: string; ziel?: string }>;
  befunde: Array<{ typ: BefundTyp; text: string; klauseln: string[] }>;
}
interface KatalogWert {
  status: 'gefunden' | 'nicht_geregelt' | 'anlage_fehlt' | 'delegiert' | 'geerbt' | 'bedingt';
  wert: unknown;                             // elementabhängige Struktur (siehe §4)
  bedingung?: string;                        // bei 'bedingt'
  verweis?: string;                          // bei 'delegiert'/'geerbt'/'anlage_fehlt': worauf
  klauseln: string[];
}
interface InventarEintrag {
  typ: 'pflicht' | 'recht' | 'frist' | 'ausschluss' | 'haftung' | 'zahlung' | 'sonstiges';
  partei: string;                            // Rolle (z. B. "Auftragnehmer") oder Dritter
  gegenueber?: string;
  inhalt: string;                            // knapp, sinngemäß
  modalitaet: 'muss' | 'soll' | 'bemueht' | 'kann' | 'darf_nicht';
  ausloeser?: string;                        // Ereignis, an das die Pflicht/Frist knüpft
  bedingung?: string;
  frist?: FristAngabe;
  klauseln: string[];
}
interface FristAngabe {                      // nur Information, keine Berechnung
  dauer?: number; einheit?: 'tage' | 'werktage' | 'wochen' | 'monate' | 'jahre';
  richtung?: 'vor' | 'nach' | 'bis' | 'innerhalb';
  bezug?: string;                            // "Ablauf der Laufzeit", "Rechnungszugang", "Inbetriebnahme" …
  zum?: string;                              // "Monatsende", "Quartalsende" …
  wortlaut: string;
}
interface FristRegel extends FristAngabe { art: string; partei?: string; form?: string; klauseln: string[] }
```

`data` enthält wie bisher **nur die Profilfelder** (Erweiterung) — damit funktionieren Review, Korrektur, Eval und
Export der bestehenden DP-Oberfläche unverändert. Befunde gehen zusätzlich als `validations`
(`rule_id: 'vertrag-<typ>'`, `severity: 'warn'`) in die bestehende Review-Triage.
`document_text` = verkettete Transkription (für Suche und Lern-Loop).

## 4. Katalog v1

| Schlüssel | Wert-Struktur |
|---|---|
| `vertragsart` | `{ bezeichnung, kategorie }` — aus dem Inhalt, Titel nur Hinweis |
| `parteien` | `[{ rolle, name, anschrift?, aliasse[] }]` |
| `vertragsnummern` | `[{ art, wert }]` |
| `unterschriften` | `[{ partei, vorhanden, datum?, ort?, stempel?, vertretung?, handschriftlich? }]` |
| `datum_abschluss` | Text/Datum laut Vertrag (Wirksamkeitsregel als Text) |
| `beginn` | `{ datum?, regel? }` |
| `laufzeit` | `{ art: 'befristet'|'unbefristet'|'mindestlaufzeit', dauer?, ende? }` |
| `verlaengerung` | `{ automatisch, schritt? }` |
| `kuendigung` | `{ frist (FristAngabe), form?, ausserordentlich? }` |
| `entgelte` | `[{ bezeichnung, betrag?, formel?, bezugsgroesse?, richtung, rhythmus?, netto_brutto? }]` |
| `zahlungsbedingungen` | `{ zahlungsziel?, verfahren? }` |
| `preisanpassung` | `[{ wer, ausloeser, frist?, wirksam_ab? }]` |
| `haftung` | `{ beschraenkung?, hoechstbetrag?, ausnahmen? }` |
| `gewaehrleistung` | Text |
| `verfuegbarkeit_sla` | `{ zusage, modalitaet }` |
| `vertragsstrafe` | Text |
| `vertraulichkeit` | Text |
| `exklusivitaet_wettbewerb` | Text |
| `gerichtsstand` | `{ ort, bedingung? }` |
| `rechtswahl` | Text |
| `schriftform` | Text |
| `widerruf` | Text |
| `anlagen` | `[{ bezeichnung, vorhanden }]` |
| `auffaelligkeiten` | `[Text]` → Befunde `widerspruch` |

## 5. Profil und Konfiguration

- `extraction.strategy: 'contract-structured'`; Profilfelder = Erweiterung (Wert- und Listenfelder wie heute).
- Neuer Strategie-Eintrag in der Projekt-Einstellung („Vertrag — Klauselstruktur, Katalog, Pflichten und Fristen").
- `extraction.max_pages` (Default 150), `max_concurrent` wie üblich. Modell: DP-Bindung (Qwen 3.5).
- Konverter (Markitdown) wird für diese Strategie übersprungen (wie bei `template-labelmap`).

## 6. Messung

`backend/scripts/vertrag-pilot/messung.ts`: liest die 10 Verträge aus einem lokalen Ordner (`--ordner`, Default
`~/Downloads/Vertragsbeispiele-Ehinger-END`), Transkriptionen werden je Seite zwischengespeichert. Erwartungswerte
liegen **lokal, nicht im Repo** (`tools/vertrag-golden/erwartet/*.json`, gitignored), weil sie Vertragsinhalte der
Kunden enthalten.

Kennzahlen: Strukturbaum (Anzahl Abschnitte, seitenübergreifende Klauseln korrekt), Katalog (Werte + Status je
Element), Unterschriften je Partei, Befunde (fehlende Anlagen/Gegenzeichnung gefunden), Inventar-Vollständigkeit auf
annotierten Kern-Pflichten/-Fristen, Dauer und Modellaufrufe.

## 7. Umsetzungsschritte

1. Typen + Strukturbaum-Parser (P3) mit Unit-Tests auf korpusnahen Mustern.
2. Transkription (P2) + Messskript-Stufe „Struktur" auf den 10 Verträgen.
3. Auswertung (P4) + Konsolidierung (P5) mit Unit-Tests (Verweise, Anlagen, Unterschriften, Platzhalter, Dubletten).
4. Integration: Strategie-Registry, `StrategyResult.contract`, `extract()`, Batch-Persistenz, öffentliche API,
   Strategie-Auswahl in der Oberfläche.
5. Erwartungswerte annotieren, Gesamtmessung, Ergebnis-Dokument.
