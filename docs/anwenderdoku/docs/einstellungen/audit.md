# Audit Log

> [!warning] Administratorbereich
> Das Audit Log ist nur für Benutzer mit der Rolle **Admin** sichtbar und zugänglich.

Das Audit Log protokolliert alle sicherheitsrelevanten Aktionen innerhalb der Agent Platform. Es dient der Nachvollziehbarkeit, Compliance und der Untersuchung von Sicherheitsvorfällen.

---

## Was wird protokolliert?

Das Audit Log erfasst automatisch alle relevanten Ereignisse in den folgenden Bereichen:

### Authentifizierung

- Erfolgreiche und fehlgeschlagene Anmeldeversuche
- Abmeldungen
- Abgelaufene Sitzungen

### Benutzerverwaltung

- Erstellung neuer Benutzer
- Änderungen an Benutzerkonten
- Löschung von Benutzern
- Passwortzurücksetzungen und -änderungen

### Datenzugriff

- Zugriff auf Chat-Verläufe
- Freigabe und Aufhebung von Chat-Freigaben
- Zugriff auf die Knowledge Base
- Zugriff auf Verbindungen

### Datenänderungen

- Erstellung und Löschung von Chats
- Erstellung und Löschung von Projekten
- Erstellung und Löschung von Tools

### Administratoraktionen

- Änderungen an der Provider-Konfiguration
- Änderungen an Systemeinstellungen
- Erstellung und Löschung von Gruppen
- Änderungen an Berechtigungen

### Sicherheitsereignisse

- Überschreitung von Rate-Limits
- Blockierte CSRF-Angriffe
- Blockierte SSRF-Versuche
- Unautorisierte Zugriffsversuche
- Verdächtige Aktivitäten

---

## Filtermöglichkeiten

Das Audit Log bietet umfangreiche Filteroptionen, um gezielt nach bestimmten Ereignissen zu suchen:

### Zeitraum

Wählen Sie einen Zeitraum (Von-/Bis-Datum), um die angezeigten Einträge einzuschränken. Standardmäßig werden die Einträge der letzten 7 Tage angezeigt.

### Kategorie

Filtern Sie nach der Art des Ereignisses:

| Kategorie | Schlüssel | Beschreibung |
|-----------|-----------|-------------|
| **Authentifizierung** | `auth` | Login, Logout, Sitzungsereignisse |
| **Benutzerverwaltung** | `user_management` | Benutzer erstellen, ändern, löschen |
| **Datenzugriff** | `data_access` | Lesende Zugriffe auf Ressourcen |
| **Datenänderung** | `data_modification` | Erstellung, Änderung und Löschung von Daten |
| **Admin-Aktionen** | `admin_action` | Systemkonfiguration und Verwaltung |
| **Sicherheit** | `security` | Sicherheitsrelevante Ereignisse und Blockierungen |
| **System** | `system` | Systemstart, -stopp und Fehler |

### Aktion

Filtern Sie nach einer spezifischen Aktion innerhalb einer Kategorie, z.B. nur fehlgeschlagene Anmeldungen (`login_failed`) oder nur erstellte Benutzer (`user_created`).

### Benutzer

Filtern Sie nach einem bestimmten Benutzer, um dessen Aktivitäten nachzuverfolgen.

### Erfolgsstatus

Filtern Sie nach erfolgreich oder fehlgeschlagenen Aktionen, um beispielsweise gezielt gescheiterte Anmeldeversuche zu finden.

---

## Protokolldetails

Jeder Audit-Eintrag enthält folgende Informationen:

| Feld | Beschreibung |
|------|-------------|
| **Zeitstempel** | Genauer Zeitpunkt des Ereignisses (ISO 8601) |
| **Kategorie** | Einordnung des Ereignistyps |
| **Aktion** | Spezifische Aktion (z.B. `login_success`, `user_deleted`) |
| **Benutzer** | Benutzer, der die Aktion ausgelöst hat |
| **IP-Adresse** | IP-Adresse der Anfrage |
| **Ressource** | Betroffene Ressource (Typ und ID) |
| **Erfolg** | Ob die Aktion erfolgreich war |
| **Details** | Zusätzliche Informationen je nach Ereignistyp |

---

## Speicherung und Rotation

> [!info] Tägliche Log-Rotation
> Audit-Logs werden in tägliche Dateien aufgeteilt. Jede Datei trägt den Namen `audit_JJJJ-MM-TT.jsonl` (z.B. `audit_2026-02-18.jsonl`). Dieses Format erleichtert die Archivierung und gezielte Suche nach Zeiträumen.

Die Logdateien verwenden das JSON Lines-Format (JSONL), in dem jede Zeile ein vollständiges JSON-Objekt darstellt. Dies ermöglicht eine effiziente Verarbeitung auch großer Logdateien.
