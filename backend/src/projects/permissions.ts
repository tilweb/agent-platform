/**
 * Project Permissions Service
 *
 * Role-based access control for project operations.
 */

import type { Project, ProjectMember, ProjectRole } from './types';
import { ROLE_PERMISSIONS } from './types';
import { loadProject } from './storage';
import { canView } from '../rbac/accessControl';

export interface PermissionCheck {
  allowed: boolean;
  reason?: string;
  role?: ProjectRole;
}

/**
 * Get a user's role in a project (direct membership only)
 */
export function getUserRole(project: Project, userId: string): ProjectRole | null {
  const member = project.members.find((m) => m.userId === userId);
  return member?.role || null;
}

/**
 * Get a user's effective role including RBAC group access
 * Falls back to RBAC if user is not a direct member
 */
async function getEffectiveRole(project: Project, projectId: string, userId: string): Promise<ProjectRole | null> {
  // Direct membership first
  const directRole = getUserRole(project, userId);
  if (directRole) return directRole;

  // Fallback: RBAC (group access, admin)
  const rbacResult = await canView(userId, 'project', projectId);
  if (rbacResult.allowed) {
    // Map RBAC role to project role (viewer as safe default for group access)
    const roleMap: Record<string, ProjectRole> = {
      owner: 'owner',
      admin: 'admin',
      editor: 'editor',
      viewer: 'viewer',
    };
    return roleMap[rbacResult.role || 'viewer'] || 'viewer';
  }

  return null;
}

/**
 * Check if a user is a member of a project
 */
export function isMember(project: Project, userId: string): boolean {
  return project.members.some((m) => m.userId === userId);
}

/**
 * Check if a user can view a project
 */
export async function canViewProject(
  projectId: string,
  userId: string
): Promise<PermissionCheck> {
  const project = await loadProject(projectId);

  if (!project) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = await getEffectiveRole(project, projectId, userId);
  if (!role) {
    return { allowed: false, reason: 'Kein Zugriff auf diesen Space' };
  }

  return { allowed: true, role };
}

/**
 * Check if a user can edit project metadata (name, description, icon, color)
 */
export async function canEditProject(
  projectId: string,
  userId: string
): Promise<PermissionCheck> {
  const project = await loadProject(projectId);

  if (!project) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = await getEffectiveRole(project, projectId, userId);
  if (!role) {
    return { allowed: false, reason: 'Kein Zugriff auf diesen Space' };
  }

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions.canEditProject) {
    return { allowed: false, reason: 'Keine Berechtigung zum Bearbeiten', role };
  }

  return { allowed: true, role };
}

/**
 * Check if a user can edit project settings
 */
export async function canEditSettings(
  projectId: string,
  userId: string
): Promise<PermissionCheck> {
  const project = await loadProject(projectId);

  if (!project) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = await getEffectiveRole(project, projectId, userId);
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
 * Check if a user can write to project memory
 */
export async function canWriteMemory(
  projectId: string,
  userId: string
): Promise<PermissionCheck> {
  const project = await loadProject(projectId);

  if (!project) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = await getEffectiveRole(project, projectId, userId);
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
 * Check if a user can view project chats
 */
export async function canViewChats(
  projectId: string,
  userId: string
): Promise<PermissionCheck> {
  const project = await loadProject(projectId);

  if (!project) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = await getEffectiveRole(project, projectId, userId);
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
 * Check if a user can manage project members
 */
export async function canManageMembers(
  projectId: string,
  userId: string
): Promise<PermissionCheck> {
  const project = await loadProject(projectId);

  if (!project) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = await getEffectiveRole(project, projectId, userId);
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
  projectId: string,
  userId: string,
  targetUserId: string
): Promise<PermissionCheck> {
  const project = await loadProject(projectId);

  if (!project) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const userRole = await getEffectiveRole(project, projectId, userId);
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
  const targetRole = getUserRole(project, targetUserId);
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
 * Check if a user can delete a project
 */
export async function canDeleteProject(
  projectId: string,
  userId: string
): Promise<PermissionCheck> {
  const project = await loadProject(projectId);

  if (!project) {
    return { allowed: false, reason: 'Space nicht gefunden' };
  }

  const role = await getEffectiveRole(project, projectId, userId);
  if (!role) {
    return { allowed: false, reason: 'Kein Zugriff auf diesen Space' };
  }

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions.canDeleteProject) {
    return { allowed: false, reason: 'Nur der Owner kann das Projekt löschen', role };
  }

  return { allowed: true, role };
}

/**
 * Check if a user can archive/unarchive a project
 */
export async function canArchiveProject(
  projectId: string,
  userId: string
): Promise<PermissionCheck> {
  // Same as canEditProject - owners can archive
  return canEditProject(projectId, userId);
}

/**
 * Get all permissions for a user in a project
 */
export async function getUserPermissions(
  projectId: string,
  userId: string
): Promise<{
  role: ProjectRole | null;
  permissions: typeof ROLE_PERMISSIONS[ProjectRole] | null;
}> {
  const project = await loadProject(projectId);

  if (!project) {
    return { role: null, permissions: null };
  }

  const role = await getEffectiveRole(project, projectId, userId);
  if (!role) {
    return { role: null, permissions: null };
  }

  return { role, permissions: ROLE_PERMISSIONS[role] };
}
