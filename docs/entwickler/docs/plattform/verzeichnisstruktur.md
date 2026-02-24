# Verzeichnisstruktur

Vollständige Übersicht über die Projektstruktur des KI-Workplace.

## Projektroot

```
adacor-workplace/
├── backend/                Backend (Bun + Hono)
├── frontend/               Frontend (React 19 + Vite)
├── data/                   Datei-basierte Persistenz
├── mcp-runner/             Optionaler MCP-Server-Container
├── helm/                   Kubernetes Helm Chart
├── docs/                   Externe Dokumentation
│   ├── anwenderdoku/       Anwender-Handbuch
│   └── entwickler/         Entwickler-Dokumentation
├── .docs/                  Interne Dokumente (Audits, Konzepte, Pläne)
├── .env.example            Umgebungsvariablen-Vorlage
├── docker-compose.yml      Docker-Deployment
└── CLAUDE.md               Projekt-Instruktionen
```

## Backend (`backend/src/`)

```
backend/src/
├── index.ts                    Hono-App, Middleware, Route-Mounting, Startup
│
├── routes/                     HTTP-Endpunkte
│   ├── chat.ts                 Chat-Streaming + Tool/Skill/MCP-Endpoints
│   ├── agents.ts               Agent-CRUD mit RBAC
│   ├── knowledge.ts            Wissensbasis-Verwaltung
│   ├── providers.ts            LLM-Provider + Modelle
│   ├── connections.ts          OAuth-Verbindungen + Token-Management
│   ├── plugins.ts              Plugin-Verwaltung
│   ├── apps.ts                 App-Framework
│   ├── tasks.ts                Task-Queue
│   ├── tables.ts               Strukturierte Daten
│   ├── images.ts               Bildgenerierung
│   ├── search.ts               Volltextsuche
│   ├── memory.ts               User-Memory
│   ├── spaces.ts               Arbeitsbereiche
│   ├── auth.ts                 Authentifizierung
│   ├── rbac.ts                 Zugriffskontrolle
│   ├── users.ts                Benutzerverwaltung
│   ├── transcription.ts        Audio-Transkription
│   ├── attachments.ts          Datei-Attachments
│   ├── notifications.ts        Benachrichtigungen
│   ├── commands.ts             Slash-Commands
│   ├── admin.ts                Admin-Funktionen
│   └── docs.ts                 Dokumentation
│
├── services/                   Business-Logik
│   ├── llm.ts                  LLM-Orchestrierung (Multi-Provider, Streaming)
│   ├── agents.ts               Agent-Verwaltung (Load, Create, Update, Delete)
│   ├── memory.ts               Chat-Speicher (Session-basiert)
│   ├── userMemory.ts           Persistenter User-Speicher
│   ├── taskService.ts          Task-Erstellung und -Verwaltung
│   ├── taskExecutor.ts         Task-Ausführung (Queue-Worker)
│   ├── search.ts               Such-Service (Indizierung + Abfrage)
│   ├── imageGeneration.ts      Bildgenerierungs-Service
│   ├── documentFetcher.ts      Dokument-Import für Chat-Kontext
│   ├── usageTracking.ts        Nutzungs-Tracking
│   ├── providers.ts            Provider-Resolution + Model-Matching
│   ├── modelSync.ts            Adacor-Modell-Synchronisierung
│   └── auditLog.ts             Audit-Logging
│
├── agents/                     Agent-Execution
│   └── loop.ts                 Agent-Loop (Streaming, Tool-Calls, Delegation)
│
├── tools/                      Tool-System
│   ├── types.ts                Tool-Interfaces (Tool, ToolDefinition, ToolContext)
│   ├── registry.ts             ToolRegistry Singleton
│   ├── index.ts                Setup + Registrierung aller Tools
│   ├── base.ts                 Basisklassen (LocalTool, ApiTool, McpTool)
│   ├── config.ts               Tool-Konfiguration (API-Keys, etc.)
│   ├── local/                  Lokale Tools (file_read, file_write, file_list)
│   ├── api/                    API-Tools (web_search, generate_image, edit_image)
│   ├── knowledge/              Wissensbasis-Tools (kb_search, kb_index, kb_manage)
│   ├── tables/                 Tabellen-Tools (table_list, table_query, ...)
│   ├── special/                Spezial-Tools (delegate_to_agent, load_skill, ...)
│   └── custom/                 Custom-API-Tools (SSRF-geschützt)
│
├── skills/                     Skill-System
│   ├── types.ts                EnhancedSkill Interface + Typen
│   ├── loader.ts               Skill-Loader (YAML Frontmatter + Markdown)
│   ├── activator.ts            Skill-Aktivierung + Tool-Filterung
│   ├── workflow.ts             Workflow-Engine (Steps, Actions, Progress)
│   └── index.ts                Public API
│
├── mcp/                        Model Context Protocol
│   ├── types.ts                MCP-Typen (ServerConfig, ToolInfo, Connection)
│   ├── manager.ts              McpManager (Server-Verwaltung, Tool-Registrierung)
│   ├── client.ts               McpClient (Verbindungsmanagement)
│   ├── config.ts               MCP-Konfiguration (YAML-Persistenz)
│   ├── tool.ts                 McpToolWrapper (MCP-Tools -> ToolRegistry)
│   └── server/                 MCP-Server-Modus (eigene Tools exponieren)
│
├── plugins/                    Plugin-Infrastruktur
│   ├── sdk.ts                  @platform/sdk Barrel-Export
│   ├── loader.ts               Plugin-Loader (Manifest + Provider)
│   ├── registry.ts             Plugin-Registry (Aktivierung/Deaktivierung)
│   ├── configStorage.ts        Verschlüsselte Credential-Speicherung
│   ├── resolveOAuthConfig.ts   OAuth-Config-Resolution
│   ├── migrateEnvCredentials.ts ENV->Config Migration
│   └── types.ts                Plugin-Typen
│
├── connections/                Connection-Provider
│   ├── base/                   Abstrakte Basisklassen
│   │   ├── ConnectionProvider.ts  BaseConnectionProvider
│   │   └── OAuthProvider.ts       OAuthProvider (extends Base)
│   ├── types.ts                TokenSet, OAuth2Config, ConnectionTool
│   ├── registry.ts             ConnectionRegistry (Provider + Token-Verwaltung)
│   ├── crypto.ts               AES-256-GCM Verschlüsselung
│   └── storage.ts              Token-Persistenz
│
├── apps/                       Built-in Applications
│   ├── registry.ts             App-Registry (Enable/Disable/Reorder)
│   ├── vertragsmanagement/     Vertragsmanagement-App
│   └── projektmanagement/      Projektmanagement-App
│
├── spaces/                     Arbeitsbereiche
│   └── service.ts              Space-Kontext (Memory, KB-Injection)
│
├── rbac/                       Zugriffskontrolle
│   ├── accessControl.ts        canView/canEdit/canDelete Checks
│   └── storage.ts              RBAC-Persistenz
│
├── auth/                       Authentifizierung
│   └── index.ts                JWT, Middleware, Session-Verwaltung
│
├── middleware/                  HTTP-Middleware
│   ├── rateLimit.ts            API-Rate-Limiting
│   ├── csrf.ts                 CSRF-Schutz
│   ├── securityHeaders.ts      CSP, HSTS, X-Frame-Options
│   └── ssrf.ts                 SSRF-Schutz für Custom Tools
│
├── config/                     Plattform-Konfiguration
│   └── platformModels.ts       System-Agent-Modell-Zuordnung
│
├── commands/                   Slash-Commands
│   └── index.ts                Command-Registry
│
└── utils/                      Hilfsfunktionen
    ├── paths.ts                Pfad-Konstanten (AGENTS_DIR, SKILLS_DIR, etc.)
    ├── yamlStorage.ts          YAML-Lese/Schreib-Utilities (unterstützt bucketed-Modus)
    ├── dateBucket.ts           YYYY/MM-Bucket-Berechnung aus ID-Timestamps
    ├── migrateSharding.ts      Einmalige Migration: flache Dateien → YYYY/MM-Buckets
    └── errorHandler.ts         Einheitliche Fehler-Responses
```

## Frontend (`frontend/src/`)

```
frontend/src/
├── App.jsx                 Root-Komponente + Router
├── main.jsx                Entry-Point
│
├── pages/                  Route-Ziele
│   ├── ChatPage.jsx        Haupt-Chat-Seite
│   ├── SettingsPage.jsx    Einstellungen (Tab-basiert, Embedding)
│   ├── SearchPage.jsx      Volltextsuche
│   ├── LoginPage.jsx       Login/Registrierung
│   └── apps/               App-spezifische Seiten
│
├── components/             Wiederverwendbare UI-Komponenten
│   ├── ChatWindow.jsx      Chat-Fenster mit Streaming
│   ├── Sidebar.jsx         Navigations-Sidebar
│   ├── Icons.jsx           SVG-Icon-Bibliothek
│   ├── MessageContent.jsx  Nachrichten-Rendering
│   ├── AgentEvents.jsx     Agent-Event-Anzeige
│   └── ...
│
├── hooks/                  Custom React Hooks
│   ├── useChat.js          Chat-Logik + Streaming
│   ├── useAuth.js          Authentifizierung
│   ├── useAgents.js        Agent-Verwaltung
│   ├── useSettings.js      Einstellungen
│   └── ...                 23+ weitere Hooks
│
├── context/                React Context Provider
│   ├── AuthContext.jsx     Auth-State
│   ├── AgentContext.jsx    Aktiver Agent
│   └── NotificationContext.jsx  Benachrichtigungen
│
├── config/
│   └── theme.js            Design-System (Colors, Typography, Spacing)
│
└── utils/
    └── apiFetch.js         API-Client (apiGet, apiPost, apiPut, apiDelete)
```

## Datenverzeichnis (`data/`)

High-Volume-Verzeichnisse verwenden **datums-basiertes Sharding** (`YYYY/MM`-Unterverzeichnisse), um Performance-Degradierung bei großen Dateimengen zu vermeiden. Task-Ergebnisse (JSON) werden neben den Task-YAMLs im selben Bucket gespeichert. Beim Lesen wird zunächst der Bucket-Pfad versucht, dann ein Fallback auf den flachen Pfad (Rückwärtskompatibilität). Eine einmalige Migration (`migrateSharding.ts`) läuft beim Backend-Start.

```
data/
├── providers/                  LLM-Provider-Konfiguration
│   ├── active.yaml             Aktive Modell-Auswahl
│   └── <provider-id>/         Je ein Verzeichnis pro Provider
│       ├── provider.yaml       Provider-Config + Modelle
│       └── logo.png            Provider-Logo
│
├── config/                     System-Konfiguration
│   ├── settings.yaml           Allgemeine Einstellungen
│   ├── mcp-servers.yaml        MCP-Server-Konfiguration
│   └── custom-tools.yaml       Custom-API-Tools
│
├── chats/                      Chat-Verläufe (YYYY/MM-Sharding)
│   ├── chat-folders.yaml       Ordner-Struktur (flach, nicht geshardet)
│   └── YYYY/MM/
│       └── session_*.yaml      Chat-Sessions nach Monat
│
├── conversations/              Konversations-Markdown (YYYY/MM-Sharding)
│   └── YYYY/MM/
│       └── session_*.md        Exportierte Konversationen
│
├── agents/                     Agent-Konfigurationen
│   └── <agent-id>/
│       └── config.md           Markdown + YAML Frontmatter
│
├── skills/                     Skill-Definitionen
│   └── <skill-id>/
│       ├── SKILL.md            Skill-Definition (YAML Frontmatter + Instruktionen)
│       └── *.md                Optionale Knowledge-Dateien
│
├── tasks/                      Tasks + Ergebnisse (YYYY/MM-Sharding)
│   ├── queue.yaml              Task-Queue (flach, nicht geshardet)
│   └── YYYY/MM/
│       ├── task_*.yaml         Task-Definitionen
│       └── task_*-result.json  Task-Ergebnisse (neben zugehöriger Task)
│
├── generated-images/           Generierte Bilder (YYYY/MM-Sharding)
│   └── YYYY/MM/
│       ├── img_*.png/jpg/webp  Bilddateien
│       └── img_*.json          Bild-Metadaten
│
├── exports/                    Dokument-Exporte (YYYY/MM-Sharding)
│   └── YYYY/MM/
│       └── *_<timestamp>.*     Exportierte Dokumente (xlsx, pdf, docx)
│
├── knowledge-base/             Wissensbasis
│   └── <collection-id>/       Je eine Sammlung
│
├── connections/                Connector-Plugins + Tokens
│   ├── connectors/             Plugin-Verzeichnisse
│   │   └── <connector-id>/
│   │       ├── manifest.yaml   Plugin-Manifest
│   │       ├── provider.ts     Provider-Code
│   │       ├── credentials.yaml Verschlüsselte Credentials
│   │       └── tools/          Tool-Implementierungen
│   ├── tokens/                 Verschlüsselte User-Tokens
│   └── registry.yaml           Plugin-Status
│
├── auth/                       Authentifizierung
│   └── users.yaml              User-Daten
│
└── tables/                     Strukturierte Daten
    └── <table-id>/
```

## MCP Runner (`mcp-runner/`)

Optionaler Container für isolierte MCP-Server-Ausführung:

```
mcp-runner/
├── Dockerfile
├── package.json
└── src/
    └── index.ts        HTTP-API für MCP-Server-Management
```

## Plugin-Verzeichnis

Jedes Connector-Plugin unter `data/connections/connectors/` hat folgende Struktur:

```
data/connections/connectors/<plugin-id>/
├── manifest.yaml        Pflicht: Metadaten, OAuth-Config, Config-Schema
├── provider.ts          Pflicht: OAuthProvider-Klasse (export default)
├── config.ts            Optional: URL-Helpers
├── credentials.yaml     Automatisch: Verschlüsselte Credentials
└── tools/               Pflicht: Mindestens ein Tool
    ├── search.ts
    └── read-item.ts
```

Siehe [Plugin-Manifest](../plugins/manifest.md) für die vollständige Manifest-Referenz.
