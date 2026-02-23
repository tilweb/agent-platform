# Beispiel: OAuth-Plugin (Jira)

Ein vollständiges Beispiel eines OAuth2-basierten Connector-Plugins am Beispiel Atlassian Jira.

## Verzeichnisstruktur

```
data/connections/providers/jira/
├── manifest.yaml
├── provider.ts
├── config.ts
├── credentials.yaml
└── tools/
    └── search-issues.ts
```

## manifest.yaml

```yaml
id: jira
type: connector
name: "Atlassian Jira"
description: "Jira Issues durchsuchen und lesen"
version: "1.0.0"
author: "Adacor Workplace"

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

setupGuide: |
  ## Jira einrichten
  1. Gehe zu developer.atlassian.com
  2. Erstelle eine OAuth 2.0 (3LO) Integration
  3. Callback URL: `{API_BASE_URL}/api/connections/jira/callback`
  4. Scopes: `read:jira-work`, `read:jira-user`

connector:
  authType: oauth2
  credentialMode: company
  transport: inprocess
  entryPoint: provider.ts
  oauth:
    authorizationUrl: "https://auth.atlassian.com/authorize"
    tokenUrl: "https://auth.atlassian.com/oauth/token"
    scopes:
      - "read:jira-work"
      - "read:jira-user"
      - "offline_access"
    additionalAuthParams:
      audience: "api.atlassian.com"
      prompt: "consent"
```

## config.ts

URL-Helpers für die Atlassian API:

```typescript
const ATLASSIAN_API = 'https://api.atlassian.com';

export function getAccessibleResourcesUrl(): string {
  return `${ATLASSIAN_API}/oauth/token/accessible-resources`;
}

export function getJiraApiUrl(cloudId: string): string {
  return `${ATLASSIAN_API}/ex/jira/${cloudId}/rest/api/3`;
}
```

## provider.ts

```typescript
import { OAuthProvider, resolveOAuthConfig } from '@platform/sdk';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '@platform/sdk';
import { getAccessibleResourcesUrl, getJiraApiUrl } from './config';
import { createSearchIssuesTool } from './tools/search-issues';

export class JiraProvider extends OAuthProvider {
  readonly id = 'jira';
  readonly name = 'Atlassian Jira';
  readonly description = 'Jira Issues durchsuchen und lesen';
  readonly icon = '🐛';

  private tools: ConnectionTool[] | null = null;

  protected async getOAuthConfig(): Promise<OAuth2Config> {
    return resolveOAuthConfig(this.id);
  }

  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      // 1. Cloud-ID ermitteln
      const resourcesResponse = await this.authenticatedFetch(
        getAccessibleResourcesUrl(), tokens
      );
      const resources = await resourcesResponse.json() as any[];
      const jiraInstance = resources.find((r: any) =>
        r.scopes.some((s: string) => s.includes('jira'))
      );

      if (!jiraInstance) {
        return this.createErrorStatus('Kein Jira-Zugang gefunden.');
      }

      tokens.cloudId = jiraInstance.id;

      // 2. User-Info abrufen
      const userResponse = await this.authenticatedFetch(
        `${getJiraApiUrl(jiraInstance.id)}/myself`, tokens
      );
      const user = await userResponse.json() as any;

      return this.createConnectedStatus({
        id: user.accountId,
        name: user.displayName,
        email: user.emailAddress,
        avatarUrl: user.avatarUrls?.['48x48'],
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
      this.tools = [
        createSearchIssuesTool(this.id),
      ];
    }
    return this.tools;
  }
}

export default new JiraProvider();
```

> [!info] Atlassian-Besonderheit
> Atlassian verwendet Cloud-IDs zur Identifikation der Instanz. Diese wird aus der `accessible-resources` API gelesen und im TokenSet gespeichert.

## tools/search-issues.ts

```typescript
import type { ToolDefinition, ToolContext, ConnectionTool } from '@platform/sdk';
import { connectionRegistry } from '@platform/sdk';
import { getJiraApiUrl } from '../config';

export function createSearchIssuesTool(providerId: string): ConnectionTool {
  return {
    name: 'jira_search',
    type: 'connection',
    providerId,

    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'jira_search',
          description: 'Suche nach Jira Issues mit JQL (Jira Query Language).',
          parameters: {
            type: 'object',
            properties: {
              jql: {
                type: 'string',
                description: 'JQL-Query, z.B. "project = PROJ AND status = Open"',
              },
              limit: {
                type: 'number',
                description: 'Maximale Ergebnisse (Standard: 10)',
              },
            },
            required: ['jql'],
          },
        },
      };
    },

    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { jql, limit = 10 } = args;

      if (!jql) return 'Error: JQL-Query erforderlich';
      if (!context?.userId) return 'Error: Anmeldung erforderlich';

      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) return 'Error: Nicht mit Jira verbunden.';
      if (!tokens.cloudId) return 'Error: Jira Cloud-ID fehlt. Bitte neu verbinden.';

      try {
        const apiUrl = getJiraApiUrl(tokens.cloudId);
        const params = new URLSearchParams({
          jql,
          maxResults: String(Math.min(limit, 50)),
          fields: 'summary,status,assignee,priority,created,updated',
        });

        const response = await fetch(`${apiUrl}/search?${params}`, {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            return 'Error: Jira-Zugriff verweigert. Bitte neu verbinden.';
          }
          const text = await response.text();
          return `Error: Jira API: ${response.status} - ${text}`;
        }

        const data = await response.json() as { issues: any[]; total: number };

        if (!data.issues?.length) {
          return `Keine Issues gefunden für: ${jql}`;
        }

        let output = `${data.issues.length} von ${data.total} Issue(s):\n\n`;
        for (const issue of data.issues) {
          const f = issue.fields;
          output += `### ${issue.key}: ${f.summary}\n`;
          output += `- **Status**: ${f.status?.name}\n`;
          output += `- **Priorität**: ${f.priority?.name}\n`;
          output += `- **Zugewiesen**: ${f.assignee?.displayName || 'Nicht zugewiesen'}\n`;
          output += `- **Aktualisiert**: ${new Date(f.updated).toLocaleDateString()}\n\n`;
        }
        return output;
      } catch (error: any) {
        console.error('Jira search error:', error);
        return `Error: ${error.message}`;
      }
    },

    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
```

## Besonderheiten dieses Beispiels

1. **Cloud-ID Discovery**: Atlassian erfordert einen zusätzlichen API-Call zur Ermittlung der Cloud-ID
2. **JQL**: Jira Query Language als mächtiges Suchinterface für den LLM
3. **Token-Erweiterung**: `cloudId` wird dynamisch im TokenSet gespeichert
4. **URL-Helpers**: Separate `config.ts` für saubere URL-Konstruktion
