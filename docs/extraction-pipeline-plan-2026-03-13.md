# Document Extraction Pipeline — Konzept & Implementierungsplan

## Das Problem

In der taeglichen Arbeit mit Kunden und intern taucht immer wieder dasselbe Muster auf: **strukturierte Daten aus unstrukturierten Dokumenten extrahieren**. Lieferscheine, Vertraege, Rechnungen, Lebenslaeufe — jedes Mal wird eine individuelle Loesung gebaut: ein spezifischer Prompt, ein n8n-Workflow, ein Pydantic-Schema, eine Kombination aus Doc2Markdown und Vision-LLM.

Das Ergebnis: viel Doppelarbeit, inkonsistente Qualitaet, schwer wartbar.

## Die Idee

Eine **einzige, konfigurierbare Pipeline** die den gesamten Extraktionsprozess abbildet — von der Dokumenteingabe bis zum validierten JSON-Output. Die Konfiguration erfolgt ueber **Extraktionsprofile**: YAML-Dateien, die beschreiben *was* aus *welchem Dokumenttyp* extrahiert werden soll, inklusive Hilfestellungen fuer das LLM.

Der Kern-Gedanke: **Die Pipeline ist fix, die Profile sind variabel.** Neue Dokumenttypen erfordern kein neues Coding, sondern nur ein neues YAML-Profil.

## Warum nicht einfach bessere Prompts?

Das aktuelle Vorgehen (z.B. in `vertragsmanagement/extraction.ts`) hat drei fundamentale Schwaechen:

1. **Fragile JSON-Extraktion**: Das LLM gibt Freitext zurueck, wir fischen mit Regex (`/\{[\s\S]*\}/`) das JSON raus. Wenn das Modell erklaerenden Text drumherum schreibt, bricht es. Wenn es invalides JSON produziert — stille Fehler.

2. **Keine Validierung**: Ob das extrahierte JSON die richtigen Felder, Typen und Formate hat, wird nicht geprueft. Ein fehlendes Pflichtfeld faellt erst auf, wenn downstream etwas crasht.

3. **Keine Wiederverwendung**: Jeder Dokumenttyp bekommt seinen eigenen Code. Das Schema fuer Mietvertraege ist in `extraction.ts` hartcodiert, das naechste Schema fuer Rechnungen muesste wieder neu programmiert werden.

## Die Loesung: Function Calling statt Freitext

Der zentrale technische Hebel: **OpenAI Function Calling (tool_calls)** statt Regex-JSON-Parsing.

Statt dem LLM zu sagen "Antworte im JSON-Format" und zu hoffen, definieren wir ein **JSON Schema als Function** und erzwingen die Ausgabe ueber `tool_choice: { type: "function", function: { name: "extract_lieferschein" } }`. Das Modell *muss* valides JSON liefern, das dem Schema entspricht. Kein Regex, kein Hoffen.

**Wie das funktioniert:**
```
Profil (YAML)                    OpenAI Function Schema
┌─────────────────┐             ┌──────────────────────┐
│ fields:         │             │ {                    │
│   kopfdaten:    │  ──build──> │   "type": "function",│
│     nummer:     │             │   "parameters": {    │
│       type: text│             │     "kopfdaten": {   │
│       required  │             │       "nummer": {    │
│     datum:      │             │         "type":"str" │
│       type: date│             │       }, ...         │
│   positionen:   │             │     "positionen": {  │
│     _array: true│             │       "type":"array" │
│     _item_fields│             │       "items": {...} │
└─────────────────┘             └──────────────────────┘

LLM Call:
  messages: [system_prompt + guidelines, user: document_text]
  tools: [function_schema]
  tool_choice: forced → extract_lieferschein

Response:
  tool_calls[0].function.arguments = '{"kopfdaten": {"nummer": "LS-001", ...}}'
  ↑ Garantiert valides JSON, garantiert schema-konform
```

## Pipeline-Architektur

Die Pipeline hat 6 klar getrennte Stufen:

```
┌──────────────────────────────────────────────────────────┐
│                    EXTRACTION PIPELINE                    │
├──────────┬───────────┬──────────┬──────────┬─────────────┤
│ 1.INGEST │ 2.RESOLVE │ 3.PREPARE│ 4.EXTRACT│ 5.VALIDATE  │
│          │           │          │          │ + RETRY      │
│ Dokument │ Welches   │ Text     │ LLM mit  │ Typen,      │
│ annehmen │ Profil?   │ oder     │ forced   │ Required,   │
│ + konver-│ Auto oder │ Vision?  │ function │ Formate     │
│ tieren   │ explizit  │          │ calling  │ pruefen     │
└──────────┴───────────┴──────────┴──────────┴─────────────┘
```

### Stufe 1: Ingest — "Was kommt rein?"

Die Pipeline akzeptiert drei Eingabeformen:
- **Chat-Attachment**: Agent gibt `attachment_id` an → wir holen Dokument aus dem Chat-Upload-System
- **Datei**: Direkter Pfad (z.B. aus n8n Upload) → lesen und konvertieren
- **Rohtext**: Bereits konvertierter Text → direkt verwenden

Fuer Dokumente (PDF, DOCX, XLSX) nutzen wir die **existierende Markitdown-API** (`attachmentsService.convertToMarkdown()`). Das ist bereits robust und erprobt — kein Grund, das Rad neu zu erfinden.

Fuer Bilder (Photos von Lieferscheinen etc.) kommt das **Vision-LLM** zum Einsatz (Stufe 3).

### Stufe 2: Resolve — "Welches Profil?"

Zwei Wege:
- **Explizit**: Caller gibt `profile_id: "lieferschein"` an → direkt laden
- **Auto-Detect**: Pipeline erkennt den Dokumenttyp automatisch
  1. Keyword-Matching: Jedes Profil hat `detection.keywords` → Treffer zaehlen in den ersten 3000 Zeichen
  2. Falls uneindeutig: LLM-Klassifikation — wie `detectContractType()` heute, aber generisch fuer alle Profile

### Stufe 3: Prepare — "Text oder Vision?"

Hier die Entscheidung, die fuer die Qualitaet entscheidend ist:

```
Ist die Quelle ein Bild?
  JA → Vision-LLM (Mistral 3 24B) beschreibt das Dokument detailliert
       → Die Beschreibung wird zum "Text" fuer Stufe 4
  NEIN → Ist es ein konvertierbares Dokument?
    JA → Markitdown API → Markdown-Text
    NEIN → Rohtext direkt verwenden
```

**Warum Vision → Text → Extraktion (zwei Schritte)?**
Das Chat-LLM (Qwen3 30B) hat besseres Function Calling als das Vision-LLM (Mistral 3 24B). Indem wir erst das Bild durch Vision beschreiben lassen und dann den Text durch das Chat-LLM extrahieren, nutzen wir die Staerken beider Modelle. Das Vision-LLM sieht und liest, das Chat-LLM strukturiert.

### Stufe 4: Extract — "Die eigentliche Extraktion"

Hier passiert die Magie:

1. **Schema-Builder** konvertiert das Profil in ein OpenAI Function Schema
2. **System-Prompt** kombiniert:
   - Generische Extraktions-Anweisungen (Datumsformate, null fuer fehlende Werte, ...)
   - Profil-spezifische `guidelines` (z.B. "Lieferscheinnummer immer im Header suchen")
   - Feld-spezifische `hints` (eingebettet in die Schema-Descriptions)
3. **LLM-Call** mit erzwungenem Function Calling
4. **Fallback**: Falls das Modell trotzdem Freitext liefert (z.B. bei Ollama-Modellen ohne Function-Calling-Support) → Regex-Fallback wie bisher

### Stufe 5: Validate + Retry — "Stimmt das Ergebnis?"

Auch bei Function Calling kann das LLM inhaltlich falsch liegen. Deshalb:

1. **Typ-Validierung**: Ist `menge` wirklich eine Zahl? Ist `datum` im Format YYYY-MM-DD?
2. **Required-Check**: Sind alle Pflichtfelder befuellt?
3. **Auto-Korrektur**: Deutsche Zahlenformate ("1.234,56" → 1234.56), Datumsformate ("1. Januar 2024" → "2024-01-01")
4. **Retry bei Fehlern**: Falls die Validierung fehlschlaegt, senden wir die Fehler zurueck ans LLM: "Feld X fehlt, Feld Y hat falschen Typ" → zweiter Versuch mit Fehlerfeedback (max 2 Retries)

## Extraktionsprofil: Das Konfigurationsformat

Ein Profil beschreibt **was** aus **welchem Dokumenttyp** extrahiert werden soll:

```yaml
id: lieferschein
name: Lieferschein
description: Extraktion von Lieferscheindaten aus Lieferscheinen und Versandpapieren
version: "1.0"

# Auto-Erkennung: Woran erkennt man diesen Dokumenttyp?
detection:
  keywords: ["Lieferschein", "Lieferung", "Versand", "Menge", "Artikelnummer"]
  description: "Lieferscheine mit Kopfdaten und Positionslisten"

# Felder: Gruppiert in logische Bloecke
fields:
  kopfdaten:                              # Einfache Feld-Gruppe (→ JSON Object)
    lieferscheinnummer:
      type: text
      required: true
      label: "Lieferscheinnummer"
      hint: "Eindeutige Nummer, meist prominent im Dokumentkopf"
    lieferdatum:
      type: date
      required: true
      label: "Lieferdatum"
      hint: "Datum der tatsaechlichen Lieferung, nicht Druckdatum"
    absender:
      type: text
      required: true
      label: "Absender / Lieferant"
    empfaenger:
      type: text
      label: "Empfaenger"
  positionen:                             # Array-Gruppe (→ JSON Array)
    _array: true
    _item_fields:
      artikelnummer:
        type: text
        label: "Artikelnummer"
      bezeichnung:
        type: text
        required: true
        label: "Artikelbezeichnung"
      menge:
        type: number
        required: true
        label: "Gelieferte Menge"
      einheit:
        type: text
        label: "Mengeneinheit (Stueck, kg, Liter, ...)"

# Freie Anweisungen fuer das LLM — hier steckt das Domainwissen
guidelines: |
  - Die Lieferscheinnummer ist IMMER vorhanden, suche im Dokumentkopf
  - Positionen koennen als Tabelle oder nummerierte Liste formatiert sein
  - Bei mehreren Datumsangaben: Das Lieferdatum ist das der tatsaechlichen Lieferung
  - Mengeneinheiten normalisieren: "Stk" → "Stueck", "kg" bleibt "kg"
  - Wenn Artikelnummer fehlt, null setzen (nicht erfinden)
```

**Warum dieses Format?**
- **YAML** statt JSON: Besser lesbar, unterstuetzt Kommentare, konsistent mit dem Rest der Plattform (Agent-Configs, Skills, etc.)
- **Gruppen** statt flache Liste: Spiegelt die natuerliche Dokumentstruktur wider. Ein Lieferschein *hat* Kopfdaten *und* Positionen.
- **`_array: true`-Marker**: Explizit statt implizit — kein Raten ob ein Block ein Objekt oder ein Array ist.
- **`hint` pro Feld**: Das ist der eigentliche Qualitaetshebel. Hier kann Domain-Expertise codiert werden: "Lieferdatum ist nicht das Druckdatum". Das unterscheidet 80% von 95% Extraktionsqualitaet.
- **`guidelines` als Freitext**: Ergaenzt die strukturierten Hints um uebergreifende Anweisungen. Ideal fuer Edge Cases und Normalisierungsregeln.

## Drei Zugangswege

Die Pipeline wird ueber drei Wege zugaenglich:

### 1. Tool: `extract_document` — fuer Agents

```
Agent erhaelt: "Extrahiere die Daten aus dem Lieferschein"
  → Agent ruft extract_document(source: "att-123", profile_id: "lieferschein") auf
  → Pipeline laeuft, gibt strukturiertes JSON zurueck
  → Agent kann mit den Daten arbeiten (z.B. in Tabelle schreiben, zusammenfassen, ...)
```

Das Tool integriert sich nahtlos in die bestehende Tool-Registry. Agents koennen es wie jedes andere Tool verwenden — kein spezielles Handling im Agent Loop noetig.

### 2. REST API: `/api/extraction/` — fuer n8n und externe Systeme

```
POST /api/extraction/extract
  Body: { file: <upload>, profile_id: "lieferschein" }
  Response: { success: true, data: {...}, validation: {...} }
```

Das ist der primaere Integrationsweg fuer n8n-Workflows und andere Automatisierungen. Ein HTTP-Endpoint, der eine Datei + Profilname entgegennimmt und strukturiertes JSON zurueckgibt. Ersetzt individuelle n8n → LLM → Pydantic Ketten.

Zusaetzlich CRUD-Endpoints fuer Profil-Management:
- `GET /api/extraction/profiles` — Alle Profile auflisten
- `GET /api/extraction/profiles/:id` — Einzelnes Profil
- `POST /api/extraction/profiles` — Neues Profil erstellen
- `PUT /api/extraction/profiles/:id` — Profil aktualisieren
- `DELETE /api/extraction/profiles/:id` — Profil loeschen
- `POST /api/extraction/detect` — Profil auto-erkennen (ohne Extraktion)

### 3. Frontend UI: Profil-Verwaltung + Test-Werkbank

Eine eigene Seite in der Plattform mit drei Bereichen:
- **Profil-Liste**: Uebersicht aller Extraktionsprofile mit Name, Beschreibung, Anzahl Felder
- **Profil-Editor**: Profil erstellen und bearbeiten (JSON-Editor)
- **Test-Werkbank**: Dokument hochladen, Profil waehlen, Extraktion live testen und Ergebnis sehen

Die Test-Werkbank ist besonders wertvoll: Damit kann man neue Profile iterativ entwickeln — Profil anpassen, Dokument neu extrahieren, Ergebnis pruefen — ohne Code zu schreiben.

## Beziehung zur bestehenden Vertragsextraktion

Die bestehende `vertragsmanagement/extraction.ts` bleibt **vorerst unangetastet**. Sie funktioniert und ist in die Vertragsmanagement-App integriert. Eine spaetere Migration ist moeglich — die Vertragsschemas koennten als Extraktionsprofile abgebildet werden — aber das ist ein separater Schritt, kein Risiko fuer die bestehende Funktionalitaet.

Was die neue Pipeline *besser* macht:
- Function Calling statt Regex → zuverlaessigerer Output
- Validierung + Retry → weniger stille Fehler
- Konfigurations-getrieben → neue Dokumenttypen ohne Code
- Vision-Support → auch Bilder/Scans verarbeitbar
- API-Endpoint → direkt in n8n und andere Systeme integrierbar

---

## Technische Implementierung

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `backend/src/extraction/types.ts` | TypeScript-Typen: ExtractionProfile, ExtractionResult, FieldDefinition, ValidationReport |
| `backend/src/extraction/profiles.ts` | Profil-Laden/Cache/CRUD aus `data/extraction-profiles/*.yaml` |
| `backend/src/extraction/schema-builder.ts` | Profil-Fields → OpenAI Function Schema (JSON Schema) |
| `backend/src/extraction/validator.ts` | Validierung: Typen, Required, Formate, Auto-Korrektur |
| `backend/src/extraction/service.ts` | ExtractionService: Orchestriert die 5-Stufen-Pipeline |
| `backend/src/extraction/index.ts` | Re-exports |
| `backend/src/tools/special/extract-document.ts` | `extract_document` Tool (Pattern: `ReadChatAttachmentTool`) |
| `backend/src/routes/extraction.ts` | Hono-Routes fuer REST API |
| `frontend/src/pages/ExtractionProfilesPage.jsx` | Profil-Verwaltung + Test-Werkbank |
| `data/extraction-profiles/lieferschein.yaml` | Beispielprofil |

### Bestehende Dateien zu aendern

| Datei | Aenderung | Warum |
|-------|-----------|-------|
| `backend/src/services/llm.ts` | `ChatOptions` um `toolChoice` erweitern | Ermoeglicht forced Function Calling |
| `backend/src/services/llm/adapters/openai.ts` | Z.81 + Z.207: `tool_choice` aus Parameter statt hardcoded `'auto'` | Kern der strukturierten Extraktion |
| `backend/src/services/usageTracking.ts` | Z.16: `'extraction'` zu source-Union | Separates Usage-Tracking |
| `backend/src/tools/index.ts` | `ExtractDocumentTool` registrieren | Tool verfuegbar machen |
| `backend/src/index.ts` | `/api/extraction` Route mounten | API-Endpoints |
| `frontend/src/App.jsx` | Route `/extraction` hinzufuegen | Frontend-Navigation |
| `frontend/src/components/Sidebar.jsx` | Menuepunkt "Extraktion" | UI-Zugang |

### Implementierungsreihenfolge

**Phase 1 — Fundament (Types + Profile + Schema-Builder)**
1. `types.ts` — Alle Typdefinitionen
2. `profiles.ts` — YAML-basiertes Profil-Management
3. `schema-builder.ts` — Profil → OpenAI Function Schema
4. `lieferschein.yaml` — Erstes Beispielprofil

**Phase 2 — Pipeline-Kern**
5. `validator.ts` — Validierung + Auto-Korrektur
6. LLM-Aenderung: `toolChoice` in ChatOptions + OpenAI-Adapter
7. `service.ts` — ExtractionService mit allen 5 Stufen (Text + Vision + Retry)
8. UsageTracking: `'extraction'` Source

**Phase 3 — Integration**
9. `extract-document.ts` Tool + Registrierung in `tools/index.ts`
10. `extraction.ts` Routes + Mounting in `index.ts`

**Phase 4 — Frontend**
11. `ExtractionProfilesPage.jsx` — Profil-Liste, Editor, Test-Werkbank
12. Sidebar + App.jsx Routing

### Verification

```sh
# Backend starten
cd backend && /Users/andreasbachmann/.bun/bin/bun run --watch src/index.ts

# Profile API testen
curl http://localhost:3001/api/extraction/profiles

# Extraktion testen (Text-Input)
curl -X POST http://localhost:3001/api/extraction/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Lieferschein Nr. LS-2024-001\nDatum: 15.03.2024\n...", "profile_id": "lieferschein"}'

# Extraktion testen (File-Upload)
curl -X POST http://localhost:3001/api/extraction/extract \
  -F "file=@lieferschein.pdf" \
  -F "profile_id=lieferschein"
```
