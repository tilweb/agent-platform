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
} from '../apps/registry';
import { contractRoutes } from '../apps/vertragsmanagement/routes';
import { projektmanagementRoutes } from '../apps/projektmanagement/routes';
import { lieferantenmanagementRoutes } from '../apps/lieferantenmanagement/routes';
import { vsmRoutes } from '../apps/vsm/routes';
import { wzbarMatcherRoutes } from '../apps/wzbar-matcher/routes';

const apps = new Hono();

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
    return c.json({ error: 'Failed to list apps' }, 500);
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
    return c.json({ error: 'Failed to list enabled apps' }, 500);
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
    if (appId === 'enabled' || appId === 'vertragsmanagement' || appId === 'lieferantenmanagement' || appId === 'vsm' || appId === 'wzbar-matcher') {
      return c.notFound();
    }

    const app = await getApp(appId);

    if (!app) {
      return c.json({ error: 'App not found' }, 404);
    }

    return c.json({ app });
  } catch (error) {
    console.error('Error getting app:', error);
    return c.json({ error: 'Failed to get app' }, 500);
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
      return c.json({ error: 'App not found' }, 404);
    }

    return c.json({ app });
  } catch (error) {
    console.error('Error enabling app:', error);
    return c.json({ error: 'Failed to enable app' }, 500);
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
      return c.json({ error: 'App not found' }, 404);
    }

    return c.json({ app });
  } catch (error) {
    console.error('Error disabling app:', error);
    return c.json({ error: 'Failed to disable app' }, 500);
  }
});

// ============== App-specific Routes ==============

// Mount Vertragsmanagement routes
apps.route('/vertragsmanagement', contractRoutes);

// Mount Projektmanagement routes
apps.route('/projektmanagement', projektmanagementRoutes);

// Mount Lieferantenmanagement routes
apps.route('/lieferantenmanagement', lieferantenmanagementRoutes);

// Mount VSM routes
apps.route('/vsm', vsmRoutes);

// Mount WZ-Branchen-Matcher routes
apps.route('/wzbar-matcher', wzbarMatcherRoutes);

export { apps as appsRoutes };
