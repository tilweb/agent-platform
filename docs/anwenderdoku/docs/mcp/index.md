# MCP Server

Das Model Context Protocol (MCP) ist ein offener Standard, mit dem KI-Modelle auf externe Tools und Datenquellen zugreifen können. Agent Platform unterstützt MCP sowohl als Client (externe MCP-Server einbinden) als auch als Server (Agent Platform selbst als MCP-Server bereitstellen).

---

## Zugang

Navigieren Sie über die Seitenleiste zu **Tools** und wechseln Sie in die Einstellungen unter **MCP Server**, oder öffnen Sie direkt **Einstellungen > MCP Server** (Admin-Bereich).

---

## Überblick

Die MCP-Server-Seite zeigt Statistiken:

- **Konfiguriert** -- Anzahl eingerichteter Server
- **Verbunden** -- Anzahl aktuell aktiver Verbindungen
- **Tools** -- Gesamtzahl der über MCP bereitgestellten Tools

---

## MCP-Server einbinden

### Vorlagen

Für gängige MCP-Server stehen vorkonfigurierte Vorlagen bereit:

| Server | Beschreibung |
|--------|-------------|
| **GitHub** | Zugriff auf GitHub-Repositories, Issues, Pull Requests |
| **Filesystem** | Dateisystem-Zugriff mit konfigurierbaren Verzeichnissen |
| **SQLite** | SQLite-Datenbank-Abfragen |
| **Brave Search** | Websuche über Brave Search |
| **Puppeteer** | Browser-Automatisierung und Web-Scraping |

Klicken Sie auf eine Vorlage, um die Grundkonfiguration zu übernehmen, und passen Sie die Einstellungen an.

### Manuell konfigurieren

Klicken Sie auf **Server hinzufügen** und füllen Sie die Felder aus:

| Feld | Beschreibung |
|------|-------------|
| **ID** | Eindeutiger Bezeichner |
| **Name** | Anzeigename |
| **Command** | Startbefehl (z. B. `npx`) |
| **Argumente** | Kommandozeilen-Argumente als Liste |
| **Umgebungsvariablen** | API-Keys und Konfiguration, unterstützt `${}`-Substitution |
| **Aktiviert** | Server ein-/ausschalten |
| **AutoConnect** | Automatisch beim Start verbinden |

### Verbindung verwalten

- **Verbinden** -- Startet den Server-Prozess und stellt die Verbindung her
- **Trennen** -- Beendet den Server-Prozess
- **Status** -- Zeigt den aktuellen Zustand an: Verbunden (grün), Verbindung wird aufgebaut (gelb), Fehler (rot), Getrennt (grau)

> [!info] Lebenszyklus
> MCP-Server laufen als Kindprozesse und kommunizieren über stdio-basiertes JSON-RPC 2.0. Sie sind nur aktiv, solange eine Verbindung besteht.

---

## Agent Platform als MCP-Server

Agent Platform kann selbst als MCP-Server betrieben werden, um seine Funktionen in anderen Tools (z. B. Claude Desktop, Cursor) bereitzustellen.

### Einrichtung

Fügen Sie die folgende Konfiguration in die MCP-Einstellungen Ihres Clients ein:

```json
{
  "mcpServers": {
    "agent-platform": {
      "command": "bun",
      "args": ["run", "src/mcp/server/index.ts"],
      "cwd": "<Pfad zum Backend>"
    }
  }
}
```

### Bereitgestellte Funktionen

Über den MCP-Server stehen die gleichen Tools zur Verfügung, die auch die Agenten in der Plattform nutzen -- Websuche, Knowledge Base, Tabellen und mehr.

---

## Was ist MCP?

Das **Model Context Protocol** ist ein offener Standard von Anthropic, der die Kommunikation zwischen KI-Modellen und externen Werkzeugen standardisiert.

- **Lokal ausgeführt** -- Server laufen auf Ihrem System, nicht in der Cloud
- **Erweiterbar** -- Jeder kann MCP-Server für eigene Tools erstellen
- **Standardisiert** -- Ein einheitliches Protokoll statt proprietärer Integrationen

> [!tip] Voraussetzungen
> Für die meisten MCP-Server wird Node.js (für `npx`-basierte Server) benötigt. Einige Server erfordern zusätzliche API-Keys, die als Umgebungsvariablen konfiguriert werden.
