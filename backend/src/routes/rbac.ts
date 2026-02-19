/**
 * RBAC API Routes
 *
 * REST API for managing resource access:
 * GET    /api/resources/:type/:id/access     - List all permissions
 * POST   /api/resources/:type/:id/access     - Add permission
 * PUT    /api/resources/:type/:id/access/:principalType/:principalId - Update role
 * DELETE /api/resources/:type/:id/access/:principalType/:principalId - Remove permission
 */

import { Hono } from 'hono';
import { internalError } from '../utils/errorHandler';
import { authMiddleware, getCurrentUserId } from '../auth/middleware';
import { loadUser } from '../auth/storage';
import { loadGroup, listGroups } from '../auth/groups';
import {
  loadResourceAccess,
  grantAccess,
  updateAccessRole,
  revokeAccess,
  getResourceOwner,
  transferOwnership,
} from '../rbac/storage';
import { checkAccess, getResourceAccessInfo, getUserResourcePermissions } from '../rbac/accessControl';
import type { ResourceType, ResourceRole, PrincipalType } from '../rbac/types';
import { RESOURCE_PERMISSIONS, getAssignableRoles } from '../rbac/types';

export const rbacRoutes = new Hono();

// Apply auth middleware to all routes
rbacRoutes.use('*', authMiddleware);

// Valid resource types
const VALID_RESOURCE_TYPES: ResourceType[] = ['space', 'collection', 'contract', 'skill', 'agent'];

// Valid roles
const VALID_ROLES: ResourceRole[] = ['owner', 'admin', 'editor', 'viewer'];

// Valid principal types
const VALID_PRINCIPAL_TYPES: PrincipalType[] = ['user', 'group'];

/**
 * Validate resource type
 */
function isValidResourceType(type: string): type is ResourceType {
  return VALID_RESOURCE_TYPES.includes(type as ResourceType);
}

/**
 * Validate role
 */
function isValidRole(role: string): role is ResourceRole {
  return VALID_ROLES.includes(role as ResourceRole);
}

/**
 * Validate principal type
 */
function isValidPrincipalType(type: string): type is PrincipalType {
  return VALID_PRINCIPAL_TYPES.includes(type as PrincipalType);
}

/**
 * GET /api/resources/:type/:id/access - List all permissions for a resource
 */
rbacRoutes.get('/:type/:id/access', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const resourceType = c.req.param('type');
  const resourceId = c.req.param('id');

  if (!isValidResourceType(resourceType)) {
    return c.json({ error: 'Ungültiger Ressourcentyp' }, 400);
  }

  // Check if user can view access (needs canManageAccess or at least canView)
  const viewCheck = await checkAccess(userId, resourceType, resourceId, 'canView');
  if (!viewCheck.allowed) {
    return c.json({ error: 'Kein Zugriff auf diese Ressource' }, 403);
  }

  // Get access info
  const accessInfo = await getResourceAccessInfo(resourceType, resourceId);

  // Get user permissions for UI state
  const userPermissions = await getUserResourcePermissions(userId, resourceType, resourceId);

  // Enrich with user/group details
  const enrichedUsers = await Promise.all(
    accessInfo.users.map(async (access) => {
      const user = await loadUser(access.principalId);
      return {
        ...access,
        displayName: user?.displayName || user?.username || 'Unbekannter Benutzer',
        username: user?.username,
      };
    })
  );

  const enrichedGroups = await Promise.all(
    accessInfo.groups.map(async (access) => {
      const group = await loadGroup(access.principalId);
      return {
        ...access,
        name: group?.name || 'Unbekannte Gruppe',
        memberCount: group?.memberIds?.length || 0,
      };
    })
  );

  return c.json({
    users: enrichedUsers,
    groups: enrichedGroups,
    currentUser: {
      role: userPermissions.role,
      permissions: userPermissions.permissions,
      isGlobalAdmin: userPermissions.isGlobalAdmin,
      canManageAccess: userPermissions.permissions?.canManageAccess || userPermissions.isGlobalAdmin,
    },
  });
});

/**
 * GET /api/resources/:type/:id/access/permissions - Get current user's permissions
 */
rbacRoutes.get('/:type/:id/access/permissions', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const resourceType = c.req.param('type');
  const resourceId = c.req.param('id');

  if (!isValidResourceType(resourceType)) {
    return c.json({ error: 'Ungültiger Ressourcentyp' }, 400);
  }

  const userPermissions = await getUserResourcePermissions(userId, resourceType, resourceId);

  return c.json({
    role: userPermissions.role,
    permissions: userPermissions.permissions,
    isGlobalAdmin: userPermissions.isGlobalAdmin,
  });
});

/**
 * POST /api/resources/:type/:id/access - Add permission
 */
rbacRoutes.post('/:type/:id/access', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const resourceType = c.req.param('type');
  const resourceId = c.req.param('id');

  if (!isValidResourceType(resourceType)) {
    return c.json({ error: 'Ungültiger Ressourcentyp' }, 400);
  }

  // Check if user can manage access
  const accessCheck = await checkAccess(userId, resourceType, resourceId, 'canManageAccess');
  if (!accessCheck.allowed) {
    return c.json({ error: 'Keine Berechtigung zur Zugriffsverwaltung' }, 403);
  }

  try {
    const body = await c.req.json();
    const { principalType, principalId, role } = body;

    if (!principalType || !principalId || !role) {
      return c.json({ error: 'principalType, principalId und role sind erforderlich' }, 400);
    }

    if (!isValidPrincipalType(principalType)) {
      return c.json({ error: 'Ungültiger Principal-Typ. Erlaubt: user, group' }, 400);
    }

    if (!isValidRole(role)) {
      return c.json({ error: 'Ungültige Rolle. Erlaubt: admin, editor, viewer' }, 400);
    }

    // Cannot assign owner role through this endpoint
    if (role === 'owner') {
      return c.json({ error: 'Owner-Rolle kann nur durch Eigentümerübertragung vergeben werden' }, 400);
    }

    // Check if principal exists
    if (principalType === 'user') {
      const targetUser = await loadUser(principalId);
      if (!targetUser) {
        return c.json({ error: 'Benutzer nicht gefunden' }, 404);
      }
    } else if (principalType === 'group') {
      const targetGroup = await loadGroup(principalId);
      if (!targetGroup) {
        return c.json({ error: 'Gruppe nicht gefunden' }, 404);
      }
    }

    // Check assignable roles based on current user's role
    const assignableRoles = getAssignableRoles(accessCheck.effectiveRole!);
    if (!assignableRoles.includes(role)) {
      return c.json({ error: `Sie können die Rolle "${role}" nicht vergeben` }, 403);
    }

    const access = await grantAccess(resourceType, resourceId, principalType, principalId, role, userId);

    return c.json(access, 201);
  } catch (error: any) {
    console.error('Error granting access:', error);
    return internalError(c, error);
  }
});

/**
 * PUT /api/resources/:type/:id/access/:principalType/:principalId - Update role
 */
rbacRoutes.put('/:type/:id/access/:principalType/:principalId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const resourceType = c.req.param('type');
  const resourceId = c.req.param('id');
  const principalType = c.req.param('principalType');
  const principalId = c.req.param('principalId');

  if (!isValidResourceType(resourceType)) {
    return c.json({ error: 'Ungültiger Ressourcentyp' }, 400);
  }

  if (!isValidPrincipalType(principalType)) {
    return c.json({ error: 'Ungültiger Principal-Typ' }, 400);
  }

  // Check if user can manage access
  const accessCheck = await checkAccess(userId, resourceType, resourceId, 'canManageAccess');
  if (!accessCheck.allowed) {
    return c.json({ error: 'Keine Berechtigung zur Zugriffsverwaltung' }, 403);
  }

  try {
    const body = await c.req.json();
    const { role } = body;

    if (!role) {
      return c.json({ error: 'role ist erforderlich' }, 400);
    }

    if (!isValidRole(role)) {
      return c.json({ error: 'Ungültige Rolle. Erlaubt: admin, editor, viewer' }, 400);
    }

    // Cannot change to/from owner role through this endpoint
    if (role === 'owner') {
      return c.json({ error: 'Owner-Rolle kann nur durch Eigentümerübertragung vergeben werden' }, 400);
    }

    // Check if trying to modify owner
    const owner = await getResourceOwner(resourceType, resourceId);
    if (owner && owner.principalType === principalType && owner.principalId === principalId) {
      return c.json({ error: 'Die Rolle des Eigentümers kann nicht geändert werden' }, 400);
    }

    // Cannot modify own role
    if (principalType === 'user' && principalId === userId) {
      return c.json({ error: 'Eigene Rolle kann nicht geändert werden' }, 400);
    }

    const updated = await updateAccessRole(resourceType, resourceId, principalType, principalId, role, userId);

    if (!updated) {
      return c.json({ error: 'Berechtigung nicht gefunden' }, 404);
    }

    return c.json(updated);
  } catch (error: any) {
    console.error('Error updating access:', error);
    return internalError(c, error);
  }
});

/**
 * DELETE /api/resources/:type/:id/access/:principalType/:principalId - Remove permission
 */
rbacRoutes.delete('/:type/:id/access/:principalType/:principalId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const resourceType = c.req.param('type');
  const resourceId = c.req.param('id');
  const principalType = c.req.param('principalType');
  const principalId = c.req.param('principalId');

  if (!isValidResourceType(resourceType)) {
    return c.json({ error: 'Ungültiger Ressourcentyp' }, 400);
  }

  if (!isValidPrincipalType(principalType)) {
    return c.json({ error: 'Ungültiger Principal-Typ' }, 400);
  }

  // Check if user can manage access
  const accessCheck = await checkAccess(userId, resourceType, resourceId, 'canManageAccess');
  if (!accessCheck.allowed) {
    return c.json({ error: 'Keine Berechtigung zur Zugriffsverwaltung' }, 403);
  }

  // Cannot remove owner
  const owner = await getResourceOwner(resourceType, resourceId);
  if (owner && owner.principalType === principalType && owner.principalId === principalId) {
    return c.json({ error: 'Der Eigentümer kann nicht entfernt werden' }, 400);
  }

  // Cannot remove self
  if (principalType === 'user' && principalId === userId) {
    return c.json({ error: 'Eigene Berechtigung kann nicht entfernt werden' }, 400);
  }

  const removed = await revokeAccess(resourceType, resourceId, principalType, principalId);

  if (!removed) {
    return c.json({ error: 'Berechtigung nicht gefunden' }, 404);
  }

  return c.json({ success: true });
});

/**
 * POST /api/resources/:type/:id/access/transfer - Transfer ownership
 */
rbacRoutes.post('/:type/:id/access/transfer', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const resourceType = c.req.param('type');
  const resourceId = c.req.param('id');

  if (!isValidResourceType(resourceType)) {
    return c.json({ error: 'Ungültiger Ressourcentyp' }, 400);
  }

  // Check if user can transfer ownership (only owner can)
  const accessCheck = await checkAccess(userId, resourceType, resourceId, 'canTransferOwnership');
  if (!accessCheck.allowed) {
    return c.json({ error: 'Nur der Eigentümer kann das Eigentum übertragen' }, 403);
  }

  try {
    const body = await c.req.json();
    const { newOwnerId } = body;

    if (!newOwnerId) {
      return c.json({ error: 'newOwnerId ist erforderlich' }, 400);
    }

    // Check if new owner exists
    const newOwner = await loadUser(newOwnerId);
    if (!newOwner) {
      return c.json({ error: 'Neuer Eigentümer nicht gefunden' }, 404);
    }

    // Cannot transfer to self
    if (newOwnerId === userId) {
      return c.json({ error: 'Sie sind bereits der Eigentümer' }, 400);
    }

    const transferred = await transferOwnership(resourceType, resourceId, newOwnerId, userId);

    if (!transferred) {
      return c.json({ error: 'Eigentümerübertragung fehlgeschlagen' }, 500);
    }

    return c.json({ success: true, newOwnerId });
  } catch (error: any) {
    console.error('Error transferring ownership:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/resources/:type/:id/access/available-users - Get users that can be added
 */
rbacRoutes.get('/:type/:id/access/available-users', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const resourceType = c.req.param('type');
  const resourceId = c.req.param('id');

  if (!isValidResourceType(resourceType)) {
    return c.json({ error: 'Ungültiger Ressourcentyp' }, 400);
  }

  // Check if user can manage access
  const accessCheck = await checkAccess(userId, resourceType, resourceId, 'canManageAccess');
  if (!accessCheck.allowed) {
    return c.json({ error: 'Keine Berechtigung zur Zugriffsverwaltung' }, 403);
  }

  // Get current access entries
  const currentAccess = await loadResourceAccess(resourceType, resourceId);
  const currentUserIds = currentAccess
    .filter((a) => a.principalType === 'user')
    .map((a) => a.principalId);

  // Get all users
  const { listUsers } = await import('../auth/storage');
  const allUsers = await listUsers();

  // Filter out users that already have access
  const availableUsers = allUsers
    .filter((u) => !currentUserIds.includes(u.id))
    .map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
    }));

  return c.json({ users: availableUsers });
});

/**
 * GET /api/resources/:type/:id/access/available-groups - Get groups that can be added
 */
rbacRoutes.get('/:type/:id/access/available-groups', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const resourceType = c.req.param('type');
  const resourceId = c.req.param('id');

  if (!isValidResourceType(resourceType)) {
    return c.json({ error: 'Ungültiger Ressourcentyp' }, 400);
  }

  // Check if user can manage access
  const accessCheck = await checkAccess(userId, resourceType, resourceId, 'canManageAccess');
  if (!accessCheck.allowed) {
    return c.json({ error: 'Keine Berechtigung zur Zugriffsverwaltung' }, 403);
  }

  // Get current access entries
  const currentAccess = await loadResourceAccess(resourceType, resourceId);
  const currentGroupIds = currentAccess
    .filter((a) => a.principalType === 'group')
    .map((a) => a.principalId);

  // Get all groups
  const allGroups = await listGroups();

  // Filter out groups that already have access
  const availableGroups = allGroups
    .filter((g) => !currentGroupIds.includes(g.id))
    .map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberCount: g.memberIds?.length || 0,
    }));

  return c.json({ groups: availableGroups });
});
