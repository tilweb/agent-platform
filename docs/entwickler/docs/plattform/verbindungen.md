# Verbindungen (Connections)

Das Connections-System ermoeglicht OAuth2- und API-Key-basierte Verbindungen zu externen Diensten. Benutzer koennen sich mit Diensten wie Confluence, Google Drive oder Pipedrive verbinden, und Agenten nutzen diese Verbindungen ueber Connection-Tools.

## Ueberblick

```
User verbindet sich          Agent nutzt Verbindung
     |                             |
     v                             v
OAuth-Flow                   Tool-Aufruf
  -> State generieren          -> connectionRegistry.getTokens()
  -> Redirect zum Dienst       -> Auto-Refresh bei Ablauf
  -> Callback mit Code         -> Authentifizierter API-Call
  -> Token Exchange            -> Ergebnis an LLM
  -> Verschluesselt speichern
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
  -> Tokens verschluesselt speichern
  -> Redirect zurueck zur UI
```

### 3. Token-Nutzung

```
connectionRegistry.getTokens(userId, providerId)
  -> Token geladen
  -> Abgelaufen? -> provider.refreshToken() -> neuen Token speichern
  -> Gueltigen Token zurueckgeben
```

## Token-Management

### Verschluesselung

- **Algorithmus**: AES-256-GCM (Authenticated Encryption)
- **Schluessel**: `CONNECTION_ENCRYPTION_KEY` Umgebungsvariable (64 hex chars = 256 bit)
- Jeder verschluesselte Wert enthaelt: IV + Auth-Tag + Ciphertext

```bash
# Schluessel generieren:
openssl rand -hex 32
```

### Token-Speicherung

Tokens werden pro User und Provider verschluesselt gespeichert:

```
data/connections/tokens/
└── <user-id>/
    └── <provider-id>.yaml    # Verschluesseltes TokenSet
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

`connectionRegistry.getTokens()` prueft automatisch ob der Token abgelaufen ist und refresht ihn bei Bedarf:

```typescript
const tokens = await connectionRegistry.getTokens(userId, providerId);
if (!tokens) {
  // Nicht verbunden
}
// tokens.accessToken ist garantiert gueltig (oder null wenn Refresh fehlschlug)
```

## Security

### State-Validation

Jeder OAuth-Flow generiert einen zufaelligen State-Parameter, der beim Callback validiert wird (CSRF-Schutz).

### Redirect-URI-Whitelist

Callbacks werden nur von konfigurierten Redirect-URIs akzeptiert.

### ALLOWED_OAUTH_HOSTS

Einschraenkung der erlaubten OAuth-Hosts ueber Umgebungsvariable (optional).

### Credential-Verschluesselung

Plugin-Credentials (clientId, clientSecret) werden mit AES-256-GCM verschluesselt in `data/connections/connectors/<id>/credentials.yaml` gespeichert. Nur Felder mit `secret: true` im Manifest werden verschluesselt.

## Credential-Modi

Im Plugin-Manifest konfiguriert unter `connector.credentialMode`:

| Modus | Beschreibung |
|-------|-------------|
| `company` (Standard) | Ein Satz Credentials fuer alle User. Admin konfiguriert einmalig. |
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
| `/api/connections` | GET | User | Alle verfuegbaren Verbindungen |
| `/api/connections/:id/status` | GET | User | Verbindungsstatus pruefen |
| `/api/connections/:id/connect` | POST | User | OAuth-Flow starten |
| `/api/connections/:id/callback` | GET | - | OAuth-Callback |
| `/api/connections/:id/disconnect` | POST | User | Verbindung trennen |

Siehe auch die [Plugin-Entwicklung](../plugins/einstieg.md) fuer die Implementierung eigener Connectors.
