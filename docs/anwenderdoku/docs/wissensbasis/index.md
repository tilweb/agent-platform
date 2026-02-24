# Knowledge Base

Die Knowledge Base ist das zentrale Wissensmanagement-System des Adacor Workplace. Sie ermöglicht es, Dokumente zu importieren, automatisch zu indexieren und den KI-Agenten als Wissensquelle bereitzustellen. Durch den RAG-Ansatz (Retrieval-Augmented Generation) können Agenten gezielt auf Ihre Unternehmensdokumente zugreifen und präzise, fundierte Antworten liefern.

## Was ist die Knowledge Base?

Die Knowledge Base funktioniert als intelligente Dokumentenbibliothek für Ihre KI-Agenten. Statt allgemeines Weltwissen zu nutzen, können Agenten direkt auf Ihre spezifischen Dokumente, Handbücher, Richtlinien und Wissensdatenbanken zugreifen. Das Ergebnis: Antworten, die auf Ihren tatsächlichen Unternehmensunterlagen basieren.

> [!info] Wie RAG funktioniert
> RAG (Retrieval-Augmented Generation) ist ein Verfahren, bei dem der KI-Agent zunächst relevante Dokumente aus der Knowledge Base sucht und diese dann als Kontext für seine Antwort verwendet. So werden Antworten präziser und nachvollziehbarer.

## Collections

Dokumente in der Knowledge Base werden in **Collections** organisiert. Eine Collection ist eine thematische Sammlung zusammengehöriger Dokumente -- vergleichbar mit einem Ordner oder einer Kategorie.

Beispiele für Collections:

- **IT-Richtlinien** -- Alle IT-Sicherheitsrichtlinien und Betriebshandbücher
- **Onboarding** -- Dokumente für neue Mitarbeiter
- **Produktdokumentation** -- Technische Dokumentation Ihrer Produkte
- **Vertragsvorlagen** -- Standardverträge und Musterformulare

Jede Collection hat folgende Eigenschaften:

| Eigenschaft | Beschreibung |
|---|---|
| **ID** | Eindeutiger Bezeichner (Kleinbuchstaben, Zahlen, Bindestriche) |
| **Name** | Anzeigename der Collection |
| **Beschreibung** | Kurze Beschreibung des Inhalts |
| **Dokumentenanzahl** | Anzahl der enthaltenen Dokumente |
| **Aktivierungsregeln** | Stichwörter, bei denen die Collection automatisch einbezogen wird |

## Unterstützte Formate

Die Knowledge Base unterstützt eine Vielzahl von Dokumentformaten. Beim Import werden alle Formate automatisch in Markdown konvertiert, sodass der KI-Agent den Inhalt optimal verarbeiten kann.

| Format | Beschreibung |
|---|---|
| **PDF** | Adobe PDF-Dokumente |
| **DOCX** | Microsoft Word-Dokumente (ab Word 2007) |
| **DOC** | Ältere Microsoft Word-Dokumente |
| **XLSX** | Microsoft Excel-Tabellen |
| **PPTX** | Microsoft PowerPoint-Präsentationen |
| **TXT** | Einfache Textdateien |
| **MD** | Markdown-Dateien |
| **HTML** | Webseiten und HTML-Dokumente |

> [!tip] Optimale Ergebnisse
> Für die beste Indexierungsqualität empfehlen wir gut strukturierte Dokumente mit klaren Überschriften, Absätzen und Aufzählungen. PDF-Dokumente sollten idealerweise Text-basiert sein (nicht gescannt).

## Indexierung

Beim Import eines Dokuments durchläuft es einen mehrstufigen Indexierungsprozess:

1. **Konvertierung** -- Das Dokument wird über die Markitdown-API in Markdown-Format konvertiert
2. **Metadaten-Generierung** -- Ein KI-Modell analysiert den Inhalt und erzeugt automatisch Metadaten:
    - Titel des Dokuments
    - Dokumenttyp
    - Sprache
    - Schlagwörter (Keywords)
    - Inhaltsbeschreibung
    - Mögliche Fragen, die das Dokument beantworten kann
3. **Speicherung** -- Das konvertierte Dokument und die Metadaten werden in der Collection gespeichert

Jedes indexierte Dokument besteht aus zwei Teilen:

- **`content.md`** -- Der konvertierte Dokumentinhalt im Markdown-Format
- **`DOCUMENT_META.md`** -- Die automatisch generierten Metadaten

## Suche in der Knowledge Base

Die Knowledge Base bietet eine leistungsstarke Volltextsuche über alle Collections hinweg. Es gibt zwei Suchmodi:

- **Standard-Suche** -- Schnelle Stichwortsuche über alle Dokumente
- **Intelligente Suche** -- KI-gestützte Suche, die Synonyme, Kontext und mehrsprachige Anfragen versteht

Die Suchergebnisse zeigen den Dokumenttitel, einen Textauszug und die zugehörige Collection an.

> [!example] Beispiel
> Eine Suche nach "Urlaubsantrag" findet auch Dokumente, die "Abwesenheitsantrag", "Freizeitausgleich" oder "Feriengesuch" enthalten -- dank der intelligenten Suche.

## Smarte Aktivierung

Collections können mit **Aktivierungsregeln** versehen werden. Diese bestimmen, wann eine Collection automatisch als Wissensquelle für den Agenten herangezogen wird.

### Aktivieren bei (activate_when)

Eine Liste von Stichwörtern oder Themen. Wenn eine Benutzeranfrage eines dieser Stichwörter enthält, wird die Collection automatisch als Kontext eingebunden.

**Beispiel:** Eine Collection "Datenschutz" mit den Aktivierungswörtern `DSGVO`, `Datenschutz`, `personenbezogene Daten` wird automatisch einbezogen, sobald ein Benutzer eine Frage zu diesen Themen stellt.

### Nie aktivieren bei (never_activate_when)

Stichwörter, bei denen die Collection explizit ausgeschlossen werden soll, selbst wenn andere Regeln zutreffen würden.

## Collection-Verwaltung

### Collection erstellen

1. Navigieren Sie zur **Knowledge Base** im Hauptmenü
2. Klicken Sie auf **Neue Collection erstellen**
3. Geben Sie eine **ID** (z.B. `it-richtlinien`), einen **Namen** und eine **Beschreibung** ein
4. Optional: Definieren Sie Aktivierungsregeln
5. Speichern Sie die Collection

### Dokumente importieren

1. Öffnen Sie die gewünschte Collection
2. Klicken Sie auf **Dokument hochladen**
3. Wählen Sie eine oder mehrere Dateien in einem unterstützten Format aus
4. Die Indexierung startet automatisch -- Fortschritt wird angezeigt
5. Nach Abschluss erscheint das Dokument in der Dokumentenliste

### Collection löschen

1. Öffnen Sie die Collection, die Sie löschen möchten
2. Klicken Sie auf **Löschen**
3. Bestätigen Sie die Aktion

> [!warning] Achtung
> Beim Löschen einer Collection werden alle enthaltenen Dokumente unwiderruflich entfernt. Stellen Sie sicher, dass Sie die Originaldateien noch anderweitig gespeichert haben.

## Collection-Manifest und Metadaten

Jede Collection verfügt über ein **Manifest** -- eine strukturierte Übersicht aller enthaltenen Dokumente. Das Manifest enthält:

- **Collection-ID und Name** -- Identifikation der Collection
- **Beschreibung** -- Zweck und Inhalt der Collection
- **Letztes Update** -- Zeitstempel der letzten Änderung
- **Dokumentenliste** -- Alle Dokumente mit ihren Metadaten:
    - Dokument-ID
    - Titel
    - Dateipfad
    - Importdatum

Die Metadaten der einzelnen Dokumente (`DOCUMENT_META.md`) enthalten KI-generierte Informationen wie Titel, Typ, Sprache, Schlagwörter und eine Inhaltsbeschreibung. Diese Metadaten verbessern die Suchqualität und helfen dem Agenten, schnell die relevantesten Dokumente zu identifizieren.

## Zugriffssteuerung

Collections unterliegen der rollenbasierten Zugriffssteuerung (RBAC). Der Ersteller einer Collection wird automatisch zum **Owner**. Weitere Benutzer können mit unterschiedlichen Rollen hinzugefügt werden:

| Rolle | Lesen | Bearbeiten | Löschen | Zugriff verwalten |
|---|:---:|:---:|:---:|:---:|
| **Owner** | Ja | Ja | Ja | Ja |
| **Editor** | Ja | Ja | Nein | Nein |
| **Viewer** | Ja | Nein | Nein | Nein |
