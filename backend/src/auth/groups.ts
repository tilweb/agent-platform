/**
 * User Groups Storage - YAML-based group persistence
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { GROUPS_DIR } from '../utils/paths';

export interface UserGroup {
  id: string;
  name: string;
  description?: string;
  color?: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  color?: string;
  memberIds?: string[];
}

/**
 * Ensure the groups directory exists
 */
async function ensureGroupsDir(): Promise<void> {
  if (!existsSync(GROUPS_DIR)) {
    await mkdir(GROUPS_DIR, { recursive: true });
  }
}

/**
 * Generate a unique group ID
 */
function generateGroupId(): string {
  return `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get the file path for a group
 */
function getGroupFilePath(groupId: string): string {
  return join(GROUPS_DIR, `${groupId}.yaml`);
}

/**
 * Save a group to storage
 */
export async function saveGroup(group: UserGroup): Promise<void> {
  await ensureGroupsDir();
  const filePath = getGroupFilePath(group.id);
  const yaml = stringifyYaml(group);
  await writeFile(filePath, yaml, 'utf-8');
}

/**
 * Load a group by ID
 */
export async function loadGroup(groupId: string): Promise<UserGroup | null> {
  const filePath = getGroupFilePath(groupId);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, 'utf-8');
  return parseYaml(content) as UserGroup;
}

/**
 * Create a new group
 */
export async function createGroup(input: CreateGroupInput, createdBy?: string): Promise<UserGroup> {
  const now = new Date().toISOString();

  const group: UserGroup = {
    id: generateGroupId(),
    name: input.name,
    description: input.description,
    color: input.color,
    memberIds: input.memberIds || [],
    createdAt: now,
    updatedAt: now,
    createdBy,
  };

  await saveGroup(group);
  return group;
}

/**
 * Update a group
 */
export async function updateGroup(
  groupId: string,
  updates: Partial<Omit<UserGroup, 'id' | 'createdAt' | 'createdBy'>>
): Promise<UserGroup | null> {
  const group = await loadGroup(groupId);
  if (!group) {
    return null;
  }

  const updatedGroup: UserGroup = {
    ...group,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveGroup(updatedGroup);
  return updatedGroup;
}

/**
 * Delete a group
 */
export async function deleteGroup(groupId: string): Promise<boolean> {
  const filePath = getGroupFilePath(groupId);

  if (!existsSync(filePath)) {
    return false;
  }

  await unlink(filePath);
  return true;
}

/**
 * List all groups
 */
export async function listGroups(): Promise<UserGroup[]> {
  await ensureGroupsDir();

  const groups: UserGroup[] = [];
  const { readdir } = await import('fs/promises');

  try {
    const files = await readdir(GROUPS_DIR);

    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;

      const filePath = join(GROUPS_DIR, file);
      const content = await readFile(filePath, 'utf-8');
      const group = parseYaml(content) as UserGroup;
      groups.push(group);
    }
  } catch (err) {
    // Directory might not exist yet
  }

  // Sort by name
  groups.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}

/**
 * Add a member to a group
 */
export async function addGroupMember(groupId: string, userId: string): Promise<UserGroup | null> {
  const group = await loadGroup(groupId);
  if (!group) {
    return null;
  }

  if (!group.memberIds.includes(userId)) {
    group.memberIds.push(userId);
    group.updatedAt = new Date().toISOString();
    await saveGroup(group);
  }

  return group;
}

/**
 * Remove a member from a group
 */
export async function removeGroupMember(groupId: string, userId: string): Promise<UserGroup | null> {
  const group = await loadGroup(groupId);
  if (!group) {
    return null;
  }

  const index = group.memberIds.indexOf(userId);
  if (index !== -1) {
    group.memberIds.splice(index, 1);
    group.updatedAt = new Date().toISOString();
    await saveGroup(group);
  }

  return group;
}

/**
 * Get all groups a user belongs to
 */
export async function getUserGroups(userId: string): Promise<UserGroup[]> {
  const allGroups = await listGroups();
  return allGroups.filter(group => group.memberIds.includes(userId));
}

/**
 * Check if a user is member of a specific group
 */
export async function isUserInGroup(userId: string, groupId: string): Promise<boolean> {
  const group = await loadGroup(groupId);
  if (!group) {
    return false;
  }
  return group.memberIds.includes(userId);
}

/**
 * Check if a user is member of any of the specified groups
 */
export async function isUserInAnyGroup(userId: string, groupIds: string[]): Promise<boolean> {
  for (const groupId of groupIds) {
    if (await isUserInGroup(userId, groupId)) {
      return true;
    }
  }
  return false;
}
