# Chat exportieren

Agent Platform ermöglicht es Ihnen, Konversationen in verschiedenen Dokumentformaten zu exportieren. So können Sie Chat-Ergebnisse archivieren, weiterverarbeiten oder mit Kollegen teilen.

---

## Verfügbare Exportformate

| Format | Dateiendung | Beschreibung |
|--------|-------------|-------------|
| **PDF** | `.pdf` | Formatiertes Dokument, ideal zum Archivieren und Drucken |
| **Word** | `.docx` | Microsoft Word-Dokument, bearbeitbar für die Weiterverarbeitung |
| **Excel** | `.xlsx` | Tabellenformat -- besonders nützlich, wenn die Antwort Tabellendaten enthält |
| **Markdown** | `.md` | Einfaches Textformat mit Formatierung, ideal für technische Dokumentation |

---

## Export durchführen

### Über den Export-Skill

Der einfachste Weg, einen Chat zu exportieren, ist die Nutzung eines Agents mit Export-Fähigkeit. Bitten Sie den Agenten direkt im Chat:

> *"Exportiere diese Konversation als PDF."*

> *"Erstelle ein Word-Dokument aus der letzten Antwort."*

> *"Fasse die Ergebnisse in einer Excel-Tabelle zusammen."*

Der Agent nutzt das integrierte Export-Werkzeug und stellt Ihnen einen Download-Link bereit.

### Über den Slash-Command

Sie können den Export auch über Slash-Commands initiieren:

1. Tippen Sie `/skill` im Eingabefeld
2. Wählen Sie den **Export**-Skill aus der Liste
3. Geben Sie das gewünschte Format und den Umfang an

---

## Exportumfang

Beim Export können Sie festlegen, welcher Teil der Konversation exportiert werden soll:

| Umfang | Beschreibung |
|--------|-------------|
| **Vollständiger Chat** | Alle Nachrichten der gesamten Konversation |
| **Letzte Antwort** | Nur die zuletzt generierte Antwort des Agenten |
| **Nur Materialien** | Nur die angehängten Dateien und deren Inhalte |

---

## Inhaltserhaltung

Der Export bewahrt die Formatierung der Chat-Inhalte so gut wie möglich:

### Textformatierung

- **Überschriften** und Absätze werden übernommen
- **Fettdruck**, *Kursivschrift* und andere Hervorhebungen bleiben erhalten
- Aufzählungen und nummerierte Listen werden korrekt dargestellt

### Code-Blöcke

Programmcode wird in allen Exportformaten als formatierter Code-Block dargestellt -- mit Einrückung und, wo möglich, mit Syntax-Hervorhebung.

### Tabellen

Tabellen aus den Antworten des Agenten werden in allen Formaten strukturiert übernommen. Im Excel-Format werden sie als echte Tabellenblätter exportiert, die sich direkt weiterverarbeiten lassen.

### Bilder

Generierte Bilder und Diagramme werden in PDF- und Word-Exporten eingebettet.

---

## Download

Nach dem Export stellt der Agent einen **Download-Link** bereit. Klicken Sie auf den Link, um die Datei herunterzuladen. Die exportierte Datei wird vorübergehend auf dem Server gespeichert und nach einer gewissen Zeit automatisch gelöscht.

> [!tip] Tipp
> Laden Sie die exportierte Datei zeitnah herunter, da temporäre Exportdateien nach einiger Zeit automatisch bereinigt werden.

> [!info] Strukturierte Daten in Excel
> Wenn die Antwort des Agenten Tabellen enthält, ist der Excel-Export besonders empfehlenswert. Die Tabellendaten werden in separate Tabellenblätter aufgeteilt und können direkt in Excel oder anderen Tabellenkalkulationsprogrammen weiterverarbeitet werden.
