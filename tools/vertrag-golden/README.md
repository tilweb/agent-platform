# Vertrag-Golden (lokal)

Messbestand für die DP-Strategie `contract-structured`. Die Verträge selbst und die Erwartungswerte enthalten
Kundendaten und liegen **nicht im Repo**:

- Verträge: lokaler Ordner (Default `~/Downloads/Vertragsbeispiele-Ehinger-END`, Option `--ordner`)
- Erwartungswerte: `erwartet/V<n>.json` (gitignored)
- Cache und Ergebnisse: `out/` (gitignored)

Messung: `cd backend && bun run scripts/vertrag-pilot/messung.ts` (siehe Kopf des Skripts).
