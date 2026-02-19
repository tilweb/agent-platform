/**
 * Space Permissions Service
 *
 * Role-based access control for space operations.
 */

import type { Space, SpaceMember, SpaceRole } from './types';
import { ROLE_PERMISSIONS } from './types';
import { loadSpace } from './storage';

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  role?: SpaceRole;
}

/**
 * Get a user's role in a space
 */
export function getUserRole(space: Space, userId: string): SpaceRole | null {
  const member = space.members.find((m) => m.userId === userId);
  return member?.role || null;
}

/**
 * Check if a user is a member of a space
 */
export function isMember(space: Space, userId: string): boolean {
  return space.members.some((m) => m.userId === userId);
}

/**
 * Check if a user can view a space
 */
export async function canViewSpace(
  spaceId: string,
  userId: string
): Promise<PermissionCheck> {
  const space = await loadSpace(spaceId);

  if (!space) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = getUserRole(space, userId);
  if (!role) {
    return { allowed: false, reason: 'Kein Zugriff auf diesen Space' };
  }

  return { allowed: true, role };
}

/**
 * Check if a user can edit space metadata (name, description, icon, color)
 */
export async function canEditSpace(
  spaceId: string,
  userId: string
): Promise<PermissionCheck> {
  const space = await loadSpace(spaceId);

  if (!space) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = getUserRole(space, userId);
  if (!role) {
    return { allowed: false, reason: 'Kein Zugriff auf diesen Space' };
  }

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions.canEditSpace) {
    return { allowed: false, reason: 'Keine Berechtigung zum Bearbeiten', role };
  }

  return { allowed: true, role };
}

/**
 * Check if a user can edit space settings
 */
export async function canEditSettings(
  spaceId: string,
  userId: string
): Promise<PermissionCheck> {
  const space = await loadSpace(spaceId);

  if (!space) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = getUserRole(space, userId);
  if (!role) {
    return { allowed: false, reason: 'Kein Zugriff auf diesen Space' };
  }

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions.canEditSettings) {
    return { allowed: false, reason: 'Keine Berechtigung zum Bearbeiten der Einstellungen', role };
  }

  return { allowed: true, role };
}

/**
 * Check if a user can write to space memory
 */
export async function canWriteMemory(
  spaceId: string,
  userId: string
): Promise<PermissionCheck> {
  const space = await loadSpace(spaceId);

  if (!space) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = getUserRole(space, userId);
  if (!role) {
    return { allowed: false, reason: 'Kein Zugriff auf diesen Space' };
  }

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions.canWriteMemory) {
    return { allowed: false, reason: 'Keine Schreibberechtigung für Memory', role };
  }

  return { allowed: true, role };
}

/**
 * Check if a user can view space chats
 */
export async function canViewChats(
  spaceId: string,
  userId: string
): Promise<PermissionCheck> {
  const space = await loadSpace(spaceId);

  if (!space) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = getUserRole(space, userId);
  if (!role) {
    return { allowed: false, reason: 'Kein Zugriff auf diesen Space' };
  }

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions.canViewChats) {
    return { allowed: false, reason: 'Keine Berechtigung zum Anzeigen von Chats', role };
  }

  return { allowed: true, role };
}

/**
 * Check if a user can manage space members
 */
export async function canManageMembers(
  spaceId: string,
  userId: string
): Promise<PermissionCheck> {
  const space = await loadSpace(spaceId);

  if (!space) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = getUserRole(space, userId);
  if (!role) {
    return { allowed: false, reason: 'Kein Zugriff auf diesen Space' };
  }

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions.canManageMembers) {
    return { allowed: false, reason: 'Keine Berechtigung zur Mitgliederverwaltung', role };
  }

  return { allowed: true, role };
}

/**
 * Check if a user can modify a specific member's role
 * Admins can manage everyone except owners
 */
export async function canModifyMember(
  spaceId: string,
  userId: string,
  targetUserId: string
): Promise<PermissionCheck> {
  const space = await loadSpace(spaceId);

  if (!space) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const userRole = getUserRole(space, userId);
  if (!userRole) {
    return { allowed: false, reason: 'Kein Zugriff auf diesen Space' };
  }

  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions.canManageMembers) {
    return { allowed: false, reason: 'Keine Berechtigung zur Mitgliederverwaltung', role: userRole };
  }

  // Cannot modify self
  if (userId === targetUserId) {
    return { allowed: false, reason: 'Eigene Rolle kann nicht geändert werden', role: userRole };
  }

  // Check target's role
  const targetRole = getUserRole(space, targetUserId);
  if (!targetRole) {
    // Target is not a member - can add them
    return { allowed: true, role: userRole };
  }

  // Admins cannot modify owners
  if (userRole === 'admin' && targetRole === 'owner') {
    return { allowed: false, reason: 'Owner-Rolle kann nicht geändert werden', role: userRole };
  }

  return { allowed: true, role: userRole };
}

/**
 * Check if a user can delete a space
 */
export async function canDeleteSpace(
  spaceId: string,
  userId: string
): Promise<PermissionCheck> {
  const space = await loadSpace(spaceId);

  if (!space) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = getUserRole(space, userId);
  if (!role) {
    return { allowed: false, reason: 'Kein Zugriff auf diesen Space' };
  }

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions.canDeleteSpace) {
    return { allowed: false, reason: 'Nur der Owner kann den Space löschen', role };
  }

  return { allowed: true, role };
}

/**
 * Check if a user can archive/unarchive a space
 */
export async function canArchiveSpace(
  spaceId: string,
  userId: string
): Promise<PermissionCheck> {
  // Same as canEditSpace - owners can archive
  return canEditSpace(spaceId, userId);
}

/**
 * Get all permissions for a user in a space
 */
export async function getUserPermissions(
  spaceId: string,
  userId: string
): Promise<{
  role: SpaceRole | null;
  permissions: typeof ROLE_PERMISSIONS[SpaceRole] | null;
}> {
  const space = await loadSpace(spaceId);

  if (!space) {
    return { role: null, permissions: null };
  }

  const role = getUserRole(space, userId);
  if (!role) {
    return { role: null, permissions: null };
  }

  return { role, permissions: ROLE_PERMISSIONS[role] };
}
