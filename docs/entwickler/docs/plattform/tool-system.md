# Tool-System

Das Tool-System verbindet LLMs mit externen Funktionen. Jedes Tool hat einen eindeutigen Namen, eine JSON-Schema-Beschreibung für den LLM, und eine `execute`-Funktion.

## Tool-Registry

Die `ToolRegistry` ist ein Singleton (`toolRegistry`), das alle registrierten Tools verwaltet:

```typescript
import { toolRegistry } from './tools/registry';

// Tool registrieren
toolRegistry.register(myTool);

// Tool-Definitionen für LLM abrufen
const definitions = toolRegistry.getDefinitions();

// Tool ausführen
const result = await toolRegistry.execute(toolCall, context);
```

### Methoden

| Methode | Beschreibung |
|---------|-------------|
| `register(tool)` | Tool registrieren (ersetzt bei Namenskollision) |
| `registerAll(tools)` | Mehrere Tools registrieren |
| `unregister(name)` | Tool entfernen |
| `get(name)` | Tool nach Name abrufen |
| `has(name)` | Existiert ein Tool? |
| `getAll()` | Alle registrierten Tools |
| `getByType(type)` | Tools nach Typ filtern |
| `getEnabled()` | Nur aktivierte Tools (respektiert Config + Plugin-Status) |
| `getForAgent(toolNames)` | Tools für einen bestimmten Agenten |
| `getDefinitions(toolNames?)` | Tool-Definitionen im OpenAI-Format |
| `execute(call, context)` | Tool-Call ausführen |
| `getStats()` | Statistik (Anzahl nach Typ) |

## Tool-Interface

```typescript
interface Tool {
  readonly name: string;        // Eindeutiger Name
  readonly type: ToolType;      // Kategorie

  getDefinition(): ToolDefinition;                                    // JSON Schema für LLM
  execute(args: Record<string, any>, context?: ToolContext): Promise<string>;  // Ausführung
  isAvailable?(): Promise<boolean>;                                   // Verfügbarkeits-Check
}
```

### ToolType

```typescript
type ToolType = 'local' | 'api' | 'mcp' | 'delegation' | 'connection';
```

### ToolDefinition (OpenAI-Format)

```typescript
interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required: string[];
    };
  };
}
```

### ToolContext

Wird bei der Ausführung übergeben und enthält Session- und User-Informationen:

```typescript
interface ToolContext {
  sessionId?: string;         // Chat-Session
  agentId?: string;           // Aktiver Agent
  delegationDepth?: number;   // Delegations-Tiefe
  userId?: string;            // User-ID (für Connection-Tools)
  parentSessionId?: string;   // Eltern-Session (für Attachment-Zugriff)
}
```

## Tool-Kategorien

### Local Tools

Dateisystem-Operationen auf dem `data/`-Verzeichnis:

| Tool | Beschreibung |
|------|-------------|
| `file_read` | Datei lesen |
| `file_write` | Datei schreiben |
| `file_list` | Verzeichnis auflisten |

### API Tools

Externe API-Integrationen:

| Tool | Beschreibung |
|------|-------------|
| `web_search` | Web-Suche (Tavily, Serper, SerpAPI) |
| `generate_image` | Bildgenerierung (DALL-E, Flux) |
| `edit_image` | Bildbearbeitung |

### Knowledge Tools

Wissensbasis-Operationen:

| Tool | Beschreibung |
|------|-------------|
| `kb_search` | Semantische Suche in Sammlungen |
| `kb_index` | Dokumente indizieren |
| `kb_manage` | Sammlungen verwalten |

### Table Tools

Strukturierte Daten:

| Tool | Beschreibung |
|------|-------------|
| `table_list` | Tabellen auflisten |
| `table_query` | Tabelle abfragen |
| `table_add` | Zeilen hinzufügen |
| `table_update` | Zeilen aktualisieren |
| `table_delete` | Zeilen löschen |

### Special Tools

Plattform-interne Funktionen:

| Tool | Beschreibung |
|------|-------------|
| `delegate_to_agent` | Aufgabe an anderen Agenten delegieren |
| `load_skill` | Skill laden und aktivieren |
| `user_memory` | User-Notizen speichern/lesen |
| `create_task` | Hintergrund-Task erstellen |
| `read_chat_attachment` | Chat-Attachment lesen |
| `export_document` | Dokument exportieren (PDF, DOCX, etc.) |

### MCP Tools

Dynamisch von MCP-Servern registrierte Tools. Werden als `McpToolWrapper` in die Registry eingetragen.

### Connection Tools

Von Connector-Plugins registrierte Tools (z.B. `confluence_search`, `gdrive_read_file`). Typ: `connection` mit `providerId`.

### Custom Tools

Benutzerdefinierte API-Tools mit SSRF-Schutz. Konfiguriert in `data/config/custom-tools.yaml`.

## Registrierung bei Startup

Die Registrierung erfolgt in `setupTools()` (`backend/src/tools/index.ts`):

```
setupTools()
  1. toolRegistry.clear()                 Alte Tools entfernen
  2. toolRegistry.registerAll(localTools)  file_read, file_write, file_list
  3. register(WebSearchTool)              web_search
  4. register(DelegateToAgentTool)        delegate_to_agent
  5. registerAll(knowledgeTools)           kb_search, kb_index, kb_manage
  6. registerAll(tableTools)              table_*
  7. register(UserMemoryTool)             user_memory
  8. register(CreateTaskTool)             create_task
  9. register(ReadChatAttachmentTool)     read_chat_attachment
 10. register(ExportDocumentTool)         export_document
 11. register(ImageGenerationTool)        generate_image
 12. register(ImageEditTool)              edit_image
 13. register(LoadSkillTool)              load_skill
 14. registerCustomTools()                Custom API-Tools aus Config
```

Danach kommen weitere Tools durch:
- `loadAllPlugins()` — Connection-Tools von Connector-Plugins
- `mcpManager.initialize()` — MCP-Tools von externen Servern

## Enable/Disable

### Konfigurationsbasiert

```typescript
// In ToolsConfig:
{
  enabled: ['file_read', 'web_search'],  // Whitelist (optional)
  disabled: ['file_write'],               // Blacklist
}
```

### Plugin-basiert

```typescript
// Plugin deaktivieren -> alle seine Tools werden deaktiviert
toolRegistry.setPluginDisabled('confluence', true);
```

### Agent-basiert

Jeder Agent definiert in seiner Config, welche Tools er nutzen kann:

```yaml
tools:
  - file_read
  - file_list
  - web_search
  - delegate_to_agent
```

## Custom Tools

Benutzerdefinierte API-Tools mit automatischem SSRF-Schutz. Können über die UI oder API verwaltet werden.

```yaml
# data/config/custom-tools.yaml
- name: my_api_tool
  description: "Ruft meine API ab"
  url: "https://api.example.com/data"
  method: GET
  headers:
    Authorization: "Bearer ${MY_API_KEY}"
  parameters:
    - name: query
      type: string
      description: "Suchbegriff"
      required: true
```

Custom-Tool-URLs werden gegen eine SSRF-Blacklist geprüft (keine lokalen Adressen, keine internen Netzwerke).
