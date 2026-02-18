import { readFile, readdir, writeFile, mkdir, rm } from 'fs/promises';
import { join, resolve, basename, dirname } from 'path';
import { existsSync } from 'fs';

const SKILLS_DIR = resolve(process.cwd(), '../data/skills');

export interface Skill {
  name: string;
  keywords: string[];
  content: string;
  path: string;
}

interface SkillMetadata {
  name: string;
  keywords: string[];
}

function parseSkillMetadata(content: string): SkillMetadata | null {
  // Extract YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch || !frontmatterMatch[1]) return null;

  const frontmatter = frontmatterMatch[1];
  const lines = frontmatter.split('\n');

  const metadata: SkillMetadata = {
    name: '',
    keywords: [],
  };

  for (const line of lines) {
    if (line.startsWith('name:')) {
      metadata.name = line.slice(5).trim().replace(/["']/g, '');
    } else if (line.startsWith('keywords:')) {
      // Single line array format: keywords: [schreibe, verfasse, text]
      const arrayMatch = line.match(/\[(.*)\]/);
      if (arrayMatch && arrayMatch[1]) {
        metadata.keywords = arrayMatch[1].split(',').map(k => k.trim().replace(/["']/g, ''));
      }
    } else if (line.startsWith('  - ') || line.startsWith('- ')) {
      // Multi-line array format
      const keyword = line.replace(/^[\s-]+/, '').trim().replace(/["']/g, '');
      if (keyword) {
        metadata.keywords.push(keyword);
      }
    }
  }

  return metadata;
}

async function loadSkillsFromDir(dir: string, visibility: string): Promise<Skill[]> {
  const skills: Skill[] = [];
  const fullDir = join(SKILLS_DIR, visibility);

  if (!existsSync(fullDir)) {
    return skills;
  }

  const entries = await readdir(fullDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillPath = join(fullDir, entry.name, 'SKILL.md');
      if (existsSync(skillPath)) {
        try {
          const content = await readFile(skillPath, 'utf-8');
          const metadata = parseSkillMetadata(content);

          if (metadata) {
            skills.push({
              name: metadata.name || entry.name,
              keywords: metadata.keywords,
              content,
              path: skillPath,
            });
          }
        } catch (e) {
          console.error(`Error loading skill from ${skillPath}:`, e);
        }
      }
    }
  }

  return skills;
}

let cachedSkills: Skill[] | null = null;

export async function loadSkills(): Promise<Skill[]> {
  if (cachedSkills) return cachedSkills;

  const publicSkills = await loadSkillsFromDir(SKILLS_DIR, 'public');
  cachedSkills = [...publicSkills];

  console.log(`Loaded ${cachedSkills.length} skills`);
  return cachedSkills;
}

export async function matchSkills(userMessage: string): Promise<Skill[]> {
  const skills = await loadSkills();
  const messageLower = userMessage.toLowerCase();

  return skills.filter(skill =>
    skill.keywords.some(keyword =>
      messageLower.includes(keyword.toLowerCase())
    )
  );
}

export function formatSkillsForContext(skills: Skill[]): string {
  if (skills.length === 0) return '';

  const parts = skills.map(skill => {
    // Remove frontmatter from content
    const contentWithoutFrontmatter = skill.content.replace(/^---\n[\s\S]*?\n---\n/, '');
    return `## Skill: ${skill.name}\n\n${contentWithoutFrontmatter}`;
  });

  return `\n\n# Active Skills\n\n${parts.join('\n\n')}`;
}

// Allow cache invalidation for development
export function clearSkillsCache(): void {
  cachedSkills = null;
}

/**
 * Get skill ID from path
 */
function getSkillId(skillPath: string): string {
  // Extract directory name as skill ID
  const dir = dirname(skillPath);
  return basename(dir);
}

/**
 * Get a skill by its ID
 */
export async function getSkillById(skillId: string): Promise<Skill | null> {
  const skills = await loadSkills();
  return skills.find(s => getSkillId(s.path) === skillId) || null;
}

/**
 * Generate skill markdown content
 */
function generateSkillMarkdown(skill: { name: string; keywords: string[]; content: string }): string {
  const lines: string[] = ['---'];

  lines.push(`name: "${skill.name}"`);

  if (skill.keywords.length > 0) {
    lines.push(`keywords: [${skill.keywords.join(', ')}]`);
  }

  lines.push('---');
  lines.push('');
  lines.push(skill.content);

  return lines.join('\n');
}

/**
 * Create a new skill
 */
export async function createSkill(skillData: {
  id: string;
  name: string;
  keywords: string[];
  content: string;
}): Promise<Skill> {
  // Validate ID format
  if (!/^[a-z0-9_-]+$/.test(skillData.id)) {
    throw new Error('Skill ID must contain only lowercase letters, numbers, hyphens and underscores');
  }

  // Check if skill already exists
  const skillDir = join(SKILLS_DIR, 'public', skillData.id);
  if (existsSync(skillDir)) {
    throw new Error(`Skill with ID "${skillData.id}" already exists`);
  }

  // Create skill directory
  await mkdir(skillDir, { recursive: true });

  // Create SKILL.md file
  const skillPath = join(skillDir, 'SKILL.md');
  const markdownContent = generateSkillMarkdown({
    name: skillData.name,
    keywords: skillData.keywords,
    content: skillData.content,
  });

  await writeFile(skillPath, markdownContent, 'utf-8');

  // Clear cache and reload
  clearSkillsCache();

  const skill = await getSkillById(skillData.id);
  if (!skill) {
    throw new Error('Failed to create skill');
  }

  return skill;
}

/**
 * Update an existing skill
 */
export async function updateSkill(skillId: string, skillData: {
  name?: string;
  keywords?: string[];
  content?: string;
}): Promise<Skill> {
  const existing = await getSkillById(skillId);
  if (!existing) {
    throw new Error(`Skill "${skillId}" not found`);
  }

  // Extract content without frontmatter
  const existingContent = existing.content.replace(/^---\n[\s\S]*?\n---\n/, '').trim();

  // Create updated content
  const updatedMarkdown = generateSkillMarkdown({
    name: skillData.name ?? existing.name,
    keywords: skillData.keywords ?? existing.keywords,
    content: skillData.content ?? existingContent,
  });

  await writeFile(existing.path, updatedMarkdown, 'utf-8');

  // Clear cache and reload
  clearSkillsCache();

  const updated = await getSkillById(skillId);
  if (!updated) {
    throw new Error('Failed to update skill');
  }

  return updated;
}

/**
 * Delete a skill
 */
export async function deleteSkill(skillId: string): Promise<void> {
  const existing = await getSkillById(skillId);
  if (!existing) {
    throw new Error(`Skill "${skillId}" not found`);
  }

  // Delete skill directory
  const skillDir = dirname(existing.path);
  await rm(skillDir, { recursive: true });

  // Clear cache
  clearSkillsCache();
}
