/**
 * Project Storage — Postgres-backed (Drizzle).
 *
 * Frueher YAML-Files unter `data/projects/<id>/{project,memory,kb-links}.yaml`,
 * jetzt:
 *   - `projects.projects`   (Stammdaten + members[] + settings als jsonb)
 *   - `projects.memory`     (about/instructions/context als jsonb)
 *   - `projects.kb_links`   (collections[] als jsonb)
 *
 * Project-Chats bleiben fuer den Chat-Migrations-Block YAML-Files unter
 * `data/projects/<id>/chats/<sessionId>.yaml`.
 */

import { eq, desc } from 'drizzle-orm';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises';
import * as yaml from 'yaml';
import { getDb } from '../db';
import { projects as projectsTable, projectMemory as projectMemoryTable, projectKbLinks as projectKbLinksTable } from '../db/schema/projects';
import type {
  Project,
  ProjectMember,
  ProjectMemory,
  ProjectKBLinks,
  ProjectSettings,
  ProjectChat,
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
import { listAccessibleResources } from '../rbac/accessControl';

const PROJECTS_BASE_DIR = resolve(process.cwd(), '../data/projects');

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${timestamp}${random}`;
}

function rowToProject(row: typeof projectsTable.$inferSelect): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    icon: row.icon ?? undefined,
    color: row.color ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    members: (row.members as ProjectMember[]) ?? [],
    settings: (row.settings as ProjectSettings) ?? createDefaultSettings(),
    archived: row.archived,
  };
}

// ============================================
// Project CRUD
// ============================================

export async function loadProject(projectId: string): Promise<Project | null> {
  const db = getDb();
  const rows = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  return rows[0] ? rowToProject(rows[0]) : null;
}

export async function saveProject(project: Project): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  project.updatedAt = now;
  await db.insert(projectsTable).values({
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    icon: project.icon ?? null,
    color: project.color ?? null,
    createdBy: project.createdBy,
    archived: project.archived,
    members: project.members as never,
    settings: project.settings as never,
    createdAt: project.createdAt ?? now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: projectsTable.id,
    set: {
      name: project.name,
      description: project.description ?? null,
      icon: project.icon ?? null,
      color: project.color ?? null,
      archived: project.archived,
      members: project.members as never,
      settings: project.settings as never,
      updatedAt: now,
    },
  });
}

export async function createProject(
  name: string,
  createdBy: string,
  options?: { description?: string; icon?: string; color?: string },
): Promise<Project> {
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
    members: [{ userId: createdBy, role: 'owner', addedAt: now, addedBy: createdBy }],
    settings: createDefaultSettings(),
    archived: false,
  };

  await saveProject(project);
  await saveProjectMemory(createDefaultMemory(projectId));
  await saveProjectKBLinks(createDefaultKBLinks(projectId));
  await initializeResourceAccess('project', projectId, createdBy);
  return project;
}

export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'icon' | 'color' | 'archived'>>,
): Promise<Project | null> {
  const project = await loadProject(projectId);
  if (!project) return null;
  if (updates.name !== undefined) project.name = updates.name;
  if (updates.description !== undefined) project.description = updates.description;
  if (updates.icon !== undefined) project.icon = updates.icon;
  if (updates.color !== undefined) project.color = updates.color;
  if (updates.archived !== undefined) project.archived = updates.archived;
  await saveProject(project);
  return project;
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const db = getDb();
  // Cascading FKs (memory, kb_links) -> automatisch geloescht.
  const res = await db.delete(projectsTable).where(eq(projectsTable.id, projectId)).returning({ id: projectsTable.id });
  if (res.length === 0) return false;
  await deleteResourceAccess('project', projectId);
  return true;
}

export async function listProjects(userId?: string): Promise<Project[]> {
  const db = getDb();
  const rows = await db.select().from(projectsTable).orderBy(desc(projectsTable.updatedAt));
  let projects = rows.map(rowToProject);

  if (userId) {
    const allProjectIds = projects.map(p => p.id);
    const accessibleResources = await listAccessibleResources(userId, 'project', allProjectIds);
    const accessibleIds = new Set(accessibleResources.map(a => a.resourceId));
    projects = projects.filter(p => p.members.some(m => m.userId === userId) || accessibleIds.has(p.id));
  }
  return projects;
}

// ============================================
// Project Members (in jsonb-Spalte gespeichert)
// ============================================

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const project = await loadProject(projectId);
  return project?.members || [];
}

export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectMember['role'],
  addedBy: string,
): Promise<ProjectMember | null> {
  const project = await loadProject(projectId);
  if (!project) return null;
  const existing = project.members.find(m => m.userId === userId);
  if (existing) {
    existing.role = role;
    await saveProject(project);
    return existing;
  }
  const member: ProjectMember = { userId, role, addedAt: new Date().toISOString(), addedBy };
  project.members.push(member);
  await saveProject(project);
  return member;
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  newRole: ProjectMember['role'],
): Promise<boolean> {
  const project = await loadProject(projectId);
  if (!project) return false;
  const member = project.members.find(m => m.userId === userId);
  if (!member) return false;
  member.role = newRole;
  await saveProject(project);
  return true;
}

export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  const project = await loadProject(projectId);
  if (!project) return false;
  const initialLength = project.members.length;
  project.members = project.members.filter(m => m.userId !== userId);
  if (project.members.length === initialLength) return false;
  await saveProject(project);
  return true;
}

// ============================================
// Project Settings
// ============================================

export async function updateProjectSettings(
  projectId: string,
  updates: Partial<ProjectSettings>,
): Promise<ProjectSettings | null> {
  const project = await loadProject(projectId);
  if (!project) return null;
  project.settings = { ...project.settings, ...updates };
  await saveProject(project);
  return project.settings;
}

// ============================================
// Project Memory
// ============================================

export async function loadProjectMemory(projectId: string): Promise<ProjectMemory> {
  const db = getDb();
  const rows = await db.select().from(projectMemoryTable).where(eq(projectMemoryTable.projectId, projectId)).limit(1);
  if (!rows[0]) return createDefaultMemory(projectId);
  return {
    projectId,
    updatedAt: rows[0].updatedAt,
    about: (rows[0].about as AboutItem[]) ?? [],
    instructions: (rows[0].instructions as InstructionItem[]) ?? [],
    context: (rows[0].context as ContextItem[]) ?? [],
  };
}

export async function saveProjectMemory(memory: ProjectMemory): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  memory.updatedAt = now;
  await db.insert(projectMemoryTable).values({
    projectId: memory.projectId,
    about: memory.about as never,
    instructions: memory.instructions as never,
    context: memory.context as never,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: projectMemoryTable.projectId,
    set: {
      about: memory.about as never,
      instructions: memory.instructions as never,
      context: memory.context as never,
      updatedAt: now,
    },
  });
}

export async function addProjectAboutItem(
  projectId: string,
  content: string,
  source: MemorySource = 'manual',
): Promise<AboutItem> {
  const memory = await loadProjectMemory(projectId);
  if (memory.about.some(item => item.content.toLowerCase() === content.toLowerCase())) {
    throw new Error('Diese Information existiert bereits.');
  }
  const item: AboutItem = { id: generateId('about'), content, added_at: new Date().toISOString(), source };
  memory.about.push(item);
  await saveProjectMemory(memory);
  return item;
}

export async function addProjectInstruction(
  projectId: string,
  content: string,
  priority: Priority = 'normal',
  source: MemorySource = 'manual',
): Promise<InstructionItem> {
  const memory = await loadProjectMemory(projectId);
  if (memory.instructions.some(item => item.content.toLowerCase() === content.toLowerCase())) {
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

export async function addProjectContextItem(
  projectId: string,
  name: string,
  description?: string,
  active: boolean = true,
  source: MemorySource = 'manual',
): Promise<ContextItem> {
  const memory = await loadProjectMemory(projectId);
  const existingIndex = memory.context.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
  if (existingIndex !== -1) {
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

export async function deleteProjectMemoryItem(
  projectId: string,
  section: MemorySection,
  itemId: string,
): Promise<boolean> {
  const memory = await loadProjectMemory(projectId);
  const initialLength = memory[section].length;
  (memory[section] as any[]) = (memory[section] as any[]).filter(item => item.id !== itemId);
  if (memory[section].length === initialLength) return false;
  await saveProjectMemory(memory);
  return true;
}

export async function setProjectContextActive(
  projectId: string,
  itemId: string,
  active: boolean,
): Promise<boolean> {
  const memory = await loadProjectMemory(projectId);
  const item = memory.context.find(c => c.id === itemId);
  if (!item) return false;
  item.active = active;
  await saveProjectMemory(memory);
  return true;
}

export function formatProjectMemoryForPrompt(memory: ProjectMemory, projectName: string): string {
  const lines: string[] = [];
  lines.push(`# Projekt-Kontext: ${projectName}`);
  lines.push('');

  if (memory.about.length > 0) {
    lines.push('## Ueber das Projekt');
    memory.about.forEach(item => lines.push(`- ${item.content}`));
    lines.push('');
  }

  if (memory.instructions.length > 0) {
    const sorted = [...memory.instructions].sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (a.priority !== 'high' && b.priority === 'high') return 1;
      return 0;
    });
    lines.push('## Projekt-Anweisungen');
    sorted.forEach(item => {
      const prefix = item.priority === 'high' ? '[WICHTIG] ' : '';
      lines.push(`- ${prefix}${item.content}`);
    });
    lines.push('');
  }

  const activeContext = memory.context.filter(item => item.active);
  if (activeContext.length > 0) {
    lines.push('## Aktuelle Phase');
    activeContext.forEach(item => {
      if (item.description) lines.push(`- **${item.name}**: ${item.description}`);
      else lines.push(`- ${item.name}`);
    });
    lines.push('');
  }

  if (lines.length <= 2) return '';
  return lines.join('\n');
}

// ============================================
// Project KB Links
// ============================================

export async function loadProjectKBLinks(projectId: string): Promise<ProjectKBLinks> {
  const db = getDb();
  const rows = await db.select().from(projectKbLinksTable).where(eq(projectKbLinksTable.projectId, projectId)).limit(1);
  if (!rows[0]) return createDefaultKBLinks(projectId);
  return {
    projectId,
    updatedAt: rows[0].updatedAt,
    collections: (rows[0].collections as KBCollectionLink[]) ?? [],
  };
}

export async function saveProjectKBLinks(links: ProjectKBLinks): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  links.updatedAt = now;
  await db.insert(projectKbLinksTable).values({
    projectId: links.projectId,
    collections: links.collections as never,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: projectKbLinksTable.projectId,
    set: {
      collections: links.collections as never,
      updatedAt: now,
    },
  });
}

export async function linkKBCollection(
  projectId: string,
  collectionId: string,
  linkedBy: string,
): Promise<KBCollectionLink | null> {
  const links = await loadProjectKBLinks(projectId);
  const existing = links.collections.find(c => c.collectionId === collectionId);
  if (existing) return existing;
  const link: KBCollectionLink = { collectionId, linkedAt: new Date().toISOString(), linkedBy };
  links.collections.push(link);
  await saveProjectKBLinks(links);
  return link;
}

export async function unlinkKBCollection(projectId: string, collectionId: string): Promise<boolean> {
  const links = await loadProjectKBLinks(projectId);
  const initialLength = links.collections.length;
  links.collections = links.collections.filter(c => c.collectionId !== collectionId);
  if (links.collections.length === initialLength) return false;
  await saveProjectKBLinks(links);
  return true;
}

export async function getProjectKBCollectionIds(projectId: string): Promise<string[]> {
  const links = await loadProjectKBLinks(projectId);
  return links.collections.map(c => c.collectionId);
}

// ============================================
// Project Chats — bleiben YAML (kommt mit dem Chat-System-Block)
// ============================================

function projectChatsDir(projectId: string): string {
  return join(PROJECTS_BASE_DIR, projectId, 'chats');
}

export async function listProjectChats(projectId: string): Promise<Array<{
  id: string;
  title: string;
  summary?: string;
  updatedAt: string;
  userId: string;
}>> {
  const dir = projectChatsDir(projectId);
  if (!existsSync(dir)) return [];
  try {
    const files = await readdir(dir);
    const summaries: Array<{ id: string; title: string; summary?: string; updatedAt: string; userId: string }> = [];
    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;
      try {
        const content = await readFile(join(dir, file), 'utf-8');
        const chat = yaml.parse(content) as ProjectChat;
        summaries.push({
          id: chat.id,
          title: chat.title,
          summary: chat.summary,
          updatedAt: chat.updatedAt,
          userId: chat.userId,
        });
      } catch { /* skip */ }
    }
    summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return summaries;
  } catch (error) {
    console.error(`Error listing project chats ${projectId}:`, error);
    return [];
  }
}

export async function loadProjectChat(projectId: string, chatId: string): Promise<ProjectChat | null> {
  const path = join(projectChatsDir(projectId), `${chatId}.yaml`);
  if (!existsSync(path)) return null;
  try {
    const content = await readFile(path, 'utf-8');
    return yaml.parse(content) as ProjectChat;
  } catch (error) {
    console.error(`Error loading project chat ${chatId}:`, error);
    return null;
  }
}

export async function saveProjectChat(chat: ProjectChat): Promise<void> {
  const dir = projectChatsDir(chat.projectId);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  chat.updatedAt = new Date().toISOString();
  const path = join(dir, `${chat.id}.yaml`);
  await writeFile(path, yaml.stringify(chat, { indent: 2, lineWidth: 0 }), 'utf-8');
}

export async function deleteProjectChat(projectId: string, chatId: string): Promise<boolean> {
  const path = join(projectChatsDir(projectId), `${chatId}.yaml`);
  if (!existsSync(path)) return false;
  try {
    await unlink(path);
    return true;
  } catch (error) {
    console.error(`Error deleting project chat ${chatId}:`, error);
    return false;
  }
}

// ============================================
// Disk-Migration: bestehende YAML-Projekte ingestieren
// ============================================

/**
 * Scannt `data/projects/<id>/` und uebertraegt project.yaml + memory.yaml +
 * kb-links.yaml in die DB. Idempotent — bestehende DB-Eintraege werden NICHT
 * ueberschrieben. Project-Chats bleiben File-System (Chat-Migrations-Block).
 */
export async function seedProjectsFromDisk(): Promise<{ ingested: string[]; skipped: string[] }> {
  const ingested: string[] = [];
  const skipped: string[] = [];
  if (!existsSync(PROJECTS_BASE_DIR)) return { ingested, skipped };

  const entries = await readdir(PROJECTS_BASE_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectId = entry.name;
    const projectFile = join(PROJECTS_BASE_DIR, projectId, 'project.yaml');
    if (!existsSync(projectFile)) continue;

    const existing = await loadProject(projectId);
    if (existing) {
      skipped.push(projectId);
      continue;
    }

    try {
      const projContent = await readFile(projectFile, 'utf-8');
      const project = yaml.parse(projContent) as Project;
      if (!project.members) project.members = [];
      if (!project.settings) project.settings = createDefaultSettings();
      await saveProject(project);

      const memFile = join(PROJECTS_BASE_DIR, projectId, 'memory.yaml');
      if (existsSync(memFile)) {
        const memContent = await readFile(memFile, 'utf-8');
        const memory = yaml.parse(memContent) as ProjectMemory;
        if (!memory.about) memory.about = [];
        if (!memory.instructions) memory.instructions = [];
        if (!memory.context) memory.context = [];
        memory.projectId = projectId;
        await saveProjectMemory(memory);
      }

      const kbFile = join(PROJECTS_BASE_DIR, projectId, 'kb-links.yaml');
      if (existsSync(kbFile)) {
        const kbContent = await readFile(kbFile, 'utf-8');
        const links = yaml.parse(kbContent) as ProjectKBLinks;
        if (!links.collections) links.collections = [];
        links.projectId = projectId;
        await saveProjectKBLinks(links);
      }

      ingested.push(projectId);
    } catch (error) {
      console.warn(`[projects] Failed to ingest ${projectId}:`, error instanceof Error ? error.message : error);
    }
  }
  if (ingested.length > 0) console.log(`[projects] Seeded ${ingested.length} projects from disk: ${ingested.join(', ')}`);
  return { ingested, skipped };
}
