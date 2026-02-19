# Dateien & Materialien

Sie können Dateien an Ihre Chat-Nachrichten anhängen, um dem Agenten zusätzlichen Kontext zu geben. Die Plattform unterstützt Dokumente, Bilder und Audiodateien.

---

## Dateien hochladen

Es gibt zwei Wege, Dateien in den Chat zu bringen:

### Drag & Drop

Ziehen Sie eine oder mehrere Dateien direkt aus Ihrem Dateimanager in den Chat-Bereich. Die Plattform zeigt eine visuelle Ablagezone an, sobald Sie Dateien über das Fenster bewegen.

### Upload-Button

Klicken Sie auf das **Anhang-Symbol** (Büroklammer) neben dem Eingabefeld und wählen Sie die gewünschten Dateien über den Datei-Dialog aus.

---

## Unterstützte Dateitypen

### Dokumente

| Format | Dateiendung | Beschreibung |
|--------|-------------|-------------|
| PDF | `.pdf` | PDF-Dokumente werden in Text konvertiert und dem Agenten bereitgestellt |
| Word | `.docx`, `.doc` | Microsoft Word-Dokumente (alt und neu) |
| Excel | `.xlsx`, `.xls` | Microsoft Excel-Tabellen |
| PowerPoint | `.pptx`, `.ppt` | Microsoft PowerPoint-Präsentationen |
| Text | `.txt`, `.md`, `.html`, `.csv` | Reine Textdateien, Markdown, HTML und CSV |

### Bilder

| Format | Dateiendung | Beschreibung |
|--------|-------------|-------------|
| PNG | `.png` | Portable Network Graphics |
| JPEG | `.jpg`, `.jpeg` | JPEG-Bilder |
| GIF | `.gif` | Animierte und statische GIFs |
| WebP | `.webp` | Modernes Bildformat |
| SVG | `.svg` | Skalierbare Vektorgrafiken |

> [!info] Bildanalyse
> Bilder werden dem Agenten als visuelle Eingabe bereitgestellt (Vision). Der Agent kann Bildinhalte beschreiben, analysieren und Fragen dazu beantworten -- vorausgesetzt, das verwendete KI-Modell unterstützt Vision.

### Audio

| Format | Dateiendung | Beschreibung |
|--------|-------------|-------------|
| WebM | `.webm` | Browser-Audioaufnahmen |
| M4A | `.m4a` | Apple-Audioformat |
| MP3 | `.mp3` | MPEG Audio Layer 3 |
| WAV | `.wav` | Unkomprimiertes Audio |
| OGG | `.ogg` | Ogg Vorbis |
| FLAC | `.flac` | Verlustfreies Audio |

> [!tip] Automatische Transkription
> Audiodateien werden beim Upload automatisch per **Whisper** (Sprache-zu-Text) transkribiert. Der Agent erhält den transkribierten Text und kann damit arbeiten, als hätte er ein schriftliches Dokument erhalten.

---

## Dateigrößen-Limits

| Dateityp | Maximale Größe |
|----------|-----------------|
| Dokumente und Bilder | **50 MB** |
| Audiodateien | **25 MB** |

> [!warning] Größenbeschränkung
> Dateien, die das Limit überschreiten, werden mit einer Fehlermeldung abgelehnt. Komprimieren Sie große Dateien vor dem Upload oder teilen Sie sie in kleinere Teile auf.

---

## Materialienpanel

Alle angehängten Dateien einer Konversation werden im **Materialienpanel** auf der rechten Seite angezeigt. Das Panel bietet eine Übersicht über alle dem Chat hinzugefügten Dokumente.

### Materialien anzeigen

- Klicken Sie auf eine Datei im Panel, um eine Vorschau anzuzeigen
- Bei Dokumenten sehen Sie den extrahierten Textinhalt
- Bei Bildern wird eine Miniaturansicht dargestellt

### Materialien hinzufügen

Sie können jederzeit weitere Dateien zur Konversation hinzufügen:

- Laden Sie neue Dateien über Drag & Drop oder den Upload-Button hoch
- Die neuen Materialien stehen dem Agenten ab der nächsten Nachricht zur Verfügung

### Materialien entfernen

Um eine Datei aus den Materialien zu entfernen:

1. Öffnen Sie das Materialienpanel
2. Klicken Sie auf das **Entfernen-Symbol** neben der gewünschten Datei

> [!info] Hinweis
> Das Entfernen einer Datei aus den Materialien bedeutet, dass der Agent diese bei zukünftigen Nachrichten nicht mehr als Kontext erhält. Bereits gesendete Nachrichten, die sich auf die Datei beziehen, bleiben unberührt.

---

## Verarbeitung durch den Agenten

Hochgeladene Dateien werden je nach Typ unterschiedlich verarbeitet:

- **Dokumente** werden in Markdown-Text konvertiert und dem Agenten als Kontextinformation bereitgestellt
- **Bilder** werden als visuelle Eingabe an Modelle mit Vision-Fähigkeit gesendet
- **Audiodateien** werden zuerst transkribiert (Whisper) und dann als Text an den Agenten übergeben

Der Agent kann anschließend auf den Dateiinhalt Bezug nehmen, Zusammenfassungen erstellen, Fragen beantworten oder Analysen durchführen.
