# Ehinger-Lieferscheine: n8n-Workflow vs. Extraktionsfeature — gemessener Vergleich

**Datum:** 2026-08-04
**Anlass:** Bei Kunde Ehinger lädt EMMA (RPA) gescannte Lieferscheine in einen n8n-Workflow, der
klassifiziert, extrahiert, prüft und ein XLSX zurückgibt. Frage: Erreicht unser Extraktionsfeature
dasselbe Ziel in gleicher oder besserer Qualität?
**Antwort:** Ja — auf den gemessenen Belegen mit **einem Fehler in 6 gelabelten Dokumenten**, bei
**einem Drittel der LLM-Aufrufe** und ohne externe Dienste. Zwei Produktlücken sind zu schließen,
eine davon wurde durch den Piloten überhaupt erst gefunden und ist bereits behoben.

**Pilot:** `tools/ehinger-pilot/` (Projekte, Ground Truth, Lauf, Messung) · Rohdaten:
`tools/ehinger-pilot/results/` · Testbelege: `docs/Ehinger/` (24 Scans, 54 Seiten)

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

### Extraktion — gelabelte Stichprobe (6 Belege, 22 Positionen, alle vier Lieferanten)

| Feld | Treffer |
|---|---|
| Lieferscheinnummer | **6/6** |
| Lieferdatum | **6/6** |
| Referenznummer | **5/6** |
| Positionsanzahl exakt | **6/6** |
| Positionen wiedergefunden (Recall) | **22/22** |
| Erfundene Positionen | **0** |
| Menge bestellt | **22/22** |
| Menge geliefert | **22/22** |
| Einheit (nach Katalog-Angleichung) | **22/22** |

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
  ohne Dubletten über die Seitengrenzen.
- **Interne Artikelnummer** (Sonepar: die siebenstellige unter der Beschreibung, nicht die lange
  daneben) — in allen geprüften Positionen korrekt getroffen.

### Der eine Fehler

`1898_001`: Die Referenznummer `0275062` wurde **nicht gefunden** (null statt Wert). Wichtig: Das
System hat sie nicht *falsch geraten* — die Feld-Konfidenz war **0**. Mit der Konfiguration des
Piloten (Referenznummer optional) blieb der Beleg trotzdem `auto_ok`. Gegenprobe gemessen: Wird das
Feld als **Pflichtfeld** markiert, kippt genau dieser Beleg auf „zu prüfen" — Preis sind
2 zusätzliche Reviews über 23 Belege (19 auto_ok / 4 zu prüfen statt 21/2). Das ist die Stellschraube,
mit der Ehinger entscheidet, wie viel Nachkontrolle sie wollen.

### Betrieb

| | n8n heute | Pilot |
|---|---|---|
| LLM-Aufrufe | **5 je Seite** (2 Modelle) | **1 je Seite** + 1 Klassifikation + ≤ 2 Konfidenz je Beleg (gemessen: 3-seitiger Beleg = 5 Aufrufe gesamt) |
| 12-Seiten-Beleg | ~60 Aufrufe | ~15 Aufrufe |
| Laufzeit | — | **20 s je Beleg**, 8,6 s je Seite (7,8 min für alle 24) |
| Externe Dienste | pdf2image auf Railway | keine (poppler lokal) |
| Modell | mistral-3-24b + pixtral-12b | Adacor Qwen 3.5 Instruct (fest gebunden) |

## 5. Was der Pilot im Produkt gefunden hat

**Listen-Spalten fehlten im Vision-Prompt** (behoben). Die Vision-Strategie rendert das Zielschema
als Freitext-JSON — und gab für Listen-Felder nur `"positionen": []` aus, **ohne die Spalten**. Das
Modell erfand daraufhin eigene Schlüssel (`artikel_nr`, `details`, `menge` inkl. Einheit im Text),
die weder Merger noch Katalog- und Regelprüfung wiederfinden. Messbar: `1903_001` lieferte **1 statt
2 Positionen**, `1899_001` fremde Spaltennamen. Nach dem Fix (Spalten samt Labels und Hinweisen im
Prompt): 2/2 bzw. 10/10 Positionen mit korrekten Feldern. Betroffen war jede Vision-Extraktion mit
Positionsdaten — also genau die Scan-Strecke, die dieser Kunde braucht.

## 6. Lücken zum Produktivbetrieb

| Lücke | Aufwand |
|---|---|
| **Flacher XLSX-Export** (eine Zeile je Position, Kopfdaten wiederholt). Heute: Hauptblatt + Zusatzblatt ohne Kopfdaten. Im Piloten über `flat.ts` erzeugt. | klein (Export-Variante im bestehenden `export.xlsx`) |
| **XLSX über die Public-API** — `export.xlsx` hängt an der Session-Auth; die API kennt keine Export-Function. | klein (eine Function + base64) |
| **Eingang ohne Split** — der Posteingang trennt Mehrseiter immer an vermuteten Dokumentgrenzen; hier gilt „ein Upload = ein Lieferschein". | mittel (Modus-Schalter am Upload) |

Nicht nachgebaut: der **Zweitmodell-Abgleich** und die **QA-LLM-Schicht**. Beide sind in n8n
stochastische Prüfungen einer stochastischen Extraktion. Unser Gegenstück ist deterministisch
(Feld-Konfidenz, Wertelisten, Prüfregeln, Review-Triage) und hat im Piloten den einzigen Fehler
erkannt — nur nicht eskaliert, weil das Feld als optional konfiguriert war. Sollte Ehinger den
Zweitmodell-Abgleich fachlich wollen, ist er als Feature vorzuschlagen und zu bepreisen, nicht
stillschweigend nachzubauen.

## 7. Empfehlung

**Der Umstieg ist fachlich tragfähig.** Die Strecke erreicht auf den Testbelegen das Ziel des
n8n-Workflows, löst dessen erklärte Schwachstelle (Handschrift) korrekt und kostet deutlich weniger
Modellaufrufe. Dazu kommen Fähigkeiten, die n8n nicht hat: der Lern-Loop (Korrekturen im Betrieb
verbessern das Projekt, statt dass ein Entwickler Prompts nachzieht), die Review-Oberfläche mit
Fundstellen, Wertelisten und Prüfregeln, Audit je Ergebnis sowie API + signierter Webhook.

Vor einem Produktivpiloten bei Ehinger:
1. Die drei Lücken schließen (klein bis mittel).
2. Ground Truth auf ~30 Belege erweitern — 6 gelabelte Dokumente sind ein Signal, kein Beweis;
   insbesondere Elektro Braun und Eldis sind mit je einem gelabelten Beleg dünn vertreten.
3. Mit Ehinger festlegen, welche Felder Pflicht sind (steuert die Review-Quote, s. o.).
4. Erste Wochen im Parallelbetrieb: EMMA schickt an beide Strecken, Abweichungen werden verglichen —
   der Lern-Loop nimmt die Korrekturen direkt auf.
