# Benachrichtigungen

Der Adacor Workplace informiert Sie über abgeschlossene Hintergrund-Aufgaben und andere Systemereignisse über ein Benachrichtigungssystem.

---

## Zugang

Die Benachrichtigungen erreichen Sie über das **Glocken-Symbol** in der oberen rechten Ecke der Anwendung. Ein Badge zeigt die Anzahl ungelesener Benachrichtigungen an.

---

## Benachrichtigungstypen

| Typ | Symbol | Beschreibung |
|-----|--------|-------------|
| **Task abgeschlossen** | Grüner Haken | Ein Hintergrund-Task wurde erfolgreich beendet |
| **Task fehlgeschlagen** | Rotes Warnsymbol | Ein Hintergrund-Task ist mit einem Fehler abgebrochen |
| **System** | Blaues Info-Symbol | Allgemeine Systemmeldungen |

---

## Funktionen

### Benachrichtigungen anzeigen

Klicken Sie auf das Glocken-Symbol, um das Benachrichtigungs-Dropdown zu öffnen. Jede Benachrichtigung zeigt:

- **Titel** -- Kurzbeschreibung des Ereignisses
- **Nachricht** -- Zusätzliche Details
- **Zeitstempel** -- Wann das Ereignis aufgetreten ist (z. B. "gerade eben", "vor 5 Min.", "gestern")
- **Ungelesen-Markierung** -- Blauer Punkt bei noch nicht gelesenen Einträgen

### Als gelesen markieren

- Klicken Sie auf eine Benachrichtigung, um sie als gelesen zu markieren
- Nutzen Sie den Button **Alle gelesen** im Dropdown-Header, um alle auf einmal zu markieren

### Echtzeit-Updates

Benachrichtigungen werden in Echtzeit über Server-Sent Events (SSE) zugestellt. Sie müssen die Seite nicht neu laden, um neue Meldungen zu sehen.

---

## Tipps

> [!tip] Hintergrund-Tasks beobachten
> Wenn Sie einen länger laufenden Task über `/task` starten, erhalten Sie eine Benachrichtigung, sobald dieser abgeschlossen ist -- auch wenn Sie sich in einem anderen Bereich der Plattform befinden.
