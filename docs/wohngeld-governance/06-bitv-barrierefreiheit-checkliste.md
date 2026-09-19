# BITV-Barrierefreiheits-Checkliste — Wohngeld-Antragsassistent (UI)

**Rechtsgrundlagen:** BITV 2.0 (auf Basis BGG) · EN 301549 · WCAG 2.1 AA · **App:** `wohngeld`
**Stand:** `[Datum einsetzen]` · **Status:** VORLAGE — Prüfliste zum Abhaken.
**Grundlagen:** `docs/wohngeld-governance-recherche-2026-09-19.md` (Abschnitt 5).

> **Zweck.** Öffentliche Stellen müssen digitale Angebote **barrierefrei** gestalten. Diese Liste
> prüft die Sachbearbeiter-Oberfläche des Assistenten. Barrierefreiheit ist ein
> **Governance-/Beschaffungskriterium**, nicht nur UX. Status je Kriterium: `[offen]` / `[erfüllt]` /
> `[n. z.]` (nicht zutreffend) — mit Prüfhinweis/Fundstelle ausfüllen.

---

## 1. Wahrnehmbarkeit (Perceivable)

| # | WCAG | Kriterium | Status | Prüfhinweis / Befund |
|---|---|---|---|---|
| P1 | 1.1.1 | Nicht-Text-Inhalte (Icons, Grafiken) haben Textalternativen; SVG-Icons mit `aria-label`/`title` | `[offen]` | `[…]` |
| P2 | 1.3.1 | Struktur programmatisch bestimmbar (Überschriften-Hierarchie, Listen, Tabellen-Header) | `[offen]` | `[…]` |
| P3 | 1.3.2 | Sinnvolle Lesereihenfolge (auch ohne CSS) | `[offen]` | `[…]` |
| P4 | 1.4.1 | Information nicht allein über Farbe vermittelt (z. B. KI-Provenienz/Status auch mit Text/Icon) | `[offen]` | `[…]` |
| P5 | 1.4.3 | **Kontrast** Text ≥ 4,5:1 (Normaltext), ≥ 3:1 (Großtext); theme.js-Werte prüfen | `[offen]` | `[…]` |
| P6 | 1.4.11 | Kontrast von UI-Komponenten/Grafiken ≥ 3:1 (Buttons, Formularränder, Fokusring) | `[offen]` | `[…]` |
| P7 | 1.4.4 | Text bis 200 % zoombar ohne Funktionsverlust | `[offen]` | `[…]` |
| P8 | 1.4.10 | Reflow bei 320px Breite, kein 2D-Scrollen | `[offen]` | `[…]` |
| P9 | 1.4.12 | Textabstände anpassbar ohne Inhaltsverlust | `[offen]` | `[…]` |

## 2. Bedienbarkeit (Operable)

| # | WCAG | Kriterium | Status | Prüfhinweis / Befund |
|---|---|---|---|---|
| O1 | 2.1.1 | **Vollständige Tastaturbedienbarkeit** (alle Funktionen, auch Chat/Upload/Bestätigen-Verwerfen) | `[offen]` | `[…]` |
| O2 | 2.1.2 | Keine Tastaturfalle (Fokus kommt aus Dialogen/Menüs wieder heraus) | `[offen]` | `[…]` |
| O3 | 2.4.1 | Bereiche überspringbar (Skip-Link / Landmarks) | `[offen]` | `[…]` |
| O4 | 2.4.3 | Sinnvolle **Fokus-Reihenfolge** | `[offen]` | `[…]` |
| O5 | 2.4.7 | **Fokus sichtbar** (deutlicher Fokusindikator auf allen interaktiven Elementen) | `[offen]` | `[…]` |
| O6 | 2.4.6 | Aussagekräftige Überschriften und Beschriftungen | `[offen]` | `[…]` |
| O7 | 2.5.3 | Sichtbarer Beschriftungstext ist Teil des zugänglichen Namens (Label in Accessible Name) | `[offen]` | `[…]` |
| O8 | 2.2.1 | Zeitbegrenzungen (Session-Timeout) anpassbar/verlängerbar bzw. gewarnt | `[offen]` | `[…]` |

## 3. Verständlichkeit (Understandable)

| # | WCAG | Kriterium | Status | Prüfhinweis / Befund |
|---|---|---|---|---|
| U1 | 3.1.1 | Sprache der Seite ausgezeichnet (`lang="de"`) | `[offen]` | `[…]` |
| U2 | 3.2.3/3.2.4 | Konsistente Navigation und Benennung | `[offen]` | `[…]` |
| U3 | 3.3.1 | **Fehler klar benannt** (Formular-Validierung: was ist falsch, wo) | `[offen]` | `[…]` |
| U4 | 3.3.2 | **Formularbeschriftungen** vorhanden (jedes Feld hat sichtbares `<label>`/`aria-label`) | `[offen]` | `[…]` |
| U5 | 3.3.3 | Korrekturvorschläge bei Fehleingaben, soweit möglich | `[offen]` | `[…]` |
| U6 | 4.1.3 | Statusmeldungen für Screenreader (z. B. „gespeichert", KI-Vorschlag übernommen) via `aria-live` | `[offen]` | `[…]` |

## 4. Robustheit (Robust)

| # | WCAG | Kriterium | Status | Prüfhinweis / Befund |
|---|---|---|---|---|
| R1 | 4.1.2 | **Name, Rolle, Wert** für alle Bedienelemente (korrektes ARIA / native Semantik) | `[offen]` | `[…]` |
| R2 | 4.1.1 | Valides, robustes Markup (keine doppelten IDs etc.) | `[offen]` | `[…]` |
| R3 | 1.3.5 | Eingabezweck erkennbar (Autocomplete für gängige Felder) | `[offen]` | `[…]` |

## 5. Assistent-spezifische Prüfpunkte

| # | Kriterium | Status | Prüfhinweis / Befund |
|---|---|---|---|
| A1 | **KI-Provenienz/Status** (llm/mensch, bestätigt/verworfen) nicht nur farblich, auch per Text/Icon + Screenreader-Ansage | `[offen]` | `[…]` |
| A2 | **Bestätigen/Verwerfen**-Aktionen per Tastatur erreichbar und beschriftet | `[offen]` | `[…]` |
| A3 | **Chat-Ein-/Ausgabe** zugänglich (neue Nachrichten via `aria-live`; Eingabefeld beschriftet) | `[offen]` | `[…]` |
| A4 | **Dokument-Upload** tastaturbedienbar, Status/Fehler zugänglich | `[offen]` | `[…]` |
| A5 | **Protokoll-/Prüfschritt-Tabellen** korrekt ausgezeichnet (Header, Zusammenfassung) | `[offen]` | `[…]` |
| A6 | **Dialoge/Bestätigungen** (z. B. Löschfällig) als `role="dialog"`, Fokus-Management, Escape schließt | `[offen]` | `[…]` |

## 6. Organisatorisches / Nachweis

| # | Kriterium | Status | Hinweis |
|---|---|---|---|
| N1 | **Barrierefreiheitserklärung** nach BITV 2.0 § 7 erstellt/veröffentlicht | `[offen]` | `[Pflicht für öffentliche Stellen]` |
| N2 | **Feedback-Mechanismus** für Barrieren benannt | `[offen]` | `[…]` |
| N3 | Prüfmethode dokumentiert (automatisiert `[Tool]` + manuell + Screenreader `[NVDA/JAWS/VoiceOver]`) | `[offen]` | `[…]` |
| N4 | Prüfdatum / geprüfte Version | `[…]` | `[…]` |

---

## Zwingend zu leisten (Kommune/Betreiber)
Durchführung der Prüfung (automatisiert + manuell + Screenreader), Ausfüllen der Status-Spalten,
Erstellung der **Barrierefreiheitserklärung** (BITV 2.0 § 7) und eines Feedback-Mechanismus,
Behebung offener Punkte vor Produktivsetzung.

## Quellen
`docs/wohngeld-governance-recherche-2026-09-19.md` (Abschnitt 5, BITV 2.0 mit URL) ·
BITV 2.0: https://www.gesetze-im-internet.de/bitv_2_0/BJNR184300011.html · EN 301549 / WCAG 2.1 AA.
