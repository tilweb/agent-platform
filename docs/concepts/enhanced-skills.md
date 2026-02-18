# Enhanced Skills Konzept

## Übersicht

Erweiterung des Skill-Systems um:
- **Tool-Integration** - Skills können Tools mitbringen und nutzen
- **Workflows** - Mehrstufige Abläufe mit definierten Schritten
- **Kontext-Aktionen** - Skills können aktiv Informationen sammeln
- **Ausgabe-Formate** - Strukturierte Antworten

---

## Aktueller Stand vs. Erweiterung

```
AKTUELL:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Keyword   │ ──► │   Prompt    │ ──► │   Antwort   │
│   Match     │     │   Inject    │     │   (Text)    │
└─────────────┘     └─────────────┘     └─────────────┘

ERWEITERT:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Trigger    │ ──► │   Skill     │ ──► │  Workflow   │ ──► │  Struktur.  │
│  (semantic) │     │  aktiviert  │     │  + Tools    │     │  Ausgabe    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## Skill-Definition (YAML Format)

### Beispiel 1: Code Review Skill

```yaml
# data/skills/public/code-review/SKILL.yaml
id: code-review
name: "Code Review"
version: "1.0"
description: "Führt strukturierte Code Reviews durch"

# Aktivierung
triggers:
  keywords:
    - "review"
    - "prüfe den code"
    - "code check"
  patterns:
    - "review(e)? (die |den |das )?.*\\.(ts|js|py|go)"
  intent: "code_review"  # Optional: LLM-basierte Intent-Erkennung

# Benötigte Tools
tools:
  required:
    - file_read
  optional:
    - file_list
    - brave-search  # Für Best Practices Recherche

# Anweisungen für das LLM
instructions: |
  Du führst ein professionelles Code Review durch.

  ## Prüfkriterien
  1. **Korrektheit** - Funktioniert der Code wie beabsichtigt?
  2. **Lesbarkeit** - Ist der Code verständlich?
  3. **Wartbarkeit** - Ist der Code gut strukturiert?
  4. **Sicherheit** - Gibt es Sicherheitsprobleme?
  5. **Performance** - Gibt es offensichtliche Performance-Issues?

# Workflow (optional)
workflow:
  steps:
    - id: read_file
      action: tool
      tool: file_read
      description: "Lies die zu prüfende Datei"

    - id: analyze
      action: think
      description: "Analysiere den Code nach den Prüfkriterien"

    - id: research
      action: tool
      tool: brave-search
      condition: "wenn Best Practices unklar"
      query_template: "{{language}} best practices {{topic}}"

    - id: respond
      action: respond
      format: structured

# Ausgabeformat
output:
  format: markdown
  template: |
    ## Code Review: {{filename}}

    ### Zusammenfassung
    {{summary}}

    ### Findings
    {{#findings}}
    - **{{severity}}**: {{description}} (Zeile {{line}})
    {{/findings}}

    ### Empfehlungen
    {{recommendations}}

# Einschränkungen
constraints:
  max_file_size: 50000  # Zeichen
  allowed_extensions: [".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".rs"]
```

### Beispiel 2: Recherche Skill

```yaml
id: deep-research
name: "Tiefenrecherche"
version: "1.0"
description: "Führt umfassende Recherchen mit mehreren Quellen durch"

triggers:
  keywords:
    - "recherchiere"
    - "finde heraus"
    - "was weißt du über"
  intent: "research"

tools:
  required:
    - brave-search
  optional:
    - file_write  # Für Recherche-Notizen

instructions: |
  Du bist ein gründlicher Recherche-Assistent.

  ## Vorgehen
  1. Verstehe die Fragestellung genau
  2. Führe mehrere Suchanfragen durch (verschiedene Perspektiven)
  3. Verifiziere Informationen durch mehrere Quellen
  4. Fasse strukturiert zusammen

workflow:
  steps:
    - id: clarify
      action: think
      description: "Verstehe die Recherchefrage und plane Suchbegriffe"

    - id: search_primary
      action: tool
      tool: brave-search
      repeat: 2-3
      description: "Hauptrecherche mit verschiedenen Suchbegriffen"

    - id: search_verify
      action: tool
      tool: brave-search
      condition: "wenn Fakten verifiziert werden müssen"

    - id: synthesize
      action: respond
      description: "Fasse Erkenntnisse zusammen"

output:
  format: markdown
  template: |
    ## Recherche: {{topic}}

    ### Kernerkenntnisse
    {{findings}}

    ### Quellen
    {{#sources}}
    - [{{title}}]({{url}})
    {{/sources}}

    ### Offene Fragen
    {{open_questions}}
```

### Beispiel 3: E-Mail Skill (ohne Tools)

```yaml
id: email-writer
name: "E-Mail Assistent"
version: "1.0"
description: "Verfasst professionelle E-Mails"

triggers:
  keywords:
    - "schreibe eine email"
    - "e-mail an"
    - "mail verfassen"

tools: []  # Keine Tools nötig

instructions: |
  Du verfasst professionelle E-Mails.

  ## Stil-Richtlinien
  - Professionell aber freundlich
  - Klare Struktur (Anrede, Einleitung, Hauptteil, Schluss)
  - Angemessene Länge

parameters:
  - name: tone
    type: enum
    options: [formal, neutral, freundlich]
    default: neutral
  - name: language
    type: enum
    options: [de, en]
    default: de

output:
  format: text
  template: |
    **Betreff:** {{subject}}

    ---

    {{email_body}}
```

---

## Architektur

### Dateistruktur

```
data/skills/
├── public/
│   ├── code-review/
│   │   ├── SKILL.yaml      # Skill-Definition
│   │   └── examples/       # Optional: Beispiele
│   │       └── review-example.md
│   ├── deep-research/
│   │   └── SKILL.yaml
│   └── email-writer/
│       └── SKILL.yaml
└── _system/                # System-Skills (nicht editierbar)
    └── routing/
        └── SKILL.yaml
```

### Backend-Komponenten

```
backend/src/
├── skills/
│   ├── types.ts           # Skill-Interfaces
│   ├── loader.ts          # YAML-Parsing, Validierung
│   ├── matcher.ts         # Trigger-Matching (Keywords, Patterns, Intent)
│   ├── executor.ts        # Workflow-Ausführung
│   └── index.ts
```

### Skill-Typen

```typescript
// skills/types.ts

interface Skill {
  id: string;
  name: string;
  version: string;
  description: string;

  triggers: SkillTriggers;
  tools: SkillTools;
  instructions: string;
  workflow?: SkillWorkflow;
  output?: SkillOutput;
  parameters?: SkillParameter[];
  constraints?: SkillConstraints;
}

interface SkillTriggers {
  keywords?: string[];
  patterns?: string[];      // Regex patterns
  intent?: string;          // LLM-basierte Intent-Erkennung
  explicit?: boolean;       // Nur bei expliziter Nennung (/skill-name)
}

interface SkillTools {
  required?: string[];      // Müssen verfügbar sein
  optional?: string[];      // Werden genutzt wenn verfügbar
}

interface SkillWorkflow {
  steps: WorkflowStep[];
}

interface WorkflowStep {
  id: string;
  action: 'tool' | 'think' | 'respond' | 'delegate';
  tool?: string;
  description: string;
  condition?: string;
  repeat?: string;          // z.B. "2-3" für 2-3 Wiederholungen
}

interface SkillOutput {
  format: 'markdown' | 'json' | 'text';
  template?: string;
}
```

---

## Ablauf bei Skill-Aktivierung

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Message                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     1. SKILL MATCHING                            │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │   Keywords    │  │    Regex      │  │    Intent     │       │
│  │    Match      │  │   Patterns    │  │   (LLM-opt)   │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   2. SKILL ACTIVATION                            │
│                                                                  │
│  • Prüfe required Tools (verfügbar?)                            │
│  • Lade Skill Instructions                                       │
│  • Bereite Workflow vor                                          │
│  • Filtere Agent-Tools auf Skill-Tools                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   3. WORKFLOW EXECUTION                          │
│                                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │  Step 1 │───►│  Step 2 │───►│  Step 3 │───►│  Step N │     │
│  │  (tool) │    │ (think) │    │  (tool) │    │(respond)│     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│                                                                  │
│  Agent Loop führt Steps aus, LLM entscheidet über Conditions    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. OUTPUT FORMATTING                          │
│                                                                  │
│  • Wende Output-Template an                                      │
│  • Strukturiere Antwort nach Format                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration mit Agent Loop

### Änderungen am Agent Loop

```typescript
// agents/loop.ts (erweitert)

async function* runAgentLoop(sessionId, userMessage, options) {
  // 1. Skill Matching
  const matchedSkill = await matchSkill(userMessage);

  if (matchedSkill) {
    yield { type: 'skill_activated', skillId: matchedSkill.id, skillName: matchedSkill.name };

    // 2. Prüfe Tool-Verfügbarkeit
    const missingTools = checkRequiredTools(matchedSkill.tools.required);
    if (missingTools.length > 0) {
      yield { type: 'skill_error', error: `Fehlende Tools: ${missingTools.join(', ')}` };
      // Fallback zu normalem Verhalten
    }

    // 3. Baue erweiterten System Prompt
    const systemPrompt = buildSkillPrompt(agent, matchedSkill);

    // 4. Filtere Tools auf Skill-relevante
    const availableTools = filterToolsForSkill(agentTools, matchedSkill);

    // 5. Führe aus (mit Workflow-Hints)
    // ...
  }
}
```

### System Prompt mit Skill

```typescript
function buildSkillPrompt(agent: AgentConfig, skill: Skill): string {
  return `${agent.systemPrompt}

# Aktiver Skill: ${skill.name}

${skill.instructions}

${skill.workflow ? formatWorkflowHints(skill.workflow) : ''}

${skill.output?.template ? `
## Ausgabeformat
Strukturiere deine Antwort nach folgendem Format:
${skill.output.template}
` : ''}`;
}
```

---

## UI-Erweiterungen

### Skills-Verwaltung (SkillsPage.jsx)

```
┌─────────────────────────────────────────────────────────────────┐
│  Skills                                           [+ Neuer Skill]│
├─────────────────────────────────────────────────────────────────┤
│  [Alle Skills] [Mit Tools] [Workflows]                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔍 Code Review                                    v1.0   │   │
│  │ Führt strukturierte Code Reviews durch                   │   │
│  │                                                          │   │
│  │ Triggers: review, prüfe den code, code check            │   │
│  │ Tools: file_read, file_list, brave-search               │   │
│  │ Workflow: 4 Steps                                        │   │
│  │                                                          │   │
│  │ [Aktiv ✓]                        [Bearbeiten] [Löschen] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔎 Tiefenrecherche                               v1.0   │   │
│  │ Führt umfassende Recherchen mit mehreren Quellen durch  │   │
│  │                                                          │   │
│  │ Triggers: recherchiere, finde heraus                    │   │
│  │ Tools: brave-search, file_write                         │   │
│  │ Workflow: 4 Steps                                        │   │
│  │                                                          │   │
│  │ [Aktiv ✓]                        [Bearbeiten] [Löschen] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Skill-Editor

```
┌─────────────────────────────────────────────────────────────────┐
│  Skill bearbeiten: Code Review                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Basis] [Triggers] [Tools] [Workflow] [Output]                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                  │
│  ┌─ Triggers ─────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │  Keywords:                                                  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ review  │ prüfe den code  │ code check  │  [+]      │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │  Regex Patterns:                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ review(e)? (die |den |das )?.*\.(ts|js|py)          │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │  □ Intent-basierte Aktivierung (LLM)                       │ │
│  │    Intent: [code_review                              ]     │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                                        [Abbrechen] [Speichern]  │
└─────────────────────────────────────────────────────────────────┘
```

### Chat-Integration

```
┌─────────────────────────────────────────────────────────────────┐
│  Chat                                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  You: Kannst du bitte die datei src/utils/helper.ts reviewen?   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ 🎯 Skill aktiviert: Code Review                            │ │
│  │    Tools: file_read                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Agent: [Liest Datei...]                                        │
│                                                                  │
│  ## Code Review: helper.ts                                      │
│                                                                  │
│  ### Zusammenfassung                                            │
│  Der Code ist gut strukturiert, aber es gibt einige...          │
│                                                                  │
│  ### Findings                                                   │
│  - **Warning**: Fehlende Fehlerbehandlung (Zeile 23)           │
│  - **Info**: Ungenutzte Variable `temp` (Zeile 45)             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration von bestehenden Skills

### Alte Struktur (Markdown)

```markdown
---
name: "Schreib-Assistent"
keywords: [schreibe, verfasse, text]
---

Du bist ein Schreib-Assistent...
```

### Neue Struktur (YAML) - Abwärtskompatibel

```yaml
id: schreib-assistent
name: "Schreib-Assistent"
version: "1.0"
description: "Hilft beim Verfassen von Texten"

triggers:
  keywords:
    - schreibe
    - verfasse
    - text

tools: []  # Keine Tools = wie bisher

instructions: |
  Du bist ein Schreib-Assistent...
```

**Migration-Strategie:**
1. Beide Formate werden unterstützt (SKILL.md und SKILL.yaml)
2. Markdown-Skills werden als "einfache Skills" ohne Tools behandelt
3. YAML-Skills haben volle Funktionalität

---

## Implementierungs-Phasen

### Phase 1: Basis-Infrastruktur
- [ ] YAML-Loader für Skills
- [ ] Erweitertes Trigger-Matching (Keywords + Regex)
- [ ] Tool-Verknüpfung in Skill-Definition
- [ ] Skill-Aktivierung im Agent Loop

### Phase 2: Workflow-Engine
- [ ] Workflow-Step-Definitionen
- [ ] Sequentielle Step-Ausführung
- [ ] Conditions für Steps
- [ ] Workflow-Status im Frontend

### Phase 3: UI-Erweiterungen
- [ ] Skill-Editor mit allen Feldern
- [ ] Trigger-Builder
- [ ] Tool-Auswahl
- [ ] Workflow-Designer (Drag & Drop)

### Phase 4: Erweiterte Features
- [ ] Intent-basiertes Matching (LLM)
- [ ] Output-Templates
- [ ] Skill-Versionierung
- [ ] Skill-Import/Export

---

## Offene Fragen

1. **Skill-Priorität**: Was passiert wenn mehrere Skills matchen?
   - Option A: Erster Match gewinnt
   - Option B: Spezifischster Match (mehr Keywords)
   - Option C: User wird gefragt

2. **Tool-Einschränkung**: Sollen Skills Tools des Agents einschränken können?
   - Ja: Agent hat nur Skill-Tools während Skill aktiv
   - Nein: Agent hat alle Tools + Skill-Hinweise

3. **Workflow-Flexibilität**: Wie strikt soll der Workflow sein?
   - Strikt: LLM muss Steps in Reihenfolge ausführen
   - Flexibel: Steps sind nur Hinweise/Empfehlungen

4. **Skill-Komposition**: Können Skills andere Skills aufrufen?
   - z.B. "Recherche-Skill" ruft "Zusammenfassungs-Skill" auf
