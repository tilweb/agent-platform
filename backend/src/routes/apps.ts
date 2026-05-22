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
  isAppEnvAllowed,
} from '../apps/registry';
import {
  getUserAppPermission,
  listAppPermissions,
  replaceAppPermissions,
} from '../apps/permissions';
import { getCurrentUserId } from '../auth/middleware';
import { authMiddleware } from '../auth/middleware';
import { listGroups } from '../auth/groups';
import { loadUser } from '../auth/storage';
import { contractRoutes } from '../apps/vertragsmanagement/routes';
import { projektmanagementRoutes } from '../apps/projektmanagement/routes';
import { lieferantenmanagementRoutes } from '../apps/lieferantenmanagement/routes';
import { vsmRoutes } from '../apps/vsm/routes';
import { wzbarMatcherRoutes } from '../apps/wzbar-matcher/routes';
import { vorgangsmappeRoutes } from '../apps/vorgangsmappe/routes';

const apps = new Hono();

// Alle /api/apps/*-Endpunkte erfordern eine eingeloggte Session.
// Per-App-Berechtigungen pruefen die requireAppAccess-Middleware in den
// jeweiligen Sub-Routern (siehe z.B. projektmanagement/routes.ts).
apps.use('*', authMiddleware);

// ============== App Registry Endpoints ==============

/**
 * GET /api/apps
 * List all apps (for admin) or enabled apps (for users)
 */
apps.get('/', async (c) => {
  try {
    // For now, return all apps - could filter by user role later
    const allApps = await getApps();
    // Augment with envBlocked flag so the admin UI can render the
    // "via ENV deaktiviert" hint and disable the toggle.
    const augmented = allApps.map(app => ({ ...app, envBlocked: !isAppEnvAllowed(app.id) }));
    return c.json({ apps: augmented });
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
    if (appId === 'enabled' || appId === 'vertragsmanagement' || appId === 'lieferantenmanagement' || appId === 'vsm' || appId === 'wzbar-matcher' || appId === 'vorgangsmappe') {
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

    if (app === 'env-blocked') {
      return c.json(
        { error: 'App ist via ENABLED_APPS ENV-Variable gesperrt und kann nicht aktiviert werden.', code: 'env_blocked' },
        403,
      );
    }
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

// ============== App-Permissions Endpunkte ==============

/**
 * GET /api/apps/:appId/permissions
 * Liste aller Gruppen-Permissions auf einer App. Admin-Endpunkt fuer Settings.
 */
apps.get('/:appId/permissions', async (c) => {
  try {
    const appId = c.req.param('appId');
    const app = await getApp(appId);
    if (!app) {
      return c.json({ error: 'App not found' }, 404);
    }
    const permissions = await listAppPermissions(appId);
    return c.json({ permissions });
  } catch (error) {
    console.error('Error listing app permissions:', error);
    return c.json({ error: 'Failed to list permissions' }, 500);
  }
});

/**
 * PUT /api/apps/:appId/permissions
 * Voller Overwrite — Body: { permissions: [{ groupId, role }] }. Admin-only.
 */
apps.put('/:appId/permissions', async (c) => {
  try {
    const appId = c.req.param('appId');
    const app = await getApp(appId);
    if (!app) {
      return c.json({ error: 'App not found' }, 404);
    }
    const body = await c.req.json();
    const incoming = Array.isArray(body?.permissions) ? body.permissions : [];
    const saved = await replaceAppPermissions(appId, incoming);
    return c.json({ permissions: saved });
  } catch (error) {
    console.error('Error updating app permissions:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update permissions' }, 500);
  }
});

/**
 * GET /api/apps/:appId/eligible-principals
 *
 * Listet User+Gruppen die ueberhaupt Zugriff auf die App haben — Schnittmenge
 * aus `apps.registry.permissions.groups` (App-Level-Berechtigungen aus Phase 1)
 * und Gruppen-Mitgliedschaft. Der Frontend-PermissionsModal (Auftrags-/Ideen-
 * Permissions Phase 2) filtert seinen User-Picker und Group-Picker auf diese
 * Liste, damit Auftrags-Member auch tatsaechlich auf die App kommen.
 *
 * Response: `{ groups: [{id, name}], users: [{id, username, displayName}] }`.
 */
apps.get('/:appId/eligible-principals', async (c) => {
  try {
    const appId = c.req.param('appId');
    const app = await getApp(appId);
    if (!app) {
      return c.json({ error: 'App not found' }, 404);
    }
    const groupPermissions = app.permissions?.groups ?? [];
    if (groupPermissions.length === 0) {
      return c.json({ groups: [], users: [] });
    }

    const eligibleGroupIds = new Set(groupPermissions.map((p) => p.groupId));
    const allGroups = await listGroups();
    const eligibleGroups = allGroups.filter((g) => eligibleGroupIds.has(g.id));

    const eligibleUserIds = new Set<string>();
    for (const g of eligibleGroups) {
      for (const userId of g.memberIds ?? []) {
        eligibleUserIds.add(userId);
      }
    }

    const users = await Promise.all(
      Array.from(eligibleUserIds).map(async (uid) => {
        const user = await loadUser(uid);
        if (!user) return null;
        return {
          id: user.id,
          username: user.username,
          displayName: user.displayName ?? user.username,
        };
      })
    );

    return c.json({
      groups: eligibleGroups.map((g) => ({ id: g.id, name: g.name })),
      users: users.filter((u): u is NonNullable<typeof u> => u !== null),
    });
  } catch (error) {
    console.error('Error listing eligible principals:', error);
    return c.json({ error: 'Failed to list eligible principals' }, 500);
  }
});

/**
 * GET /api/apps/:appId/my-permission
 * Liefert die effektive Rolle des eingeloggten Users auf einer App, oder null.
 * Frontend-RequireAppPermission ruft das beim Mount.
 */
apps.get('/:appId/my-permission', async (c) => {
  try {
    const appId = c.req.param('appId');
    const userId = getCurrentUserId(c);
    if (!userId) {
      return c.json({ role: null }, 401);
    }
    const app = await getApp(appId);
    if (!app) {
      return c.json({ error: 'App not found' }, 404);
    }
    const role = await getUserAppPermission(userId, appId);
    const groupPermissionsCount = (app.permissions?.groups ?? []).length;
    return c.json({
      role,
      // Damit das Frontend zwischen "konfiguriert aber kein Zugriff" und
      // "noch nicht konfiguriert" unterscheiden kann.
      configured: groupPermissionsCount > 0,
    });
  } catch (error) {
    console.error('Error getting my-permission:', error);
    return c.json({ error: 'Failed to get permission' }, 500);
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

// Mount Vorgangsmappe routes
apps.route('/vorgangsmappe', vorgangsmappeRoutes);

export { apps as appsRoutes };
