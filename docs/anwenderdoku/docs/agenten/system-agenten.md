# System-Agenten

Der Adacor Workplace wird mit einer Reihe vorkonfigurierter System-Agenten ausgeliefert. Diese decken die wichtigsten Anwendungsfälle ab und können nicht bearbeitet oder gelöscht werden. Jeder System-Agent ist auf einen bestimmten Aufgabenbereich spezialisiert.

---

## Supervisor

| Eigenschaft | Wert |
|-------------|------|
| **ID** | `supervisor` |
| **Delegierbar** | Nein |
| **Max. Iterationen** | 15 |
| **Tools** | `delegate_to_agent`, `user_memory`, `create_task` |

Der Supervisor ist der zentrale Orchestrator der Plattform. Er empfängt alle Benutzeranfragen, wenn kein bestimmter Agent ausgewählt wurde, und entscheidet eigenständig, wie sie am besten bearbeitet werden.

**Kernfunktionen:**

- **Anfrage-Analyse** -- Versteht die Absicht hinter Ihrer Nachricht
- **Intelligentes Routing** -- Delegiert an den passenden Spezialisten
- **Multi-Agent-Orchestrierung** -- Koordiniert mehrere Agenten bei komplexen Aufgaben
- **Adaptiver Plan** -- Bewertet nach jeder Delegation das Ergebnis und entscheidet über nächste Schritte
- **Benutzer-Memory** -- Speichert relevante Informationen über Sie (Termine, Projekte, Präferenzen)

> [!info] Automatische Eskalation
> Der Supervisor handelt autonom: Findet der Knowledge-Agent keine Antwort in der Wissensdatenbank, delegiert der Supervisor automatisch an den Researcher für eine Web-Recherche -- ohne bei Ihnen nachzufragen.

**Entscheidungslogik:**

- Einfache Begrüßung oder Smalltalk --> Direkte Antwort
- Fragen zu geladenen Kontext-Dokumenten --> Direkte Antwort aus dem Kontext
- Fragen zur Wissensdatenbank --> Delegation an Knowledge Orchestrator
- Texte verfassen --> Delegation an Writer
- Web-Recherche --> Delegation an Researcher
- Bild hochgeladen mit Frage --> Delegation an Vision Analyzer
- Bild erstellen oder bearbeiten --> Delegation an Image Generator
- Dokument im Chat hochgeladen --> Delegation an Chat Document Reader
- Umfangreiche Aufgaben --> Erstellung eines Hintergrund-Tasks

---

## Knowledge Orchestrator

| Eigenschaft | Wert |
|-------------|------|
| **ID** | `knowledge` |
| **Delegierbar** | Ja |
| **Tools** | `kb_search`, `delegate_to_agent` |

Der Knowledge Orchestrator ist Ihr Zugang zur internen Wissensdatenbank. Er durchsucht Collections, analysiert Manifest-Daten und delegiert bei Bedarf an den KB Reader für die detaillierte Dokumentenanalyse.

**Arbeitsablauf:**

1. **Collection-Routing** -- Ermittelt die relevanten Collections in der Knowledge Base
2. **Document-Routing** -- Identifiziert passende Dokumente anhand von Metadaten (Titel, Zusammenfassung, Schlagwörter)
3. **Entscheidung** -- Beantwortet Übersichtsfragen direkt aus den Manifest-Daten oder delegiert Inhaltsfragen an den KB Reader
4. **Synthese** -- Fügt die Ergebnisse zu einer kohärenten Antwort zusammen und ergänzt Quellenangaben

> [!example] Typische Anfragen
> - "Was steht in unserer SLA-Vereinbarung zum Thema Reaktionszeiten?"
> - "Welche Dokumente gibt es zum Thema Datenschutz?"
> - "Laut unserer Richtlinie -- wie ist das Vorgehen bei einem Sicherheitsvorfall?"

---

## Researcher (Deep Researcher)

| Eigenschaft | Wert |
|-------------|------|
| **ID** | `researcher` |
| **Delegierbar** | Ja |
| **Tools** | `web_search`, `file_read`, `file_write`, `file_list` |

Der Researcher führt strukturierte Web-Recherchen durch und liefert Ergebnisse mit Quellenangaben. Er unterscheidet zwischen einfachen Faktenfragen (direkte Recherche) und komplexen Themen (geplante Recherche mit mehreren Phasen).

**Zwei Recherche-Modi:**

- **Direkte Recherche** -- Bei einfachen Faktenfragen: 1-3 gezielte Suchanfragen, prägnante Antwort
- **Geplante Recherche** -- Bei komplexen Themen: Planung, systematische Recherche, Synthese und strukturierter Bericht

**Quellenbewertung:**

Der Researcher bewertet Quellen nach Glaubwürdigkeit und priorisiert sie:

1. **Primärquellen** -- Offizielle Dokumente, Gesetze, Studien, Unternehmensseiten
2. **Sekundärquellen** -- Fachartikel, seriöse Nachrichtenmedien
3. **Tertiärquellen** -- Blogs, Foren (mit Vorsicht und Kennzeichnung)

Bei widersprüchlichen Informationen werden beide Positionen dokumentiert. Wissenslücken werden transparent kommuniziert.

---

## Code Analyzer

| Eigenschaft | Wert |
|-------------|------|
| **ID** | `code-analyzer` |
| **Delegierbar** | Ja |
| **Tools** | `file_read`, `file_write`, `file_list` |

Der Code Analyzer ist auf die Analyse und Bewertung von Quellcode spezialisiert. Er unterstützt TypeScript, JavaScript, Python und Go.

**Fähigkeiten:**

- **Code-Analyse** -- Versteht Codestrukturen, Abhängigkeiten und Datenflüsse
- **Debugging** -- Identifiziert Fehlerquellen und schlägt Korrekturen vor
- **Architektur-Review** -- Bewertet die Gesamtarchitektur und gibt Empfehlungen
- **Best Practices** -- Prüft auf Einhaltung gängiger Coding-Standards

> [!tip] Tipp
> Laden Sie die zu analysierende Datei in den Chat hoch oder nennen Sie den Dateipfad im Data-Verzeichnis. Der Code Analyzer liest die Datei über seine File-Tools und liefert ein strukturiertes Feedback.

---

## Writer (Schreib-Assistent)

| Eigenschaft | Wert |
|-------------|------|
| **ID** | `writer` |
| **Delegierbar** | Ja |
| **Tools** | `file_read`, `file_write`, `delegate_to_agent`, `export_document` |

Der Writer erstellt Texte aller Art -- von E-Mails über Berichte bis hin zu kreativen Texten. Er kann Dokumente in verschiedenen Formaten exportieren.

**Spezialgebiete:**

- E-Mails (formell und informell)
- Berichte und Dokumentationen
- Kreatives Schreiben
- Zusammenfassungen und Übersetzungen
- Korrekturlesen und Textverbesserung

**Dokument-Export:**

Über das `export_document`-Tool kann der Writer Inhalte als **Word (.docx)**, **Excel (.xlsx)** oder **PDF (.pdf)** exportieren. Der Export erzeugt einen Download-Link, der direkt im Chat angezeigt wird.

> [!warning] Wichtig
> Der Writer speichert Texte **nicht** automatisch als Datei. Ergebnisse werden direkt im Chat ausgegeben. Wenn Sie den Text als Datei benötigen, bitten Sie den Writer explizit darum (z.B. "Speichere das als Word-Dokument").

---

## Chat Document Reader (Chat-Dokument-Leser)

| Eigenschaft | Wert |
|-------------|------|
| **ID** | `chat-document-reader` |
| **Delegierbar** | Ja |
| **Tools** | `read_chat_attachment` |

Der Chat Document Reader analysiert Dokumente, die Sie direkt im Chat hochgeladen haben. Er liest den Inhalt, beantwortet Fragen dazu und zitiert relevante Passagen.

**Fähigkeiten:**

- Dokumentanalyse und Textextraktion
- Zusammenfassungen erstellen
- Faktenextraktion aus Dokumenten
- Quellenangaben mit wörtlichen Zitaten

**Antwortformat:**

Der Chat Document Reader liefert strukturierte Antworten mit Statusangabe (FOUND / PARTIAL / NOT_RELEVANT), Konfidenzlevel und wörtlichen Zitaten aus dem Dokument.

> [!info] Unterschied zur Knowledge Base
> Der Chat Document Reader analysiert **im Chat hochgeladene** Dateien. Für Dokumente, die in der Wissensdatenbank (Knowledge Base) hinterlegt sind, ist der Knowledge Orchestrator zuständig.

---

## Vision Analyzer (Bild-Analyst)

| Eigenschaft | Wert |
|-------------|------|
| **ID** | `vision-analyzer` |
| **Delegierbar** | Ja |
| **Tools** | `read_chat_attachment` |

Der Vision Analyzer analysiert Bilder, die Sie im Chat hochgeladen haben. Er erkennt Objekte, liest Text (OCR), interpretiert Diagramme und analysiert Screenshots.

**Fähigkeiten:**

- **Allgemeine Bildanalyse** -- Beschreibung von Objekten, Szenen, Personen
- **OCR** -- Text aus Bildern extrahieren (auch aus Scans und Screenshots)
- **Diagramm-Interpretation** -- Flussdiagramme, Charts und Grafiken auswerten
- **Screenshot-Analyse** -- UI-Elemente, Fehlermeldungen und Anwendungen erkennen

> [!tip] Verwendung
> Laden Sie ein Bild im Chat hoch und stellen Sie Ihre Frage dazu. Der Supervisor erkennt automatisch, dass ein Bild vorliegt, und delegiert an den Vision Analyzer.

---

## Image Generator (Bild-Generator)

| Eigenschaft | Wert |
|-------------|------|
| **ID** | `image-generator` |
| **Delegierbar** | Ja |
| **Tools** | `generate_image`, `edit_image` |

Der Image Generator erstellt neue Bilder aus Textbeschreibungen (Text-zu-Bild) und kann hochgeladene Bilder transformieren (Bild-zu-Bild).

**Text-zu-Bild:**

Erstellt neue Bilder basierend auf Ihrer Beschreibung. Der Agent optimiert Ihren Prompt automatisch für bessere Ergebnisse.

**Verfügbare Seitenverhältnisse:**

| Verhältnis | Einsatzgebiet |
|-------------|---------------|
| **1:1** | Portraits, Icons, Social Media Posts |
| **16:9** | Landschaften, Szenen, Desktop-Hintergründe |
| **9:16** | Smartphone-Hintergründe, Stories |
| **4:3** | Klassische Fotos |
| **3:4** | Portrait-Fotos |

**Bild-zu-Bild:**

Transformiert ein hochgeladenes Bild nach Ihren Anweisungen -- z.B. Stil ändern (Foto zu Comic), Szene ändern (Winter zu Sommer) oder Elemente hinzufügen bzw. entfernen.

> [!example] Beispiele
> - "Erstelle ein fotorealistisches Bild einer Winterlandschaft mit schneebedeckten Bergen."
> - "Wandle das hochgeladene Foto in einen Aquarell-Stil um."
> - "Generiere ein 16:9-Banner für einen Newsletter zum Thema Nachhaltigkeit."

---

## Document Indexer (Dokument-Indexer)

| Eigenschaft | Wert |
|-------------|------|
| **ID** | `kb-indexer` |
| **Delegierbar** | Ja |
| **Tools** | `kb_index`, `kb_search`, `kb_manage`, `file_read`, `file_write` |

Der Document Indexer nimmt neue Dokumente in die Knowledge Base auf. Er prüft oder erstellt Collections, indiziert Dokumente und generiert automatisch Metadaten.

**Unterstützte Dokumentformate:**

- PDF (.pdf)
- Word (.docx, .doc)
- Excel (.xlsx)
- PowerPoint (.pptx)
- Text (.txt)
- Markdown (.md)
- HTML (.html)

**Arbeitsablauf:**

1. Prüft, ob die Ziel-Collection bereits existiert (erstellt sie bei Bedarf)
2. Indiziert das Dokument -- dabei wird es automatisch zu Markdown konvertiert
3. Generiert Metadaten per LLM (Zusammenfassung, Schlagwörter, Dokumenttyp)
4. Bei großen Dokumenten wird automatisch ein Index erstellt

---

## KB Reader (Dokument-Reader)

| Eigenschaft | Wert |
|-------------|------|
| **ID** | `kb-reader` |
| **Delegierbar** | Ja |
| **Tools** | `kb_search` |

Der KB Reader liest und analysiert einzelne Dokumente aus der Knowledge Base. Er wird in der Regel vom Knowledge Orchestrator aufgerufen, um konkrete Inhaltsfragen zu beantworten.

**Arbeitsablauf:**

1. Liest die Metadaten des angeforderten Dokuments
2. Prüft die Relevanz anhand der Metadaten
3. Liest den vollständigen Inhalt (bei sehr großen Dokumenten zuerst den Index, dann gezielt die relevanten Abschnitte)
4. Erstellt eine strukturierte Antwort mit Quellenangabe und wörtlichen Zitaten

> [!info] Quellenattribution
> Der KB Reader gibt zu jeder Antwort den Dokumenttitel, den Abschnitt und -- wenn möglich -- wörtliche Zitate an. So können Sie die Informationen jederzeit nachprüfen.
