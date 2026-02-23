/**
 * Apps Routes
 * REST API endpoints for the apps framework
 */

import { Hono } from 'hono';
import {
  getApps,
  getEnabledApps,
  getApp,
  enableApp,
  disableApp,
  reorderApps,
} from '../apps/registry';
import { contractRoutes } from '../apps/vertragsmanagement/routes';
import { projektmanagementRoutes } from '../apps/projektmanagement/routes';
import { authMiddleware, getCurrentUser } from '../auth';
import { internalError, forbiddenError, validationError, notFoundError } from '../utils/errorHandler';

const apps = new Hono();

// Require authentication for all app operations
apps.use('/*', authMiddleware);

// ============== App Registry Endpoints ==============

/**
 * GET /api/apps
 * List all apps (for admin) or enabled apps (for users)
 */
apps.get('/', async (c) => {
  try {
    // For now, return all apps - could filter by user role later
    const allApps = await getApps();
    return c.json({ apps: allApps });
  } catch (error) {
    console.error('Error listing apps:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/apps/enabled
 * List only enabled apps (for sidebar)
 */
apps.get('/enabled', async (c) => {
  try {
    const enabledApps = await getEnabledApps();
    return c.json({ apps: enabledApps });
  } catch (error) {
    console.error('Error listing enabled apps:', error);
    return internalError(c, error);
  }
});

/**
 * PUT /api/apps/order
 * Reorder apps (admin only)
 */
apps.put('/order', async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user || user.role !== 'admin') {
      return forbiddenError(c, 'Admin-Rechte erforderlich');
    }

    const { appIds } = await c.req.json<{ appIds: string[] }>();

    if (!Array.isArray(appIds)) {
      return validationError(c, 'appIds must be an array');
    }

    const sortedApps = await reorderApps(appIds);
    return c.json({ apps: sortedApps });
  } catch (error) {
    console.error('Error reordering apps:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/apps/:appId
 * Get details for a specific app
 */
apps.get('/:appId', async (c) => {
  try {
    const appId = c.req.param('appId');

    // Skip if it's a sub-route
    if (appId === 'enabled' || appId === 'vertragsmanagement') {
      return c.notFound();
    }

    const app = await getApp(appId);

    if (!app) {
      return notFoundError(c, 'App');
    }

    return c.json({ app });
  } catch (error) {
    console.error('Error getting app:', error);
    return internalError(c, error);
  }
});

/**
 * PUT /api/apps/:appId/enable
 * Enable an app (admin only)
 */
apps.put('/:appId/enable', async (c) => {
  try {
    const appId = c.req.param('appId');
    const app = await enableApp(appId);

    if (!app) {
      return notFoundError(c, 'App');
    }

    return c.json({ app });
  } catch (error) {
    console.error('Error enabling app:', error);
    return internalError(c, error);
  }
});

/**
 * PUT /api/apps/:appId/disable
 * Disable an app (admin only)
 */
apps.put('/:appId/disable', async (c) => {
  try {
    const appId = c.req.param('appId');
    const app = await disableApp(appId);

    if (!app) {
      return notFoundError(c, 'App');
    }

    return c.json({ app });
  } catch (error) {
    console.error('Error disabling app:', error);
    return internalError(c, error);
  }
});

// ============== App-specific Routes ==============

// Mount Vertragsmanagement routes
apps.route('/vertragsmanagement', contractRoutes);

// Mount Projektmanagement routes
apps.route('/projektmanagement', projektmanagementRoutes);

export { apps as appsRoutes };
