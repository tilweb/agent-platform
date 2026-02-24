# Plattform-Architektur

Adacor Workplace ist eine Multi-User AI-Plattform mit React+Vite Frontend und Bun+Hono Backend. Alle Daten werden dateibasiert gespeichert (kein Datenbank-Server erforderlich).

## Stack

| Schicht | Technologie |
|---------|------------|
| **Runtime** | Bun (TypeScript) |
| **Backend-Framework** | Hono |
| **Frontend** | React 19 + Vite |
| **Persistenz** | YAML, Markdown, JSON in `data/` |
| **Auth** | JWT-basiert (Cookie + Bearer) |
| **Deployment** | Docker Compose / Kubernetes (Helm) |

## Backend-Komponenten

```
backend/src/
├── routes/          HTTP-Endpunkte (Hono Router)
├── services/        Business-Logik (LLM, Memory, Tasks, Search, Images)
├── agents/          Agent-Loop mit Tool-Calling und Streaming
├── tools/           Tool-Registry mit Kategorien (local, api, mcp, connection, ...)
├── skills/          Skill-System (Loader, Workflow, Aktivierung)
├── mcp/             MCP Client + Server-Anbindung
├── plugins/         Plugin-Infrastruktur (SDK, Loader, Registry)
├── connections/     Connection-Provider (OAuth, Token-Management)
├── middleware/      CORS, Rate-Limiting, CSRF, Security-Headers, SSRF
├── apps/            Built-in Applications (Vertrags-/Projektmanagement)
├── spaces/          Space-Kontexte (isolierte Arbeitsbereiche)
├── rbac/            Rollenbasierte Zugriffskontrolle
├── auth/            Authentifizierung (JWT, Sessions)
└── config/          Plattform-Konfiguration
```

## Frontend-Komponenten

```
frontend/src/
├── pages/           Route-Ziele (ChatPage, SettingsPage, SearchPage, Apps)
├── components/      Wiederverwendbare UI (ChatWindow, Sidebar, Icons)
├── hooks/           23+ Custom Hooks für Business-Logik
├── context/         React Context Provider (Auth, Agent, Notification)
├── config/theme.js  Design-System (Colors, Typography, Spacing, Shadows)
└── utils/           API-Client (apiFetch), Hilfsfunktionen
```

## Datenschicht

Alle Daten liegen im `data/`-Verzeichnis als YAML, Markdown oder JSON. Kein Datenbank-Server erforderlich.

```
data/
├── providers/          LLM-Provider (je ein Verzeichnis mit provider.yaml + Logo)
├── config/             System-Konfiguration (Settings, MCP-Server, Custom-Tools)
├── chats/              Chat-Verläufe (pro User, Sharding nach Datum)
├── agents/             Agent-Konfigurationen (Markdown + YAML Frontmatter)
├── skills/             Skill-Definitionen (SKILL.md)
├── tasks/              Task-Queue (pending, completed, failed)
├── knowledge-base/     Wissensbasis-Sammlungen
├── connections/        Connector-Plugins + verschlüsselte Tokens
├── auth/               User-Daten und Sessions
└── tables/             Strukturierte Daten (CSV/JSON)
```

## Startup-Sequenz

Beim Start des Backends (`backend/src/index.ts`) wird in folgender Reihenfolge initialisiert:

```
1. registerCommands()           Slash-Commands registrieren
2. runShardingMigration()       Einmalige Daten-Migrationen
3. llmService.initialize()      LLM-Provider laden und konfigurieren
4. syncAdacorModels()           Adacor-Modelle synchronisieren (non-blocking)
5. imageGenerationService       Bildgenerierung initialisieren
6. setupTools()                 Basis-Tools registrieren (local, api, knowledge, ...)
7. loadAllPlugins()             Connector-Plugins laden und registrieren
8. mcpManager.initialize()      MCP-Server verbinden und Tools registrieren
9. recoverTasks()               Unterbrochene Tasks wiederherstellen
10. startExecutor()             Task-Executor starten
```

Danach werden Middleware und Routes konfiguriert:

```
Middleware-Pipeline:
  Logger -> CORS -> Security-Headers -> Rate-Limit -> CSRF -> Body-Limit
```

## Request-Flow

### Standard-API-Request

```
HTTP Request
  -> Middleware-Pipeline (Logger, CORS, Security, Rate-Limit, CSRF)
  -> Auth-Middleware (JWT-Validierung)
  -> Route-Handler
  -> Service-Layer (Business-Logik)
  -> Datei-Persistenz (YAML/JSON in data/)
  -> JSON Response
```

### Chat-Flow (Streaming)

```
POST /api/chat
  -> Auth + Agent-Resolution
  -> Skill-Matching (optional)
  -> Agent-Loop:
     1. System-Prompt aufbauen (Agent-Config + User-Memory + Skill-Kontext)
     2. LLM-Streaming starten
     3. Tool-Calls erkennen und ausführen
     4. Tool-Ergebnisse zurück an LLM
     5. Iteration bis fertig (max 5 / max 15 für Supervisor)
  -> SSE Response (Events: thinking, response_chunk, tool_start/end, done)
```

### Delegation-Flow

```
Supervisor-Agent
  -> delegate_to_agent Tool-Call
  -> Neuer Agent-Loop (eigene Session, eigenes Modell)
  -> Tool-Ausführung im delegierten Kontext
  -> Ergebnis zurück an Supervisor
  -> MAX_DELEGATION_DEPTH = 2
```

## Middleware-Pipeline

| Middleware | Zweck |
|-----------|-------|
| `logger` | Request-Logging |
| `cors` | Cross-Origin (nur wenn `FRONTEND_URL` gesetzt) |
| `securityHeaders` | CSP, X-Frame-Options, HSTS |
| `apiRateLimit` | 100 req/min pro IP (konfigurierbar) |
| `csrfProtection` | Double-Submit-Cookie für state-changing Requests |
| `bodyLimit` | Max Body-Size (Standard: 10 MB) |
| `authMiddleware` | JWT-Validierung (pro Route aktiviert) |

## API-Routen-Übersicht

| Pfad | Modul | Beschreibung |
|------|-------|-------------|
| `/api/auth` | auth | Registrierung, Login, Session |
| `/api/chat` | chat | Chat-Streaming, Tool/Skill/MCP-Endpoints |
| `/api/chats` | chat | Chat-Verlauf, Attachments |
| `/api/agents` | agents | Agent-CRUD + RBAC |
| `/api/skills` | skills | Skill-Verwaltung |
| `/api/tools` | tools | Tool-Listing |
| `/api/custom-tools` | tools | Custom-API-Tools CRUD |
| `/api/mcp` | mcp | MCP-Server-Verwaltung |
| `/api/providers` | providers | LLM-Provider + Modelle |
| `/api/connections` | connections | OAuth-Verbindungen |
| `/api/plugins` | plugins | Plugin-Verwaltung |
| `/api/knowledge` | knowledge | Wissensbasis |
| `/api/memory` | memory | User-Memory |
| `/api/tasks` | tasks | Task-Queue |
| `/api/tables` | tables | Strukturierte Daten |
| `/api/search` | search | Volltextsuche |
| `/api/spaces` | spaces | Arbeitsbereiche |
| `/api/apps` | apps | App-Framework |
| `/api/images` | images | Bildgenerierung |
| `/api/users` | users | Benutzerverwaltung |
| `/api/resources` | rbac | Ressourcen-Zugriffskontrolle |
| `/api/docs` | docs | Dokumentation |
| `/health` | - | Health-Check (ohne Auth) |

## Deployment

### Lokal (Entwicklung)

```bash
cd backend && bun run dev    # Port 3001
cd frontend && npm run dev   # Port 5173 (Proxy auf 3001)
```

### Docker Compose

```
docker-compose.yml:
  - Frontend (nginx)
  - Backend (Bun)
  - MCP Runner (optional)
  - Proxy
```

### Kubernetes

```
helm/adacor-workplace/:
  - Ingress, ConfigMap/Secret, PVC
  - MCP Runner optional via mcpRunner.enabled
```
