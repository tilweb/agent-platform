/**
 * RBAC Module - Unified Role-Based Access Control
 *
 * Central exports for the RBAC system.
 */

// Types
export type {
  ResourceRole,
  ResourceType,
  PrincipalType,
  ResourceAccess,
  RolePermissions,
  PermissionName,
} from './types';

export {
  RESOURCE_PERMISSIONS,
  ROLE_HIERARCHY,
  RESOURCE_DATA_DIRS,
  getHigherRole,
  roleHasPermission,
  getAssignableRoles,
} from './types';

// Storage
export {
  loadResourceAccess,
  saveResourceAccess,
  getResourceAccessEntry,
  grantAccess,
  updateAccessRole,
  revokeAccess,
  getUsersWithAccess,
  getGroupsWithAccess,
  getResourceOwner,
  transferOwnership,
  initializeResourceAccess,
  deleteResourceAccess,
  hasAccessEntries,
} from './storage';

// Access Control
export type { AccessCheckResult } from './accessControl';

export {
  checkAccess,
  canView,
  canEdit,
  canDelete,
  canManageAccess,
  canTransferOwnership,
  getEffectiveRole,
  getUserResourcePermissions,
  hasAnyAccess,
  listAccessibleResources,
  getResourceAccessInfo,
} from './accessControl';

// Middleware
export {
  requireResourceAccess,
  requireViewAccess,
  requireEditAccess,
  requireDeleteAccess,
  requireManageAccess,
  requireOwnership,
  checkResourceAccess,
  getEffectiveRoleFromContext,
  getAccessSourceFromContext,
  hasAccessFromContext,
} from './middleware';

// Migration
export {
  migrateSpaceMembers,
  migrateSkills,
  migrateAgents,
  runAllMigrations,
} from './migration';
