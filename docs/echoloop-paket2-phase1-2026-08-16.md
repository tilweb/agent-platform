# Echo-Loop · PAKET_2-Integration — Phase 1 (L-RGA/L-BAU auf Referenz-Reife)

**Datum:** 2026-08-16 · **Referenz-Plan:** `echoloop-paket2-integrationsplan-2026-08-16.md` · **Baut auf:** Phase 0 (`echoloop-paket2-phase0-2026-08-16.md`)

Phase 1 hat zwei Teile. **Teil 1** (dieser Stand) ist der deterministische, `bun test`-verifizierte Kern. **Teil 2** (offen) sind die LLM-/Rendering-Bausteine.

---

## Teil 1 — deterministischer Kern (abgeschlossen)

Referenz-Spezifikation aus PAKET_2 nativ nach TypeScript portiert (Logik, nicht Code). Vor der Portierung wurde die exakte Referenz kartiert (`_pruefmuster_check.py` v3.11, `STANDARD_Zwei-Naturen-der-Reife_v1`, `STANDARD_Input-Anforderungskatalog_Analyse-Tiefen`).

### 1. Zwei-Naturen der Reife (`scoring.ts`)

- **Level-Klassen** (`levelKlasse`): L0 Boden · **L1–L3 Robustheit** (GEBAUT, am Einzelprozess nachweisbar) · **L4–L5 Skalierung** (VEREINBART, nur gegen den Haus-Standard nachweisbar).
- **Vier Vereinbarungs-Gates** (`VEREINBARUNGS_GATES`, R2): **D6-L3** (Einstellungs-Datei + Config-Bootstrap) · **D7-L4** (Kennzahlen-Feld-Schema des Hauses) · **D9-L4** (Namenskonvention + Bibliotheks-Namensraum) · **D10-L2** (umgebungs-/personenfreie Namen — Sonderfall auf L2).
- **Doppel-Nachweis** (`bewerteVereinbarungsGates`, R3): je Gate T-A (Statik) + T-B/T-C (gelebt) → Status `nachgewiesen | papier | nicht_belegt | ungeprueft | offen | nicht_relevant`. Jeder offene/Papier-Status trägt einen kundenfähigen Hinweis mit **Org-Träger** (R6: „ab L4 baut die Organisation mit").
- **`papierLevelWarnungen`** sammelt Gates, deren geführtes Level nicht sauber getragen ist.

**Nicht-verhandelbare Grenze (A-1):** Wir bauen **nur Darstellung + Prüfung**. Die **SE-Formel bleibt unverändert** (SE-B/SE-W ist Deutung, kein Formelsplit — im Standard nirgends als zweite Formel definiert). Ein „Papier-Level" senkt das Ist **nicht automatisch** — die normative WB44-§3b-Änderung zieht Seb im Review nach; wir liefern die Prüf-Flags.

### 2. Analyse-Tiefen T-A/B/C (`analyse-tiefen.ts`)

- **Input-Inventar I1–I6** → **getragene Tiefe** (`maxTiefe`): nur I1 → T-A; +I2 → T-B; +I2+I5+I6 → T-C.
- **Seite-1-Prinzip** (`deklariereTiefe`): über-deklarieren ist „ungetragen" — der Bericht verspricht nie mehr, als die Tiefe trägt. **T-B-Pflicht**, wo Betriebsdaten (I2) existieren.
- **Behauptungs-Klassen** (`darfBehaupten`): T-A darf Struktur/Risiko, T-B zusätzlich Verhalten/Zahlen, T-C zusätzlich Vollständigkeit/Soll.
- **Klassen-Scan-Pflicht** (D-072, `klassenScan`/`markiereZufallsfund`): ein neu erkanntes Muster wird über den GANZEN Export-Satz gescannt; Einzelfund ohne Voll-Scan = „Zufallsfund".
- **Vollständigkeits-Regel** (D-072, `vollstaendigkeitZulaessig`): Fehlerklassen ohne statische Spur brauchen eine vollständige **Panel-Pflichtliste**; eine Vollständigkeits-Aussage setzt die abgearbeitete Liste voraus (Statik liefert LISTE, Panel liefert BEWEIS).
- **Baustand** um `analyseTiefe` · `inputInventar` · `panelPflichtliste` · `gateNachweise` erweitert.

### 3. Prüfmuster-Erweiterung (`checker/patterns.ts`)

Neue **statische, beobachtende** Muster (Governance: laufen still bis 0 Fehlalarme auf Fixtures, eskalieren nie hart, färben keine Kennzahl — `beobachtend`-Flag auf `PMFinding`):

| PM | Aspekt | Quelle |
|---|---|---|
| **PM-12** | Endlosschleifen-Verdacht (fester Deckel ≥ 1000, ❓ Panel/Graph) | `loops` |
| **PM-17** | Warte-Schritt-Summe je Prozess (kumulierter Zeit-Engpass) | `fixedWaits` |
| **PM-W-b** | Betrag als Text neben numerischem Zwilling (Konvertierungsrisiko) | `variables` |
| **PM-W-c** | int-Typ für Betrags-Variable (Cent-Verlust 261,80 → 261) | `variables` |

**Befunde bei der Referenz-Kartierung (statt blind zu portieren):**
- **PM-05/06/08** existieren in `_pruefmuster_check.py` **nicht als Code** — nur Backlog-Kandidaten im Katalog. Nicht portierbar (wäre Erfindung, verletzt Prinzip §3.1).
- **PM-07** ist **bewusst durch PM-10 ersetzt** (das alte Kriterium „Value gefüllt + ContextVariable leer = Seed" ist als Falsch-Positiv-Quelle belegt).
- **PM-15/16/18/19/21/PM-RX** sind vorhanden, brauchen aber Parser-Erweiterungen (`Subject:Cell`, CV-Referenzen, Datei-Rollen) bzw. Register/Doku-Artefakte (`_zurueckgezogene_aussagen.json`, `_ABGELOEST.md`) → **nächste Welle**.
- **PM-W-a** (Keybased-Tippen) braucht `Keybased:True`-Parsing → nächste Welle.

**Abstimmungspunkt A-PM:** Unsere bestehenden **PM-13/PM-14** (aus dem V0.1-Katalog: feste Wartezeiten / feste Klick-Position) **kollidieren nummernmäßig** mit Sebs PAKET_2-PM-13 (Melde-/Kohorten-Lücke) und PM-14 (Slot-Referenz-Kollision). Vor der Portierung von Sebs PM-13/14 klären, ob wir umnummerieren oder unsere Muster umbenennen.

### Verifikation Teil 1

```
bun test src/apps/echoloop/   → 114 pass · 0 fail · 10 Dateien
tsc --noEmit                  → keine echoloop-Fehler
```
(+37 Tests gegenüber Phase 0: +10 Zwei-Naturen, +11 PM, +16 Analyse-Tiefen.)

---

## Teil 2 — LLM-/Rendering-Bausteine (offen)

Mit **Adacor Qwen 3.5** (bereits angebunden: `analysis.ts` Vor-Benotung, `narrative.ts` Kundenfassung). Verifikation hier per Pipeline-Lauf + Sichtprüfung (kein Exact-Match-Test).

- **PA-Prüfagenten-Fan-out PA-F1…F4** (`pruefagenten/`): statt einer Vor-Benotung vier adversariale Agenten (Wertfehler-Ketten · Schleifen/Timing · Melde-Vollständigkeit · Wiederanlauf), je Refutation; deterministischer Checker gewinnt bei Determinismus, Agent bei Kontext.
- **Bauanleitung Fundament-Welle (R4)** (`bauanleitung.ts`): jede Bauanleitung startet mit „Fundament ohne Umbau" — Config-Bootstrap · Erfolgs-Semantik (`A_Ergebnis` OK/NICHTS-ZU-TUN/GESTOPPT) · Prozess-Kopfblock.
- **K1-Report-Export** (`GET /baustaende/:id/report.(html|pdf)`): Kundenfassung + Bauanleitung + Kennzahlen → YNEO-branded HTML/PDF (Living-Styleguide).
- **Panel-UI** für Analyse-Tiefen + Vereinbarungs-Gates (Frontend-Verdrahtung des Regelmoduls).

**DoD Phase 1 (gesamt):** RGA reproduziert gegen das fiktive Golden-Fixture die gepinnten Kennzahlen; PA-Fan-out 0 FP auf Fixtures; QA-Kette blockt bei Vertrags-Fehlschlag.

**Abstimmungspunkt A-1:** Die WB44-§3b-Gate-Ergänzungen sind laut Zwei-Naturen-Standard „offen — Review-Termin". Wir bauen Darstellung + Prüfung der Vereinbarungs-Gates; die normative WB44-Änderung zieht Seb im Review nach.
