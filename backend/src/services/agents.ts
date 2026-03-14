import { readdir, readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

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
}

interface AgentFrontmatter {
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
 * Load a single agent configuration from disk
 */
export async function loadAgent(agentId: string): Promise<AgentConfig | null> {
  // First check if it's a connection-based agent
  const connectionAgent = await getConnectionAgent(agentId);
  if (connectionAgent) {
    return connectionAgent;
  }

  const agentDir = join(AGENTS_DIR, agentId);
  const configPath = join(agentDir, 'config.md');

  if (!existsSync(configPath)) {
    console.warn(`Agent config not found: ${configPath}`);
    return null;
  }

  const content = await readFile(configPath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content);

  const fm = frontmatter as AgentFrontmatter;

  return {
    id: fm.id || agentId,
    name: fm.name || agentId,
    description: fm.description || '',
    capabilities: fm.capabilities || [],
    tools: fm.tools || ['file_read', 'file_list'],
    delegatable: fm.delegatable !== false,
    active: fm.active !== false,  // Default: true
    internal: fm.internal === true,
    system: fm.system === true,
    systemPrompt: body,
    model: fm.model,
    skills: fm.skills,
    skillMode: fm.skillMode,
    maxIterations: typeof fm.maxIterations === 'number' ? fm.maxIterations : undefined,
  };
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

  // First, load file-based agents
  if (existsSync(AGENTS_DIR)) {
    const entries = await readdir(AGENTS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const agentId = entry.name;
      const agentDir = join(AGENTS_DIR, agentId);
      const configPath = join(agentDir, 'config.md');

      if (!existsSync(configPath)) continue;

      const content = await readFile(configPath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);
      const fm = frontmatter as AgentFrontmatter;

      const agent: AgentConfig = {
        id: fm.id || agentId,
        name: fm.name || agentId,
        description: fm.description || '',
        capabilities: fm.capabilities || [],
        tools: fm.tools || ['file_read', 'file_list'],
        delegatable: fm.delegatable !== false,
        active: fm.active !== false,  // Default: true
        internal: fm.internal === true,
        system: fm.system === true,
        systemPrompt: body,
        model: fm.model,
        skills: fm.skills,
        skillMode: fm.skillMode,
        maxIterations: typeof fm.maxIterations === 'number' ? fm.maxIterations : undefined,
      };

      agents.set(agent.id, agent);
    }
  }

  // Then, add connection-based agents (they override file-based if same ID)
  try {
    const connectionAgents = await getConnectionAgents();
    console.log(`Loading ${connectionAgents.length} connection agents`);
    for (const agent of connectionAgents) {
      console.log(`  - Adding connection agent: ${agent.id}`);
      agents.set(agent.id, agent);
    }
  } catch (error) {
    console.error('Failed to load connection agents:', error);
    // Continue without connection agents
  }

  return agents;
}

/**
 * List all non-internal, active agents (for UI chat selection, supervisor prompt)
 */
export async function listAgents(): Promise<AgentConfig[]> {
  const agents = await loadAllAgents();
  return Array.from(agents.values()).filter(a => !a.internal && a.active !== false);
}

/**
 * List all delegatable, active agents (for delegation tool)
 */
export async function listDelegatableAgents(): Promise<AgentConfig[]> {
  const agents = await loadAllAgents();
  return Array.from(agents.values()).filter(a => a.delegatable && a.active !== false);
}

/**
 * List all non-internal agents including inactive (for admin UI)
 */
export async function listAllAgentsIncludingInactive(): Promise<AgentConfig[]> {
  const agents = await loadAllAgents();
  return Array.from(agents.values()).filter(a => !a.internal);
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

  if (agent.internal) {
    lines.push(`internal: true`);
  }

  if (agent.system) {
    lines.push(`system: true`);
  }

  if (agent.maxIterations) {
    lines.push(`maxIterations: ${agent.maxIterations}`);
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

  lines.push('---');
  lines.push('');
  lines.push(agent.systemPrompt);

  return lines.join('\n');
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
}): Promise<AgentConfig> {
  // Validate ID format
  if (!/^[a-z0-9_-]+$/.test(agentData.id)) {
    throw new Error('Agent ID must contain only lowercase letters, numbers, hyphens and underscores');
  }

  // Check if ID conflicts with a connection agent
  if (await isConnectionAgent(agentData.id)) {
    throw new Error(`Agent ID "${agentData.id}" is reserved for a connection provider`);
  }

  // Check if agent already exists
  const existing = await loadAgent(agentData.id);
  if (existing) {
    throw new Error(`Agent with ID "${agentData.id}" already exists`);
  }

  // Create agent directory
  const agentDir = join(AGENTS_DIR, agentData.id);
  if (!existsSync(agentDir)) {
    await mkdir(agentDir, { recursive: true });
  }

  // Create config file
  const configPath = join(agentDir, 'config.md');

  // User-created agents always have model.locked = true if model is specified
  const modelConfig = agentData.model ? {
    ...agentData.model,
    locked: true,  // User-created agents have fixed model
  } : undefined;

  const content = generateAgentMarkdown({
    ...agentData,
    active: agentData.active !== false,  // Default: true
    internal: false,
    system: false,  // User-created agents are never system agents
    model: modelConfig,
    skills: agentData.skills,
    skillMode: agentData.skillMode,
  });

  await writeFile(configPath, content, 'utf-8');

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

  // Prevent editing system agents
  if (existing.system) {
    throw new Error('System-Agenten können nicht bearbeitet werden');
  }

  // Merge data
  // User-created agents always have model.locked = true if model is specified
  const modelConfig = agentData.model ? {
    ...agentData.model,
    locked: true,  // User-created agents have fixed model
  } : existing.model;

  const updated: AgentConfig = {
    ...existing,
    name: agentData.name ?? existing.name,
    description: agentData.description ?? existing.description,
    capabilities: agentData.capabilities ?? existing.capabilities,
    tools: agentData.tools ?? existing.tools,
    delegatable: agentData.delegatable ?? existing.delegatable,
    active: agentData.active ?? existing.active,
    systemPrompt: agentData.systemPrompt ?? existing.systemPrompt,
    model: modelConfig,
    skills: agentData.skills ?? existing.skills,
    skillMode: agentData.skillMode ?? existing.skillMode,
  };

  // Write updated config
  const configPath = join(AGENTS_DIR, agentId, 'config.md');
  const content = generateAgentMarkdown(updated);
  await writeFile(configPath, content, 'utf-8');

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

  // Prevent deleting system agents
  if (existing.system) {
    throw new Error('System-Agenten können nicht gelöscht werden');
  }

  // Delete agent directory
  const agentDir = join(AGENTS_DIR, agentId);
  await rm(agentDir, { recursive: true });
}

/**
 * Get full agent config including system prompt (for editing)
 */
export async function getAgentFull(agentId: string): Promise<AgentConfig | null> {
  return loadAgent(agentId);
}
