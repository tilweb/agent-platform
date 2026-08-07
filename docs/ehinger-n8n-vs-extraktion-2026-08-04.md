# Ehinger-Lieferscheine: n8n-Workflow vs. Extraktionsfeature — gemessener Vergleich

**Datum:** 2026-08-04
**Anlass:** Bei Kunde Ehinger lädt EMMA (RPA) gescannte Lieferscheine in einen n8n-Workflow, der
klassifiziert, extrahiert, prüft und ein XLSX zurückgibt. Frage: Erreicht unser Extraktionsfeature
dasselbe Ziel in gleicher oder besserer Qualität?
**Antwort:** Ja — auf den gemessenen Belegen mit **zwei Fehlern in 12 gelabelten Dokumenten**
(beide erkannt, nicht falsch geraten), bei **einem Drittel der LLM-Aufrufe** und ohne externe
Dienste. Die drei benannten Produktlücken sind inzwischen geschlossen; einen vierten Fehler hat der
Pilot im Produkt gefunden (Vision-Prompt ohne Listen-Spalten) und er ist behoben.

**Pilot:** `tools/ehinger-pilot/` (Projekte, Ground Truth, Lauf, Messung) · Rohdaten:
`tools/ehinger-pilot/results/` · Testbelege: `docs/Ehinger/` (24 Scans, 54 Seiten)

> **Benennung:** Dieses Dokument stammt aus der Zeit vor der Umbenennung (2026-08-07). Die App heißt inzwischen **Document Processing**, das frühere „Extraktionsprojekt" heißt **Profil**, der Vorgang „auslesen". Code, Module und API-Scopes sind unverändert. Siehe `docs/fachkonzept-dokumenten-extraktion-2026-07-27.md` §0.

---

## 1. Was der n8n-Workflow tut

35 Nodes, je Seite eine Schleife:

```
Formular-Upload → externer Dienst pdf2image (Railway) → je Seite:
  1. Klassifikation   (mistral-3-24b, Bild)  4 Lieferanten + "Positionen?" + "Handschrift?"
  2. Freitext-Extraktion (Bild, lieferantenspezifischer Prompt)
  3. Struktur-Extraktion (Text → JSON, lieferantenspezifisches Schema)
  4. Zweitmodell Pixtral-12b (Bild): Referenz-/Lieferschein-/Artikelnummern
  5. QA-LLM (Bild vs. Extraktion): 6 Ja/Nein-Fragen
  6. Code-Check: QA-Antworten + Stringvergleich Modell 1 ↔ Modell 2
→ XLSX: eine Zeile je Position, Kopfdaten wiederholt
```

**5 LLM-Aufrufe je Seite, zwei Modelle.** Vier Lieferanten (Sonepar, UniElektro, Eldis, Elektro
Braun) mit je eigenem Schema und eigenem Prompt, alles in Python-Code-Nodes. Notiz des Autors im
Workflow: *„ToDo: Handschriften-Erkennung ist noch sehr fragil"*.

## 2. Die Dokumente (geprüft, nicht angenommen)

Alle 24 PDFs sind **reine Scans** (Canon iR-ADV, `pdftotext` = 0 Zeichen) — also ausschließlich
Vision-Strecke. 1–12 Seiten. Verteilung (per lokalem OCR ermittelt, nicht per LLM):
Elektro Braun 8 · UniElektro 7 · Sonepar 5 · Eldis 3 · **Wieland Electric 1** — letzterer ist
bewusst *kein* Hauptlieferant und damit der Fallback-Fall.

Realität in den Belegen: rote „ERLEDIGT"-Stempel quer über dem Text, Häkchen und Unterschriften,
Packstücklisten als eigene Seite, ein Scan, der nur Seite 1 eines zweiseitigen Belegs enthält — und
**handschriftliche Mengenkorrekturen**, die den gedruckten Wert überschreiben.

## 3. Aufbau des Piloten

Vier Extraktionsprojekte (eines je Lieferant) mit den Feldern aus den n8n-Schemata; die
lieferantenspezifischen Prompts wurden zu `instructions` destilliert (Fundort der Referenznummer,
„die Artikelnummer ist die siebenstellige mit 0 unter der Beschreibung", Packstücklisten sind keine
Positionen, handschriftliche Korrekturen gelten). Dazu je Projekt eine **Werteliste** auf `einheit`
(ST · M · KG · L mit Synonymen) und ein Feld `handschriftliche_aenderung`.

Ablauf je Beleg: Seite 1 rendern → `classifyPart` bestimmt den Lieferanten → Extraktion im passenden
Projekt (`vision-per-page`, Adacor Qwen 3.5) → flaches XLSX. Die Orchestrierung ist ein Skript —
genau das, was EMMA später über die Public-API macht; jede fachliche Leistung kommt aus dem Produkt.

## 4. Ergebnisse

### Klassifikation — alle 24 Belege

| | Ergebnis |
|---|---|
| Lieferant korrekt | **24/24 (100 %)**, jeweils Konfidenz 1.00 |
| Fremdlieferant (Wieland) | korrekt **abgelehnt**: kein Projekt, Konfidenz 0.00 |

### Extraktion — gelabelte Stichprobe (12 Belege, 39 Positionen)

Die Hälfte des Testsatzes ist manuell gelabelt: Sonepar 4 · Elektro Braun 4 · UniElektro 2 · Eldis 2.

| Feld | Treffer |
|---|---|
| Lieferscheinnummer | **12/12** |
| Lieferdatum | **12/12** |
| Referenznummer | **10/12** |
| Positionsanzahl exakt | **12/12** |
| Positionen wiedergefunden (Recall) | **39/39** |
| Erfundene Positionen | **0** |
| Menge bestellt | **39/39** |
| Menge geliefert | **39/39** |
| Einheit (nach Katalog-Angleichung) | **39/39** |

Über alle 24 Belege: **194 Positionen** aus 54 Seiten, kein Beleg mit Verarbeitungsfehler.

### Die schwierigen Fälle

- **Handschriftliche Mengenkorrektur** (der Punkt, den n8n selbst als fragil markiert): In
  `2923_001` ist die gedruckte „6" durchgestrichen, handschriftlich steht „2 stück geliefert" →
  extrahiert wurde **geliefert = 2** bei bestellt = 6. In `1904_001` steht neben „15 Stück" die
  handschriftliche Notiz „(1x falsch …) (14)" → extrahiert wurde **bestellt 15, geliefert 14**.
  Beide Male wurde zusätzlich `handschriftliche_aenderung = ja` gesetzt — **kein Fehlalarm** auf den
  übrigen 22 Belegen mit Häkchen und Unterschriften.
- **Packstückliste**: Seite 3 von `1900_001` enthält nur Packstück-Nummern → korrekt **keine**
  Positionen; der Beleg liefert exakt die 10 echten Positionen der Seiten 1–2.
- **Mehrseiter**: 12 Seiten (`2911_001`) → 41 Positionen, 7 Seiten (`2914_001`) → 36 Positionen,
  ohne Dubletten über die Seitengrenzen. `2915_001` (Eldis, 2 Seiten) traf alle 8 Positionen,
  obwohl Seite 2 nur eine einzelne Position plus Packmittel-Block enthält.
- **Gleiche Artikelnummer zweimal** (`2921_001`: Position 1 und 2 tragen beide `0432388`, mit
  Mengen 1 und 49): beide Positionen blieben erhalten — der Dedupe entfernt nur exakte Duplikate.
- **Interne Artikelnummer** (Sonepar: die siebenstellige unter der Beschreibung, nicht die lange
  daneben) — in allen geprüften Positionen korrekt getroffen.

### Die zwei Fehler

`1898_001` und `2921_001` (beide Sonepar): Die Referenznummer wurde **nicht gefunden** — `null` statt
`0275062` bzw. `0277637`. Beide Male hat das System sie nicht *falsch geraten*: die Feld-Konfidenz
war **0**. Bei den beiden anderen Sonepar-Belegen wurde sie korrekt erkannt; die Nummer steht dort
als nackte Zahl ohne Beschriftung über der ersten Position, was sie zur schwächsten Stelle macht.

Gegenprobe gemessen: Wird `referenznummer` als **Pflichtfeld** markiert, fängt die Review-Triage
**beide** Fälle (2/2) — Preis sind 2 zusätzliche Reviews über 23 Belege (19 auto_ok / 4 zu prüfen
statt 21/2). Das ist die Stellschraube, mit der Ehinger entscheidet, wie viel Nachkontrolle sie
wollen. Zusätzlich greift hier der Lern-Loop: Jede Korrektur an diesem Feld wird zum
Trainingsbeispiel, aus dem das Projekt eine Regel ableitet — n8n bräuchte dafür eine Prompt-Änderung
durch einen Entwickler.

### Betrieb

| | n8n heute | Pilot |
|---|---|---|
| LLM-Aufrufe | **5 je Seite** (2 Modelle) | **1 je Seite** + 1 Klassifikation + ≤ 2 Konfidenz je Beleg (gemessen: 3-seitiger Beleg = 5 Aufrufe gesamt) |
| 12-Seiten-Beleg | ~60 Aufrufe | ~15 Aufrufe |
| Laufzeit | — | **20 s je Beleg**, 8,6 s je Seite (7,8 min für alle 24) |
| Externe Dienste | pdf2image auf Railway | keine (poppler lokal) |
| Modell | mistral-3-24b + pixtral-12b | Adacor Qwen 3.5 Instruct (fest gebunden) |
| Token je Beleg | — | **≈ 8.700 (Einseiter)**, Ø **≈ 17.000** über den Testsatz (s. u.) |

### Token-Verbrauch (gemessen, nicht geschätzt)

Für acht Belege (1 · 1 · 1 · 1 · 2 · 3 · 7 · 12 Seiten) wurde die `usage`-Antwort **jedes** echten
Modellaufrufs mitgeschrieben (`tools/ehinger-pilot/tokens.ts`, Rohdaten `results/tokens.json`).
Je Beleg fallen **1 Klassifikation + 1 Vision-Aufruf je Seite + 2 Konfidenz-Aufrufe** an:

| Aufruf | Eingabe | Ausgabe | Anmerkung |
|---|---|---|---|
| Klassifikation (Bild, 150 dpi) | **2.728** | ~36 | konstant über alle Belege |
| Vision-Extraktion je Seite (Bild, 200 dpi) | **≈ 4.750** | 76 – 958 | Eingabe konstant, Ausgabe wächst mit der Positionszahl |
| Konfidenz (reiner Text, 2 Aufrufe) | 250 – 2.100 | ~20 | wächst mit der Positionszahl |

Daraus ergibt sich sehr genau linear (Abweichung < 1.100 Token über den Bereich 8k – 81k):

> **Token je Beleg ≈ 2.100 + 6.580 × Seitenzahl**

- **Einseitiger Lieferschein: ≈ 8.700 Token** (8.400 Eingabe / 300 Ausgabe) — das ist der Median-Fall,
  die Hälfte der Testbelege hat eine Seite.
- **Mittel über den echten Belegmix** (24 Belege, 54 Seiten, Ø 2,25 Seiten): **≈ 17.000 Token je Beleg**,
  in Summe ≈ 406.000 Token für den gesamten Testsatz. Der Mittelwert liegt deutlich über dem Median,
  weil zwei Ausreißer (7 und 12 Seiten) ihn nach oben ziehen.
- **95 % davon sind Eingabe.** Gegengemessen mit denselben Prompts *ohne* Bild: der Vision-Prompt
  (System + Schema + Projekt-Anweisungen) kostet **1.026 Token**, der Klassifikations-Prompt über alle
  vier Projekte **580** — der Rest ist Bild. Also **≈ 3.720 Token je Seitenbild bei 200 dpi** und
  ≈ 2.150 bei 150 dpi; deren Verhältnis 1,73 entspricht dem Flächenverhältnis (200/150)² = 1,78, was
  beide Messungen gegenseitig bestätigt. Der Verbrauch skaliert damit praktisch mit **Seiten und
  Auflösung**, nicht mit der Prompt-Länge: 200 → 150 dpi würde je Seite rund 1.570 Token sparen
  (−24 % je Beleg), ist aber vor einer Absenkung an der Trefferquote zu messen.
- **Vergleich n8n:** Dort geht dasselbe Seitenbild in **vier** der fünf Aufrufe je Seite (Klassifikation,
  Freitext-Extraktion, Pixtral-Zweitmodell, QA-LLM). Allein die Bild-Eingabe liegt damit bei rund dem
  Vierfachen unseres Werts; hinzu kommt die Klassifikation je Seite statt einmal je Beleg.
- Läuft der Eingang über den Posteingang **mit** Trennung, kommt je Seitenübergang ein weiterer
  Bildaufruf hinzu — mit `split=false` (der Ehinger-Fall: eine Datei = ein Lieferschein) entfällt er.

## 5. Was der Pilot im Produkt gefunden hat

**Listen-Spalten fehlten im Vision-Prompt** (behoben). Die Vision-Strategie rendert das Zielschema
als Freitext-JSON — und gab für Listen-Felder nur `"positionen": []` aus, **ohne die Spalten**. Das
Modell erfand daraufhin eigene Schlüssel (`artikel_nr`, `details`, `menge` inkl. Einheit im Text),
die weder Merger noch Katalog- und Regelprüfung wiederfinden. Messbar: `1903_001` lieferte **1 statt
2 Positionen**, `1899_001` fremde Spaltennamen. Nach dem Fix (Spalten samt Labels und Hinweisen im
Prompt): 2/2 bzw. 10/10 Positionen mit korrekten Feldern. Betroffen war jede Vision-Extraktion mit
Positionsdaten — also genau die Scan-Strecke, die dieser Kunde braucht.

## 6. Die drei Lücken — geschlossen (2026-08-05)

| Lücke | Umsetzung | Verifiziert |
|---|---|---|
| **Flacher XLSX-Export** | `export.xlsx?format=flat` und Eintrag „Excel flach" im Export-Menü: EIN Blatt, eine Zeile je Position, Belegdaten wiederholt, dazu Spalten „Pruefung" und „Befunde". Gemeinsamer Baustein `learning/export-xlsx.ts` für Route und API. | 7 Unit-Tests; erzeugte Datei mit 10 Positionszeilen geprüft |
| **XLSX über die Public-API** | Neue Function `extraktion/batch.export` (`format: flat\|grouped`, Default flach) liefert die Datei base64-kodiert samt Zeilenzahl. | über die API abgerufen, Datei als „Microsoft Excel 2007+" verifiziert, Inhalt gelesen |
| **Eingang ohne Split** | `split=false` am Upload (UI: Häkchen „Sammel-Scans an Dokumentgrenzen trennen", Default an) — ein Upload = ein Dokument, kein Seitenpaar-Urteil, also auch keine LLM-Aufrufe je Seitenübergang. | 3-seitiger Beleg → **1 Teil (Seiten 1–3)**, korrekt klassifiziert und geroutet |

Nebenbefund zum Splitter: Derselbe 3-Seiter **mit** Trennung ergab ebenfalls nur einen Teil — der
konservative Splitter hat den mehrseitigen Lieferschein also nicht zerschnitten. Das war das Risiko,
das den Schalter motiviert hat; auf diesem Beleg trat es nicht ein.

Nicht nachgebaut: der **Zweitmodell-Abgleich** und die **QA-LLM-Schicht**. Beide sind in n8n
stochastische Prüfungen einer stochastischen Extraktion. Unser Gegenstück ist deterministisch
(Feld-Konfidenz, Wertelisten, Prüfregeln, Review-Triage) und hat beide Fehler als unsicher erkannt —
eskaliert wird, sobald das Feld als Pflichtfeld geführt wird. Sollte Ehinger den Zweitmodell-Abgleich
fachlich wollen, ist er als Feature vorzuschlagen und zu bepreisen, nicht stillschweigend nachzubauen.

## 7. Empfehlung

**Der Umstieg ist fachlich tragfähig.** Die Strecke erreicht auf den Testbelegen das Ziel des
n8n-Workflows, löst dessen erklärte Schwachstelle (Handschrift) korrekt und kostet deutlich weniger
Modellaufrufe. Dazu kommen Fähigkeiten, die n8n nicht hat: der Lern-Loop (Korrekturen im Betrieb
verbessern das Projekt, statt dass ein Entwickler Prompts nachzieht), die Review-Oberfläche mit
Fundstellen, Wertelisten und Prüfregeln, Audit je Ergebnis sowie API + signierter Webhook.

Erledigt seit der ersten Fassung: die drei Lücken sind geschlossen, die Ground Truth von 6 auf
**12 Belege** (halber Testsatz, 39 Positionen) verdoppelt — die Ergebnisse haben sich dabei nicht
verschlechtert.

Offen vor einem Produktivpiloten bei Ehinger:
1. Mit Ehinger festlegen, welche Felder Pflicht sind — das steuert die Review-Quote (s. o.: mit
   `referenznummer` als Pflichtfeld werden beide Fehler gefangen, bei 4 statt 2 Reviews auf 23 Belegen).
2. Erste Wochen im Parallelbetrieb: EMMA schickt an beide Strecken, Abweichungen werden verglichen —
   der Lern-Loop nimmt die Korrekturen direkt auf und verbessert die schwache Stelle
   (Sonepar-Referenznummer) ohne Entwicklereingriff.
3. Die restlichen 12 Belege labeln, wenn eine belastbarere Zahl gebraucht wird — die vorliegenden 12
   sind ein starkes Signal, aber kein statistischer Beweis.
