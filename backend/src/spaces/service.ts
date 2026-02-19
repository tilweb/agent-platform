/**
 * Space Service
 *
 * High-level business logic for space operations.
 * Combines storage operations with permission checks.
 */

import type {
  Space,
  SpaceMember,
  SpaceMemory,
  SpaceSettings,
  SpaceKBLinks,
  SpaceRole,
  MemorySection,
  Priority,
  MemorySource,
} from './types';

import {
  createSpace as storageCreateSpace,
  loadSpace,
  updateSpace as storageUpdateSpace,
  deleteSpace as storageDeleteSpace,
  listSpaces as storageListSpaces,
  getSpaceMembers as storageGetMembers,
  addSpaceMember as storageAddMember,
  updateMemberRole as storageUpdateMemberRole,
  removeSpaceMember as storageRemoveMember,
  updateSpaceSettings as storageUpdateSettings,
  loadSpaceMemory,
  saveSpaceMemory,
  addSpaceAboutItem,
  addSpaceInstruction,
  addSpaceContextItem,
  deleteSpaceMemoryItem,
  setSpaceContextActive,
  formatSpaceMemoryForPrompt,
  loadSpaceKBLinks,
  linkKBCollection as storageLinkKB,
  unlinkKBCollection as storageUnlinkKB,
  getSpaceKBCollectionIds,
  listSpaceChats,
  loadSpaceChat,
  deleteSpaceChat as storageDeleteChat,
} from './storage';

import {
  canViewSpace,
  canEditSpace,
  canEditSettings,
  canWriteMemory,
  canViewChats,
  canManageMembers,
  canModifyMember,
  canDeleteSpace,
  canArchiveSpace,
  getUserPermissions,
} from './permissions';

// Result type for service operations
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// Space CRUD
// =============================================================================

/**
 * Create a new space
 */
export async function createSpace(
  userId: string,
  name: string,
  options?: {
    description?: string;
    icon?: string;
    color?: string;
  }
): Promise<ServiceResult<Space>> {
  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Space-Name ist erforderlich' };
  }

  if (name.length > 100) {
    return { success: false, error: 'Space-Name darf maximal 100 Zeichen haben' };
  }

  try {
    const space = await storageCreateSpace(name.trim(), userId, options);
    return { success: true, data: space };
  } catch (error: any) {
    console.error('Error creating space:', error);
    return { success: false, error: error.message || 'Fehler beim Erstellen des Spaces' };
  }
}

/**
 * Get a space by ID
 */
export async function getSpace(
  spaceId: string,
  userId: string
): Promise<ServiceResult<Space>> {
  const permission = await canViewSpace(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  const space = await loadSpace(spaceId);
  if (!space) {
    return { success: false, error: 'Space nicht gefunden' };
  }

  return { success: true, data: space };
}

/**
 * Update a space
 */
export async function updateSpace(
  spaceId: string,
  userId: string,
  updates: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
  }
): Promise<ServiceResult<Space>> {
  const permission = await canEditSpace(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  if (updates.name !== undefined) {
    if (updates.name.trim().length === 0) {
      return { success: false, error: 'Space-Name ist erforderlich' };
    }
    if (updates.name.length > 100) {
      return { success: false, error: 'Space-Name darf maximal 100 Zeichen haben' };
    }
    updates.name = updates.name.trim();
  }

  try {
    const space = await storageUpdateSpace(spaceId, updates);
    if (!space) {
      return { success: false, error: 'Space nicht gefunden' };
    }
    return { success: true, data: space };
  } catch (error: any) {
    console.error('Error updating space:', error);
    return { success: false, error: error.message || 'Fehler beim Aktualisieren' };
  }
}

/**
 * Archive or unarchive a space
 */
export async function archiveSpace(
  spaceId: string,
  userId: string,
  archived: boolean
): Promise<ServiceResult<Space>> {
  const permission = await canArchiveSpace(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const space = await storageUpdateSpace(spaceId, { archived });
    if (!space) {
      return { success: false, error: 'Space nicht gefunden' };
    }
    return { success: true, data: space };
  } catch (error: any) {
    console.error('Error archiving space:', error);
    return { success: false, error: error.message || 'Fehler beim Archivieren' };
  }
}

/**
 * Delete a space
 */
export async function deleteSpace(
  spaceId: string,
  userId: string
): Promise<ServiceResult<void>> {
  const permission = await canDeleteSpace(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const deleted = await storageDeleteSpace(spaceId);
    if (!deleted) {
      return { success: false, error: 'Space nicht gefunden' };
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting space:', error);
    return { success: false, error: error.message || 'Fehler beim Löschen' };
  }
}

/**
 * List spaces for a user
 */
export async function listUserSpaces(
  userId: string,
  includeArchived: boolean = false
): Promise<ServiceResult<Space[]>> {
  try {
    let spaces = await storageListSpaces(userId);

    if (!includeArchived) {
      spaces = spaces.filter((p) => !p.archived);
    }

    return { success: true, data: spaces };
  } catch (error: any) {
    console.error('Error listing spaces:', error);
    return { success: false, error: error.message || 'Fehler beim Laden der Spaces' };
  }
}

// =============================================================================
// Members
// =============================================================================

/**
 * Get space members
 */
export async function getMembers(
  spaceId: string,
  userId: string
): Promise<ServiceResult<SpaceMember[]>> {
  const permission = await canViewSpace(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const members = await storageGetMembers(spaceId);
    return { success: true, data: members };
  } catch (error: any) {
    console.error('Error getting members:', error);
    return { success: false, error: error.message || 'Fehler beim Laden der Mitglieder' };
  }
}

/**
 * Add a member to a space
 */
export async function addMember(
  spaceId: string,
  userId: string,
  targetUserId: string,
  role: SpaceRole
): Promise<ServiceResult<SpaceMember>> {
  const permission = await canModifyMember(spaceId, userId, targetUserId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  // Cannot add someone as owner
  if (role === 'owner') {
    return { success: false, error: 'Owner-Rolle kann nicht zugewiesen werden' };
  }

  try {
    const member = await storageAddMember(spaceId, targetUserId, role, userId);
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
  spaceId: string,
  userId: string,
  targetUserId: string,
  newRole: SpaceRole
): Promise<ServiceResult<void>> {
  const permission = await canModifyMember(spaceId, userId, targetUserId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  // Cannot change to owner
  if (newRole === 'owner') {
    return { success: false, error: 'Owner-Rolle kann nicht zugewiesen werden' };
  }

  try {
    const success = await storageUpdateMemberRole(spaceId, targetUserId, newRole);
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
 * Remove a member from a space
 */
export async function removeMember(
  spaceId: string,
  userId: string,
  targetUserId: string
): Promise<ServiceResult<void>> {
  const permission = await canModifyMember(spaceId, userId, targetUserId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  // Check target is not owner
  const space = await loadSpace(spaceId);
  if (space) {
    const targetMember = space.members.find((m) => m.userId === targetUserId);
    if (targetMember?.role === 'owner') {
      return { success: false, error: 'Owner kann nicht entfernt werden' };
    }
  }

  try {
    const success = await storageRemoveMember(spaceId, targetUserId);
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
 * Update space settings
 */
export async function updateSettings(
  spaceId: string,
  userId: string,
  updates: Partial<SpaceSettings>
): Promise<ServiceResult<SpaceSettings>> {
  const permission = await canEditSettings(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const settings = await storageUpdateSettings(spaceId, updates);
    if (!settings) {
      return { success: false, error: 'Space nicht gefunden' };
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
 * Get space memory
 */
export async function getMemory(
  spaceId: string,
  userId: string
): Promise<ServiceResult<SpaceMemory>> {
  const permission = await canViewSpace(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const memory = await loadSpaceMemory(spaceId);
    return { success: true, data: memory };
  } catch (error: any) {
    console.error('Error getting memory:', error);
    return { success: false, error: error.message || 'Fehler beim Laden' };
  }
}

/**
 * Add an about item to space memory
 */
export async function addAbout(
  spaceId: string,
  userId: string,
  content: string,
  source: MemorySource = 'manual'
): Promise<ServiceResult<any>> {
  const permission = await canWriteMemory(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Inhalt ist erforderlich' };
  }

  try {
    const item = await addSpaceAboutItem(spaceId, content.trim(), source);
    return { success: true, data: item };
  } catch (error: any) {
    console.error('Error adding about item:', error);
    return { success: false, error: error.message || 'Fehler beim Hinzufügen' };
  }
}

/**
 * Add an instruction to space memory
 */
export async function addInstruction(
  spaceId: string,
  userId: string,
  content: string,
  priority: Priority = 'normal',
  source: MemorySource = 'manual'
): Promise<ServiceResult<any>> {
  const permission = await canWriteMemory(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Inhalt ist erforderlich' };
  }

  try {
    const item = await addSpaceInstruction(spaceId, content.trim(), priority, source);
    return { success: true, data: item };
  } catch (error: any) {
    console.error('Error adding instruction:', error);
    return { success: false, error: error.message || 'Fehler beim Hinzufügen' };
  }
}

/**
 * Add a context item to space memory
 */
export async function addContext(
  spaceId: string,
  userId: string,
  name: string,
  description?: string,
  active: boolean = true,
  source: MemorySource = 'manual'
): Promise<ServiceResult<any>> {
  const permission = await canWriteMemory(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  if (!name || name.trim().length === 0) {
    return { success: false, error: 'Name ist erforderlich' };
  }

  try {
    const item = await addSpaceContextItem(
      spaceId,
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
  spaceId: string,
  userId: string,
  section: MemorySection,
  itemId: string
): Promise<ServiceResult<void>> {
  const permission = await canWriteMemory(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const success = await deleteSpaceMemoryItem(spaceId, section, itemId);
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
  spaceId: string,
  userId: string,
  itemId: string,
  active: boolean
): Promise<ServiceResult<void>> {
  const permission = await canWriteMemory(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const success = await setSpaceContextActive(spaceId, itemId, active);
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
 * Get formatted space memory for prompt injection
 */
export async function getFormattedMemory(
  spaceId: string,
  userId: string
): Promise<ServiceResult<string>> {
  const permission = await canViewSpace(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  const space = await loadSpace(spaceId);
  if (!space) {
    return { success: false, error: 'Space nicht gefunden' };
  }

  try {
    const memory = await loadSpaceMemory(spaceId);
    const formatted = formatSpaceMemoryForPrompt(memory, space.name);
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
 * Get linked KB collections for a space
 */
export async function getKBLinks(
  spaceId: string,
  userId: string
): Promise<ServiceResult<SpaceKBLinks>> {
  const permission = await canViewSpace(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const links = await loadSpaceKBLinks(spaceId);
    return { success: true, data: links };
  } catch (error: any) {
    console.error('Error getting KB links:', error);
    return { success: false, error: error.message || 'Fehler beim Laden' };
  }
}

/**
 * Link a KB collection to a space
 */
export async function linkKBCollection(
  spaceId: string,
  userId: string,
  collectionId: string
): Promise<ServiceResult<any>> {
  const permission = await canWriteMemory(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const link = await storageLinkKB(spaceId, collectionId, userId);
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
 * Unlink a KB collection from a space
 */
export async function unlinkKBCollection(
  spaceId: string,
  userId: string,
  collectionId: string
): Promise<ServiceResult<void>> {
  const permission = await canWriteMemory(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const success = await storageUnlinkKB(spaceId, collectionId);
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
 * Get KB collection IDs for a space (for RAG prioritization)
 */
export async function getKBCollectionIds(spaceId: string): Promise<string[]> {
  return getSpaceKBCollectionIds(spaceId);
}

// =============================================================================
// Chats
// =============================================================================

/**
 * List space chats
 */
export async function listChats(
  spaceId: string,
  userId: string
): Promise<ServiceResult<any[]>> {
  const permission = await canViewChats(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const chats = await listSpaceChats(spaceId);
    return { success: true, data: chats };
  } catch (error: any) {
    console.error('Error listing chats:', error);
    return { success: false, error: error.message || 'Fehler beim Laden' };
  }
}

/**
 * Get a space chat
 */
export async function getChat(
  spaceId: string,
  userId: string,
  chatId: string
): Promise<ServiceResult<any>> {
  const permission = await canViewChats(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  try {
    const chat = await loadSpaceChat(spaceId, chatId);
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
 * Delete a space chat
 */
export async function deleteChat(
  spaceId: string,
  userId: string,
  chatId: string
): Promise<ServiceResult<void>> {
  const permission = await canViewChats(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  // Only allow deletion by chat owner or space admins
  const chat = await loadSpaceChat(spaceId, chatId);
  if (!chat) {
    return { success: false, error: 'Chat nicht gefunden' };
  }

  const { role } = await getUserPermissions(spaceId, userId);
  if (chat.userId !== userId && role !== 'owner' && role !== 'admin') {
    return { success: false, error: 'Keine Berechtigung zum Löschen dieses Chats' };
  }

  try {
    const success = await storageDeleteChat(spaceId, chatId);
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
 * Get full space context for chat integration
 * Returns formatted memory and KB collection IDs
 */
export async function getSpaceContext(
  spaceId: string,
  userId: string
): Promise<ServiceResult<{
  spaceName: string;
  formattedMemory: string;
  kbCollectionIds: string[];
  settings: SpaceSettings;
}>> {
  const permission = await canViewSpace(spaceId, userId);

  if (!permission.allowed) {
    return { success: false, error: permission.reason };
  }

  const space = await loadSpace(spaceId);
  if (!space) {
    return { success: false, error: 'Space nicht gefunden' };
  }

  try {
    const memory = await loadSpaceMemory(spaceId);
    const formattedMemory = space.settings.include_memory_in_prompt
      ? formatSpaceMemoryForPrompt(memory, space.name)
      : '';

    const kbCollectionIds = space.settings.include_kb_in_prompt
      ? await getSpaceKBCollectionIds(spaceId)
      : [];

    return {
      success: true,
      data: {
        spaceName: space.name,
        formattedMemory,
        kbCollectionIds,
        settings: space.settings,
      },
    };
  } catch (error: any) {
    console.error('Error getting space context:', error);
    return { success: false, error: error.message || 'Fehler beim Laden des Kontexts' };
  }
}

// Re-export types and permissions for convenience
export { getUserPermissions } from './permissions';
export type { Space, SpaceMember, SpaceMemory, SpaceSettings, SpaceRole } from './types';
