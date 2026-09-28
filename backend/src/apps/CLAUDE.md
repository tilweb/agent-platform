# Workplace-Apps (`backend/src/apps/`)

Jede App liegt in einem eigenen Ordner mit `index.ts` (Registry-Eintrag) und eigenen Routen.
Gemeinsam für alle Apps: `registry.ts`, `permissions*.ts`, `types.ts`. Ordner mit `_`-Präfix sind
keine Apps, sondern geteilter Code.

Befehle (im Ordner `backend/`, Bun ist nicht im PATH):

- Tests: `/Users/andreasbachmann/.bun/bin/bun test src/apps/<app>` (alles: `src/apps src/services src/extraction`)
- Typecheck: `node_modules/.bin/tsc --noEmit -p .` (es gibt Altfehler; keine neuen hinzufügen)

## Antragsprüfungs-Apps (wohngeld, grundsicherung)

Gilt nur für Apps, die Sozialleistungsanträge prüfen. Andere Apps (vertragsmanagement, echoloop,
projektmanagement …) sind davon nicht betroffen.

**Zuerst lesen:** `docs/antragspruefung-muster.md` (verbindliches Muster: Datenmodell, Prüfschritte,
Posteingang, Oberfläche, Governance-Pflichten, Konformitätstests, Vorrang).

Bausteine:

- `_antrag-kern/` — gemeinsamer, **fachfreier** Kern (Audit, KI-Verbrauch, Rollen/Gates,
  Aufbewahrung, Feldstatus, Notizen, Posteingang-Warteschlange). Keine Fachbegriffe, keine Importe
  aus Apps (Wächter `fachfrei.test.ts`). Änderungen wirken in allen Antrags-Apps.
- `_vorrang/` — Fachlogik, die genau Wohngeld und Grundsicherung teilen (Grunddaten-Vertrag,
  Arten-Listen, Altersgrenze § 41 SGB XII). Vertrags-Test `vertrag.test.ts`.
- `<app>/` — Fachlichkeit als eigener Code: `types.ts` (inkl. DokumentAnalyse-Vertrag),
  `checker/` (Regeln + Katalog), `dp-erkennung.ts`, `routes/`, Adapter auf den Kern.

Grundsätze:

- **Keine Berechnung** von Zahlbeträgen — die App prüft Vollständigkeit und Plausibilität.
- **Mensch entscheidet.** KI liefert Vorschläge mit Review-Gate, nie Entscheidungen.
- **Regeln sind Code** mit Tests; das Modell liest nur aus und formuliert. Nicht erkannt ⇒ weglassen, nie raten.
- **Apps importieren einander nicht.** Gemeinsames → `_antrag-kern` (fachfrei) oder `_vorrang`.
- Jede Schreibroute ruft `audit`, prüft Editor-Gate und Einschränkung (Art. 18); jede LLM-Aktion
  läuft in `messeKiVerbrauch`.
- Neue App startet mit `enabled: false`.

Wächter- und Konformitätstests (müssen grün bleiben):

- `<app>/konformitaet.test.ts` — Audit, KI-Messung, Einschränkung, keine Fremd-Importe
  (Helfer `_antrag-kern/konformitaet.ts`). Ausnahmen nur mit Begründung; echte Abweichungen als
  `OFFENE_VERSTOESSE`, nie still in die Ausnahmeliste.
- `<app>/checker/regeln.test.ts` (jede Regel beschrieben), Goldfälle, `_antrag-kern/fachfrei.test.ts`,
  `_vorrang/vertrag.test.ts`.

Änderungsdisziplin: Ändert sich an einer Antrags-App etwas Muster-Relevantes (UX, Ablauf,
Governance, Posteingang), prüfen, ob die andere App nachgezogen werden muss oder es in den Kern
gehört. Im `CHANGELOG.md` als **„Muster-Änderung"** markieren; Muster-Dokument aktualisieren.
