# Verzeichnisstruktur

Übersicht über die Dateien und Verzeichnisse des Plugin-Systems.

## Gesamtstruktur

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
│   │   ├── base/                       ← Abstrakte Basisklassen
│   │   │   ├── ConnectionProvider.ts   ← BaseConnectionProvider
│   │   │   └── OAuthProvider.ts        ← OAuthProvider (extends Base)
│   │   ├── types.ts                    ← TokenSet, OAuth2Config, ConnectionTool, etc.
│   │   ├── registry.ts                 ← ConnectionRegistry (Provider-Verwaltung)
│   │   ├── crypto.ts                   ← AES-256-GCM Verschlüsselung
│   │   ├── storage.ts                  ← Token-Persistenz
│   │   └── index.ts                    ← Public API
│   └── tools/
│       └── types.ts                    ← ToolDefinition, ToolContext, etc.
│
├── data/
│   ├── plugins/
│   │   ├── registry.yaml               ← Persistierter Plugin-Status
│   │   ├── builtin/                     ← Mitgelieferte Plugins
│   │   │   ├── confluence/
│   │   │   │   ├── manifest.yaml
│   │   │   │   ├── provider.ts
│   │   │   │   ├── config.ts
│   │   │   │   └── tools/
│   │   │   │       ├── search.ts
│   │   │   │       ├── read-page.ts
│   │   │   │       └── list-spaces.ts
│   │   │   ├── google-drive/
│   │   │   │   ├── manifest.yaml
│   │   │   │   ├── provider.ts
│   │   │   │   ├── config.ts
│   │   │   │   └── tools/
│   │   │   │       ├── list-files.ts
│   │   │   │       ├── read-file.ts
│   │   │   │       └── search-files.ts
│   │   │   └── pipedrive/
│   │   │       ├── manifest.yaml
│   │   │       ├── provider.ts
│   │   │       ├── config.ts
│   │   │       └── tools/
│   │   │           ├── search-deals.ts
│   │   │           ├── search-contacts.ts
│   │   │           ├── search-activities.ts
│   │   │           └── get-deal.ts
│   │   └── installed/                   ← Nachinstallierte Plugins
│   └── config/
│       └── plugins/                     ← Verschlüsselte Credentials
│           ├── confluence.yaml
│           ├── google-drive.yaml
│           └── pipedrive.yaml
```

## Plattform-Code vs. Plugin-Code

| Verzeichnis | Typ | Beschreibung |
|-------------|-----|-------------|
| `backend/src/plugins/` | Plattform | Plugin-Infrastruktur (Loader, Registry, SDK) |
| `backend/src/connections/` | Plattform | Connection-Basisklassen und Registry |
| `data/plugins/builtin/` | Plugin | Mitgelieferte Connector-Plugins |
| `data/plugins/installed/` | Plugin | Nachinstallierte Plugins |
| `data/config/plugins/` | Config | Verschlüsselte Credentials (getrennt von Code) |

## Plugin-Verzeichnis

Jedes Plugin hat folgende Struktur:

```
data/plugins/builtin/<plugin-id>/
├── manifest.yaml        ← Pflicht: Metadaten und Konfiguration
├── provider.ts          ← Pflicht: OAuthProvider-Klasse
├── config.ts            ← Optional: URL-Helpers
└── tools/               ← Pflicht: Mindestens ein Tool
    ├── search.ts
    └── read-item.ts
```

### manifest.yaml

Beschreibt Metadaten, OAuth-Konfiguration und das Konfigurationsschema für die Admin-UI. Siehe [Plugin-Manifest](../plugins/manifest.md) für die vollständige Referenz.

### provider.ts

Enthält die Provider-Klasse (extends `OAuthProvider`) und wird beim Serverstart dynamisch importiert. Muss einen Default-Export der Provider-Instanz haben:

```typescript
export default new MeinProvider();
```

### tools/

Enthält die Tool-Implementierungen, die dem LLM als Funktionen zur Verfügung stehen. Jedes Tool ist eine eigene Datei.

## Credentials-Speicherung

Plugin-Credentials werden **getrennt vom Plugin-Code** gespeichert:

- **Speicherort**: `data/config/plugins/{pluginId}.yaml`
- **Verschlüsselung**: AES-256-GCM für Felder mit `secret: true` im Manifest
- **Schlüssel**: `CONNECTION_ENCRYPTION_KEY` Umgebungsvariable
