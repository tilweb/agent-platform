# Tools definieren

Connection-Tools sind Funktionen, die von KI-Agenten aufgerufen werden können. Jedes Tool hat eine Definition (Name, Beschreibung, Parameter) und eine `execute()`-Methode.

## ConnectionTool-Interface

```typescript
interface ConnectionTool {
  readonly name: string;          // Eindeutiger Tool-Name (z.B. 'confluence_search')
  readonly type: 'connection';    // Immer 'connection'
  readonly providerId: string;    // ID des zugehörigen Providers

  getDefinition(): ToolDefinition;
  execute(args: Record<string, any>, context?: ToolContext): Promise<string>;

  // Optional:
  isAvailable?(): Promise<boolean>;
  getMetadata?(): ToolMetadata;
}
```

## Factory-Pattern

Tools werden als Factory-Funktionen implementiert, die die `providerId` erhalten:

```typescript
import { connectionRegistry } from '@platform/sdk';
import type { ConnectionTool, ToolDefinition, ToolContext } from '@platform/sdk';

export function createSearchTool(providerId: string): ConnectionTool {
  return {
    name: 'mein_service_search',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      // ...
    },

    async execute(args, context): Promise<string> {
      // ...
    },
  };
}
```

## getDefinition()

Beschreibt das Tool für den KI-Agenten. Die Definition folgt dem OpenAI Function-Calling-Schema:

```typescript
getDefinition(): ToolDefinition {
  return {
    type: 'function',
    function: {
      name: 'mein_service_search',
      description: 'Durchsucht Mein Service nach Inhalten. Verwende dieses Tool, wenn der Benutzer nach Informationen in Mein Service fragt.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Suchbegriff',
          },
          spaceKey: {
            type: 'string',
            description: 'Optional: Bereich eingrenzen',
          },
          limit: {
            type: 'string',
            description: 'Maximale Anzahl Ergebnisse (Standard: 10)',
          },
        },
        required: ['query'],
      },
    },
  };
}
```

> [!tip] Tool-Beschreibungen
> Die `description` in `getDefinition()` ist entscheidend dafür, wann der KI-Agent das Tool einsetzt. Schreiben Sie klare, spezifische Beschreibungen. Nennen Sie den Service-Namen und typische Anwendungsfälle.

## execute()

Führt das Tool aus und gibt das Ergebnis als String zurück:

```typescript
async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
  const { query, limit = '10' } = args;

  // 1. Tokens abrufen
  const tokens = await connectionRegistry.getTokens(context?.userId!, providerId);
  if (!tokens) {
    return 'Fehler: Keine Verbindung zu Mein Service. Bitte zuerst verbinden.';
  }

  // 2. API aufrufen
  const response = await fetch(
    `https://api.example.com/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    }
  );

  if (!response.ok) {
    return `Fehler: ${response.status} ${response.statusText}`;
  }

  // 3. Ergebnis formatieren
  const data = await response.json();

  if (data.results.length === 0) {
    return `Keine Ergebnisse für "${query}" gefunden.`;
  }

  return data.results.map((r: any) =>
    `## ${r.title}\n${r.excerpt}\nLink: ${r.url}`
  ).join('\n\n---\n\n');
}
```

### Token-Zugriff

Tokens werden über `connectionRegistry.getTokens()` abgerufen. Die Registry kümmert sich automatisch um:

- Token-Entschlüsselung
- Automatische Erneuerung abgelaufener Tokens
- Rückgabe von `null`, wenn keine Verbindung besteht

```typescript
const tokens = await connectionRegistry.getTokens(context?.userId!, providerId);
if (!tokens) {
  return 'Fehler: Nicht verbunden.';
}

// Token verwenden
const headers = { Authorization: `Bearer ${tokens.accessToken}` };
```

### Fehlerbehandlung

Tools sollten Fehler als benutzerfreundliche Strings zurückgeben, nicht als Exceptions:

```typescript
async execute(args, context): Promise<string> {
  try {
    const tokens = await connectionRegistry.getTokens(context?.userId!, providerId);
    if (!tokens) {
      return 'Fehler: Keine Verbindung. Bitte unter Einstellungen > Verbindungen verbinden.';
    }

    const response = await fetch(url, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });

    if (response.status === 401) {
      return 'Fehler: Zugriff verweigert. Die Verbindung muss erneuert werden.';
    }

    if (response.status === 404) {
      return 'Der angeforderte Inhalt wurde nicht gefunden.';
    }

    if (!response.ok) {
      return `Fehler: API-Anfrage fehlgeschlagen (${response.status})`;
    }

    const data = await response.json();
    return formatResult(data);
  } catch (error: any) {
    return `Fehler: ${error.message}`;
  }
}
```

## isAvailable() (optional)

Prüft, ob das Tool verfügbar ist. Wird verwendet, um Tools aus der Tool-Liste auszublenden, wenn die Connection nicht konfiguriert ist:

```typescript
async isAvailable(): Promise<boolean> {
  return connectionRegistry.has(providerId);
}
```

## Ergebnis-Formatierung

Der Rückgabewert von `execute()` wird dem KI-Agenten als Text übergeben. Empfehlungen:

| Szenario | Format |
|---------|--------|
| Einzelnes Ergebnis | Strukturierter Text mit Markdown |
| Liste von Ergebnissen | Markdown-Überschriften + Trennlinien |
| Tabellendaten | Markdown-Tabelle |
| Kein Ergebnis | Klare Meldung mit Suchbegriff |
| Fehler | `Fehler: <Beschreibung>` |

```typescript
// Einzelnes Ergebnis
return `# ${page.title}\n\n${page.content}\n\nLink: ${page.url}`;

// Liste
return results.map(r => `## ${r.title}\n${r.summary}`).join('\n\n---\n\n');

// Kein Ergebnis
return `Keine Ergebnisse für "${query}" gefunden.`;
```

## Praxis-Beispiel: Confluence-Suche

```typescript
export function createSearchTool(providerId: string): ConnectionTool {
  return {
    name: 'confluence_search',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'confluence_search',
          description: 'Durchsucht Confluence nach Seiten und Blog-Posts. Verwende dieses Tool, wenn der Benutzer nach Informationen in Confluence fragt oder Wiki-Inhalte sucht.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'CQL-Suchbegriff oder Freitext',
              },
              spaceKey: {
                type: 'string',
                description: 'Optional: Confluence Space Key zum Eingrenzen der Suche',
              },
              limit: {
                type: 'string',
                description: 'Maximale Anzahl Ergebnisse (Standard: 10)',
              },
            },
            required: ['query'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { query, spaceKey, limit = '10' } = args;

      const tokens = await connectionRegistry.getTokens(context?.userId!, providerId);
      if (!tokens) {
        return 'Fehler: Keine Verbindung zu Confluence. Bitte unter Einstellungen verbinden.';
      }

      const cql = spaceKey
        ? `space = "${spaceKey}" AND text ~ "${query}"`
        : `text ~ "${query}"`;

      const baseUrl = `https://api.atlassian.com/ex/confluence/${tokens.cloudId}`;
      const url = `${baseUrl}/wiki/rest/api/content/search?cql=${encodeURIComponent(cql)}&limit=${limit}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });

      if (!response.ok) {
        return `Fehler bei der Confluence-Suche: ${response.status}`;
      }

      const data = await response.json();

      if (!data.results?.length) {
        return `Keine Confluence-Ergebnisse für "${query}" gefunden.`;
      }

      return data.results.map((r: any) =>
        `## ${r.title}\nTyp: ${r.type} | Space: ${r.space?.name || 'Unbekannt'}\nLink: ${baseUrl}/wiki${r._links?.webui || ''}`
      ).join('\n\n---\n\n');
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
```
