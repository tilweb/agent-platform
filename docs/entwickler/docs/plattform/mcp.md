# MCP-Integration

Das Model Context Protocol (MCP) ermöglicht die Anbindung externer Tool-Server. Adacor Workplace unterstützt MCP sowohl als Client (externe MCP-Server nutzen) als auch als Server (eigene Tools exponieren).

## Dual-Modus

| Modus | Beschreibung |
|-------|-------------|
| **Client** | Verbindet sich mit externen MCP-Servern und registriert deren Tools |
| **Server** | Exponiert eigene Tools als MCP-Server für andere Clients |

## MCP Client

### McpManager

Der `McpManager` (`backend/src/mcp/manager.ts`) ist das zentrale Interface für MCP-Server-Verwaltung:

```typescript
class McpManager {
  initialize()                    // Alle konfigurierten Server verbinden
  shutdown()                      // Alle Verbindungen trennen

  connectServer(serverId)         // Einzelnen Server verbinden
  disconnectServer(serverId)      // Server trennen
  reconnectServer(serverId)       // Neu verbinden

  getServers()                    // Alle Server mit Status
  getServer(serverId)             // Einzelner Server
  addServer(config)               // Server hinzufügen
  updateServer(serverId, updates) // Server aktualisieren
  deleteServer(serverId)          // Server löschen
  toggleServer(serverId, enabled) // Aktivieren/Deaktivieren

  getAllTools()                    // Alle MCP-Tools
  getServerTools(serverId)        // Tools eines Servers
  refreshServerTools(serverId)    // Tool-Liste aktualisieren
  testTool(serverId, name, args)  // Tool testen
  callTool(serverId, name, args)  // Tool aufrufen
}
```

### Konfiguration

MCP-Server werden in `data/config/mcp-servers.yaml` konfiguriert:

```yaml
servers:
  - id: github
    name: GitHub
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}"
    enabled: true
    autoConnect: true
    timeout: 30000

  - id: filesystem
    name: Dateisystem
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/data"]
    enabled: true

  - id: brave-search
    name: Brave Search
    command: npx
    args: ["-y", "@modelcontextprotocol/server-brave-search"]
    env:
      BRAVE_API_KEY: "${BRAVE_API_KEY}"
    enabled: false
```

### McpServerConfig

```typescript
interface McpServerConfig {
  id: string;                    // Eindeutige Server-ID
  name: string;                  // Anzeigename
  command: string;               // Startbefehl (z.B. "npx", "node")
  args?: string[];               // Befehlsargumente
  env?: Record<string, string>;  // Umgebungsvariablen
  enabled?: boolean;             // Aktiviert (Standard: true)
  autoConnect?: boolean;         // Beim Start verbinden (Standard: true)
  timeout?: number;              // Timeout in ms
}
```

### Server-Presets

Häufig verwendete MCP-Server:

| Preset | Paket | Beschreibung |
|--------|-------|-------------|
| GitHub | `@modelcontextprotocol/server-github` | GitHub-Operationen |
| Filesystem | `@modelcontextprotocol/server-filesystem` | Dateisystem-Zugriff |
| SQLite | `@modelcontextprotocol/server-sqlite` | SQLite-Datenbanken |
| Brave Search | `@modelcontextprotocol/server-brave-search` | Web-Suche |
| Puppeteer | `@modelcontextprotocol/server-puppeteer` | Browser-Automatisierung |
| Memory | `@modelcontextprotocol/server-memory` | Knowledge-Graph |

## Verbindungstypen

### Lokal (stdio)

Standard-Modus: MCP-Server werden als Child-Prozesse gestartet und kommunizieren über stdin/stdout.

```
Backend -> spawn(command, args) -> MCP-Server (stdio)
```

### Remote (MCP Runner)

Optionaler Modus: MCP-Server laufen in einem separaten Container, das Backend kommuniziert per HTTP.

```
Backend -> HTTP -> MCP Runner Container -> spawn(command, args) -> MCP-Server
```

Aktivierung durch `MCP_RUNNER_URL` Umgebungsvariable:

```env
MCP_RUNNER_URL=http://mcp-runner:3002
```

Ohne `MCP_RUNNER_URL` läuft alles lokal wie bisher.

## Tool-Wrapping

MCP-Tools werden automatisch als `McpToolWrapper` in die globale `ToolRegistry` eingetragen:

```
McpManager.registerToolsFromServer(serverId)
  -> connection.getTools()          // Tool-Liste vom Server
  -> createMcpToolWrappers(tools)   // McpToolWrapper erstellen
  -> toolRegistry.register(wrapper) // In globale Registry eintragen
```

Der `McpToolWrapper` übersetzt zwischen dem MCP-Protokoll und dem internen Tool-Interface:

```typescript
// MCP-Tool wird zu:
{
  name: "mcp_github_list_repos",      // Prefix: mcp_{serverId}_{toolName}
  type: "mcp",
  getDefinition(): ToolDefinition,     // JSON Schema aus MCP-Tool
  execute(args, context): Promise<string>  // Delegation an mcpClient.callTool()
}
```

## MCP Runner

Der MCP Runner (`mcp-runner/`) ist ein optionaler Container für isolierte Ausführung von MCP-Servern:

- **Isolation**: MCP-Server laufen nicht im Backend-Prozess
- **Sicherheit**: Eigener Container mit eingeschränkten Rechten
- **Skalierung**: Kann unabhaengig vom Backend skaliert werden

### Architektur

```
Backend (Bun)                    MCP Runner (Node.js)
  |                                |
  |-- POST /connect ----------->  spawn(command, args)
  |                                  -> MCP Server Process
  |-- POST /tools/call -------->  callTool(name, args)
  |                                  -> MCP Protocol
  |-- POST /disconnect -------->  kill process
```

### Konfiguration

```yaml
# docker-compose.yml
services:
  mcp-runner:
    build: ./mcp-runner
    environment:
      - PORT=3002
    volumes:
      - ./data:/data
```

```yaml
# helm/values.yaml
mcpRunner:
  enabled: true
  image: adacor-workplace-mcp-runner
```

## REST API

| Endpoint | Methode | Auth | Beschreibung |
|----------|---------|------|-------------|
| `/api/mcp/servers` | GET | User | Alle Server mit Status |
| `/api/mcp/servers` | POST | Admin | Server hinzufügen |
| `/api/mcp/servers/:id` | GET | User | Server-Details |
| `/api/mcp/servers/:id` | PUT | Admin | Server aktualisieren |
| `/api/mcp/servers/:id` | DELETE | Admin | Server löschen |
| `/api/mcp/servers/:id/connect` | POST | Admin | Server verbinden |
| `/api/mcp/servers/:id/disconnect` | POST | Admin | Server trennen |
| `/api/mcp/servers/:id/tools` | GET | User | Tools eines Servers |
| `/api/mcp/servers/:id/tools/:name/test` | POST | Admin | Tool testen |
| `/api/mcp/tools` | GET | User | Alle MCP-Tools |
