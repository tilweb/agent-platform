# Dokumenten-Extraktions-Pipeline

**Datum**: 2026-03-13
**Status**: Implementiert

## Kontext

Strukturierte Datenextraktion aus unstrukturierten Dokumenten war bisher individuell geloest (spezifische Prompts, Regex-JSON-Parsing). Die neue Pipeline bietet eine einzige, konfigurierbare Loesung mit YAML-Profilen.

## Architektur-Entscheidungen

### Function Calling statt Regex-JSON-Parsing
- OpenAI Function Calling (`tool_choice: forced`) erzwingt valides JSON vom LLM
- Fallback auf Regex-Extraktion fuer Modelle ohne Function-Calling-Support
- `toolChoice` Parameter durch LLM-Service → OpenAI-Adapter durchgereicht

### 5-Stufen-Pipeline
1. **Ingest**: Dokument annehmen (Attachment, Datei, Rohtext)
2. **Resolve**: Profil bestimmen (explizit oder Keyword-Auto-Detection)
3. **Prepare**: Vision-LLM fuer Bilder, Markitdown fuer PDFs/DOCX
4. **Extract**: LLM mit forced Function Calling
5. **Validate + Retry**: Typ-Pruefung, Auto-Korrektur, max 2 Retries

### Vision-Pipeline (Zwei-Schritt)
- Vision-LLM (Mistral 3 24B) beschreibt das Bild als Text
- Chat-LLM (Qwen3 30B) extrahiert strukturiert aus dem Text
- Grund: Chat-LLM hat besseres Function Calling als Vision-LLM

## Neue Dateien

| Datei | Zweck |
|-------|-------|
| `backend/src/extraction/types.ts` | TypeScript-Typen |
| `backend/src/extraction/profiles.ts` | Profil-CRUD + Auto-Detection |
| `backend/src/extraction/schema-builder.ts` | Profil → OpenAI Function Schema |
| `backend/src/extraction/validator.ts` | Validierung + Auto-Korrektur |
| `backend/src/extraction/service.ts` | Pipeline-Orchestrierung |
| `backend/src/extraction/index.ts` | Re-Exports |
| `backend/src/tools/special/extract-document.ts` | Agent-Tool |
| `backend/src/routes/extraction.ts` | REST API Routes |
| `frontend/src/pages/ExtractionProfilesPage.jsx` | Frontend UI |
| `data/extraction-profiles/lieferschein.yaml` | Beispielprofil |

## Geaenderte Dateien

| Datei | Aenderung |
|-------|-----------|
| `backend/src/services/llm.ts` | `ChatOptions.toolChoice` hinzugefuegt |
| `backend/src/services/llm/adapters/openai.ts` | `toolChoice` Parameter in `chat()` |
| `backend/src/services/usageTracking.ts` | `'extraction'` Source |
| `backend/src/tools/special/index.ts` | `ExtractDocumentTool` Export |
| `backend/src/tools/index.ts` | Tool-Registrierung |
| `backend/src/index.ts` | Route-Mounting + Profile-Loading |
| `frontend/src/App.jsx` | Route `/extraction` |
| `frontend/src/components/Sidebar.jsx` | Menuepunkt + Icon |

## API Endpoints

- `GET /api/extraction/profiles` — Alle Profile auflisten
- `GET /api/extraction/profiles/:id` — Einzelnes Profil
- `POST /api/extraction/profiles` — Neues Profil erstellen
- `PUT /api/extraction/profiles/:id` — Profil aktualisieren
- `DELETE /api/extraction/profiles/:id` — Profil loeschen
- `POST /api/extraction/extract` — Extraktion ausfuehren (JSON oder FormData)
- `POST /api/extraction/detect` — Profil auto-erkennen

## Profil-Format

Profile in `data/extraction-profiles/*.yaml` definieren:
- `id`, `name`, `description`, `version`
- `detection.keywords` fuer Auto-Erkennung
- `fields` mit Gruppen (Object oder Array mit `_array: true`)
- Feldtypen: `text`, `number`, `date`, `boolean`
- `guidelines` als Freitext-Anweisungen fuer das LLM

## Validator Auto-Korrekturen

- Deutsche Zahlen: `1.234,56` → `1234.56`
- Deutsche Daten: `15.03.2024` → `2024-03-15`
- String-Booleans: `"ja"` → `true`
- Zahlen in Text-Feldern: `42` → `"42"`
