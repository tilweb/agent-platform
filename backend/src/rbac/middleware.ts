/**
 * RBAC Middleware for Hono
 *
 * Provides middleware functions for resource-based access control
 * that can be applied to routes.
 */

import type { Context, Next } from 'hono';
import { getCurrentUserId } from '../auth/middleware';
import { checkAccess, hasAnyAccess } from './accessControl';
import type { ResourceType, PermissionName } from './types';

/**
 * Options for resource access middleware
 */
interface ResourceAccessOptions {
  resourceType: ResourceType;
  permission: PermissionName;
  getResourceId: (c: Context) => string | undefined;
  /**
   * Optional: Custom error message
   */
  errorMessage?: string;
}

/**
 * Middleware factory for requiring resource access
 *
 * Usage:
 * ```typescript
 * app.get('/spaces/:id', requireResourceAccess({
 *   resourceType: 'space',
 *   permission: 'canView',
 *   getResourceId: (c) => c.req.param('id'),
 * }), async (c) => { ... });
 * ```
 */
export function requireResourceAccess(options: ResourceAccessOptions) {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const userId = getCurrentUserId(c);
    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const resourceId = options.getResourceId(c);
    if (!resourceId) {
      return c.json({ error: 'Resource ID required' }, 400);
    }

    const result = await checkAccess(userId, options.resourceType, resourceId, options.permission);

    if (!result.allowed) {
      return c.json(
        { error: options.errorMessage || result.reason || 'Zugriff verweigert' },
        403
      );
    }

    // Store effective role in context for use in handler
    c.set('effectiveRole', result.effectiveRole);
    c.set('accessSource', result.source);

    await next();
  };
}

/**
 * Middleware for requiring view access to a resource
 */
export function requireViewAccess(
  resourceType: ResourceType,
  getResourceId: (c: Context) => string | undefined
) {
  return requireResourceAccess({
    resourceType,
    permission: 'canView',
    getResourceId,
    errorMessage: 'Keine Leseberechtigung',
  });
}

/**
 * Middleware for requiring edit access to a resource
 */
export function requireEditAccess(
  resourceType: ResourceType,
  getResourceId: (c: Context) => string | undefined
) {
  return requireResourceAccess({
    resourceType,
    permission: 'canEdit',
    getResourceId,
    errorMessage: 'Keine Bearbeitungsberechtigung',
  });
}

/**
 * Middleware for requiring delete access to a resource
 */
export function requireDeleteAccess(
  resourceType: ResourceType,
  getResourceId: (c: Context) => string | undefined
) {
  return requireResourceAccess({
    resourceType,
    permission: 'canDelete',
    getResourceId,
    errorMessage: 'Keine Löschberechtigung',
  });
}

/**
 * Middleware for requiring access management permission
 */
export function requireManageAccess(
  resourceType: ResourceType,
  getResourceId: (c: Context) => string | undefined
) {
  return requireResourceAccess({
    resourceType,
    permission: 'canManageAccess',
    getResourceId,
    errorMessage: 'Keine Berechtigung zur Zugriffsverwaltung',
  });
}

/**
 * Middleware for requiring ownership (can transfer ownership)
 */
export function requireOwnership(
  resourceType: ResourceType,
  getResourceId: (c: Context) => string | undefined
) {
  return requireResourceAccess({
    resourceType,
    permission: 'canTransferOwnership',
    getResourceId,
    errorMessage: 'Nur der Eigentümer kann diese Aktion durchführen',
  });
}

/**
 * Middleware that checks access but doesn't block
 * Sets 'hasAccess' and 'effectiveRole' in context
 */
export function checkResourceAccess(options: Omit<ResourceAccessOptions, 'errorMessage'>) {
  return async (c: Context, next: Next): Promise<void> => {
    const userId = getCurrentUserId(c);
    const resourceId = options.getResourceId(c);

    if (userId && resourceId) {
      const result = await checkAccess(userId, options.resourceType, resourceId, options.permission);
      c.set('hasAccess', result.allowed);
      c.set('effectiveRole', result.effectiveRole);
      c.set('accessSource', result.source);
    } else {
      c.set('hasAccess', false);
      c.set('effectiveRole', undefined);
      c.set('accessSource', undefined);
    }

    await next();
  };
}

/**
 * Get the effective role from context (set by middleware)
 */
export function getEffectiveRoleFromContext(c: Context): string | undefined {
  return c.get('effectiveRole');
}

/**
 * Get access source from context (set by middleware)
 */
export function getAccessSourceFromContext(c: Context): 'direct' | 'group' | 'admin' | undefined {
  return c.get('accessSource');
}

/**
 * Check if context has access (set by checkResourceAccess middleware)
 */
export function hasAccessFromContext(c: Context): boolean {
  return c.get('hasAccess') === true;
}

// Extend Hono context types
declare module 'hono' {
  interface ContextVariableMap {
    effectiveRole?: string;
    accessSource?: 'direct' | 'group' | 'admin';
    hasAccess?: boolean;
  }
}
