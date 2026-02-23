# Skill-System

Skills sind Wissensressourcen, die Agenten bei Bedarf laden koennen. Sie definieren Arbeitsmethoden, Workflows und stellen optional zusaetzliche Tools bereit.

**Agent = WAS** (Tools, Capabilities, Modell)
**Skill = WIE** (Arbeitsanweisungen, Methodik, Workflow)

## Skill-Format

Skills werden als `SKILL.md` Dateien mit YAML-Frontmatter in `data/skills/<skill-id>/` gespeichert:

```markdown
---
id: research-skill
name: Systematische Recherche
version: "1.0"
description: "Strukturierte Recherche mit Quellenanalyse"

metadata:
  use_when: |
    - User fragt nach umfassender Recherche
    - Komplexes Thema mit mehreren Aspekten
    - Quellenbasierte Analyse erforderlich
  estimated_effort: "5-15 Minuten"
  output_type: "Strukturierter Bericht"

allowed_tools:
  - web_search
  - kb_search

knowledge:
  files:
    - methodik.md
    - qualitaetskriterien.md
  collections:
    - compliance/dsgvo

parameters:
  - name: tiefe
    type: enum
    description: "Recherchetiefe"
    options: ["schnell", "standard", "ausfuehrlich"]
    default: "standard"

workflow:
  steps:
    - id: research
      action: tool
      tool: web_search
      description: "Initiale Recherche durchfuehren"
    - id: analyze
      action: think
      description: "Ergebnisse analysieren und bewerten"
    - id: report
      action: respond
      description: "Strukturierten Bericht erstellen"

output:
  format: markdown
  markAsMaterial: true
  materialTitle: "Recherche-Ergebnis"
---

## Arbeitsanweisung

Du fuehrst eine systematische Recherche durch.

### Vorgehen
1. Thema eingrenzen und Suchbegriffe definieren
2. Mehrere Quellen konsultieren
3. Informationen abgleichen und verifizieren
4. Strukturierte Zusammenfassung erstellen

### Qualitaetskriterien
- Mindestens 3 unabhaengige Quellen
- Quellenangaben bei jeder Aussage
- Widersprueche explizit benennen
```

## EnhancedSkill Interface

```typescript
interface EnhancedSkill {
  id: string;                      // Eindeutiger Bezeichner
  name: string;                    // Anzeigename
  version: string;                 // Version
  description: string;             // Beschreibung

  metadata?: SkillMetadata;        // Entscheidungshilfe fuer Agenten
  allowed_tools?: string[];        // Tools die der Skill hinzufuegt
  knowledge?: SkillKnowledge;      // Wissensreferenzen
  triggers: SkillTriggers;         // Trigger (DEPRECATED)
  tools: SkillTools;               // Tool-Requirements (DEPRECATED)
  instructions: string;            // Arbeitsanweisungen (Markdown-Body)
  workflow?: SkillWorkflow;        // Workflow-Definition
  output?: SkillOutput;            // Ausgabe-Konfiguration
  parameters?: SkillParameter[];   // User-Parameter
  constraints?: SkillConstraints;  // Einschraenkungen
  enabled?: boolean;               // Aktiviert?
  system?: boolean;                // System-Skill (nicht editierbar)
}
```

## Skill-Metadaten

Die `metadata` wird Agenten im System-Prompt angezeigt, damit sie entscheiden koennen, wann ein Skill geladen werden soll:

```typescript
interface SkillMetadata {
  use_when?: string;           // Wann diesen Skill nutzen
  estimated_effort?: string;   // Geschaetzter Aufwand
  output_type?: string;        // Art der Ausgabe
}
```

## Knowledge-Referenzen

Skills koennen auf externe Wissensquellen verweisen:

```typescript
interface SkillKnowledge {
  files?: string[];              // Dateien relativ zum Skill-Ordner
  collections?: string[];        // Knowledge-Base Collection-IDs
  inject_manifests?: boolean;    // Collection-Manifeste injizieren
}
```

- **files**: Werden deterministisch geladen wenn der Skill aktiviert wird
- **collections**: Agent nutzt `kb_search` fuer semantische Suche in diesen Sammlungen

## Workflow-System

Workflows definieren eine geordnete Abfolge von Schritten:

```typescript
interface SkillWorkflow {
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;                          // Schritt-ID
  action: 'tool' | 'think' | 'respond' | 'delegate';  // Aktionstyp
  tool?: string;                       // Tool-Name (bei action: 'tool')
  description: string;                 // Was dieser Schritt tut
  condition?: string;                  // Bedingung (natuerliche Sprache)
  repeat?: string;                     // Wiederholungsmuster (z.B. "2-3")
  queryTemplate?: string;              // Query-Template fuer Such-Tools
}
```

### Aktionstypen

| Aktion | Beschreibung |
|--------|-------------|
| `tool` | Ein bestimmtes Tool ausfuehren |
| `think` | Analysieren/Nachdenken (kein Tool-Call) |
| `respond` | Antwort an den User generieren |
| `delegate` | An einen anderen Agenten delegieren |

### Workflow-Fortschritt

Der Workflow-State wird waehrend der Agent-Loop-Ausfuehrung verfolgt:

```typescript
interface WorkflowState {
  skillId: string;
  currentStepIndex: number;
  completedSteps: number[];
  startedAt: number;
}
```

Workflow-Schritte werden automatisch vorgerueckt, wenn ein Tool-Call dem aktuellen Schritt entspricht.

## Skill-Loading

### Agent-gesteuertes Laden (Empfohlen)

Agenten sehen verfuegbare Skills in ihrem System-Prompt und entscheiden selbst, wann sie einen Skill laden:

```
System-Prompt:
  "Verfuegbare Skills:
   - research-skill (Systematische Recherche): ...
   - analysis-skill (Datenanalyse): ...
   Nutze load_skill um einen Skill zu aktivieren."

Agent -> load_skill(skill_id: "research-skill")
  -> Skill-Instruktionen in Context laden
  -> allowed_tools temporaer hinzufuegen
  -> Knowledge-Dateien laden
```

### Automatisches Matching

Skills koennen auch automatisch basierend auf der User-Nachricht gematcht werden (ueber Keywords, Patterns oder Intent).

### Explizite Aktivierung

Per `/skill-id`-Befehl in der Chat-Eingabe.

## Skill-Aktivierung

Wenn ein Skill geladen wird:

1. **Instruktionen** werden in den System-Prompt injiziert
2. **allowed_tools** werden temporaer zur Agent-Tool-Liste hinzugefuegt
3. **Knowledge files** werden geladen und in den Kontext eingefuegt
4. **Workflow** wird initialisiert (falls vorhanden)

```typescript
interface SkillLoadResult {
  success: boolean;
  skill?: { id: string; name: string };
  instructions?: string;           // Formatierte Anweisungen
  addedTools?: string[];           // Temporaer hinzugefuegte Tools
  loadedFiles?: string[];          // Geladene Knowledge-Dateien
  error?: string;
}
```

## Ausgabe-Konfiguration

```typescript
interface SkillOutput {
  format: 'markdown' | 'json' | 'text';
  template?: string;              // Mustache-Template
  markAsMaterial?: boolean;       // Als Material in der Chat-Sidebar
  materialTitle?: string;         // Titel fuer das Material
}
```

## Parameter

Skills koennen benutzerdefinierte Parameter definieren:

```typescript
interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  description?: string;
  default?: string | number | boolean;
  options?: string[];     // Fuer enum-Typ
  required?: boolean;
}
```

## Agent-Skill-Zugriff

Der Zugriff wird ueber die Agent-Konfiguration gesteuert:

| `skillMode` | Verhalten |
|-------------|----------|
| `all` (Default) | Agent kann alle verfuegbaren Skills laden |
| `allow` | Agent kann nur Skills aus `skills`-Liste laden |

```yaml
# Agent config.md Frontmatter:
skillMode: allow
skills:
  - research-skill
  - analysis-skill
```
