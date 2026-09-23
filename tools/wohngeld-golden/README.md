# Wohngeld Golden Dataset — Generator

Erzeugt synthetische Wohngeld-Anträge (Mietzuschuss) als **Sammel-PDFs** mit
Erwartungsdatei, um Split, Klassifikation, Extraktion und Prüfregeln der
Wohngeld-App zu messen. Fallkatalog und Hintergrund:
`docs/wohngeld-golden-dataset-fallkatalog-2026-09-23.md`.

## Voraussetzungen

- Bun, poppler (`pdftocairo`, `pdftotext`, `pdfinfo`), Google Chrome
  (HTML→PDF, Pfad über `CHROME_BIN` änderbar)
- Amtliche Vorlagen lokal unter `docs/wohngeld/synth-antraege/` (nicht eingecheckt)
- `bun install` in diesem Ordner. `pdf-lib` lebt bewusst hier und **nicht** im
  Backend (würde dort die Lockfile-Auflösung von `tslib` verändern).

## Benutzung

```sh
bun run src/cli.ts              # alle registrierten Fälle, digital + scan
bun run src/cli.ts F18 F30      # ausgewählte Fälle
bun run src/cli.ts --ohne-scan  # nur digitale Variante
bun test                        # Konsistenz der erzeugten PDFs gegen die Erwartung
```

Ausgabe:

| Pfad | Inhalt | Eingecheckt |
|---|---|---|
| `out/<Fall>/<Fall>-digital.pdf` | Sammel-PDF mit Textebene | nein |
| `out/<Fall>/<Fall>-scan.pdf` | gerastert, schief, ohne Textebene | nein |
| `expected/<Fall>.expected.json` | Erwartung: Dokumentgrenzen, Typen, Feldwerte, Befunde | ja |

## Aufbau

- `src/faelle/` — eine Datei je Fall (einzige Datenquelle), Registrierung in `index.ts`
- `src/formulare/` — amtliche Formulare ausfüllen (pdf-lib), flach machen, Unterschrift zeichnen
- `src/nachweise/` — synthetische Nachweise als HTML-Vorlagen (Chrome-Druck, Cache in `out/.cache`)
- `src/zusammensetzen.ts` — Sammel-PDF inkl. Störungen (fehlende/doppelte Seiten, quer)
- `src/scan.ts` — Scan-Variante
- `src/erwartung.ts` — Erwartungsdatei

## Neuen Fall anlegen

1. `src/faelle/Fxx.ts` nach dem Muster von F01/F18/F30 anlegen und in `index.ts` registrieren.
2. Fehlt eine Dokumentart, Generator unter `src/nachweise/` ergänzen und in
   `zusammensetzen.ts` einhängen.
3. `bun run src/cli.ts Fxx && bun test`, dann Seiten stichprobenartig ansehen.

Alle Dokumente sind synthetisch (PDF-Metadaten „SYNTHETISCH"). Namen, Anschriften,
Arbeitgeber und Kontonummern sind erfunden.
