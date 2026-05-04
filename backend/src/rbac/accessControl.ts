/**
 * RBAC Access Control Service
 *
 * Core permission checking logic with support for:
 * - Direct user access
 * - Group-based access (highest role wins)
 * - Plattform-Admin-Bypass (Owner-aequivalente Rechte)
 *
 * Plattform-Admin-Bypass: Globale Admins (User-Rolle 'admin') haben auf
 * alle Resources Owner-Rechte. Begruendung: Demo-/Multi-Instanz-Deployments
 * fuehren regelmaessig zu Orphan-Resources (z.B. seed-importierte Agenten
 * mit access.yaml-Eintraegen die User-IDs aus einer anderen Instanz
 * referenzieren — keiner der lokalen User ist Owner, keiner kann mehr ran).
 * Ohne Bypass war die einzige Recovery DB-Manipulation. Mit Bypass kann
 * der Admin direkt in der UI aufraeumen.
 *
 * Privacy-Konsequenz: Admins sehen/managen alles im RBAC-Scope (Agents,
 * Knowledge-Bases, Spaces, App-Daten). Chats laufen ueber das separate
 * Memory-Subsystem und sind davon NICHT betroffen.
 */

import { getUserGroups, loadGroup } from '../auth/groups';
import { loadUser } from '../auth/storage';
import {
  loadResourceAccess,
  getResourceAccessEntry,
} from './storage';
import type {
  ResourceType,
  ResourceRole,
  PermissionName,
  PrincipalType,
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
 * 3. Plattform-Admin-Bypass (Owner-aequivalent)
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

  // 3. Plattform-Admin-Bypass: globale Admins bekommen Owner-aequivalente Rechte.
  const user = await loadUser(userId);
  if (user?.role === 'admin') {
    return {
      allowed: true,
      effectiveRole: 'owner',
      source: 'admin',
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

  // 3. Plattform-Admin-Bypass: ohne explizite Rolle bekommt der globale
  // Admin Owner-aequivalente Rechte (Recovery-Pfad fuer Orphan-Resources).
  if (!effectiveRole) {
    const user = await loadUser(userId);
    if (user?.role === 'admin') return 'owner';
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

  // Plattform-Admin ohne explizite Rolle bekommt Owner-aequivalente Rechte
  // (siehe Modul-Header). getEffectiveRole hat oben null geliefert —
  // wir werten den Admin-Status hier aus und mappen auf 'owner'.
  if (isGlobalAdmin) {
    return {
      role: 'owner',
      permissions: RESOURCE_PERMISSIONS.owner,
      isGlobalAdmin,
    };
  }

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

  // Plattform-Admin sieht alles als Owner (Recovery-Pfad fuer Orphan-Resources).
  const user = await loadUser(userId);
  const isGlobalAdmin = user?.role === 'admin';

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
      continue;
    }

    // Admin-Bypass — Owner-aequivalent fuer Resources ohne explizite Rolle.
    if (isGlobalAdmin) {
      accessible.push({ resourceId, role: 'owner' });
    }
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

/**
 * Owner-Info fuer eine Resource — wer kann Zugriff freigeben?
 *
 * Wird in Listen-Endpoints (Collections, Spaces, Agents) verwendet, damit
 * der UI-Layer den Hinweis "Zugriff anfragen bei <Name>" anzeigen kann.
 * Ein User-Owner wird einer Group bevorzugt (eindeutigere Anlaufstelle).
 *
 * @returns `{ principalType, principalId, name }` des ersten gefundenen
 *          Owner-Eintrags, oder `null` wenn die Resource keinen Owner hat.
 */
export async function getResourceOwnerInfo(
  resourceType: ResourceType,
  resourceId: string,
): Promise<{ principalType: PrincipalType; principalId: string; name: string } | null> {
  const accessList = await loadResourceAccess(resourceType, resourceId);

  // User-Owner bevorzugt
  const userOwner = accessList.find((a) => a.principalType === 'user' && a.role === 'owner');
  if (userOwner) {
    const user = await loadUser(userOwner.principalId);
    if (user) {
      return {
        principalType: 'user',
        principalId: userOwner.principalId,
        name: user.displayName || user.username,
      };
    }
  }

  // Group-Owner als Fallback
  const groupOwner = accessList.find((a) => a.principalType === 'group' && a.role === 'owner');
  if (groupOwner) {
    const group = await loadGroup(groupOwner.principalId);
    if (group) {
      return {
        principalType: 'group',
        principalId: groupOwner.principalId,
        name: group.name,
      };
    }
  }

  return null;
}
