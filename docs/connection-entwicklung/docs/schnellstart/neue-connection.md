# Neue Connection erstellen

Diese Anleitung führt Sie Schritt für Schritt durch die Erstellung einer OAuth2-Connection. Am Ende haben Sie eine funktionierende Anbindung an einen externen Dienst.

## 1. Verzeichnis anlegen

Erstellen Sie ein neues Verzeichnis unter `data/connections/connectors/`:

```bash
mkdir -p data/connections/connectors/mein-service/tools
```

## 2. Manifest erstellen

Erstellen Sie `manifest.yaml` mit den Metadaten und der OAuth-Konfiguration:

```yaml
id: mein-service
type: connector
name: "Mein Service"
description: "Daten aus Mein Service durchsuchen und lesen"
version: "1.0.0"
author: "Mein Team"

configSchema:
  - key: clientId
    label: "Client ID"
    type: string
    required: true
    placeholder: "z.B. abc123..."
  - key: clientSecret
    label: "Client Secret"
    type: string
    secret: true
    required: true
    placeholder: "z.B. xyz789..."

setupGuide: |
  ## Mein Service einrichten

  ### 1. OAuth-App registrieren
  1. Öffnen Sie die Entwickler-Konsole von Mein Service
  2. Erstellen Sie eine neue OAuth-App
  3. Tragen Sie als Redirect-URI ein: `{ihre-domain}/api/connections/mein-service/callback`

  ### 2. Credentials eintragen
  Kopieren Sie Client ID und Client Secret in die Felder oben.

connector:
  authType: oauth2
  credentialMode: company
  transport: inprocess
  entryPoint: provider.ts

  oauth:
    authorizationUrl: "https://mein-service.example.com/oauth/authorize"
    tokenUrl: "https://mein-service.example.com/oauth/token"
    scopes:
      - "read"
      - "offline_access"
```

## 3. Provider implementieren

Erstellen Sie `provider.ts` — die zentrale Klasse Ihrer Connection:

```typescript
import { OAuthProvider, resolveOAuthConfig } from '@platform/sdk';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '@platform/sdk';
import { createSearchTool } from './tools/search';

export class MeinServiceProvider extends OAuthProvider {
  readonly id = 'mein-service';
  readonly name = 'Mein Service';
  readonly description = 'Daten aus Mein Service durchsuchen und lesen';
  readonly icon = 'mein-service';

  protected async getOAuthConfig(): Promise<OAuth2Config> {
    return resolveOAuthConfig(this.id);
  }

  async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      const user = await this.authenticatedJsonFetch<{ id: string; name: string; email: string }>(
        'https://api.mein-service.example.com/me',
        tokens
      );
      return this.createConnectedStatus({
        id: user.id,
        name: user.name,
        email: user.email,
      });
    } catch (error: any) {
      return this.createErrorStatus(error.message);
    }
  }

  getTools(): ConnectionTool[] {
    return [
      createSearchTool(this.id),
    ];
  }
}

export default new MeinServiceProvider();
```

> [!info] Default-Export
> Der Provider muss als **Default-Export** eine Instanz der Klasse exportieren. Die Plattform importiert diese Instanz beim Plugin-Laden.

## 4. Tool definieren

Erstellen Sie `tools/search.ts`:

```typescript
import { connectionRegistry } from '@platform/sdk';
import type { ConnectionTool, ToolDefinition, ToolContext } from '@platform/sdk';

export function createSearchTool(providerId: string): ConnectionTool {
  return {
    name: 'mein_service_search',
    type: 'connection',
    providerId,

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
      const { query, limit = '10' } = args;

      const tokens = await connectionRegistry.getTokens(context?.userId!, providerId);
      if (!tokens) {
        return 'Fehler: Keine Verbindung zu Mein Service. Bitte zuerst verbinden.';
      }

      const response = await fetch(
        `https://api.mein-service.example.com/search?q=${encodeURIComponent(query)}&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }
      );

      if (!response.ok) {
        return `Fehler bei der Suche: ${response.status} ${response.statusText}`;
      }

      const data = await response.json();
      return JSON.stringify(data.results, null, 2);
    },
  };
}
```

## 5. Credentials konfigurieren

1. Starten Sie die Plattform neu (der Plugin-Loader scannt automatisch nach neuen Manifests)
2. Navigieren Sie zu **Einstellungen > Verbindungen**
3. Ihre neue Connection erscheint in der Liste
4. Klicken Sie auf **Konfigurieren** und tragen Sie Client ID und Client Secret ein
5. Benutzer können sich jetzt über den **Verbinden**-Button authentifizieren

## Zusammenfassung

| Datei | Zweck |
|-------|-------|
| `manifest.yaml` | Metadaten, OAuth-URLs, Config-Schema, Setup-Anleitung |
| `provider.ts` | Authentifizierung, Validierung, Tool-Registrierung |
| `tools/search.ts` | Suchfunktion als ConnectionTool |

## Weiterführend

- [manifest.yaml Referenz](../manifest/format.md) — alle Manifest-Felder
- [OAuthProvider](../provider/oauth-provider.md) — erweiterte Provider-Patterns
- [Tools definieren](../provider/tools.md) — Tool-Interface im Detail
- [Credentials & Secrets](../konfiguration/credentials.md) — Credential-Modi und Verschlüsselung
