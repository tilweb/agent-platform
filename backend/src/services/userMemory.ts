/**
 * User Memory Service (v2)
 *
 * Simplified structure with three core sections:
 * - about: Who is the user? (facts, bio, background)
 * - instructions: How should I respond? (preferences, style, rules)
 * - context: What is the user working on? (projects, current tasks)
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';
import * as yaml from 'yaml';
import { generateId } from '../utils/id';

// Types
export type MemorySection = 'about' | 'instructions' | 'context';
export type MemorySource = 'manual' | 'agent';
export type Priority = 'high' | 'normal';

export interface AboutItem {
  id: string;
  content: string;
  added_at: string;
  source: MemorySource;
}

export interface InstructionItem {
  id: string;
  content: string;
  priority: Priority;
  added_at: string;
  source: MemorySource;
}

export interface ContextItem {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  added_at: string;
  source: MemorySource;
}

export interface MemorySettings {
  include_in_prompt: boolean;
  max_items_per_section: number;
}

export interface UserMemory {
  user_id: string;
  updated_at: string;
  about: AboutItem[];
  instructions: InstructionItem[];
  context: ContextItem[];
  settings: MemorySettings;
}

// Constants
const MEMORY_BASE_DIR = resolve(process.cwd(), '../data/memory/users');
const ALL_SECTIONS: MemorySection[] = ['about', 'instructions', 'context'];

// generateId is imported from ../utils/id

/**
 * Get the path to the user memory file
 */
function getUserMemoryPath(userId: string = 'default'): string {
  return resolve(MEMORY_BASE_DIR, `${userId}.yaml`);
}

/**
 * Create default empty memory structure
 */
function createDefaultMemory(userId: string = 'default'): UserMemory {
  return {
    user_id: userId,
    updated_at: '',
    about: [],
    instructions: [],
    context: [],
    settings: {
      include_in_prompt: true,
      max_items_per_section: 15,
    },
  };
}

/**
 * Load user memory from YAML file
 */
export async function loadUserMemory(userId: string = 'default'): Promise<UserMemory> {
  const filePath = getUserMemoryPath(userId);

  if (!existsSync(filePath)) {
    const defaultMemory = createDefaultMemory(userId);
    await saveUserMemory(defaultMemory);
    return defaultMemory;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = yaml.parse(content) as UserMemory;

    // Ensure all sections exist
    if (!parsed.about) parsed.about = [];
    if (!parsed.instructions) parsed.instructions = [];
    if (!parsed.context) parsed.context = [];

    // Ensure settings exist
    if (!parsed.settings) {
      parsed.settings = {
        include_in_prompt: true,
        max_items_per_section: 15,
      };
    }

    return parsed;
  } catch (error: any) {
    console.error('Error loading user memory:', error);
    return createDefaultMemory(userId);
  }
}

/**
 * Save user memory to YAML file
 */
export async function saveUserMemory(memory: UserMemory): Promise<void> {
  const filePath = getUserMemoryPath(memory.user_id);

  if (!existsSync(MEMORY_BASE_DIR)) {
    await mkdir(MEMORY_BASE_DIR, { recursive: true });
  }

  memory.updated_at = new Date().toISOString();

  const yamlContent = yaml.stringify(memory, {
    indent: 2,
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  });

  await writeFile(filePath, yamlContent, 'utf-8');
}

/**
 * Add an "about" item (facts about the user)
 */
export async function addAboutItem(
  content: string,
  source: MemorySource = 'manual',
  userId: string = 'default'
): Promise<AboutItem> {
  const memory = await loadUserMemory(userId);

  // Check for duplicates
  const exists = memory.about.some(
    item => item.content.toLowerCase() === content.toLowerCase()
  );
  if (exists) {
    throw new Error('Diese Information existiert bereits.');
  }

  const item: AboutItem = {
    id: generateId('about'),
    content,
    added_at: new Date().toISOString(),
    source,
  };

  // Enforce max items
  if (memory.about.length >= memory.settings.max_items_per_section) {
    memory.about.shift();
  }

  memory.about.push(item);
  await saveUserMemory(memory);

  return item;
}

/**
 * Add an instruction (how the assistant should behave)
 */
export async function addInstruction(
  content: string,
  priority: Priority = 'normal',
  source: MemorySource = 'manual',
  userId: string = 'default'
): Promise<InstructionItem> {
  const memory = await loadUserMemory(userId);

  // Check for duplicates
  const exists = memory.instructions.some(
    item => item.content.toLowerCase() === content.toLowerCase()
  );
  if (exists) {
    throw new Error('Diese Anweisung existiert bereits.');
  }

  const item: InstructionItem = {
    id: generateId('inst'),
    content,
    priority,
    added_at: new Date().toISOString(),
    source,
  };

  // Enforce max items
  if (memory.instructions.length >= memory.settings.max_items_per_section) {
    // Remove oldest normal priority item
    const normalIndex = memory.instructions.findIndex(i => i.priority === 'normal');
    if (normalIndex !== -1) {
      memory.instructions.splice(normalIndex, 1);
    } else {
      memory.instructions.shift();
    }
  }

  memory.instructions.push(item);
  await saveUserMemory(memory);

  return item;
}

/**
 * Add or update a context item (current project/task)
 */
export async function addContextItem(
  name: string,
  description?: string,
  active: boolean = true,
  source: MemorySource = 'manual',
  userId: string = 'default'
): Promise<ContextItem> {
  const memory = await loadUserMemory(userId);

  // Check if context with same name exists
  const existingIndex = memory.context.findIndex(
    item => item.name.toLowerCase() === name.toLowerCase()
  );

  if (existingIndex !== -1) {
    // Update existing
    const existing = memory.context[existingIndex];
    if (existing) {
      existing.description = description;
      existing.active = active;
      await saveUserMemory(memory);
      return existing;
    }
  }

  const item: ContextItem = {
    id: generateId('ctx'),
    name,
    description,
    active,
    added_at: new Date().toISOString(),
    source,
  };

  // Enforce max items
  if (memory.context.length >= memory.settings.max_items_per_section) {
    // Remove oldest inactive item
    const inactiveIndex = memory.context.findIndex(i => !i.active);
    if (inactiveIndex !== -1) {
      memory.context.splice(inactiveIndex, 1);
    } else {
      memory.context.shift();
    }
  }

  memory.context.push(item);
  await saveUserMemory(memory);

  return item;
}

/**
 * Delete a memory item from any section
 */
export async function deleteMemoryItem(
  section: MemorySection,
  itemId: string,
  userId: string = 'default'
): Promise<boolean> {
  const memory = await loadUserMemory(userId);

  const initialLength = memory[section].length;
  (memory[section] as any[]) = (memory[section] as any[]).filter(
    (item: any) => item.id !== itemId
  );

  if (memory[section].length === initialLength) {
    return false;
  }

  await saveUserMemory(memory);
  return true;
}

/**
 * Update a context item's active status
 */
export async function setContextActive(
  itemId: string,
  active: boolean,
  userId: string = 'default'
): Promise<boolean> {
  const memory = await loadUserMemory(userId);

  const item = memory.context.find(i => i.id === itemId);
  if (!item) return false;

  item.active = active;
  await saveUserMemory(memory);
  return true;
}

/**
 * Update memory settings
 */
export async function updateMemorySettings(
  updates: Partial<MemorySettings>,
  userId: string = 'default'
): Promise<MemorySettings> {
  const memory = await loadUserMemory(userId);

  memory.settings = {
    ...memory.settings,
    ...updates,
  };

  await saveUserMemory(memory);
  return memory.settings;
}

/**
 * Format memory for injection into agent prompt
 */
export function formatMemoryForPrompt(memory: UserMemory): string {
  const { settings, about, instructions, context } = memory;

  if (!settings.include_in_prompt) {
    return '';
  }

  const lines: string[] = [];

  // About section
  if (about.length > 0) {
    lines.push('## Ueber den Benutzer');
    about.forEach(item => {
      lines.push(`- ${item.content}`);
    });
    lines.push('');
  }

  // Instructions section (high priority first)
  if (instructions.length > 0) {
    const sorted = [...instructions].sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      return 0;
    });

    lines.push('## Benutzer-Anweisungen');
    sorted.forEach(item => {
      const prefix = item.priority === 'high' ? '[WICHTIG] ' : '';
      lines.push(`- ${prefix}${item.content}`);
    });
    lines.push('');
  }

  // Context section (only active items)
  const activeContext = context.filter(item => item.active);
  if (activeContext.length > 0) {
    lines.push('## Aktueller Kontext');
    activeContext.forEach(item => {
      if (item.description) {
        lines.push(`- **${item.name}**: ${item.description}`);
      } else {
        lines.push(`- ${item.name}`);
      }
    });
    lines.push('');
  }

  if (lines.length === 0) {
    return '';
  }

  return `# Benutzer-Profil\n\n${lines.join('\n')}`;
}

/**
 * Check if a section name is valid
 */
export function isValidSection(section: string): section is MemorySection {
  return ALL_SECTIONS.includes(section as MemorySection);
}

/**
 * Get all valid sections
 */
export function getAllSections(): MemorySection[] {
  return [...ALL_SECTIONS];
}

// Legacy compatibility exports (deprecated)
export type Category = MemorySection;
export const isValidCategory = isValidSection;
export const getAllCategories = getAllSections;
