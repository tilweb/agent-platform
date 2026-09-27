# OCR-Pilot Stufe A — offene OCR-Modelle gegen den Wohngeld-Golden-Dataset (2026-09-27)

## Kontext

Das DP-Dienst-Konzept (`konzept-document-processing-dienst-2026-09-25.md`, §14/§14a) sieht ein eigenes OCR-Sprachmodell
vor der Extraktion vor. Stufe A misst die Kandidaten isoliert: Wie gut lesen sie gescannte Antragsseiten und Nachweise?
Stufe B (offen) speist den besten OCR-Text in die Extraktion und vergleicht das Endergebnis.

## Messaufbau

- Skript: `backend/scripts/ocr-pilot/stufe-a.ts` (Metriken in `metriken.ts`, Tests daneben)
- Stichprobe: 8 Fälle (F01 F03 F05 F09 F13 F17 F22 F27), 92 Seiten — je Antrag Seiten 1, 2, 5, 10 und die erste Seite jedes Nachweises.
  Handschrift-Anträge: F03, F09, F13, F22.
- Eingabe: Scan-Fassung, 150 dpi PNG, ganze Seite, Trainings-Prompt der Modellfamilie, Temperatur 0.
- Referenz: Textlayer derselben Seite der digitalen Fassung. Vergleich als Wort-Multimenge (reihenfolgeunabhängig).
- Kennzahlen: Wort-Recall (Vollständigkeit), Wort-Präzision (kein Müll/keine Wiederholung), Zahlen-Recall (Tokens mit Ziffern:
  Beträge, Daten, IBAN, PLZ), Schleifen (Zeile deutlich öfter als in der Referenz oder Ausgabe > 2× Seitenlänge), Median-Zeit.
- Hardware: MacBook M4 Pro, 48 GB. Laufzeiten: Ollama (F16), LM Studio (LightOnOCR, DeepSeek-OCR-2 als MLX bf16),
  llama.cpp `llama-server` (PaddleOCR-VL GGUF + mmproj; LM Studio koppelt dessen Vision-Encoder nicht).

## Ergebnis

| Modell | Größe | Wort-Recall | Wort-Präzision | Zahlen-Recall | Schleifen | Median Zeit/Seite |
|---|---|---|---|---|---|---|
| **LightOnOCR-2-1B** | 1B | **93,1 %** | 93,1 % | **98,3 %** | 0/92 | 9,6 s |
| **GLM-OCR** | 1,1B | 90,8 % | **96,1 %** | 96,5 % | 0/92 | 10,6 s |
| DeepSeek-OCR-2 | 3B | 87,2 % | 81,2 % | 90,8 % | 9/92 | 6,7 s |
| DeepSeek-OCR (v1) | 3B | 84,3 % | 48,0 % | 83,3 % | 14/92 | 8,1 s |
| PaddleOCR-VL-1.6 | 0,9B | 83,5 % | 34,5 % | 83,7 % | 14/92 | 5,3 s |

Teilmengen Zahlen-Recall (Antrag maschinell / Antrag Handschrift / Nachweise):

| Modell | maschinell | Handschrift | Nachweise |
|---|---|---|---|
| LightOnOCR-2-1B | 99,6 % | 97,9 % | 98,2 % |
| GLM-OCR | 96,7 % | 95,9 % | 96,6 % |
| DeepSeek-OCR-2 | 81,0 % | 85,1 % | 92,9 % |
| DeepSeek-OCR (v1) | 83,1 % | 80,5 % | 83,7 % |
| PaddleOCR-VL-1.6 | 89,7 % | 85,1 % | 82,7 % |

## Bewertung

- **LightOnOCR-2-1B und GLM-OCR** sind klar vorn: keine einzige Schleife, Zahlen-Recall 96–98 %, Handschrift kaum schlechter als Druck.
  Beide ~1B Parameter → auf einer kleinen GPU (oder CPU-lastig) betreibbar. Lizenz: beide Apache 2.0 / MIT (siehe Konzept §14a).
- **DeepSeek-OCR-2** ist deutlich besser als v1, aber Formularseiten (Kästchen, viele Leerfelder) lösen weiter Schleifen aus.
  Auf einfachen Nachweisen nahe an den beiden Spitzenreitern.
- **DeepSeek-OCR v1 und PaddleOCR-VL** scheiden im Ganzseiten-Modus aus: jede siebte Seite läuft in eine Wiederholung
  (Paddle wiederholt ganze Blöcke). Paddle ist für seine Pipeline mit vorgeschalteter Layout-Erkennung gebaut und wird hier
  benachteiligt — ein fairer Test bräuchte PP-DocLayout davor; lohnt angesichts der beiden Spitzenreiter derzeit nicht.
- Wort-Recall endet bei ~91–93 %, weil die Referenz Kleingedrucktes/Fußzeilen enthält; entscheidend ist der Zahlen-Recall.
- Zeiten sind zwischen Laufzeiten (Ollama/MLX/llama.cpp) nur grob vergleichbar; auf Server-GPU deutlich schneller.

## Nächster Schritt (Stufe B)

LightOnOCR-2-1B und GLM-OCR als Text-Vorstufe in die Extraktion (`wohngeld-eingang`-Profil) einspeisen und mit der
heutigen Vision-Extraktion (Mistral 3 24B) auf den Scan-Fassungen vergleichen: Feldgenauigkeit, Zuschnitte, Laufzeit.
Offene Frage dabei: Welche der ~2–4 % fehlenden Zahlen sind extraktionsrelevant (Beträge, Daten) und welche Rauschen.

## Reproduzieren

```sh
cd backend && export PATH=/opt/homebrew/bin:$PATH
bun run scripts/ocr-pilot/stufe-a.ts --liste
bun run scripts/ocr-pilot/stufe-a.ts --modell ollama:glm-ocr:latest --modell lmstudio:lightonocr-2-1b
bun run scripts/ocr-pilot/stufe-a.ts --nur-auswertung --modell ...   # Auswertung aus dem Cache
```
PaddleOCR-VL: `llama-server -m <…GGUF.gguf> --mmproj <…mmproj.gguf> --port 8090 -c 16384 --temp 0`, dann `--modell llamacpp:paddleocr-vl-1.6`.
Ergebnisse/Cache: `tools/wohngeld-golden/out/ocr-pilot/` (nicht versioniert).
