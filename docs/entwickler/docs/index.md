# Entwickler-Dokumentation

Willkommen zur Entwickler-Dokumentation des Adacor Workplace. Hier finden Sie alle Informationen zum Erstellen eigener Connector-Plugins.

## Was sind Plugins?

Das Plugin-System ermöglicht die modulare Erweiterung des Adacor Workplace um externe Dienste (Connectors), ohne den Plattform-Kern zu ändern. Plugins leben als eigenständige Pakete unter `data/connections/providers/` und werden beim Serverstart dynamisch geladen.

## Schnellstart

Ein Connector-Plugin besteht aus:

1. **`manifest.yaml`** — Metadaten, OAuth-Config, Konfigurationsschema
2. **`provider.ts`** — OAuthProvider-Klasse mit Validierung und Tool-Registration
3. **`config.ts`** — API-URL-Helpers (optional)
4. **`tools/*.ts`** — Tool-Implementierungen für den LLM-Zugriff

```
data/connections/providers/mein-connector/
├── manifest.yaml
├── provider.ts
├── config.ts
├── credentials.yaml
└── tools/
    ├── search.ts
    └── read-item.ts
```

## Voraussetzungen

- Bun Runtime (1.1+)
- TypeScript
- Alle Imports über `@platform/sdk` — keine relativen Imports in Plattform-Code

## Inhaltsübersicht

| Bereich | Beschreibung |
|---------|-------------|
| [System-Architektur](./architektur/uebersicht.md) | Design-Prinzipien und Komponentenübersicht |
| [Verzeichnisstruktur](./architektur/verzeichnisstruktur.md) | Dateien und Verzeichnisse im Detail |
| [Erste Schritte](./plugins/einstieg.md) | Schritt-für-Schritt zum ersten Plugin |
| [OAuthProvider](./plugins/oauth-provider.md) | Die OAuthProvider-Basisklasse |
| [ConnectionProvider](./plugins/connection-provider.md) | BaseConnectionProvider und Helper-Methoden |
| [Tools](./plugins/tools.md) | Tool-Registrierung und -Implementierung |
| [Plugin-Manifest](./plugins/manifest.md) | manifest.yaml Referenz |
| [OAuth-Plugin Beispiel](./beispiele/oauth-plugin.md) | Vollständiges OAuth-Plugin (Confluence/Jira) |
| [API-Key-Plugin Beispiel](./beispiele/api-plugin.md) | Plugin mit API-Key-Authentifizierung (Pipedrive) |
| [Plugin-Registry API](./api/registry.md) | Plugin-Registry und Connection-Registry |
| [Konfiguration](./api/konfiguration.md) | Plugin-Konfiguration und Secrets |
