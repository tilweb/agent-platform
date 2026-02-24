# Verfügbare Skills

Diese Seite listet alle Skills des KI-Workplace auf -- unterteilt in System-Skills (vorinstalliert, nicht änderbar) und benutzerdefinierte Skills.

---

## System-Skills

System-Skills werden mit der Plattform ausgeliefert und können nicht bearbeitet oder gelöscht werden.

---

### Web Recherche

| Eigenschaft          | Wert                                  |
| -------------------- | ------------------------------------- |
| **ID**               | `web-research`                        |
| **Slash-Command**    | `/web-research`                       |
| **Geschätzte Dauer** | 2 -- 5 Minuten                        |
| **Ausgabe**          | Recherche-Zusammenfassung mit Quellen |
| **Status**           | Aktiv                                 |

Führt gezielte Web-Recherchen durch und fasst die Ergebnisse strukturiert zusammen. Der Skill optimiert die Suchstrategie automatisch, indem er verschiedene Suchbegriffe in Deutsch und Englisch verwendet.

**Trigger-Wörter:**

- "recherchiere", "suche im web", "finde heraus"
- "was gibt es neues zu", "aktuelle informationen"

**Arbeitsablauf:**

1. Analyse der Fragestellung und Planung der Suchstrategie
2. Hauptsuche mit optimierten Suchbegriffen
3. Ergänzende Suche mit alternativen Begriffen (bei Bedarf)
4. Zusammenfassung der Erkenntnisse mit Quellenangaben

**Qualitätskriterien:**

- Mehrere Quellen für wichtige Fakten
- Unterscheidung zwischen Fakten und Meinungen
- Kennzeichnung widersprüchlicher Informationen
- Angabe des Datums der Quellen

> [!example] Beispielaufruf
>
> ```
> /web-research Welche neuen Regelungen bringt der EU AI Act für KMU?
> ```
>
> oder einfach: _"Recherchiere, welche neuen Regelungen der EU AI Act für KMU bringt."_

---

### Deep Research

| Eigenschaft          | Wert                           |
| -------------------- | ------------------------------ |
| **ID**               | `deep-research`                |
| **Slash-Command**    | `/deep-research`               |
| **Geschätzte Dauer** | 5 -- 15 Minuten                |
| **Ausgabe**          | Strukturierter Research-Report |
| **Status**           | Aktiv                          |

Startet eine umfassende, mehrstufige Recherche für komplexe Themen. Im Gegensatz zur einfachen Web-Recherche durchläuft die Deep Research einen vollständigen Planungs-, Recherche- und Synthesezyklus und speichert die Ergebnisse als Report-Datei.

**Trigger-Wörter:**

- "tiefenrecherche", "deep research"
- "ausführliche recherche", "umfassende recherche"
- "recherchiere ausführlich", "untersuche gründlich"

**Arbeitsablauf:**

1. **Planung** -- Analyse der Anfrage, Identifikation der Kernfragen, Planung konkreter Recherche-Schritte
2. **Recherche** -- Systematische Web-Suchen, Informationssammlung aus mehreren Quellen, Prüfung von Quellenqualität und Aktualität
3. **Synthese** -- Zusammenführung der Ergebnisse, Identifikation von Widersprüchen, Dokumentation von Wissenslücken
4. **Dokumentation** -- Erstellung eines strukturierten Berichts, Speicherung als Datei

**Ergebnisse:**

- Zusammenfassung der wichtigsten Erkenntnisse direkt im Chat
- Vollständiger Report mit allen Details und Quellen als gespeicherte Datei

> [!info] Zeitbedarf
> Deep Research kann je nach Komplexität des Themas 5 bis 15 Minuten dauern. Zwischenstände werden im Chat angezeigt, sodass Sie den Fortschritt verfolgen können.

---

### Knowledge Query (Wissenssuche)

| Eigenschaft          | Wert                              |
| -------------------- | --------------------------------- |
| **ID**               | `knowledge-query`                 |
| **Slash-Command**    | `/knowledge-query`                |
| **Geschätzte Dauer** | 1 -- 3 Minuten                    |
| **Ausgabe**          | Antwort mit Dokumenten-Referenzen |
| **Status**           | Aktiv                             |

Durchsucht die interne Wissensdatenbank (Knowledge Base) nach Antworten auf Ihre Fragen. Der Skill arbeitet mit dem Knowledge Orchestrator zusammen, der die relevanten Collections und Dokumente identifiziert.

**Trigger-Wörter:**

- "wissensdatenbank", "knowledge base", "nachschlagen"
- "in der dokumentation", "laut dokument", "was steht in"

**Arbeitsablauf:**

1. Durchsuche die Collections der Knowledge Base
2. Identifiziere relevante Dokumente anhand ihrer Metadaten
3. Delegiere an den KB Reader für detaillierte Dokumentenanalyse
4. Synthetisiere die Ergebnisse zu einer kohärenten Antwort

> [!tip] Tipp
> Formulieren Sie Ihre Fragen möglichst konkret. Statt _"Was wisst ihr über Datenschutz?"_ liefert _"Welche Aufbewahrungsfristen gelten laut unserer Datenschutzrichtlinie für Kundendaten?"_ deutlich präzisere Ergebnisse.

---

### Bildgenerierung

| Eigenschaft          | Wert                |
| -------------------- | ------------------- |
| **ID**               | `image-generation`  |
| **Slash-Command**    | `/image-generation` |
| **Geschätzte Dauer** | 1 -- 2 Minuten      |
| **Ausgabe**          | Generiertes Bild    |
| **Status**           | Aktiv               |

Erstellt Bilder aus Textbeschreibungen. Der Skill optimiert Ihre Beschreibung automatisch zu einem detaillierten Prompt und wählt ein passendes Seitenverhältnis.

**Trigger-Wörter:**

- "generiere ein bild", "erstelle ein bild"
- "zeichne", "male", "erzeuge ein bild"

**Prompt-Optimierung:**

Der Skill erweitert kurze Beschreibungen automatisch um hilfreiche Details:

- **Stil** -- Fotorealistisch, Digital Art, Aquarell, Illustration
- **Komposition** -- Nahaufnahme, Vogelperspektive, zentriert
- **Stimmung** -- Warmes Abendlicht, dramatischer Himmel, friedliche Atmosphäre

**Seitenverhältnisse:** 1:1, 16:9, 9:16, 4:3, 3:4

> [!example] Beispielaufruf
>
> ```
> /image-generation Ein minimalistisches Logo für ein Technologie-Startup, blau und weiß, flaches Design
> ```

---

### Bildbearbeitung

| Eigenschaft          | Wert                |
| -------------------- | ------------------- |
| **ID**               | `image-edit`        |
| **Slash-Command**    | `/image-edit`       |
| **Geschätzte Dauer** | 1 -- 3 Minuten      |
| **Ausgabe**          | Bearbeitetes Bild   |
| **Status**           | Derzeit deaktiviert |

Bearbeitet hochgeladene Bilder basierend auf Ihren Anweisungen. Unterstützt Stiländerungen, Farbanpassungen, Objektänderungen und Hintergrundänderungen.

**Trigger-Wörter:**

- "bearbeite das bild", "verändere das bild"
- "ändere das bild", "transformiere das bild"

**Bearbeitungsmöglichkeiten:**

- Stiländerungen (z.B. Foto zu Comic, Aquarell, Ölgemälde)
- Farbänderungen (z.B. Schwarzweiß, Sepia)
- Objektänderungen (Hinzufügen, Entfernen, Ändern von Elementen)
- Hintergrundänderungen
- Stimmungsänderungen (heller, dunkler, dramatischer)

> [!warning] Derzeit deaktiviert
> Dieser Skill ist aktuell deaktiviert. Die Bildbearbeitungsfunktion kann stattdessen direkt über den Image-Generator-Agenten genutzt werden, indem Sie ein Bild hochladen und Ihre Bearbeitungswünsche beschreiben.

---

### Chat Export

| Eigenschaft       | Wert                                 |
| ----------------- | ------------------------------------ |
| **ID**            | `chat-export`                        |
| **Slash-Command** | `/export`                            |
| **Ausgabe**       | Dokument-Download (PDF, Word, Excel) |
| **Status**        | Aktiv                                |

Exportiert Chat-Inhalte und Konversationsergebnisse in verschiedene Dokumentformate. Dieser Skill wird **ausschließlich über den Slash-Command** `/export` aktiviert.

> [!warning] Nur manuelle Aktivierung
> Im Gegensatz zu anderen Skills wird der Chat-Export nicht automatisch durch Schlüsselbegriffe ausgelöst. Verwenden Sie den expliziten Befehl `/export`.

**Verfügbare Formate:**

| Format    | Dateiendung | Einsatzgebiet                         |
| --------- | ----------- | ------------------------------------- |
| **PDF**   | .pdf        | Berichte, Dokumentation, Archivierung |
| **Word**  | .docx       | Bearbeitung und Weitergabe            |
| **Excel** | .xlsx       | Tabellarische Daten und Analysen      |

**Inhaltsstruktur:**

Das exportierte Dokument wird automatisch strukturiert in:

- **Text-Sektionen** -- Fließtext, Erklärungen, Zusammenfassungen
- **Tabellen** -- Tabellarische Daten mit Kopfzeilen
- **Listen** -- Aufzählungen
- **Schlüssel-Wert-Paare** -- Metadaten und strukturierte Informationen

---

## Benutzerdefinierte Skills

Neben den System-Skills können eigene Skills erstellt werden, die spezifische Arbeitsabläufe für Ihr Team abbilden.

---

### Code Review

| Eigenschaft          | Wert                                |
| -------------------- | ----------------------------------- |
| **ID**               | `code-review`                       |
| **Slash-Command**    | `/code-review`                      |
| **Geschätzte Dauer** | 2 -- 5 Minuten                      |
| **Ausgabe**          | Strukturiertes Code-Review Feedback |
| **Status**           | Aktiv                               |

Führt professionelle Code Reviews durch mit Fokus auf Qualität, Sicherheit und Best Practices. Der Skill liest die zu prüfende Datei, analysiert sie systematisch nach definierten Kriterien und liefert strukturiertes Feedback.

**Trigger-Wörter:**

- "review", "prüfe den code"
- "code check", "überprüfe"

**Prüfkriterien:**

| Kriterium       | Prüfinhalt                                                                    |
| --------------- | ----------------------------------------------------------------------------- |
| **Korrektheit** | Funktioniert der Code wie beabsichtigt? Logische Fehler? Edge Cases?          |
| **Lesbarkeit**  | Aussagekräftige Namen? Gute Struktur? Hilfreiche Kommentare?                  |
| **Wartbarkeit** | DRY-Prinzip? Angemessene Größe von Funktionen/Klassen? Sinnvolle Architektur? |
| **Sicherheit**  | Input-Validierung? Schutz sensibler Daten? SQL Injection, XSS?                |
| **Performance** | Offensichtliche Performance-Probleme? Unnötige Berechnungen oder Schleifen?   |

**Arbeitsablauf:**

1. Datei vollständig lesen
2. Kontext und Zweck des Codes verstehen
3. Systematische Analyse nach allen fünf Prüfkriterien
4. Strukturiertes Feedback mit kritischen Findings, Verbesserungsvorschlägen und positiven Aspekten

**Ausgabe-Struktur:**

Das Feedback umfasst:

- **Zusammenfassung** -- Gesamteindruck des Codes
- **Kritische Findings** -- Fehler oder Sicherheitsprobleme mit Zeilenangabe
- **Verbesserungsvorschläge** -- Empfehlungen für besseren Code
- **Positives** -- Was bereits gut gelöst ist
- **Empfehlungen** -- Übergreifende Hinweise für die Weiterentwicklung

> [!example] Beispielaufruf
>
> ```
> /code-review backend/src/auth/types.ts
> ```
>
> oder: _"Prüfe den Code in der Datei auth/types.ts auf Sicherheit und Best Practices."_
