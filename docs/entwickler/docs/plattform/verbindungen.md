# Verbindungen (Connections)

Das Connections-System ermöglicht OAuth2- und API-Key-basierte Verbindungen zu externen Diensten. Benutzer können sich mit Diensten wie Confluence, Google Drive oder Pipedrive verbinden, und Agenten nutzen diese Verbindungen über Connection-Tools.

## Überblick

```
User verbindet sich          Agent nutzt Verbindung
     |                             |
     v                             v
OAuth-Flow                   Tool-Aufruf
  -> State generieren          -> connectionRegistry.getTokens()
  -> Redirect zum Dienst       -> Auto-Refresh bei Ablauf
  -> Callback mit Code         -> Authentifizierter API-Call
  -> Token Exchange            -> Ergebnis an LLM
  -> Verschlüsselt speichern
```

## OAuth-Flow

### 1. Verbindung initiieren

```
POST /api/connections/:providerId/connect
  -> ConnectionRegistry.get(providerId)
  -> provider.getAuthUrl(state, redirectUri)
  -> resolveOAuthConfig(providerId)
     ├── pluginRegistry.getManifest()  -> authorizationUrl, scopes
     └── resolvePluginConfig()          -> clientId, clientSecret
  -> OAuth-Redirect an externen Dienst
```

### 2. Callback

```
GET /api/connections/:providerId/callback?code=...&state=...
  -> State validieren
  -> provider.exchangeCode(code, redirectUri)
  -> Tokens verschlüsselt speichern
  -> Redirect zurück zur UI
```

### 3. Token-Nutzung

```
connectionRegistry.getTokens(userId, providerId)
  -> Token geladen
  -> Abgelaufen? -> provider.refreshToken() -> neuen Token speichern
  -> Gültigen Token zurückgeben
```

## Token-Management

### Verschlüsselung

- **Algorithmus**: AES-256-GCM (Authenticated Encryption)
- **Schlüssel**: `CONNECTION_ENCRYPTION_KEY` Umgebungsvariable (64 hex chars = 256 bit)
- Jeder verschlüsselte Wert enthält: IV + Auth-Tag + Ciphertext

```bash
# Schlüssel generieren:
openssl rand -hex 32
```

### Token-Speicherung

Tokens werden pro User und Provider verschlüsselt gespeichert:

```
data/connections/tokens/
└── <user-id>/
    └── <provider-id>.yaml    # Verschlüsseltes TokenSet
```

### TokenSet

```typescript
interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;         // ISO 8601
  tokenType: string;          // z.B. 'Bearer'
  scope?: string;
  // Provider-spezifische Felder:
  cloudId?: string;           // Atlassian
  apiDomain?: string;         // Pipedrive
}
```

### Auto-Refresh

`connectionRegistry.getTokens()` prüft automatisch ob der Token abgelaufen ist und refresht ihn bei Bedarf:

```typescript
const tokens = await connectionRegistry.getTokens(userId, providerId);
if (!tokens) {
  // Nicht verbunden
}
// tokens.accessToken ist garantiert gültig (oder null wenn Refresh fehlschlug)
```

## Security

### State-Validation

Jeder OAuth-Flow generiert einen zufälligen State-Parameter, der beim Callback validiert wird (CSRF-Schutz).

### Redirect-URI-Whitelist

Callbacks werden nur von konfigurierten Redirect-URIs akzeptiert.

### ALLOWED_OAUTH_HOSTS

Einschränkung der erlaubten OAuth-Hosts über Umgebungsvariable (optional).

### Credential-Verschlüsselung

Plugin-Credentials (clientId, clientSecret) werden mit AES-256-GCM verschlüsselt in `data/connections/connectors/<id>/credentials.yaml` gespeichert. Nur Felder mit `secret: true` im Manifest werden verschlüsselt.

## Credential-Modi

Im Plugin-Manifest konfiguriert unter `connector.credentialMode`:

| Modus | Beschreibung |
|-------|-------------|
| `company` (Standard) | Ein Satz Credentials für alle User. Admin konfiguriert einmalig. |
| `user` | Jeder User hat eigene Credentials. |
| `both` | User-Credentials mit Fallback auf Company-Credentials. |

## ConnectionStatus

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

## REST API

| Endpoint | Methode | Auth | Beschreibung |
|----------|---------|------|-------------|
| `/api/connections` | GET | User | Alle verfügbaren Verbindungen |
| `/api/connections/:id/status` | GET | User | Verbindungsstatus prüfen |
| `/api/connections/:id/connect` | POST | User | OAuth-Flow starten |
| `/api/connections/:id/callback` | GET | - | OAuth-Callback |
| `/api/connections/:id/disconnect` | POST | User | Verbindung trennen |

Siehe auch die [Plugin-Entwicklung](../plugins/einstieg.md) für die Implementierung eigener Connectors.
