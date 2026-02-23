# System-Architektur

Das Plugin-System ermöglicht die modulare Erweiterung des Adacor Workplace um externe Dienste (Connectors), ohne den Plattform-Kern zu ändern.

## Design-Prinzipien

- **Runtime-installierbar**: Plugins können zur Laufzeit hinzugefügt werden, ohne Backend-Code zu ändern
- **Isoliert**: Jedes Plugin ist ein eigenständiges Verzeichnis mit Manifest, Provider-Code und Tools
- **SDK-basiert**: Plugins greifen über `@platform/sdk` auf Plattform-APIs zu — keine relativen Imports in Plattform-Interna
- **Credentials getrennt von Code**: Plugin-Code liegt unter `data/plugins/`, verschlüsselte Credentials unter `data/config/plugins/`

## Architektur-Entscheidungen

| Entscheidung | Begründung |
|---|---|
| **Hybrid-Ansatz** | Nur Connectors/Marketplace-Packages in `data/plugins/`. Agents und Skills bleiben in `data/agents/` bzw. `data/skills/` |
| **Credentials getrennt** | `data/config/plugins/` statt `data/plugins/configs/` — Deployment-Config ist kein Plugin-Code |
| **tsconfig paths** | Bun unterstützt `paths` nativ — ein `@platform/sdk`-Alias macht Plugins ortsunabhängig |
| **Default Export** | Jeder Connector exportiert seine Provider-Instanz als `export default` für den dynamischen Loader |

## Komponentenübersicht

Das Plugin-System besteht aus folgenden Kernkomponenten:

### Plugin SDK (`@platform/sdk`)

Barrel-File (`backend/src/plugins/sdk.ts`), das alle öffentlichen APIs für Plugin-Code re-exportiert. Plugins importieren **ausschließlich** von `@platform/sdk`.

Aufgelöst über tsconfig paths:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@platform/sdk": ["./src/plugins/sdk.ts"]
    }
  }
}
```

### Plugin Loader

Wird beim Backend-Start aufgerufen und lädt alle Plugins dynamisch:

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

### Connection Registry

Verwaltet alle registrierten Provider:

- **`register(provider)`**: Registriert einen Provider und dessen Tools im globalen Tool-Registry
- **`getTokens(userId, providerId)`**: Gibt Tokens für einen User zurück, refresht automatisch bei Ablauf
- **`validateConnection(userId, providerId)`**: Prüft ob eine Verbindung funktioniert

### Config Storage

Verschlüsselte Speicherung der Plugin-Credentials mit AES-256-GCM.

## Startup-Ablauf

Beim Start des Backends wird die Initialisierung in folgender Reihenfolge ausgeführt:

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

## Datenfluss: OAuth-Verbindung

```
User → Frontend → POST /api/connections/:providerId/connect
                       ↓
               ConnectionRegistry.get(providerId)
                       ↓
               provider.getAuthUrl(state, redirectUri)
                       ↓
               resolveOAuthConfig(providerId)
                 ├── pluginRegistry.getManifest()  → authorizationUrl, scopes
                 └── resolvePluginConfig()          → clientId, clientSecret
                       ↓
               → OAuth-Redirect an externen Dienst
                       ↓
               Callback → provider.exchangeCode(code, redirectUri)
                       ↓
               Tokens verschlüsselt in data/connections/ gespeichert
```

## Datenfluss: Tool-Ausführung

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
