# Registrierung & Login

## Ersteinrichtung

Wenn der Adacor Workplace zum ersten Mal gestartet wird, existiert noch kein Benutzerkonto. Der **erste Benutzer**, der sich registriert, erhält automatisch die Rolle **Administrator**. Alle weiteren Benutzer werden mit der Rolle **Benutzer** angelegt.

> [!info] Administrator-Rechte
> Der Administrator kann weitere Benutzer verwalten, KI-Modelle konfigurieren, Verbindungen einrichten und auf das Audit-Log zugreifen. Weitere Informationen finden Sie unter [Benutzerverwaltung](../einstellungen/benutzer.md).

---

## Registrierung

Öffnen Sie die Plattform in Ihrem Browser. Auf der Anmeldeseite finden Sie die Option zur Registrierung.

### Benutzername

Der Benutzername muss folgende Regeln erfüllen:

| Regel | Beschreibung |
|-------|-------------|
| Mindestlänge | 3 Zeichen |
| Maximallänge | 32 Zeichen |
| Erlaubte Zeichen | Buchstaben (a-z, A-Z), Ziffern (0-9), Unterstriche (`_`) und Bindestriche (`-`) |

> [!warning] Hinweis
> Der Benutzername kann nach der Registrierung nicht mehr geändert werden. Wählen Sie ihn daher sorgfältig.

### Passwort

Das Passwort muss folgende Anforderungen erfüllen:

- **Mindestens 8 Zeichen** lang (maximal 128 Zeichen)
- Mindestens **ein Großbuchstabe** (A-Z)
- Mindestens **ein Kleinbuchstabe** (a-z)
- Mindestens **eine Zahl** (0-9)
- Darf **kein gängiges Passwort** sein (z. B. `password123`, `admin`, `qwerty`)

> [!tip] Tipp
> Verwenden Sie ein Passwort, das sowohl sicher als auch für Sie leicht zu merken ist. Eine Kombination aus mehreren Wörtern mit Zahlen und Großbuchstaben bietet guten Schutz.

### Optionale Angaben

- **Anzeigename** -- Wird in der Oberfläche anstelle des Benutzernamens angezeigt
- **E-Mail-Adresse** -- Für Benachrichtigungen und Kontowiederherstellung

---

## Login

Nach der Registrierung können Sie sich jederzeit mit Ihrem Benutzernamen und Passwort anmelden.

1. Öffnen Sie die Plattform in Ihrem Browser
2. Geben Sie Ihren **Benutzernamen** ein
3. Geben Sie Ihr **Passwort** ein
4. Klicken Sie auf **Anmelden**

Bei erfolgreicher Anmeldung werden Sie direkt zum Chat weitergeleitet.

> [!warning] Fehlgeschlagene Anmeldeversuche
> Aus Sicherheitsgründen wird die Anmeldung nach mehreren fehlgeschlagenen Versuchen vorübergehend gesperrt (Rate-Limiting). Warten Sie in diesem Fall einige Minuten, bevor Sie es erneut versuchen.

---

## Sitzungsverwaltung

Nach dem Login wird eine Sitzung (Session) angelegt, die Sie über einen längeren Zeitraum angemeldet hält.

### Sitzungsdauer

| Einstellung | Wert |
|-------------|------|
| Inaktivitäts-Timeout | **3 Tage** |
| Maximale Sitzungsdauer | **30 Tage** |

Die Sitzung arbeitet mit einem **Sliding-Window-Verfahren**: Bei jeder Aktion in der Plattform wird das Inaktivitäts-Timeout von 3 Tagen zurückgesetzt. Selbst bei regelmäßiger Nutzung müssen Sie sich spätestens nach 30 Tagen neu anmelden.

> [!info] Automatische Verlängerung
> Sie müssen sich nicht manuell um Ihre Sitzung kümmern. Solange Sie die Plattform innerhalb von 3 Tagen mindestens einmal nutzen, bleiben Sie angemeldet.

### Mehrere Geräte

Sie können sich gleichzeitig auf mehreren Geräten anmelden. Jedes Gerät erhält eine eigene Sitzung.

---

## Abmelden

Um sich von der Plattform abzumelden:

1. Klicken Sie auf Ihr **Benutzerprofil** unten links in der Seitenleiste
2. Wählen Sie **Abmelden**

Die aktuelle Sitzung wird beendet. Um die Plattform weiter zu nutzen, müssen Sie sich erneut anmelden.

> [!tip] Tipp
> Melden Sie sich auf gemeinsam genutzten Geräten immer ab, um unbefugten Zugriff auf Ihr Konto zu verhindern.
