# DP-Qualitätssuite

Misst die Document-Processing-Qualität über den echten `extract()`-Pfad gegen einen annotierten Korpus und vergleicht
mit einer Baseline. Harte Schwelle vor Kunden-Deploys, Smoke vor Demo-Pushes.

- Spezifikation: `docs/dp-qualitaetssuite-spec-2026-10-09.md`
- Korpus (Dokumente, Erwartungen, Baseline, Berichte) liegt **außerhalb des Repos** — enthält Kunden- und
  Personendaten. Pfad über `DP_KORPUS`, Standard `~/Documents/Development/AgentWork/dp-qualitaet-korpus`.
  Bedienung (Annotation, Lauf, Bericht lesen, Umgang mit Ausfällen): `README.md` im Korpusordner.

| Skript | Zweck |
|---|---|
| `lauf.ts` | Lauf über alle/ausgewählte Sets, Bericht, Baseline-Vergleich (Exit 1 bei Verschlechterung) |
| `export.ts` | Testbeispiele eines DP-Profils (Prüfdialog → „Als unabhängiges Testbeispiel speichern") als Set exportieren |
| `import-vertraege.ts` | Einmalige Übernahme der Vertrags-Pilotfälle |
| `lib/` | Korpusformat, Bewertung, Bericht/Schwelle (Tests: `bun test scripts/dp-qualitaet`) |

```sh
cd backend
PATH=/opt/homebrew/bin:$PATH /Users/andreasbachmann/.bun/bin/bun run scripts/dp-qualitaet/lauf.ts --umfang smoke   # Smoke
PATH=/opt/homebrew/bin:$PATH /Users/andreasbachmann/.bun/bin/bun run scripts/dp-qualitaet/lauf.ts                  # voll
PATH=/opt/homebrew/bin:$PATH /Users/andreasbachmann/.bun/bin/bun run scripts/dp-qualitaet/lauf.ts --als-baseline --wiederholungen 3
```
