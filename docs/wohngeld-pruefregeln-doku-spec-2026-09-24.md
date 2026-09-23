# Wohngeld — Prüfregeln als aufrufbare Dokumentation (Spec, 2026-09-24)

## Kontext

Die App erzeugt Prüfschritte aus festen Regeln (`checker/nachweise.ts`, `checker/plausibilitaet.ts`). Für die
Sachbearbeitung ist heute nur der Titel und ein fallbezogener Beleg sichtbar — nicht, *welche Regel* dahinter steht,
*wann* sie greift und *wie* man den Schritt erledigt. Der Regelkatalog in `docs/` ist handgeschrieben und hinkt dem
Code hinterher. Ziel: eine Regelbeschreibung, die **im Code neben den Regeln lebt** und in der App aufrufbar ist.

Nutzen: Nachvollziehbarkeit für die Sachbearbeitung (falsche Meldungen als solche erkennen), fachliche Abnahme durch
eine Pilotkommune ohne Code, Transparenz automatisierter Hinweise (GOV-3, AI Act Art. 13).

## Entscheidungen

1. **Eine Quelle:** `backend/src/apps/wohngeld/checker/regeln.ts` beschreibt jede Regel-ID: Titel, Kategorie
   (Vollständigkeit/Plausibilität), Typ (Anforderung/Hinweis), Bezug (Vorgang/Person/Dokument), Themengruppe,
   **Auslöser** in Klartext, geforderter **Nachweis**, **Rechtsgrundlage**, **Erledigung** und **Hinweise zur
   Anwendung** (bekannte Grenzen, ehrlich formuliert — z. B. „prüft nur das erste Mietdokument").
   Die Prüflogik bleibt unverändert.
2. **Wächter-Test:** Jede im Checker erzeugte Regel-ID muss beschrieben sein, und jede Beschreibung muss zu einer
   existierenden Regel gehören. Neue Regeln ohne Beschreibung lassen `bun test` scheitern.
3. **API:** `GET /api/apps/wohngeld/regeln` liefert Katalog + Stand (lesend, für alle mit App-Zugriff).
4. **Ansicht „Prüfregeln"** auf der Wohngeld-Übersicht (neuer Reiter): nach Themen gruppiert, Suche über Titel,
   Auslöser und Paragraf, Filter Vollständigkeit/Plausibilität.
5. **„Warum?" am Prüfschritt:** klappt die Regelbeschreibung direkt am Prüfschritt auf (Auslöser, Nachweis,
   Rechtsgrundlage, Erledigung, Hinweise). Der fallbezogene Beleg bleibt wie bisher.
6. **Parametrisierte Regeln** (z. B. `plausi-kontoauszug-unerklaerte-einkuenfte:<art>`) werden über den Präfix
   vor dem Doppelpunkt aufgelöst.
7. **Nicht im Umfang:** Bearbeiten von Regeln in der App, Messwerte des Golden Datasets je Regel (spätere interne
   Qualitätsansicht), Ersetzen des fachlichen Regelkatalogs in `docs/` (der bleibt Recherche-Grundlage).
