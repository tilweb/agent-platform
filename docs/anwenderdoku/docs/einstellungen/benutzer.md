# Benutzerverwaltung

> [!warning] Administratorbereich
> Die Benutzerverwaltung ist nur für Benutzer mit der Rolle **Admin** sichtbar und zugänglich.

Die Benutzerverwaltung ermöglicht Administratoren die vollständige Verwaltung aller Benutzerkonten sowie die Organisation in Gruppen.

---

## Benutzerliste

Die Benutzerliste zeigt alle registrierten Benutzer mit folgenden Informationen:

| Spalte | Beschreibung |
|--------|-------------|
| **Benutzername** | Eindeutiger Anmeldename |
| **E-Mail** | Hinterlegte E-Mail-Adresse |
| **Anzeigename** | Vollständiger Name des Benutzers |
| **Rolle** | Aktuelle Berechtigung (`Admin` oder `User`) |
| **Status** | Aktiv oder deaktiviert |

---

## Benutzer anlegen

So erstellen Sie einen neuen Benutzer:

1. Klicken Sie auf **Benutzer anlegen**.
2. Geben Sie den gewünschten **Benutzernamen** ein.
3. Optional: Füllen Sie **Anzeigename** und **E-Mail** aus.
4. Wählen Sie die **Rolle** (User oder Admin).
5. Bestätigen Sie die Erstellung.

> [!info] Temporäres Passwort
> Bei der Erstellung wird automatisch ein temporäres Passwort generiert. Dieses wird Ihnen einmalig angezeigt. Notieren Sie es und geben Sie es dem neuen Benutzer weiter. Der Benutzer sollte sein Passwort nach der ersten Anmeldung ändern.

---

## Benutzer bearbeiten

### Rolle ändern

Sie können die Rolle eines Benutzers zwischen **User** und **Admin** umschalten:

- **User**: Standardbenutzer mit Zugriff auf Chat, Agenten, Skills und weitere Grundfunktionen.
- **Admin**: Vollzugriff auf alle Verwaltungsfunktionen einschließlich Benutzerverwaltung, Provider-Konfiguration, Verbindungen und Audit Log.

> [!warning] Administratorrechte
> Vergeben Sie die Admin-Rolle nur an vertrauenswürdige Personen. Administratoren haben Zugriff auf alle Systemeinstellungen und können andere Benutzerkonten verwalten.

### Passwort zurücksetzen

Falls ein Benutzer sein Passwort vergessen hat, können Sie es zurücksetzen:

1. Öffnen Sie den Benutzer in der Verwaltung.
2. Klicken Sie auf **Passwort zurücksetzen**.
3. Ein neues temporäres Passwort wird generiert und angezeigt.
4. Geben Sie das neue Passwort an den Benutzer weiter.

### Benutzer aktivieren / deaktivieren

Deaktivierte Benutzer können sich nicht mehr anmelden, ihre Daten bleiben jedoch erhalten:

- **Deaktivieren**: Der Benutzer wird gesperrt und kann sich nicht mehr einloggen. Bestehende Sitzungen werden beendet.
- **Aktivieren**: Der Benutzer kann sich wieder anmelden.

> [!info] Deaktivierung vs. Löschung
> Die Deaktivierung ist der empfohlene Weg, um Benutzern den Zugang zu entziehen, ohne Daten zu verlieren. Verwenden Sie die Löschung nur, wenn das Konto dauerhaft entfernt werden soll.

### Benutzer löschen

Das Löschen eines Benutzers entfernt das Konto dauerhaft. Dieser Vorgang kann nicht rückgängig gemacht werden.

---

## Benutzergruppen

Gruppen ermöglichen die Organisation von Benutzern für die Zugriffsverwaltung. Anstatt einzelnen Benutzern Berechtigungen zu erteilen, können Sie Gruppen anlegen und diesen Gruppen Zugriff auf Ressourcen gewähren.

### Gruppe erstellen

1. Wechseln Sie in den Bereich **Gruppen**.
2. Klicken Sie auf **Neue Gruppe**.
3. Füllen Sie die Felder aus:

| Feld | Beschreibung | Pflicht |
|------|-------------|---------|
| **Name** | Bezeichnung der Gruppe (z.B. "Marketing-Team") | Ja |
| **Beschreibung** | Kurzbeschreibung des Zwecks der Gruppe | Nein |
| **Farbe** | Farbkennung zur visuellen Unterscheidung | Nein |

### Mitglieder verwalten

- **Mitglied hinzufügen**: Wählen Sie aus der Liste der vorhandenen Benutzer, um diese der Gruppe hinzuzufügen.
- **Mitglied entfernen**: Entfernen Sie einen Benutzer aus der Gruppe. Der Benutzer verliert damit alle Berechtigungen, die über die Gruppenzugehörigkeit erteilt wurden.

### Gruppen und Berechtigungen

Gruppen werden im rollenbasierten Zugriffskontrollsystem (RBAC) verwendet. Wenn einer Gruppe eine Berechtigung auf eine Ressource (z.B. ein Projekt oder eine Sammlung) erteilt wird, erhalten alle Mitglieder dieser Gruppe automatisch die entsprechende Berechtigung.

Weitere Informationen zur Nutzung von Gruppen in der Zugriffskontrolle finden Sie unter [Berechtigungen & RBAC](../sicherheit/berechtigungen.md).
