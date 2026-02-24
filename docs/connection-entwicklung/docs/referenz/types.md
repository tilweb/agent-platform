# Typen-Referenz

Alle TypeScript-Typen, die für die Connection-Entwicklung relevant sind.

## TokenSet

Repräsentiert die OAuth-Tokens eines verbundenen Benutzers:

```typescript
interface TokenSet {
  accessToken: string;        // OAuth Access Token
  refreshToken?: string;      // OAuth Refresh Token (für automatische Erneuerung)
  expiresAt?: string;         // Ablaufzeitpunkt als ISO-Datum
  tokenType: string;          // Token-Typ, üblicherweise 'Bearer'
  scope?: string;             // Gewährte Scopes

  // Provider-spezifische Felder (via processTokenResponse):
  cloudId?: string;           // z.B. Confluence Cloud ID
  apiDomain?: string;         // z.B. Pipedrive API Domain
}
```

## ConnectionStatus

Status einer Benutzerverbindung:

```typescript
type ConnectionStatusType = 'connected' | 'disconnected' | 'error' | 'expired';

interface ConnectionStatus {
  status: ConnectionStatusType;
  lastChecked: string;           // ISO-Datum der letzten Prüfung
  expiresAt?: string;            // Token-Ablaufzeitpunkt
  error?: string;                // Fehlermeldung bei status 'error'
  userInfo?: {                   // Informationen zum verbundenen Benutzer
    id?: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
}
```

## OAuth2Config

Konfiguration für den OAuth2-Flow:

```typescript
interface OAuth2Config {
  authorizationUrl: string;                      // Authorization-Endpunkt
  tokenUrl: string;                              // Token-Endpunkt
  clientId: string;                              // OAuth Client ID
  clientSecret: string;                          // OAuth Client Secret
  scopes: string[];                              // Benötigte Scopes
  additionalAuthParams?: Record<string, string>; // Zusätzliche Auth-Parameter
  additionalTokenParams?: Record<string, string>;// Zusätzliche Token-Parameter
}
```

## ConnectionTool

Interface für Connection-Tools:

```typescript
interface ConnectionTool extends Tool {
  readonly type: 'connection';
  readonly providerId: string;
  readonly name: string;

  getDefinition(): ToolDefinition;
  execute(args: Record<string, any>, context?: ToolContext): Promise<string>;

  isAvailable?(): Promise<boolean>;
  getMetadata?(): ToolMetadata;
}
```

## ToolDefinition

Beschreibt ein Tool für den KI-Agenten (OpenAI Function-Calling-Schema):

```typescript
interface ToolDefinition {
  type: 'function';
  function: {
    name: string;               // Eindeutiger Tool-Name
    description: string;        // Beschreibung für den KI-Agenten
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required: string[];       // Liste der Pflichtparameter
    };
  };
}
```

## ToolParameter

Definition eines einzelnen Tool-Parameters:

```typescript
interface ToolParameter {
  type: string;             // 'string', 'number', 'boolean', 'array', 'object'
  description: string;      // Beschreibung für den KI-Agenten
  enum?: string[];          // Erlaubte Werte (optional)
  items?: ToolParameter;    // Bei type 'array': Element-Schema
}
```

## ToolContext

Kontext, der bei der Tool-Ausführung übergeben wird:

```typescript
interface ToolContext {
  userId?: string;          // ID des aufrufenden Benutzers
  chatId?: string;          // ID des aktuellen Chats
  agentId?: string;         // ID des ausführenden Agenten
}
```

## ConfigField

Definition eines Konfigurationsfelds im Manifest:

```typescript
interface ConfigField {
  key: string;              // Schlüssel für die Speicherung
  label: string;            // Anzeige-Label
  type: 'string' | 'number' | 'boolean' | 'enum' | 'url';
  required: boolean;
  secret?: boolean;         // Verschlüsselt speichern
  description?: string;     // Hilfetext
  placeholder?: string;     // Platzhalter
  options?: string[];       // Enum-Optionen
  default?: any;            // Standardwert
}
```

## CredentialMode

Bestimmt, wer Zugangsdaten konfiguriert:

```typescript
type CredentialMode = 'company' | 'user' | 'both';
```

## AuthType

Unterstützte Authentifizierungstypen:

```typescript
type AuthType = 'oauth2' | 'api-key';
```

## ConnectionProvider

Basis-Interface für alle Connection-Provider:

```typescript
interface ConnectionProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon?: string;
  readonly authType: AuthType;

  validateConnection(tokens: TokenSet): Promise<ConnectionStatus>;
  getTools(): ConnectionTool[];

  // Nur bei OAuth-Providern:
  getAuthUrl?(state: string, redirectUri: string): Promise<string>;
  exchangeCode?(code: string, redirectUri: string): Promise<TokenSet>;
  refreshToken?(refreshToken: string): Promise<TokenSet>;
}
```

## ConnectorTransport

Transport-Modus für den Connector:

```typescript
type ConnectorTransport = 'inprocess' | 'mcp';
```

| Wert | Beschreibung |
|------|-------------|
| `inprocess` | Provider läuft im Backend-Prozess (Standard) |
| `mcp` | Provider läuft als separater MCP-Server |
