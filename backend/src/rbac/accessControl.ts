/**
 * RBAC Access Control Service
 *
 * Core permission checking logic with support for:
 * - Direct user access
 * - Group-based access (highest role wins)
 *
 * Globale Admins haben KEINEN automatischen Resource-Zugriff. Admin-Rolle
 * regelt Plattform-Settings (Users, Groups, App-Aktivierung), nicht den
 * Zugriff auf konkrete Collections, Spaces, Agents oder App-Daten. Will der
 * Admin reinschauen, muss der Owner ihn (oder eine Admin-Gruppe) explizit
 * berechtigen.
 */

import { getUserGroups } from '../auth/groups';
import { loadUser } from '../auth/storage';
import {
  loadResourceAccess,
  getResourceAccessEntry,
} from './storage';
import type {
  ResourceType,
  ResourceRole,
  PermissionName,
  ResourceAccess,
} from './types';
import {
  RESOURCE_PERMISSIONS,
  getHigherRole,
  roleHasPermission,
} from './types';

/**
 * Result of an access check
 */
export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  effectiveRole?: ResourceRole;
  source?: 'direct' | 'group' | 'admin';
}

/**
 * Check if a user has a specific permission on a resource
 *
 * Permission check order:
 * 1. Direct user access
 * 2. Group-based access (highest role from all groups)
 *
 * KEIN Admin-Bypass — Plattform-Admins muessen explizit (direkt oder via
 * Gruppe) berechtigt sein, um eine konkrete Resource zu sehen.
 */
export async function checkAccess(
  userId: string,
  resourceType: ResourceType,
  resourceId: string,
  requiredPermission: PermissionName
): Promise<AccessCheckResult> {
  // 1. Check direct user access
  const directAccess = await getResourceAccessEntry(resourceType, resourceId, 'user', userId);
  if (directAccess && roleHasPermission(directAccess.role, requiredPermission)) {
    return {
      allowed: true,
      effectiveRole: directAccess.role,
      source: 'direct',
    };
  }

  // 2. Check group-based access (highest role wins)
  const userGroups = await getUserGroups(userId);
  let highestGroupRole: ResourceRole | null = null;

  for (const group of userGroups) {
    const groupAccess = await getResourceAccessEntry(resourceType, resourceId, 'group', group.id);
    if (groupAccess) {
      highestGroupRole = getHigherRole(highestGroupRole, groupAccess.role);
    }
  }

  if (highestGroupRole && roleHasPermission(highestGroupRole, requiredPermission)) {
    return {
      allowed: true,
      effectiveRole: highestGroupRole,
      source: 'group',
    };
  }

  // Access denied
  return {
    allowed: false,
    reason: 'Keine Berechtigung für diese Aktion',
  };
}

/**
 * Check if a user can view a resource
 */
export async function canView(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<AccessCheckResult> {
  return checkAccess(userId, resourceType, resourceId, 'canView');
}

/**
 * Check if a user can edit a resource
 */
export async function canEdit(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<AccessCheckResult> {
  return checkAccess(userId, resourceType, resourceId, 'canEdit');
}

/**
 * Check if a user can delete a resource
 */
export async function canDelete(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<AccessCheckResult> {
  return checkAccess(userId, resourceType, resourceId, 'canDelete');
}

/**
 * Check if a user can manage access to a resource
 */
export async function canManageAccess(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<AccessCheckResult> {
  return checkAccess(userId, resourceType, resourceId, 'canManageAccess');
}

/**
 * Check if a user can transfer ownership of a resource
 */
export async function canTransferOwnership(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<AccessCheckResult> {
  return checkAccess(userId, resourceType, resourceId, 'canTransferOwnership');
}

/**
 * Get the effective role for a user on a resource
 * Combines direct and group access, returns highest role
 */
export async function getEffectiveRole(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<ResourceRole | null> {
  let effectiveRole: ResourceRole | null = null;

  // 1. Direct user access
  const directAccess = await getResourceAccessEntry(resourceType, resourceId, 'user', userId);
  if (directAccess) {
    effectiveRole = directAccess.role;
  }

  // 2. Group-based access (highest role wins)
  const userGroups = await getUserGroups(userId);
  for (const group of userGroups) {
    const groupAccess = await getResourceAccessEntry(resourceType, resourceId, 'group', group.id);
    if (groupAccess) {
      effectiveRole = getHigherRole(effectiveRole, groupAccess.role);
    }
  }

  return effectiveRole;
}

/**
 * Get all permissions for a user on a resource
 */
export async function getUserResourcePermissions(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<{
  role: ResourceRole | null;
  permissions: typeof RESOURCE_PERMISSIONS[ResourceRole] | null;
  isGlobalAdmin: boolean;
}> {
  const effectiveRole = await getEffectiveRole(userId, resourceType, resourceId);
  const user = await loadUser(userId);
  const isGlobalAdmin = user?.role === 'admin';

  if (effectiveRole) {
    return {
      role: effectiveRole,
      permissions: RESOURCE_PERMISSIONS[effectiveRole],
      isGlobalAdmin,
    };
  }

  // Plattform-Admin ohne explizite Rolle hat KEINEN Resource-Zugriff —
  // Admin managed Settings, nicht Daten. Owner muss Admin explizit berechtigen.
  return {
    role: null,
    permissions: null,
    isGlobalAdmin,
  };
}

/**
 * Check if a user has any access to a resource
 */
export async function hasAnyAccess(
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<boolean> {
  const result = await checkAccess(userId, resourceType, resourceId, 'canView');
  return result.allowed;
}

/**
 * List all resources of a type that a user has access to
 * Returns resource IDs with their effective roles
 */
export async function listAccessibleResources(
  userId: string,
  resourceType: ResourceType,
  resourceIds: string[]
): Promise<Array<{ resourceId: string; role: ResourceRole }>> {
  const accessible: Array<{ resourceId: string; role: ResourceRole }> = [];

  // Get user's groups once
  const userGroups = await getUserGroups(userId);
  const userGroupIds = userGroups.map((g) => g.id);

  for (const resourceId of resourceIds) {
    // Check direct access
    const directAccess = await getResourceAccessEntry(resourceType, resourceId, 'user', userId);
    if (directAccess) {
      accessible.push({ resourceId, role: directAccess.role });
      continue;
    }

    // Check group access
    let highestGroupRole: ResourceRole | null = null;
    for (const groupId of userGroupIds) {
      const groupAccess = await getResourceAccessEntry(resourceType, resourceId, 'group', groupId);
      if (groupAccess) {
        highestGroupRole = getHigherRole(highestGroupRole, groupAccess.role);
      }
    }

    if (highestGroupRole) {
      accessible.push({ resourceId, role: highestGroupRole });
    }
    // Kein Admin-Fallback — Plattform-Admin sieht nur, was explizit berechtigt ist.
  }

  return accessible;
}

/**
 * Get detailed access info for a resource (for UI display)
 */
export async function getResourceAccessInfo(
  resourceType: ResourceType,
  resourceId: string
): Promise<{
  users: Array<ResourceAccess & { type: 'user' }>;
  groups: Array<ResourceAccess & { type: 'group' }>;
}> {
  const accessList = await loadResourceAccess(resourceType, resourceId);

  return {
    users: accessList
      .filter((a) => a.principalType === 'user')
      .map((a) => ({ ...a, type: 'user' as const })),
    groups: accessList
      .filter((a) => a.principalType === 'group')
      .map((a) => ({ ...a, type: 'group' as const })),
  };
}
