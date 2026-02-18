/**
 * Projects Module
 *
 * Re-exports all project-related types and services.
 */

// Types
export type {
  Project,
  ProjectMember,
  ProjectMemory,
  ProjectSettings,
  ProjectKBLinks,
  ProjectChat,
  ProjectChatMessage,
  ProjectRole,
  MemorySection,
  Priority,
  MemorySource,
  AboutItem,
  InstructionItem,
  ContextItem,
  KBCollectionLink,
} from './types';

export { ROLE_PERMISSIONS, createDefaultSettings, createDefaultMemory, createDefaultKBLinks } from './types';

// Storage
export {
  generateId,
  loadProject,
  saveProject,
  createProject as storageCreateProject,
  listProjects as storageListProjects,
  loadProjectMemory,
  saveProjectMemory,
  formatProjectMemoryForPrompt,
  loadProjectKBLinks,
  saveProjectKBLinks,
  listProjectChats,
  loadProjectChat,
  saveProjectChat,
} from './storage';

// Permissions
export {
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
  getUserRole,
  isMember,
} from './permissions';

// Service (main API)
export {
  createProject,
  getProject,
  updateProject,
  archiveProject,
  deleteProject,
  listUserProjects,
  getMembers,
  addMember,
  updateMemberRole,
  removeMember,
  updateSettings,
  getMemory,
  addAbout,
  addInstruction,
  addContext,
  deleteMemoryItem,
  setContextActive,
  getFormattedMemory,
  getKBLinks,
  linkKBCollection,
  unlinkKBCollection,
  getKBCollectionIds,
  listChats,
  getChat,
  deleteChat,
  getProjectContext,
} from './service';

export type { ServiceResult } from './service';
