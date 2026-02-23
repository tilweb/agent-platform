# OAuthProvider

Die `OAuthProvider`-Klasse ist die Basisklasse für alle OAuth2-basierten Connectors. Sie extends `BaseConnectionProvider` und implementiert den Standard-OAuth2-Flow.

## Import

```typescript
import { OAuthProvider, resolveOAuthConfig } from '@platform/sdk';
import type { TokenSet, ConnectionStatus, ConnectionTool, OAuth2Config } from '@platform/sdk';
```

## Pflicht-Properties

Jeder Provider muss folgende Properties definieren:

```typescript
export class MeinProvider extends OAuthProvider {
  readonly id = 'mein-connector';      // Muss mit manifest.id übereinstimmen
  readonly name = 'Mein Dienst';
  readonly description = 'Verbindung zu Mein Dienst';
  readonly icon = '🔗';               // Emoji oder Data-URI
}
```

## Methoden-Übersicht

| Methode | Muss überschrieben werden? | Beschreibung |
|---------|---------------------------|-------------|
| `getOAuthConfig()` | **Ja** | Gibt `OAuth2Config` zurück |
| `validateConnection(tokens)` | **Ja** | Prüft ob Tokens gültig sind |
| `getTools()` | **Ja** | Gibt alle Tools des Connectors zurück |
| `processTokenResponse(data)` | Nein (optional) | Dienst-spezifische Token-Felder extrahieren |
| `exchangeCode(code, redirectUri)` | Nein (optional) | Nicht-standard Token Exchange |
| `refreshToken(refreshToken)` | Nein (optional) | Nicht-standard Token Refresh |

## getOAuthConfig() — Pflicht

Gibt die OAuth2-Konfiguration zurück. Verwende `resolveOAuthConfig()` für den Standardfall:

```typescript
protected async getOAuthConfig(): Promise<OAuth2Config> {
  return resolveOAuthConfig(this.id);
}
```

`resolveOAuthConfig()` kombiniert statische OAuth-URLs aus dem Manifest mit dynamischen Credentials aus dem verschlüsselten Config-Store.

## validateConnection() — Pflicht

Prüft ob die gespeicherten Tokens noch gültig sind. Wird aufgerufen beim Statuscheck einer Verbindung.

```typescript
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
      avatarUrl: user.avatar_url,
    });
  } catch (error: any) {
    if (error.message?.includes('401') || error.message?.includes('403')) {
      return this.createExpiredStatus();
    }
    return this.createErrorStatus(error.message);
  }
}
```

> [!tip] Best Practice
> Immer einen leichtgewichtigen API-Endpoint verwenden (z.B. `/me` oder `/user`), um die Latenz gering zu halten.

## getTools() — Pflicht

Gibt alle Tools des Connectors zurück. Wird einmal aufgerufen und gecacht:

```typescript
private tools: ConnectionTool[] | null = null;

override getTools(): ConnectionTool[] {
  if (!this.tools) {
    this.tools = [
      createSearchTool(this.id),
      createReadItemTool(this.id),
    ];
  }
  return this.tools;
}
```

## processTokenResponse() — Optional

Überschreiben, wenn der externe Dienst zusätzliche Felder in der Token-Response zurückgibt:

```typescript
protected override processTokenResponse(data: any): TokenSet {
  const tokens = super.processTokenResponse(data);

  // Beispiel: Dienst gibt api_domain in der Token-Response zurück
  if (data.api_domain) {
    (tokens as any).apiDomain = data.api_domain;
  }

  return tokens;
}
```

## exchangeCode() — Optional

Überschreiben, wenn der Dienst einen nicht-standard Token Exchange erwartet (z.B. Basic Auth statt Body-Credentials):

```typescript
override async exchangeCode(code: string, redirectUri: string): Promise<TokenSet> {
  const config = await this.getOAuthConfig();

  // Basic Auth Header statt Body-Params
  const basicAuth = Buffer.from(
    `${config.clientId}:${config.clientSecret}`
  ).toString('base64');

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

## refreshToken() — Optional

Analog zu `exchangeCode()` — überschreiben wenn der Dienst einen nicht-standard Refresh erwartet.

## Helper-Methoden

Geerbt von `BaseConnectionProvider` (siehe [ConnectionProvider](./connection-provider.md)):

| Methode | Beschreibung |
|---------|-------------|
| `authenticatedFetch(url, tokens, options?)` | Fetch mit Authorization-Header |
| `authenticatedJsonFetch<T>(url, tokens, options?)` | Wie oben, mit JSON-Parsing |
| `createConnectedStatus(userInfo?)` | Status `connected` erzeugen |
| `createErrorStatus(message)` | Status `error` erzeugen |
| `createExpiredStatus()` | Status `expired` erzeugen |
