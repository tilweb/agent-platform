/**
 * RBAC Storage - YAML-based access persistence
 *
 * Stores access entries per resource in access.yaml files:
 * - data/projects/{id}/access.yaml
 * - data/knowledge-base/collections/{id}/access.yaml
 * - data/skills/public/{id}/access.yaml
 * - data/agents/{id}/access.yaml
 * - etc.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import type { ResourceType, ResourceAccess, PrincipalType, ResourceRole } from './types';
import { RESOURCE_DATA_DIRS } from './types';

// Use same path resolution as projects/storage.ts
const DATA_DIR = resolve(process.cwd(), '../data');

/**
 * Get the directory path for a resource
 */
function getResourceDir(resourceType: ResourceType, resourceId: string): string {
  const baseDir = RESOURCE_DATA_DIRS[resourceType];
  return join(DATA_DIR, baseDir, resourceId);
}

/**
 * Get the access file path for a resource
 */
function getAccessFilePath(resourceType: ResourceType, resourceId: string): string {
  return join(getResourceDir(resourceType, resourceId), 'access.yaml');
}

/**
 * Ensure the resource directory exists
 */
async function ensureResourceDir(resourceType: ResourceType, resourceId: string): Promise<void> {
  const dir = getResourceDir(resourceType, resourceId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Load all access entries for a resource
 */
export async function loadResourceAccess(
  resourceType: ResourceType,
  resourceId: string
): Promise<ResourceAccess[]> {
  const filePath = getAccessFilePath(resourceType, resourceId);

  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const data = parseYaml(content);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error loading access for ${resourceType}/${resourceId}:`, error);
    return [];
  }
}

/**
 * Save all access entries for a resource
 */
export async function saveResourceAccess(
  resourceType: ResourceType,
  resourceId: string,
  accessList: ResourceAccess[]
): Promise<void> {
  await ensureResourceDir(resourceType, resourceId);
  const filePath = getAccessFilePath(resourceType, resourceId);
  const yaml = stringifyYaml(accessList);
  await writeFile(filePath, yaml, 'utf-8');
}

/**
 * Get a specific access entry for a principal
 */
export async function getResourceAccessEntry(
  resourceType: ResourceType,
  resourceId: string,
  principalType: PrincipalType,
  principalId: string
): Promise<ResourceAccess | null> {
  const accessList = await loadResourceAccess(resourceType, resourceId);
  return accessList.find(
    (a) => a.principalType === principalType && a.principalId === principalId
  ) || null;
}

/**
 * Grant access to a resource
 */
export async function grantAccess(
  resourceType: ResourceType,
  resourceId: string,
  principalType: PrincipalType,
  principalId: string,
  role: ResourceRole,
  grantedBy: string
): Promise<ResourceAccess> {
  const accessList = await loadResourceAccess(resourceType, resourceId);

  // Check if entry already exists
  const existingIndex = accessList.findIndex(
    (a) => a.principalType === principalType && a.principalId === principalId
  );

  const now = new Date().toISOString();
  const newEntry: ResourceAccess = {
    principalType,
    principalId,
    role,
    grantedAt: now,
    grantedBy,
  };

  if (existingIndex >= 0) {
    // Update existing entry
    accessList[existingIndex] = newEntry;
  } else {
    // Add new entry
    accessList.push(newEntry);
  }

  await saveResourceAccess(resourceType, resourceId, accessList);
  return newEntry;
}

/**
 * Update role for an existing access entry
 */
export async function updateAccessRole(
  resourceType: ResourceType,
  resourceId: string,
  principalType: PrincipalType,
  principalId: string,
  newRole: ResourceRole,
  updatedBy: string
): Promise<ResourceAccess | null> {
  const accessList = await loadResourceAccess(resourceType, resourceId);

  const index = accessList.findIndex(
    (a) => a.principalType === principalType && a.principalId === principalId
  );

  if (index < 0) {
    return null;
  }

  // Update role while preserving original grantedAt
  const existingEntry = accessList[index];
  if (!existingEntry) {
    return null;
  }

  const updatedEntry: ResourceAccess = {
    principalType: existingEntry.principalType,
    principalId: existingEntry.principalId,
    role: newRole,
    grantedBy: updatedBy,
    grantedAt: new Date().toISOString(),
  };
  accessList[index] = updatedEntry;

  await saveResourceAccess(resourceType, resourceId, accessList);
  return updatedEntry;
}

/**
 * Revoke access from a resource
 */
export async function revokeAccess(
  resourceType: ResourceType,
  resourceId: string,
  principalType: PrincipalType,
  principalId: string
): Promise<boolean> {
  const accessList = await loadResourceAccess(resourceType, resourceId);

  const index = accessList.findIndex(
    (a) => a.principalType === principalType && a.principalId === principalId
  );

  if (index < 0) {
    return false;
  }

  accessList.splice(index, 1);
  await saveResourceAccess(resourceType, resourceId, accessList);
  return true;
}

/**
 * Get all users with access to a resource
 */
export async function getUsersWithAccess(
  resourceType: ResourceType,
  resourceId: string
): Promise<ResourceAccess[]> {
  const accessList = await loadResourceAccess(resourceType, resourceId);
  return accessList.filter((a) => a.principalType === 'user');
}

/**
 * Get all groups with access to a resource
 */
export async function getGroupsWithAccess(
  resourceType: ResourceType,
  resourceId: string
): Promise<ResourceAccess[]> {
  const accessList = await loadResourceAccess(resourceType, resourceId);
  return accessList.filter((a) => a.principalType === 'group');
}

/**
 * Get the owner of a resource (there should be exactly one)
 */
export async function getResourceOwner(
  resourceType: ResourceType,
  resourceId: string
): Promise<ResourceAccess | null> {
  const accessList = await loadResourceAccess(resourceType, resourceId);
  return accessList.find((a) => a.role === 'owner') || null;
}

/**
 * Transfer ownership to a new user
 */
export async function transferOwnership(
  resourceType: ResourceType,
  resourceId: string,
  newOwnerId: string,
  transferredBy: string
): Promise<boolean> {
  const accessList = await loadResourceAccess(resourceType, resourceId);

  // Find current owner
  const ownerIndex = accessList.findIndex((a) => a.role === 'owner');
  if (ownerIndex < 0) {
    return false;
  }

  const oldOwner = accessList[ownerIndex];
  if (!oldOwner) {
    return false;
  }

  // Demote old owner to admin
  accessList[ownerIndex] = {
    principalType: oldOwner.principalType,
    principalId: oldOwner.principalId,
    role: 'admin',
    grantedAt: new Date().toISOString(),
    grantedBy: transferredBy,
  };

  // Check if new owner already has access
  const newOwnerIndex = accessList.findIndex(
    (a) => a.principalType === 'user' && a.principalId === newOwnerId
  );

  const now = new Date().toISOString();
  if (newOwnerIndex >= 0) {
    // Promote existing entry to owner
    const existingNewOwner = accessList[newOwnerIndex];
    if (existingNewOwner) {
      accessList[newOwnerIndex] = {
        principalType: existingNewOwner.principalType,
        principalId: existingNewOwner.principalId,
        role: 'owner',
        grantedAt: now,
        grantedBy: transferredBy,
      };
    }
  } else {
    // Add new owner entry
    accessList.push({
      principalType: 'user',
      principalId: newOwnerId,
      role: 'owner',
      grantedAt: now,
      grantedBy: transferredBy,
    });
  }

  await saveResourceAccess(resourceType, resourceId, accessList);
  return true;
}

/**
 * Initialize access for a new resource (sets creator as owner)
 */
export async function initializeResourceAccess(
  resourceType: ResourceType,
  resourceId: string,
  creatorId: string
): Promise<ResourceAccess> {
  const now = new Date().toISOString();
  const ownerEntry: ResourceAccess = {
    principalType: 'user',
    principalId: creatorId,
    role: 'owner',
    grantedAt: now,
    grantedBy: creatorId,
  };

  await saveResourceAccess(resourceType, resourceId, [ownerEntry]);
  return ownerEntry;
}

/**
 * Delete all access entries for a resource
 * Called when resource is deleted
 */
export async function deleteResourceAccess(
  resourceType: ResourceType,
  resourceId: string
): Promise<void> {
  const filePath = getAccessFilePath(resourceType, resourceId);

  if (existsSync(filePath)) {
    const { unlink } = await import('fs/promises');
    await unlink(filePath);
  }
}

/**
 * Check if a resource has any access entries
 */
export async function hasAccessEntries(
  resourceType: ResourceType,
  resourceId: string
): Promise<boolean> {
  const accessList = await loadResourceAccess(resourceType, resourceId);
  return accessList.length > 0;
}
