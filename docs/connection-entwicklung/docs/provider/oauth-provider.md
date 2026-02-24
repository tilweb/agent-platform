# OAuthProvider

Die `OAuthProvider`-Klasse ist die Basisklasse für alle OAuth2-basierten Connections. Sie implementiert den kompletten OAuth2 Authorization Code Flow und stellt Hilfsmethoden für authentifizierte API-Aufrufe bereit.

## Klassen-Hierarchie

```
BaseConnectionProvider (abstrakt)
  └── OAuthProvider (abstrakt)
        └── Ihre Provider-Klasse (konkret)
```

## Abstrakte Methoden (müssen implementiert werden)

### getOAuthConfig()

Liefert die OAuth2-Konfiguration. In den meisten Fällen delegieren Sie an `resolveOAuthConfig()`:

```typescript
protected async getOAuthConfig(): Promise<OAuth2Config> {
  return resolveOAuthConfig(this.id);
}
```

`resolveOAuthConfig()` kombiniert automatisch die statischen OAuth-URLs aus dem Manifest mit den gespeicherten Credentials (Client ID, Client Secret).

### validateConnection(tokens)

Prüft, ob eine bestehende Verbindung noch gültig ist. Wird aufgerufen, wenn ein Benutzer den Verbindungsstatus prüft.

```typescript
async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
  try {
    const user = await this.authenticatedJsonFetch<{ id: string; name: string }>(
      'https://api.example.com/me',
      tokens
    );
    return this.createConnectedStatus({
      id: user.id,
      name: user.name,
    });
  } catch (error: any) {
    if (error.message?.includes('401')) {
      return this.createExpiredStatus();
    }
    return this.createErrorStatus(error.message);
  }
}
```

### getTools()

Gibt die Liste der Connection-Tools zurück. Wird einmalig bei der Registrierung aufgerufen.

```typescript
getTools(): ConnectionTool[] {
  return [
    createSearchTool(this.id),
    createReadTool(this.id),
    createListTool(this.id),
  ];
}
```

## Geerbte Methoden (sofort nutzbar)

### authenticatedFetch(url, tokens, options?)

Führt einen HTTP-Request mit Bearer-Token durch:

```typescript
const response = await this.authenticatedFetch(
  'https://api.example.com/data',
  tokens,
  { method: 'POST', body: JSON.stringify(payload) }
);
```

### authenticatedJsonFetch\<T\>(url, tokens, options?)

Wie `authenticatedFetch`, parst aber automatisch die JSON-Antwort:

```typescript
const data = await this.authenticatedJsonFetch<{ results: Item[] }>(
  'https://api.example.com/search?q=test',
  tokens
);
```

### Status-Hilfsmethoden

```typescript
// Verbindung aktiv, optional mit Benutzer-Info
this.createConnectedStatus({ id, name, email, avatarUrl });

// Verbindung abgelaufen (Token expired)
this.createExpiredStatus();

// Fehler mit Nachricht
this.createErrorStatus('API nicht erreichbar');
```

## Override-Pattern (optionale Anpassungen)

### processTokenResponse(data)

Überschreiben Sie diese Methode, wenn der OAuth-Provider zusätzliche Felder in der Token-Antwort liefert:

```typescript
// Beispiel: Pipedrive liefert api_domain in der Token-Antwort
protected processTokenResponse(data: any): TokenSet {
  const tokens = super.processTokenResponse(data);
  if (data.api_domain) {
    (tokens as any).apiDomain = data.api_domain;
  }
  return tokens;
}
```

```typescript
// Beispiel: Confluence erfordert einen separaten cloudId-Abruf
protected override processTokenResponse(data: any): TokenSet {
  const tokens = super.processTokenResponse(data);
  // cloudId wird nach dem Token-Exchange separat abgerufen
  return tokens;
}
```

### exchangeCode(code, redirectUri)

Überschreiben Sie diese Methode, wenn der Provider einen nicht-standardmäßigen Token-Exchange erwartet:

```typescript
// Beispiel: Pipedrive erwartet Basic Auth statt client_credentials im Body
async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
  const config = await this.getOAuthConfig();
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();
  return this.processTokenResponse(data);
}
```

### refreshToken(refreshToken)

Überschreiben Sie diese Methode für Provider mit nicht-standardmäßiger Token-Erneuerung:

```typescript
async refreshToken(refreshToken: string): Promise<TokenSet> {
  const config = await this.getOAuthConfig();
  // Eigene Refresh-Logik...
  return this.processTokenResponse(data);
}
```

## Vollständiges Provider-Beispiel

```typescript
import { OAuthProvider, resolveOAuthConfig } from '@platform/sdk';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '@platform/sdk';
import { createSearchTool } from './tools/search';
import { createReadPageTool } from './tools/read-page';

const API_BASE = 'https://api.example.com/v2';

export class ExampleProvider extends OAuthProvider {
  readonly id = 'example-service';
  readonly name = 'Example Service';
  readonly description = 'Inhalte aus Example Service durchsuchen und lesen';
  readonly icon = 'example-service';

  protected async getOAuthConfig(): Promise<OAuth2Config> {
    return resolveOAuthConfig(this.id);
  }

  async validateConnection(tokens: TokenSet): Promise<ConnectionStatus> {
    try {
      const user = await this.authenticatedJsonFetch<{
        id: string;
        displayName: string;
        email: string;
      }>(`${API_BASE}/me`, tokens);

      return this.createConnectedStatus({
        id: user.id,
        name: user.displayName,
        email: user.email,
      });
    } catch (error: any) {
      return this.createErrorStatus(error.message);
    }
  }

  getTools(): ConnectionTool[] {
    return [
      createSearchTool(this.id),
      createReadPageTool(this.id),
    ];
  }
}

export default new ExampleProvider();
```

## Wichtige Hinweise

> [!warning] Default-Export
> Die Provider-Datei **muss** eine Instanz als Default-Export bereitstellen (`export default new MyProvider()`). Die Plattform importiert diesen Export beim Plugin-Laden.

> [!info] Token-Erneuerung
> Die Plattform erneuert abgelaufene Tokens automatisch über `refreshToken()`. Sie müssen dies nicht manuell handhaben — `connectionRegistry.getTokens()` liefert immer gültige Tokens.

> [!tip] API-Base-URL
> Definieren Sie API-Base-URLs als Konstanten am Dateianfang. Bei Providern mit variablen Domains (z.B. Pipedrive mit `api_domain`) speichern Sie die Domain im `TokenSet` via `processTokenResponse()`.
