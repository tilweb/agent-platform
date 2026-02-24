# Connection-Entwicklung

Connections erweitern die Plattform um Anbindungen an externe Dienste. Über Connections können Benutzer ihre bestehenden Tools — wie Confluence, Pipedrive oder Google Drive — direkt aus dem Chat heraus nutzen.

## Was sind Connections?

Eine Connection besteht aus drei Teilen:

| Komponente | Beschreibung |
|-----------|-------------|
| **Manifest** | `manifest.yaml` — definiert Metadaten, OAuth-Konfiguration und Setup-Anleitung |
| **Provider** | TypeScript-Klasse — implementiert den Authentifizierungsfluss und die Verbindungsvalidierung |
| **Tools** | Funktionen — stellen die eigentlichen Fähigkeiten bereit (Suche, Lesen, Erstellen) |

## Architektur

```
manifest.yaml          → Plugin-Metadaten, OAuth-URLs, Config-Schema
    ↓
provider.ts            → OAuthProvider-Subklasse, Token-Handling
    ↓
tools/*.ts             → ConnectionTool-Implementierungen
```

Die Plattform übernimmt automatisch:

- **Plugin-Discovery** — scannt `data/connections/connectors/*/manifest.yaml`
- **Token-Management** — OAuth2-Flow, Token-Speicherung, automatische Token-Erneuerung
- **Credential-Verschlüsselung** — Secrets werden mit AES-256-GCM verschlüsselt
- **Tool-Registrierung** — Connection-Tools werden automatisch im globalen Tool-System verfügbar
- **Admin-UI** — Konfigurationsformulare werden aus dem `configSchema` generiert

## Voraussetzungen

- Grundkenntnisse in TypeScript
- Verständnis von OAuth2 (Authorization Code Flow)
- Zugang zur Admin-Oberfläche für die Konfiguration

## Verzeichnisstruktur

Jede Connection lebt in einem eigenen Verzeichnis unter `data/connections/connectors/`:

```
data/connections/connectors/mein-service/
├── manifest.yaml           # Plugin-Manifest (Pflicht)
├── provider.ts             # Provider-Klasse (Pflicht)
└── tools/
    ├── search.ts           # Tool: Suche
    └── read.ts             # Tool: Inhalte lesen
```

## Nächste Schritte

- [Schnellstart: Neue Connection erstellen](./schnellstart/neue-connection.md) — Step-by-Step-Anleitung
- [manifest.yaml Referenz](./manifest/format.md) — alle Felder im Detail
- [OAuthProvider](./provider/oauth-provider.md) — Provider-Klasse implementieren
