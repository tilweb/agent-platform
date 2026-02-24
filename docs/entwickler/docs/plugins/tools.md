# Plugin-Tools

Tools sind die Schnittstelle zwischen LLM und externem Dienst. Diese Seite beschreibt die Entwicklung von **Connection-Tools** für Connector-Plugins.

> Für eine Übersicht über das gesamte Tool-System (Registry, Kategorien, Startup) siehe [Tool-System](../plattform/tool-system.md).

## Import

```typescript
import type { ToolDefinition, ToolContext, ConnectionTool } from '@platform/sdk';
import { connectionRegistry } from '@platform/sdk';
```

## Aufbau eines Tools

```typescript
export function createSearchTool(providerId: string): ConnectionTool {
  return {
    // Pflichtfelder
    name: 'meindienst_search',        // Muss einzigartig sein
    type: 'connection',                // Immer 'connection' für Connector-Tools
    providerId,                        // Wird vom Provider übergeben

    // Tool-Definition für den LLM
    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'meindienst_search',
          description: 'Durchsuche Mein Dienst nach Einträgen.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Der Suchbegriff',
              },
              limit: {
                type: 'number',
                description: 'Maximale Anzahl Ergebnisse (Standard: 10)',
              },
            },
            required: ['query'],
          },
        },
      };
    },

    // Ausführung
    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      // ... Implementation
    },

    // Verfügbarkeit (optional)
    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
```

## Konventionen

| Konvention | Beispiel | Beschreibung |
|-----------|---------|-------------|
| **Naming** | `confluence_search`, `gdrive_read_file` | `<prefix>_<aktion>` |
| **Return-Typ** | `string` | Tools geben immer einen String zurück |
| **Fehlerformat** | `'Error: ...'` | Fehler beginnen mit `Error:` |
| **Token-Check** | `connectionRegistry.getTokens()` | Immer zuerst Tokens prüfen |
| **Auth-Fehler** | Status 401/403 → "Token abgelaufen" | Benutzer auf Reconnect hinweisen |

## Execute-Funktion — Best Practices

### 1. Parameter validieren

```typescript
async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
  const { query, limit = 10 } = args;

  if (!query) {
    return 'Error: Suchbegriff ist erforderlich';
  }
```

### 2. User und Tokens prüfen

```typescript
  if (!context?.userId) {
    return 'Error: Anmeldung erforderlich';
  }

  const tokens = await connectionRegistry.getTokens(context.userId, providerId);
  if (!tokens) {
    return 'Error: Nicht mit Mein Dienst verbunden. Bitte unter Verbindungen verbinden.';
  }
```

### 3. API-Call mit Fehlerbehandlung

```typescript
  try {
    const response = await fetch(
      `https://api.mein-dienst.com/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return 'Error: Zugriff verweigert. Token abgelaufen? Bitte neu verbinden.';
      }
      const text = await response.text();
      return `Error: API-Fehler: ${response.status} - ${text}`;
    }
```

### 4. Ergebnis für LLM formatieren

```typescript
    const data = await response.json();

    if (!data.items?.length) {
      return `Keine Ergebnisse für "${query}" gefunden.`;
    }

    // Markdown-Formatierung für den LLM
    let output = `${data.items.length} Ergebnis(se):\n\n`;
    for (const item of data.items) {
      output += `### ${item.title}\n`;
      output += `- **ID**: ${item.id}\n`;
      output += `- **Erstellt**: ${item.created_at}\n\n`;
    }
    return output;

  } catch (error: any) {
    console.error('Search error:', error);
    return `Error: ${error.message}`;
  }
}
```

## Parameter-Typen (JSON Schema)

```typescript
parameters: {
  type: 'object',
  properties: {
    query: { type: 'string', description: 'Suchbegriff' },
    limit: { type: 'number', description: 'Max. Ergebnisse' },
    active: { type: 'boolean', description: 'Nur aktive?' },
    status: {
      type: 'string',
      enum: ['open', 'closed', 'all'],
      description: 'Filterstatus',
    },
  },
  required: ['query'],
}
```

## ToolContext

Der `context`-Parameter enthält Informationen zur aktuellen Sitzung:

```typescript
interface ToolContext {
  sessionId?: string;
  agentId?: string;
  delegationDepth?: number;
  userId?: string;             // ← Wichtig für connectionRegistry.getTokens()
  parentSessionId?: string;
}
```

## ToolDefinition

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
