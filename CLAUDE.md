# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Adacor Workplace is a multi-user AI workplace with a React+Vite frontend and Bun+Hono backend. It features multi-provider LLM orchestration, an extensible tool ecosystem, RAG-based knowledge base, OAuth integrations, task queues, and image generation.

## Development Commands

### Backend (Bun + Hono)
```bash
cd backend
bun install              # Install dependencies
bun run dev              # Dev server with hot reload (port 3001)
bun run start            # Production mode
bun test                 # Run tests (bun:test)
```

### Frontend (React 19 + Vite)
```bash
cd frontend
npm install              # Install dependencies
npm run dev              # Dev server (port 5173)
npm run build            # Production build (output: dist/)
npm run lint             # ESLint
npm run preview          # Preview production build
```

### Environment Setup
```bash
cp .env.example .env    # Eine einzige .env im Root — alle Konfiguration hier
```

## Architecture

### Stack
- **Backend**: TypeScript, Bun runtime, Hono framework. Uses file-based persistence (YAML/Markdown/JSON in `data/`), no database.
- **Frontend**: JavaScript/JSX, React 19, Vite, React Router v7. Inline styles using `theme.js` design system. No CSS framework.

### Key Backend Components (`backend/src/`)
- **`routes/`** — Hono route handlers (chat, agents, auth, tasks, knowledge, providers, connections, rbac, tables, images, etc.)
- **`services/`** — Business logic (LLM orchestration, agent execution, task queue, memory, search/indexing, image generation, document import/export, audit logging)
- **`tools/`** — Tool registry with categories: local (file ops), API (web search, image gen), knowledge (RAG), tables, special (agent delegation), custom (user-defined, SSRF-protected), MCP
- **`agents/loop.ts`** — Agentic execution loop with tool calling and streaming
- **`middleware/`** — CORS, rate limiting, CSRF, security headers, SSRF protection
- **`mcp/`** — Model Context Protocol client (connects to MCP servers, dual-mode: local stdio or remote via MCP Runner)

### Key Frontend Components (`frontend/src/`)
- **`pages/`** — Route targets (ChatPage, SettingsPage, SearchPage, apps, etc.)
- **`components/`** — Reusable UI (ChatWindow, Sidebar, Icons, GeneratedImage, etc.)
- **`hooks/`** — 23+ custom hooks for business logic
- **`context/`** — React Context providers (Auth, Agent, Notification)
- **`config/theme.js`** — Complete design system (colors, typography, spacing, shadows)
- **`utils/apiFetch.js`** — API client with credentials handling

### Data Layer (`data/`)
All persistence is file-based. Key directories: `config/` (providers.yaml, settings), `chats/`, `agents/`, `skills/`, `tasks/`, `knowledge-base/`, `auth/`, `connections/` (encrypted OAuth tokens).

### MCP Runner (`mcp-runner/`)
Optional dedicated container for running MCP server processes in isolation. Backend communicates via HTTP instead of spawning child processes directly. Dual-mode: without `MCP_RUNNER_URL` everything runs locally as before.

### Deployment (`helm/`, `docker-compose.yml`)
- **Local Dev**: `bun run dev` + `npm run dev`
- **Docker Compose**: `docker-compose.yml` mit Frontend (nginx), Backend (Bun), MCP Runner, Proxy
- **Kubernetes**: Helm Chart unter `helm/adacor-workplace/` mit Ingress, ConfigMap/Secret, PVC. MCP Runner optional via `mcpRunner.enabled`

### Multi-Provider LLM System
Configured in `data/config/providers.yaml`. Supports Adacor AI, OpenAI, Anthropic, Ollama, Nebius, Google Gemini. Each model declares capabilities (chat, vision, function_calling). Provider adapters in `backend/src/services/llm.ts`.

## Git & Attribution

- **Keine Co-Author Attribution**: Commits und PRs dürfen KEIN `Co-Authored-By`-Tag für Claude enthalten. Die Attribution-Settings in `.claude/settings.json` sind bewusst leer gesetzt und müssen respektiert werden.

## Coding Conventions

### Language
- **UI text**: German
- **Code/variables**: English

### Backend
- Always use **Bun** (not Node.js) — `bun run`, `bun install`, `bun test`
- `.env` liegt im **Root** (nicht `backend/`). Bun lädt sie via `--env-file=../.env` (siehe `package.json`). Kein dotenv verwenden
- Prefer `Bun.file` over `node:fs` readFile/writeFile
- Use Hono (not Express) for routing

### Frontend
- **Inline styles** with JS objects, always reference `theme.js` values — no hardcoded colors/spacing
- Define styles as `const styles = {}` at the top of each file
- Use **SVG icons** from `components/Icons.jsx` — no emojis (except country flags)
- API calls must use `apiFetch` utilities (`apiGet`, `apiPost`, `apiPut`, `apiDelete` from `utils/apiFetch.js`)
- Pages that can be embedded in Settings must support an `embedded` prop to hide their standalone header
- See `frontend/CLAUDE.md` for detailed component patterns (tabs, buttons, cards, toggles, modals, forms, sidebar navigation, status badges, app detail headers)
- **Design-Konsistenz**: Keine neuen UI-Patterns erfinden — immer die in `frontend/CLAUDE.md` dokumentierten Patterns verwenden. Bei Unsicherheit nachfragen statt eigene Lösungen bauen
- **Design-Audit nach Frontend-Änderungen**: Nach Abschluss von Frontend-Änderungen (Edit/Write auf `frontend/src/**/*.jsx` oder `*.js`) **immer** den `design-auditor` Subagent ausführen (`Task`-Tool, `subagent_type: design-auditor`). Der Audit prüft die geänderten Dateien auf Design-Violations. Nicht nach jedem einzelnen Edit, sondern einmal nach Abschluss der aktuellen Aufgabe

## Claude Code Tooling

Dieses Projekt nutzt erweiterte Claude Code Features für automatisierte Qualitätssicherung.

### Subagenten (`.claude/agents/`)

Spezialisierte Agenten, die mit `Task`-Tool oder direkt von Claude Code aufgerufen werden. Jeder hat eigenes Model, Tools, und Memory.

| Agent | Zweck | Model | Read-Only |
|-------|-------|-------|-----------|
| `type-fixer` | TypeScript-Fehler systematisch fixen | sonnet | Nein |
| `test-writer` | bun:test Testdateien generieren | sonnet | Nein |
| `security-scanner` | Sicherheitslücken finden | haiku | Ja (+ safe Bash) |
| `api-contract-checker` | Frontend↔Backend API-Contracts validieren | haiku | Ja |
| `dead-code-finder` | Unused Exports, orphaned Files finden | haiku | Ja (+ Bash) |
| `migration-checker` | Cross-Codebase Renames verifizieren | haiku | Ja |
| `design-auditor` | Frontend Design-Konsistenz prüfen | haiku | Ja |
| `consistency-auditor` | Duplikate und Pattern-Abweichungen finden | haiku | Ja |
| `auth-auditor` | Auth-Middleware-Abdeckung aller Routes prüfen | haiku | Ja |

**Subagent-Dateiformat** (`.claude/agents/<name>/<name>.md`):
```yaml
---
name: agent-name
description: Beschreibung (wird in Agent-Auswahl angezeigt)
tools: Read, Grep, Glob       # Erlaubte Tools
disallowedTools: Write, Edit   # Verbotene Tools (optional)
model: haiku                   # haiku | sonnet | opus
memory: project                # project (shared) | local (agent-only)
hooks:                         # Optional: PreToolUse/PostToolUse Hooks
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "..."
---
Prompt-Inhalt für den Agenten...
```

**Memory-Typen**:
- `project` — Shared mit dem Hauptagenten, persistiert in `.claude/memory/`
- `local` — Nur für diesen Agenten sichtbar, eigener Speicher

### Skills (`.claude/skills/`)

Benutzerdefinierte Skills, aufrufbar via `/skill-name`. Liegen als `SKILL.md` in `.claude/skills/<name>/`. Skills sind das bevorzugte Format gegenüber Commands (`.claude/commands/`), da sie YAML-Frontmatter (description, argument-hint, disable-model-invocation), Begleitdateien und automatische Entdeckung durch Claude unterstützen.

**Immer Skills statt Commands verwenden** — neue Automatisierungen als `.claude/skills/<name>/SKILL.md` anlegen, nicht als `.claude/commands/<name>.md`.

| Skill | Zweck | Auto-Invoke |
|-------|-------|-------------|
| `app` | Backend + Frontend starten/stoppen/neustarten | Nein |
| `release` | Version Bump, Changelog, Quality Gate, Build | Nein |
| `quality-gate` | 6-Kategorien-Audit mit Ampel-Ergebnis | Ja |
| `update-docs` | Anwenderdoku mit Code-Stand abgleichen | Nein |
| `critical-code-audit` | 9-Bereiche Code-Audit | Ja |
| `auth-audit` | Endpunkt-Auth-Matrix | Ja |
| `design-audit` | Frontend Design-Violations | Ja |
| `consistency-audit` | Duplikate, Pattern-Abweichungen | Ja |
| `api-audit` | Frontend↔Backend API-Konsistenz | Ja |
| `test-scaffold` | Test-Boilerplate generieren | Nein |
| `test-coverage` | Testabdeckung analysieren + fixen | Nein |
| `dependency-audit` | Dependencies auf Sicherheit/Aktualität prüfen | Ja |

**Skill-Dateiformat** (`.claude/skills/<name>/SKILL.md`):
```yaml
---
name: skill-name
description: Kurzbeschreibung (Claude nutzt dies für Auto-Invoke)
argument-hint: "[arg1|arg2]"          # Optional: Autocomplete-Hinweis
disable-model-invocation: true        # Optional: Nur manuell aufrufbar
---

Prompt-Inhalt für den Skill...
$ARGUMENTS wird durch übergebene Argumente ersetzt.
```

### Hooks (`.claude/hooks/`)

Event-basierte Shell-Befehle, die automatisch bei bestimmten Aktionen ausgeführt werden:
- **PreToolUse** — Vor Tool-Ausführung (z.B. Bash-Befehle validieren)
- **PostToolUse** — Nach Tool-Ausführung (z.B. Lint nach Edit)
- **Notification** — Bei Benachrichtigungen

### Settings (`.claude/settings.json`)

Projekt-spezifische Claude Code Konfiguration: erlaubte/verbotene Tools, Modell-Defaults, Permissions. Wird per `settings.local.json` lokal überschrieben.
