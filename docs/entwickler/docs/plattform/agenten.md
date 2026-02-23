# Agent-System

Agenten sind konfigurierbare KI-Persoenlichkeiten mit eigenen Tools, Faehigkeiten und System-Prompts. Der Supervisor-Agent orchestriert Aufgaben und delegiert an spezialisierte Agenten.

## Konzept

- **Agenten** definieren WAS ein LLM kann (Tools, Capabilities, Modell)
- **Skills** definieren WIE eine Aufgabe bearbeitet wird (Methodik, Workflow)
- Der **Supervisor** ist der Standard-Agent, der Anfragen entgegennimmt und bei Bedarf an spezialisierte Agenten delegiert

## Agent-Konfiguration

Agenten werden als Markdown-Dateien mit YAML-Frontmatter in `data/agents/<agent-id>/config.md` gespeichert:

```markdown
---
id: research-agent
name: Research Agent
description: Spezialisiert auf Recherche und Analyse
capabilities:
  - Web-Recherche
  - Quellenanalyse
tools:
  - web_search
  - file_read
  - file_write
  - kb_search
delegatable: true
system: false
model:
  provider_id: adacor
  model_id: gpt-4o
  locked: false
  inherit: true
skillMode: all
---

Du bist ein spezialisierter Research Agent.
Deine Aufgabe ist es, gruendlich zu recherchieren und Quellen zu analysieren.

## Verhaltensregeln
1. Immer Quellen angeben
2. Fakten verifizieren
3. Strukturierte Zusammenfassungen liefern
```

### AgentConfig Interface

```typescript
interface AgentConfig {
  id: string;                    // Eindeutiger Bezeichner (a-z, 0-9, -, _)
  name: string;                  // Anzeigename
  description: string;           // Kurzbeschreibung
  capabilities: string[];        // Faehigkeiten (Freitext)
  tools: string[];               // Tool-Namen aus der Registry
  delegatable: boolean;          // Kann von anderen Agenten aufgerufen werden
  internal: boolean;             // Nicht in der UI sichtbar
  system: boolean;               // Vorinstalliert, nicht editierbar
  systemPrompt: string;          // System-Prompt (Markdown-Body)
  model?: AgentModelConfig;      // Modell-Konfiguration
  skills?: string[];             // Erlaubte Skill-IDs (bei skillMode: 'allow')
  skillMode?: 'all' | 'allow';  // Skill-Zugriffsmodus
}
```

## Modell-Resolution

Die Modell-Auswahl folgt einer Hierarchie:

```
1. agent.model.locked = true oder inherit = false
   -> Agent-eigenes Modell verwenden

2. System-Agent (supervisor, vision, code, research)
   -> ENV-Konfiguration pruefen (z.B. VISION_AGENT_MODEL)

3. agent.model.inherit = true oder kein Modell konfiguriert
   -> Session-Override -> User-Praeferenz -> System-Default

4. User-erstellte Agenten
   -> Immer locked: true (vom System erzwungen)
```

### AgentModelConfig

```typescript
interface AgentModelConfig {
  provider_id?: string;    // Provider-ID
  model_id?: string;       // Modell-ID
  locked?: boolean;        // Kann nicht ueberschrieben werden
  inherit?: boolean;       // Erbt von User-Praeferenz/System-Default
}
```

## Agent-Typen

### System-Agenten

Vorinstalliert, nicht editierbar. Immer fuer alle User sichtbar.

| Agent | Zweck |
|-------|-------|
| `supervisor` | Orchestrierung, delegiert an spezialisierte Agenten |
| `general` | Allgemeiner Assistent |
| `vision-agent` | Bildanalyse |
| `code-agent` | Code-Generierung und -Analyse |
| `research-agent` | Recherche und Analyse |
| `_router` | Internes Routing (nicht in UI sichtbar) |

### User-Agenten

Von Benutzern erstellt, mit RBAC (Owner/Editor/Viewer). Modell ist immer `locked: true`.

### Connection-Agenten

Dynamisch generiert aus registrierten Connector-Plugins. Haben automatisch die Tools des jeweiligen Connectors und einen generierten System-Prompt.

## Delegation

Der Supervisor kann Aufgaben an spezialisierte Agenten delegieren:

```
Supervisor
  -> delegate_to_agent(agent_id: "research-agent", task: "Recherchiere...")
  -> Neuer Agent-Loop:
     - Eigene Session
     - Eigenes Modell (laut Model-Resolution)
     - Eigene Tools (laut Agent-Config)
     - Max 5 Iterationen
  -> Ergebnis zurueck an Supervisor
```

- **MAX_DELEGATION_DEPTH = 2** — Agenten koennen sub-delegieren, aber max. 2 Ebenen tief
- **MAX_ITERATIONS = 5** — Normale Agenten (15 fuer Supervisor)
- Delegierte Agenten erben **nicht** das Modell des Eltern-Agenten

## RBAC

### System-Agenten
- Immer sichtbar fuer alle User
- Koennen nicht bearbeitet oder geloescht werden

### User-Agenten
- Creator wird automatisch Owner
- Rollen: `owner`, `editor`, `viewer`
- Owner kann Zugriff verwalten

## Skill-Zugriff

Agenten koennen Skills ueber `load_skill` laden. Der Zugriff wird ueber `skillMode` gesteuert:

| skillMode | Verhalten |
|-----------|----------|
| `all` (Default) | Agent kann alle verfuegbaren Skills laden |
| `allow` | Agent kann nur Skills aus der `skills`-Liste laden |

## REST API

| Endpoint | Methode | Auth | Beschreibung |
|----------|---------|------|-------------|
| `/api/agents` | GET | User | Alle sichtbaren Agenten |
| `/api/agents/:id` | GET | User | Agent-Details |
| `/api/agents/:id/full` | GET | User | Agent inkl. System-Prompt |
| `/api/agents` | POST | User | Agent erstellen |
| `/api/agents/:id` | PUT | Editor | Agent aktualisieren |
| `/api/agents/:id` | DELETE | Owner | Agent loeschen |
