# Spaces

Spaces sind abgegrenzte Arbeitsbereiche für die Zusammenarbeit im Team. In einem Space bündeln Sie Chats, Wissen und Kontext rund um ein gemeinsames Thema oder Vorhaben. So bleibt alles an einem Ort und alle Teammitglieder arbeiten mit demselben Informationsstand.

## Was sind Spaces?

Ein Space ist ein projektbezogener Arbeitsbereich mit:

- **Eigenem Chat-Verlauf** -- Alle Gespräche im Space sind getrennt von Ihren persönlichen Chats
- **Eigenem Speicher** -- Space-spezifische Informationen, Anweisungen und Kontexte
- **Verlinkten Wissens-Collections** -- Knowledge-Base-Collections, die dem Space zugeordnet sind
- **Mitgliederverwaltung** -- Rollenbasierter Zugriff für Teammitglieder

> [!info] Persönlich vs. Space
> Ihre persönlichen Chats und Ihr persönlicher Speicher bleiben von Spaces getrennt. In einem Space-Chat werden automatisch sowohl Ihre persönlichen Informationen als auch die Space-Informationen an den Agenten übergeben.

## Space erstellen

1. Navigieren Sie zu **Spaces** im Hauptmenü
2. Klicken Sie auf **Neuer Space**
3. Geben Sie einen **Namen** ein (max. 100 Zeichen)
4. Optional: Fügen Sie eine **Beschreibung** hinzu (max. 1.000 Zeichen)
5. Klicken Sie auf **Erstellen**

Sie werden automatisch als **Owner** (Eigentümer) des Spaces eingetragen.

> [!tip] Aussagekräftige Namen
> Wählen Sie einen kurzen, prägnanten Namen, der sofort erkennen lässt, worum es geht -- z.B. "Cloud-Migration 2026" oder "Website-Relaunch".

## Mitglieder verwalten

Spaces unterstützen die Zusammenarbeit mehrerer Benutzer. Jedes Mitglied erhält eine Rolle, die bestimmt, welche Aktionen es ausführen darf.

### Rollen

| Rolle | Chats lesen | Chats erstellen | Speicher bearbeiten | Mitglieder verwalten | Space löschen |
|---|:---:|:---:|:---:|:---:|:---:|
| **Owner** | Ja | Ja | Ja | Ja | Ja |
| **Admin** | Ja | Ja | Ja | Ja | Nein |
| **Editor** | Ja | Ja | Ja | Nein | Nein |
| **Viewer** | Ja | Nein | Nein | Nein | Nein |

### Mitglieder hinzufügen

1. Öffnen Sie den Space
2. Navigieren Sie zum Tab **Mitglieder**
3. Klicken Sie auf **Mitglied hinzufügen**
4. Wählen Sie den Benutzer und die gewünschte Rolle (Admin, Editor oder Viewer)
5. Bestätigen Sie die Auswahl

### Rolle ändern

Owner und Admins können die Rollen anderer Mitglieder ändern. Klicken Sie dazu auf die aktuelle Rolle neben dem Benutzernamen und wählen Sie eine neue Rolle aus.

### Mitglieder entfernen

Owner und Admins können Mitglieder aus dem Space entfernen. Klicken Sie auf das Entfernen-Symbol neben dem jeweiligen Mitglied.

## Space-Tabs

Innerhalb eines Spaces stehen vier Hauptbereiche zur Verfügung:

### Übersicht

Die Übersichtsseite zeigt die wichtigsten Informationen zum Space auf einen Blick:

- Name und Beschreibung
- Anzahl der Mitglieder
- Letzte Aktivität
- Verknüpfte Collections

### Chats

Der Chat-Bereich enthält alle Gespräche, die im Kontext dieses Spaces geführt wurden. Space-Chats sind von Ihren persönlichen Chats getrennt.

- **Neuen Chat starten** -- Beginnt ein neues Gespräch im Space-Kontext
- **Chat öffnen** -- Zeigt einen bestehenden Chat an
- **Chat löschen** -- Entfernt einen Chat aus dem Space

In einem Space-Chat erhält der Agent automatisch:

- Ihren persönlichen Speicher (Über mich, Anweisungen, aktiver Kontext)
- Den Space-Speicher (Space-spezifische Informationen und Anweisungen)
- Zugriff auf verknüpfte Knowledge-Base-Collections

### Speicher

Der Space-Speicher funktioniert identisch zum [persönlichen Speicher](../wissensbasis/speicher.md), ist jedoch Space-bezogen. Er hat die gleichen drei Bereiche:

- **Über den Space (About)** -- Fakten, Hintergrund und Ziele
- **Anweisungen (Instructions)** -- Space-spezifische Regeln und Richtlinien
- **Kontext (Context)** -- Aktuelle Arbeitsschwerpunkte und Aufgaben

> [!example] Beispiele für Space-Speicher
> - **About:** "Dieser Space betreut die Migration der On-Premise-Infrastruktur zu AWS bis Q3 2026"
> - **Anweisung [HOCH]:** "Alle Architekturentscheidungen müssen die bestehende Oracle-Datenbank berücksichtigen"
> - **Kontext [Aktiv]:** "Sprint 12 -- Fokus auf Migration der Authentifizierungskomponente"

### Wissen

Im Wissen-Tab können Sie Knowledge-Base-Collections mit dem Space verknüpfen. Verknüpfte Collections stehen dem Agenten in Space-Chats automatisch als Wissensquelle zur Verfügung.

## Wissens-Collections verknüpfen

1. Öffnen Sie den Space und navigieren Sie zum Tab **Wissen**
2. Klicken Sie auf **Collection verknüpfen**
3. Wählen Sie eine bestehende Collection aus der Knowledge Base
4. Die Collection ist nun mit dem Space verbunden

Um eine Verknüpfung zu lösen, klicken Sie auf das Entfernen-Symbol neben der Collection.

> [!tip] Space-spezifisches Wissen
> Erstellen Sie für jeden Space eigene Collections mit den relevanten Dokumenten (z.B. Projektcharter, Anforderungsdokumente, Architekturdiagramme) und verknüpfen Sie diese mit dem Space.

## Space archivieren und wiederherstellen

Abgeschlossene oder pausierte Spaces können archiviert werden, anstatt sie zu löschen. Archivierte Spaces:

- Sind in der Standard-Liste ausgeblendet
- Können jederzeit wiederhergestellt werden
- Behalten alle Daten (Chats, Speicher, Verknüpfungen)

### Archivieren

1. Öffnen Sie den Space
2. Klicken Sie auf **Archivieren**
3. Bestätigen Sie die Aktion

### Wiederherstellen

1. Aktivieren Sie in der Space-Liste die Option **Archivierte Spaces anzeigen**
2. Öffnen Sie den archivierten Space
3. Klicken Sie auf **Wiederherstellen**

> [!info] Archivieren vs. Löschen
> **Archivieren** blendet den Space aus, behält aber alle Daten. **Löschen** entfernt den Space und alle zugehörigen Daten unwiderruflich. Nutzen Sie Archivieren, wenn Sie den Space später möglicherweise wieder benötigen.
