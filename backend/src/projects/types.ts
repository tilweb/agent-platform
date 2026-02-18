/**
 * Project Types
 *
 * TypeScript interfaces for the Projects feature.
 * Enables multi-user collaboration with project-specific memory and KB.
 */

// Role types
export type ProjectRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type MemorySource = 'manual' | 'agent';
export type Priority = 'high' | 'normal';
export type MemorySection = 'about' | 'instructions' | 'context';

// Project Member
export interface ProjectMember {
  userId: string;
  role: ProjectRole;
  addedAt: string;
  addedBy: string;
}

// Project Settings
export interface ProjectSettings {
  include_memory_in_prompt: boolean;
  include_kb_in_prompt: boolean;
  default_chat_visibility: 'project' | 'private';
}

// Main Project Interface
export interface Project {
  id: string;
  name: string;
  description?: string;
  icon?: string;                    // Icon identifier (e.g., 'briefcase')
  color?: string;                   // Color code for UI
  createdAt: string;
  updatedAt: string;
  createdBy: string;                // userId of creator
  members: ProjectMember[];
  settings: ProjectSettings;
  archived: boolean;
}

// Project Memory Items (same structure as User Memory)
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

// Project Memory
export interface ProjectMemory {
  projectId: string;
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

// Project KB Links Storage
export interface ProjectKBLinks {
  projectId: string;
  updatedAt: string;
  collections: KBCollectionLink[];
}

// Project Chat (stored per project)
export interface ProjectChatMessage {
  role: 'user' | 'assistant';
  content: string;
  agentId?: string;
  routedBy?: string;
}

export interface ProjectChat {
  id: string;
  projectId: string;
  userId: string;           // Who initiated the chat
  title: string;
  summary?: string;
  keywords?: string[];
  createdAt: string;
  updatedAt: string;
  messages: ProjectChatMessage[];
}

// Role permission matrix
export const ROLE_PERMISSIONS: Record<ProjectRole, {
  canEditProject: boolean;
  canEditSettings: boolean;
  canWriteMemory: boolean;
  canViewChats: boolean;
  canManageMembers: boolean;
  canDeleteProject: boolean;
}> = {
  owner: {
    canEditProject: true,
    canEditSettings: true,
    canWriteMemory: true,
    canViewChats: true,
    canManageMembers: true,
    canDeleteProject: true,
  },
  admin: {
    canEditProject: false,
    canEditSettings: true,
    canWriteMemory: true,
    canViewChats: true,
    canManageMembers: true, // except owner
    canDeleteProject: false,
  },
  editor: {
    canEditProject: false,
    canEditSettings: false,
    canWriteMemory: true,
    canViewChats: true,
    canManageMembers: false,
    canDeleteProject: false,
  },
  viewer: {
    canEditProject: false,
    canEditSettings: false,
    canWriteMemory: false,
    canViewChats: true,
    canManageMembers: false,
    canDeleteProject: false,
  },
};

// Default project settings
export function createDefaultSettings(): ProjectSettings {
  return {
    include_memory_in_prompt: true,
    include_kb_in_prompt: true,
    default_chat_visibility: 'project',
  };
}

// Default empty memory
export function createDefaultMemory(projectId: string): ProjectMemory {
  return {
    projectId,
    updatedAt: '',
    about: [],
    instructions: [],
    context: [],
  };
}

// Default empty KB links
export function createDefaultKBLinks(projectId: string): ProjectKBLinks {
  return {
    projectId,
    updatedAt: '',
    collections: [],
  };
}
