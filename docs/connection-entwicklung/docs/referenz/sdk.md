# SDK-Referenz

Das Platform-SDK (`@platform/sdk`) stellt alle Klassen, Typen und Registry-Singletons bereit, die für die Connection-Entwicklung benötigt werden.

## Import

```typescript
import {
  OAuthProvider,
  connectionRegistry,
  resolveOAuthConfig,
  resolvePluginConfig,
} from '@platform/sdk';

import type {
  TokenSet,
  ConnectionStatus,
  ConnectionTool,
  OAuth2Config,
  ToolDefinition,
  ToolContext,
  ConfigField,
} from '@platform/sdk';
```

## Basisklassen

### OAuthProvider

Abstrakte Basisklasse für OAuth2-basierte Connections.

```typescript
abstract class OAuthProvider extends BaseConnectionProvider {
  readonly authType = 'oauth2';

  // Abstrakt (müssen implementiert werden):
  protected abstract getOAuthConfig(): Promise<OAuth2Config>;
  abstract validateConnection(tokens: TokenSet): Promise<ConnectionStatus>;
  abstract getTools(): ConnectionTool[];

  // Konkret (können überschrieben werden):
  async getAuthUrl(state: string, redirectUri: string): Promise<string>;
  async exchangeCode(code: string, redirectUri: string): Promise<TokenSet>;
  async refreshToken(refreshToken: string): Promise<TokenSet>;
  protected processTokenResponse(data: any): TokenSet;

  // Hilfsmethoden:
  protected authenticatedFetch(url: string, tokens: TokenSet, options?: RequestInit): Promise<Response>;
  protected authenticatedJsonFetch<T>(url: string, tokens: TokenSet, options?: RequestInit): Promise<T>;
  protected createConnectedStatus(userInfo?: ConnectionStatus['userInfo']): ConnectionStatus;
  protected createExpiredStatus(): ConnectionStatus;
  protected createErrorStatus(error: string): ConnectionStatus;
}
```

Siehe [OAuthProvider](../provider/oauth-provider.md) für Details und Beispiele.

### BaseConnectionProvider

Abstrakte Basisklasse für alle Connection-Provider (auch nicht-OAuth).

```typescript
abstract class BaseConnectionProvider implements ConnectionProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly icon?: string;
  abstract readonly authType: AuthType;

  abstract validateConnection(tokens: TokenSet): Promise<ConnectionStatus>;
  abstract getTools(): ConnectionTool[];

  protected authenticatedFetch(url: string, tokens: TokenSet, options?: RequestInit): Promise<Response>;
  protected authenticatedJsonFetch<T>(url: string, tokens: TokenSet, options?: RequestInit): Promise<T>;
  protected createConnectedStatus(userInfo?: ConnectionStatus['userInfo']): ConnectionStatus;
  protected createExpiredStatus(): ConnectionStatus;
  protected createErrorStatus(error: string): ConnectionStatus;
}
```

## Registries

### connectionRegistry

Singleton für die Verwaltung registrierter Connection-Provider. Hauptsächlich in Tools verwendet, um Tokens abzurufen.

#### getTokens(userId, providerId)

Gibt die aktuellen Tokens eines Benutzers zurück. Erneuert abgelaufene Tokens automatisch.

```typescript
const tokens = await connectionRegistry.getTokens('user-123', 'confluence');
if (!tokens) {
  return 'Nicht verbunden';
}
// tokens.accessToken ist garantiert gültig
```

**Parameter:**
| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `userId` | string | Benutzer-ID |
| `providerId` | string | Provider-ID (z.B. `'confluence'`) |

**Rückgabe:** `TokenSet | null` — `null` wenn keine Verbindung besteht.

#### has(providerId)

Prüft, ob ein Provider registriert ist:

```typescript
if (connectionRegistry.has('confluence')) {
  // Confluence-Provider ist verfügbar
}
```

#### get(providerId)

Gibt den Provider zurück:

```typescript
const provider = connectionRegistry.get('confluence');
```

#### getAll()

Gibt alle registrierten Provider zurück:

```typescript
const providers = connectionRegistry.getAll();
```

### pluginRegistry

Singleton für die Verwaltung von Plugin-Manifests und Plugin-Status.

#### getManifest(pluginId)

Gibt das Manifest eines Plugins zurück:

```typescript
const manifest = pluginRegistry.getManifest('confluence');
if (manifest) {
  console.log(manifest.name); // "Atlassian Confluence"
}
```

#### isConfigured(pluginId)

Prüft, ob ein Plugin konfiguriert ist (alle Pflichtfelder ausgefüllt):

```typescript
if (pluginRegistry.isConfigured('confluence')) {
  // Confluence hat gültige Credentials
}
```

#### isEnabled(pluginId)

Prüft, ob ein Plugin aktiviert ist:

```typescript
if (pluginRegistry.isEnabled('confluence')) {
  // Confluence ist aktiv
}
```

## Konfigurationsfunktionen

### resolveOAuthConfig(pluginId)

Kombiniert statische OAuth-URLs aus dem Manifest mit gespeicherten Credentials:

```typescript
const config = await resolveOAuthConfig('confluence');
// config: { authorizationUrl, tokenUrl, clientId, clientSecret, scopes, ... }
```

**Parameter:**
| Parameter | Typ | Beschreibung |
|-----------|-----|-------------|
| `pluginId` | string | Plugin-ID |

**Rückgabe:** `OAuth2Config` — Vollständige OAuth-Konfiguration.

**Fehler:** Wirft einen Fehler, wenn die Credentials nicht konfiguriert sind.

### resolvePluginConfig(pluginId, configSchema, userId?, credentialMode?)

Löst die Plugin-Konfiguration auf, mit Fallback-Logik bei `credentialMode: 'both'`:

```typescript
const config = await resolvePluginConfig(
  'mein-service',
  manifest.configSchema,
  userId,
  'both'
);
```

**Parameter:**
| Parameter | Typ | Pflicht | Beschreibung |
|-----------|-----|---------|-------------|
| `pluginId` | string | Ja | Plugin-ID |
| `configSchema` | ConfigField[] | Ja | Schema aus dem Manifest |
| `userId` | string | Nein | Benutzer-ID (für `user`/`both`) |
| `credentialMode` | string | Nein | `'company'`, `'user'`, `'both'` |

**Rückgabe:** `Record<string, any> | null` — Konfigurationswerte oder `null`.

**Fallback-Logik bei `both`:** Benutzerspezifische Config → Company Config → `null`

## Typ-Exports

Alle relevanten Typen werden als `type`-Exports bereitgestellt:

```typescript
import type {
  // Token & Status
  TokenSet,
  ConnectionStatus,
  ConnectionStatusType,

  // Provider
  ConnectionProvider,
  OAuth2Config,
  AuthType,

  // Tools
  ConnectionTool,
  Tool,
  ToolDefinition,
  ToolContext,
  ToolType,
  ToolParameters,
  ToolParameter,
  ToolMetadata,

  // Config
  ConfigField,
} from '@platform/sdk';
```

Siehe [Typen-Referenz](./types.md) für die vollständigen Typ-Definitionen.
