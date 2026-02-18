# Knowledge Base Architektur — File-basiertes RAG ohne Vektor-DB

## Grundidee

Statt Dokumente in Chunks zu zerlegen und in einer Vektor-DB zu speichern, setzt dieses System auf **LLM-gesteuerte Mehrschicht-Navigation**. Das LLM entscheidet auf jeder Ebene selbst, welche Collection, welches Dokument und welcher Abschnitt relevant ist — anhand von strukturierten Metadaten, die beim Indexieren generiert werden.

Alles liegt als lesbare Dateien im Filesystem. Kein Embedding, kein Vektor-Index, keine DB.

---

## Dateistruktur

```
data/knowledge-base/
├── collections.yaml                          # Registry aller Collections
├── collections/
│   └── compliance/
│       └── manifest.yaml                     # Dokument-Liste + Routing-Metadaten
├── documents/
│   └── doc-richtlinie-sicherheit-17699.../
│       ├── content.md                        # Konvertiertes Markdown (Volltext)
│       ├── DOCUMENT_META.md                  # LLM-generierte Metadaten
│       └── INDEX.md                          # Inhaltsverzeichnis (bei grossen Docs)
├── incoming/                                 # Original-Dateien (PDF, DOCX, etc.)
└── prompts/
    ├── collection-router.md                  # Prompt-Template fuer Collection-Auswahl
    └── document-router.md                    # Prompt-Template fuer Dokument-Auswahl
```

---

## Die drei Ebenen

### 1. `collections.yaml` — Welche Wissensgebiete gibt es?

```yaml
collections:
  - id: "compliance"
    name: "Compliance und Richtlinien"
    description: "Richtlinien, Vorgaben und Compliance Konzepte"
    document_count: 3
    activate_when:                    # Semantische Hinweise fuer das LLM
      - "Compliance-Fragen"
      - "Richtlinien-Fragen"
    never_activate_when:              # Negative Abgrenzung
      - "Allgemeiner Smalltalk"
```

`activate_when` / `never_activate_when` sind keine Keyword-Trigger, sondern **semantischer Kontext** den das LLM bei der Routing-Entscheidung liest. Es entscheidet per Intent-Analyse, nicht per String-Match.

### 2. `manifest.yaml` — Welche Dokumente sind in einer Collection?

```yaml
collection_id: "compliance"
collection_name: "Compliance und Richtlinien"
last_updated: "2026-01-31T12:05:33.961Z"
documents:
  - document_id: "doc-richtlinie-sicherheit-17699..."
    title: "Richtlinie fuer sichere Entwicklung"
    source_file: "RichtliniefrsichereEntwicklung-v6.pdf"
    path: "doc-richtlinie-sicherheit-17699..."
    indexed_date: "2026-01-30"
```

### 3. `DOCUMENT_META.md` — Was steht im Dokument? (LLM-generiert beim Indexieren)

```markdown
## Basisdaten
- **Titel:** Richtlinie fuer sichere Entwicklung
- **Typ:** richtlinie
- **Quelle:** RichtliniefrsichereEntwicklung-v6.pdf
- **Seitenanzahl:** 24
- **Sprache:** de

## Klassifizierung
- **Collection:** compliance
- **Vertraulichkeit:** internal
- **Owner:** ISM

## Inhaltsbeschreibung
Die Richtlinie definiert verbindliche Vorgaben fuer die sichere
Softwareentwicklung im Unternehmen. Sie umfasst...

## Keywords
Sichere Entwicklung, OWASP, Code Review, Security Testing, ...

## Beantwortet Fragen zu
- Welche Vorgaben gelten fuer sichere Entwicklung?
- Wie muss ein Code Review durchgefuehrt werden?
- Welche Security-Tests sind Pflicht?
```

---

## Indexier-Pipeline (beim Upload)

```
Original-Datei (PDF/DOCX/XLSX/...)
    ↓
1. Speichern in incoming/ (Original bleibt erhalten)
    ↓
2. Konvertierung → content.md (via Markitdown API)
    ↓
3. LLM-Analyse → DOCUMENT_META.md generieren
   (Typ, Keywords, Beschreibung, Fragen, etc.)
    ↓
4. Bei grossen Docs (>20K Zeichen): INDEX.md generieren
   (Kapitel-Verzeichnis mit Zusammenfassungen)
    ↓
5. Manifest + collections.yaml aktualisieren
```

---

## Retrieval-Pipeline (bei User-Frage)

Drei spezialisierte Agenten arbeiten zusammen:

```
User: "Welche Vorgaben gelten fuer Code Reviews?"
         │
         ▼
┌─ Knowledge Agent (Orchestrator) ─────────────────────┐
│                                                       │
│  1. kb_search(level='collections')                    │
│     → Liest collections.yaml                          │
│     → LLM analysiert activate_when/never_activate_when│
│     → Waehlt: "compliance" Collection                 │
│                                                       │
│  2. kb_search(level='manifest', collection='compliance')
│     → Liest manifest.yaml                             │
│     → LLM vergleicht Frage mit Dokument-Metadaten     │
│     → Waehlt: "Richtlinie sichere Entwicklung"        │
│                                                       │
│  3. Entscheidung:                                     │
│     Uebersichtsfrage? → Direkt aus Metadaten antworten│
│     Inhaltsfrage?     → An kb-reader delegieren       │
└───────────────────────┬───────────────────────────────┘
                        │ delegate_to_agent("kb-reader",
                        │   context: "document_path: ...")
                        ▼
┌─ KB-Reader Agent ────────────────────────────────────┐
│                                                       │
│  1. kb_search(level='meta') → DOCUMENT_META.md lesen  │
│  2. Bei grossen Docs: kb_search(level='index')        │
│     → INDEX.md lesen, relevante Kapitel identifizieren│
│  3. kb_search(level='content') → content.md lesen     │
│  4. Antwort mit Zitaten und Quellen-Angabe zurueck    │
│                                                       │
│  Antwortformat:                                       │
│  STATUS: FOUND | NOT_RELEVANT | PARTIAL               │
│  CONFIDENCE: HIGH | MEDIUM | LOW                      │
│  SOURCE: Richtlinie sichere Entwicklung (Kap. 4.2)   │
│  ANSWER: Bei Code Reviews gelten folgende Vorgaben... │
│  QUOTES: "Jeder Merge Request muss von mindestens..." │
└───────────────────────────────────────────────────────┘
         │
         ▼
Knowledge Agent: Synthese + Quellenangabe → User
```

---

## Vergleich mit Vektor-DB RAG

| Aspekt | Vektor-DB RAG | Dieses System |
|--------|--------------|---------------|
| **Retrieval** | Embedding-Similarity auf Chunks | LLM liest Metadaten, entscheidet per Intent |
| **Routing** | Flat (alle Chunks gleichwertig) | Hierarchisch: Collection → Dokument → Abschnitt |
| **Kontext** | Chunk-Fenster (oft 512-2048 Token) | Ganzes Dokument verfuegbar, INDEX.md fuer Navigation |
| **Metadaten** | Optional, oft manuell | Automatisch LLM-generiert (Typ, Keywords, Fragen) |
| **Infrastruktur** | Vektor-DB (Pinecone, Weaviate, pgvector, ...) | Filesystem (Markdown-Dateien) |
| **Transparenz** | Schwer nachvollziehbar welcher Chunk gewaehlt wurde | Jede Ebene inspizierbar (YAML, Markdown) |
| **Quellenangabe** | Chunk → Dokument (oft ungenau) | Dokument + Kapitel + Zitat |
| **Updates** | Re-Embedding noetig | Datei ersetzen, Meta neu generieren |
| **Kosten** | Embedding-API + DB-Hosting | LLM-Calls beim Retrieval (kein Embedding) |

### Staerken dieses Ansatzes

- Vollstaendig inspizierbar und debugbar (alles Klartext)
- Keine Infrastruktur-Abhaengigkeit (kein DB-Server)
- Hierarchisches Routing reduziert False Positives
- LLM versteht Kontext besser als Cosine-Similarity
- INDEX.md ermoeglicht gezielte Navigation in grossen Dokumenten

### Schwaechen

- Skalierung: Bei sehr vielen Dokumenten (>1000) wird das Manifest-Lesen teurer
- Latenz: Mehrere sequenzielle LLM-Calls statt einem Vektor-Lookup
- Kein Fuzzy-Match: Funktioniert schlechter bei vagen Anfragen ohne klaren Intent

---

## Tool-Interface

Ein einziges Tool `kb_search` mit 5 Lese-Ebenen:

| Level | Liest | Zweck |
|-------|-------|-------|
| `collections` | `collections.yaml` | Welche Wissensgebiete gibt es? |
| `manifest` | `manifest.yaml` | Welche Dokumente in einer Collection? |
| `meta` | `DOCUMENT_META.md` | Was steht im Dokument? (Zusammenfassung) |
| `content` | `content.md` | Volltext des konvertierten Dokuments |
| `index` | `INDEX.md` | Kapitelstruktur (bei grossen Docs) |

---

Das System ist bewusst auf **Nachvollziehbarkeit** und **Einfachheit** ausgelegt. Alles was das LLM sieht, kann ein Mensch in denselben Dateien nachlesen. Es gibt keinen "Black Box"-Schritt wie bei Embedding + Vektor-Similarity.
