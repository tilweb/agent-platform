# Erste Schritte

Anleitung zum Erstellen eines eigenen Connector-Plugins für den Adacor Workplace.

## Voraussetzungen

- Bun Runtime (1.1+)
- TypeScript
- Zugang zum `data/connections/connectors/` Verzeichnis

## Schritt-für-Schritt

### 1. Plugin-Verzeichnis anlegen

Erstelle ein neues Verzeichnis unter `data/connections/connectors/`:

```bash
mkdir -p data/connections/connectors/mein-connector/tools
```

### 2. Manifest erstellen

Erstelle `manifest.yaml` — die zentrale Konfigurationsdatei:

```yaml
id: mein-connector
type: connector
name: "Mein Dienst"
description: "Verbindung zu Mein Dienst für Datenabfragen"
version: "1.0.0"
author: "Dein Name"

configSchema:
  - key: clientId
    label: "Client ID"
    type: string
    required: true
  - key: clientSecret
    label: "Client Secret"
    type: string
    secret: true
    required: true

connector:
  authType: oauth2
  credentialMode: company
  transport: inprocess
  entryPoint: provider.ts
  oauth:
    authorizationUrl: "https://mein-dienst.com/oauth/authorize"
    tokenUrl: "https://mein-dienst.com/oauth/token"
    scopes:
      - "read"
      - "offline_access"
```

Siehe [Plugin-Manifest](./manifest.md) für alle verfügbaren Felder.

### 3. Provider implementieren

Erstelle `provider.ts`:

```typescript
import { OAuthProvider, resolveOAuthConfig } from '@platform/sdk';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '@platform/sdk';
import { createSearchTool } from './tools/search';

export class MeinDienstProvider extends OAuthProvider {
  readonly id = 'mein-connector';
  readonly name = 'Mein Dienst';
  readonly description = 'Verbindung zu Mein Dienst';
  readonly icon = '🔗';

  private tools: ConnectionTool[] | null = null;

  protected async getOAuthConfig(): Promise<OAuth2Config> {
    return resolveOAuthConfig(this.id);
  }

  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      const response = await this.authenticatedFetch(
        'https://api.mein-dienst.com/me',
        tokens
      );

      if (!response.ok) {
        throw new Error(`${response.status}`);
      }

      const user = await response.json();

      return this.createConnectedStatus({
        id: user.id,
        name: user.name,
        email: user.email,
      });
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return this.createExpiredStatus();
      }
      return this.createErrorStatus(error.message);
    }
  }

  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [createSearchTool(this.id)];
    }
    return this.tools;
  }
}

export default new MeinDienstProvider();
```

Siehe [OAuthProvider](./oauth-provider.md) für alle überschreibbaren Methoden.

### 4. Tools erstellen

Erstelle `tools/search.ts`:

```typescript
import type { ToolDefinition, ToolContext, ConnectionTool } from '@platform/sdk';
import { connectionRegistry } from '@platform/sdk';

export function createSearchTool(providerId: string): ConnectionTool {
  return {
    name: 'meindienst_search',
    type: 'connection',
    providerId,

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
            },
            required: ['query'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { query } = args;
      if (!query) return 'Error: Suchbegriff ist erforderlich';
      if (!context?.userId) return 'Error: Anmeldung erforderlich';

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) return 'Error: Nicht mit Mein Dienst verbunden.';

      try {
        const response = await fetch(
          `https://api.mein-dienst.com/search?q=${encodeURIComponent(query)}`,
          {
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
              Accept: 'application/json',
            },
          }
        );

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            return 'Error: Zugriff verweigert. Bitte neu verbinden.';
          }
          return `Error: API-Fehler: ${response.status}`;
        }

        const data = await response.json();
        return JSON.stringify(data, null, 2);
      } catch (error: any) {
        return `Error: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
```

Siehe [Tools](./tools.md) für Konventionen und erweiterte Patterns.

### 5. Testen

1. Backend neu starten: `cd backend && bun run dev`
2. Logs prüfen: `Loaded connector: mein-connector from provider.ts`
3. Admin-UI: Unter **Einstellungen > Verbindungen** erscheint das neue Plugin
4. Credentials eintragen und OAuth-Flow testen

## Checkliste

- [ ] Verzeichnis unter `data/connections/connectors/<id>/` angelegt
- [ ] `manifest.yaml` mit allen Pflichtfeldern
- [ ] `provider.ts` mit `export default new MeinProvider()`
- [ ] Mindestens ein Tool unter `tools/`
- [ ] `manifest.id` stimmt mit Verzeichnisname überein
- [ ] Alle Imports über `@platform/sdk`
- [ ] Tool-Names sind einzigartig (Prefix mit Provider-Name)
- [ ] Backend startet ohne Fehler
