# Plugin-Manifest

Jedes Plugin muss ein `manifest.yaml` im Wurzelverzeichnis haben. Es beschreibt Metadaten, Konfigurationsschema und den Connector-Abschnitt.

## Vollständiges Beispiel

```yaml
id: mein-connector
type: connector
name: "Mein Dienst"
description: "Verbindung zu Mein Dienst für Datenabfragen"
version: "1.0.0"
author: "Dein Name"

configSchema:
  - key: clientId
    label: "Client ID"
    type: string
    required: true
    placeholder: "z.B. abc123..."
  - key: clientSecret
    label: "Client Secret"
    type: string
    secret: true
    required: true
    placeholder: "z.B. xyz789..."

setupGuide: |
  ## Mein Dienst einrichten
  1. Gehe zu developer.mein-dienst.com
  2. Erstelle eine OAuth-App
  3. Kopiere Client ID und Secret

connector:
  authType: oauth2
  credentialMode: company
  transport: inprocess
  entryPoint: provider.ts
  oauth:
    authorizationUrl: "https://mein-dienst.com/oauth/authorize"
    tokenUrl: "https://mein-dienst.com/oauth/token"
    scopes:
      - "read"
      - "offline_access"
    additionalAuthParams:
      prompt: "consent"
    additionalTokenParams:
      audience: "api.example"
```

## Pflichtfelder

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | `string` | Eindeutiger Bezeichner (= Verzeichnisname). Erlaubt: `a-z`, `0-9`, `-` |
| `type` | `'connector'` | Muss `connector` sein |
| `name` | `string` | Anzeigename in der UI |
| `description` | `string` | Kurzbeschreibung |
| `version` | `string` | SemVer-Version |

## Connector-Abschnitt

| Feld | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| `connector.authType` | `'oauth2' \| 'api-key'` | — | Authentifizierungstyp |
| `connector.transport` | `'inprocess' \| 'mcp'` | `'inprocess'` | Wie der Provider geladen wird |
| `connector.entryPoint` | `string` | — | Pfad zum Provider-Modul (bei `inprocess`) |
| `connector.credentialMode` | `'company' \| 'user' \| 'both'` | `'company'` | Wer Credentials besitzt |

### Credential-Modi

- **`company`**: Ein Satz Credentials für alle User (Standard). Admin konfiguriert einmalig, alle User nutzen dieselben OAuth-Zugangsdaten.
- **`user`**: Jeder User hat eigene Credentials. Jeder User muss seine eigene OAuth-App registrieren.
- **`both`**: User-Credentials mit Fallback auf Company-Credentials.

### Transport-Modi

- **`inprocess`**: TypeScript-Modul wird direkt im Backend-Prozess geladen. Standard für die meisten Plugins.
- **`mcp`**: Externer Prozess über MCP-Protokoll. Für Plugins in anderen Sprachen oder mit eigener Runtime.

## OAuth-Abschnitt (`connector.oauth`)

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `authorizationUrl` | `string` | OAuth-Authorization-Endpoint |
| `tokenUrl` | `string` | OAuth-Token-Endpoint |
| `scopes` | `string[]` | Angeforderte Berechtigungen |
| `additionalAuthParams` | `Record<string, string>` | Extra Query-Params für den Auth-Request |
| `additionalTokenParams` | `Record<string, string>` | Extra Body-Params für den Token-Request |

## Config Schema (`configSchema`)

Definiert die Felder, die in der Admin-UI unter **Einstellungen > Verbindungen** konfiguriert werden.

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

> [!info] Verschlüsselung
> Felder mit `secret: true` werden mit AES-256-GCM verschlüsselt in `data/config/plugins/{pluginId}.yaml` gespeichert. Der Schlüssel wird über die Umgebungsvariable `CONNECTION_ENCRYPTION_KEY` bereitgestellt.

## Setup Guide (`setupGuide`)

Markdown-Text mit Anleitung zum Einrichten des externen Dienstes. Wird in der Admin-UI angezeigt wenn ein Admin das Plugin konfiguriert.

```yaml
setupGuide: |
  ## Atlassian Confluence einrichten

  1. Gehe zu [developer.atlassian.com](https://developer.atlassian.com)
  2. Erstelle eine OAuth 2.0 (3LO) Integration
  3. Callback URL: `{API_BASE_URL}/api/connections/confluence/callback`
  4. Benötigte Scopes: `read:confluence-content.all`, `offline_access`
  5. Kopiere Client ID und Client Secret
```

## Validierung

Beim Laden prüft der Plugin-Loader:

1. `id` muss mit dem Verzeichnisnamen übereinstimmen
2. `type` muss `connector` sein
3. `connector.entryPoint` muss auf eine existierende Datei zeigen
4. YAML-Syntax muss gültig sein

Fehlerhafte Manifeste werden übersprungen und ein Fehler geloggt — sie crashen nicht den Serverstart.
