/**
 * Spaces Module
 *
 * Re-exports all space-related types and services.
 */

// Types
export type {
  Space,
  SpaceMember,
  SpaceMemory,
  SpaceSettings,
  SpaceKBLinks,
  SpaceChat,
  SpaceChatMessage,
  SpaceRole,
  MemorySection,
  Priority,
  MemorySource,
  AboutItem,
  InstructionItem,
  ContextItem,
  KBCollectionLink,
} from './types';

export { ROLE_PERMISSIONS, createDefaultSettings, createDefaultMemory, createDefaultKBLinks } from './types';

// Utility re-export
export { generateId } from '../utils/id';

// Storage
export {
  loadSpace,
  saveSpace,
  createSpace as storageCreateSpace,
  listSpaces as storageListSpaces,
  loadSpaceMemory,
  saveSpaceMemory,
  formatSpaceMemoryForPrompt,
  loadSpaceKBLinks,
  saveSpaceKBLinks,
  listSpaceChats,
  loadSpaceChat,
  saveSpaceChat,
} from './storage';

// Permissions
export {
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
  getUserRole,
  isMember,
} from './permissions';

// Service (main API)
export {
  createSpace,
  getSpace,
  updateSpace,
  archiveSpace,
  deleteSpace,
  listUserSpaces,
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
  getSpaceContext,
} from './service';

export type { ServiceResult } from './service';
