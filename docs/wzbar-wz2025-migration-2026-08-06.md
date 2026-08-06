# WZ-Branchen-Matcher: Migration WZ 2008 → WZ 2025

**Datum:** 2026-08-06
**Anlass:** Neue Schlüsseltabelle als CSV geliefert (`Wirtschaftszweig_Branche WZ2025.csv`).
Aufgefallen, weil die App überall „WZ-2008-Schlüssel" schrieb, es aber eine 2025er-Liste gibt.

## Ausgangslage

- Katalog (`assets/catalog.json`) wurde aus `docs/WZBAR-Schluesseltabelle.xlsx` gebaut, gefiltert auf 4–6-stellige
  Codes → 2112 Einträge, `validFrom: 2025-01-01`.
- Prompts / Tool-Beschreibungen / UI / `registry.yaml` sagten durchgehend „WZ 2008" bzw. „4- bis 6-stellig".
- Embeddings (`assets/embeddings.json`): multilingual-e5-large, 1024 Dim, 2112 Vektoren.

## Befund des Abgleichs (CSV WZ2025 vs. Katalog)

Verglichen auf dem gemeinsamen 4–6-stelligen Scope:

| Kennzahl | Wert |
|---|---|
| gemeinsame Codes | 2042 |
| **Text-Unterschiede auf gemeinsamen Codes** | **0** |
| nur im Katalog | 62 |
| nur in WZ2025 (4–6) | 127 |

**Kernaussagen:**
1. **Inhaltlich war der Katalog bereits WZ 2025** — 0 Text-Abweichungen. Wären es zwei verschiedene
   Klassifikationen, gäbe es zwangsläufig umgewidmete Codes mit anderem Text. → Die „WZ 2008"-Labels waren schlicht falsch.
2. **Daten-Bug: fehlende Führungsnullen im Primärsektor.** Die xlsx hatte Codes als Zahlen gespeichert → führende
   Null verloren. Betroffen: Abteilungen 01–09 (Land-/Forstwirtschaft, Fischerei, Bergbau).
   - Alle 62 „nur-Katalog"-Codes waren Führungsnullen-Artefakte (`0`+Code existierte in WZ2025, Text 100 % identisch)
     — z. B. Steinkohlenbergbau als `5100` statt `05100`, „Anbau von Reis" als `1120` statt `01120`.
   - 57 vierstellige Klassen (`0111`, `0510`, …) fehlten ganz — nach dem Nullen-Strippen dreistellig → unter den
     4-Stellen-Filter gefallen.
3. **Zusätzliche Codes in WZ2025:** 3 neue 6-Steller (`522691`, `662902` Rentenberatung, `962101` Barbiersalons)
   und **23 nationale 7-Steller** (z. B. `3312011` Reparatur von Baumaschinen, `4752012` Einzelhandel mit Werkzeugen).

## Entscheidungen

- **Katalog aus der sauberen CSV neu bauen** (Führungsnullen-Fix + fehlende Codes) und App **umbeschriften**.
- **7-stellige Codes aufnehmen** → Scope 4–7-stellig.

## Änderungen

- `docs/WZ2025-Schluesseltabelle.csv` als neue kanonische Quelle (Latin-1 / cp1252, `;`-getrennt).
- `catalog-builder.ts` neu: liest CSV statt xlsx, Filter `^\d{4,7}$`, `validFrom=2025-01-01`. **Embedding-
  Wiederverwendung**: unveränderte Embedding-Texte übernehmen den vorhandenen Vektor (gleiches Modell), nur echte
  Neu-Texte werden neu erzeugt.
- Neu gebaut: **2192 Einträge** (4:651, 5:983, 6:535, 7:23). Embeddings: **2160 wiederverwendet, 32 neu**.
- `neighborhood.ts`: `MAX_LEVEL` 6→7, Regex `\d{4,7}`.
- Umbeschriftet: `index.ts`, `classifier.ts`, `public-functions.ts`, `MatcherPage.jsx`, `data/apps/registry.yaml`
  — „WZ-2008"→„WZ 2025", „4–6-stellig"→„4–7-stellig".

## Verifikation

- Integrität: catalog 2192 = embeddings 2192, keine Codes ohne Vektor / Vektoren ohne Code, alle Dim 1024.
- Retrieval-Smoke-Test (Query → Top-Matches):
  - „Steinkohle abbauen" → `0510` / `05100` Steinkohlenbergbau (Führungsnull korrekt)
  - „Barbier / Herrenfriseur" → `9621`/`96210` + neuer `962101` Barbiersalons
  - „Reparatur von Baumaschinen" → neuer 7-Steller `3312011` (0.965)
  - „Anbau von Reis" → `0112` / `01120` (1.000)

## Rebuild-Kommando

```sh
# aus backend/
/Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/catalog-builder.ts
#   --catalog-only  (nur catalog.json, keine Embeddings)
#   --force         (ignoriert Wiederverwendung, embedded alles neu)
```

## Offen / Hinweise

- Die alte `docs/WZBAR-Schluesseltabelle.xlsx` wird nicht mehr verwendet (kann später entfernt werden).
- `assets/embeddings.json` (~45 MB) ist git-getrackt — der Commit enthält den neuen Blob.
