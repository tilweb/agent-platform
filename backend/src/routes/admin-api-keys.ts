/**
 * Admin API-Keys routes — management UI backend.
 *
 * Mounted at /api/admin/api-keys. All routes require session-auth + admin role
 * (enforced by parent adminRoutes middleware).
 */

import { Hono } from 'hono';
import { getCurrentUser } from '../auth/middleware';
import { createKey, listKeys, revokeKey } from '../public-api/keys/service';
import { loadKeyById } from '../public-api/keys/storage';
import { getApps } from '../apps/registry';
import type { ApiKey, ApiKeyScope } from '../public-api/types';

const router = new Hono();

function publicView(key: ApiKey): Omit<ApiKey, 'hashedKey'> {
  const { hashedKey, ...rest } = key;
  return rest;
}

/**
 * GET /api/admin/api-keys — list all keys (admin view, hashes redacted)
 */
router.get('/', async (c) => {
  try {
    const keys = await listKeys();
    return c.json({ keys: keys.map(publicView) });
  } catch (error) {
    console.error('[admin/api-keys] list failed:', error);
    return c.json({ error: 'Failed to list API keys' }, 500);
  }
});

/**
 * GET /api/admin/api-keys/permissions
 * Discovery helper: returns all permission strings available across enabled apps.
 * Used by the UI to populate the permissions multi-select when creating a key.
 */
router.get('/permissions', async (c) => {
  try {
    const apps = await getApps();
    const permissions: Array<{
      id: string;
      appId: string;
      appName: string;
      functionId: string;
      description: string;
    }> = [];
    for (const app of apps) {
      if (!app.enabled || !Array.isArray(app.publicFunctions)) continue;
      for (const fn of app.publicFunctions) {
        permissions.push({
          id: `app:${app.id}:${fn.id}`,
          appId: app.id,
          appName: app.name,
          functionId: fn.id,
          description: fn.description,
        });
      }
    }
    return c.json({ permissions });
  } catch (error) {
    console.error('[admin/api-keys] permissions failed:', error);
    return c.json({ error: 'Failed to list available permissions' }, 500);
  }
});

/**
 * POST /api/admin/api-keys
 * body: {
 *   label, scope: {type, serviceName?|orgId?|userId?},
 *   permissions: string[], rateLimit?: {requests, windowSec}, expiresAt?: string|null
 * }
 *
 * Response: { key: <publicView>, rawKey: <shown only once> }
 */
router.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      label?: string;
      scope?: ApiKeyScope;
      permissions?: string[];
      rateLimit?: { requests?: number; windowSec?: number };
      expiresAt?: string | null;
    }>();

    const label = (body.label ?? '').trim();
    if (!label) return c.json({ error: 'label is required' }, 400);
    if (label.length > 100) return c.json({ error: 'label too long (max 100)' }, 400);

    const scope = body.scope;
    if (!scope || !['service', 'org', 'user'].includes(scope.type)) {
      return c.json({ error: 'scope.type must be service|org|user' }, 400);
    }
    if (scope.type === 'service' && !scope.serviceName) return c.json({ error: 'scope.serviceName required for service scope' }, 400);
    if (scope.type === 'org' && !scope.orgId) return c.json({ error: 'scope.orgId required for org scope' }, 400);
    if (scope.type === 'user' && !scope.userId) return c.json({ error: 'scope.userId required for user scope' }, 400);

    const permissions = Array.isArray(body.permissions) ? body.permissions.filter(p => typeof p === 'string' && p.length > 0) : [];
    if (permissions.length === 0) return c.json({ error: 'permissions must contain at least one entry' }, 400);

    const rateLimit = body.rateLimit && body.rateLimit.requests && body.rateLimit.windowSec
      ? { requests: Number(body.rateLimit.requests), windowSec: Number(body.rateLimit.windowSec) }
      : undefined;
    if (rateLimit && (!Number.isFinite(rateLimit.requests) || rateLimit.requests <= 0 || !Number.isFinite(rateLimit.windowSec) || rateLimit.windowSec <= 0)) {
      return c.json({ error: 'rateLimit values must be positive numbers' }, 400);
    }

    const expiresAt = body.expiresAt && typeof body.expiresAt === 'string' ? body.expiresAt : null;
    if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
      return c.json({ error: 'expiresAt must be a valid ISO date' }, 400);
    }

    const admin = getCurrentUser(c);
    const createdBy = admin?.id ?? 'system';

    const { key, rawKey } = await createKey({ label, scope, permissions, rateLimit, createdBy, expiresAt });

    return c.json({ key: publicView(key), rawKey }, 201);
  } catch (error) {
    console.error('[admin/api-keys] create failed:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create API key' }, 500);
  }
});

/**
 * GET /api/admin/api-keys/:id — details for one key (hash redacted)
 */
router.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const key = await loadKeyById(id);
    if (!key) return c.json({ error: 'API key not found' }, 404);
    return c.json({ key: publicView(key) });
  } catch (error) {
    console.error('[admin/api-keys] show failed:', error);
    return c.json({ error: 'Failed to load API key' }, 500);
  }
});

/**
 * DELETE /api/admin/api-keys/:id — revoke (deactivate)
 */
router.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const key = await revokeKey(id);
    if (!key) return c.json({ error: 'API key not found' }, 404);
    return c.json({ key: publicView(key) });
  } catch (error) {
    console.error('[admin/api-keys] revoke failed:', error);
    return c.json({ error: 'Failed to revoke API key' }, 500);
  }
});

export { router as adminApiKeysRoutes };
