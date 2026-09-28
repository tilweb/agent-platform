# Antragsprüfungs-Apps (`backend/src/apps/antragspruefung/`)

Familie von Apps, die Sozialleistungsanträge prüfen. Alles, was sie brauchen und teilen, liegt in
diesem Ordner (im Frontend spiegelbildlich unter `frontend/src/apps/antragspruefung/`). Zentral
bleiben nur Schema/Migrationen (`db/schema/`, `drizzle/`), Registry, Routen-Einhängung und die
Dokumentprofil-Vorlagen (`extraction/templates/`).

**Zuerst lesen:** `docs/antragspruefung-muster.md` (verbindliches Muster: Datenmodell, Prüfschritte,
Posteingang, Oberfläche, Governance-Pflichten, Konformitätstests, Vorrang).

Bausteine:

- `kern/` — gemeinsamer, **fachfreier** Kern (Audit, KI-Verbrauch, Rollen/Gates,
  Aufbewahrung, Feldstatus, Notizen, Posteingang-Warteschlange). Keine Fachbegriffe, keine Importe
  aus Apps (Wächter `fachfrei.test.ts`). Änderungen wirken in allen Antrags-Apps.
- `vorrang/` — Fachlogik, die genau Wohngeld und Grundsicherung teilen (Grunddaten-Vertrag,
  Arten-Listen, Altersgrenze § 41 SGB XII). Vertrags-Test `vertrag.test.ts`.
- `<app>/` — Fachlichkeit als eigener Code: `types.ts` (inkl. DokumentAnalyse-Vertrag),
  `checker/` (Regeln + Katalog), `dp-erkennung.ts`, `routes/`, Adapter auf den Kern.

Grundsätze:

- **Keine Berechnung** von Zahlbeträgen — die App prüft Vollständigkeit und Plausibilität.
- **Mensch entscheidet.** KI liefert Vorschläge mit Review-Gate, nie Entscheidungen.
- **Regeln sind Code** mit Tests; das Modell liest nur aus und formuliert. Nicht erkannt ⇒ weglassen, nie raten.
- **Apps importieren einander nicht.** Gemeinsames → `kern` (fachfrei) oder `vorrang`.
- Jede Schreibroute ruft `audit`, prüft Editor-Gate und Einschränkung (Art. 18); jede LLM-Aktion
  läuft in `messeKiVerbrauch`.
- Neue App startet mit `enabled: false`.

Wächter- und Konformitätstests (müssen grün bleiben):

- `<app>/konformitaet.test.ts` — Audit, KI-Messung, Einschränkung, keine Fremd-Importe
  (Helfer `kern/konformitaet.ts`). Ausnahmen nur mit Begründung; echte Abweichungen als
  `OFFENE_VERSTOESSE`, nie still in die Ausnahmeliste.
- `<app>/checker/regeln.test.ts` (jede Regel beschrieben), Goldfälle, `kern/fachfrei.test.ts`,
  `vorrang/vertrag.test.ts`.

Änderungsdisziplin: Ändert sich an einer Antrags-App etwas Muster-Relevantes (UX, Ablauf,
Governance, Posteingang), prüfen, ob die andere App nachgezogen werden muss oder es in den Kern
gehört. Im `CHANGELOG.md` als **„Muster-Änderung"** markieren; Muster-Dokument aktualisieren.
