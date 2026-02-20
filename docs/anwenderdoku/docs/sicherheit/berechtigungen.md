# Berechtigungen & RBAC

Der Adacor Workplace verwendet ein rollenbasiertes Zugriffskontrollsystem (Role-Based Access Control, RBAC) auf zwei Ebenen: globale Rollen und ressourcenbasierte Rollen.

---

## Globale Rollen

Jeder Benutzer hat genau eine globale Rolle, die seine grundlegenden Berechtigungen im System bestimmt:

| Rolle | Beschreibung |
|-------|-------------|
| **Admin** | Vollzugriff auf alle Funktionen und Verwaltungsbereiche |
| **User** | Standard-Benutzer mit Zugriff auf Chat, Agenten, Skills und weitere Grundfunktionen |

### Admin-Berechtigungen

Administratoren haben Zugriff auf:

- Benutzerverwaltung (Benutzer anlegen, ändern, löschen)
- Gruppenverwaltung
- Provider-Konfiguration (KI-Modelle)
- Verbindungen (OAuth-Integrationen)
- Audit Log
- App-Konfiguration
- Systemeinstellungen

> [!info] Impliziter Zugriff
> Administratoren haben implizit Zugriff auf alle Ressourcen im System, unabhängig von den ressourcenbasierten Berechtigungen. Sie müssen nicht explizit als Mitglied hinzugefügt werden.

### User-Berechtigungen

Standard-Benutzer haben Zugriff auf:

- Eigene Chats erstellen und verwalten
- Agenten und Skills nutzen
- Wissensbasisdaten einsehen
- Suche verwenden
- Aufgaben erstellen und verwalten
- Bilder generieren
- Eigenes Profil und Modellpräferenzen anpassen

---

## Ressourcenbasierte Rollen

Für bestimmte Ressourcentypen können individuelle Zugriffsrechte vergeben werden. Diese Rollen regeln, wer eine Ressource sehen, bearbeiten oder verwalten darf.

### Geschützte Ressourcentypen

Die folgenden Ressourcentypen unterstützen die feingranulare Zugriffssteuerung:

| Ressource | Beschreibung |
|-----------|-------------|
| **Projekte** | Projekträume mit Aufgaben, Dokumenten und Teammitgliedern |
| **Sammlungen** | Knowledge-Base-Sammlungen mit Dokumenten und Wissenseinträgen |
| **Verträge** | Vertragsdokumente und -daten im Vertragsmanagement |
| **Skills** | Öffentlich geteilte Skills |
| **Agenten** | KI-Agenten mit eigener Konfiguration |

### Rollenhierarchie

Die vier verfügbaren Rollen bilden eine aufsteigende Hierarchie. Jede höhere Rolle umfasst alle Berechtigungen der niedrigeren Rollen:

```
Viewer < Editor < Admin < Owner
```

| Berechtigung | Viewer | Editor | Admin | Owner |
|-------------|--------|--------|-------|-------|
| **Ansehen** | Ja | Ja | Ja | Ja |
| **Bearbeiten** | Nein | Ja | Ja | Ja |
| **Löschen** | Nein | Nein | Nein | Ja |
| **Zugriff verwalten** | Nein | Nein | Ja | Ja |
| **Eigentum übertragen** | Nein | Nein | Nein | Ja |

### Rollenbeschreibungen

**Viewer (Betrachter)**

- Kann die Ressource einsehen und lesen
- Kann keine Änderungen vornehmen

**Editor (Bearbeiter)**

- Alle Rechte eines Viewers
- Kann Inhalte der Ressource bearbeiten und aktualisieren

**Admin (Ressourcen-Administrator)**

- Alle Rechte eines Editors
- Kann anderen Benutzern und Gruppen Zugriff gewähren oder entziehen
- Kann die Rollen anderer Mitglieder ändern (bis einschließlich Admin-Rolle)

**Owner (Eigentümer)**

- Alle Rechte eines Admins
- Kann die Ressource löschen
- Kann das Eigentum an einen anderen Benutzer übertragen
- Jede Ressource hat genau einen Eigentümer

---

## Zugriff verwalten

### Benutzerbasierter Zugriff

Einzelnen Benutzern kann direkt eine Rolle auf einer Ressource zugewiesen werden. Der Ersteller einer Ressource wird automatisch als **Owner** eingetragen.

### Gruppenbasierter Zugriff

Gruppen können ebenfalls Rollen auf Ressourcen erhalten. Alle Mitglieder einer Gruppe erben die der Gruppe zugewiesene Rolle. Dies vereinfacht die Verwaltung bei vielen Benutzern:

- Erstellen Sie eine Gruppe (z.B. "Marketing-Team")
- Fügen Sie die relevanten Benutzer hinzu
- Weisen Sie der Gruppe eine Rolle auf den benötigten Ressourcen zu

> [!info] Effektive Rolle
> Wenn ein Benutzer sowohl eine direkte als auch eine gruppenbasierte Berechtigung auf eine Ressource hat, gilt die jeweils höhere Rolle. Beispiel: Ein Benutzer ist direkt als Viewer eingetragen, seine Gruppe hat aber Editor-Rechte. Der Benutzer hat dann effektiv Editor-Rechte.

### Eigentum übertragen

Der aktuelle Eigentümer einer Ressource kann das Eigentum an einen anderen Benutzer übertragen:

1. Öffnen Sie die Zugriffsverwaltung der Ressource.
2. Wählen Sie **Eigentum übertragen**.
3. Wählen Sie den neuen Eigentümer aus der Benutzerliste.
4. Bestätigen Sie die Übertragung.

> [!warning] Unwiderrufliche Aktion
> Nach der Übertragung verliert der bisherige Eigentümer die Owner-Rolle und erhält stattdessen die Admin-Rolle auf der Ressource. Nur der neue Eigentümer kann das Eigentum erneut übertragen.

---

## Admin-Override

Benutzer mit der globalen Rolle **Admin** haben uneingeschränkten Zugriff auf alle Ressourcen im System. Dies gilt unabhängig davon, ob ihnen explizit eine ressourcenbasierte Rolle zugewiesen wurde:

- Admins können alle Ressourcen einsehen und bearbeiten
- Admins können Zugriffsrechte auf jeder Ressource verwalten
- Admins erscheinen nicht zwingend in der Mitgliederliste einer Ressource

Dieser Mechanismus stellt sicher, dass Administratoren jederzeit eingreifen können, beispielsweise wenn der Eigentümer einer Ressource nicht mehr verfügbar ist.
