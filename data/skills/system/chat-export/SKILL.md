---
id: chat-export
name: Chat Export
version: "1.0"
description: Exportiert Konversationen und Daten in verschiedene Dokumentformate
triggers:
  keywords: [exportiere, export, speichere als, download als, als pdf, als excel, als word]
  patterns: ["export(iere)? (als|zu|in) (excel|pdf|word|docx|xlsx)", "erstelle (ein|einen|eine)? (bericht|dokument|zusammenfassung)"]
  explicit: true
tools:
  required: [export_document]
---

# Chat Export Skill

Du hilfst dem Benutzer, Inhalte als Dokumente zu exportieren.

## Verfuegbare Formate

- **PDF (.pdf)** - Ideal fuer Berichte, Dokumentation und Archivierung
- **Excel (.xlsx)** - Ideal fuer tabellarische Daten und Analysen
- **Word (.docx)** - Ideal fuer Bearbeitung und Weitergabe

## Workflow

### Schritt 1: Inhalt verstehen

Analysiere die Anfrage des Benutzers:
- Was soll exportiert werden? (Konversation, Recherche-Ergebnisse, Zusammenfassung)
- Welches Format ist gewuenscht?
- Gibt es spezielle Anforderungen an die Struktur?

### Schritt 2: Inhalt strukturieren

Bereite den Inhalt als Sections auf:

1. **text** - Fuer Fliesstext, Erklaerungen, Zusammenfassungen
2. **table** - Fuer tabellarische Daten mit headers und rows
3. **list** - Fuer Aufzaehlungen
4. **keyvalue** - Fuer Metadaten und Schluessel-Wert-Paare

### Schritt 3: Dokument erstellen

Nutze das `export_document` Tool mit:
- **title**: Aussagekraeftiger Titel des Dokuments
- **format**: xlsx, pdf oder docx
- **sections**: Array von strukturierten Inhalten
- **metadata**: Optionale Zusatzinformationen (Autor, Datum, etc.)

## Beispiele

### Einfache Zusammenfassung als PDF

```json
{
  "title": "Zusammenfassung: KI im Unternehmen",
  "format": "pdf",
  "sections": [
    {
      "title": "Ueberblick",
      "type": "text",
      "content": "Diese Zusammenfassung behandelt die wichtigsten Aspekte..."
    },
    {
      "title": "Kernpunkte",
      "type": "list",
      "content": { "items": ["Punkt 1", "Punkt 2", "Punkt 3"] }
    }
  ]
}
```

### Recherche-Ergebnisse als Excel

```json
{
  "title": "Wettbewerbsanalyse 2024",
  "format": "xlsx",
  "sections": [
    {
      "title": "Uebersicht",
      "type": "keyvalue",
      "content": {
        "items": [
          { "key": "Datum", "value": "15.01.2024" },
          { "key": "Analyst", "value": "KI-Assistent" }
        ]
      }
    },
    {
      "title": "Wettbewerber",
      "type": "table",
      "content": {
        "headers": ["Name", "Marktanteil", "Staerken", "Schwaechen"],
        "rows": [
          ["Firma A", "35%", "Innovation", "Preis"],
          ["Firma B", "25%", "Service", "Reichweite"]
        ]
      }
    }
  ]
}
```

## Hinweise

- Waehle das Format passend zum Inhalt (Tabellen -> Excel, Text -> PDF/Word)
- Strukturiere den Inhalt logisch mit klaren Sektionstiteln
- Fuege Metadaten hinzu fuer bessere Nachvollziehbarkeit
- Der Download-Link ist nur kurze Zeit gueltig
