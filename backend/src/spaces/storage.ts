/**
 * Space Storage Service
 *
 * YAML-based storage for spaces and related data.
 * File structure:
 *   /data/spaces/
 *     spaces.yaml                 - Index of all spaces
 *     {spaceId}/
 *       space.yaml               - Space metadata + settings
 *       memory.yaml                - Space memory
 *       members.yaml               - Member list
 *       kb-links.yaml              - KB collection links
 *       chats/
 *         {sessionId}.yaml         - Space chats
 */

import { mkdir, readdir, unlink, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';
import { SPACES_DIR, DATA_DIR } from '../utils/paths';
import { rename } from 'fs/promises';
import type {
  Space,
  SpaceMember,
  SpaceMemory,
  SpaceKBLinks,
  SpaceSettings,
  SpaceChat,
  SpaceChatMessage,
  AboutItem,
  InstructionItem,
  ContextItem,
  KBCollectionLink,
  MemorySource,
  Priority,
  MemorySection,
} from './types';
import { createDefaultSettings, createDefaultMemory, createDefaultKBLinks } from './types';
import { initializeResourceAccess, deleteResourceAccess } from '../rbac/storage';
import { generateId } from '../utils/id';

// =============================================================================
// File-level mutexes to prevent race conditions
// =============================================================================

const spaceLocks = new Map<string, Promise<void>>();

async function withSpaceLock<T>(spaceId: string, fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const prev = spaceLocks.get(spaceId) || Promise.resolve();
  const myLock = new Promise<void>((resolve) => { release = resolve; });
  spaceLocks.set(spaceId, myLock);
  await prev;
  try {
    return await fn();
  } finally {
    release!();
    if (spaceLocks.get(spaceId) === myLock) {
      spaceLocks.delete(spaceId);
    }
  }
}

let spacesIndexLock: Promise<void> = Promise.resolve();

async function withIndexLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const prev = spacesIndexLock;
  spacesIndexLock = new Promise<void>((resolve) => { release = resolve; });
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}

// Base directory for spaces storage
const SPACES_BASE_DIR = SPACES_DIR;

// =============================================================================
// One-time migration: data/projects/ → data/spaces/
// =============================================================================

const LEGACY_PROJECTS_DIR = join(DATA_DIR, 'projects');

if (existsSync(LEGACY_PROJECTS_DIR) && !existsSync(SPACES_BASE_DIR)) {
  // Step 1: Rename directory
  await rename(LEGACY_PROJECTS_DIR, SPACES_BASE_DIR).catch((err) => {
    console.error('[Migration] Failed to rename projects/ → spaces/:', err);
  });

  if (existsSync(SPACES_BASE_DIR)) {
    console.log('[Migration] Renamed data/projects/ → data/spaces/');

    // Step 2: Rename projects.yaml → spaces.yaml
    const legacyIndex = join(SPACES_BASE_DIR, 'projects.yaml');
    const newIndex = join(SPACES_BASE_DIR, 'spaces.yaml');
    if (existsSync(legacyIndex)) {
      await rename(legacyIndex, newIndex).catch(() => {});
      console.log('[Migration] Renamed projects.yaml → spaces.yaml');
    }

    // Step 3: Per-space directory migration
    try {
      const entries = await readdir(SPACES_BASE_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirPath = join(SPACES_BASE_DIR, entry.name);

        // Rename project.yaml → space.yaml inside each space dir
        const legacyMeta = join(dirPath, 'project.yaml');
        const newMeta = join(dirPath, 'space.yaml');
        if (existsSync(legacyMeta)) {
          await rename(legacyMeta, newMeta).catch(() => {});
        }

        // Rename proj_* directories to space_*
        if (entry.name.startsWith('proj_')) {
          const newName = entry.name.replace(/^proj_/, 'space_');
          const newDirPath = join(SPACES_BASE_DIR, newName);
          await rename(dirPath, newDirPath).catch(() => {});

          // Update ID inside space.yaml
          const escapedName = entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const yamlPath = join(newDirPath, 'space.yaml');
          if (existsSync(yamlPath)) {
            try {
              const content = await Bun.file(yamlPath).text();
              const updated = content.replace(new RegExp(escapedName, 'g'), newName);
              await Bun.write(yamlPath, updated);
            } catch (err) {
              console.error(`[Migration] Failed to update space.yaml for ${entry.name}:`, err);
            }
          }

          // Update memory.yaml spaceId
          const memPath = join(newDirPath, 'memory.yaml');
          if (existsSync(memPath)) {
            try {
              const content = await Bun.file(memPath).text();
              const updated = content.replace(new RegExp(escapedName, 'g'), newName);
              await Bun.write(memPath, updated);
            } catch (err) {
              console.error(`[Migration] Failed to update memory.yaml for ${entry.name}:`, err);
            }
          }

          // Update kb-links.yaml spaceId
          const kbPath = join(newDirPath, 'kb-links.yaml');
          if (existsSync(kbPath)) {
            try {
              const content = await Bun.file(kbPath).text();
              const updated = content.replace(new RegExp(escapedName, 'g'), newName);
              await Bun.write(kbPath, updated);
            } catch (err) {
              console.error(`[Migration] Failed to update kb-links.yaml for ${entry.name}:`, err);
            }
          }

          console.log(`[Migration] Renamed space ${entry.name} → ${newName}`);
        }
      }

      // Step 4: Update IDs in the index file
      const indexPath = join(SPACES_BASE_DIR, 'spaces.yaml');
      if (existsSync(indexPath)) {
        try {
          const content = await Bun.file(indexPath).text();
          const updated = content.replace(/proj_/g, 'space_');
          await Bun.write(indexPath, updated);
          console.log('[Migration] Updated IDs in spaces.yaml index');
        } catch (err) {
          console.error('[Migration] Failed to update spaces.yaml index:', err);
        }
      }

      console.log('[Migration] Projects → Spaces migration complete');
    } catch (err) {
      console.error('[Migration] Error during per-space migration:', err);
    }
  }
}

/**
 * Ensure the base spaces directory exists
 */
async function ensureBaseDir(): Promise<void> {
  if (!existsSync(SPACES_BASE_DIR)) {
    await mkdir(SPACES_BASE_DIR, { recursive: true });
  }
}

/**
 * Get space directory path
 */
function getSpaceDir(spaceId: string): string {
  return join(SPACES_BASE_DIR, spaceId);
}

/**
 * YAML stringify helper with consistent formatting
 */
function toYaml(data: any): string {
  return yaml.stringify(data, {
    indent: 2,
    lineWidth: 0,
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
  });
}

// =============================================================================
// Spaces Index
// =============================================================================

interface SpaceIndex {
  spaces: Array<{
    id: string;
    name: string;
    archived: boolean;
  }>;
  updatedAt: string;
}

async function loadSpacesIndex(): Promise<SpaceIndex> {
  const indexPath = join(SPACES_BASE_DIR, 'spaces.yaml');

  if (!existsSync(indexPath)) {
    return { spaces: [], updatedAt: '' };
  }

  try {
    const content = await Bun.file(indexPath).text();
    return yaml.parse(content) as SpaceIndex;
  } catch (error) {
    console.error('Error loading spaces index:', error);
    return { spaces: [], updatedAt: '' };
  }
}

async function saveSpacesIndex(index: SpaceIndex): Promise<void> {
  await ensureBaseDir();
  index.updatedAt = new Date().toISOString();
  const indexPath = join(SPACES_BASE_DIR, 'spaces.yaml');
  await Bun.write(indexPath, toYaml(index));
}

// =============================================================================
// Space CRUD
// =============================================================================

/**
 * Load a space by ID
 */
export async function loadSpace(spaceId: string): Promise<Space | null> {
  const spacePath = join(getSpaceDir(spaceId), 'space.yaml');

  if (!existsSync(spacePath)) {
    return null;
  }

  try {
    const content = await Bun.file(spacePath).text();
    const space = yaml.parse(content) as Space;

    // Ensure required fields exist
    if (!space.members) space.members = [];
    if (!space.settings) space.settings = createDefaultSettings();

    return space;
  } catch (error) {
    console.error(`Error loading space ${spaceId}:`, error);
    return null;
  }
}

/**
 * Save a space
 */
export async function saveSpace(space: Space): Promise<void> {
  const spaceDir = getSpaceDir(space.id);

  if (!existsSync(spaceDir)) {
    await mkdir(spaceDir, { recursive: true });
  }

  space.updatedAt = new Date().toISOString();
  const spacePath = join(spaceDir, 'space.yaml');
  await Bun.write(spacePath, toYaml(space));
}

/**
 * Create a new space
 */
export async function createSpace(
  name: string,
  createdBy: string,
  options?: {
    description?: string;
    icon?: string;
    color?: string;
  }
): Promise<Space> {
  await ensureBaseDir();

  const now = new Date().toISOString();
  const spaceId = generateId('space');

  const space: Space = {
    id: spaceId,
    name,
    description: options?.description,
    icon: options?.icon || 'briefcase',
    color: options?.color || '#9333ea',
    createdAt: now,
    updatedAt: now,
    createdBy,
    members: [
      {
        userId: createdBy,
        role: 'owner',
        addedAt: now,
        addedBy: createdBy,
      },
    ],
    settings: createDefaultSettings(),
    archived: false,
  };

  // Save space
  await saveSpace(space);

  // Initialize empty memory
  await saveSpaceMemory(createDefaultMemory(spaceId));

  // Initialize empty KB links
  await saveSpaceKBLinks(createDefaultKBLinks(spaceId));

  // Create chats directory
  const chatsDir = join(getSpaceDir(spaceId), 'chats');
  if (!existsSync(chatsDir)) {
    await mkdir(chatsDir, { recursive: true });
  }

  // Initialize RBAC access (creator as owner)
  await initializeResourceAccess('space', spaceId, createdBy);

  // Update index
  const index = await loadSpacesIndex();
  index.spaces.push({
    id: spaceId,
    name,
    archived: false,
  });
  await saveSpacesIndex(index);

  return space;
}

/**
 * Update a space
 */
export async function updateSpace(
  spaceId: string,
  updates: Partial<Pick<Space, 'name' | 'description' | 'icon' | 'color' | 'archived'>>
): Promise<Space | null> {
  return withSpaceLock(spaceId, async () => {
    const space = await loadSpace(spaceId);
    if (!space) return null;

    // Apply updates
    if (updates.name !== undefined) space.name = updates.name;
    if (updates.description !== undefined) space.description = updates.description;
    if (updates.icon !== undefined) space.icon = updates.icon;
    if (updates.color !== undefined) space.color = updates.color;
    if (updates.archived !== undefined) space.archived = updates.archived;

    await saveSpace(space);

    // Update index if name or archived changed
    if (updates.name !== undefined || updates.archived !== undefined) {
      await withIndexLock(async () => {
        const index = await loadSpacesIndex();
        const entry = index.spaces.find((p) => p.id === spaceId);
        if (entry) {
          if (updates.name !== undefined) entry.name = updates.name;
          if (updates.archived !== undefined) entry.archived = updates.archived;
          await saveSpacesIndex(index);
        }
      });
    }

    return space;
  });
}

/**
 * Delete a space and all its data
 */
export async function deleteSpace(spaceId: string): Promise<boolean> {
  const spaceDir = getSpaceDir(spaceId);

  if (!existsSync(spaceDir)) {
    return false;
  }

  try {
    // Remove entire space directory
    await rm(spaceDir, { recursive: true, force: true });

    // Clean up RBAC access entries
    await deleteResourceAccess('space', spaceId);

    // Update index
    const index = await loadSpacesIndex();
    index.spaces = index.spaces.filter((p) => p.id !== spaceId);
    await saveSpacesIndex(index);

    return true;
  } catch (error) {
    console.error(`Error deleting space ${spaceId}:`, error);
    return false;
  }
}

/**
 * List all spaces (optionally filtered by user membership)
 */
export async function listSpaces(userId?: string): Promise<Space[]> {
  await ensureBaseDir();

  const index = await loadSpacesIndex();
  const spaces: Space[] = [];

  for (const entry of index.spaces) {
    const space = await loadSpace(entry.id);
    if (!space) continue;

    // If userId is provided, filter to spaces where user is a member
    if (userId) {
      const isMember = space.members.some((m) => m.userId === userId);
      if (!isMember) continue;
    }

    spaces.push(space);
  }

  // Sort by updatedAt descending
  spaces.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return spaces;
}

// =============================================================================
// Space Members
// =============================================================================

/**
 * Get space members
 */
export async function getSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const space = await loadSpace(spaceId);
  return space?.members || [];
}

/**
 * Add a member to a space
 */
export async function addSpaceMember(
  spaceId: string,
  userId: string,
  role: SpaceMember['role'],
  addedBy: string
): Promise<SpaceMember | null> {
  return withSpaceLock(spaceId, async () => {
    const space = await loadSpace(spaceId);
    if (!space) return null;

    // Check if user is already a member
    const existing = space.members.find((m) => m.userId === userId);
    if (existing) {
      // Update role if already a member
      existing.role = role;
      await saveSpace(space);
      return existing;
    }

    const member: SpaceMember = {
      userId,
      role,
      addedAt: new Date().toISOString(),
      addedBy,
    };

    space.members.push(member);
    await saveSpace(space);

    return member;
  });
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  spaceId: string,
  userId: string,
  newRole: SpaceMember['role']
): Promise<boolean> {
  return withSpaceLock(spaceId, async () => {
    const space = await loadSpace(spaceId);
    if (!space) return false;

    const member = space.members.find((m) => m.userId === userId);
    if (!member) return false;

    member.role = newRole;
    await saveSpace(space);

    return true;
  });
}

/**
 * Remove a member from a space
 */
export async function removeSpaceMember(spaceId: string, userId: string): Promise<boolean> {
  return withSpaceLock(spaceId, async () => {
    const space = await loadSpace(spaceId);
    if (!space) return false;

    const initialLength = space.members.length;
    space.members = space.members.filter((m) => m.userId !== userId);

    if (space.members.length === initialLength) {
      return false; // Member not found
    }

    await saveSpace(space);
    return true;
  });
}

// =============================================================================
// Space Settings
// =============================================================================

/**
 * Update space settings
 */
export async function updateSpaceSettings(
  spaceId: string,
  updates: Partial<SpaceSettings>
): Promise<SpaceSettings | null> {
  return withSpaceLock(spaceId, async () => {
    const space = await loadSpace(spaceId);
    if (!space) return null;

    space.settings = { ...space.settings, ...updates };
    await saveSpace(space);

    return space.settings;
  });
}

// =============================================================================
// Space Memory
// =============================================================================

/**
 * Load space memory
 */
export async function loadSpaceMemory(spaceId: string): Promise<SpaceMemory> {
  const memoryPath = join(getSpaceDir(spaceId), 'memory.yaml');

  if (!existsSync(memoryPath)) {
    return createDefaultMemory(spaceId);
  }

  try {
    const content = await Bun.file(memoryPath).text();
    const memory = yaml.parse(content) as SpaceMemory;

    // Ensure all sections exist
    if (!memory.about) memory.about = [];
    if (!memory.instructions) memory.instructions = [];
    if (!memory.context) memory.context = [];

    return memory;
  } catch (error) {
    console.error(`Error loading space memory ${spaceId}:`, error);
    return createDefaultMemory(spaceId);
  }
}

/**
 * Save space memory
 */
export async function saveSpaceMemory(memory: SpaceMemory): Promise<void> {
  const spaceDir = getSpaceDir(memory.spaceId);

  if (!existsSync(spaceDir)) {
    await mkdir(spaceDir, { recursive: true });
  }

  memory.updatedAt = new Date().toISOString();
  const memoryPath = join(spaceDir, 'memory.yaml');
  await Bun.write(memoryPath, toYaml(memory));
}

/**
 * Add an about item to space memory
 */
export async function addSpaceAboutItem(
  spaceId: string,
  content: string,
  source: MemorySource = 'manual'
): Promise<AboutItem> {
  const memory = await loadSpaceMemory(spaceId);

  // Check for duplicates
  const exists = memory.about.some(
    (item) => item.content.toLowerCase() === content.toLowerCase()
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

  memory.about.push(item);
  await saveSpaceMemory(memory);

  return item;
}

/**
 * Add an instruction to space memory
 */
export async function addSpaceInstruction(
  spaceId: string,
  content: string,
  priority: Priority = 'normal',
  source: MemorySource = 'manual'
): Promise<InstructionItem> {
  const memory = await loadSpaceMemory(spaceId);

  // Check for duplicates
  const exists = memory.instructions.some(
    (item) => item.content.toLowerCase() === content.toLowerCase()
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

  memory.instructions.push(item);
  await saveSpaceMemory(memory);

  return item;
}

/**
 * Add a context item to space memory
 */
export async function addSpaceContextItem(
  spaceId: string,
  name: string,
  description?: string,
  active: boolean = true,
  source: MemorySource = 'manual'
): Promise<ContextItem> {
  const memory = await loadSpaceMemory(spaceId);

  // Check for duplicates
  const existingIndex = memory.context.findIndex(
    (item) => item.name.toLowerCase() === name.toLowerCase()
  );

  if (existingIndex !== -1) {
    // Update existing
    const existing = memory.context[existingIndex];
    if (existing) {
      existing.description = description;
      existing.active = active;
      await saveSpaceMemory(memory);
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

  memory.context.push(item);
  await saveSpaceMemory(memory);

  return item;
}

/**
 * Delete a memory item
 */
export async function deleteSpaceMemoryItem(
  spaceId: string,
  section: MemorySection,
  itemId: string
): Promise<boolean> {
  const memory = await loadSpaceMemory(spaceId);

  const initialLength = memory[section].length;
  (memory[section] as Array<{ id: string }>) = (memory[section] as Array<{ id: string }>).filter(
    item => item.id !== itemId
  );

  if (memory[section].length === initialLength) {
    return false;
  }

  await saveSpaceMemory(memory);
  return true;
}

/**
 * Toggle context item active status
 */
export async function setSpaceContextActive(
  spaceId: string,
  itemId: string,
  active: boolean
): Promise<boolean> {
  const memory = await loadSpaceMemory(spaceId);

  const item = memory.context.find((c) => c.id === itemId);
  if (!item) return false;

  item.active = active;
  await saveSpaceMemory(memory);

  return true;
}

/**
 * Format space memory for prompt injection
 */
export function formatSpaceMemoryForPrompt(
  memory: SpaceMemory,
  spaceName: string
): string {
  const lines: string[] = [];

  lines.push(`# Space-Kontext: ${spaceName}`);
  lines.push('');

  // About section
  if (memory.about.length > 0) {
    lines.push('## Ueber den Space');
    memory.about.forEach((item) => {
      lines.push(`- ${item.content}`);
    });
    lines.push('');
  }

  // Instructions section (high priority first)
  if (memory.instructions.length > 0) {
    const sorted = [...memory.instructions].sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      return 0;
    });

    lines.push('## Space-Anweisungen');
    sorted.forEach((item) => {
      const prefix = item.priority === 'high' ? '[WICHTIG] ' : '';
      lines.push(`- ${prefix}${item.content}`);
    });
    lines.push('');
  }

  // Context section (only active items)
  const activeContext = memory.context.filter((item) => item.active);
  if (activeContext.length > 0) {
    lines.push('## Aktuelle Phase');
    activeContext.forEach((item) => {
      if (item.description) {
        lines.push(`- **${item.name}**: ${item.description}`);
      } else {
        lines.push(`- ${item.name}`);
      }
    });
    lines.push('');
  }

  if (lines.length <= 2) {
    return '';
  }

  return lines.join('\n');
}

// =============================================================================
// Space KB Links
// =============================================================================

/**
 * Load space KB links
 */
export async function loadSpaceKBLinks(spaceId: string): Promise<SpaceKBLinks> {
  const linksPath = join(getSpaceDir(spaceId), 'kb-links.yaml');

  if (!existsSync(linksPath)) {
    return createDefaultKBLinks(spaceId);
  }

  try {
    const content = await Bun.file(linksPath).text();
    const links = yaml.parse(content) as SpaceKBLinks;

    if (!links.collections) links.collections = [];

    return links;
  } catch (error) {
    console.error(`Error loading space KB links ${spaceId}:`, error);
    return createDefaultKBLinks(spaceId);
  }
}

/**
 * Save space KB links
 */
export async function saveSpaceKBLinks(links: SpaceKBLinks): Promise<void> {
  const spaceDir = getSpaceDir(links.spaceId);

  if (!existsSync(spaceDir)) {
    await mkdir(spaceDir, { recursive: true });
  }

  links.updatedAt = new Date().toISOString();
  const linksPath = join(spaceDir, 'kb-links.yaml');
  await Bun.write(linksPath, toYaml(links));
}

/**
 * Link a KB collection to a space
 */
export async function linkKBCollection(
  spaceId: string,
  collectionId: string,
  linkedBy: string
): Promise<KBCollectionLink | null> {
  const links = await loadSpaceKBLinks(spaceId);

  // Check if already linked
  const existing = links.collections.find((c) => c.collectionId === collectionId);
  if (existing) {
    return existing;
  }

  const link: KBCollectionLink = {
    collectionId,
    linkedAt: new Date().toISOString(),
    linkedBy,
  };

  links.collections.push(link);
  await saveSpaceKBLinks(links);

  return link;
}

/**
 * Unlink a KB collection from a space
 */
export async function unlinkKBCollection(
  spaceId: string,
  collectionId: string
): Promise<boolean> {
  const links = await loadSpaceKBLinks(spaceId);

  const initialLength = links.collections.length;
  links.collections = links.collections.filter((c) => c.collectionId !== collectionId);

  if (links.collections.length === initialLength) {
    return false;
  }

  await saveSpaceKBLinks(links);
  return true;
}

/**
 * Get linked KB collection IDs for a space
 */
export async function getSpaceKBCollectionIds(spaceId: string): Promise<string[]> {
  const links = await loadSpaceKBLinks(spaceId);
  return links.collections.map((c) => c.collectionId);
}

// =============================================================================
// Space Chats
// =============================================================================

/**
 * List chats for a space
 */
export async function listSpaceChats(spaceId: string): Promise<Array<{
  id: string;
  title: string;
  summary?: string;
  updatedAt: string;
  userId: string;
}>> {
  const chatsDir = join(getSpaceDir(spaceId), 'chats');

  if (!existsSync(chatsDir)) {
    return [];
  }

  try {
    const files = await readdir(chatsDir);
    const summaries: Array<{
      id: string;
      title: string;
      summary?: string;
      updatedAt: string;
      userId: string;
    }> = [];

    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;

      try {
        const content = await Bun.file(join(chatsDir, file)).text();
        const chat = yaml.parse(content) as SpaceChat;

        summaries.push({
          id: chat.id,
          title: chat.title,
          summary: chat.summary,
          updatedAt: chat.updatedAt,
          userId: chat.userId,
        });
      } catch {}
    }

    // Sort by updatedAt descending
    summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return summaries;
  } catch (error) {
    console.error(`Error listing space chats ${spaceId}:`, error);
    return [];
  }
}

/**
 * Load a space chat
 */
export async function loadSpaceChat(
  spaceId: string,
  chatId: string
): Promise<SpaceChat | null> {
  const chatPath = join(getSpaceDir(spaceId), 'chats', `${chatId}.yaml`);

  if (!existsSync(chatPath)) {
    return null;
  }

  try {
    const content = await Bun.file(chatPath).text();
    return yaml.parse(content) as SpaceChat;
  } catch (error) {
    console.error(`Error loading space chat ${chatId}:`, error);
    return null;
  }
}

/**
 * Save a space chat
 */
export async function saveSpaceChat(chat: SpaceChat): Promise<void> {
  const chatsDir = join(getSpaceDir(chat.spaceId), 'chats');

  if (!existsSync(chatsDir)) {
    await mkdir(chatsDir, { recursive: true });
  }

  chat.updatedAt = new Date().toISOString();
  const chatPath = join(chatsDir, `${chat.id}.yaml`);
  await Bun.write(chatPath, toYaml(chat));
}

/**
 * Delete a space chat
 */
export async function deleteSpaceChat(spaceId: string, chatId: string): Promise<boolean> {
  const chatPath = join(getSpaceDir(spaceId), 'chats', `${chatId}.yaml`);

  if (!existsSync(chatPath)) {
    return false;
  }

  try {
    await unlink(chatPath);
    return true;
  } catch (error) {
    console.error(`Error deleting space chat ${chatId}:`, error);
    return false;
  }
}
