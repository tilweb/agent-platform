# BaseConnectionProvider

Die abstrakte Basisklasse für alle Connection-Provider. `OAuthProvider` erweitert diese Klasse und implementiert den OAuth2-Flow.

## Import

```typescript
import { BaseConnectionProvider } from '@platform/sdk';
import type { TokenSet, ConnectionStatus, ConnectionTool } from '@platform/sdk';
```

## Klassenstruktur

```typescript
abstract class BaseConnectionProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly icon: string;

  abstract validateConnection(tokens: TokenSet): Promise<ConnectionStatus>;
  abstract getTools(): ConnectionTool[];
}
```

## Helper-Methoden

### authenticatedFetch

Macht einen HTTP-Request mit automatischem Authorization-Header:

```typescript
const response = await this.authenticatedFetch(
  'https://api.example.com/data',
  tokens,
  { method: 'POST', body: JSON.stringify(payload) }
);
```

Der Authorization-Header wird automatisch gesetzt:
- `Bearer {accessToken}` für OAuth2-Tokens

### authenticatedJsonFetch

Wie `authenticatedFetch`, aber mit automatischem JSON-Parsing und Fehlerbehandlung:

```typescript
const data = await this.authenticatedJsonFetch<UserResponse>(
  'https://api.example.com/me',
  tokens
);
// data ist bereits geparst
```

### createConnectedStatus

Erzeugt einen `ConnectionStatus` mit `status: 'connected'`:

```typescript
return this.createConnectedStatus({
  id: user.id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatar_url,
});
```

Die `userInfo` ist optional — kann weggelassen werden wenn der Dienst keine User-Informationen liefert.

### createErrorStatus

Erzeugt einen `ConnectionStatus` mit `status: 'error'`:

```typescript
return this.createErrorStatus('API nicht erreichbar');
```

### createExpiredStatus

Erzeugt einen `ConnectionStatus` mit `status: 'expired'`:

```typescript
return this.createExpiredStatus();
```

Wird typischerweise bei 401/403-Antworten verwendet, um dem User anzuzeigen, dass er sich neu verbinden muss.

## Types

### TokenSet

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

### ConnectionStatus

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

### ConnectionTool

```typescript
interface ConnectionTool extends Tool {
  readonly type: 'connection';
  readonly providerId: string;
}
```
