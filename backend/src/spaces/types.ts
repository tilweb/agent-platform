/**
 * Space Types
 *
 * TypeScript interfaces for the Spaces feature.
 * Enables multi-user collaboration with space-specific memory and KB.
 */

// Role types
export type SpaceRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type MemorySource = 'manual' | 'agent';
export type Priority = 'high' | 'normal';
export type MemorySection = 'about' | 'instructions' | 'context';

// Space Member
export interface SpaceMember {
  userId: string;
  role: SpaceRole;
  addedAt: string;
  addedBy: string;
}

// Space Settings
export interface SpaceSettings {
  include_memory_in_prompt: boolean;
  include_kb_in_prompt: boolean;
  default_chat_visibility: 'space' | 'private';
}

// Main Space Interface
export interface Space {
  id: string;
  name: string;
  description?: string;
  icon?: string;                    // Icon identifier (e.g., 'briefcase')
  color?: string;                   // Color code for UI
  createdAt: string;
  updatedAt: string;
  createdBy: string;                // userId of creator
  members: SpaceMember[];
  settings: SpaceSettings;
  archived: boolean;
}

// Space Memory Items (same structure as User Memory)
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

// Space Memory
export interface SpaceMemory {
  spaceId: string;
  updatedAt: string;
  about: AboutItem[];
  instructions: InstructionItem[];
  context: ContextItem[];
}

// KB Collection Link
export interface KBCollectionLink {
  collectionId: string;
  linkedAt: string;
  linkedBy: string;
}

// Space KB Links Storage
export interface SpaceKBLinks {
  spaceId: string;
  updatedAt: string;
  collections: KBCollectionLink[];
}

// Space Chat (stored per space)
export interface SpaceChatMessage {
  role: 'user' | 'assistant';
  content: string;
  agentId?: string;
  routedBy?: string;
}

export interface SpaceChat {
  id: string;
  spaceId: string;
  userId: string;           // Who initiated the chat
  title: string;
  summary?: string;
  keywords?: string[];
  createdAt: string;
  updatedAt: string;
  messages: SpaceChatMessage[];
}

// Role permission matrix
export const ROLE_PERMISSIONS: Record<SpaceRole, {
  canEditSpace: boolean;
  canEditSettings: boolean;
  canWriteMemory: boolean;
  canViewChats: boolean;
  canManageMembers: boolean;
  canDeleteSpace: boolean;
}> = {
  owner: {
    canEditSpace: true,
    canEditSettings: true,
    canWriteMemory: true,
    canViewChats: true,
    canManageMembers: true,
    canDeleteSpace: true,
  },
  admin: {
    canEditSpace: false,
    canEditSettings: true,
    canWriteMemory: true,
    canViewChats: true,
    canManageMembers: true, // except owner
    canDeleteSpace: false,
  },
  editor: {
    canEditSpace: false,
    canEditSettings: false,
    canWriteMemory: true,
    canViewChats: true,
    canManageMembers: false,
    canDeleteSpace: false,
  },
  viewer: {
    canEditSpace: false,
    canEditSettings: false,
    canWriteMemory: false,
    canViewChats: true,
    canManageMembers: false,
    canDeleteSpace: false,
  },
};

// Default space settings
export function createDefaultSettings(): SpaceSettings {
  return {
    include_memory_in_prompt: true,
    include_kb_in_prompt: true,
    default_chat_visibility: 'space',
  };
}

// Default empty memory
export function createDefaultMemory(spaceId: string): SpaceMemory {
  return {
    spaceId,
    updatedAt: '',
    about: [],
    instructions: [],
    context: [],
  };
}

// Default empty KB links
export function createDefaultKBLinks(spaceId: string): SpaceKBLinks {
  return {
    spaceId,
    updatedAt: '',
    collections: [],
  };
}
