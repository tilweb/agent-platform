/**
 * User Memory Service (v2) — Postgres-backed.
 *
 * Speicherung: ein Eintrag pro User in `memory.user` mit `key='memory'`
 * und der kompletten Memory-Struktur als jsonb-Wert. Schreibhaeufigkeit
 * niedrig genug fuer "delete + insert"-Style updates.
 */

import { and, eq } from 'drizzle-orm';
import { getDb } from '../db';
import { userMemory } from '../db/schema/memory';

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

const ALL_SECTIONS: MemorySection[] = ['about', 'instructions', 'context'];
const MEMORY_KEY = 'memory';

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${timestamp}${random}`;
}

function memoryRowId(userId: string): string {
  return `mem_${userId}`;
}

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

export async function loadUserMemory(userId: string = 'default'): Promise<UserMemory> {
  const db = getDb();
  const rows = await db
    .select()
    .from(userMemory)
    .where(and(eq(userMemory.userId, userId), eq(userMemory.key, MEMORY_KEY)))
    .limit(1);
  if (!rows[0]) {
    const def = createDefaultMemory(userId);
    await saveUserMemory(def);
    return def;
  }
  const value = (rows[0].value ?? {}) as Partial<UserMemory>;
  return {
    user_id: userId,
    updated_at: value.updated_at ?? '',
    about: value.about ?? [],
    instructions: value.instructions ?? [],
    context: value.context ?? [],
    settings: value.settings ?? {
      include_in_prompt: true,
      max_items_per_section: 15,
    },
  };
}

export async function saveUserMemory(memory: UserMemory): Promise<void> {
  memory.updated_at = new Date().toISOString();
  const db = getDb();
  const id = memoryRowId(memory.user_id);
  await db.insert(userMemory).values({
    id,
    userId: memory.user_id,
    key: MEMORY_KEY,
    value: memory as never,
    createdAt: memory.updated_at,
    updatedAt: memory.updated_at,
  }).onConflictDoUpdate({
    target: userMemory.id,
    set: {
      value: memory as never,
      updatedAt: memory.updated_at,
    },
  });
}

export async function addAboutItem(
  content: string,
  source: MemorySource = 'manual',
  userId: string = 'default',
): Promise<AboutItem> {
  const memory = await loadUserMemory(userId);
  if (memory.about.some(i => i.content.toLowerCase() === content.toLowerCase())) {
    throw new Error('Diese Information existiert bereits.');
  }
  const item: AboutItem = {
    id: generateId('about'),
    content,
    added_at: new Date().toISOString(),
    source,
  };
  if (memory.about.length >= memory.settings.max_items_per_section) memory.about.shift();
  memory.about.push(item);
  await saveUserMemory(memory);
  return item;
}

export async function addInstruction(
  content: string,
  priority: Priority = 'normal',
  source: MemorySource = 'manual',
  userId: string = 'default',
): Promise<InstructionItem> {
  const memory = await loadUserMemory(userId);
  if (memory.instructions.some(i => i.content.toLowerCase() === content.toLowerCase())) {
    throw new Error('Diese Anweisung existiert bereits.');
  }
  const item: InstructionItem = {
    id: generateId('inst'),
    content,
    priority,
    added_at: new Date().toISOString(),
    source,
  };
  if (memory.instructions.length >= memory.settings.max_items_per_section) {
    const normalIndex = memory.instructions.findIndex(i => i.priority === 'normal');
    if (normalIndex !== -1) memory.instructions.splice(normalIndex, 1);
    else memory.instructions.shift();
  }
  memory.instructions.push(item);
  await saveUserMemory(memory);
  return item;
}

export async function addContextItem(
  name: string,
  description?: string,
  active: boolean = true,
  source: MemorySource = 'manual',
  userId: string = 'default',
): Promise<ContextItem> {
  const memory = await loadUserMemory(userId);
  const existingIndex = memory.context.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
  if (existingIndex !== -1) {
    const existing = memory.context[existingIndex]!;
    existing.description = description;
    existing.active = active;
    await saveUserMemory(memory);
    return existing;
  }
  const item: ContextItem = {
    id: generateId('ctx'),
    name,
    description,
    active,
    added_at: new Date().toISOString(),
    source,
  };
  if (memory.context.length >= memory.settings.max_items_per_section) {
    const inactiveIndex = memory.context.findIndex(i => !i.active);
    if (inactiveIndex !== -1) memory.context.splice(inactiveIndex, 1);
    else memory.context.shift();
  }
  memory.context.push(item);
  await saveUserMemory(memory);
  return item;
}

export async function deleteMemoryItem(
  section: MemorySection,
  itemId: string,
  userId: string = 'default',
): Promise<boolean> {
  const memory = await loadUserMemory(userId);
  const initialLength = memory[section].length;
  (memory[section] as any[]) = (memory[section] as any[]).filter((item: any) => item.id !== itemId);
  if (memory[section].length === initialLength) return false;
  await saveUserMemory(memory);
  return true;
}

export async function setContextActive(
  itemId: string,
  active: boolean,
  userId: string = 'default',
): Promise<boolean> {
  const memory = await loadUserMemory(userId);
  const item = memory.context.find(i => i.id === itemId);
  if (!item) return false;
  item.active = active;
  await saveUserMemory(memory);
  return true;
}

export async function updateMemorySettings(
  updates: Partial<MemorySettings>,
  userId: string = 'default',
): Promise<MemorySettings> {
  const memory = await loadUserMemory(userId);
  memory.settings = { ...memory.settings, ...updates };
  await saveUserMemory(memory);
  return memory.settings;
}

export function formatMemoryForPrompt(memory: UserMemory): string {
  const { settings, about, instructions, context } = memory;
  if (!settings.include_in_prompt) return '';
  const lines: string[] = [];

  if (about.length > 0) {
    lines.push('## Ueber den Benutzer');
    about.forEach(item => lines.push(`- ${item.content}`));
    lines.push('');
  }

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

  const activeContext = context.filter(i => i.active);
  if (activeContext.length > 0) {
    lines.push('## Aktueller Kontext');
    activeContext.forEach(item => {
      if (item.description) lines.push(`- **${item.name}**: ${item.description}`);
      else lines.push(`- ${item.name}`);
    });
    lines.push('');
  }

  if (lines.length === 0) return '';
  return `# Benutzer-Profil\n\n${lines.join('\n')}`;
}

export function isValidSection(section: string): section is MemorySection {
  return ALL_SECTIONS.includes(section as MemorySection);
}

export function getAllSections(): MemorySection[] {
  return [...ALL_SECTIONS];
}

export type Category = MemorySection;
export const isValidCategory = isValidSection;
export const getAllCategories = getAllSections;
