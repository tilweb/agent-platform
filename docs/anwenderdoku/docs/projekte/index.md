# Projekte (Spaces)

Projekte -- auch Spaces genannt -- sind abgegrenzte Arbeitsbereiche für die Zusammenarbeit im Team. In einem Projekt bündeln Sie Chats, Wissen und Kontext rund um ein gemeinsames Thema oder Vorhaben. So bleibt alles an einem Ort und alle Teammitglieder arbeiten mit demselben Informationsstand.

## Was sind Spaces?

Ein Space ist ein projektbezogener Arbeitsbereich mit:

- **Eigenem Chat-Verlauf** -- Alle Gespräche im Projekt sind getrennt von Ihren persönlichen Chats
- **Eigenem Speicher** -- Projektspezifische Informationen, Anweisungen und Kontexte
- **Verlinkten Wissens-Collections** -- Knowledge-Base-Collections, die dem Projekt zugeordnet sind
- **Mitgliederverwaltung** -- Rollenbasierter Zugriff für Teammitglieder

> [!info] Persönlich vs. Projekt
> Ihre persönlichen Chats und Ihr persönlicher Speicher bleiben von Projekten getrennt. In einem Projekt-Chat werden automatisch sowohl Ihre persönlichen Informationen als auch die Projektinformationen an den Agenten übergeben.

## Projekt erstellen

1. Navigieren Sie zu **Projekte** im Hauptmenü
2. Klicken Sie auf **Neues Projekt**
3. Geben Sie einen **Namen** ein (max. 100 Zeichen)
4. Optional: Fügen Sie eine **Beschreibung** hinzu (max. 1.000 Zeichen)
5. Klicken Sie auf **Erstellen**

Sie werden automatisch als **Owner** (Eigentümer) des Projekts eingetragen.

> [!tip] Aussagekräftige Namen
> Wählen Sie einen kurzen, prägnanten Projektnamen, der sofort erkennen lässt, worum es geht -- z.B. "Cloud-Migration 2026" oder "Website-Relaunch".

## Mitglieder verwalten

Projekte unterstützen die Zusammenarbeit mehrerer Benutzer. Jedes Mitglied erhält eine Rolle, die bestimmt, welche Aktionen es ausführen darf.

### Rollen

| Rolle | Chats lesen | Chats erstellen | Speicher bearbeiten | Mitglieder verwalten | Projekt löschen |
|---|:---:|:---:|:---:|:---:|:---:|
| **Owner** | Ja | Ja | Ja | Ja | Ja |
| **Admin** | Ja | Ja | Ja | Ja | Nein |
| **Editor** | Ja | Ja | Ja | Nein | Nein |
| **Viewer** | Ja | Nein | Nein | Nein | Nein |

### Mitglieder hinzufügen

1. Öffnen Sie das Projekt
2. Navigieren Sie zum Tab **Mitglieder**
3. Klicken Sie auf **Mitglied hinzufügen**
4. Wählen Sie den Benutzer und die gewünschte Rolle (Admin, Editor oder Viewer)
5. Bestätigen Sie die Auswahl

### Rolle ändern

Owner und Admins können die Rollen anderer Mitglieder ändern. Klicken Sie dazu auf die aktuelle Rolle neben dem Benutzernamen und wählen Sie eine neue Rolle aus.

### Mitglieder entfernen

Owner und Admins können Mitglieder aus dem Projekt entfernen. Klicken Sie auf das Entfernen-Symbol neben dem jeweiligen Mitglied.

## Projekt-Tabs

Innerhalb eines Projekts stehen vier Hauptbereiche zur Verfügung:

### Übersicht

Die Übersichtsseite zeigt die wichtigsten Informationen zum Projekt auf einen Blick:

- Projektname und Beschreibung
- Anzahl der Mitglieder
- Letzte Aktivität
- Verknüpfte Collections

### Chats

Der Chat-Bereich enthält alle Gespräche, die im Kontext dieses Projekts geführt wurden. Projekt-Chats sind von Ihren persönlichen Chats getrennt.

- **Neuen Chat starten** -- Beginnt ein neues Gespräch im Projektkontext
- **Chat öffnen** -- Zeigt einen bestehenden Chat an
- **Chat löschen** -- Entfernt einen Chat aus dem Projekt

In einem Projekt-Chat erhält der Agent automatisch:

- Ihren persönlichen Speicher (Über mich, Anweisungen, aktiver Kontext)
- Den Projekt-Speicher (projektspezifische Informationen und Anweisungen)
- Zugriff auf verknüpfte Knowledge-Base-Collections

### Speicher

Der Projekt-Speicher funktioniert identisch zum [persönlichen Speicher](../wissensbasisis/speicher.md), ist jedoch projektbezogen. Er hat die gleichen drei Bereiche:

- **Über das Projekt (About)** -- Fakten, Hintergrund und Ziele des Projekts
- **Anweisungen (Instructions)** -- Projektspezifische Regeln und Richtlinien
- **Kontext (Context)** -- Aktuelle Arbeitsschwerpunkte und Aufgaben im Projekt

> [!example] Beispiele für Projekt-Speicher
> - **About:** "Dieses Projekt migriert die On-Premise-Infrastruktur zu AWS bis Q3 2026"
> - **Anweisung [HOCH]:** "Alle Architekturentscheidungen müssen die bestehende Oracle-Datenbank berücksichtigen"
> - **Kontext [Aktiv]:** "Sprint 12 -- Fokus auf Migration der Authentifizierungskomponente"

### Wissen

Im Wissen-Tab können Sie Knowledge-Base-Collections mit dem Projekt verknüpfen. Verknüpfte Collections stehen dem Agenten in Projekt-Chats automatisch als Wissensquelle zur Verfügung.

## Wissens-Collections verknüpfen

1. Öffnen Sie das Projekt und navigieren Sie zum Tab **Wissen**
2. Klicken Sie auf **Collection verknüpfen**
3. Wählen Sie eine bestehende Collection aus der Knowledge Base
4. Die Collection ist nun mit dem Projekt verbunden

Um eine Verknüpfung zu lösen, klicken Sie auf das Entfernen-Symbol neben der Collection.

> [!tip] Projektspezifisches Wissen
> Erstellen Sie für jedes Projekt eigene Collections mit den relevanten Dokumenten (z.B. Projektcharter, Anforderungsdokumente, Architekturdiagramme) und verknüpfen Sie diese mit dem Projekt.

## Projekt archivieren und wiederherstellen

Abgeschlossene oder pausierte Projekte können archiviert werden, anstatt sie zu löschen. Archivierte Projekte:

- Sind in der Standard-Projektliste ausgeblendet
- Können jederzeit wiederhergestellt werden
- Behalten alle Daten (Chats, Speicher, Verknüpfungen)

### Archivieren

1. Öffnen Sie das Projekt
2. Klicken Sie auf **Archivieren**
3. Bestätigen Sie die Aktion

### Wiederherstellen

1. Aktivieren Sie in der Projektliste die Option **Archivierte Projekte anzeigen**
2. Öffnen Sie das archivierte Projekt
3. Klicken Sie auf **Wiederherstellen**

> [!info] Archivieren vs. Löschen
> **Archivieren** blendet das Projekt aus, behält aber alle Daten. **Löschen** entfernt das Projekt und alle zugehörigen Daten unwiderruflich. Nutzen Sie Archivieren, wenn Sie das Projekt später möglicherweise wieder benötigen.
