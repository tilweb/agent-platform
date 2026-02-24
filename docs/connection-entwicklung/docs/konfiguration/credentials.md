# Credentials & Secrets

Connections benötigen Zugangsdaten (Client ID, Client Secret, API Keys), die sicher gespeichert und verwaltet werden müssen. Die Plattform bietet dafür ein flexibles Credential-System mit automatischer Verschlüsselung.

## Credential-Modi

Der `credentialMode` im Manifest bestimmt, wer die Zugangsdaten konfiguriert und wie sie gespeichert werden:

| Modus | Konfiguration durch | Speicherort | Anwendungsfall |
|-------|-------------------|-------------|---------------|
| `company` | Admin | Pro Plugin | Eine OAuth-App für die gesamte Organisation |
| `user` | Jeder Benutzer | Pro Plugin + Benutzer | Jeder Benutzer bringt eigene API-Keys mit |
| `both` | Admin + Benutzer | Beide möglich | Admin konfiguriert Basis, Benutzer können überschreiben |

### company (Standard)

```yaml
connector:
  credentialMode: company
```

- Ein Admin konfiguriert die Zugangsdaten einmalig
- Alle Benutzer nutzen dieselbe OAuth-App
- Typisch für: Confluence, Google Drive, Pipedrive

### user

```yaml
connector:
  credentialMode: user
```

- Jeder Benutzer konfiguriert eigene Zugangsdaten
- Kein Admin-Setup nötig
- Typisch für: Persönliche API-Keys, individuelle Service-Accounts

### both

```yaml
connector:
  credentialMode: both
```

- Admin konfiguriert Basis-Credentials
- Benutzer können eigene Credentials eintragen (überschreibt Company-Credentials)
- Fallback: Benutzerspezifische Credentials zuerst, dann Company-Credentials

## ConfigSchema im Manifest

Das `configSchema` definiert, welche Felder der Admin (oder Benutzer) ausfüllen muss:

```yaml
configSchema:
  - key: clientId
    label: "Client ID"
    type: string
    required: true
    placeholder: "z.B. abc123def456..."
  - key: clientSecret
    label: "Client Secret"
    type: string
    secret: true
    required: true
    placeholder: "z.B. xyz789..."
  - key: apiBaseUrl
    label: "API Base-URL"
    type: url
    required: false
    default: "https://api.example.com"
    description: "Nur ändern bei eigener Instanz"
```

### Feld-Typen

| Typ | Eingabe | Beispiel |
|-----|---------|---------|
| `string` | Textfeld | Client ID, API Key |
| `number` | Zahlenfeld | Port, Limit |
| `boolean` | Checkbox | Feature-Flag |
| `enum` | Dropdown | Auswahl aus Optionen |
| `url` | URL-Feld | API-Endpunkt |

### Secret-Felder

Felder mit `secret: true` werden besonders behandelt:

1. **Verschlüsselung** — Der Wert wird mit AES-256-GCM verschlüsselt gespeichert
2. **API-Maskierung** — In API-Antworten erscheint der Wert als `"***"`
3. **Kein Klartext** — Secrets sind nie im Klartext in Dateien oder API-Responses sichtbar

```yaml
- key: clientSecret
  label: "Client Secret"
  type: string
  secret: true        # ← Aktiviert Verschlüsselung
  required: true
```

> [!warning] Verschlüsselungsschlüssel
> Die Verschlüsselung erfordert die Umgebungsvariable `CONNECTION_ENCRYPTION_KEY`. Ohne diesen Schlüssel können keine Secrets gespeichert werden.

## Config im Provider auflösen

### resolveOAuthConfig(pluginId)

Für OAuth-Provider kombiniert `resolveOAuthConfig()` automatisch die statischen OAuth-URLs aus dem Manifest mit den gespeicherten Credentials:

```typescript
import { resolveOAuthConfig } from '@platform/sdk';

// Im Provider:
protected async getOAuthConfig(): Promise<OAuth2Config> {
  return resolveOAuthConfig(this.id);
  // Liefert: { authorizationUrl, tokenUrl, clientId, clientSecret, scopes, ... }
}
```

### resolvePluginConfig(pluginId, configSchema, userId?, credentialMode?)

Für allgemeine Konfigurationswerte (z.B. API-Base-URL, Feature-Flags):

```typescript
import { resolvePluginConfig } from '@platform/sdk';

const config = await resolvePluginConfig(
  'mein-service',
  manifest.configSchema,
  userId,
  manifest.connector.credentialMode
);

if (config) {
  const baseUrl = config.apiBaseUrl || 'https://api.default.com';
}
```

Bei `credentialMode: 'both'` prüft `resolvePluginConfig()` zuerst benutzerspezifische und dann Company-Credentials.

## Speicherorte

Die Plattform speichert Credentials automatisch an den richtigen Orten:

| Modus | Pfad |
|-------|------|
| Company | `data/connections/connectors/{pluginId}/credentials.yaml` |
| User | `data/connections/connectors/{pluginId}/{userId}.yaml` |

> [!info]
> Sie müssen sich nicht um die Speicherung kümmern — die Plattform übernimmt das automatisch über die Admin-Oberfläche. Die Pfade sind hier nur zur Information aufgeführt.

## Praxis-Beispiel

### Manifest mit gemischten Feldern

```yaml
configSchema:
  # OAuth-Credentials (secret)
  - key: clientId
    label: "Client ID"
    type: string
    required: true

  - key: clientSecret
    label: "Client Secret"
    type: string
    secret: true
    required: true

  # Optionale Konfiguration (nicht secret)
  - key: defaultWorkspace
    label: "Standard-Workspace"
    type: string
    required: false
    description: "Workspace-ID für die Standard-Suche"

  - key: region
    label: "Region"
    type: enum
    required: true
    options:
      - "eu"
      - "us"
      - "ap"
    default: "eu"
```

In diesem Beispiel werden `clientId` als Klartext und `clientSecret` verschlüsselt gespeichert. `defaultWorkspace` und `region` sind optionale Konfigurationsfelder ohne Verschlüsselung.
