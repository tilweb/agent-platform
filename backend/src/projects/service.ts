/**
 * Project Service
 *
 * High-level business logic for project operations.
 * Combines storage operations with permission checks.
 */

import type {
  Project,
  ProjectMember,
  ProjectMemory,
  ProjectSettings,
  ProjectKBLinks,
  ProjectRole,
  MemorySection,
  Priority,
  MemorySource,
} from './types';

import {
  createProject as storageCreateProject,
  loadProject,
  updateProject as storageUpdateProject,
  deleteProject as storageDeleteProject,
  listProjects as storageListProjects,
  getProjectMembers as storageGetMembers,
  addProjectMember as storageAddMember,
  updateMemberRole as storageUpdateMemberRole,
  removeProjectMember as storageRemoveMember,
  updateProjectSettings as storageUpdateSettings,
  loadProjectMemory,
  saveProjectMemory,
  addProjectAboutItem,
  addProjectInstruction,
  addProjectContextItem,
  deleteProjectMemoryItem,
  setProjectContextActive,
  formatProjectMemoryForPrompt,
  loadProjectKBLinks,
  linkKBCollection as storageLinkKB,
  unlinkKBCollection as storageUnlinkKB,
  getProjectKBCollectionIds,
  listProjectChats,
  loadProjectChat,
  deleteProjectChat as storageDeleteChat,
} from './storage';

import {
  canViewProject,
  canEditProject,
  canEditSettings,
  canWriteMemory,
  canViewChats,
  canManageMembers,
  canModifyMember,
  canDeleteProject,
  canArchiveProject,
  getUserPermissions,
} from './permissions';

// Result type for service operations
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// Project CRUD
// =============================================================================

/**
 * Create a new project
 */
export async function createProject(
  userId: string,
  name: string,
  options?: {
    description?: string;
    icon?: string;
    color?: string;
  }
): Promise<ServiceResult<Project>> {
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Projektname ist erforderlich' };
  }

  if (name.length > 100) {
    return { success: false, error: 'Projektname darf maximal 100 Zeichen haben' };
  }

  try {
    const project = await storageCreateProject(name.trim(), userId, options);
    return { success: true, data: project };
  } catch (error: any) {
    console.error('Error creating project:', error);
    return { success: false, error: error.message || 'Fehler beim Erstellen des Projekts' };
  }
}

/**
 * Get a project by ID
 */
export async function getProject(
  projectId: string,
  userId: string
): Promise<ServiceResult<Project>> {
  const permission = await canViewProject(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  const project = await loadProject(projectId);
  if (!project) {
    return { success: false, error: 'Projekt nicht gefunden' };
  }

  return { success: true, data: project };
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  userId: string,
  updates: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
  }
): Promise<ServiceResult<Project>> {
  const permission = await canEditProject(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  if (updates.name !== undefined) {
    if (updates.name.trim().length === 0) {
      return { success: false, error: 'Projektname ist erforderlich' };
    }
    if (updates.name.length > 100) {
      return { success: false, error: 'Projektname darf maximal 100 Zeichen haben' };
    }
    updates.name = updates.name.trim();
  }

  try {
    const project = await storageUpdateProject(projectId, updates);
    if (!project) {
      return { success: false, error: 'Projekt nicht gefunden' };
    }
    return { success: true, data: project };
  } catch (error: any) {
    console.error('Error updating project:', error);
    return { success: false, error: error.message || 'Fehler beim Aktualisieren' };
  }
}

/**
 * Archive or unarchive a project
 */
export async function archiveProject(
  projectId: string,
  userId: string,
  archived: boolean
): Promise<ServiceResult<Project>> {
  const permission = await canArchiveProject(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const project = await storageUpdateProject(projectId, { archived });
    if (!project) {
      return { success: false, error: 'Projekt nicht gefunden' };
    }
    return { success: true, data: project };
  } catch (error: any) {
    console.error('Error archiving project:', error);
    return { success: false, error: error.message || 'Fehler beim Archivieren' };
  }
}

/**
 * Delete a project
 */
export async function deleteProject(
  projectId: string,
  userId: string
): Promise<ServiceResult<void>> {
  const permission = await canDeleteProject(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const deleted = await storageDeleteProject(projectId);
    if (!deleted) {
      return { success: false, error: 'Projekt nicht gefunden' };
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return { success: false, error: error.message || 'Fehler beim Löschen' };
  }
}

/**
 * List projects for a user
 */
export async function listUserProjects(
  userId: string,
  includeArchived: boolean = false
): Promise<ServiceResult<Project[]>> {
  try {
    let projects = await storageListProjects(userId);

    if (!includeArchived) {
      projects = projects.filter((p) => !p.archived);
    }

    return { success: true, data: projects };
  } catch (error: any) {
    console.error('Error listing projects:', error);
    return { success: false, error: error.message || 'Fehler beim Laden der Projekte' };
  }
}

// =============================================================================
// Members
// =============================================================================

/**
 * Get project members
 */
export async function getMembers(
  projectId: string,
  userId: string
): Promise<ServiceResult<ProjectMember[]>> {
  const permission = await canViewProject(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const members = await storageGetMembers(projectId);
    return { success: true, data: members };
  } catch (error: any) {
    console.error('Error getting members:', error);
    return { success: false, error: error.message || 'Fehler beim Laden der Mitglieder' };
  }
}

/**
 * Add a member to a project
 */
export async function addMember(
  projectId: string,
  userId: string,
  targetUserId: string,
  role: ProjectRole
): Promise<ServiceResult<ProjectMember>> {
  const permission = await canModifyMember(projectId, userId, targetUserId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  // Cannot add someone as owner
  if (role === 'owner') {
    return { success: false, error: 'Owner-Rolle kann nicht zugewiesen werden' };
  }

  try {
    const member = await storageAddMember(projectId, targetUserId, role, userId);
    if (!member) {
      return { success: false, error: 'Fehler beim Hinzufügen des Mitglieds' };
    }
    return { success: true, data: member };
  } catch (error: any) {
    console.error('Error adding member:', error);
    return { success: false, error: error.message || 'Fehler beim Hinzufügen' };
  }
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  projectId: string,
  userId: string,
  targetUserId: string,
  newRole: ProjectRole
): Promise<ServiceResult<void>> {
  const permission = await canModifyMember(projectId, userId, targetUserId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  // Cannot change to owner
  if (newRole === 'owner') {
    return { success: false, error: 'Owner-Rolle kann nicht zugewiesen werden' };
  }

  try {
    const success = await storageUpdateMemberRole(projectId, targetUserId, newRole);
    if (!success) {
      return { success: false, error: 'Mitglied nicht gefunden' };
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error updating member role:', error);
    return { success: false, error: error.message || 'Fehler beim Aktualisieren' };
  }
}

/**
 * Remove a member from a project
 */
export async function removeMember(
  projectId: string,
  userId: string,
  targetUserId: string
): Promise<ServiceResult<void>> {
  const permission = await canModifyMember(projectId, userId, targetUserId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  // Check target is not owner
  const project = await loadProject(projectId);
  if (project) {
    const targetMember = project.members.find((m) => m.userId === targetUserId);
    if (targetMember?.role === 'owner') {
      return { success: false, error: 'Owner kann nicht entfernt werden' };
    }
  }

  try {
    const success = await storageRemoveMember(projectId, targetUserId);
    if (!success) {
      return { success: false, error: 'Mitglied nicht gefunden' };
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error removing member:', error);
    return { success: false, error: error.message || 'Fehler beim Entfernen' };
  }
}

// =============================================================================
// Settings
// =============================================================================

/**
 * Update project settings
 */
export async function updateSettings(
  projectId: string,
  userId: string,
  updates: Partial<ProjectSettings>
): Promise<ServiceResult<ProjectSettings>> {
  const permission = await canEditSettings(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const settings = await storageUpdateSettings(projectId, updates);
    if (!settings) {
      return { success: false, error: 'Projekt nicht gefunden' };
    }
    return { success: true, data: settings };
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return { success: false, error: error.message || 'Fehler beim Aktualisieren' };
  }
}

// =============================================================================
// Memory
// =============================================================================

/**
 * Get project memory
 */
export async function getMemory(
  projectId: string,
  userId: string
): Promise<ServiceResult<ProjectMemory>> {
  const permission = await canViewProject(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const memory = await loadProjectMemory(projectId);
    return { success: true, data: memory };
  } catch (error: any) {
    console.error('Error getting memory:', error);
    return { success: false, error: error.message || 'Fehler beim Laden' };
  }
}

/**
 * Add an about item to project memory
 */
export async function addAbout(
  projectId: string,
  userId: string,
  content: string,
  source: MemorySource = 'manual'
): Promise<ServiceResult<any>> {
  const permission = await canWriteMemory(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Inhalt ist erforderlich' };
  }

  try {
    const item = await addProjectAboutItem(projectId, content.trim(), source);
    return { success: true, data: item };
  } catch (error: any) {
    console.error('Error adding about item:', error);
    return { success: false, error: error.message || 'Fehler beim Hinzufügen' };
  }
}

/**
 * Add an instruction to project memory
 */
export async function addInstruction(
  projectId: string,
  userId: string,
  content: string,
  priority: Priority = 'normal',
  source: MemorySource = 'manual'
): Promise<ServiceResult<any>> {
  const permission = await canWriteMemory(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Inhalt ist erforderlich' };
  }

  try {
    const item = await addProjectInstruction(projectId, content.trim(), priority, source);
    return { success: true, data: item };
  } catch (error: any) {
    console.error('Error adding instruction:', error);
    return { success: false, error: error.message || 'Fehler beim Hinzufügen' };
  }
}

/**
 * Add a context item to project memory
 */
export async function addContext(
  projectId: string,
  userId: string,
  name: string,
  description?: string,
  active: boolean = true,
  source: MemorySource = 'manual'
): Promise<ServiceResult<any>> {
  const permission = await canWriteMemory(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Name ist erforderlich' };
  }

  try {
    const item = await addProjectContextItem(
      projectId,
      name.trim(),
      description?.trim(),
      active,
      source
    );
    return { success: true, data: item };
  } catch (error: any) {
    console.error('Error adding context item:', error);
    return { success: false, error: error.message || 'Fehler beim Hinzufügen' };
  }
}

/**
 * Delete a memory item
 */
export async function deleteMemoryItem(
  projectId: string,
  userId: string,
  section: MemorySection,
  itemId: string
): Promise<ServiceResult<void>> {
  const permission = await canWriteMemory(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const success = await deleteProjectMemoryItem(projectId, section, itemId);
    if (!success) {
      return { success: false, error: 'Item nicht gefunden' };
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting memory item:', error);
    return { success: false, error: error.message || 'Fehler beim Löschen' };
  }
}

/**
 * Toggle context item active status
 */
export async function setContextActive(
  projectId: string,
  userId: string,
  itemId: string,
  active: boolean
): Promise<ServiceResult<void>> {
  const permission = await canWriteMemory(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const success = await setProjectContextActive(projectId, itemId, active);
    if (!success) {
      return { success: false, error: 'Item nicht gefunden' };
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error updating context:', error);
    return { success: false, error: error.message || 'Fehler beim Aktualisieren' };
  }
}

/**
 * Get formatted project memory for prompt injection
 */
export async function getFormattedMemory(
  projectId: string,
  userId: string
): Promise<ServiceResult<string>> {
  const permission = await canViewProject(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  const project = await loadProject(projectId);
  if (!project) {
    return { success: false, error: 'Projekt nicht gefunden' };
  }

  try {
    const memory = await loadProjectMemory(projectId);
    const formatted = formatProjectMemoryForPrompt(memory, project.name);
    return { success: true, data: formatted };
  } catch (error: any) {
    console.error('Error formatting memory:', error);
    return { success: false, error: error.message || 'Fehler beim Formatieren' };
  }
}

// =============================================================================
// KB Links
// =============================================================================

/**
 * Get linked KB collections for a project
 */
export async function getKBLinks(
  projectId: string,
  userId: string
): Promise<ServiceResult<ProjectKBLinks>> {
  const permission = await canViewProject(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const links = await loadProjectKBLinks(projectId);
    return { success: true, data: links };
  } catch (error: any) {
    console.error('Error getting KB links:', error);
    return { success: false, error: error.message || 'Fehler beim Laden' };
  }
}

/**
 * Link a KB collection to a project
 */
export async function linkKBCollection(
  projectId: string,
  userId: string,
  collectionId: string
): Promise<ServiceResult<any>> {
  const permission = await canWriteMemory(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const link = await storageLinkKB(projectId, collectionId, userId);
    if (!link) {
      return { success: false, error: 'Fehler beim Verknüpfen' };
    }
    return { success: true, data: link };
  } catch (error: any) {
    console.error('Error linking KB collection:', error);
    return { success: false, error: error.message || 'Fehler beim Verknüpfen' };
  }
}

/**
 * Unlink a KB collection from a project
 */
export async function unlinkKBCollection(
  projectId: string,
  userId: string,
  collectionId: string
): Promise<ServiceResult<void>> {
  const permission = await canWriteMemory(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const success = await storageUnlinkKB(projectId, collectionId);
    if (!success) {
      return { success: false, error: 'Verknüpfung nicht gefunden' };
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error unlinking KB collection:', error);
    return { success: false, error: error.message || 'Fehler beim Entfernen' };
  }
}

/**
 * Get KB collection IDs for a project (for RAG prioritization)
 */
export async function getKBCollectionIds(projectId: string): Promise<string[]> {
  return getProjectKBCollectionIds(projectId);
}

// =============================================================================
// Chats
// =============================================================================

/**
 * List project chats
 */
export async function listChats(
  projectId: string,
  userId: string
): Promise<ServiceResult<any[]>> {
  const permission = await canViewChats(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const chats = await listProjectChats(projectId);
    return { success: true, data: chats };
  } catch (error: any) {
    console.error('Error listing chats:', error);
    return { success: false, error: error.message || 'Fehler beim Laden' };
  }
}

/**
 * Get a project chat
 */
export async function getChat(
  projectId: string,
  userId: string,
  chatId: string
): Promise<ServiceResult<any>> {
  const permission = await canViewChats(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const chat = await loadProjectChat(projectId, chatId);
    if (!chat) {
      return { success: false, error: 'Chat nicht gefunden' };
    }
    return { success: true, data: chat };
  } catch (error: any) {
    console.error('Error getting chat:', error);
    return { success: false, error: error.message || 'Fehler beim Laden' };
  }
}

/**
 * Delete a project chat
 */
export async function deleteChat(
  projectId: string,
  userId: string,
  chatId: string
): Promise<ServiceResult<void>> {
  const permission = await canViewChats(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  // Only allow deletion by chat owner or project admins
  const chat = await loadProjectChat(projectId, chatId);
  if (!chat) {
    return { success: false, error: 'Chat nicht gefunden' };
  }

  const { role } = await getUserPermissions(projectId, userId);
  if (chat.userId !== userId && role !== 'owner' && role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung zum Löschen dieses Chats' };
  }

  try {
    const success = await storageDeleteChat(projectId, chatId);
    if (!success) {
      return { success: false, error: 'Chat nicht gefunden' };
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting chat:', error);
    return { success: false, error: error.message || 'Fehler beim Löschen' };
  }
}

// =============================================================================
// Context for Chat Integration
// =============================================================================

/**
 * Get full project context for chat integration
 * Returns formatted memory and KB collection IDs
 */
export async function getProjectContext(
  projectId: string,
  userId: string
): Promise<ServiceResult<{
  projectName: string;
  formattedMemory: string;
  kbCollectionIds: string[];
  settings: ProjectSettings;
}>> {
  const permission = await canViewProject(projectId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  const project = await loadProject(projectId);
  if (!project) {
    return { success: false, error: 'Projekt nicht gefunden' };
  }

  try {
    const memory = await loadProjectMemory(projectId);
    const formattedMemory = project.settings.include_memory_in_prompt
      ? formatProjectMemoryForPrompt(memory, project.name)
      : '';

    const kbCollectionIds = project.settings.include_kb_in_prompt
      ? await getProjectKBCollectionIds(projectId)
      : [];

    return {
      success: true,
      data: {
        projectName: project.name,
        formattedMemory,
        kbCollectionIds,
        settings: project.settings,
      },
    };
  } catch (error: any) {
    console.error('Error getting project context:', error);
    return { success: false, error: error.message || 'Fehler beim Laden des Kontexts' };
  }
}

// Re-export types and permissions for convenience
export { getUserPermissions } from './permissions';
export type { Project, ProjectMember, ProjectMemory, ProjectSettings, ProjectRole } from './types';
