/**
 * Enhanced Skills — Loader (Hybrid: System=Code-Asset, Custom=Postgres).
 *
 * System-Skills (`data/skills/system/`) bleiben Code-Assets im Image und werden
 * read-only von der Disk geladen. Custom-Skills leben in `custom_skills.skills`
 * (siehe storage.ts). Cache vereint beide.
 */

import { readFile, readdir } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import type { EnhancedSkill, LegacySkill, SkillTriggers, SkillTools, SkillMetadata, SkillKnowledge, SkillSummary } from './types';
import { listCustomSkills, getCustomSkill, upsertCustomSkill, deleteCustomSkill } from './storage';

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
 * Load all skills from a visibility directory (system only — custom leben in DB).
 */
async function loadSkillsFromDir(visibility: 'system'): Promise<EnhancedSkill[]> {
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

/**
 * Seed-Helper: bestehende Custom-Skill-YAMLs unter `data/skills/custom/` in
 * die DB ingestieren. Idempotent — bestehende DB-Eintraege werden NICHT
 * ueberschrieben (falls jemand am Skill in der DB editiert hat).
 *
 * Wird von `initialize()` einmalig beim Server-Start aufgerufen.
 */
export async function seedCustomSkillsFromDisk(): Promise<{ ingested: string[]; skipped: string[] }> {
  const ingested: string[] = [];
  const skipped: string[] = [];
  const dir = join(SKILLS_DIR, 'custom');
  if (!existsSync(dir)) return { ingested, skipped };

  // Ad-hoc: gleiche Logik wie loadSkillsFromDir, ohne `system`-Flag.
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillId = entry.name;
    const skillDir = join(dir, skillId);
    let parsed: EnhancedSkill | null = null;
    if (existsSync(join(skillDir, 'SKILL.yaml'))) {
      parsed = await loadYamlSkill(join(skillDir, 'SKILL.yaml'));
    } else if (existsSync(join(skillDir, 'SKILL.yml'))) {
      parsed = await loadYamlSkill(join(skillDir, 'SKILL.yml'));
    } else if (existsSync(join(skillDir, 'SKILL.md'))) {
      parsed = await loadMarkdownSkill(join(skillDir, 'SKILL.md'), skillId);
    }
    if (!parsed) continue;
    const existing = await getCustomSkill(parsed.id);
    if (existing) {
      skipped.push(parsed.id);
      continue;
    }
    await upsertCustomSkill({ ...parsed, system: false });
    ingested.push(parsed.id);
  }
  if (ingested.length > 0) console.log(`[skills] Seeded ${ingested.length} custom skills from disk: ${ingested.join(', ')}`);
  return { ingested, skipped };
}

// Skill cache
let cachedSkills: EnhancedSkill[] | null = null;

/**
 * Load all skills — System aus Disk, Custom aus DB.
 */
export async function loadSkills(): Promise<EnhancedSkill[]> {
  if (cachedSkills) return cachedSkills;

  const systemSkills = await loadSkillsFromDir('system');
  let customSkills: EnhancedSkill[] = [];
  try {
    customSkills = await listCustomSkills();
  } catch (err) {
    console.warn('[skills] Failed to load custom skills from DB:', err instanceof Error ? err.message : err);
  }

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
 * Create a new custom skill (System-Skills sind read-only Code-Assets).
 */
export async function createSkill(skill: EnhancedSkill): Promise<EnhancedSkill> {
  if (!skill.id || !skill.name) {
    throw new Error('Skill ID and name are required');
  }
  // Konflikt-Pruefung gegen alle Skills (auch System) — IDs muessen global eindeutig sein.
  const existing = await getSkillById(skill.id);
  if (existing) {
    throw new Error(`Skill with ID "${skill.id}" already exists`);
  }
  const saved = await upsertCustomSkill({
    ...skill,
    version: skill.version || '1.0',
    description: skill.description || '',
    instructions: skill.instructions || '',
    enabled: skill.enabled !== false,
    triggers: skill.triggers ?? { keywords: [] },
    tools: skill.tools ?? { required: [], optional: [] },
  });
  clearSkillsCache();
  return saved;
}

/**
 * Update an existing custom skill.
 */
export async function updateSkill(skillId: string, updates: Partial<EnhancedSkill>): Promise<EnhancedSkill> {
  const existing = await getSkillById(skillId);
  if (!existing) throw new Error(`Skill "${skillId}" not found`);
  if (existing.system) throw new Error('System skills cannot be modified');

  const merged: EnhancedSkill = {
    ...existing,
    ...updates,
    id: skillId,
    enabled: updates.enabled !== undefined ? updates.enabled !== false : existing.enabled !== false,
  };
  const saved = await upsertCustomSkill(merged);
  clearSkillsCache();
  return saved;
}

/**
 * Delete a custom skill.
 */
export async function deleteSkill(skillId: string): Promise<void> {
  const existing = await getSkillById(skillId);
  if (!existing) throw new Error(`Skill "${skillId}" not found`);
  if (existing.system) throw new Error('System skills cannot be deleted');
  await deleteCustomSkill(skillId);
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
 * Resolve a knowledge file slug to a KB document content (DB+S3).
 * KB document IDs follow the pattern: doc-<slug>-<timestamp>
 *
 * Returns the document content directly statt einen File-Pfad — seit der
 * KB-Migration auf DB+S3 gibt es keine lokalen Files mehr.
 */
async function resolveKbDocumentContent(slug: string): Promise<string | null> {
  try {
    const kb = await import('../services/kbStorage');
    const collections = await kb.listCollections();
    for (const col of collections) {
      const docs = await kb.listDocuments(col.id);
      const match = docs.find((d) => d.id.startsWith(`doc-${slug}-`));
      if (match) {
        const content = await kb.getDocumentContent(col.id, match.id);
        if (content) return content;
      }
    }
  } catch (error: any) {
    console.warn(`[resolveKbDocumentContent] Error searching KB for "${slug}":`, error.message);
  }
  return null;
}

/**
 * Load skill knowledge files from the skill folder or knowledge base.
 * Resolution order:
 * 1. Look for the file directly in the skill directory
 * 2. Fall back to searching KB collections for a matching document slug
 */
export async function loadSkillKnowledgeFiles(skill: EnhancedSkill): Promise<{
  files: { path: string; content: string }[];
  errors: string[];
}> {
  const files: { path: string; content: string }[] = [];
  const errors: string[] = [];

  if (!skill.knowledge?.files) {
    return { files, errors };
  }

  // skill.path ist nur bei file-basierten System-Skills gesetzt — bei DB-
  // basierten Custom-Skills ist es null. Dann ueberspringen wir den
  // Skill-Dir-Lookup direkt und gehen nur ueber die KB.
  const skillDir = skill.path ? skill.path.replace(/\/SKILL\.(yaml|yml|md)$/, '') : null;

  for (const filePath of skill.knowledge.files) {
    // 1. Try skill directory first (nur wenn der Skill File-basiert ist)
    if (skillDir) {
      const localPath = join(skillDir, filePath);
      if (existsSync(localPath)) {
        try {
          const content = await readFile(localPath, 'utf-8');
          files.push({ path: filePath, content });
          continue;
        } catch (error: any) {
          errors.push(`Error loading ${filePath}: ${error.message}`);
          continue;
        }
      }
    }

    // 2. Fall back to KB document search by slug (DB+S3)
    const kbContent = await resolveKbDocumentContent(filePath);
    if (kbContent !== null) {
      files.push({ path: filePath, content: kbContent });
      console.log(`[loadSkillKnowledgeFiles] Resolved "${filePath}" from KB`);
      continue;
    }

    errors.push(`Knowledge file not found: ${filePath} (checked skill dir and KB collections)`);
  }

  return { files, errors };
}
