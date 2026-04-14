# Agent Platform

Minimale Agent-Plattform mit React+Vite Frontend und Bun+Hono Backend. Deutsch-zentrisch.

## Tech Stack

- **Backend**: Bun + Hono (Port 3001), TypeScript
- **Frontend**: React 19 + Vite 7 (Port 5173), JSX, Inline-Styles mit theme.js
- **Persistence**: File-based (YAML/JSON/Markdown) - keine Datenbank
- **Streaming**: SSE (Server-Sent Events) fuer Chat
- **Auth**: Cookie-based Sessions, Argon2id Hashing

## Bun Pfad

Bun ist nicht im PATH. Verwende den vollstaendigen Pfad:

```sh
/Users/andreasbachmann/.bun/bin/bun
```

- Backend starten: `/Users/andreasbachmann/.bun/bin/bun run --watch src/index.ts` (im backend/)
- Frontend starten: `npm run dev` (im frontend/)
- Dependencies: `bun install` (backend), `npm install` (frontend)

## Architektur

### Backend (`backend/src/`)

| Komponente | Datei | Beschreibung |
|-----------|-------|-------------|
| Entry Point | `index.ts` | Hono App, Middleware, Route-Registrierung |
| Agent Loop | `agents/loop.ts` | Agentic Loop (5 Iter. main, 10 delegiert, 15 Supervisor) |
| LLM Service | `services/llm.ts` | Multi-Adapter LLM (OpenAI-compat + Ollama) |
| Tool Registry | `tools/registry.ts` | Zentrale Tool-Verwaltung |
| Skills | `skills/` | loader, matcher, activator, workflow |

### Tool-Typen

1. **Local**: file_read, file_write, file_list
2. **API**: web_search, web_fetch, image_generation, image_edit
3. **Knowledge**: kb_search, kb_index, kb_manage
4. **Tables**: table_list, table_query, table_add, table_update, table_delete
5. **Special**: delegate_to_agent, load_skill, user_memory, create_task, read_chat_attachment, export_document
6. **Custom**: REST API Tools (JSON-konfiguriert)
7. **MCP**: Model Context Protocol Tools

### Agent Loop Flow

1. Agent Resolution (ID, Supervisor-Routing, oder Fallback "general")
2. Model Resolution (locked model > ENV config > user pref > system default > per-chat override)
3. Context Injection (Language, DateTime, ProjectMemory, ImageAnalysis, SystemPrompt, Skills, Readers)
4. Iteration Loop: Stream LLM -> Parse Tool Calls -> Execute -> Add to History
5. Delegation Support (max Tiefe 2, 10 Iterationen, Synthese-Fallback bei leerem Ergebnis)

### Frontend (`frontend/src/`)

- Inline-Styles mit `theme.js` Werten (KEINE hardcoded Farben)
- `apiFetch` Utility fuer alle API-Calls (credentials: include)
- Lazy-loaded Pages, React Router v7
- UI-Texte: Deutsch, Code/Variablen: Englisch
- SVG Icons statt Emojis (Icons.jsx)

## Datenstruktur (`data/`)

- `config/`: providers.yaml, agents.md, tools.md, settings.md
- `agents/`: Agent-Konfigurationen (YAML Frontmatter + Markdown System-Prompt)
- `skills/custom/`: Custom Skills
- `auth/`: users, sessions, groups
- `knowledge-base/`: collections, incoming, prompts, indexer
- `tools/`: Custom API Tool-Definitionen (JSON)
- `chats/`, `conversations/`: Chat-Persistenz
- `tables/`: Schema + Daten Tabellen
- `tasks/`: Task-Queue

## Workflow

- **Changelog pflegen**: Bei jedem Feature, Bugfix oder relevanter Aenderung einen Eintrag in `CHANGELOG.md` (Projekt-Root) hinzufuegen. Format: Datum + Feature-Beschreibung.
- **Plan-Dokumentation**: Nach Abschluss einer Plan-Mode-Implementierung IMMER ein Dokument unter `docs/` ablegen. Dateiname: `<thema>-<datum>.md`. Inhalt: Kontext, Entscheidungen, Aenderungen, Messergebnisse. Plan-Dateien aus dem Plan-Modus sind nur temporaer — das Dokument in `docs/` ist die dauerhafte Referenz.
- **Keine neuen Dependencies** ohne Rueckfrage
- **Prefer Bun** ueber Node.js (siehe `backend/CLAUDE.md` fuer Details)

## Aktive LLM Provider

- Chat: Adacor AI - Qwen3 30B (api_mode: openai)
- Vision: Adacor AI - Mistral 3 24B
- STT: Adacor AI Audio - Whisper V3
- Text-to-Image: (kein aktiver Provider — Nebius Flux deprecated)
- Image-to-Image: Google Gemini 2.5 Flash
