# Skill-System

Skills sind Wissensressourcen, die Agenten bei Bedarf laden können. Sie definieren Arbeitsmethoden, Workflows und stellen optional zusätzliche Tools bereit.

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
    options: ["schnell", "standard", "ausführlich"]
    default: "standard"

workflow:
  steps:
    - id: research
      action: tool
      tool: web_search
      description: "Initiale Recherche durchführen"
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

Du führst eine systematische Recherche durch.

### Vorgehen
1. Thema eingrenzen und Suchbegriffe definieren
2. Mehrere Quellen konsultieren
3. Informationen abgleichen und verifizieren
4. Strukturierte Zusammenfassung erstellen

### Qualitätskriterien
- Mindestens 3 unabhängige Quellen
- Quellenangaben bei jeder Aussage
- Widersprüche explizit benennen
```

## EnhancedSkill Interface

```typescript
interface EnhancedSkill {
  id: string;                      // Eindeutiger Bezeichner
  name: string;                    // Anzeigename
  version: string;                 // Version
  description: string;             // Beschreibung

  metadata?: SkillMetadata;        // Entscheidungshilfe für Agenten
  allowed_tools?: string[];        // Tools die der Skill hinzufügt
  knowledge?: SkillKnowledge;      // Wissensreferenzen
  triggers: SkillTriggers;         // Trigger (DEPRECATED)
  tools: SkillTools;               // Tool-Requirements (DEPRECATED)
  instructions: string;            // Arbeitsanweisungen (Markdown-Body)
  workflow?: SkillWorkflow;        // Workflow-Definition
  output?: SkillOutput;            // Ausgabe-Konfiguration
  parameters?: SkillParameter[];   // User-Parameter
  constraints?: SkillConstraints;  // Einschränkungen
  enabled?: boolean;               // Aktiviert?
  system?: boolean;                // System-Skill (nicht editierbar)
}
```

## Skill-Metadaten

Die `metadata` wird Agenten im System-Prompt angezeigt, damit sie entscheiden können, wann ein Skill geladen werden soll:

```typescript
interface SkillMetadata {
  use_when?: string;           // Wann diesen Skill nutzen
  estimated_effort?: string;   // Geschaetzter Aufwand
  output_type?: string;        // Art der Ausgabe
}
```

## Knowledge-Referenzen

Skills können auf externe Wissensquellen verweisen:

```typescript
interface SkillKnowledge {
  files?: string[];              // Dateien relativ zum Skill-Ordner
  collections?: string[];        // Knowledge-Base Collection-IDs
  inject_manifests?: boolean;    // Collection-Manifeste injizieren
}
```

- **files**: Werden deterministisch geladen wenn der Skill aktiviert wird
- **collections**: Agent nutzt `kb_search` für semantische Suche in diesen Sammlungen

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
  condition?: string;                  // Bedingung (natürliche Sprache)
  repeat?: string;                     // Wiederholungsmuster (z.B. "2-3")
  queryTemplate?: string;              // Query-Template für Such-Tools
}
```

### Aktionstypen

| Aktion | Beschreibung |
|--------|-------------|
| `tool` | Ein bestimmtes Tool ausführen |
| `think` | Analysieren/Nachdenken (kein Tool-Call) |
| `respond` | Antwort an den User generieren |
| `delegate` | An einen anderen Agenten delegieren |

### Workflow-Fortschritt

Der Workflow-State wird während der Agent-Loop-Ausführung verfolgt:

```typescript
interface WorkflowState {
  skillId: string;
  currentStepIndex: number;
  completedSteps: number[];
  startedAt: number;
}
```

Workflow-Schritte werden automatisch vorgerückt, wenn ein Tool-Call dem aktuellen Schritt entspricht.

## Skill-Loading

### Agent-gesteuertes Laden (Empfohlen)

Agenten sehen verfügbare Skills in ihrem System-Prompt und entscheiden selbst, wann sie einen Skill laden:

```
System-Prompt:
  "Verfügbare Skills:
   - research-skill (Systematische Recherche): ...
   - analysis-skill (Datenanalyse): ...
   Nutze load_skill um einen Skill zu aktivieren."

Agent -> load_skill(skill_id: "research-skill")
  -> Skill-Instruktionen in Context laden
  -> allowed_tools temporär hinzufügen
  -> Knowledge-Dateien laden
```

### Automatisches Matching

Skills können auch automatisch basierend auf der User-Nachricht gematcht werden (über Keywords, Patterns oder Intent).

### Explizite Aktivierung

Per `/skill-id`-Befehl in der Chat-Eingabe.

## Skill-Aktivierung

Wenn ein Skill geladen wird:

1. **Instruktionen** werden in den System-Prompt injiziert
2. **allowed_tools** werden temporär zur Agent-Tool-Liste hinzugefügt
3. **Knowledge files** werden geladen und in den Kontext eingefuegt
4. **Workflow** wird initialisiert (falls vorhanden)

```typescript
interface SkillLoadResult {
  success: boolean;
  skill?: { id: string; name: string };
  instructions?: string;           // Formatierte Anweisungen
  addedTools?: string[];           // Temporär hinzugefügte Tools
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
  materialTitle?: string;         // Titel für das Material
}
```

## Parameter

Skills können benutzerdefinierte Parameter definieren:

```typescript
interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  description?: string;
  default?: string | number | boolean;
  options?: string[];     // Für enum-Typ
  required?: boolean;
}
```

## Agent-Skill-Zugriff

Der Zugriff wird über die Agent-Konfiguration gesteuert:

| `skillMode` | Verhalten |
|-------------|----------|
| `all` (Default) | Agent kann alle verfügbaren Skills laden |
| `allow` | Agent kann nur Skills aus `skills`-Liste laden |

```yaml
# Agent config.md Frontmatter:
skillMode: allow
skills:
  - research-skill
  - analysis-skill
```
