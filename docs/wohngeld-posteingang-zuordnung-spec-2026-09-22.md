# Spec: Posteingang — Zuordnungs-Vorschlag mit transparentem Abgleich

**Stand:** 2026-09-22 · **Status:** ENTWURF → Umsetzung · **App:** `wohngeld`

## Problem / Ziel
Nachgereichte Dokumente (häufigster Fall) müssen heute vollständig manuell einem Vorgang
zugeordnet werden. Ziel: das System **schlägt** den passenden bestehenden Vorgang vor —
aber **niemals automatisch zugeordnet**, und die Bestätigung erfolgt nur nach einem
**transparenten Abgleich der Daten** (Nachreichung ↔ Vorgang).

## Sicherheits-Leitplanken (nicht verhandelbar)
1. **Kein stilles Auto-Zuordnen.** Das System *schlägt vor*; die Zuordnung passiert ausschließlich
   per expliziter Bestätigung der Sachbearbeitung (Human-in-the-Loop).
2. **Pflicht-Abgleich vor Bestätigung.** Vor dem Zuordnen wird ein **Feld-für-Feld-Vergleich**
   angezeigt: links „Aus der Nachreichung" (aus dem Dokument extrahiert), rechts „Vorgang
   <Antrags-ID>" (bestehende Daten). Je Feld ein Status: **gleich / abweichend / fehlt**.
   Abweichungen werden deutlich markiert (Warn-Farbe aus theme, kein Farbrahmen).
3. **Schwellenwert & Mehrdeutigkeit.** Vorschlag nur bei ausreichender Übereinstimmung
   (`level = hoch/mittel`). Bei mehreren ähnlichen Kandidaten → Kandidaten zur Auswahl,
   **keine Vorauswahl**. Bei zu wenig identifizierenden Daten → **kein Vorschlag**, rein manuell.
4. **Manuelle Zuordnung bleibt immer möglich** (bestehender Akte→Vorgang-Picker als Fallback).

## Matching (Backend, rein + testbar)
- Identifizierende Daten aus dem Dokument: aus dem Antrag die vollen Stammdaten; aus Nachweisen
  eine **leichte Identitäts-Extraktion** (nachname/vorname/geburtsdatum) — dafür bekommen die
  per-Typ-Schemas eine optionale `identitaet`-Feldgruppe (personalausweis, rentenbescheid,
  mietvertrag/-bescheinigung, kontoauszug). Kein identifizierendes Feld → kein Match.
- Reine Funktion `matchVorgaenge(ident, kandidaten): ScoredKandidat[]`:
  - Score je Signal: **nachname** (stark), **geburtsdatum** (stark), vorname, plz+ort,
    strasse+hausnummer, **antragsId/aktenzeichen** (sehr stark, wenn im Dokument vorhanden).
  - `level`: hoch/mittel/gering aus Score. Rückgabe je Kandidat inkl. **`vergleich[]`**
    (feld, label, ausDokument, imVorgang, status) — genau das speist die Transparenz-UI.
  - Deterministisch (Normalisierung: lowercase, Umlaute, Datum) → Unit-Tests (Treffer/Abweichung/
    Mehrdeutigkeit/keine Daten).
- Endpoint `POST /posteingang/match` Body `{ stammdaten?, identitaet? }` → `{ kandidaten: [...] }`
  (Top ~5, nur score>0), lädt bestehende Vorgänge+Akten+Antragsteller-Personen als Kandidaten.

## UI (Frontend, PosteingangPage)
- Nach Klassifikation/Extraktion je Eingang: `match` aufrufen. Wenn ein Kandidat `level>=mittel`:
  **Vorschlagskarte** „Vermutlich zu: <Antragsteller> · <Antrags-ID>" + **Vergleichstabelle**
  (Pflicht sichtbar) mit gleich/abweichend/fehlt-Markierung.
  - Bei Abweichungen ein deutlicher Hinweis „Angaben weichen ab — bitte prüfen".
  - Buttons: **„Diesem Vorgang zuordnen"** (→ `verteilen` mit `vorgangId`) und **„Anderer Vorgang / neu"**
    (öffnet den bestehenden manuellen Picker). Keine vorausgewählte Zuordnung.
  - Weitere Kandidaten aufklappbar (jeweils mit eigenem Abgleich).
- Kein/zu schwacher Match → direkt der manuelle Picker (heutiges Verhalten).

## Konsistenz-Fix
- **Direkt-Upload am Vorgang** (`/vorgaenge/:id/dokumente/upload`) löst nach dem Anlegen die
  **Prüfung automatisch** aus (wie `verteilen`), Rückgabe `befundeCount`. Damit verhalten sich
  beide Wege gleich.

## Audit
- Zuordnung per Vorschlag wird protokolliert (`aktion: 'dokument.zugeordnet'`, mit Kandidaten-Score/
  Level im `detail`) — nachvollziehbar, wer welchen Vorschlag bestätigt hat.

## Nicht-Ziele
- Keine automatische Zuordnung ohne Bestätigung. Kein ML-Training. Kein Übernehmen der
  Plattform-Inbox (Batch/Projekte). Kein fuzzy-OCR-Namematching über das oben genannte hinaus.

## Abnahme
- `matchVorgaenge`-Tests grün (inkl. „keine Daten → kein Vorschlag", Abweichungs-Markierung).
- Abgleich ist vor der Bestätigung sichtbar; Zuordnung nur per Klick. tsc/tests/build grün.
