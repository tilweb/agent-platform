# Entwickler-Dokumentation

Technische Dokumentation für Entwickler des KI-Workplace.

## Plattform

Architektur, Systeme und Konzepte der Plattform.

| Dokument                                                | Beschreibung                                         |
| ------------------------------------------------------- | ---------------------------------------------------- |
| [Architektur](plattform/architektur.md)                 | Stack, Startup, Request-Flow, Middleware, API-Routen |
| [Verzeichnisstruktur](plattform/verzeichnisstruktur.md) | Vollständiger Projektbaum mit Erklärungen            |
| [Provider-System](plattform/provider-system.md)         | Multi-Provider LLM-Konfiguration und Einrichtung     |
| [Provider-API](plattform/provider-api.md)               | REST API-Referenz für Provider und Modelle           |
| [Tool-System](plattform/tool-system.md)                 | Tool-Registry, Kategorien, Interface, Registrierung  |
| [Agent-System](plattform/agenten.md)                    | Agent-Konfiguration, Delegation, Modell-Resolution   |
| [Skill-System](plattform/skills.md)                     | Skills, Workflows, Knowledge-Referenzen              |
| [MCP-Integration](plattform/mcp.md)                     | MCP Client/Server, Runner, Konfiguration             |
| [Verbindungen](plattform/verbindungen.md)               | OAuth-System, Token-Management, Security             |
| [App-Framework](plattform/apps.md)                      | Built-in Applications, Registry, API                 |

## Plugin-Entwicklung

Anleitungen und Referenzen für die Entwicklung von Connector-Plugins.

| Dokument                                                 | Beschreibung                                               |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| [Erste Schritte](plugins/einstieg.md)                    | Schritt-für-Schritt-Anleitung zum Erstellen eines Plugins  |
| [Plugin-Manifest](plugins/manifest.md)                   | manifest.yaml Referenz (Felder, OAuth, Config-Schema)      |
| [Plugin-Tools](plugins/tools.md)                         | Connection-Tools entwickeln (Konventionen, Best Practices) |
| [OAuthProvider](plugins/oauth-provider.md)               | OAuthProvider-Klasse (Methoden, Helper)                    |
| [BaseConnectionProvider](plugins/connection-provider.md) | Basisklasse für Provider                                   |
| [Konfiguration & Secrets](plugins/konfiguration.md)      | Verschlüsselte Credentials, resolveOAuthConfig             |
| [SDK-Referenz](plugins/sdk-referenz.md)                  | pluginRegistry, connectionRegistry, Admin-API              |

## Beispiele

| Dokument                                  | Beschreibung                                  |
| ----------------------------------------- | --------------------------------------------- |
| [OAuth-Plugin](beispiele/oauth-plugin.md) | Vollständiges Beispiel eines OAuth-Connectors |
| [API-Plugin](beispiele/api-plugin.md)     | Beispiel eines API-Key-basierten Connectors   |
