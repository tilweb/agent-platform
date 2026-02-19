# Suche

Die Suchfunktion der Agent Platform bietet eine zentrale, quellenübergreifende Suche. Mit einer einzigen Anfrage durchsuchen Sie gleichzeitig Ihre Chats, die Knowledge Base und -- sofern verbunden -- auch externe Quellen wie Confluence und Google Drive.

## So funktioniert die Suche

1. Öffnen Sie die **Suche** über das Hauptmenü
2. Geben Sie Ihren Suchbegriff ein (mindestens 2 Zeichen)
3. Die Suche startet automatisch und durchsucht alle verfügbaren Quellen gleichzeitig
4. Die Ergebnisse werden nach Quelle gruppiert in Tabs angezeigt

> [!info] Mindestlänge
> Die Suchanfrage muss mindestens **2 Zeichen** lang sein, damit die Suche gestartet wird.

## Suchquellen

Die Suche durchsucht bis zu fünf verschiedene Quellen. Welche Quellen verfügbar sind, hängt von Ihren Verbindungen und Konfigurationen ab.

| Quelle | Immer verfügbar | Beschreibung |
|---|:---:|---|
| **Chats** | Ja | Durchsucht Ihren gesamten Chat-Verlauf nach Nachrichten und Themen |
| **Knowledge Base** | Ja | Durchsucht alle indexierten Dokumente in Ihren Collections |
| **Confluence** | Nein | Durchsucht Confluence-Seiten (erfordert aktive Confluence-Verbindung) |
| **Google Drive** | Nein | Durchsucht Google Drive-Dateien (erfordert aktive Google Drive-Verbindung) |

> [!tip] Externe Quellen verbinden
> Confluence und Google Drive können unter **Einstellungen > Verbindungen** eingerichtet werden. Nach erfolgreicher Verbindung stehen diese Quellen automatisch in der Suche zur Verfügung.

## Ergebnis-Tabs

Die Suchergebnisse werden in Tabs organisiert -- ein Tab pro Quelle. Jeder Tab zeigt ein **Badge** mit der Anzahl der gefundenen Ergebnisse an.

Sie können zwischen zwei Ansichtsmodi wechseln:

- **Tab-Ansicht** (Standard) -- Zeigt die Ergebnisse einer Quelle pro Tab, übersichtlich und aufgeräumt
- **Listen-Ansicht** -- Zeigt alle Ergebnisse quellenübergreifend in einer einzigen, filterbaren Liste

In der Listen-Ansicht können Sie über Filterchips einzelne Quellen ein- oder ausblenden.

### Ergebnis-Details

Jedes Suchergebnis zeigt:

- **Titel** des gefundenen Elements
- **Textauszug** (Snippet) mit dem relevanten Kontext
- **Quelleninformation** (z.B. Collection-Name, Confluence-Space, Dateityp)
- **Link zum Öffnen** des Originalelements

Ergebnisse, die durch die intelligente Suche (KI-gestütztes Ranking) gefunden wurden, sind mit einem **Smart**-Badge gekennzeichnet.

## Intelligente Suche

Neben der schnellen Stichwortsuche verfügt die Agent Platform über eine **intelligente Suche**. Diese nutzt ein KI-Modell, um:

- **Synonyme** zu erkennen (z.B. "Urlaub" findet auch "Abwesenheit")
- **Kontext** zu verstehen (z.B. "Wie beantrage ich frei?" findet Urlaubsrichtlinien)
- **Mehrsprachige Anfragen** zu unterstützen (z.B. eine englische Suche findet deutsche Dokumente)
- **Ergebnisse intelligent zu ranken** -- die relevantesten Treffer werden nach oben sortiert

Die intelligente Suche läuft automatisch im Hintergrund und ergänzt die schnelle Standardsuche. Während die intelligente Suche lädt, wird ein entsprechender Hinweis angezeigt.

## Chat mit Suchergebnissen starten

Ein besonders nützliches Feature der Suche ist die Möglichkeit, ausgewählte Suchergebnisse als **Kontext für einen neuen Chat** zu verwenden.

### So geht's:

1. Führen Sie eine Suche durch
2. Wählen Sie relevante Ergebnisse aus, indem Sie die Checkboxen anklicken
3. Die ausgewählten Elemente erscheinen im **Auswahl-Panel** auf der rechten Seite
4. Klicken Sie auf **Chat starten**
5. Ein neuer Chat öffnet sich, in dem der Agent die ausgewählten Dokumente und Informationen als Kontext erhält

> [!example] Anwendungsbeispiel
> Sie suchen nach "Projektplanung Q3" und finden relevante Confluence-Seiten und Knowledge-Base-Dokumente. Wählen Sie die wichtigsten Ergebnisse aus und starten Sie einen Chat -- der Agent kann Ihnen dann Fragen basierend auf diesen spezifischen Dokumenten beantworten.

### Weitere Aktionen mit der Auswahl

Neben dem Chat-Start können Sie ausgewählte Ergebnisse auch:

- **Als neue Collection erstellen** -- Erstellt eine neue Knowledge Base Collection mit den ausgewählten Inhalten
- **Zu bestehender Collection hinzufügen** -- Fügt die ausgewählten Inhalte einer vorhandenen Collection hinzu

## Tipps für effektive Suche

> [!tip] Suchtipps
> - **Spezifisch suchen**: Je genauer Ihr Suchbegriff, desto relevanter die Ergebnisse
> - **Verschiedene Begriffe ausprobieren**: Nutzen Sie Synonyme oder verwandte Begriffe
> - **Intelligente Suche nutzen**: Für komplexere Anfragen ist die KI-gestützte Suche besonders hilfreich
> - **Kontext nutzen**: Wählen Sie mehrere relevante Ergebnisse aus und starten Sie einen Chat für tiefergehende Analysen
