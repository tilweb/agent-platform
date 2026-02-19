# Verbindungen

> [!warning] Administratorbereich
> Die Verwaltung von Verbindungen ist nur für Benutzer mit der Rolle **Admin** sichtbar und zugänglich.

Verbindungen ermöglichen die Anbindung externer Dienste über OAuth-Integrationen. Durch verbundene Dienste können Inhalte aus diesen Quellen in der plattformweiten Suche durchsucht und im Chat verwendet werden.

---

## Verfügbare Integrationen

| Dienst | Beschreibung |
|--------|-------------|
| **Confluence** | Zugriff auf Confluence-Seiten und -Räume für die Wissenssuche |
| **Google Drive** | Zugriff auf Dokumente und Dateien in Google Drive |

---

## Verbindung herstellen

Die Anbindung externer Dienste erfolgt über den standardisierten OAuth-2.0-Ablauf:

1. Klicken Sie bei dem gewünschten Dienst auf **Verbinden**.
2. Ein Popup-Fenster öffnet sich mit der Anmeldeseite des externen Dienstes.
3. Melden Sie sich beim externen Dienst an und erteilen Sie die angeforderten Berechtigungen.
4. Nach erfolgreicher Autorisierung schließt sich das Popup automatisch.
5. Der Verbindungsstatus aktualisiert sich in der Übersicht.

> [!info] Popup-Blocker
> Stellen Sie sicher, dass Ihr Browser Popups für die Agent Platform zulässt. Der OAuth-Ablauf öffnet ein separates Fenster für die Authentifizierung beim externen Dienst.

---

## Verbindungsstatus

Der Status jeder Verbindung wird in der Übersicht angezeigt:

| Status | Bedeutung |
|--------|-----------|
| **Verbunden** | Die Verbindung ist aktiv und funktionsfähig |
| **Nicht verbunden** | Noch keine Verbindung hergestellt |
| **Fehler** | Die Verbindung besteht, aber es gibt ein Problem (z.B. abgelaufene Tokens) |

---

## Verbindung trennen

Um eine bestehende Verbindung zu entfernen:

1. Klicken Sie bei der aktiven Verbindung auf **Trennen**.
2. Bestätigen Sie die Aktion.

Beim Trennen werden die gespeicherten OAuth-Tokens dauerhaft entfernt. Um den Dienst erneut zu nutzen, muss die Verbindung komplett neu hergestellt werden.

> [!warning] Auswirkung auf die Suche
> Nach dem Trennen einer Verbindung steht der entsprechende Dienst nicht mehr als Suchquelle zur Verfügung. Suchergebnisse aus diesem Dienst werden nicht mehr angezeigt.

---

## Nutzung in der Suche

Verbundene Dienste erscheinen automatisch als zusätzliche Suchquellen in der übergreifenden Suche. So können Sie beispielsweise:

- Confluence-Seiten direkt aus dem Chat heraus durchsuchen
- Google-Drive-Dokumente als Wissensquelle nutzen
- Ergebnisse aus externen Diensten in Konversationen einbeziehen

Die verfügbaren Suchquellen werden in der Suche als Filter angezeigt, sodass Sie gezielt in bestimmten Diensten suchen können.

---

## Sicherheit

> [!info] Verschlüsselte Token-Speicherung
> Alle OAuth-Tokens werden verschlüsselt gespeichert. Die Verschlüsselung basiert auf einem serverseitigen Schlüssel (`CONNECTION_ENCRYPTION_KEY`), der in den Umgebungsvariablen konfiguriert wird. Ohne diesen Schlüssel können keine Verbindungen hergestellt werden.
