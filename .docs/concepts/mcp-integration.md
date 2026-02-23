# MCP Integration Konzept

## Übersicht

Integration des Model Context Protocol (MCP) in den Adacor Workplace:
- **Phase 1**: MCP Server als Tool-Quelle (externe MCP Server einbinden)
- **Phase 2**: Adacor Workplace als MCP Server (Skills/Agents über MCP bereitstellen)

---

## Phase 1: MCP Server als Tool-Quelle

### Architektur

```
┌─────────────────────────────────────────────────────────┐
│                    Adacor Workplace                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │                 Tool Registry                     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │   │
│  │  │ Local   │ │  API    │ │   MCP Tools     │   │   │
│  │  │ Tools   │ │ Tools   │ │ (dynamisch)     │   │   │
│  │  └─────────┘ └─────────┘ └────────┬────────┘   │   │
│  └───────────────────────────────────┼─────────────┘   │
│                                      │                   │
│  ┌───────────────────────────────────┼─────────────┐   │
│  │              MCP Client Manager    │             │   │
│  │  ┌────────────────────────────────▼──────────┐  │   │
│  │  │         McpServerConnection               │  │   │
│  │  │  - JSON-RPC over stdio                    │  │   │
│  │  │  - Initialize / ListTools / CallTool      │  │   │
│  │  └────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │ npx mcp  │    │ npx mcp  │    │ Custom   │
   │ @github  │    │ @sqlite  │    │ MCP      │
   │ Server   │    │ Server   │    │ Server   │
   └──────────┘    └──────────┘    └──────────┘
```

### MCP Protokoll

MCP verwendet JSON-RPC 2.0 über stdio:

```typescript
// Client -> Server (Request)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "clientInfo": { "name": "adacor-workplace", "version": "1.0" }
  }
}

// Server -> Client (Response)
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": { "listChanged": true } },
    "serverInfo": { "name": "github-mcp", "version": "1.0" }
  }
}

// List tools
{ "method": "tools/list" }

// Call tool
{ "method": "tools/call", "params": { "name": "...", "arguments": {...} } }
```

### Server-Konfiguration

```yaml
# data/config/mcp-servers.yaml
servers:
  - id: github
    name: GitHub MCP Server
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}"
    enabled: true

  - id: sqlite
    name: SQLite MCP Server
    command: npx
    args: ["-y", "@modelcontextprotocol/server-sqlite"]
    env:
      SQLITE_DB_PATH: "./data/database.db"
    enabled: true

  - id: filesystem
    name: Filesystem MCP Server
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "./data"]
    enabled: true
```

### Implementierung

#### 1. MCP Client (backend/src/mcp/client.ts)

```typescript
interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

class McpClient {
  private connections: Map<string, McpConnection>;

  async connect(config: McpServerConfig): Promise<McpConnection>;
  async disconnect(serverId: string): Promise<void>;
  async reconnect(serverId: string): Promise<void>;

  getConnection(serverId: string): McpConnection | undefined;
  getAllConnections(): McpConnection[];

  async listAllTools(): Promise<McpToolInfo[]>;
}

class McpConnection {
  private process: ChildProcess;
  private transport: StdioClientTransport;
  private client: Client;

  async initialize(): Promise<void>;
  async listTools(): Promise<Tool[]>;
  async callTool(name: string, args: Record<string, any>): Promise<any>;
  async close(): Promise<void>;

  getStatus(): 'connected' | 'disconnected' | 'error';
  getTools(): Tool[];
}
```

#### 2. MCP Tool Wrapper (backend/src/mcp/tool.ts)

```typescript
class McpToolWrapper implements Tool {
  readonly name: string;
  readonly type = 'mcp' as const;

  private connection: McpConnection;
  private mcpToolName: string;

  constructor(connection: McpConnection, mcpTool: McpToolDefinition) {
    this.name = `mcp_${connection.serverId}_${mcpTool.name}`;
    this.mcpToolName = mcpTool.name;
    // ...
  }

  async execute(args: Record<string, any>): Promise<string> {
    const result = await this.connection.callTool(this.mcpToolName, args);
    return formatMcpResult(result);
  }
}
```

#### 3. MCP Manager (backend/src/mcp/manager.ts)

```typescript
class McpManager {
  private client: McpClient;
  private configPath: string;

  // Lifecycle
  async initialize(): Promise<void>;
  async shutdown(): Promise<void>;

  // Server management
  async addServer(config: McpServerConfig): Promise<void>;
  async removeServer(serverId: string): Promise<void>;
  async updateServer(serverId: string, updates: Partial<McpServerConfig>): Promise<void>;
  async toggleServer(serverId: string, enabled: boolean): Promise<void>;

  // Tool registration
  async registerToolsFromServer(serverId: string): Promise<void>;
  async unregisterToolsFromServer(serverId: string): Promise<void>;
  async refreshTools(): Promise<void>;

  // Status
  getServerStatus(serverId: string): ServerStatus;
  getAllServers(): McpServerInfo[];
}
```

### API Endpoints

```
GET  /api/mcp/servers           - Liste aller konfigurierten Server
POST /api/mcp/servers           - Server hinzufügen
GET  /api/mcp/servers/:id       - Server-Details inkl. Tools
PUT  /api/mcp/servers/:id       - Server aktualisieren
DELETE /api/mcp/servers/:id     - Server entfernen

POST /api/mcp/servers/:id/connect     - Server verbinden
POST /api/mcp/servers/:id/disconnect  - Server trennen
POST /api/mcp/servers/:id/refresh     - Tools neu laden

GET  /api/mcp/tools             - Alle MCP Tools über alle Server
POST /api/mcp/tools/:name/test  - Tool testen
```

### Frontend UI

#### MCP-Server Verwaltung (McpServersPage.jsx)

```
┌─────────────────────────────────────────────────────────┐
│  MCP Server                              [+ Server hinzufügen]
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🟢 GitHub MCP Server                               │ │
│  │    @modelcontextprotocol/server-github             │ │
│  │    Tools: 8 | Status: Connected                    │ │
│  │                                                    │ │
│  │    [Trennen] [Tools] [Bearbeiten] [Löschen]       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🔴 SQLite MCP Server                               │ │
│  │    @modelcontextprotocol/server-sqlite             │ │
│  │    Tools: - | Status: Disconnected                 │ │
│  │                                                    │ │
│  │    [Verbinden] [Tools] [Bearbeiten] [Löschen]     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### Server-Editor Modal

```
┌─────────────────────────────────────────────────────────┐
│  MCP Server hinzufügen                              [x] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ID:        [github-server              ]               │
│  Name:      [GitHub MCP Server          ]               │
│                                                          │
│  Command:   [npx                        ]               │
│  Arguments: [-y, @modelcontextprotocol/server-github]   │
│                                                          │
│  Umgebungsvariablen:                                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │ GITHUB_TOKEN     │ ghp_xxxx...        │ [x]       │ │
│  │ [+ Variable]                                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [x] Beim Start automatisch verbinden                   │
│                                                          │
│                           [Abbrechen] [Speichern]       │
└─────────────────────────────────────────────────────────┘
```

### Bekannte MCP Server

Vorkonfigurierte Presets für einfache Installation:

| Server | Package | Beschreibung |
|--------|---------|--------------|
| GitHub | @modelcontextprotocol/server-github | Repository-Suche, Issues, PRs |
| Filesystem | @modelcontextprotocol/server-filesystem | Dateisystem-Zugriff |
| SQLite | @modelcontextprotocol/server-sqlite | Datenbank-Abfragen |
| Brave Search | @modelcontextprotocol/server-brave-search | Web-Suche |
| Puppeteer | @modelcontextprotocol/server-puppeteer | Browser-Automatisierung |
| Slack | @modelcontextprotocol/server-slack | Slack-Integration |

---

## Implementierungsplan

### Schritt 1: MCP SDK integrieren
- Package installieren: `@modelcontextprotocol/sdk`
- Basis-Client implementieren mit JSON-RPC über stdio

### Schritt 2: Server-Verwaltung
- Konfigurations-Datei (YAML)
- CRUD-Operationen für Server
- Lifecycle-Management (connect/disconnect)

### Schritt 3: Tool-Integration
- McpToolWrapper für Tool Registry
- Dynamische Registrierung bei Verbindung
- Prefix-Namensschema: `mcp_{server}_{tool}`

### Schritt 4: API Routes
- Server-Management Endpoints
- Tool-Listing und -Test Endpoints

### Schritt 5: Frontend
- McpServersPage mit Server-Liste
- Server-Editor Modal
- Status-Anzeige und Verbindungs-Management

---

## Sicherheit

- **Environment Variables**: Secrets nur in .env, nie in Config-Dateien
- **Server-Isolation**: Jeder MCP Server läuft als eigener Prozess
- **Timeouts**: Maximale Ausführungszeit für Tool-Calls
- **Sandboxing**: Filesystem-Server auf bestimmte Pfade beschränken

---

## Phase 2: Adacor Workplace als MCP Server

### Architektur

```
┌─────────────────────────────────────────────────────────┐
│                External MCP Clients                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  Claude  │  │  Cursor  │  │  Other MCP Clients   │  │
│  │  Desktop │  │   IDE    │  │                      │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
└───────┼─────────────┼───────────────────┼──────────────┘
        │             │                   │
        └─────────────┼───────────────────┘
                      │ stdio (JSON-RPC 2.0)
                      ▼
┌─────────────────────────────────────────────────────────┐
│                 Adacor Workplace MCP Server               │
│  ┌─────────────────────────────────────────────────┐   │
│  │              MCP Server Transport                 │   │
│  │  - Stdin/Stdout JSON-RPC Handler                 │   │
│  │  - Initialize, List Tools, Call Tool             │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│  ┌───────────────────────┼───────────────────────┐     │
│  │                Tool Registry                    │     │
│  │  ┌─────────┐  ┌─────────┐  ┌───────────────┐ │     │
│  │  │  Local  │  │   API   │  │  Delegation   │ │     │
│  │  │  Tools  │  │  Tools  │  │    Tools      │ │     │
│  │  └─────────┘  └─────────┘  └───────────────┘ │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### MCP Server Capabilities

```typescript
// Server Info
{
  name: "adacor-workplace",
  version: "1.0.0",
  capabilities: {
    tools: {
      listChanged: false  // Static tool list
    }
  }
}
```

### Exposed Tools

Alle Tools aus der Tool Registry werden als MCP Tools bereitgestellt:

| Tool Name | Description |
|-----------|-------------|
| file_read | Datei lesen |
| file_write | Datei schreiben |
| file_list | Verzeichnis auflisten |
| web_search | Web-Suche durchführen |
| delegate_to_agent | An Agenten delegieren |

### Implementierung

#### 1. MCP Server Entry Point (backend/src/mcp/server/index.ts)

```typescript
// Wird als standalone Prozess gestartet
// npx adacor-workplace-mcp oder bun run src/mcp/server/index.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { toolRegistry } from '../../tools/registry';

async function main() {
  const server = new Server(
    { name: 'adacor-workplace', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // Register handlers
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolRegistry.getAllTools().map(t => t.getDefinition().function)
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = toolRegistry.getTool(name);
    const result = await tool.execute(args);
    return { content: [{ type: 'text', text: result }] };
  });

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

#### 2. Server Package Configuration

```json
// package.json "bin" entry
{
  "bin": {
    "adacor-workplace-mcp": "./dist/mcp/server/index.js"
  }
}
```

### Verwendung

#### In Claude Desktop (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "adacor-workplace": {
      "command": "bun",
      "args": ["run", "/path/to/adacor-workplace/backend/src/mcp/server/index.ts"]
    }
  }
}
```

#### In Cursor IDE

```json
{
  "mcpServers": {
    "adacor-workplace": {
      "command": "npx",
      "args": ["-y", "adacor-workplace-mcp"]
    }
  }
}
```

### Sicherheit für MCP Server

- **Read-Only Mode**: Optional nur lesende Tools freigeben
- **Pfad-Beschränkung**: Dateizugriff auf bestimmte Verzeichnisse limitieren
- **Tool-Whitelist**: Nur bestimmte Tools exportieren
- **Logging**: Alle MCP-Aufrufe protokollieren
