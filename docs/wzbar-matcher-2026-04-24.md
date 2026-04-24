# WZ-Branchen-Matcher — Implementierungsdokumentation

**Datum:** 2026-04-24
**Branch:** demo/messe
**Status:** MVP live (unverifiziert mit Echtdaten — Testdaten folgen 2026-04-25)

## Kontext & Problemstellung

Die IHK arbeitet mit der offiziellen Wirtschaftszweigklassifikation WZ 2008 (Schlüsselkatalog mit 3.021 Einträgen in hierarchischer Gliederung 1- bis 4-stellig). Beim Anlegen eines Unternehmens in EMMA müssen 1-3 passende 4-stellige Schlüssel zu einer freien Tätigkeitsbeschreibung aus dem Handelsregister zugeordnet werden. Die IHK-eigene GPT-basierte Lösung liefert unzuverlässige Ergebnisse und ist nicht für volumige Workflows geeignet.

**Ziel:** Eine dedizierte, copy-paste-freundliche App im Agent-Platform-Workplace, die einen Tätigkeitstext zuverlässig auf den passendsten 4-stelligen WZ-Schlüssel plus sinnvolle Alternativen mit Konfidenz abbildet.

## Entscheidungen

1. **Granularität:** 4-stellige Klassen-Codes als Primär-Output. Gröbere Ebenen (2-/3-stellig) werden beim Import ignoriert.
2. **Abgelaufene Codes:** via `Gültig bis` gefiltert (beim Katalog-Build, nicht zur Laufzeit).
3. **Mehrfach-Matches:** Primary + bis zu 3 Alternativen, sortiert nach Konfidenz.
4. **Feedback-Loop:** zunächst nicht implementiert; Audit-Log enthält alle nötigen Rohdaten für spätere Evaluation.
5. **Audit:** jede Anfrage wird vollständig als YAML persistiert (Input, Top-K-Retrieval-Scores, LLM-Output, Modelle, Latenz).
6. **Dedizierte App statt Chat-Agent:** aufgrund des hochvolumigen, fokussierten Use-Cases und der Copy-Paste-Anforderung für EMMA.
7. **Zweistufige Pipeline:** Embeddings + Cosine-Similarity filtern den 3.021er-Katalog auf die 20 plausibelsten Kandidaten; ein LLM-Call mit Forced Function Calling ranked und erläutert die finale Auswahl.

## Pipeline

```
Input-Text
    │
    ▼
[1] llmService.embed(input)   →  1024-dim Vektor (multilingual-e5-large via Adacor)
    │
    ▼
[2] topK(query, catalog, 20)  →  20 Kandidaten (Cosine-Similarity in-memory)
    │
    ▼
[3] LLM re-rank (Qwen3 30B, OpenAI-kompatibles Function Calling, forced toolChoice)
    │     Output: {primary: {code, confidence, reasoning}, alternatives: [...]}
    ▼
[4] sanitizeResult           →  hält nur Codes aus Top-20, clampt Konfidenz, sortiert
    │
    ▼
[5] saveMatch → matches/<id>.yaml
    │
    ▼
Response an Frontend
```

Latenzen (gemessen lokal gegen Adacor):
- Embed: ~100-200 ms
- LLM Re-Rank: ~2000-3500 ms
- **Gesamt: 2-4 s pro Anfrage**

## Datenflüsse & Persistenz

| Datei / Pfad | Zweck | Erzeugt durch | Im Volume? |
|--------------|-------|----------------|-----------|
| `docs/WZBAR-Schluesseltabelle.xlsx` | Rohdaten (3.021 Zeilen) | User-Drop | — |
| `backend/src/apps/wzbar-matcher/assets/catalog.json` | 662 gefilterte 4-stellige Codes | `catalog-builder.ts` | nein — im Image |
| `backend/src/apps/wzbar-matcher/assets/embeddings.json` | 662 × 1024-dim Vektoren (~14 MB) | `catalog-builder.ts` | nein — im Image |
| `backend/data/apps/wzbar-matcher/matches/<id>.yaml` | Audit-Log pro Anfrage | Runtime | ja — via Symlink auf `/app/data/backend-data/` |

**Bewusste Trennung System-Assets vs. User-Daten:** Katalog und Embeddings sind Systemdaten, die deterministisch aus der xlsx gebaut werden — sie gehören ins Container-Image (`COPY backend/src/` im Dockerfile), nicht ins Volume. So werden sie bei jedem Deploy automatisch mit der aktuellen Image-Version ausgeliefert, ohne dass man im Volume manuell eingreifen muss. Nur `matches/` (Audit-Trail) liegt im Daten-Volume und bleibt über Deploys erhalten.

**Idempotenz:** Der Builder hasht den Katalog-Input und überspringt die Embedding-Regeneration, wenn der Hash unverändert ist. `--force` erzwingt einen Rebuild, `--catalog-only` skippt Embeddings.

## Umgesetzte Änderungen

### Backend

- **neu**: `backend/src/apps/wzbar-matcher/` — App-Modul mit Standardlayout (`index.ts`, `routes.ts`, `service.ts`, `storage.ts`, `types.ts`, `retrieval.ts`, `classifier.ts`, `catalog-builder.ts`)
- **modifiziert**: `backend/src/routes/apps.ts` — Route-Mount + AppId-Ausnahme in Sub-Route-Filter
- **modifiziert**: `backend/src/services/llm/adapters/openai.ts` — `embed(text, model)` hinzugefügt (OpenAI-kompatibles `/embeddings`-Endpoint, gleiche Retry-Logik wie `chat()`)
- **modifiziert**: `backend/src/services/llm.ts` — `embed(text)`-Wrapper ergänzt; nutzt `getPlatformModel('embeddings')`, cached Adapter pro Provider
- **modifiziert**: `backend/data/apps/registry.yaml` und `data/apps/registry.yaml` — App-Eintrag hinzugefügt
- **modifiziert**: `data/config/providers.yaml` — neuer Provider `adacor-embeddings` (Base-URL `https://api.adacor.ai/embeddings/privateai/v1`, Modell `multilingual-e5-large`)
- **modifiziert**: `backend/.env` + `.env.example` — `PLATFORM_EMBEDDINGS_PROVIDER_ID=adacor-embeddings`, `PLATFORM_EMBEDDINGS_MODEL_ID=multilingual-e5-large`

### Frontend

- **neu**: `frontend/src/apps/wzbar-matcher/MatcherPage.jsx` — Hauptseite
- **neu**: `frontend/src/apps/wzbar-matcher/components/MatchCard.jsx` — Ergebnis-Card mit Copy-Button + Konfidenz-Badge
- **neu**: `frontend/src/apps/wzbar-matcher/components/HistoryList.jsx` — Sidebar-Historie
- **modifiziert**: `frontend/src/App.jsx` — Lazy-Import + Route
- **modifiziert**: `frontend/src/components/Icons.jsx` — `ClassifierIcon` + `CopyIcon` + ICON_MAP-Registrierung
- **modifiziert**: `frontend/src/pages/AppsPage.jsx` — `ClassifierIcon` im Apps-Launcher-Switch

## API

| Method | Path | Payload | Response |
|--------|------|---------|----------|
| POST | `/api/apps/wzbar-matcher/match` | `{inputText: string}` | `{record: MatchRecord}` |
| GET | `/api/apps/wzbar-matcher/history?limit=20` | — | `{records: MatchRecord[]}` |
| GET | `/api/apps/wzbar-matcher/matches/:id` | — | `{record: MatchRecord}` |
| GET | `/api/apps/wzbar-matcher/status` | — | `{catalogSize, indexReady, embeddingModel, embeddingDimensions}` |

## Verifikationen (lokal ausgeführt)

**Katalog-Qualität:** Stichproben-OK — 662 4-stellige Codes, Reinigungs-Codes (8121/8122/8123/9610) und Kfz-Codes (9531/4781/etc.) korrekt enthalten.

**End-to-End-Pipeline (via `service.match()`):**
| Eingabe | Primary | Konfidenz | Alternativen |
|---------|---------|-----------|--------------|
| "Putzen und wachsen als Hausbesuche" | **9691** Erbringung haushaltsbezogener Dienstleistungen | 90 % | 8121 Allg. Gebäudereinigung (40 %), 8110 Hausmeisterdienste (25 %) |
| "Allgemeine Putz- und Reinigungsleistungen im Haushalt" | **9691** | 95 % | 8121 (40 %), 8110 (25 %) |
| "Autos bekleben und schicke machen" | **9531** Reparatur und Instandhaltung Kraftwagen | 85 % | 2932 Kfz-Teile (35 %), 2551 Beschichten Metalle (25 %) |
| "Errichtung und Betrieb eines Frisiersalons" | **9621** Frisör- und Barbiersalons | 100 % | — |

Alle qualitativ plausibel; Konfidenzen auch ohne Tuning im sinnvollen Bereich.

**HTTP-Endpoints:** Status, Match, History via `curl` verifiziert. Backend-Logs zeigen korrekte Model-Resolution (`adacor-embeddings/multilingual-e5-large` für Embeddings, `adacor/mistral-3-24b-128k` für das LLM).

**Frontend:** Vite-Dev-Server serviert alle Module (HTTP 200) — MatcherPage, MatchCard, HistoryList, Icons, App.

## Offene Punkte für den nächsten Tag (Echtdaten-Session)

1. Precision@1 und Recall@3 gegen IHK-Testdatensatz messen.
2. Falls Precision@1 < 80 %: Prompt-Tuning (System-Prompt), höheres `TOP_K`, oder Hybrid-Retrieval (Embedding × BM25).
3. Falls die Tätigkeitstexte extrem kurz sind: Query-Expansion (LLM-basiert) vor dem Embedding erwägen.
4. Feedback-Loop-UI: "Richtiger Code war X" → als YAML neben dem Audit speichern. Später für Evaluation/Fine-Tuning nutzbar.
5. Nach ersten Testdaten: Entscheidung, ob Codes mit `validFrom > today` (noch nicht gültige) ebenfalls gefiltert werden sollen — aktuell sind sie enthalten, weil die xlsx im heutigen Stand nur gültige enthält.

## Risiken

- Der Classifier-Service cached Katalog + Embeddings beim ersten Request im Module-Scope. Ein Neu-Laden der Kataloge erfordert einen Backend-Restart (oder eine kleine `POST /reload`-Route — nicht Teil des MVP).
- Die Embeddings-JSON ist ~14 MB — wird beim ersten Request einmal in den Speicher geladen. Für 662 Einträge unproblematisch; bei grösseren Katalogen müsste man sie aus einem SQLite/Parquet-Format streamen.
- Kein Auth-Check an der Route (userId hardcoded `'user_default'`). Konsistent mit den anderen Apps in dieser Codebase; bei ernsthafter Multi-User-Nutzung ausbaufähig.

## Aufruf-Referenz

```sh
# Katalog + Embeddings komplett neu bauen (aus backend/)
/Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/catalog-builder.ts

# Nur Katalog, keine Embeddings
/Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/catalog-builder.ts --catalog-only

# Rebuild erzwingen auch bei unverändertem Input-Hash
/Users/andreasbachmann/.bun/bin/bun run src/apps/wzbar-matcher/catalog-builder.ts --force

# Backend starten
/Users/andreasbachmann/.bun/bin/bun run --watch src/index.ts

# Frontend starten
cd ../frontend && npm run dev

# App im Browser
open http://localhost:5173/apps/wzbar-matcher
```
