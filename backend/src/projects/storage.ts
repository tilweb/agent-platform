/**
 * Project Storage Service
 *
 * YAML-based storage for projects and related data.
 * File structure:
 *   /data/projects/
 *     projects.yaml                 - Index of all projects
 *     {projectId}/
 *       project.yaml               - Project metadata + settings
 *       memory.yaml                - Project memory
 *       members.yaml               - Member list
 *       kb-links.yaml              - KB collection links
 *       chats/
 *         {sessionId}.yaml         - Project chats
 */

import { readFile, writeFile, mkdir, readdir, unlink, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import * as yaml from 'yaml';
import type {
  Project,
  ProjectMember,
  ProjectMemory,
  ProjectKBLinks,
  ProjectSettings,
  ProjectChat,
  ProjectChatMessage,
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

// Base directory for projects storage
const PROJECTS_BASE_DIR = resolve(process.cwd(), '../data/projects');

/**
 * Ensure the base projects directory exists
 */
async function ensureBaseDir(): Promise<void> {
  if (!existsSync(PROJECTS_BASE_DIR)) {
    await mkdir(PROJECTS_BASE_DIR, { recursive: true });
  }
}

/**
 * Get project directory path
 */
function getProjectDir(projectId: string): string {
  return join(PROJECTS_BASE_DIR, projectId);
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
// Projects Index
// =============================================================================

interface ProjectIndex {
  projects: Array<{
    id: string;
    name: string;
    archived: boolean;
  }>;
  updatedAt: string;
}

async function loadProjectsIndex(): Promise<ProjectIndex> {
  const indexPath = join(PROJECTS_BASE_DIR, 'projects.yaml');

  if (!existsSync(indexPath)) {
    return { projects: [], updatedAt: '' };
  }

  try {
    const content = await readFile(indexPath, 'utf-8');
    return yaml.parse(content) as ProjectIndex;
  } catch (error) {
    console.error('Error loading projects index:', error);
    return { projects: [], updatedAt: '' };
  }
}

async function saveProjectsIndex(index: ProjectIndex): Promise<void> {
  await ensureBaseDir();
  index.updatedAt = new Date().toISOString();
  const indexPath = join(PROJECTS_BASE_DIR, 'projects.yaml');
  await writeFile(indexPath, toYaml(index), 'utf-8');
}

// =============================================================================
// Project CRUD
// =============================================================================

/**
 * Load a project by ID
 */
export async function loadProject(projectId: string): Promise<Project | null> {
  const projectPath = join(getProjectDir(projectId), 'project.yaml');

  if (!existsSync(projectPath)) {
    return null;
  }

  try {
    const content = await readFile(projectPath, 'utf-8');
    const project = yaml.parse(content) as Project;

    // Ensure required fields exist
    if (!project.members) project.members = [];
    if (!project.settings) project.settings = createDefaultSettings();

    return project;
  } catch (error) {
    console.error(`Error loading project ${projectId}:`, error);
    return null;
  }
}

/**
 * Save a project
 */
export async function saveProject(project: Project): Promise<void> {
  const projectDir = getProjectDir(project.id);

  if (!existsSync(projectDir)) {
    await mkdir(projectDir, { recursive: true });
  }

  project.updatedAt = new Date().toISOString();
  const projectPath = join(projectDir, 'project.yaml');
  await writeFile(projectPath, toYaml(project), 'utf-8');
}

/**
 * Create a new project
 */
export async function createProject(
  name: string,
  createdBy: string,
  options?: {
    description?: string;
    icon?: string;
    color?: string;
  }
): Promise<Project> {
  await ensureBaseDir();

  const now = new Date().toISOString();
  const projectId = generateId('proj');

  const project: Project = {
    id: projectId,
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

  // Save project
  await saveProject(project);

  // Initialize empty memory
  await saveProjectMemory(createDefaultMemory(projectId));

  // Initialize empty KB links
  await saveProjectKBLinks(createDefaultKBLinks(projectId));

  // Create chats directory
  const chatsDir = join(getProjectDir(projectId), 'chats');
  if (!existsSync(chatsDir)) {
    await mkdir(chatsDir, { recursive: true });
  }

  // Initialize RBAC access (creator as owner)
  await initializeResourceAccess('project', projectId, createdBy);

  // Update index
  const index = await loadProjectsIndex();
  index.projects.push({
    id: projectId,
    name,
    archived: false,
  });
  await saveProjectsIndex(index);

  return project;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'icon' | 'color' | 'archived'>>
): Promise<Project | null> {
  const project = await loadProject(projectId);
  if (!project) return null;

  // Apply updates
  if (updates.name !== undefined) project.name = updates.name;
  if (updates.description !== undefined) project.description = updates.description;
  if (updates.icon !== undefined) project.icon = updates.icon;
  if (updates.color !== undefined) project.color = updates.color;
  if (updates.archived !== undefined) project.archived = updates.archived;

  await saveProject(project);

  // Update index if name or archived changed
  if (updates.name !== undefined || updates.archived !== undefined) {
    const index = await loadProjectsIndex();
    const entry = index.projects.find((p) => p.id === projectId);
    if (entry) {
      if (updates.name !== undefined) entry.name = updates.name;
      if (updates.archived !== undefined) entry.archived = updates.archived;
      await saveProjectsIndex(index);
    }
  }

  return project;
}

/**
 * Delete a project and all its data
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  const projectDir = getProjectDir(projectId);

  if (!existsSync(projectDir)) {
    return false;
  }

  try {
    // Remove entire project directory
    await rm(projectDir, { recursive: true, force: true });

    // Clean up RBAC access entries
    await deleteResourceAccess('project', projectId);

    // Update index
    const index = await loadProjectsIndex();
    index.projects = index.projects.filter((p) => p.id !== projectId);
    await saveProjectsIndex(index);

    return true;
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    return false;
  }
}

/**
 * List all projects (optionally filtered by user membership)
 */
export async function listProjects(userId?: string): Promise<Project[]> {
  await ensureBaseDir();

  const index = await loadProjectsIndex();
  const projects: Project[] = [];

  for (const entry of index.projects) {
    const project = await loadProject(entry.id);
    if (!project) continue;

    // If userId is provided, filter to projects where user is a member
    if (userId) {
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isMember) continue;
    }

    projects.push(project);
  }

  // Sort by updatedAt descending
  projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return projects;
}

// =============================================================================
// Project Members
// =============================================================================

/**
 * Get project members
 */
export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const project = await loadProject(projectId);
  return project?.members || [];
}

/**
 * Add a member to a project
 */
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectMember['role'],
  addedBy: string
): Promise<ProjectMember | null> {
  const project = await loadProject(projectId);
  if (!project) return null;

  // Check if user is already a member
  const existing = project.members.find((m) => m.userId === userId);
  if (existing) {
    // Update role if already a member
    existing.role = role;
    await saveProject(project);
    return existing;
  }

  const member: ProjectMember = {
    userId,
    role,
    addedAt: new Date().toISOString(),
    addedBy,
  };

  project.members.push(member);
  await saveProject(project);

  return member;
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  projectId: string,
  userId: string,
  newRole: ProjectMember['role']
): Promise<boolean> {
  const project = await loadProject(projectId);
  if (!project) return false;

  const member = project.members.find((m) => m.userId === userId);
  if (!member) return false;

  member.role = newRole;
  await saveProject(project);

  return true;
}

/**
 * Remove a member from a project
 */
export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  const project = await loadProject(projectId);
  if (!project) return false;

  const initialLength = project.members.length;
  project.members = project.members.filter((m) => m.userId !== userId);

  if (project.members.length === initialLength) {
    return false; // Member not found
  }

  await saveProject(project);
  return true;
}

// =============================================================================
// Project Settings
// =============================================================================

/**
 * Update project settings
 */
export async function updateProjectSettings(
  projectId: string,
  updates: Partial<ProjectSettings>
): Promise<ProjectSettings | null> {
  const project = await loadProject(projectId);
  if (!project) return null;

  project.settings = { ...project.settings, ...updates };
  await saveProject(project);

  return project.settings;
}

// =============================================================================
// Project Memory
// =============================================================================

/**
 * Load project memory
 */
export async function loadProjectMemory(projectId: string): Promise<ProjectMemory> {
  const memoryPath = join(getProjectDir(projectId), 'memory.yaml');

  if (!existsSync(memoryPath)) {
    return createDefaultMemory(projectId);
  }

  try {
    const content = await readFile(memoryPath, 'utf-8');
    const memory = yaml.parse(content) as ProjectMemory;

    // Ensure all sections exist
    if (!memory.about) memory.about = [];
    if (!memory.instructions) memory.instructions = [];
    if (!memory.context) memory.context = [];

    return memory;
  } catch (error) {
    console.error(`Error loading project memory ${projectId}:`, error);
    return createDefaultMemory(projectId);
  }
}

/**
 * Save project memory
 */
export async function saveProjectMemory(memory: ProjectMemory): Promise<void> {
  const projectDir = getProjectDir(memory.projectId);

  if (!existsSync(projectDir)) {
    await mkdir(projectDir, { recursive: true });
  }

  memory.updatedAt = new Date().toISOString();
  const memoryPath = join(projectDir, 'memory.yaml');
  await writeFile(memoryPath, toYaml(memory), 'utf-8');
}

/**
 * Add an about item to project memory
 */
export async function addProjectAboutItem(
  projectId: string,
  content: string,
  source: MemorySource = 'manual'
): Promise<AboutItem> {
  const memory = await loadProjectMemory(projectId);

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
  await saveProjectMemory(memory);

  return item;
}

/**
 * Add an instruction to project memory
 */
export async function addProjectInstruction(
  projectId: string,
  content: string,
  priority: Priority = 'normal',
  source: MemorySource = 'manual'
): Promise<InstructionItem> {
  const memory = await loadProjectMemory(projectId);

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
  await saveProjectMemory(memory);

  return item;
}

/**
 * Add a context item to project memory
 */
export async function addProjectContextItem(
  projectId: string,
  name: string,
  description?: string,
  active: boolean = true,
  source: MemorySource = 'manual'
): Promise<ContextItem> {
  const memory = await loadProjectMemory(projectId);

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
      await saveProjectMemory(memory);
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
  await saveProjectMemory(memory);

  return item;
}

/**
 * Delete a memory item
 */
export async function deleteProjectMemoryItem(
  projectId: string,
  section: MemorySection,
  itemId: string
): Promise<boolean> {
  const memory = await loadProjectMemory(projectId);

  const initialLength = memory[section].length;
  (memory[section] as any[]) = (memory[section] as any[]).filter(
    (item: any) => item.id !== itemId
  );

  if (memory[section].length === initialLength) {
    return false;
  }

  await saveProjectMemory(memory);
  return true;
}

/**
 * Toggle context item active status
 */
export async function setProjectContextActive(
  projectId: string,
  itemId: string,
  active: boolean
): Promise<boolean> {
  const memory = await loadProjectMemory(projectId);

  const item = memory.context.find((c) => c.id === itemId);
  if (!item) return false;

  item.active = active;
  await saveProjectMemory(memory);

  return true;
}

/**
 * Format project memory for prompt injection
 */
export function formatProjectMemoryForPrompt(
  memory: ProjectMemory,
  projectName: string
): string {
  const lines: string[] = [];

  lines.push(`# Projekt-Kontext: ${projectName}`);
  lines.push('');

  // About section
  if (memory.about.length > 0) {
    lines.push('## Ueber das Projekt');
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

    lines.push('## Projekt-Anweisungen');
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
// Project KB Links
// =============================================================================

/**
 * Load project KB links
 */
export async function loadProjectKBLinks(projectId: string): Promise<ProjectKBLinks> {
  const linksPath = join(getProjectDir(projectId), 'kb-links.yaml');

  if (!existsSync(linksPath)) {
    return createDefaultKBLinks(projectId);
  }

  try {
    const content = await readFile(linksPath, 'utf-8');
    const links = yaml.parse(content) as ProjectKBLinks;

    if (!links.collections) links.collections = [];

    return links;
  } catch (error) {
    console.error(`Error loading project KB links ${projectId}:`, error);
    return createDefaultKBLinks(projectId);
  }
}

/**
 * Save project KB links
 */
export async function saveProjectKBLinks(links: ProjectKBLinks): Promise<void> {
  const projectDir = getProjectDir(links.projectId);

  if (!existsSync(projectDir)) {
    await mkdir(projectDir, { recursive: true });
  }

  links.updatedAt = new Date().toISOString();
  const linksPath = join(projectDir, 'kb-links.yaml');
  await writeFile(linksPath, toYaml(links), 'utf-8');
}

/**
 * Link a KB collection to a project
 */
export async function linkKBCollection(
  projectId: string,
  collectionId: string,
  linkedBy: string
): Promise<KBCollectionLink | null> {
  const links = await loadProjectKBLinks(projectId);

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
  await saveProjectKBLinks(links);

  return link;
}

/**
 * Unlink a KB collection from a project
 */
export async function unlinkKBCollection(
  projectId: string,
  collectionId: string
): Promise<boolean> {
  const links = await loadProjectKBLinks(projectId);

  const initialLength = links.collections.length;
  links.collections = links.collections.filter((c) => c.collectionId !== collectionId);

  if (links.collections.length === initialLength) {
    return false;
  }

  await saveProjectKBLinks(links);
  return true;
}

/**
 * Get linked KB collection IDs for a project
 */
export async function getProjectKBCollectionIds(projectId: string): Promise<string[]> {
  const links = await loadProjectKBLinks(projectId);
  return links.collections.map((c) => c.collectionId);
}

// =============================================================================
// Project Chats
// =============================================================================

/**
 * List chats for a project
 */
export async function listProjectChats(projectId: string): Promise<Array<{
  id: string;
  title: string;
  summary?: string;
  updatedAt: string;
  userId: string;
}>> {
  const chatsDir = join(getProjectDir(projectId), 'chats');

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
        const content = await readFile(join(chatsDir, file), 'utf-8');
        const chat = yaml.parse(content) as ProjectChat;

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
    console.error(`Error listing project chats ${projectId}:`, error);
    return [];
  }
}

/**
 * Load a project chat
 */
export async function loadProjectChat(
  projectId: string,
  chatId: string
): Promise<ProjectChat | null> {
  const chatPath = join(getProjectDir(projectId), 'chats', `${chatId}.yaml`);

  if (!existsSync(chatPath)) {
    return null;
  }

  try {
    const content = await readFile(chatPath, 'utf-8');
    return yaml.parse(content) as ProjectChat;
  } catch (error) {
    console.error(`Error loading project chat ${chatId}:`, error);
    return null;
  }
}

/**
 * Save a project chat
 */
export async function saveProjectChat(chat: ProjectChat): Promise<void> {
  const chatsDir = join(getProjectDir(chat.projectId), 'chats');

  if (!existsSync(chatsDir)) {
    await mkdir(chatsDir, { recursive: true });
  }

  chat.updatedAt = new Date().toISOString();
  const chatPath = join(chatsDir, `${chat.id}.yaml`);
  await writeFile(chatPath, toYaml(chat), 'utf-8');
}

/**
 * Delete a project chat
 */
export async function deleteProjectChat(projectId: string, chatId: string): Promise<boolean> {
  const chatPath = join(getProjectDir(projectId), 'chats', `${chatId}.yaml`);

  if (!existsSync(chatPath)) {
    return false;
  }

  try {
    await unlink(chatPath);
    return true;
  } catch (error) {
    console.error(`Error deleting project chat ${chatId}:`, error);
    return false;
  }
}
