# Plugin-Architektur

> Technische Dokumentation des Plugin-Systems des Adacor Workplace.
> Stand: Februar 2026

---

## Überblick

Das Plugin-System ermöglicht die modulare Erweiterung des Adacor Workplace um externe Dienste (Connectors), ohne den Plattform-Kern zu ändern. Plugins leben als eigenständige Pakete unter `data/connections/providers/` und werden beim Serverstart dynamisch geladen.

### Design-Prinzipien

- **Runtime-installierbar**: Plugins können zur Laufzeit hinzugefügt werden, ohne Backend-Code zu ändern
- **Isoliert**: Jedes Plugin ist ein eigenständiges Verzeichnis mit Manifest, Provider-Code und Tools
- **SDK-basiert**: Plugins greifen über `@platform/sdk` auf Plattform-APIs zu — keine relativen Imports in Plattform-Interna
- **Credentials im Plugin-Verzeichnis**: Plugin-Code und verschlüsselte Credentials liegen gemeinsam unter `data/connections/providers/{id}/`

### Architektur-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| **Hybrid-Ansatz** | Nur Connectors/Marketplace-Packages in `data/connections/providers/`. Agents und Skills bleiben in `data/agents/` bzw. `data/skills/` |
| **Credentials pro Plugin** | `data/connections/providers/{id}/credentials.yaml` — Credentials liegen im Plugin-Verzeichnis |
| **tsconfig paths** | Bun unterstützt `paths` nativ — ein `@platform/sdk`-Alias macht Plugins ortsunabhängig |
| **Default Export** | Jeder Connector exportiert seine Provider-Instanz als `export default` für den dynamischen Loader |

---

## Verzeichnisstruktur

```
backend/
├── src/
│   ├── plugins/                        ← Plattform-Code (Plugin-Infrastruktur)
│   │   ├── sdk.ts                      ← Public API für Plugins (@platform/sdk)
│   │   ├── resolveOAuthConfig.ts       ← Generischer OAuth-Config-Resolver
│   │   ├── loader.ts                   ← Lädt Manifeste + importiert Connector-Provider
│   │   ├── registry.ts                 ← In-Memory-Registry mit Persistenz
│   │   ├── configStorage.ts            ← Verschlüsselte Credential-Speicherung
│   │   ├── migrateEnvCredentials.ts    ← ENV→Config-Migration (einmalig)
│   │   ├── types.ts                    ← Typdefinitionen
│   │   └── index.ts                    ← Public API Barrel
│   ├── connections/
│   │   ├── base/                       ← Abstrakte Basisklassen (bleiben)
│   │   │   ├── ConnectionProvider.ts   ← BaseConnectionProvider
│   │   │   └── OAuthProvider.ts        ← OAuthProvider (extends BaseConnectionProvider)
│   │   ├── types.ts                    ← TokenSet, OAuth2Config, ConnectionTool, etc.
│   │   ├── registry.ts                 ← ConnectionRegistry (Provider-Verwaltung)
│   │   ├── crypto.ts                   ← AES-256-GCM Verschlüsselung
│   │   ├── storage.ts                  ← Token-Persistenz
│   │   └── index.ts                    ← Public API
│   └── tools/
│       └── types.ts                    ← ToolDefinition, ToolContext, etc.
│
├── data/
│   └── connections/
│       ├── registry.yaml                ← Persistierter Plugin-Status
│       └── providers/                   ← Connector-Plugins (Code + Credentials)
│           ├── confluence/
│           │   ├── manifest.yaml        ← Plugin-Manifest
│           │   ├── provider.ts          ← OAuthProvider-Klasse
│           │   ├── config.ts            ← API-URL-Helpers
│           │   ├── credentials.yaml     ← Verschlüsselte Credentials
│           │   └── tools/
│           │       ├── search.ts
│           │       ├── read-page.ts
│           │       └── list-spaces.ts
│           ├── google-drive/
│           │   ├── manifest.yaml
│           │   ├── provider.ts
│           │   ├── config.ts
│           │   ├── credentials.yaml
│           │   └── tools/
│           │       ├── list-files.ts
│           │       ├── read-file.ts
│           │       └── search-files.ts
│           └── pipedrive/
│               ├── manifest.yaml
│               ├── provider.ts
│               ├── config.ts
│               ├── credentials.yaml
│               └── tools/
│                   ├── search-deals.ts
│                   ├── search-contacts.ts
│                   ├── search-activities.ts
│                   └── get-deal.ts
```

---

## Komponenten im Detail

### 1. Plugin Manifest (`manifest.yaml`)

Jedes Plugin muss ein `manifest.yaml` im Wurzelverzeichnis haben. Es beschreibt Metadaten, Konfigurationsschema und den Connector-Abschnitt.

```yaml
id: confluence                          # Eindeutige Plugin-ID
type: connector                         # Plugin-Typ: connector | agent | skill | bundle
name: Atlassian Confluence              # Anzeigename
description: "Confluence-Seiten durchsuchen und lesen"
version: "1.0.0"
author: "Adacor Workplace"

configSchema:                           # Felder für die Admin-UI
  - key: clientId
    label: "Client ID"
    type: string
    required: true
    placeholder: "z.B. abc123def456..."
  - key: clientSecret
    label: "Client Secret"
    type: string
    secret: true                        # → wird AES-256-GCM verschlüsselt
    required: true

setupGuide: |                           # Markdown-Anleitung für die Admin-UI
  ## Atlassian Confluence einrichten
  ...

connector:                              # Connector-spezifische Konfiguration
  authType: oauth2                      # oauth2 | api-key
  credentialMode: company               # company | user | both
  transport: inprocess                  # inprocess | mcp
  entryPoint: provider.ts              # Relativer Pfad zum Provider-Modul
  oauth:
    authorizationUrl: "https://auth.atlassian.com/authorize"
    tokenUrl: "https://auth.atlassian.com/oauth/token"
    scopes:
      - "read:confluence-content.all"
      - "offline_access"
    additionalAuthParams:
      audience: "api.atlassian.com"
      prompt: "consent"
```

**Wichtige Felder:**

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | `string` | Eindeutiger Bezeichner, wird als Verzeichnisname verwendet |
| `type` | `'connector' \| 'agent' \| 'skill' \| 'bundle'` | Plugin-Typ |
| `configSchema` | `ConfigField[]` | Felder, die in der Admin-UI konfiguriert werden |
| `configSchema[].secret` | `boolean` | Wenn `true`, wird der Wert AES-256-GCM verschlüsselt gespeichert |
| `connector.transport` | `'inprocess' \| 'mcp'` | `inprocess`: TypeScript-Modul, `mcp`: MCP-Server |
| `connector.entryPoint` | `string` | Pfad relativ zum Plugin-Verzeichnis |
| `connector.credentialMode` | `'company' \| 'user' \| 'both'` | Wer Credentials besitzt |

### 2. Plugin SDK (`@platform/sdk`)

Das SDK ist ein Barrel-File (`backend/src/plugins/sdk.ts`), das alle öffentlichen APIs für Plugin-Code re-exportiert. Plugins importieren **ausschließlich** von `@platform/sdk`.

**Aufgelöst über tsconfig paths:**

```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@platform/sdk": ["./src/plugins/sdk.ts"]
    }
  }
}
```

Bun löst `@platform/sdk` sowohl bei statischen als auch bei dynamischen Imports korrekt auf — unabhängig davon, wo die importierende Datei liegt.

**Exportierte APIs:**

| Export | Quelle | Zweck |
|--------|--------|-------|
| `OAuthProvider` | `connections/base/OAuthProvider` | Basisklasse für OAuth2-Connectors |
| `BaseConnectionProvider` | `connections/base/ConnectionProvider` | Basisklasse für alle Provider |
| `connectionRegistry` | `connections/registry` | Provider und Tokens registrieren/abrufen |
| `pluginRegistry` | `plugins/registry` | Plugin-Manifeste lesen |
| `resolvePluginConfig` | `plugins/configStorage` | Credentials entschlüsseln |
| `resolveOAuthConfig` | `plugins/resolveOAuthConfig` | OAuth2Config aus Manifest + Credentials |
| Types | diverse | `TokenSet`, `ConnectionTool`, `ToolDefinition`, `ToolContext`, etc. |

### 3. OAuth Config Resolver (`resolveOAuthConfig`)

Generische Funktion, die die drei identischen per-Provider-Funktionen (`getConfluenceConfig`, `getGoogleDriveConfig`, `getPipedriveConfig`) ersetzt.

**Logik:**
1. Liest statische OAuth-URLs und Scopes aus `pluginRegistry.getManifest(pluginId).connector.oauth`
2. Liest dynamische Credentials (`clientId`, `clientSecret`) aus dem verschlüsselten Config-Store
3. Kombiniert beides zu einer vollständigen `OAuth2Config`
4. Wirft einen Fehler wenn Manifest oder Credentials fehlen

```typescript
import { resolveOAuthConfig } from '@platform/sdk';

// In der Provider-Klasse:
protected async getOAuthConfig(): Promise<OAuth2Config> {
  return resolveOAuthConfig(this.id);  // z.B. 'confluence'
}
```

### 4. Plugin Loader (`loader.ts`)

Der Loader wird beim Backend-Start aufgerufen und führt folgende Schritte aus:

```
loadAllPlugins()
  ├── pluginRegistry.load()           ← Persistierten Status laden
  ├── migrateConfigDir()              ← Alte Config-Dateien migrieren
  ├── loadPluginsFromDir(builtin/)    ← Builtin-Plugins scannen
  │   ├── manifest.yaml laden
  │   ├── pluginRegistry.register()
  │   └── loadConnectorProvider()     ← Dynamischer Import
  │       ├── import(entryPoint)
  │       └── connectionRegistry.register(provider)
  ├── loadPluginsFromDir(installed/)  ← Installierte Plugins scannen
  └── migrateEnvCredentials()         ← ENV→Config-Migration
```

**Dynamischer Import:**
```typescript
async function loadConnectorProvider(pluginDir, manifest) {
  const entryPoint = join(pluginDir, manifest.connector.entryPoint);
  const module = await import(entryPoint);
  const provider = module.default;
  connectionRegistry.register(provider);
}
```

**Fehler-Isolation:** Ein fehlgeschlagener Connector-Load loggt den Fehler, crasht aber nicht den Startup.

### 5. Connection Registry

Die `ConnectionRegistry` verwaltet alle registrierten Provider:

- **`register(provider)`**: Registriert einen Provider und dessen Tools im globalen Tool-Registry
- **`getTokens(userId, providerId)`**: Gibt Tokens für einen User zurück, refresht automatisch bei Ablauf
- **`validateConnection(userId, providerId)`**: Prüft ob eine Verbindung funktioniert
- **`getProviderInfos(userId?)`**: Liefert Provider-Infos für das Frontend

### 6. Config Storage

Verschlüsselte Speicherung der Plugin-Credentials:

- **Speicherort**: `data/connections/providers/{pluginId}/credentials.yaml`
- **Verschlüsselung**: AES-256-GCM für Felder mit `secret: true`
- **Schlüssel**: `CONNECTION_ENCRYPTION_KEY` Umgebungsvariable
- **Credential-Modi**:
  - `company`: Ein Satz Credentials für alle User (Standard)
  - `user`: Jeder User hat eigene Credentials
  - `both`: User-Credentials mit Fallback auf Company-Credentials

### 7. Plugin Admin-API

| Endpoint | Methode | Auth | Beschreibung |
|----------|---------|------|-------------|
| `/api/plugins` | GET | User | Alle Plugins auflisten |
| `/api/plugins/:id` | GET | User | Plugin-Details |
| `/api/plugins/:id/config` | GET | Admin | Konfiguration lesen (Secrets maskiert) |
| `/api/plugins/:id/config` | PUT | Admin | Konfiguration speichern |
| `/api/plugins/:id/config` | DELETE | Admin | Konfiguration löschen |
| `/api/plugins/:id/enable` | POST | Admin | Plugin aktivieren |
| `/api/plugins/:id/disable` | POST | Admin | Plugin deaktivieren |

---

## Startup-Ablauf

Beim Start des Backends (`src/index.ts`) wird die Initialisierung in folgender Reihenfolge ausgeführt:

```
1. registerCommands()         ← Slash Commands
2. llmService.initialize()    ← LLM-Provider laden
3. imageGenerationService     ← Bildgenerierung
4. setupTools()               ← Basis-Tools registrieren
5. loadAllPlugins()           ← ★ Plugins + Connectors laden
6. mcpManager.initialize()    ← MCP-Server starten
7. recoverTasks()             ← Task Queue aufräumen
8. startExecutor()            ← Task Executor starten
```

`loadAllPlugins()` übernimmt alles, was vorher `registerProviders()` separat machte — Manifest-Registration UND Connector-Loading in einem Schritt.

### Startup-Log

```
Loaded 3 builtin plugin(s)
Registered connection provider: confluence (oauth2)
Registered tool: confluence_search (connection)
Registered tool: confluence_read_page (connection)
Registered tool: confluence_list_spaces (connection)
Loaded connector: confluence from provider.ts
Registered connection provider: google-drive (oauth2)
...
Plugin system: 3 plugin(s) loaded
```

---

## Datenfluss

### OAuth-Verbindung herstellen

```
User → Frontend → POST /api/connections/:providerId/connect
                       ↓
               ConnectionRegistry.get(providerId)
                       ↓
               provider.getAuthUrl(state, redirectUri)
                       ↓
               resolveOAuthConfig(providerId)
                 ├── pluginRegistry.getManifest()  → authorizationUrl, scopes
                 └── resolvePluginConfig()          → clientId, clientSecret (entschlüsselt)
                       ↓
               → OAuth-Redirect an externen Dienst
                       ↓
               Callback → provider.exchangeCode(code, redirectUri)
                       ↓
               Tokens verschlüsselt in data/connections/ gespeichert
```

### Tool-Ausführung

```
LLM → Tool Call: confluence_search({query: "..."})
         ↓
   ToolRegistry.execute('confluence_search', args, context)
         ↓
   connectionRegistry.getTokens(userId, providerId)
     ├── Token noch gültig? → Token zurückgeben
     └── Abgelaufen? → provider.refreshToken() → Token aktualisieren
         ↓
   Tool macht authentifizierten API-Call an externen Dienst
         ↓
   Ergebnis → LLM
```

---

## Migration: Alt → Neu

### Was sich geändert hat

| Vorher | Nachher |
|--------|---------|
| Provider-Code in `backend/src/connections/providers/` | Provider-Code in `data/connections/providers/` |
| Relative Imports (`../../base/OAuthProvider`) | SDK-Import (`@platform/sdk`) |
| Per-Provider OAuth-Config-Funktionen | Generischer `resolveOAuthConfig()` |
| Statische `registerProviders()` in `index.ts` | Dynamischer Import durch `loadAllPlugins()` |
| Credentials in `data/plugins/configs/` | Credentials in `data/connections/providers/{id}/credentials.yaml` |

### Config-Migration

Der Loader migriert automatisch vorhandene Config-Dateien von den alten Pfaden (`data/plugins/configs/*.yaml` und `data/config/plugins/*.yaml`) zum neuen Pfad (`data/connections/providers/{id}/credentials.yaml`). Bestehende Dateien am neuen Ort werden nicht überschrieben.

---

## Builtin-Plugins

### Confluence

- **ID**: `confluence`
- **Auth**: OAuth 2.0 (Atlassian)
- **Tools**: `confluence_search`, `confluence_read_page`, `confluence_list_spaces`
- **Besonderheit**: Cloud-ID wird aus `accessible-resources` API gelesen und in Tokens gespeichert

### Google Drive

- **ID**: `google-drive`
- **Auth**: OAuth 2.0 (Google)
- **Tools**: `gdrive_list_files`, `gdrive_read_file`, `gdrive_search`
- **Besonderheit**: Google Docs/Sheets/Slides werden als Text/CSV exportiert

### Pipedrive

- **ID**: `pipedrive`
- **Auth**: OAuth 2.0 (Pipedrive, Basic Auth Header)
- **Tools**: `pipedrive_search_deals`, `pipedrive_search_contacts`, `pipedrive_search_activities`, `pipedrive_get_deal`
- **Besonderheit**: Token Exchange und Refresh verwenden Basic Auth statt Body-Credentials
