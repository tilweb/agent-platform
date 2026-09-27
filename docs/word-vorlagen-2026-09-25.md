# Word-Vorlagen: Designvorlagen & Strukturvorlagen

Stand: 25.09.2026, Phase 0 (Spike) und Phase 1 (Designvorlagen) umgesetzt

## Kontext

Word-Exporte aus dem Chat (`export_document`, `fill_template_to_docx`) haben ein fest verdrahtetes Design (Calibri, Teal, kein Logo). Ziel sind zwei Arbeitsweisen:

- **Designvorlage** (nur Admins): Eine Word-Datei gibt das Corporate Design vor, also Kopf-/Fußzeile, Logo, Formatvorlagen und Seitenlayout. Das LLM schreibt dazu freien Inhalt als Markdown.
- **Strukturvorlage** (Admins und Nutzer): Eine Word-Datei mit festen Feldern `{{feld}}`, z.B. für einen Projektstatusbericht. Das LLM liefert JSON nach einem Feldkatalog.

Rahmenbedingung ist, dass **keine neue Dependency** dazukommt.

## Recherche: Ansätze

| Ansatz | Bewertung |
|---|---|
| Design im Code (Status quo) | Jedes Kunden-CD wäre ein Code-Change. Bleibt nur als Fallback. |
| Referenzdokument / Style-Vererbung (Prinzip von pandoc `--reference-doc`) | **Gewählt für Designvorlagen.** Der Kunde pflegt sein CD in Word. |
| Platzhalter-Templates (docxtemplater, docx-templates) | Das Prinzip ist **gewählt für Strukturvorlagen**, aber ohne Library umgesetzt. |
| Word-Inhaltssteuerelemente | Robust, aber die Autoren-Hürde ist für Nutzer zu hoch. |
| HTML → docx (altChunk) | Schlechte Designtreue in LibreOffice und Pages. |
| LLM erzeugt OOXML oder Code | Mit Qwen3 30B unzuverlässig, außerdem bräuchte es eine Sandbox. |
| pandoc oder LibreOffice als Binary | Mehr Betriebsaufwand auf Scalingo, faktisch eine Dependency. |

**Leitprinzip:** Das LLM erzeugt nur Inhalt, nie Layout.

## Spike-Ergebnis (Phase 0): Go, mit geänderter Engine-Aufteilung

Code: `tools/doc-template-spike/`, Aufruf mit `bun run tools/doc-template-spike/spike.ts`. Getestet wurde mit der echten deutschen Word-Datei `docs/projektmanagement-imports/Projektauftrag - Neues IT-System.docx`, die Ergebnisse wurden in **Word** und **Pages** gerendert.

### Befunde

1. **`docx.patchDocument` taugt nicht für Block-Inhalte.** Die Library führt `numbering.xml` nicht zusammen. Unsere Aufzählung zeigte auf die bestehende Liste `numId 1` der Vorlage, mit fremdem Einzug. Enthält die Vorlage eine nummerierte Liste, kollidiert das. Außerdem schreibt die Library die englische Style-ID `ListParagraph`, die in deutschen Vorlagen nicht existiert.
2. **Lokalisierte Style-IDs bestätigt.** In einer deutschen Vorlage heißt „Überschrift 1“ intern `berschrift1`, die Listen-Formatvorlage `Listenabsatz`. Die Auflösung über den sprachneutralen Namen `w:name` („heading 1“, „List Paragraph“, „Table Grid“, „Hyperlink“) funktioniert.
3. **Reale Vorlagen sind lückenhaft.** Die Testvorlage definiert nur Überschrift 1. Überschrift 2/3, Listen- und Tabellenformatvorlagen fehlen. Deshalb werden fehlende Formatvorlagen **nachgerüstet**: Überschrift 2/3 basieren auf Überschrift 1 der Vorlage und übernehmen so Schrift und Farbe, dazu kommt ein Tabellengitter mit Zellabstand.
4. **Zerstückelte Platzhalter funktionieren.** Platzhalter, die Word über mehrere Runs verteilt (Rechtschreibprüfung, Formatwechsel), erkennt `patchDetector`, und `patchDocument` ersetzt sie. Unsere eigene Block-Ersetzung ist über den Gesamttext eines Absatzes ebenfalls robust dagegen.
5. **Pages braucht explizite Tabellenbreiten.** Leere `<w:gridCol/>` gleicht Word aus, Pages zerlegt die Tabelle dann in schmale Spalten. Die Spaltenbreiten werden daher in Twips aus dem Satzspiegel der Vorlage berechnet (Seitenbreite minus Ränder aus `sectPr`).
6. **Kopf-/Fußzeile, Header-Logo und Fußzeilenfelder bleiben erhalten**, sowohl beim eigenen Ersetzen als auch nach `patchDocument`. Die Fußzeilenfelder (Dateiname, Seite x/y, Stand) aktualisiert Word selbst.
7. **ZIP ohne Dependency.** Bun kann kein ZIP lesen (`Bun.Archive` meldet „Unrecognized archive format“). Ein eigener Leser und Schreiber (`zip.ts`, ca. 100 Zeilen, `node:zlib` + `Bun.hash.crc32`) funktioniert. Word öffnet die Dateien ohne Reparaturmeldung.

### Geänderte Architektur

| Inhalt | Engine |
|---|---|
| Block-Inhalte (Markdown, Tabellen): Design-`{{INHALT}}` und Struktur-Blockfelder | **eigener OOXML-Builder**: aufgelöste Style-IDs, eigene Nummerierung (abstractNum/num ab 9101, jede nummerierte Liste startet neu), Hyperlink-Relationships, Tabellenbreiten in Twips. Er ersetzt den ganzen Platzhalter-Absatz. |
| Inline-Felder im Fließtext (`Stichtag: {{stichtag}}`) | **`docx.patchDocument`**: behält die Formatierung des Platzhalters, z.B. Fettung, und kommt mit Split-Runs zurecht |
| Felderkennung beim Upload | **`docx.patchDetector`** |
| Paket lesen/schreiben, Styles nachrüsten | eigenes `zip.ts` + Style-Index |

**Reihenfolge beim Rendern:** erst die Block-Felder (eigenes OOXML), dann die Inline-Felder (`patchDocument`).

### Noch offen

- LibreOffice ist lokal nicht installiert und wurde deshalb nicht getestet.
- Eine echte Kunden-CD-Vorlage mit Logo im Header und eigener Tabellenformatvorlage steht noch aus. Das Header-Logo wurde bisher nur simuliert.
- Beim Anlegen einer Design-Hülle aus einem bestehenden Dokument bleiben ungenutzte Medien im Paket. Das ist unschädlich und nur eine Frage der Dateigröße.

## Phase 1: Designvorlagen (umgesetzt)

### Was es für Nutzer bedeutet

- **Admins:** Unter Einstellungen → System → „Dokumentvorlagen“ lädt man eine Word-Datei hoch und setzt sie „Als Standard“.
  - Die Upload-Prüfung zeigt, ob Kopf-/Fußzeile und `{{INHALT}}` vorhanden sind, welche Formatvorlagen ergänzt werden und welche unbekannten Platzhalter stehen bleiben.
  - „Testdokument“ erzeugt ein Beispiel mit Überschriften, Listen, Tabelle und Zitat.
- **Alle Nutzer:** Word-Dokumente aus dem Chat erscheinen automatisch im Standard-Design. Ohne Designvorlage wird ein neutrales, sauberes Layout verwendet, in dem Markdown ebenfalls korrekt gesetzt wird.

### Architektur (`backend/src/services/docTemplates/`)

| Datei | Aufgabe |
|---|---|
| `zip.ts` | ZIP-Datei lesen und schreiben, ohne Dependency |
| `styles.ts` | Formatvorlagen über `w:name` auflösen und fehlende nachrüsten. Überschrift 2–4 erben von Überschrift 1 der Vorlage; ohne Überschrift 1 greifen Theme-Schrift und `accent1` |
| `ooxml.ts` | `BlockWriter` erzeugt OOXML für Absätze, Listen, Tabellen und Links, mit Nummerierungskontext pro Render-Vorgang. Ersetzt Block-Platzhalter bzw. hängt ans Dokumentende an, registriert Links und Nummerierung |
| `markdown.ts` | eigener Markdown-Parser: H1–H4, Listen (3 Ebenen), nummerierte Listen mit Neustart, GFM-Tabellen, Zitat, Code, Trennlinie; inline fett, kursiv, durchgestrichen, Code, Link (nur http/https/mailto) |
| `render.ts` | `inspectTemplate` (Upload-Prüfung), `renderWithDesign`, `getBuiltinShell`. `.dotx` wird auf `.docx` normalisiert, Makro-Dateien werden abgelehnt |
| `sections.ts` | wandelt das alte Section-Format in Markdown um, damit auch klassische Aufrufe im CD landen |
| `store.ts` | DB-Tabelle `documents.templates` + S3 (`doc-templates/<id>/original.docx`); `resolveDesignTemplate`: erst explizite Vorlage, dann Standard, sonst keine |

**API** (`backend/src/routes/doc-templates.ts`, unter `/api/doc-templates`):
- Liste und Testdokument für alle angemeldeten Nutzer
- Upload, Umbenennen, Standard setzen/entfernen, Löschen und Original-Download nur für Admins

**`export_document`:**
- Neuer Parameter `content_markdown` (bevorzugt für docx) und optional `design_template_id`.
- Bei docx wird der Vorlagen-Renderer genutzt, wenn Markdown übergeben wird oder eine Standardvorlage aktiv ist.
- PDF und XLSX bleiben unverändert.
- Das Ergebnis meldet `designTemplate` mit dem Namen der verwendeten Vorlage.
- Die Tool-Beschreibung und der Skill `chat-export` sind entsprechend angepasst.

### Entscheidungen

- **Standard-Design statt Instanz-Setting:** Es gibt keine allgemeine Settings-Tabelle. Der Standard ist daher ein Flag an der Vorlage, abgesichert über einen partiellen Unique-Index (höchstens eine Standard-Designvorlage).
- **Sections landen ebenfalls im CD, sobald eine Standardvorlage aktiv ist.** Farbpunkte (`RichCell.dot`) gehen dabei als Text verloren, das ist akzeptiert.
- **Unbekannte Platzhalter bleiben sichtbar stehen**, statt still entfernt zu werden. Die Upload-Prüfung weist darauf hin.

### Nebenbefunde behoben

- **Export-Download:** prüft jetzt, wer den Export erstellt hat. Fremde Nutzer bekommen 404, Admins und Alt-Exporte ohne `userId` bleiben abrufbar.
- **JSON-String-Inhalte:** `export_document` parst JSON-Strings bei table/list/keyvalue, die vorher still leer blieben. Nachgewiesen im PDF-Test.

### Verifikation

- **Unit-Tests:** `bun test src/services/docTemplates`, 14 Tests: ZIP-Roundtrip, Style-Auflösung und -Nachrüstung, Inline-Parser, Upload-Prüfung, Rendern mit Split-Run-Marker, Anhängen ohne Marker, Nummerierung, Tabellenbreiten, Section-Umwandlung.
- **Service-Test gegen lokale DB und S3:** Upload, Standard setzen, `export_document` mit Markdown und mit Sections (docx) sowie PDF mit JSON-String-Inhalt, gerendert in Word.
- **HTTP-Test mit temporären Sessions:**
  - Upload als Nutzer → 403, ungültige Datei → 400
  - Testdokument als Nutzer → 200, Original als Nutzer → 403
  - Export eines Admins, heruntergeladen von einem anderen Nutzer → 404
- **Echter Chat mit Qwen 3.5:** „Word-Dokument mit Projektstatusbericht …“. Der Supervisor delegiert an den Writer, dieser ruft `export_document` auf, das Ergebnis erscheint im Vorlagen-Design (Titel, CD-Überschriften, Tabelle, Aufzählung, Kopf-/Fußzeile), geprüft in Pages.
- **UI:** Screenshots der leeren Liste, des Upload-Dialogs und der Liste mit Prüfhinweisen.

## Nächste Phasen

- **Phase 2: Strukturvorlagen** für Admins und Nutzer: Feldkatalog, `list_document_templates` / `fill_document_template`, Freigabe über `resource_access`.
- **Phase 3:** Space-Default, Designvorlage auch für Chat-Export und App-Exporte, Migration von `fill_template_to_docx`.

Der Spike-Code unter `tools/doc-template-spike/` bleibt als Referenz erhalten; produktiv ist der Code unter `backend/src/services/docTemplates/`.
