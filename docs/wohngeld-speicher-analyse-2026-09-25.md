# Wohngeld — Speicherbedarf der Auswertung (Messung, 2026-09-25)

## Anlass
workplace-demo (Container M, 512 MB) ist wiederholt mit „memory quota exceeded" abgestürzt
(24.09. 15:59 und 21:51, 25.09. 15:10 — letzterer mitten in einer Posteingang-Auswertung).
Stand im Leerlauf 25 min nach Neustart: 393 MiB RSS + 116 MiB Swap (90 %), Höchststand 529 MiB.

## Messung (lokal, Bun 1.3.7, Adacor Qwen 3.5)

| | vorher | nach Korrektur |
|---|---|---|
| Speicher vor der Auswertung (nach Profil laden) | 814 MB | 84–87 MB |
| Spitze während der Auswertung F25 (24 S.) | 882 MB | 219 MB |
| Spitze während der Auswertung F29 (42 S.) | — | 213 MB |
| Zuwachs durch die Auswertung selbst | — | ~130 MB, kaum abhängig von der Seitenzahl |
| Server im Leerlauf (voller Backend-Start) | — | 226 MB nach Start, ~134 MB nach GC |

## Ursache (gefunden)
`ladeProfil()` gab alle Beispiele des Profils an jede Auswertung — auch den Testbestand
(60 Golden-Fälle) mit den Original-PDFs als base64: **410 MB JSON je Auswertung**. Testbeispiele werden für
die Auswertung nicht gebraucht (nur für die Eval der DP-Oberfläche).

Korrektur: neue Plattform-Abfrage `getExtractionExamples()` (ohne Testbestand, Originaldateien per SQL
entfernt); `ladeProfil()` nutzt sie; zusätzlich Filter `fuerAuswertung()`. Die Eval der DP-Oberfläche lädt
weiterhin alles (`getExamples()`).

Hinweis: Auf workplace-demo gibt es keinen Testbestand — dort erklärt dieser Befund die Abstürze nur,
sobald Beispiele im Profil liegen (Testbestand, Lernbeispiele). Er betrifft jede Instanz, auf der das
Profil gepflegt wird, und ebenso die Plattform-Funktion `extract()` ohne Snapshot (lädt `getExamples()`).

## Verbleibendes Risiko auf M-Containern
Leerlauf ~135–230 MB + Auswertung ~130 MB + pdftocairo-Unterprozesse (zählen zum Container) + Seitenvorschau.
Eine einzelne Auswertung passt in 512 MB; zwei parallel (Posteingang + Upload im Vorgang) oder
zurückgehaltener Speicher nach mehreren Läufen (RSS sinkt bei Bun nicht sofort) können knapp werden —
passt zum beobachteten Leerlauf von 393 MiB + Swap auf der Demo.

## Empfehlungen
1. Korrektur ausrollen (dieser Commit) — beseitigt den großen Ausreißer.
2. Auf der Demo nach dem Ausrollen `scalingo --app workplace-demo stats` beobachten (Leerlauf, Höchststand).
3. Falls weiter knapp: gleichzeitige Auswertungen auf eine begrenzen (Posteingang-Warteschlange gibt es schon;
   Upload im Vorgang anschließen) oder Container L für Instanzen mit Document Processing.
4. Plattform (Übergabe an das Produktteam): `extract()` ohne Snapshot sollte ebenfalls `getExtractionExamples()` nutzen.
