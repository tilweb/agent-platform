# Plugin SDK — Entwickler-Dokumentation

> Anleitung zum Erstellen eigener Connector-Plugins für die Agent Platform.
> Stand: Februar 2026

---

## Schnellstart

Ein Connector-Plugin besteht aus:

1. **`manifest.yaml`** — Metadaten, OAuth-Config, Konfigurationsschema
2. **`provider.ts`** — OAuthProvider-Klasse mit Validierung und Tool-Registration
3. **`config.ts`** — API-URL-Helpers (optional)
4. **`tools/*.ts`** — Tool-Implementierungen für den LLM-Zugriff

```
data/plugins/builtin/mein-connector/
├── manifest.yaml
├── provider.ts
├── config.ts
└── tools/
    ├── search.ts
    └── read-item.ts
```

---

## Voraussetzungen

- Bun Runtime (1.1+)
- TypeScript
- Alle Imports über `@platform/sdk` — keine relativen Imports in Plattform-Code

---

## Schritt 1: Manifest erstellen

Erstelle `data/plugins/builtin/<plugin-id>/manifest.yaml`:

```yaml
id: mein-connector
type: connector
name: "Mein Dienst"
description: "Verbindung zu Mein Dienst für Datenabfragen"
version: "1.0.0"
author: "Dein Name"

# Konfigurationsfelder für die Admin-UI
configSchema:
  - key: clientId
    label: "Client ID"
    type: string
    required: true
    placeholder: "z.B. abc123..."
  - key: clientSecret
    label: "Client Secret"
    type: string
    secret: true           # wird verschlüsselt gespeichert
    required: true
    placeholder: "z.B. xyz789..."

# Setup-Anleitung (Markdown)
setupGuide: |
  ## Mein Dienst einrichten
  1. Gehe zu developer.mein-dienst.com
  2. Erstelle eine OAuth-App
  3. Kopiere Client ID und Secret

# Connector-Konfiguration
connector:
  authType: oauth2
  credentialMode: company     # company | user | both
  transport: inprocess        # inprocess (TypeScript) | mcp (externer Prozess)
  entryPoint: provider.ts     # Pfad relativ zum Plugin-Verzeichnis
  oauth:
    authorizationUrl: "https://mein-dienst.com/oauth/authorize"
    tokenUrl: "https://mein-dienst.com/oauth/token"
    scopes:
      - "read"
      - "offline_access"
    additionalAuthParams:     # optional: extra Query-Params für Authorization-URL
      prompt: "consent"
    additionalTokenParams:    # optional: extra Body-Params für Token-Request
      audience: "api.example"
```

### Manifest-Referenz

#### Pflichtfelder

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | `string` | Eindeutiger Bezeichner (= Verzeichnisname). Erlaubt: `a-z`, `0-9`, `-` |
| `type` | `'connector'` | Muss `connector` sein |
| `name` | `string` | Anzeigename in der UI |
| `description` | `string` | Kurzbeschreibung |
| `version` | `string` | SemVer-Version |

#### Connector-Abschnitt

| Feld | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| `connector.authType` | `'oauth2' \| 'api-key'` | — | Authentifizierungstyp |
| `connector.transport` | `'inprocess' \| 'mcp'` | `'inprocess'` | Wie der Provider geladen wird |
| `connector.entryPoint` | `string` | — | Pfad zum Provider-Modul (bei `inprocess`) |
| `connector.credentialMode` | `'company' \| 'user' \| 'both'` | `'company'` | Wer Credentials besitzt |

#### OAuth-Abschnitt (`connector.oauth`)

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `authorizationUrl` | `string` | OAuth-Authorization-Endpoint |
| `tokenUrl` | `string` | OAuth-Token-Endpoint |
| `scopes` | `string[]` | Angeforderte Berechtigungen |
| `additionalAuthParams` | `Record<string, string>` | Extra Query-Params für den Auth-Request |
| `additionalTokenParams` | `Record<string, string>` | Extra Body-Params für den Token-Request |

#### Config Schema (`configSchema`)

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `key` | `string` | Interner Schlüssel (z.B. `clientId`) |
| `label` | `string` | Label in der Admin-UI |
| `type` | `'string' \| 'number' \| 'boolean' \| 'enum' \| 'url'` | Feldtyp |
| `required` | `boolean` | Pflichtfeld? |
| `secret` | `boolean` | AES-256-GCM verschlüsselt speichern? |
| `description` | `string` | Hilfetext |
| `placeholder` | `string` | Platzhalter im Input-Feld |
| `options` | `string[]` | Optionen bei `type: 'enum'` |
| `default` | `any` | Standardwert |

---

## Schritt 2: Provider implementieren

Erstelle `provider.ts` im Plugin-Verzeichnis:

```typescript
import { OAuthProvider, resolveOAuthConfig } from '@platform/sdk';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '@platform/sdk';
import { createSearchTool } from './tools/search';
import { createReadItemTool } from './tools/read-item';

// Dienst-spezifische Interfaces
interface MeinDienstUser {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
}

export class MeinDienstProvider extends OAuthProvider {
  // ─── Pflicht-Properties ────────────────────────────────
  readonly id = 'mein-connector';      // Muss mit manifest.id übereinstimmen
  readonly name = 'Mein Dienst';
  readonly description = 'Verbindung zu Mein Dienst für Datenabfragen';
  readonly icon = '🔗';               // Emoji oder Data-URI

  private tools: ConnectionTool[] | null = null;

  // ─── OAuth Config (Pflicht) ────────────────────────────
  protected async getOAuthConfig(): Promise<OAuth2Config> {
    // resolveOAuthConfig liest URLs aus dem Manifest
    // und Credentials aus dem verschlüsselten Config-Store
    return resolveOAuthConfig(this.id);
  }

  // ─── Token-Response verarbeiten (optional) ─────────────
  // Nur überschreiben wenn der Dienst zusätzliche Felder zurückgibt
  protected override processTokenResponse(data: any): TokenSet {
    const tokens = super.processTokenResponse(data);

    // Beispiel: Dienst gibt api_domain in der Token-Response zurück
    if (data.api_domain) {
      (tokens as any).apiDomain = data.api_domain;
    }

    return tokens;
  }

  // ─── Verbindung validieren (Pflicht) ───────────────────
  override async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      // API-Call um zu prüfen ob die Tokens funktionieren
      const response = await this.authenticatedFetch(
        'https://api.mein-dienst.com/me',
        tokens
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status} - ${text}`);
      }

      const user = await response.json() as MeinDienstUser;

      return this.createConnectedStatus({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
      });
    } catch (error: any) {
      if (error.message?.includes('401') || error.message?.includes('403')) {
        return this.createExpiredStatus();
      }
      return this.createErrorStatus(error.message);
    }
  }

  // ─── Tools registrieren (Pflicht) ──────────────────────
  override getTools(): ConnectionTool[] {
    if (!this.tools) {
      this.tools = [
        createSearchTool(this.id),
        createReadItemTool(this.id),
      ];
    }
    return this.tools;
  }
}

// ★ Default Export — wird vom Plugin-Loader dynamisch importiert
export default new MeinDienstProvider();
```

### Provider-Basisklasse: `OAuthProvider`

Die `OAuthProvider`-Klasse (extends `BaseConnectionProvider`) implementiert den Standard-OAuth2-Flow:

| Methode | Muss überschrieben werden? | Beschreibung |
|---------|---------------------------|-------------|
| `getOAuthConfig()` | **Ja** | Gibt `OAuth2Config` zurück. Nutze `resolveOAuthConfig(this.id)` |
| `validateConnection(tokens)` | **Ja** | Prüft ob Tokens gültig sind, gibt Status zurück |
| `getTools()` | **Ja** | Gibt alle Tools des Connectors zurück |
| `processTokenResponse(data)` | Nein (optional) | Dienst-spezifische Token-Felder extrahieren |
| `exchangeCode(code, redirectUri)` | Nein (optional) | Überschreiben bei nicht-standard Token Exchange |
| `refreshToken(refreshToken)` | Nein (optional) | Überschreiben bei nicht-standard Token Refresh |

### Helper-Methoden (geerbt von `BaseConnectionProvider`)

| Methode | Beschreibung |
|---------|-------------|
| `authenticatedFetch(url, tokens, options?)` | Fetch mit Authorization-Header |
| `authenticatedJsonFetch<T>(url, tokens, options?)` | Wie oben, mit JSON-Parsing und Fehlerbehandlung |
| `createConnectedStatus(userInfo?)` | Erzeugt `ConnectionStatus` mit `status: 'connected'` |
| `createErrorStatus(message)` | Erzeugt `ConnectionStatus` mit `status: 'error'` |
| `createExpiredStatus()` | Erzeugt `ConnectionStatus` mit `status: 'expired'` |

### Sonderfälle: Token Exchange / Refresh überschreiben

Manche Dienste (z.B. Pipedrive) erwarten Basic Auth statt Client Credentials im Body:

```typescript
override async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
  const config = await this.getOAuthConfig();

  // Basic Auth Header statt Body-Params
  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return this.processTokenResponse(data);
}
```

---

## Schritt 3: Tools implementieren

Tools sind die Schnittstelle zwischen LLM und externem Dienst. Jedes Tool definiert:
- **Name und Beschreibung** für den LLM
- **Parameter-Schema** (JSON Schema)
- **Execute-Funktion** die den API-Call macht

Erstelle eine Datei unter `tools/`:

```typescript
// tools/search.ts

import type { ToolDefinition, ToolContext, ConnectionTool } from '@platform/sdk';
import { connectionRegistry } from '@platform/sdk';

export function createSearchTool(providerId: string): ConnectionTool {
  return {
    // ─── Pflichtfelder ─────────────────────────
    name: 'meindienst_search',        // Muss einzigartig sein
    type: 'connection',                // Immer 'connection' für Connector-Tools
    providerId,                        // Wird vom Provider übergeben

    // ─── Tool-Definition für den LLM ───────────
    getDefinition(): ToolDefinition {
      return {
        type: 'function',
        function: {
          name: 'meindienst_search',   // Muss mit name oben übereinstimmen
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

    // ─── Ausführung ────────────────────────────
    async execute(args: Record<string, any>, context?: ToolContext): Promise<string> {
      const { query, limit = 10 } = args;

      // 1. Parameter validieren
      if (!query) {
        return 'Error: Suchbegriff ist erforderlich';
      }

      // 2. User prüfen
      if (!context?.userId) {
        return 'Error: Anmeldung erforderlich';
      }

      // 3. Tokens holen (werden automatisch refresht wenn abgelaufen)
      const tokens = await connectionRegistry.getTokens(context.userId, providerId);
      if (!tokens) {
        return 'Error: Nicht mit Mein Dienst verbunden. Bitte unter Verbindungen verbinden.';
      }

      try {
        // 4. API-Call an den externen Dienst
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
          const text = await response.text();
          if (response.status === 401 || response.status === 403) {
            return 'Error: Zugriff verweigert. Token abgelaufen? Bitte neu verbinden.';
          }
          return `Error: API-Fehler: ${response.status} - ${text}`;
        }

        const data = await response.json() as { items: any[] };

        if (!data.items?.length) {
          return `Keine Ergebnisse für "${query}" gefunden.`;
        }

        // 5. Ergebnis für den LLM formatieren (Markdown)
        let output = `${data.items.length} Ergebnis(se) für "${query}":\n\n`;
        for (const item of data.items) {
          output += `### ${item.title}\n`;
          output += `- **ID**: ${item.id}\n`;
          output += `- **Erstellt**: ${item.created_at}\n\n`;
        }
        return output;

      } catch (error: any) {
        console.error('MeinDienst search error:', error);
        return `Error: ${error.message}`;
      }
    },

    // ─── Verfügbarkeit (optional) ──────────────
    async isAvailable(): Promise<boolean> {
      return connectionRegistry.has(providerId);
    },
  };
}
```

### Tool-Konventionen

| Konvention | Beispiel | Beschreibung |
|-----------|---------|-------------|
| **Naming** | `confluence_search`, `gdrive_read_file` | `<prefix>_<aktion>` |
| **Return-Typ** | `string` | Tools geben immer einen String zurück (Markdown oder JSON) |
| **Fehlerformat** | `'Error: ...'` | Fehler beginnen mit `Error:` |
| **Token-Check** | `connectionRegistry.getTokens()` | Immer zuerst Tokens prüfen |
| **Auth-Fehler** | Status 401/403 → "Token abgelaufen" | Benutzer auf Reconnect hinweisen |

### Parameter-Typen (JSON Schema)

```typescript
parameters: {
  type: 'object',
  properties: {
    query: { type: 'string', description: '...' },
    limit: { type: 'number', description: '...' },
    active: { type: 'boolean', description: '...' },
    status: {
      type: 'string',
      enum: ['open', 'closed', 'all'],
      description: '...',
    },
  },
  required: ['query'],  // Pflicht-Parameter
}
```

---

## Schritt 4: URL-Helpers (optional)

Wenn dein Dienst viele API-Endpoints hat, lohnt sich ein `config.ts`:

```typescript
// config.ts

const API_BASE = 'https://api.mein-dienst.com/v1';

export function getSearchUrl(): string {
  return `${API_BASE}/search`;
}

export function getItemUrl(itemId: string): string {
  return `${API_BASE}/items/${itemId}`;
}

export function getUserUrl(): string {
  return `${API_BASE}/me`;
}
```

Tools importieren dann relativ: `import { getSearchUrl } from '../config';`

---

## SDK API-Referenz

### Imports

Alle Imports über den `@platform/sdk`-Alias:

```typescript
// Basisklassen
import { OAuthProvider, BaseConnectionProvider } from '@platform/sdk';

// Registries
import { connectionRegistry, pluginRegistry } from '@platform/sdk';

// OAuth Config (generisch)
import { resolveOAuthConfig, resolvePluginConfig } from '@platform/sdk';

// Types
import type {
  TokenSet,
  ConnectionStatus,
  ConnectionStatusType,
  ConnectionTool,
  ConnectionProvider,
  OAuth2Config,
  AuthType,
  Tool,
  ToolDefinition,
  ToolContext,
  ToolType,
  ToolParameters,
  ToolParameter,
  ToolMetadata,
} from '@platform/sdk';
```

### `resolveOAuthConfig(pluginId: string): Promise<OAuth2Config>`

Kombiniert statische OAuth-URLs/Scopes aus dem Manifest mit dynamischen Credentials aus dem verschlüsselten Config-Store.

```typescript
const config = await resolveOAuthConfig('mein-connector');
// → { authorizationUrl, tokenUrl, clientId, clientSecret, scopes, ... }
```

**Fehler:**
- Wirft wenn Manifest nicht geladen oder `connector.oauth` fehlt
- Wirft wenn `clientId` oder `clientSecret` nicht konfiguriert

### `connectionRegistry`

| Methode | Return | Beschreibung |
|---------|--------|-------------|
| `.register(provider)` | `void` | Registriert Provider + Tools |
| `.get(id)` | `ConnectionProvider \| undefined` | Provider nach ID |
| `.has(id)` | `boolean` | Existiert der Provider? |
| `.getTokens(userId, providerId)` | `Promise<TokenSet \| null>` | Tokens holen (auto-refresh) |
| `.getAll()` | `ConnectionProvider[]` | Alle registrierten Provider |
| `.getIds()` | `string[]` | Alle registrierten IDs |

### `TokenSet`

```typescript
interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;         // ISO 8601
  tokenType: string;          // z.B. 'Bearer'
  scope?: string;
  // Provider-spezifische Felder möglich:
  cloudId?: string;           // Atlassian
  apiDomain?: string;         // Pipedrive
}
```

### `ConnectionStatus`

```typescript
interface ConnectionStatus {
  status: 'connected' | 'disconnected' | 'error' | 'expired';
  lastChecked: string;        // ISO 8601
  expiresAt?: string;
  error?: string;
  userInfo?: {
    id?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
}
```

### `ConnectionTool`

```typescript
interface ConnectionTool extends Tool {
  readonly type: 'connection';
  readonly providerId: string;
}
```

### `ToolDefinition`

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

### `ToolContext`

```typescript
interface ToolContext {
  sessionId?: string;
  agentId?: string;
  delegationDepth?: number;
  userId?: string;             // ← Wichtig für connectionRegistry.getTokens()
  parentSessionId?: string;
}
```

---

## Vollständiges Beispiel: Jira Connector

Ein komplettes Beispiel eines hypothetischen Jira-Connectors:

### `data/plugins/builtin/jira/manifest.yaml`

```yaml
id: jira
type: connector
name: "Atlassian Jira"
description: "Jira Issues durchsuchen und lesen"
version: "1.0.0"
author: "Agent Platform"

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

### `data/plugins/builtin/jira/config.ts`

```typescript
const ATLASSIAN_API = 'https://api.atlassian.com';

export function getAccessibleResourcesUrl(): string {
  return `${ATLASSIAN_API}/oauth/token/accessible-resources`;
}

export function getJiraApiUrl(cloudId: string): string {
  return `${ATLASSIAN_API}/ex/jira/${cloudId}/rest/api/3`;
}
```

### `data/plugins/builtin/jira/provider.ts`

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

### `data/plugins/builtin/jira/tools/search-issues.ts`

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

---

## Checkliste: Neues Plugin erstellen

- [ ] Verzeichnis unter `data/plugins/builtin/<id>/` angelegt
- [ ] `manifest.yaml` mit allen Pflichtfeldern
- [ ] `connector.entryPoint` zeigt auf `provider.ts`
- [ ] `connector.oauth` enthält korrekte URLs und Scopes
- [ ] `configSchema` für clientId + clientSecret definiert
- [ ] `provider.ts` erweitert `OAuthProvider`
- [ ] `provider.ts` hat `export default new MeinProvider()`
- [ ] `getOAuthConfig()` nutzt `resolveOAuthConfig(this.id)`
- [ ] `validateConnection()` macht einen API-Call und gibt `ConnectionStatus` zurück
- [ ] `getTools()` gibt alle Tools zurück
- [ ] Alle Tools importieren von `@platform/sdk`
- [ ] Tool-Names sind einzigartig (Prefix mit Provider-Name)
- [ ] Tools prüfen `context?.userId` und `connectionRegistry.getTokens()`
- [ ] Backend neu starten → Logs prüfen: `Loaded connector: <id> from provider.ts`
- [ ] In der Admin-UI unter Connections → Plugin erscheint mit "Nicht konfiguriert"
- [ ] Credentials eintragen → Status wechselt zu "Konfiguriert"
- [ ] User verbindet sich → OAuth-Flow funktioniert
- [ ] Tools tauchen im Chat auf und können Daten abrufen

---

## Fehlerbehebung

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| Plugin erscheint nicht | `manifest.yaml` fehlt oder ungültig | YAML-Syntax prüfen, `id` und `type` gesetzt? |
| "manifest not loaded" | Plugin-ID stimmt nicht überein | `manifest.id` muss mit Verzeichnisname übereinstimmen |
| "no valid default export" | `export default` fehlt | `export default new MeinProvider();` hinzufügen |
| Import-Fehler `@platform/sdk` | tsconfig paths fehlt | `backend/tsconfig.json` prüfen — `baseUrl` und `paths` gesetzt? |
| "OAuth credentials not configured" | Admin hat Credentials nicht eingetragen | Admin-UI → Connections → Konfigurieren |
| "Encryption not configured" | `CONNECTION_ENCRYPTION_KEY` fehlt | In `.env` setzen |
| Tools fehlen im Chat | Provider nicht registriert | Server-Log prüfen — Fehler beim Laden? |
| Token-Refresh schlägt fehl | Dienst erwartet Basic Auth | `exchangeCode()` und `refreshToken()` überschreiben |
