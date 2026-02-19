# Tools

Tools sind Werkzeuge, die KI-Agenten während einer Konversation einsetzen, um Aufgaben auszuführen -- von der Websuche über Dateizugriff bis hin zu Tabellen-Abfragen. Die Tools-Seite gibt Ihnen einen Überblick über alle verfügbaren Werkzeuge und ermöglicht das Erstellen eigener API-Tools.

---

## Zugang

Navigieren Sie über die Seitenleiste zu **Tools**. Die Seite zeigt Statistiken (Gesamtzahl System-Tools, eigene Tools, verfügbare Tools) und eine filterbare Liste aller Werkzeuge.

---

## Tabs

| Tab | Inhalt |
|-----|--------|
| **Alle Tools** | System-Tools und eigene API-Tools zusammen |
| **Eigene API-Tools** | Nur selbst erstellte API-Integrationen |

---

## System-Tools

System-Tools sind fest in die Plattform integriert und stehen allen Agenten zur Verfügung. Sie sind in folgende Kategorien unterteilt:

### Dateisystem

| Tool | Beschreibung |
|------|-------------|
| **File Read** | Datei aus dem persönlichen Datenverzeichnis lesen |
| **File Write** | Datei in das persönliche Datenverzeichnis schreiben |
| **File List** | Dateien im persönlichen Datenverzeichnis auflisten |

### Websuche

| Tool | Beschreibung | Voraussetzung |
|------|-------------|---------------|
| **Web Search** | Websuche über Tavily oder Serper | API-Key konfiguriert |
| **Brave Search** | Websuche über Brave Search API | API-Key konfiguriert |

### Bildgenerierung

| Tool | Beschreibung |
|------|-------------|
| **Image Generation** | Bild aus Textbeschreibung generieren |
| **Image Edit** | Bestehendes Bild bearbeiten/transformieren |

### Knowledge Base

| Tool | Beschreibung |
|------|-------------|
| **KB Search** | Knowledge Base durchsuchen (Collections, Dokumente, Index) |
| **KB Index** | Neues Dokument in die Knowledge Base indexieren |
| **KB Manage** | Collections und Dokumente verwalten |

### Tabellen

| Tool | Beschreibung |
|------|-------------|
| **Table List** | Alle verfügbaren Tabellen auflisten |
| **Table Query** | Datensätze aus einer Tabelle abfragen/filtern |
| **Table Add** | Neue Datensätze in eine Tabelle einfügen |
| **Table Update** | Bestehende Datensätze aktualisieren |
| **Table Delete** | Datensätze aus einer Tabelle löschen |

### Spezial-Tools

| Tool | Beschreibung |
|------|-------------|
| **Delegate to Agent** | Teilaufgabe an einen spezialisierten Agenten delegieren |
| **User Memory** | Informationen über den Benutzer speichern und abrufen |
| **Create Task** | Hintergrund-Task in der Warteschlange erstellen |
| **Read Chat Attachment** | Hochgeladene Chat-Anhänge lesen |
| **Export Document** | Inhalte als PDF, Excel oder Word exportieren |
| **Load Skill** | Skills dynamisch während der Agenten-Ausführung laden |

### Status

Jedes Tool zeigt einen Status:

- **Verfügbar** -- Tool ist einsatzbereit
- **Nicht konfiguriert** -- Fehlende Voraussetzung (z. B. API-Key). Der benötigte Konfigurationshinweis wird auf der Karte angezeigt.

---

## Eigene API-Tools

Sie können eigene Tools erstellen, die externe APIs aufrufen. Agenten können diese Tools dann wie System-Tools verwenden.

### Tool erstellen

Klicken Sie auf **Tool erstellen** und füllen Sie das Formular aus:

1. **Grundeinstellungen**
   - **ID** -- Eindeutiger Bezeichner (z. B. `weather-api`)
   - **Name** -- Anzeigename
   - **Beschreibung** -- Beschreibt dem Agenten, wofür das Tool gedacht ist

2. **API-Konfiguration**
   - **Endpoint-URL** -- Die Ziel-URL der API
   - **HTTP-Methode** -- GET, POST, PUT, DELETE oder PATCH

3. **Parameter**
   - Definieren Sie Parameter mit Name, Typ, Position (Query, Path, Header, Body) und ob sie erforderlich sind
   - Parameter werden dem Agenten als Eingabefelder bereitgestellt

4. **Authentifizierung**
   - **Keine** -- Kein Auth-Header
   - **Bearer Token** -- Token aus Umgebungsvariable
   - **API Key** -- Key-Name und Position (Header oder Query)
   - **Basic Auth** -- Benutzername/Passwort aus Umgebungsvariable

5. **Antwortverarbeitung** (optional)
   - Response-Template zur Extraktion bestimmter Felder (z. B. `{{result.value}}`)

### Tool testen

Nach dem Erstellen können Sie ein Tool direkt über den **Testen**-Button ausprobieren. Das Ergebnis zeigt Erfolg/Fehler und die Antwortzeit.

### Tool aktivieren/deaktivieren

Eigene Tools können über den Schalter auf der Tool-Karte aktiviert oder deaktiviert werden, ohne sie zu löschen.

---

## Sicherheit

- **Dateisystem-Tools** sind auf das persönliche Benutzerverzeichnis beschränkt (Sandboxing)
- **Eigene API-Tools** sind durch SSRF-Schutz abgesichert -- interne Netzwerkadressen können nicht aufgerufen werden
- **Authentifizierungsdaten** werden über Umgebungsvariablen referenziert, nicht direkt im Tool gespeichert
