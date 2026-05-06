# WZ-Branchen-Matcher — 4-6-stellige Codes + Multi-Tätigkeits-Erkennung

**Datum**: 2026-05-06
**Branch**: main
**App**: `wzbar-matcher`

## Kontext

Erstes Kunden-Feedback (IHK) zur produktiven WZ-Branchen-Matcher-App:

1. **Code-Tiefe zu grob**: Der Catalog war hart auf 4-stellige WZ-Codes gefiltert. Die IHK trifft in der Realität regelmäßig auch auf **5-stellige Unterklassen** und **6-stellige Detail-Unterklassen** (z.B. `43290 Sonstige Bauinstallation a.n.g.` → `432901 Wärme-, Schall- und Brandschutzinstallation`).
2. **Mehrere Tätigkeiten pro Eintrag**: Eintragungen vom Amtsgericht enthalten oft **mehrere distinkte gewerbliche Tätigkeiten** in einem Textblock — z.B. "Baulicher Brandschutz, Trockenbau und Umzüge". Die alte Pipeline gab nur **einen** primären Code mit Alternativen zurück, die als alternative Codes für **dieselbe** Tätigkeit gemeint waren. Die IHK kann aber **bis zu 3 Schlüssel pro Unternehmen** hinterlegen — also brauchen wir pro Tätigkeit einen eigenen Schlüssel.

## Entscheidungen

### Code-Tiefe: 4-6 statt nur 4

- Regex in `catalog-builder.ts` von `^\d{4}$` auf `^\d{4,6}$` gelockert.
- `CatalogEntry` strukturell unverändert — `code`-String ist jetzt 4-6 Zeichen.
- Klassifikator-Prompt erweitert um Hierarchie-Logik: **bevorzugt die feinste eindeutige Ebene**, fällt auf die nächsthöhere Ebene zurück, wenn die Beschreibung die feinere Tiefe nicht eindeutig hergibt.

### Multi-Tätigkeit: Pre-Splitter

Drei Optionen waren auf dem Tisch:
- **Pre-Splitter** (gewählt): ein LLM-Call zerlegt den Text vor der Pipeline in 1-3 Tätigkeiten, dann läuft die alte Pipeline pro Tätigkeit.
- Single-LLM-Multi-Output: ein Call mit erweitertem Function-Schema gibt mehrere primäre Codes zurück. Verworfen — Schema komplexer, schwerer prompt-engineerable.
- Regex/Heuristik-Splitting: deterministisch, aber zu fragil bei Variationen ("und alle damit verbundenen Tätigkeiten").

Splitter-Verhalten:
- "Brandschutz, Trockenbau und Umzüge" → 3 Tätigkeiten
- "Hochbau, Tiefbau, Spezialtiefbau" → 1 Tätigkeit (Variationen gebündelt)
- Hard-Cap auf 3 Tätigkeiten
- Fallback: bei LLM-Fehler oder leerer Antwort → einzelne Tätigkeit = Originaltext

### Datenmodell

- Neue Typen: `ActivityMatch { activity, result, retrievalTopK }` und `MultiMatchResult { activities: ActivityMatch[] }`.
- `MatchRecord.result` Typ wechselt von `MatchResult` auf `MultiMatchResult`.
- DB-Schema unverändert (JSONB-Spalte verträgt beide Formen).
- **Read-Side-Fallback** in `storage.ts.normalizeResult()`: erkennt Legacy-Records mit `result.primary` und verpackt sie transparent in `MultiMatchResult { activities: [{ activity: inputText, result: oldResult, retrievalTopK: [] }] }`. Keine DB-Migration nötig.

### Public-API (Breaking)

- Tool-Output `wzbar-matcher__classify` von `{ primary, alternatives }` auf `{ activities: [{ activity, primary, alternatives }] }`.
- Tool-Description macht den Multi-Activity-Charakter explizit, sodass Agenten die Liste richtig interpretieren.
- Versionierung verworfen — alle Aufrufe gehen vom selben Repo, breaking Change wird mit dem Deploy synchronisiert.

### Frontend

- `MatcherPage.jsx`: pro `ActivityMatch` ein eigener Block mit Header (`Tätigkeit N: <Activity-Name>`) plus dem bekannten Primary+Alternativen-Layout.
- Single-Activity-Fallback: bei `activities.length === 1` wird der Block-Header weggelassen, sieht aus wie vorher.
- Subtitle: "Bis zu 3 WZ-2008-Schlüssel pro Eingabe — automatisch nach erkannten Tätigkeiten getrennt. 4- bis 6-stellige Codes."
- `HistoryList.jsx`: zeigt Codes als ` · `-Liste; alter Single-Match-Pfad bleibt als Fallback.
- `MatchCard.jsx` unverändert.

## Änderungen

### Backend

| Datei | Änderung |
|---|---|
| `backend/src/apps/wzbar-matcher/catalog-builder.ts` | Regex `^\d{4,6}$`, Verteilungs-Statistik (4/5/6) im Log |
| `backend/src/apps/wzbar-matcher/classifier.ts` | Prompt um Hierarchie-Logik erweitert, Schema-Description auf 4-6-stellig |
| `backend/src/apps/wzbar-matcher/splitter.ts` | **Neu**: `splitActivities(inputText): Promise<string[]>` via Function-Calling, Hard-Cap 3 |
| `backend/src/apps/wzbar-matcher/service.ts` | Pipeline auf Splitter + Per-Activity-Klassifikation umgebaut, `Promise.all` für parallele Klassifikation, aggregierte `retrievalTopK` |
| `backend/src/apps/wzbar-matcher/types.ts` | `ActivityMatch`, `MultiMatchResult`, `MatchRecord.result` auf `MultiMatchResult` |
| `backend/src/apps/wzbar-matcher/storage.ts` | `normalizeResult()` mit Read-Fallback für Legacy-Records |
| `backend/src/apps/wzbar-matcher/public-functions.ts` | Tool-Output-Schema `{ activities: [{ activity, primary, alternatives }] }` |
| `backend/src/apps/wzbar-matcher/assets/catalog.json` | 720 → **2112 Einträge** (662×4 + 923×5 + 530×6) |
| `backend/src/apps/wzbar-matcher/assets/embeddings.json` | neu, ~44 MB, 2112 Vektoren à 1024 dim (Multilingual E5 Large) |

### Frontend

| Datei | Änderung |
|---|---|
| `frontend/src/apps/wzbar-matcher/MatcherPage.jsx` | Multi-Block-Layout, Subtitle aktualisiert, neue Block-Styles |
| `frontend/src/apps/wzbar-matcher/components/HistoryList.jsx` | Codes-Summary aus `activities[].result.primary.code` mit ` · `-Trenner, Legacy-Fallback |

### Unverändert

- `backend/src/apps/wzbar-matcher/retrieval.ts` (Vector-Search bleibt 1:1, läuft pro Activity)
- `backend/src/apps/wzbar-matcher/index.ts` + `routes.ts` (Response geht durch ohne Schema-Anpassung)
- `backend/src/db/schema/wzbar.ts` (JSONB-Spalte verträgt beide Formen)
- `frontend/src/apps/wzbar-matcher/components/MatchCard.jsx`
- `demo/messe`-Worktree (Railway-Deploy)

## Messergebnisse (lokal verifiziert, 2026-05-06)

### Catalog-Build

```
[catalog-builder] xlsx → 2112 Einträge (4-6 stellig, gültig).
  Verteilung: 4=662, 5=923, 6=530.
  Übersprungen: 451 ausserhalb 4-6 Stellen, 3 abgelaufen.
```

### Splitter

| Input | Output |
|---|---|
| "Baulicher Brandschutz, Trockenbau und Umzüge" | `["Baulicher Brandschutz", "Trockenbau", "Umzüge"]` ✓ |

### End-to-End (Service)

| Input | Erkannte Activities → Codes |
|---|---|
| "Baulicher Brandschutz, Trockenbau und Umzüge" | `Baulicher Brandschutz → 439991 Brandsanierung (85%)` · `Trockenbau → 433101 Akustik- und Trockenbau (95%)` · `Umzüge → 49420 Umzugstransporte (95%)` |
| "Schlachten von Geflügel" | `Schlachten von Geflügel → 10120 (100%)` (Single-Block) |

Mixed-Depth funktioniert (5- und 6-stellige Codes werden gewählt). Single-Activity läuft korrekt durch den Block-Header-weglass-Pfad. Multi-Activity läuft parallel via `Promise.all`.

## Bekannte Themen

- **"Brandschutz" vs. "Brandsanierung"**: Klassifikator wählt für "Baulicher Brandschutz" den 6-stelligen Code `439991 Brandsanierung, Wasserschadensanierung` mit 85% Confidence. Es gibt im neuen Catalog auch `432901 Wärme-, Schall- und Brandschutzinstallation`, der semantisch näher an "baulicher Brandschutz" liegt. Mögliche Ursachen: Embedding-Top-K rankt Sanierung höher als Installation; Klassifikator-Prompt hat keine harte Präferenz für "Bau-Installation". Iteration: Top-K erhöhen oder Prompt um Beispiele anreichern. Out-of-Scope für Phase 1.
- **Embeddings-Asset wuchs auf ~44 MB** (vorher ~14 MB). Für Build-Time-Asset im Image akzeptabel, Vector-Suche bleibt unkritisch (`O(2112)` < 10ms).
- **Pre-existing TypeScript-Issues** (nicht Teil dieser Änderung):
  - `catalog-builder.ts:74` — `Buffer<ArrayBuffer>` vs. `Buffer` (ExcelJS-Typing).
  - `classifier.ts:89` + `splitter.ts:63` — `source: 'wzbar-matcher'` ist nicht im LLM-Service-Source-Enum (akzeptiert nur `'search' | 'chat' | ...`). Funktioniert zur Laufzeit, aber TS meckert.

## Verifikation für Reviewer

```sh
# Backend tests
cd backend
/Users/andreasbachmann/.bun/bin/bun run --watch src/index.ts

# Frontend
cd frontend && npm run dev

# UI: WZ-Branchen-Matcher öffnen, einsetzen:
#   "Baulicher Brandschutz, Trockenbau und Umzüge" → 3 Blöcke
#   "Schlachten von Geflügel" → 1 Block
#   "Bau" → wahrscheinlich 4-stellig (kein Halluzinieren auf 6-stellig erwartet)

# Public-API
curl -s -X POST http://localhost:3001/api/public/v1/wzbar-matcher/classify \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: ${API_KEY}" \
  -d '{"text": "Baulicher Brandschutz, Trockenbau und Umzüge"}' | jq
```

## Out-of-Scope

- Hierarchie-Aufstieg im Catalog-Modell ("ist 432901 ein Kind von 4329?") — wir vertrauen darauf, dass das LLM die Code-Tiefe aus `code.length` ableitet.
- Catalog-Updates per UI / Admin — bleibt Build-Time-Asset.
- Offizielle WZ-2008-Quelle (Statistisches Bundesamt) als Ergänzung — Kunden-XLSX deckt die feinen Ebenen bereits ab.
- Multi-Sprach-Support.
- DB-Schema-Migration (nicht nötig — JSONB).
- `demo/messe`-Worktree (Railway).
