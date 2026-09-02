import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import {
  getCustomAgentRecord,
  listCustomAgentRecords,
  saveCustomAgentRecord,
  deleteCustomAgentRecord,
} from './agentDbStorage';
import type { Message } from './llm';

// Lazy import to avoid circular dependencies
let _connectionRegistry: typeof import('../connections/registry').connectionRegistry | null = null;

async function getConnectionRegistry() {
  if (!_connectionRegistry) {
    const module = await import('../connections/registry');
    _connectionRegistry = module.connectionRegistry;
  }
  return _connectionRegistry;
}

const AGENTS_DIR = resolve(process.cwd(), '../data/agents');

/**
 * System-Agent-IDs: bleiben File-basiert unter data/agents/<id>/, weil
 * code-versioniert und in jedem Build identisch. Alles andere geht in
 * die DB (siehe agentDbStorage.ts).
 *
 * Wenn neue System-Agenten ins Code-Seed kommen, hier ergaenzen.
 */
const SYSTEM_AGENT_IDS = new Set([
  '_router',
  'supervisor',
  'general',
  'chat-document-reader',
  'kb-indexer',
  'kb-reader',
  'knowledge',
  'image-generator',
  'vision-analyzer',
  'researcher',
  'writer',
  // Echo-Loop (EMMA) — version-controlled in data/agents/, fresh-from-disk laden
  // (NICHT in die DB migrieren, sonst schatten stale DB-Kopien spätere config.md-Edits).
  'echo-loop-bauberater',
  'echo-loop-reengineering',
  'echo-loop-reifegrad-auditor',
  'echo-loop-quality-gate',
]);

export function isSystemAgentId(id: string): boolean {
  return SYSTEM_AGENT_IDS.has(id);
}

/**
 * Agent Model Configuration
 * Defines which model an agent should use
 */
export interface AgentModelConfig {
  /** Provider ID for the model */
  provider_id?: string;
  /** Model ID */
  model_id?: string;
  /**
   * Whether the model is locked (cannot be overridden by user preferences)
   * User-created agents always have locked: true
   */
  locked?: boolean;
  /**
   * Whether to inherit model from user preference/system default
   * If false or if provider_id/model_id are set, uses the specified model
   * Default: true for system agents (supervisor, general), false for specialized agents
   */
  inherit?: boolean;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
  delegatable: boolean;
  internal: boolean;
  system: boolean;  // true = vorinstalliert, nicht editierbar
  systemPrompt: string;
  /** Whether the agent is active (default: true). Inactive agents are hidden from chat and delegation. */
  active?: boolean;
  /** Model configuration for this agent */
  model?: AgentModelConfig;
  /** List of skill IDs this agent can use (when skillMode is 'allow') */
  skills?: string[];
  /**
   * Skill access mode:
   * - 'all' (default): Agent can use ALL available skills
   * - 'allow': Agent can ONLY use skills listed in `skills` array
   * - 'none': Agent cannot use any skills
   */
  skillMode?: 'all' | 'allow' | 'none';
  /** Maximum iterations for this agent (overrides default in delegation loop) */
  maxIterations?: number;
  /** Avatar-Icon-ID aus dem festen Icon-Katalog (Frontend). */
  icon?: string;
  /** Avatar-Farbe als Hex (z.B. "#8b5cf6") aus der festen Palette (Frontend). */
  color?: string;
  /** Zugeordnete Knowledge-Base-Collection-IDs (analog `skills`). Der Agent
   *  bekommt diese Collections + Dokumentliste in den Kontext injiziert. */
  collections?: string[];
  /** Vom Nutzer gepflegte Prompt-Vorschläge (Titel + Prompt), Reihenfolge wie
   *  im Editor. Serialisiert als Inline-JSON (siehe generateAgentMarkdown), da
   *  der einfache Frontmatter-Parser keine Objekt-Listen/mehrzeiligen Werte kann. */
  promptSuggestions?: Array<{ title: string; prompt: string }>;
  /**
   * Tombstone-Marker: gesetzt wenn ein File-basierter Agent geloescht wurde.
   * Ueberstimmt das File-Seed im DB-Override-Mechanismus und wird in beiden
   * List-Funktionen gefiltert (listAgents UND listAllAgentsIncludingInactive).
   * Unterscheidet sich von `active=false` (= deaktiviert, sichtbar in Admin).
   */
  tombstone?: boolean;
}

interface AgentFrontmatter {
  tombstone?: boolean;
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
  tools?: string[];
  delegatable?: boolean;
  active?: boolean;
  internal?: boolean;
  system?: boolean;
  /** Model configuration */
  model?: {
    provider_id?: string;
    model_id?: string;
    locked?: boolean;
    inherit?: boolean;
  };
  /** Skill IDs this agent can use */
  skills?: string[];
  /** Skill access mode: 'all' (default), 'allow', or 'none' */
  skillMode?: 'all' | 'allow' | 'none';
  /** Maximum iterations for this agent */
  maxIterations?: number;
  /** Avatar-Icon-ID + Farbe (hex) */
  icon?: string;
  color?: string;
  /** Zugeordnete KB-Collection-IDs */
  collections?: string[];
  /** Prompt-Vorschläge als Inline-JSON-String (Objekt-Wrapper `{"items":[...]}`). */
  promptSuggestions?: string;
}

/**
 * Parse YAML frontmatter from markdown content
 * Supports: strings, booleans, arrays, and nested objects (one level)
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match || !match[1] || !match[2]) {
    return { frontmatter: {}, body: content };
  }

  const yamlContent = match[1];
  const body = match[2].trim();

  // Simple YAML parser for our use case
  const frontmatter: Record<string, any> = {};
  const lines = yamlContent.split('\n');
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;
  let currentObject: Record<string, any> | null = null;
  let inNestedObject = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check indentation for nested object
    const indent = line.length - line.trimStart().length;

    // Check for array item
    if (trimmed.startsWith('- ') && currentKey && currentArray !== null) {
      const item = trimmed.slice(2).trim();
      console.log(`[parseFrontmatter] Adding array item to '${currentKey}': '${item}'`);
      currentArray.push(item);
      continue;
    }

    // Check for nested object property (indented with 2+ spaces)
    if (indent >= 2 && inNestedObject && currentKey && currentObject !== null) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const nestedKey = trimmed.slice(0, colonIndex).trim();
        const nestedValue = trimmed.slice(colonIndex + 1).trim();

        if (nestedValue === 'true') {
          currentObject[nestedKey] = true;
        } else if (nestedValue === 'false') {
          currentObject[nestedKey] = false;
        } else if (nestedValue !== '') {
          currentObject[nestedKey] = nestedValue;
        }
        continue;
      }
    }

    // Check for key-value pair
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      // Save previous array/object if exists (prefer array over empty object)
      if (currentKey && currentArray !== null && currentArray.length > 0) {
        frontmatter[currentKey] = currentArray;
      } else if (currentKey && currentObject !== null && Object.keys(currentObject).length > 0) {
        frontmatter[currentKey] = currentObject;
      }

      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (value === '') {
        // Could be start of array or nested object
        // We'll determine based on the next line
        currentKey = key;
        currentArray = [];
        currentObject = {};
        inNestedObject = true;
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array
        const items = value.slice(1, -1).split(',').map(s => s.trim());
        frontmatter[key] = items;
        currentKey = null;
        currentArray = null;
        currentObject = null;
        inNestedObject = false;
      } else if (value === 'true') {
        frontmatter[key] = true;
        currentKey = null;
        currentArray = null;
        currentObject = null;
        inNestedObject = false;
      } else if (value === 'false') {
        frontmatter[key] = false;
        currentKey = null;
        currentArray = null;
        currentObject = null;
        inNestedObject = false;
      } else if (/^\d+$/.test(value)) {
        frontmatter[key] = parseInt(value, 10);
        currentKey = null;
        currentArray = null;
        currentObject = null;
        inNestedObject = false;
      } else {
        frontmatter[key] = value;
        currentKey = null;
        currentArray = null;
        currentObject = null;
        inNestedObject = false;
      }
    }
  }

  // Save last array/object if exists
  if (currentKey && currentArray !== null && currentArray.length > 0) {
    frontmatter[currentKey] = currentArray;
  } else if (currentKey && currentObject !== null && Object.keys(currentObject).length > 0) {
    frontmatter[currentKey] = currentObject;
  }

  // Debug: Log parsed frontmatter
  console.log('[parseFrontmatter] Parsed:', JSON.stringify(frontmatter, null, 2));

  return { frontmatter, body };
}

/**
 * Prompt-Vorschläge aus dem Inline-JSON-Frontmatter-Feld lesen. Erwartet den
 * Objekt-Wrapper `{"items":[{title,prompt},...]}` (oder — tolerant — direkt ein
 * Array). Ungültige/leere Werte → undefined.
 */
function parsePromptSuggestions(raw: unknown): Array<{ title: string; prompt: string }> | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray((parsed as any).items) ? (parsed as any).items : []);
    const clean = items
      .filter((s: any) => s && typeof s.title === 'string' && typeof s.prompt === 'string')
      .map((s: any) => ({ title: s.title, prompt: s.prompt }));
    return clean.length > 0 ? clean : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Helper: Markdown-String → AgentConfig
 */
function parseAgentMarkdown(agentId: string, content: string): AgentConfig {
  const { frontmatter, body } = parseFrontmatter(content);
  const fm = frontmatter as AgentFrontmatter;
  return {
    id: fm.id || agentId,
    name: fm.name || agentId,
    description: fm.description || '',
    capabilities: fm.capabilities || [],
    tools: fm.tools || ['file_read', 'file_list'],
    delegatable: fm.delegatable !== false,
    active: fm.active !== false,
    internal: fm.internal === true,
    system: fm.system === true,
    systemPrompt: body,
    model: fm.model,
    skills: fm.skills,
    skillMode: fm.skillMode,
    maxIterations: typeof fm.maxIterations === 'number' ? fm.maxIterations : undefined,
    icon: fm.icon || undefined,
    color: fm.color || undefined,
    collections: Array.isArray(fm.collections) ? fm.collections : undefined,
    promptSuggestions: parsePromptSuggestions(fm.promptSuggestions),
    tombstone: fm.tombstone === true,
  };
}

/**
 * Load a single agent. Reihenfolge:
 *   1. Connection-Agent (auto-generiert aus Provider)
 *   2. Custom-Agent aus DB (instanz-spezifisch)
 *   3. System-Agent aus File (code-versioniert)
 */
export async function loadAgent(agentId: string): Promise<AgentConfig | null> {
  // 1. Connection-Agent
  const connectionAgent = await getConnectionAgent(agentId);
  if (connectionAgent) {
    return connectionAgent;
  }

  // 2. Custom-Agent aus DB
  if (!SYSTEM_AGENT_IDS.has(agentId)) {
    try {
      const dbRecord = await getCustomAgentRecord(agentId);
      if (dbRecord) {
        const agent = parseAgentMarkdown(dbRecord.id, dbRecord.configMd);
        // DB-Agents sind immer non-system, auch wenn das Frontmatter es behauptet.
        agent.system = false;
        return agent;
      }
    } catch (err) {
      console.warn(`[agents] DB lookup failed for "${agentId}", falling back to file:`, (err as Error).message);
    }
  }

  // 3. System-Agent aus File (oder Custom-Agent der noch nicht migriert ist)
  const configPath = join(AGENTS_DIR, agentId, 'config.md');
  if (!existsSync(configPath)) {
    return null;
  }
  const content = await readFile(configPath, 'utf-8');
  const agent = parseAgentMarkdown(agentId, content);
  // System-Flag explizit aus Whitelist setzen — Frontmatter ist nicht ueberall korrekt gepflegt.
  agent.system = SYSTEM_AGENT_IDS.has(agentId);
  return agent;
}

/**
 * Generate an agent config from a connection provider
 */
async function getConnectionAgent(providerId: string): Promise<AgentConfig | null> {
  const registry = await getConnectionRegistry();
  const provider = registry.get(providerId);
  if (!provider) {
    return null;
  }

  const tools = provider.getTools();
  const toolNames = tools.map(t => t.name);

  // Generate capabilities from tool descriptions
  const capabilities = tools.map(t => {
    // Extract a short capability from the tool definition
    const desc = t.getDefinition().function.description?.split('.')[0] ?? ''; // First sentence
    return desc.length > 50 ? desc.substring(0, 47) + '...' : desc;
  });

  // Generate system prompt for the connection agent
  const toolDefs = tools.map(t => {
    const def = t.getDefinition().function;
    return { name: def.name, description: def.description ?? '', inputSchema: def.parameters };
  });
  const systemPrompt = generateConnectionAgentPrompt(provider.name, provider.description, toolDefs);

  return {
    id: provider.id,
    name: provider.name,
    description: provider.description,
    capabilities,
    tools: toolNames,
    delegatable: true,
    internal: false,
    system: true,  // Connection agents are system agents (auto-generated)
    systemPrompt,
  };
}

/**
 * Generate all connection-based agents from registered providers
 */
async function getConnectionAgents(): Promise<AgentConfig[]> {
  const registry = await getConnectionRegistry();
  const providers = registry.getAll();
  console.log(`getConnectionAgents: Found ${providers.length} providers`);
  const agents: AgentConfig[] = [];

  for (const provider of providers) {
    const tools = provider.getTools();
    const toolNames = tools.map(t => t.name);

    const toolDefs = tools.map(t => {
      const def = t.getDefinition().function;
      return { name: def.name, description: def.description ?? '', inputSchema: def.parameters };
    });

    const capabilities = toolDefs.map(t => {
      const desc = t.description.split('.')[0] ?? '';
      return desc.length > 50 ? desc.substring(0, 47) + '...' : desc;
    });

    const systemPrompt = generateConnectionAgentPrompt(provider.name, provider.description, toolDefs);

    agents.push({
      id: provider.id,
      name: provider.name,
      description: provider.description,
      capabilities,
      tools: toolNames,
      delegatable: true,
      internal: false,
      system: true,
      systemPrompt,
    });
  }

  return agents;
}

/**
 * Generate a system prompt for a connection agent
 */
function generateConnectionAgentPrompt(
  name: string,
  description: string,
  tools: Array<{ name: string; description: string; inputSchema?: any }>
): string {
  const toolDocs = tools.map(t => {
    let doc = `### ${t.name}\n${t.description}`;
    if (t.inputSchema?.properties) {
      const params = Object.entries(t.inputSchema.properties)
        .map(([key, value]: [string, any]) => `- \`${key}\`: ${value.description || value.type}`)
        .join('\n');
      if (params) {
        doc += `\n\n**Parameter:**\n${params}`;
      }
    }
    return doc;
  }).join('\n\n');

  return `# ${name} Agent

Du bist der spezialisierte Agent für ${name}. ${description}

## SPRACHE

**Antworte IMMER in der Sprache des Benutzers.** Standardmäßig Deutsch.

## Verfügbare Tools

${toolDocs}

## Wichtige Hinweise

1. **Verbindungsstatus prüfen**: Wenn ein Tool einen Fehler zurückgibt, dass der Dienst nicht verbunden ist, erkläre dem Benutzer freundlich, dass er den Dienst zuerst auf der Connections-Seite verbinden muss.

2. **Fehlerbehandlung**: Bei Zugriffsfehlern (401, 403) ist der Token wahrscheinlich abgelaufen. Bitte den Benutzer, sich auf der Connections-Seite neu zu verbinden.

3. **Ergebnisse zusammenfassen**: Fasse Suchergebnisse sinnvoll zusammen anstatt alle Details aufzulisten. Hebe die wichtigsten Treffer hervor.

4. **Dateiinhalte**: Wenn du Dateiinhalte liest, gib eine nützliche Zusammenfassung oder extrahiere die relevanten Informationen für die Benutzeranfrage.

## Verhaltensregeln

1. Nutze die verfügbaren Tools gezielt für die Benutzeranfrage
2. Bei Suchaufträgen: Starte mit einer breiten Suche, dann verfeinere bei Bedarf
3. Gib immer an, woher die Informationen stammen
4. Bei Fehlern: Erkläre das Problem verständlich und biete Lösungen an`;
}

/**
 * Load all agents from the agents directory (always fresh from disk)
 * Also includes dynamically generated connection agents
 */
export async function loadAllAgents(): Promise<Map<string, AgentConfig>> {
  const agents = new Map<string, AgentConfig>();

  // 1. File-basierte System-Agenten
  if (existsSync(AGENTS_DIR)) {
    const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const agentId = entry.name;
      const configPath = join(AGENTS_DIR, agentId, 'config.md');
      if (!existsSync(configPath)) continue;
      const content = await readFile(configPath, 'utf-8');
      const agent = parseAgentMarkdown(agentId, content);
      agent.system = SYSTEM_AGENT_IDS.has(agentId);
      agents.set(agent.id, agent);
    }
  }

  // 2. Custom-Agenten aus DB — ueberschreiben File-Variante bei ID-Konflikt
  //    (so kann ein Admin auch System-Agenten pro Instanz uebersteuern, falls noetig)
  try {
    const dbAgents = await listCustomAgentRecords();
    for (const record of dbAgents) {
      const agent = parseAgentMarkdown(record.id, record.configMd);
      agent.system = false;
      agents.set(agent.id, agent);
    }
  } catch (error) {
    console.error('Failed to load custom agents from DB:', error);
    // Continue without DB agents — Boot soll nicht scheitern
  }

  // 3. Connection-Agenten (auto-generiert) — gewinnen ueber alle anderen bei ID-Konflikt
  try {
    const connectionAgents = await getConnectionAgents();
    for (const agent of connectionAgents) {
      agents.set(agent.id, agent);
    }
  } catch (error) {
    console.error('Failed to load connection agents:', error);
  }

  return agents;
}

/**
 * List all non-internal, active agents (for UI chat selection, supervisor prompt)
 */
export async function listAgents(): Promise<AgentConfig[]> {
  const agents = await loadAllAgents();
  return Array.from(agents.values()).filter(a => !a.internal && !a.tombstone && a.active !== false);
}

/**
 * List all delegatable, active agents (for delegation tool)
 */
export async function listDelegatableAgents(): Promise<AgentConfig[]> {
  const agents = await loadAllAgents();
  return Array.from(agents.values()).filter(a => a.delegatable && !a.tombstone && a.active !== false);
}

/**
 * List all non-internal agents including inactive (for admin UI)
 */
export async function listAllAgentsIncludingInactive(): Promise<AgentConfig[]> {
  const agents = await loadAllAgents();
  return Array.from(agents.values()).filter(a => !a.internal && !a.tombstone);
}

/**
 * Get the router agent configuration
 */
export async function getRouterAgent(): Promise<AgentConfig | null> {
  const agents = await loadAllAgents();
  return agents.get('_router') || null;
}

/**
 * Build a dynamic system prompt for the router
 * Includes the list of available agents
 */
export async function buildRouterPrompt(): Promise<string> {
  const routerAgent = await getRouterAgent();
  if (!routerAgent) {
    throw new Error('Router agent not configured');
  }

  const agents = await listAgents();
  const agentList = agents.map(a => {
    return `- ${a.id}: ${a.name} - ${a.description}\n  Capabilities: ${a.capabilities.join(', ')}`;
  }).join('\n');

  return routerAgent.systemPrompt.replace('{{AGENT_LIST}}', agentList);
}

/**
 * Generate markdown content from agent config
 */
function generateAgentMarkdown(agent: Omit<AgentConfig, 'systemPrompt'> & { systemPrompt: string }): string {
  const lines: string[] = ['---'];

  lines.push(`id: ${agent.id}`);
  lines.push(`name: ${agent.name}`);
  lines.push(`description: ${agent.description}`);

  const capabilities = Array.isArray(agent.capabilities) ? agent.capabilities : [];
  if (capabilities.length > 0) {
    lines.push('capabilities:');
    for (const cap of capabilities) {
      lines.push(`  - ${cap}`);
    }
  }

  const tools = Array.isArray(agent.tools) ? agent.tools : [];
  if (tools.length > 0) {
    lines.push('tools:');
    for (const tool of tools) {
      lines.push(`  - ${tool}`);
    }
  }

  lines.push(`delegatable: ${agent.delegatable}`);

  if (agent.active === false) {
    lines.push('active: false');
  }

  if ((agent as any).tombstone === true) {
    lines.push('tombstone: true');
  }

  if (agent.internal) {
    lines.push(`internal: true`);
  }

  if (agent.system) {
    lines.push(`system: true`);
  }

  if (agent.maxIterations) {
    lines.push(`maxIterations: ${agent.maxIterations}`);
  }

  if (agent.icon) {
    lines.push(`icon: ${agent.icon}`);
  }

  if (agent.color) {
    lines.push(`color: ${agent.color}`);
  }

  // Model configuration
  if (agent.model) {
    lines.push('model:');
    if (agent.model.provider_id) {
      lines.push(`  provider_id: ${agent.model.provider_id}`);
    }
    if (agent.model.model_id) {
      lines.push(`  model_id: ${agent.model.model_id}`);
    }
    if (agent.model.locked !== undefined) {
      lines.push(`  locked: ${agent.model.locked}`);
    }
    if (agent.model.inherit !== undefined) {
      lines.push(`  inherit: ${agent.model.inherit}`);
    }
  }

  // Skill configuration
  if (agent.skillMode) {
    lines.push(`skillMode: ${agent.skillMode}`);
  }

  const skills = Array.isArray(agent.skills) ? agent.skills : [];
  if (skills.length > 0) {
    lines.push('skills:');
    for (const skill of skills) {
      lines.push(`  - ${skill}`);
    }
  }

  const collections = Array.isArray(agent.collections) ? agent.collections : [];
  if (collections.length > 0) {
    lines.push('collections:');
    for (const c of collections) {
      lines.push(`  - ${c}`);
    }
  }

  // Prompt-Vorschläge als einzeiliges Inline-JSON. Der Objekt-Wrapper `{items:[…]}`
  // verhindert die Inline-Array-Sonderbehandlung (`[…]`) des Frontmatter-Parsers;
  // mehrzeilige Prompts werden von JSON.stringify als `\n` escaped → round-trip-sicher.
  const promptSuggestions = Array.isArray(agent.promptSuggestions)
    ? agent.promptSuggestions
        .filter((s) => s && typeof s.title === 'string' && typeof s.prompt === 'string')
        .map((s) => ({ title: s.title, prompt: s.prompt }))
    : [];
  if (promptSuggestions.length > 0) {
    lines.push(`promptSuggestions: ${JSON.stringify({ items: promptSuggestions })}`);
  }

  lines.push('---');
  lines.push('');
  lines.push(agent.systemPrompt);

  return lines.join('\n');
}

/**
 * Erzeugt Delegation-Metadaten (Beschreibung + Fähigkeiten) aus dem System-Prompt
 * per LLM — einheitlich formuliert und unabhängig davon, was der/die einzelne
 * Nutzer:in eingibt. Dient anderen Agenten als Grundlage für die Delegations-Wahl.
 * Fällt bei Fehlern auf eine simple Ableitung zurück und wirft NIE (Speichern
 * darf nie an der Generierung scheitern). Lazy-Imports gegen Zirkularität.
 */
async function generateAgentMetadata(
  name: string,
  systemPrompt: string,
): Promise<{ description: string; capabilities: string[] }> {
  const prompt = (systemPrompt || '').trim();
  const fallback = (): { description: string; capabilities: string[] } => ({
    description: prompt ? prompt.split(/\n|(?<=\.)\s/)[0]!.slice(0, 220).trim() : '',
    capabilities: [],
  });
  if (!prompt) return fallback();

  try {
    const { llmService } = await import('./llm');
    const { parseJsonObject } = await import('./extraction/extract-call');

    const messages: Message[] = [
      {
        role: 'system',
        content:
          'Du erstellst kurze, sachliche Metadaten für einen KI-Agenten, damit ANDERE Agenten entscheiden ' +
          'können, ob sie eine Aufgabe an ihn delegieren. Antworte AUSSCHLIESSLICH mit gültigem JSON (keine ' +
          'Markdown-Fences) nach genau diesem Schema: {"description": string, "capabilities": string[]}. ' +
          'description = 1–2 prägnante Sätze auf Deutsch: was der Agent tut und wofür er zuständig ist. ' +
          'capabilities = 3–6 kurze Stichpunkte (je 2–5 Wörter) mit konkreten Fähigkeiten. Sachlich, keine ' +
          'Werbung, keine Anrede, keine Wiederholung des Namens.',
      },
      {
        role: 'user',
        content: `Agent-Name: ${name || '(ohne Name)'}\n\nSystem-Prompt des Agenten:\n"""\n${prompt.slice(0, 6000)}\n"""`,
      },
    ];

    const res = await llmService.chat(messages);
    const obj = parseJsonObject(res.content);
    if (!obj) return fallback();

    const description = typeof obj.description === 'string' ? obj.description.trim() : '';
    const capabilities = (Array.isArray(obj.capabilities) ? obj.capabilities : [])
      .filter((c): c is string => typeof c === 'string')
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 8);

    if (!description && capabilities.length === 0) return fallback();
    return { description: description || fallback().description, capabilities };
  } catch (err) {
    console.warn('[agents] generateAgentMetadata failed, using fallback:', (err as Error).message);
    return fallback();
  }
}

/**
 * Check if an agent ID is a connection-based agent
 */
async function isConnectionAgent(agentId: string): Promise<boolean> {
  const registry = await getConnectionRegistry();
  return registry.has(agentId);
}

/**
 * Create a new agent
 */
export async function createAgent(agentData: {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
  delegatable: boolean;
  systemPrompt: string;
  active?: boolean;
  model?: AgentModelConfig;
  skills?: string[];
  skillMode?: 'all' | 'allow' | 'none';
  icon?: string;
  color?: string;
  collections?: string[];
  promptSuggestions?: Array<{ title: string; prompt: string }>;
}): Promise<AgentConfig> {
  // Validate ID format
  if (!/^[a-z0-9_-]+$/.test(agentData.id)) {
    throw new Error('Agent ID must contain only lowercase letters, numbers, hyphens and underscores');
  }

  // Check if ID conflicts with a connection agent
  if (await isConnectionAgent(agentData.id)) {
    throw new Error(`Agent ID "${agentData.id}" is reserved for a connection provider`);
  }

  // System-IDs sind reserviert — die kommen aus dem File-Seed.
  if (SYSTEM_AGENT_IDS.has(agentData.id)) {
    throw new Error(`Agent ID "${agentData.id}" ist fuer einen System-Agenten reserviert`);
  }

  // Check if agent already exists
  const existing = await loadAgent(agentData.id);
  if (existing) {
    throw new Error(`Agent with ID "${agentData.id}" already exists`);
  }

  // User-created agents always have model.locked = true if model is specified
  const modelConfig = agentData.model ? {
    ...agentData.model,
    locked: true,
  } : undefined;

  // Beschreibung + Fähigkeiten werden nicht mehr vom User gepflegt, sondern aus
  // dem System-Prompt generiert (einheitlich, für die Delegations-Wahl). Nur
  // falls doch mitgeliefert (z.B. Import), diese übernehmen.
  let description = agentData.description;
  let capabilities = agentData.capabilities;
  if (!description || !Array.isArray(capabilities) || capabilities.length === 0) {
    const meta = await generateAgentMetadata(agentData.name, agentData.systemPrompt);
    description = meta.description;
    capabilities = meta.capabilities;
  }

  const merged = {
    ...agentData,
    description,
    capabilities,
    active: agentData.active !== false,
    internal: false,
    system: false,
    model: modelConfig,
    skills: agentData.skills,
    skillMode: agentData.skillMode,
  };
  const content = generateAgentMarkdown(merged);
  const { frontmatter } = parseFrontmatter(content);

  await saveCustomAgentRecord({
    id: agentData.id,
    name: agentData.name,
    description: agentData.description,
    configMd: content,
    frontmatter: frontmatter as Record<string, any>,
  });

  const agent = await loadAgent(agentData.id);
  if (!agent) {
    throw new Error('Failed to create agent');
  }
  return agent;
}

/**
 * Update an existing agent
 */
export async function updateAgent(agentId: string, agentData: {
  name?: string;
  description?: string;
  capabilities?: string[];
  tools?: string[];
  delegatable?: boolean;
  active?: boolean;
  systemPrompt?: string;
  model?: AgentModelConfig;
  skills?: string[];
  skillMode?: 'all' | 'allow' | 'none';
  icon?: string;
  color?: string;
  collections?: string[];
  promptSuggestions?: Array<{ title: string; prompt: string }>;
}): Promise<AgentConfig> {
  // Prevent editing connection agents
  if (await isConnectionAgent(agentId)) {
    throw new Error('Connection-Agenten können nicht bearbeitet werden');
  }

  // Load existing agent
  const existing = await loadAgent(agentId);
  if (!existing) {
    throw new Error(`Agent "${agentId}" not found`);
  }

  // Prevent editing internal agents
  if (existing.internal) {
    throw new Error('Cannot edit internal agents');
  }

  // Prevent editing system agents (Whitelist + Frontmatter-Flag)
  if (SYSTEM_AGENT_IDS.has(agentId) || existing.system) {
    throw new Error('System-Agenten können nicht bearbeitet werden');
  }

  // User-created agents always have model.locked = true if model is specified
  const modelConfig = agentData.model ? {
    ...agentData.model,
    locked: true,
  } : existing.model;

  const newName = agentData.name ?? existing.name;
  const newSystemPrompt = agentData.systemPrompt ?? existing.systemPrompt;
  const promptChanged = agentData.systemPrompt !== undefined && agentData.systemPrompt !== existing.systemPrompt;

  // Beschreibung + Fähigkeiten sind generiert (nicht mehr user-gepflegt). Neu
  // erzeugen, wenn der System-Prompt sich geändert hat oder sie fehlen; explizit
  // mitgelieferte Werte (z.B. Import) haben Vorrang.
  let description = agentData.description ?? existing.description;
  let capabilities = agentData.capabilities ?? existing.capabilities;
  if (
    agentData.description === undefined && agentData.capabilities === undefined &&
    (promptChanged || !description || !Array.isArray(capabilities) || capabilities.length === 0)
  ) {
    const meta = await generateAgentMetadata(newName, newSystemPrompt);
    description = meta.description;
    capabilities = meta.capabilities;
  }

  const updated: AgentConfig = {
    ...existing,
    name: newName,
    description,
    capabilities,
    tools: agentData.tools ?? existing.tools,
    delegatable: agentData.delegatable ?? existing.delegatable,
    active: agentData.active ?? existing.active,
    systemPrompt: newSystemPrompt,
    model: modelConfig,
    skills: agentData.skills ?? existing.skills,
    skillMode: agentData.skillMode ?? existing.skillMode,
    icon: agentData.icon ?? existing.icon,
    color: agentData.color ?? existing.color,
    collections: agentData.collections ?? existing.collections,
    promptSuggestions: agentData.promptSuggestions ?? existing.promptSuggestions,
  };

  const content = generateAgentMarkdown(updated);
  const { frontmatter } = parseFrontmatter(content);

  await saveCustomAgentRecord({
    id: agentId,
    name: updated.name,
    description: updated.description,
    configMd: content,
    frontmatter: frontmatter as Record<string, any>,
  });

  return updated;
}

/**
 * Delete an agent
 */
export async function deleteAgent(agentId: string): Promise<void> {
  // Prevent deleting connection agents
  if (await isConnectionAgent(agentId)) {
    throw new Error('Connection-Agenten können nicht gelöscht werden');
  }

  // Load existing agent
  const existing = await loadAgent(agentId);
  if (!existing) {
    throw new Error(`Agent "${agentId}" not found`);
  }

  // Prevent deleting internal agents
  if (existing.internal) {
    throw new Error('Cannot delete internal agents');
  }

  // Prevent deleting system agents (Whitelist + Frontmatter-Flag)
  if (SYSTEM_AGENT_IDS.has(agentId) || existing.system) {
    throw new Error('System-Agenten können nicht gelöscht werden');
  }

  // Wenn ein File-Seed unter data/agents/<id>/ liegt, wuerde es nach
  // einem reinen DB-Delete beim naechsten loadAllAgents() wieder geladen.
  // Loesung: statt zu loeschen, einen Tombstone (active=false in DB) anlegen
  // — der ueberstimmt das File-Seed (DB wins) und wird in listAgents
  // gefiltert. Wenn jemand den gleichen Agent-ID neu anlegen will, muss
  // er den Tombstone separat per UI ueberstimmen oder direkt updaten.
  const configPath = join(AGENTS_DIR, agentId, 'config.md');
  const hasFileSeed = existsSync(configPath);

  if (hasFileSeed) {
    // File-Seed da → Tombstone setzen (upsert). DB-Eintrag mit
    // tombstone=true ueberstimmt das File-Seed im DB-Override-Mechanismus
    // und wird in beiden List-Funktionen ausgefiltert.
    const fileContent = await readFile(configPath, 'utf-8');
    const { frontmatter } = parseFrontmatter(fileContent);
    const fm = { ...(frontmatter as Record<string, any>), active: false, tombstone: true };
    await saveCustomAgentRecord({
      id: agentId,
      name: existing.name,
      description: existing.description,
      configMd: generateAgentMarkdown({ ...existing, active: false, tombstone: true } as any),
      frontmatter: fm,
    });
  } else {
    // Kein File-Seed → einfach hart aus DB loeschen.
    await deleteCustomAgentRecord(agentId);
  }
}

/**
 * Get full agent config including system prompt (for editing)
 */
export async function getAgentFull(agentId: string): Promise<AgentConfig | null> {
  return loadAgent(agentId);
}

/**
 * Idempotente Migration: liest alle Files unter data/agents/<id>/config.md
 * deren ID NICHT in SYSTEM_AGENT_IDS ist und legt sie in der DB als
 * Custom-Agent an — sofern dort noch kein Eintrag mit gleicher ID existiert.
 *
 * Wird beim Boot einmalig aufgerufen, no-op wenn alle bereits migriert sind.
 * Files bleiben liegen damit ein Roll-back moeglich ist; in einem zweiten
 * Cleanup-Schritt (nach Verifikation) koennen sie aus dem Repo geloescht
 * werden.
 */
export async function migrateFileAgentsToDb(): Promise<{
  migrated: string[];
  skipped: string[];
}> {
  const migrated: string[] = [];
  const skipped: string[] = [];

  if (!existsSync(AGENTS_DIR)) return { migrated, skipped };
  const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const agentId = entry.name;
    if (SYSTEM_AGENT_IDS.has(agentId)) {
      skipped.push(`${agentId} (system)`);
      continue;
    }

    const configPath = join(AGENTS_DIR, agentId, 'config.md');
    if (!existsSync(configPath)) continue;

    try {
      const dbExisting = await getCustomAgentRecord(agentId);
      if (dbExisting) {
        skipped.push(`${agentId} (already in DB)`);
        continue;
      }

      const content = await readFile(configPath, 'utf-8');
      const { frontmatter } = parseFrontmatter(content);
      const fm = frontmatter as AgentFrontmatter;

      await saveCustomAgentRecord({
        id: agentId,
        name: fm.name || agentId,
        description: fm.description || null,
        configMd: content,
        frontmatter: frontmatter as Record<string, any>,
      });
      migrated.push(agentId);
    } catch (err) {
      console.warn(`[migrateFileAgentsToDb] failed for ${agentId}:`, (err as Error).message);
    }
  }

  return { migrated, skipped };
}
