# Workplace-Apps (`backend/src/apps/`)

Jede App liegt in einem eigenen Ordner mit `index.ts` (Registry-Eintrag) und eigenen Routen.
Gemeinsam für alle Apps: `registry.ts`, `permissions*.ts`, `types.ts`. Familien-Ordner (z. B.
`antragspruefung/`) bündeln mehrere Apps mit ihrem geteilten Code; jede Familie bleibt in sich abgeschlossen.

Befehle (im Ordner `backend/`, Bun ist nicht im PATH):

- Tests: `/Users/andreasbachmann/.bun/bin/bun test src/apps/<app>` (alles: `src/apps src/services src/extraction`)
- Typecheck: `node_modules/.bin/tsc --noEmit -p .` (es gibt Altfehler; keine neuen hinzufügen)

Antragsprüfungs-Apps (Wohngeld, Grundsicherung) liegen gemeinsam unter `antragspruefung/` — dort gilt
`antragspruefung/CLAUDE.md`.
