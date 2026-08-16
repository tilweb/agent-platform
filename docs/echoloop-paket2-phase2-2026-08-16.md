# Echo-Loop · PAKET_2-Integration — Phase 2 (L-VAR Variablen-Explorer)

**Datum:** 2026-08-16 · **Referenz-Plan:** `echoloop-paket2-integrationsplan-2026-08-16.md` · **Baut auf:** Phase 0 + 1
**Rahmen:** native TS-Reimplementierung. Referenz = Sebs Python (`nk_messung.py`, `cfg_generator.py`, `varliste_engine_v1.py`), portiert wird die Logik, nicht der Code. Kalibriert am compliance-sicheren Übungsfall.

---

## Ergebnis

Das große neue Verfahren **L-VAR** (Variablen-Explorer) ist nativ gebaut und im Workplace bedienbar — als 3-Reiter-Bereich der Prozess-Familie. Alle deterministischen Kerne sind gegen den Übungsfall verifiziert (Backend-Suite **167 grün**).

## Bausteine (`backend/src/apps/echoloop/lvar/`)

| Modul | Inhalt | Golden (Übungsfall) |
|---|---|---|
| `nk.ts` | **NK-Gate G1–G7**: Präfix-Kanon · Grammatik (PascalCase/Negation) · Synonym · Mehrfachzuordnung (Dublette vs. Konsolidierung) · Entscheidungsquote (≤5% umformatiert) · Kategorie-Wörter (Blacklist) · Modul-Format (4 Rollen). Soft-Default: hart nur bei 3 Kanon-Codes; `A_Ergebnis` ausgenommen. | 24→21 Namen · G1–G3/G5–G7 erfüllt · G4 offen · Quote 4,2% |
| `kopplung.ts` | **Kopplungs-Riss** (umbenannt in einem, alt im anderen Prozess) · Dublette/Konsolidierung (aus NK-G4) · **Umbenennen-Cockpit** (D-061, append-only Token-IDs, Vorabhaken mit D-085-Sperre) | 1 Riss (C_ArchivPfad) · 24 Karten · Vorabhaken C_ArchivPfad gesetzt / C_DruckerName gesperrt |
| `steckbriefe.ts` | **Prozess-Steckbriefe**: MP maschinell aus Call-Graph, TP↔SP fachlich = UNENTSCHIEDEN (nie geraten), CFG→SP. Soll-Kaskade Entschieden > Twin > Struktur-Vorschlag (D-095). Kritikalität nie geraten. Alt-Stand-Badge. | 210 MP · 213 TP · 211/214 SP |
| `cfg.ts` | **CFG-Generator**: 7 Diff-Klassen (gleich/abweichend/unklar/nur_excel/nur_panel/fehlend/nicht_verglichen) + Excel-Waisen (verdacht/altlast) · Modus ERSTANLAGE/ABGLEICH selbsterkennend · CSV-Export | Alle 7 Klassen genau einmal · D-085-Kreuz · abweichend mit 3 Kandidaten |
| `verzahnung.ts` | **L-VAR → RGA**: NK-G4→D5/D9, harter Kanon→D6, Fachwert-Präfix→D8, Kopplungs-Riss→D6b. Erzeugt Hinweise, **keine Levels** (§3.9). | Dublette→D5/D9, Riss→D6b |
| `assemble.ts` | Führt die vier Verfahren + Verzahnung zu **einem** Explorer-Ergebnis zusammen (CFG zuerst → D-085-Sperre → Kopplung). | vollständiges Ergebnis |
| `service.ts` | Beschafft Fundorte/Call-Graph aus den Phase-0-Tabellen + Namensmodul vom Prozess; Leer-Zustand ohne Namensmodul (kein Raten). | — |

**Route:** `GET /prozesse/:id/lvar` · **Frontend:** `components/LvarExplorer.jsx` + Tab „L-VAR Explorer" in `ProzessDetail` (3 Reiter + RGA-Hinweise, Lazy-Fetch).

## Golden-Fixtures (aus dem Übungsfall portiert)

- `nk-namensmodul.json` (aus `_varliste_demo_namen.py`): alt→neu-MAP mit Rollen C/H/T/U, Prozesse MP/TP/SP.
- `cfg-demo.json` (aus `_DATENSATZ.md §3`): C_-Ziele + CONFIG-Excel-Modell, alle 7 Diff-Klassen + Waisen.

## Wichtige Referenz-Klärungen (via Kartierung, statt zu raten)

- **U ist kein Präfix**, sondern Rollen-Code für präfixlose Fachwerte (am Namen nur C_/H_/T_).
- **G6 ist Blacklist** (verworfene Wörter Nr/Ordner/Verzeichnis/Dokument), keine Whitelist.
- **CFG `nur_panel`** = Excel-Zeile vorhanden, Wert leer; **`fehlend`** = Schlüssel gar nicht in der Excel (Brücke über registrierte Alt-Namen scheitert). Der **D-085-Kreuz** (target `fehlend` + excel `verwaist`) sperrt den Konform-Vorabhaken (K-63).
- **TP↔SP** ist fachlich und wird nie maschinell geraten (nur MP ableitbar).

## Prinzipien durchgehalten

Deterministisch vs. Mensch (Levels/Kritikalität/TP-SP bleiben menschlich) · Golden-first (jeder Baustein gegen den Übungsfall) · portiert, nicht erfunden (kein PM-05/06/08; pfad_befunde bewusst offen).

## Offen (nachgelagert)

- **`pfad_befunde` → D9/D10** (Pfad-Wiederholungs-Analyse kürzbar/extern/trenner) — eigene Referenz-Kartierung nötig.
- **Namensmodul-Authoring-UI**: das alt→neu-Modul ist heute am Prozess hinterlegbar (`data.lvarNamensmodul`), aber es gibt noch keine UI, um es zu schreiben (in Sebs Welt das `_..._namen.py`). Bis dahin kommt es per Seed/Import.
- **Reale Kalibrierung** (Heinzl 46/597/256) erst nach O-14/Zweckbindung.

## Commit-Kette Phase 2

`5c75944` NK-Gate · `6349e7c` CFG · `e831431` Steckbriefe+Kopplung · `1236520` Verzahnung · `45ef629` Explorer (Assembly+Route+Frontend).
