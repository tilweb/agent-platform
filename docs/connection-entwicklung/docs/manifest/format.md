# manifest.yaml Referenz

Das Manifest ist die zentrale Konfigurationsdatei jeder Connection. Es definiert Metadaten, OAuth-Einstellungen, das Konfigurationsschema und die Setup-Anleitung.

## Vollständiges Beispiel

```yaml
id: confluence
type: connector
name: "Atlassian Confluence"
description: "Confluence-Seiten durchsuchen und lesen"
version: "1.0.0"
author: "KI-Workplace"

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

setupGuide: |
  ## Atlassian Confluence einrichten

  ### 1. Atlassian Developer Console
  1. Gehen Sie zu [developer.atlassian.com](https://developer.atlassian.com)
  2. Erstellen Sie eine neue OAuth 2.0 App
  3. Konfigurieren Sie die Callback-URL

  ### 2. Credentials eintragen
  Kopieren Sie Client ID und Client Secret in die Felder oben.

connector:
  authType: oauth2
  credentialMode: company
  transport: inprocess
  entryPoint: provider.ts

  oauth:
    authorizationUrl: "https://auth.atlassian.com/authorize"
    tokenUrl: "https://auth.atlassian.com/oauth/token"
    scopes:
      - "read:confluence-content.all"
      - "read:confluence-space.summary"
      - "offline_access"
    additionalAuthParams:
      audience: "api.atlassian.com"
      prompt: "consent"
```

## Felder im Detail

### Metadaten

| Feld          | Typ    | Pflicht | Beschreibung                                                                                  |
| ------------- | ------ | ------- | --------------------------------------------------------------------------------------------- |
| `id`          | string | Ja      | Eindeutiger Bezeichner (Kleinbuchstaben, Bindestriche). Muss dem Verzeichnisnamen entsprechen |
| `type`        | string | Ja      | Immer `connector` für Connections                                                             |
| `name`        | string | Ja      | Anzeigename (darf Umlaute enthalten)                                                          |
| `description` | string | Ja      | Kurze Beschreibung (Deutsch, für die UI)                                                      |
| `version`     | string | Ja      | Semantic Versioning (z.B. `1.0.0`)                                                            |
| `author`      | string | Ja      | Autor oder Team                                                                               |

### configSchema

Definiert die Formularfelder für die Admin-Konfiguration. Die Plattform generiert daraus automatisch ein Eingabeformular.

```yaml
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
  - key: baseUrl
    label: "API Base-URL"
    type: url
    required: false
    default: "https://api.example.com"
    description: "Nur ändern, wenn Sie eine eigene Instanz betreiben"
```

#### ConfigField-Optionen

| Feld          | Typ      | Pflicht | Beschreibung                                                             |
| ------------- | -------- | ------- | ------------------------------------------------------------------------ |
| `key`         | string   | Ja      | Schlüssel für die Speicherung                                            |
| `label`       | string   | Ja      | Anzeige-Label (Deutsch)                                                  |
| `type`        | string   | Ja      | `string`, `number`, `boolean`, `enum`, `url`                             |
| `required`    | boolean  | Ja      | Ob das Feld ausgefüllt sein muss                                         |
| `secret`      | boolean  | Nein    | Wenn `true`: Wert wird verschlüsselt gespeichert und in der API maskiert |
| `description` | string   | Nein    | Hilfetext unter dem Feld                                                 |
| `placeholder` | string   | Nein    | Platzhalter im Eingabefeld                                               |
| `options`     | string[] | Nein    | Auswahlmöglichkeiten (nur bei `type: enum`)                              |
| `default`     | any      | Nein    | Standardwert                                                             |

> [!tip] Secret-Felder
> Felder mit `secret: true` werden einzeln mit AES-256-GCM verschlüsselt. In API-Antworten an das Frontend erscheinen sie als `"***"`. Typische Secret-Felder: Client Secret, API Keys, Passwörter.

### setupGuide

Markdown-formatierte Einrichtungsanleitung. Wird in der Admin-Oberfläche neben dem Konfigurationsformular angezeigt.

```yaml
setupGuide: |
  ## Service einrichten

  ### Schritt 1
  Beschreibung...

  ### Schritt 2
  Beschreibung...
```

> [!info]
> Der `setupGuide` unterstützt vollständiges Markdown inklusive Links, Listen und Code-Blöcke.

### connector

Konfiguration des Connector-Verhaltens.

| Feld             | Typ    | Pflicht | Beschreibung                                                                         |
| ---------------- | ------ | ------- | ------------------------------------------------------------------------------------ |
| `authType`       | string | Ja      | `oauth2` oder `api-key`                                                              |
| `credentialMode` | string | Ja      | `company`, `user` oder `both` (siehe [Credentials](../konfiguration/credentials.md)) |
| `transport`      | string | Ja      | `inprocess` (Standard) oder `mcp`                                                    |
| `entryPoint`     | string | Ja      | Pfad zur Provider-Datei relativ zum Manifest                                         |

### connector.oauth

OAuth2-spezifische Konfiguration. Nur bei `authType: oauth2` relevant.

| Feld                    | Typ      | Pflicht | Beschreibung                                        |
| ----------------------- | -------- | ------- | --------------------------------------------------- |
| `authorizationUrl`      | string   | Ja      | URL für den Authorization-Endpunkt des Dienstes     |
| `tokenUrl`              | string   | Ja      | URL für den Token-Endpunkt des Dienstes             |
| `scopes`                | string[] | Ja      | Benötigte OAuth-Scopes                              |
| `additionalAuthParams`  | object   | Nein    | Zusätzliche Parameter für den Authorization-Request |
| `additionalTokenParams` | object   | Nein    | Zusätzliche Parameter für den Token-Exchange        |

#### additionalAuthParams

Werden als Query-Parameter an die Authorization-URL angehängt. Nützlich für Provider-spezifische Anforderungen:

```yaml
additionalAuthParams:
  audience: "api.atlassian.com" # Atlassian erfordert audience
  prompt: "consent" # Immer Consent-Screen anzeigen
  access_type: "offline" # Google: Refresh-Token anfordern
```

#### additionalTokenParams

Werden im Body des Token-Exchange-Requests mitgesendet:

```yaml
additionalTokenParams:
  custom_param: "value"
```

## Beispiele aus der Praxis

### Confluence (OAuth2, Company-Credentials)

```yaml
id: confluence
type: connector
name: "Atlassian Confluence"
connector:
  authType: oauth2
  credentialMode: company
  transport: inprocess
  entryPoint: provider.ts
  oauth:
    authorizationUrl: "https://auth.atlassian.com/authorize"
    tokenUrl: "https://auth.atlassian.com/oauth/token"
    scopes: ["read:confluence-content.all", "offline_access"]
    additionalAuthParams:
      audience: "api.atlassian.com"
      prompt: "consent"
```

### Pipedrive (OAuth2, Company-Credentials)

```yaml
id: pipedrive
type: connector
name: "Pipedrive CRM"
connector:
  authType: oauth2
  credentialMode: company
  transport: inprocess
  entryPoint: provider.ts
  oauth:
    authorizationUrl: "https://oauth.pipedrive.com/oauth/authorize"
    tokenUrl: "https://oauth.pipedrive.com/oauth/token"
    scopes: []
```
