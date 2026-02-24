# Tabellen

Die Tabellen-Funktion des KI-Workplace ermöglicht es, strukturierte Daten zentral zu speichern, zu verwalten und für KI-Agenten zugänglich zu machen. Im Gegensatz zur Knowledge Base, die unstrukturierte Dokumente verwaltet, arbeiten Tabellen mit klar definierten Spalten, Datentypen und Beziehungen -- ähnlich einer Datenbank oder einem Spreadsheet.

## Was sind Tabellen?

Tabellen im KI-Workplace sind strukturierte Datenspeicher, die:

- **Benutzerdefinierte Spalten** mit verschiedenen Datentypen unterstützen
- **Von KI-Agenten gelesen und bearbeitet** werden können
- **Ansichten (Views)** für gefilterte und sortierte Darstellungen bieten
- **Import und Export** von Daten im CSV- und JSON-Format ermöglichen
- **Beziehungen** zwischen verschiedenen Tabellen herstellen können

> [!example] Anwendungsbeispiele
>
> - **Kundenliste** -- Name, E-Mail, Unternehmen, Status
> - **Projektaufgaben** -- Titel, Beschreibung, Priorität, Fälligkeitsdatum, Zuständiger
> - **Inventar** -- Artikelname, Menge, Standort, Letzte Prüfung
> - **Kontaktverzeichnis** -- Name, Abteilung, Telefon, E-Mail

## Tabelle erstellen

1. Navigieren Sie zu **Tabellen** im Hauptmenü
2. Klicken Sie auf **Neue Tabelle**
3. Vergeben Sie eine **ID** (eindeutiger Bezeichner) und einen **Namen**
4. Optional: Fügen Sie eine **Beschreibung** hinzu
5. Definieren Sie mindestens eine **Spalte** (siehe Spaltentypen)
6. Klicken Sie auf **Erstellen**

> [!tip] Vorlagen verwenden
> Der KI-Workplace stellt vordefinierte Tabellenvorlagen bereit. Klicken Sie auf **Vorlage verwenden**, um eine passende Struktur als Ausgangspunkt zu wählen.

## Spaltentypen

Beim Erstellen einer Tabelle definieren Sie für jede Spalte einen Datentyp. Folgende Typen stehen zur Verfügung:

| Spaltentyp                     | Beschreibung                               | Beispiel                                     |
| ------------------------------ | ------------------------------------------ | -------------------------------------------- |
| **Text**                       | Einzeiliger Kurztext                       | Name, Titel                                  |
| **Text (lang)**                | Mehrzeiliger Langtext                      | Beschreibung, Notizen                        |
| **Zahl (number)**              | Ganzzahl oder Dezimalzahl                  | Menge, Preis, Bewertung                      |
| **Datum (date)**               | Nur Datum                                  | Geburtstag, Fälligkeitsdatum                 |
| **Datum & Uhrzeit (datetime)** | Datum mit Uhrzeit                          | Termin, Deadline                             |
| **Ja/Nein (boolean)**          | Wahrheitswert                              | Aktiv, Abgeschlossen                         |
| **E-Mail**                     | Validierte E-Mail-Adresse                  | Kontakt-E-Mail                               |
| **URL**                        | Validierter Link                           | Website, Dokumentenlink                      |
| **Tags**                       | Mehrere Schlagwörter                       | Kategorien, Labels                           |
| **Auswahl (select)**           | Einzelauswahl aus vordefinierten Optionen  | Status, Priorität, Abteilung                 |
| **Beziehung (relation)**       | Verweis auf Zeile in einer anderen Tabelle | Zuständiger Mitarbeiter, Zugehöriges Projekt |

### Spalten-Eigenschaften

Für jede Spalte können folgende Eigenschaften festgelegt werden:

- **Pflichtfeld** -- Die Spalte muss bei jedem Eintrag ausgefüllt werden
- **Standardwert** -- Wird automatisch eingetragen, wenn kein Wert angegeben wird
- **Optionen** -- Bei Auswahl-Spalten: die verfügbaren Auswahlmöglichkeiten
- **Verknüpfte Tabelle** -- Bei Beziehungs-Spalten: die Zieltabelle und Anzeigespalte

## Ansichten (Views)

Ansichten ermöglichen es, die Daten einer Tabelle auf unterschiedliche Weise darzustellen, ohne die zugrundeliegenden Daten zu verändern. Jede Ansicht kann eigene Filter- und Sortierregeln haben.

### Ansicht erstellen

1. Öffnen Sie die gewünschte Tabelle
2. Klicken Sie auf **Neue Ansicht**
3. Vergeben Sie einen **Namen** für die Ansicht
4. Definieren Sie **Filter** (z.B. "Status = Aktiv")
5. Definieren Sie die **Sortierung** (z.B. "Fälligkeitsdatum aufsteigend")
6. Speichern Sie die Ansicht

> [!example] Ansichten-Beispiele
>
> - **"Offene Aufgaben"** -- Filter: Status != Abgeschlossen, Sortierung: Priorität absteigend
> - **"Meine Kontakte"** -- Filter: Zuständiger = Aktueller Benutzer
> - **"Fällig diese Woche"** -- Filter: Fälligkeitsdatum zwischen Heute und +7 Tage

## Daten verwalten

### Zeilen hinzufügen

1. Öffnen Sie die Tabelle
2. Klicken Sie auf **Neue Zeile** oder das Plus-Symbol
3. Füllen Sie die Felder aus
4. Speichern Sie den Eintrag

### Zeilen bearbeiten

Klicken Sie auf eine Zeile, um die Bearbeitungsansicht zu öffnen. Ändern Sie die gewünschten Felder und speichern Sie.

### Zeilen löschen

Wählen Sie eine oder mehrere Zeilen aus und klicken Sie auf **Löschen**. Bei Tabellen mit Beziehungen zu anderen Tabellen werden Sie gewarnt, wenn eingehende Verweise existieren.

> [!info] Kaskadierende Löschung
> Beim Löschen einer Zeile, auf die andere Tabellen verweisen, können Sie wählen:
>
> - **Verweise leeren** -- Die Verweise in anderen Tabellen werden auf leer gesetzt
> - **Kaskadiert löschen** -- Die verweisenden Zeilen werden ebenfalls gelöscht

## Import und Export

### Daten exportieren

1. Öffnen Sie die Tabelle
2. Klicken Sie auf **Exportieren**
3. Wählen Sie das Format:
   - **CSV** -- Kommagetrennte Werte, kompatibel mit Excel
   - **JSON** -- Strukturiertes Datenformat

Der Export wird als Datei heruntergeladen.

### Daten importieren

1. Öffnen Sie die Tabelle
2. Klicken Sie auf **Importieren**
3. Wählen Sie eine **CSV**- oder **JSON**-Datei
4. Prüfen Sie die **Import-Vorschau** -- hier sehen Sie, wie die Daten zugeordnet werden
5. Optional: Passen Sie die **Spaltenzuordnung** an (welche Spalte in der Datei welcher Tabellenspalte entspricht)
6. Wählen Sie, ob bestehende Einträge aktualisiert oder nur neue hinzugefügt werden sollen
7. Starten Sie den Import

> [!tip] Import-Optionen
>
> - **Bestehende aktualisieren** -- Wenn ein Eintrag mit gleicher ID bereits existiert, wird er überschrieben
> - **Ungültige überspringen** -- Zeilen, die nicht validiert werden können, werden übersprungen statt den Import abzubrechen

### Backup

Für jede Tabelle können Sie ein vollständiges Backup erstellen, das sowohl die Tabellenstruktur (Schema) als auch alle Daten enthält. Backups können später wieder importiert werden, um eine Tabelle wiederherzustellen.

## Tabellen im Chat

KI-Agenten können über spezielle Werkzeuge (Tools) auf Tabellen zugreifen. Das bedeutet:

- **Daten abfragen** -- Der Agent kann Tabelleninhalte lesen, filtern und zusammenfassen
- **Daten ändern** -- Der Agent kann neue Zeilen hinzufügen, bestehende aktualisieren oder löschen
- **Analysen erstellen** -- Der Agent kann Daten aus Tabellen analysieren und Berichte generieren

> [!example] Beispiel-Interaktion
> **Sie:** "Wie viele offene Aufgaben gibt es im Projekt Alpha?"
>
> **Agent:** _Fragt die Aufgaben-Tabelle ab, filtert nach Projekt = Alpha und Status != Abgeschlossen_
>
> "Im Projekt Alpha gibt es aktuell 12 offene Aufgaben: 3 mit hoher Priorität, 7 mit normaler Priorität und 2 mit niedriger Priorität."

Um Tabelleninhalte in einem Chat zu nutzen, erwähnen Sie einfach die relevante Tabelle oder die gewünschten Daten in Ihrer Nachricht. Der Agent erkennt automatisch, wenn ein Tabellenzugriff notwendig ist, und nutzt die entsprechenden Werkzeuge.

## Beziehungen zwischen Tabellen

Tabellen können über **Beziehungs-Spalten** (Relation) miteinander verknüpft werden. So lassen sich komplexere Datenstrukturen abbilden.

**Beispiel:** Eine Tabelle "Aufgaben" hat eine Beziehungs-Spalte "Zuständiger", die auf die Tabelle "Mitarbeiter" verweist. In jeder Aufgabe wird so der zuständige Mitarbeiter referenziert, ohne dessen Daten duplizieren zu müssen.

Beziehungen bieten:

- **Referenzielle Integrität** -- Verweise auf nicht-existente Einträge werden verhindert
- **Auflösung** -- Beim Abfragen können Beziehungen automatisch aufgelöst werden, sodass statt einer ID der tatsächliche Wert (z.B. Name) angezeigt wird
- **Bidirektionale Navigation** -- Sowohl ausgehende als auch eingehende Beziehungen können eingesehen werden
