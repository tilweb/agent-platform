/**
 * RBAC Types - Unified Role-Based Access Control
 *
 * Central type definitions for the resource-based RBAC system
 * used across all features (Spaces, Collections, Skills, Agents, etc.)
 */

// Unified Resource Role - same for all features
export type ResourceRole = 'owner' | 'admin' | 'editor' | 'viewer';

// Resource Types that support RBAC
export type ResourceType = 'space' | 'collection' | 'contract' | 'skill' | 'agent';

// Principal (who has the permission)
export type PrincipalType = 'user' | 'group';

/**
 * Resource Access Entry
 * Stored per resource in access.yaml
 */
export interface ResourceAccess {
  principalType: PrincipalType;
  principalId: string;        // userId or groupId
  role: ResourceRole;
  grantedAt: string;
  grantedBy: string;
}

/**
 * Permission definition for each role
 */
export interface RolePermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageAccess: boolean;
  canTransferOwnership: boolean;
}

/**
 * Unified Permission Matrix
 * Defines what each role can do
 */
export const RESOURCE_PERMISSIONS: Record<ResourceRole, RolePermissions> = {
  owner: {
    canView: true,
    canEdit: true,
    canDelete: true,
    canManageAccess: true,
    canTransferOwnership: true,
  },
  admin: {
    canView: true,
    canEdit: true,
    canDelete: false,
    canManageAccess: true,
    canTransferOwnership: false,
  },
  editor: {
    canView: true,
    canEdit: true,
    canDelete: false,
    canManageAccess: false,
    canTransferOwnership: false,
  },
  viewer: {
    canView: true,
    canEdit: false,
    canDelete: false,
    canManageAccess: false,
    canTransferOwnership: false,
  },
};

/**
 * Permission names as type for type-safe permission checks
 */
export type PermissionName = keyof RolePermissions;

/**
 * Role hierarchy for determining effective role
 * Higher index = higher privileges
 */
export const ROLE_HIERARCHY: ResourceRole[] = ['viewer', 'editor', 'admin', 'owner'];

/**
 * Get the higher of two roles
 */
export function getHigherRole(role1: ResourceRole | null, role2: ResourceRole | null): ResourceRole | null {
  if (!role1) return role2;
  if (!role2) return role1;

  const idx1 = ROLE_HIERARCHY.indexOf(role1);
  const idx2 = ROLE_HIERARCHY.indexOf(role2);

  return idx1 >= idx2 ? role1 : role2;
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: ResourceRole, permission: PermissionName): boolean {
  return RESOURCE_PERMISSIONS[role][permission];
}

/**
 * Get all roles that can be assigned by a given role
 * (owners can assign any role, admins can assign up to admin, etc.)
 */
export function getAssignableRoles(assignerRole: ResourceRole): ResourceRole[] {
  if (assignerRole === 'owner') {
    return ['admin', 'editor', 'viewer'];
  }
  if (assignerRole === 'admin') {
    return ['admin', 'editor', 'viewer'];
  }
  return [];
}

/**
 * Data directory paths per resource type
 */
export const RESOURCE_DATA_DIRS: Record<ResourceType, string> = {
  space: 'spaces',
  collection: 'knowledge-base/collections',
  contract: 'contracts',
  skill: 'skills/public',
  agent: 'agents',
};
