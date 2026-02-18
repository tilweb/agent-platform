/**
 * Enhanced Skills - Loader
 *
 * Loads skills from YAML files and legacy Markdown files.
 * Supports both formats for backward compatibility.
 */

import { readFile, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import type { EnhancedSkill, LegacySkill, SkillTriggers, SkillTools, SkillMetadata, SkillKnowledge, SkillSummary } from './types';

const SKILLS_DIR = resolve(process.cwd(), '../data/skills');

/**
 * Parse YAML frontmatter from Markdown content
 */
function parseMarkdownFrontmatter(content: string): Record<string, any> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match || !match[1]) return null;

  const frontmatter = match[1];
  const result: Record<string, any> = {};

  const lines = frontmatter.split('\n');
  for (const line of lines) {
    if (line.startsWith('name:')) {
      result.name = line.slice(5).trim().replace(/["']/g, '');
    } else if (line.startsWith('keywords:')) {
      const arrayMatch = line.match(/\[(.*)\]/);
      if (arrayMatch && arrayMatch[1]) {
        result.keywords = arrayMatch[1].split(',').map(k => k.trim().replace(/["']/g, ''));
      }
    } else if (line.startsWith('  - ') || line.startsWith('- ')) {
      const keyword = line.replace(/^[\s-]+/, '').trim().replace(/["']/g, '');
      if (keyword) {
        result.keywords = result.keywords || [];
        result.keywords.push(keyword);
      }
    }
  }

  return result;
}

/**
 * Convert legacy Markdown skill to EnhancedSkill format
 */
function convertLegacySkill(legacy: LegacySkill, id: string): EnhancedSkill {
  // Extract content without frontmatter
  const instructions = legacy.content.replace(/^---\n[\s\S]*?\n---\n/, '').trim();

  return {
    id,
    name: legacy.name,
    version: '1.0',
    description: `Skill: ${legacy.name}`,
    triggers: {
      keywords: legacy.keywords,
    },
    tools: {
      required: [],
      optional: [],
    },
    instructions,
    enabled: true,
    path: legacy.path,
  };
}

/**
 * Load a skill from YAML file
 */
async function loadYamlSkill(filePath: string): Promise<EnhancedSkill | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseYaml(content);

    if (!parsed || !parsed.id || !parsed.name) {
      console.warn(`Invalid YAML skill at ${filePath}: missing id or name`);
      return null;
    }

    // Ensure proper structure
    const skill: EnhancedSkill = {
      id: parsed.id,
      name: parsed.name,
      version: parsed.version || '1.0',
      description: parsed.description || '',
      // New fields (v2.0)
      metadata: normalizeMetadata(parsed.metadata),
      allowed_tools: normalizeAllowedTools(parsed.allowed_tools, parsed.tools),
      knowledge: normalizeKnowledge(parsed.knowledge),
      // Legacy fields (for backward compatibility)
      triggers: normalizeTriigers(parsed.triggers),
      tools: normalizeTools(parsed.tools),
      // Common fields
      instructions: parsed.instructions || '',
      workflow: parsed.workflow,
      output: parsed.output,
      parameters: parsed.parameters,
      constraints: parsed.constraints,
      enabled: parsed.enabled !== false,
      path: filePath,
    };

    return skill;
  } catch (error: any) {
    console.error(`Error loading YAML skill from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Load a skill from legacy Markdown file
 */
async function loadMarkdownSkill(filePath: string, id: string): Promise<EnhancedSkill | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const frontmatter = parseMarkdownFrontmatter(content);

    if (!frontmatter || !frontmatter.name) {
      console.warn(`Invalid Markdown skill at ${filePath}: missing name`);
      return null;
    }

    const legacy: LegacySkill = {
      name: frontmatter.name,
      keywords: frontmatter.keywords || [],
      content,
      path: filePath,
    };

    return convertLegacySkill(legacy, id);
  } catch (error: any) {
    console.error(`Error loading Markdown skill from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Normalize triggers to ensure proper structure
 */
function normalizeTriigers(triggers: any): SkillTriggers {
  if (!triggers) {
    return { keywords: [] };
  }

  return {
    keywords: Array.isArray(triggers.keywords) ? triggers.keywords : [],
    patterns: Array.isArray(triggers.patterns) ? triggers.patterns : undefined,
    intent: triggers.intent,
    explicit: triggers.explicit,
  };
}

/**
 * Normalize tools to ensure proper structure
 */
function normalizeTools(tools: any): SkillTools {
  if (!tools) {
    return { required: [], optional: [] };
  }

  // Handle array format (simple list = required)
  if (Array.isArray(tools)) {
    return { required: tools, optional: [] };
  }

  return {
    required: Array.isArray(tools.required) ? tools.required : [],
    optional: Array.isArray(tools.optional) ? tools.optional : [],
  };
}

/**
 * Normalize metadata to ensure proper structure
 */
function normalizeMetadata(metadata: any): SkillMetadata | undefined {
  if (!metadata) {
    return undefined;
  }

  return {
    use_when: typeof metadata.use_when === 'string' ? metadata.use_when : undefined,
    estimated_effort: typeof metadata.estimated_effort === 'string' ? metadata.estimated_effort : undefined,
    output_type: typeof metadata.output_type === 'string' ? metadata.output_type : undefined,
  };
}

/**
 * Normalize allowed_tools, with fallback to legacy tools.required/optional
 * New semantic: allowed_tools EXTENDS agent tools (doesn't restrict)
 */
function normalizeAllowedTools(allowedTools: any, legacyTools: any): string[] | undefined {
  // Prefer new allowed_tools format
  if (Array.isArray(allowedTools) && allowedTools.length > 0) {
    return allowedTools.filter((t: any) => typeof t === 'string');
  }

  // Fallback: Convert legacy tools.required + tools.optional to allowed_tools
  // This maintains backward compatibility
  if (legacyTools) {
    const combined: string[] = [];
    if (Array.isArray(legacyTools.required)) {
      combined.push(...legacyTools.required);
    }
    if (Array.isArray(legacyTools.optional)) {
      combined.push(...legacyTools.optional);
    }
    if (Array.isArray(legacyTools)) {
      combined.push(...legacyTools);
    }
    if (combined.length > 0) {
      return [...new Set(combined)]; // Remove duplicates
    }
  }

  return undefined;
}

/**
 * Normalize knowledge references
 */
function normalizeKnowledge(knowledge: any): SkillKnowledge | undefined {
  if (!knowledge) {
    return undefined;
  }

  return {
    files: Array.isArray(knowledge.files) ? knowledge.files : undefined,
    collections: Array.isArray(knowledge.collections) ? knowledge.collections : undefined,
    inject_manifests: typeof knowledge.inject_manifests === 'boolean' ? knowledge.inject_manifests : undefined,
  };
}

/**
 * Load all skills from a visibility directory (custom, system)
 */
async function loadSkillsFromDir(visibility: 'custom' | 'system'): Promise<EnhancedSkill[]> {
  const skills: EnhancedSkill[] = [];
  const fullDir = join(SKILLS_DIR, visibility);
  const isSystem = visibility === 'system';

  if (!existsSync(fullDir)) {
    return skills;
  }

  const entries = await readdir(fullDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = join(fullDir, entry.name);
    const skillId = entry.name;

    // Check for YAML file first (new format)
    const yamlPath = join(skillDir, 'SKILL.yaml');
    const ymlPath = join(skillDir, 'SKILL.yml');
    const mdPath = join(skillDir, 'SKILL.md');

    let skill: EnhancedSkill | null = null;

    if (existsSync(yamlPath)) {
      skill = await loadYamlSkill(yamlPath);
    } else if (existsSync(ymlPath)) {
      skill = await loadYamlSkill(ymlPath);
    } else if (existsSync(mdPath)) {
      skill = await loadMarkdownSkill(mdPath, skillId);
    }

    if (skill) {
      // Set system flag based on directory
      skill.system = isSystem;
      skills.push(skill);
    }
  }

  return skills;
}

// Skill cache
let cachedSkills: EnhancedSkill[] | null = null;

/**
 * Load all skills
 */
export async function loadSkills(): Promise<EnhancedSkill[]> {
  if (cachedSkills) return cachedSkills;

  const customSkills = await loadSkillsFromDir('custom');
  const systemSkills = await loadSkillsFromDir('system');

  cachedSkills = [...customSkills, ...systemSkills];

  console.log(`Loaded ${cachedSkills.length} enhanced skills (${customSkills.length} custom, ${systemSkills.length} system)`);
  return cachedSkills;
}

/**
 * Get a skill by ID
 */
export async function getSkillById(skillId: string): Promise<EnhancedSkill | null> {
  const skills = await loadSkills();
  return skills.find(s => s.id === skillId) || null;
}

/**
 * Get all enabled skills
 */
export async function getEnabledSkills(): Promise<EnhancedSkill[]> {
  const skills = await loadSkills();
  return skills.filter(s => s.enabled !== false);
}

/**
 * Clear the skills cache (for development/hot reload)
 */
export function clearSkillsCache(): void {
  cachedSkills = null;
}

/**
 * Reload skills (clear cache and load)
 */
export async function reloadSkills(): Promise<EnhancedSkill[]> {
  clearSkillsCache();
  return loadSkills();
}

/**
 * Create a new skill (only custom skills can be created)
 */
export async function createSkill(skill: EnhancedSkill): Promise<EnhancedSkill> {
  const { writeFile, mkdir } = await import('fs/promises');
  const { stringify: toYaml } = await import('yaml');

  // Validate required fields
  if (!skill.id || !skill.name) {
    throw new Error('Skill ID and name are required');
  }

  // Check if skill already exists
  const existing = await getSkillById(skill.id);
  if (existing) {
    throw new Error(`Skill with ID "${skill.id}" already exists`);
  }

  // Create skill directory (always in custom/)
  const skillDir = join(SKILLS_DIR, 'custom', skill.id);
  if (!existsSync(skillDir)) {
    await mkdir(skillDir, { recursive: true });
  }

  // Prepare YAML content (without path field)
  const skillData = {
    id: skill.id,
    name: skill.name,
    version: skill.version || '1.0',
    description: skill.description || '',
    // NEW: metadata for agent decision-making
    metadata: skill.metadata,
    // NEW: tools that this skill ADDS to agent capabilities
    allowed_tools: skill.allowed_tools,
    // NEW: knowledge references
    knowledge: skill.knowledge,
    // LEGACY: triggers (kept for backward compatibility)
    triggers: skill.triggers,
    // LEGACY: tools (kept for backward compatibility)
    tools: skill.tools,
    instructions: skill.instructions || '',
    workflow: skill.workflow,
    output: skill.output,
    parameters: skill.parameters,
    constraints: skill.constraints,
    enabled: skill.enabled !== false,
  };

  // Remove undefined values
  const cleanData = JSON.parse(JSON.stringify(skillData));

  // Write YAML file
  const yamlPath = join(skillDir, 'SKILL.yaml');
  const yamlContent = toYaml(cleanData, { lineWidth: 0 });
  await writeFile(yamlPath, yamlContent, 'utf-8');

  // Clear cache and reload
  clearSkillsCache();

  // Return the created skill with path
  return {
    ...skillData,
    path: yamlPath,
  };
}

/**
 * Update an existing skill (only custom skills can be updated)
 */
export async function updateSkill(skillId: string, updates: Partial<EnhancedSkill>): Promise<EnhancedSkill> {
  const { writeFile } = await import('fs/promises');
  const { stringify: toYaml } = await import('yaml');

  // Get existing skill
  const existing = await getSkillById(skillId);
  if (!existing) {
    throw new Error(`Skill "${skillId}" not found`);
  }

  // Prevent updating system skills
  if (existing.system) {
    throw new Error('System skills cannot be modified');
  }

  // Merge updates
  const updated: EnhancedSkill = {
    ...existing,
    ...updates,
    id: skillId, // ID cannot be changed
    path: existing.path,
  };

  // Prepare YAML content
  const skillData = {
    id: updated.id,
    name: updated.name,
    version: updated.version,
    description: updated.description,
    // NEW: metadata for agent decision-making
    metadata: updated.metadata,
    // NEW: tools that this skill ADDS to agent capabilities
    allowed_tools: updated.allowed_tools,
    // NEW: knowledge references
    knowledge: updated.knowledge,
    // LEGACY: triggers (kept for backward compatibility)
    triggers: updated.triggers,
    // LEGACY: tools (kept for backward compatibility)
    tools: updated.tools,
    instructions: updated.instructions,
    workflow: updated.workflow,
    output: updated.output,
    parameters: updated.parameters,
    constraints: updated.constraints,
    enabled: updated.enabled !== false,
  };

  // Remove undefined values
  const cleanData = JSON.parse(JSON.stringify(skillData));

  // Write YAML file
  const yamlPath = existing.path || join(SKILLS_DIR, 'custom', skillId, 'SKILL.yaml');
  const yamlContent = toYaml(cleanData, { lineWidth: 0 });
  await writeFile(yamlPath, yamlContent, 'utf-8');

  // Clear cache
  clearSkillsCache();

  return updated;
}

/**
 * Delete a skill (only custom skills can be deleted)
 */
export async function deleteSkill(skillId: string): Promise<void> {
  const { rm } = await import('fs/promises');

  // Get existing skill
  const existing = await getSkillById(skillId);
  if (!existing) {
    throw new Error(`Skill "${skillId}" not found`);
  }

  // Prevent deletion of system skills
  if (existing.system) {
    throw new Error('System skills cannot be deleted');
  }

  // Delete skill directory
  const skillDir = join(SKILLS_DIR, 'custom', skillId);
  if (existsSync(skillDir)) {
    await rm(skillDir, { recursive: true });
  }

  // Clear cache
  clearSkillsCache();
}

/**
 * Get skill summaries for system prompt injection
 * These summaries help agents decide which skill to load.
 *
 * @param filterOptions - Optional filter for agent-specific skill access
 */
export async function getSkillSummaries(filterOptions?: {
  agentSkills?: string[];
  skillMode?: 'all' | 'allow';
}): Promise<SkillSummary[]> {
  let skills = await getEnabledSkills();

  // Filter based on agent skill access configuration
  if (filterOptions?.skillMode === 'allow') {
    const allowedSkills = filterOptions.agentSkills || [];
    skills = skills.filter(s => allowedSkills.includes(s.id));
  }

  return skills.map(skill => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    use_when: skill.metadata?.use_when || generateUseWhenFromTriggers(skill),
    output_type: skill.metadata?.output_type,
  }));
}

/**
 * Generate use_when hint from legacy triggers for backward compatibility
 */
function generateUseWhenFromTriggers(skill: EnhancedSkill): string | undefined {
  const triggers = skill.triggers;
  if (!triggers) return undefined;

  const hints: string[] = [];

  // Convert keywords to natural language hints
  if (triggers.keywords && triggers.keywords.length > 0) {
    hints.push(`User mentions: ${triggers.keywords.slice(0, 3).join(', ')}`);
  }

  // Note explicit activation if required
  if (triggers.explicit) {
    hints.push(`Requires explicit /${skill.id} command`);
  }

  return hints.length > 0 ? hints.join('\n') : undefined;
}

/**
 * Load skill knowledge files from the skill folder
 * Returns the content of files specified in skill.knowledge.files
 */
export async function loadSkillKnowledgeFiles(skill: EnhancedSkill): Promise<{
  files: { path: string; content: string }[];
  errors: string[];
}> {
  const files: { path: string; content: string }[] = [];
  const errors: string[] = [];

  if (!skill.knowledge?.files || !skill.path) {
    return { files, errors };
  }

  const skillDir = skill.path.replace(/\/SKILL\.(yaml|yml|md)$/, '');

  for (const filePath of skill.knowledge.files) {
    const fullPath = join(skillDir, filePath);

    if (!existsSync(fullPath)) {
      errors.push(`Knowledge file not found: ${filePath}`);
      continue;
    }

    try {
      const content = await readFile(fullPath, 'utf-8');
      files.push({ path: filePath, content });
    } catch (error: any) {
      errors.push(`Error loading ${filePath}: ${error.message}`);
    }
  }

  return { files, errors };
}
