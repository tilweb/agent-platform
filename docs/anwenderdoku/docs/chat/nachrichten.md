# Nachrichten & Konversationen

Der Chat ist der zentrale Arbeitsbereich im Adacor Workplace. Hier kommunizieren Sie mit KI-Agenten, stellen Fragen, lassen Texte erstellen und lösen komplexe Aufgaben.

---

## Neuen Chat starten

Es gibt mehrere Wege, eine neue Konversation zu beginnen:

- Klicken Sie auf den Button **Neuer Chat** oberhalb der Chat-Liste in der Seitenleiste
- Verwenden Sie den Slash-Command `/new` im Eingabefeld
- Klicken Sie auf das **+**-Symbol neben dem Chat-Titel

Jeder neue Chat beginnt mit einer leeren Konversation. Der Titel wird automatisch anhand Ihrer ersten Nachricht generiert.

---

## Agent wählen

Vor oder während einer Konversation können Sie den aktiven Agenten wechseln. Die Agent-Auswahl befindet sich über dem Eingabefeld.

### Auto-Routing

Im Modus **Auto-Routing** analysiert die Plattform Ihre Nachricht und leitet sie automatisch an den am besten geeigneten Agenten weiter. Dies ist die Standardeinstellung und eignet sich für die meisten Anwendungsfälle.

> [!tip] Empfehlung
> Nutzen Sie Auto-Routing, wenn Sie nicht sicher sind, welcher Agent der richtige ist. Die Plattform erkennt anhand Ihrer Frage, ob z. B. ein Recherche-Agent, ein Code-Experte oder ein allgemeiner Assistent am besten geeignet ist.

### Manuell wählen

Wenn Sie einen bestimmten Agenten bevorzugen, können Sie diesen gezielt auswählen:

- Klicken Sie auf die **Agent-Auswahl** über dem Eingabefeld
- Oder verwenden Sie den Slash-Command `/agent` und wählen Sie aus der Liste

### Modell-Override pro Chat

Sie können das KI-Modell für eine einzelne Konversation überschreiben, ohne Ihre globalen Einstellungen zu ändern:

1. Verwenden Sie den Slash-Command `/model`
2. Wählen Sie das gewünschte Modell aus der Liste der verfügbaren Anbieter und Modelle

> [!info] Modell-Override
> Der Modell-Override gilt nur für die aktuelle Konversation. Alle anderen Chats verwenden weiterhin Ihr in den Einstellungen gewähltes Standard-Modell.

---

## Nachrichten senden

Geben Sie Ihre Nachricht in das Eingabefeld am unteren Rand des Chat-Bereichs ein und bestätigen Sie mit der **Enter-Taste** oder dem **Senden-Button**.

Sie können:

- **Mehrzeilige Nachrichten** verfassen (mit `Shift+Enter` für neue Zeilen)
- **Dateien anhangen** (siehe [Dateien & Materialien](materialien.md))
- **Slash-Commands** verwenden (siehe Abschnitt unten)

---

## Streaming-Antworten

Der Adacor Workplace zeigt die Antworten der KI in Echtzeit an (Streaming). Während der Agent arbeitet, sehen Sie verschiedene Status-Indikatoren:

| Status | Beschreibung |
|--------|-------------|
| **Denkt...** | Der Agent verarbeitet Ihre Anfrage und formuliert eine Antwort |
| **Tool-Nutzung** | Der Agent verwendet ein Werkzeug (z. B. Websuche, Dateianalyse, Wissensabfrage) -- der Name des Tools wird angezeigt |
| **Delegation** | Der Agent leitet die Aufgabe an einen spezialisierten Agenten weiter |

> [!info] Abbrechen
> Sie können eine laufende Antwort jederzeit abbrechen, indem Sie auf den **Stopp-Button** klicken, der während des Streamings angezeigt wird.

---

## Chat-Verlauf

Alle Ihre Konversationen werden automatisch gespeichert und sind über die Seitenleiste erreichbar.

### Suche

Nutzen Sie das Suchfeld oberhalb der Chat-Liste, um Konversationen nach Titel oder Inhalt zu durchsuchen.

### Ordner

Sie können Chats in Ordnern organisieren, um den Überblick zu behalten:

1. Erstellen Sie einen neuen Ordner über die Chat-Liste
2. Verschieben Sie Chats per Drag & Drop oder über das Kontextmenü in Ordner

### Löschen

Konversationen können über das Kontextmenü (Rechtsklick oder Drei-Punkte-Menü) gelöscht werden.

> [!warning] Achtung
> Gelöschte Chats können nicht wiederhergestellt werden. Exportieren Sie wichtige Konversationen vor dem Löschen (siehe [Chat exportieren](export.md)).

---

## Chat teilen

Sie können eine Konversation über einen öffentlichen Link teilen:

1. Öffnen Sie den Chat, den Sie teilen möchten
2. Klicken Sie auf das **Teilen-Symbol** in der Kopfzeile des Chats
3. Es wird ein eindeutiger Link generiert

> [!info] Öffentliche Links
> Geteilte Chats können von jedem gelesen werden, der den Link kennt -- auch ohne Anmeldung. Teilen Sie Links daher nur mit Bedacht und nicht für vertrauliche Inhalte.

---

## Slash-Commands

Tippen Sie `/` in das Eingabefeld, um eine Liste aller verfügbaren Befehle zu öffnen. Die wichtigsten Commands sind:

| Command | Beschreibung |
|---------|-------------|
| `/agent` | Agent wechseln -- wählen Sie aus der Liste oder aktivieren Sie Auto-Routing |
| `/skill` | Skill starten -- wählen Sie einen Skill und geben Sie die nötigen Eingaben an |
| `/model` | KI-Modell für diesen Chat wechseln |
| `/task` | Hintergrund-Task starten -- beschreiben Sie die Aufgabe, die im Hintergrund ausgeführt werden soll |
| `/table` | Tabellen anzeigen oder durchsuchen |
| `/image` | Bild generieren -- geben Sie eine Beschreibung ein |
| `/new` | Neue Konversation starten |
| `/clear` | Aktuellen Chat leeren |
| `/help` | Hilfe anzeigen |

> [!tip] Tipp: Schnellauswahl
> Nach Eingabe eines Commands (z. B. `/agent`) wird eine Auswahlliste angezeigt. Sie können die Liste mit den Pfeiltasten durchnavigieren und mit `Enter` bestätigen.
