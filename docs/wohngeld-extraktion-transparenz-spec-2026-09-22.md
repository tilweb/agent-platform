# Spec: Extraktions-Transparenz pro Dokument

**Stand:** 2026-09-22 · **Status:** ENTWURF → Umsetzung · **App:** `wohngeld`

## Ziel
Sichtbar machen, **was** die KI aus einem Dokument extrahiert hat — an zwei Stellen:
- **a) Dateivorschau:** Panel „Aus dem Dokument extrahiert" neben/unter dem Dokument.
- **b) Dokumente-Tab (rechte Spalte):** je Dokument ausklappbar ein **Extraktions-Baum**
  (Verzeichnisbaum-Optik: vertikale Linie + Abzweigungen) mit den gezogenen Werten.

Plus: **Konfidenz** je Wert und als zweiter Ast **„ausgelöste Hinweise"** (Prüfschritte, die dieses
Dokument als Beleg referenzieren) → zeigt Extraktion *und* Wirkung.

## Datenmodell (kein Migration — in `dokument.data`)
Neues Feld `Dokument.extraktion?: DokumentExtraktion`:
```
DokumentExtraktion {
  felder: Array<{ gruppe?: string; label: string; wert: string; confidence?: number; seite?: number }>;
  modell?: string;   // genutztes Extraktionsmodell
  stand?: string;    // Prompt-/Rechtsstand
  erzeugtAm?: string;
}
```
Wird beim Anlegen eines Dokuments aus der Extraktion befüllt (Posteingang `verteilen` + Direkt-Upload).

## Backend
- In `extraction.ts` (`klassifiziereUndExtrahiere`) aus dem Pipeline-Ergebnis eine
  `extraktion`-Übersicht bauen (reiner Helfer `baueExtraktionsUebersicht(typ, mapped, result)`):
  - Felder aus Stammdaten (Antrag) / Analyse (Nachweise) / Identität, jeweils mit lesbarem
    deutschem Label, formatiertem Wert (Datum/Euro/ja-nein), `confidence` (aus `fieldConfidences`),
    `seite` (aus `provenance` `p:N`, falls vorhanden). Gruppen: Antragsteller/Adresse/Wohnung/
    Antrag/Identität/Analyse.
  - `modell`/`stand` aus der KI-Governance-Konstante (WOHNGELD_PROMPT_VERSION / Rechtsstand).
- `ExtraktionErgebnis.extraktion?` ergänzen; Routes `posteingang.ts` (verteilen + dokumente/upload)
  speichern `extraktion` am Dokument (`createDokument({..., extraktion})`).
- Reiner Helfer + Unit-Test (Formatierung/Gruppierung).

## Frontend
- Neue Komponente `components/ExtraktionsBaum.jsx`:
  - **Verzeichnisbaum-Optik:** je Gruppe ein Knoten, darunter die Felder als Blätter; vertikale
    Verbindungslinie (neutral `theme.colors.border`) + horizontale Abzweigung je Blatt.
  - Blatt: `Label` → `Wert`, rechts dezente **Konfidenz** (z. B. „92 %" oder Punkt; niedrige
    Konfidenz/`0` als „prüfen"), optional „S. N".
  - Optionaler zweiter Ast **„Ausgelöste Hinweise"**: Liste der Prüfschritte mit
    `quellDokumentId === dok.id` (Titel + Status).
  - Fallback: wenn `dokument.extraktion` fehlt (Alt-/Seed-Dokumente), aus `dokument.analyse`
    ableiten, damit auch Bestandsdaten etwas zeigen.
- **Dokumente-Tab** (`VorgangDetail.jsx`): unter jeder Dokument-Kachel ein Toggle
  „Extrahierte Werte anzeigen" → `ExtraktionsBaum`.
- **Dateivorschau-Modal**: neben dem iframe (oder darunter bei schmal) ein Panel
  „Aus dem Dokument extrahiert" mit demselben `ExtraktionsBaum`.
- theme.js, keine farbigen Akzentrahmen (die Baumlinie ist neutral/strukturell), Deutsch, SVG-Icons.

## Nicht-Ziele
- Kein Bounding-Box-Overlay auf der Seite (Vision-Boxen) — später denkbar; hier nur Seitenzahl.
- Keine Bearbeitung der Werte im Baum (read-only Transparenz; Korrektur läuft über die
  bestehende Feld-Bestätigung/Formularfelder).

## Abnahme
- Neue Dokumente zeigen den Baum mit Werten+Konfidenz; Seed-Dokumente zeigen den Fallback aus
  `analyse`. Vorschau + Dokumente-Tab konsistent. tsc/tests/build grün.
