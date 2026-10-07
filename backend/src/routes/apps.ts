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
  listAppPermissions,
  replaceAppPermissions,
  resolveAppAccess,
} from '../apps/permissions';
import type { AppConfig, AppRole } from '../apps/types';
import { getCurrentUserId, getCurrentUser } from '../auth/middleware';
import { authMiddleware, adminMiddleware } from '../auth/middleware';
import { audit, AuditCategory, AuditAction } from '../services/auditLog';
import type { Context } from 'hono';
import { listGroups } from '../auth/groups';
import { loadUser } from '../auth/storage';
import { contractRoutes } from '../apps/vertragsmanagement/routes';
import { projektmanagementRoutes } from '../apps/projektmanagement/routes';
import { lieferantenmanagementRoutes } from '../apps/lieferantenmanagement/routes';
import { vsmRoutes } from '../apps/vsm/routes';
import { wzbarMatcherRoutes } from '../apps/wzbar-matcher/routes';
import { vorgangsmappeRoutes } from '../apps/vorgangsmappe/routes';
import { podcastRepurposingRoutes } from '../apps/podcast-repurposing/routes';
import { echoloopRoutes } from '../apps/echoloop/routes';
import { wohngeldRoutes } from '../apps/antragspruefung/wohngeld/routes';
import { grundsicherungRoutes } from '../apps/antragspruefung/grundsicherung/routes';

const apps = new Hono();

// Alle /api/apps/*-Endpunkte erfordern eine eingeloggte Session.
// Per-App-Berechtigungen pruefen die requireAppAccess-Middleware in den
// jeweiligen Sub-Routern (siehe z.B. projektmanagement/routes.ts).
apps.use('*', authMiddleware);

/** Client-IP aus den üblichen Proxy-Headern (erste IP aus x-forwarded-for). */
function clientIp(c: Context): string | undefined {
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return c.req.header('x-real-ip') || undefined;
}

function isAdmin(c: Context): boolean {
  return getCurrentUser(c)?.role === 'admin';
}

/**
 * Sicht eines Nicht-Admins auf eine App: Stammdaten + eigene Rolle, ohne
 * Gruppen-Berechtigungen und Public-Function-Schemata.
 */
function toUserView(app: AppConfig, myRole: AppRole) {
  const { id, name, description, icon, version, enabled, routes } = app;
  return { id, name, description, icon, version, enabled, routes, myRole };
}

/**
 * Apps, die der eingeloggte Nicht-Admin tatsaechlich nutzen darf
 * (freigeschaltet + Rolle) — Grundlage fuer Navigation und Launcher.
 */
async function appsForUser(c: Context): Promise<ReturnType<typeof toUserView>[]> {
  const userId = getCurrentUserId(c);
  if (!userId) return [];
  const result: ReturnType<typeof toUserView>[] = [];
  for (const app of await getEnabledApps()) {
    const access = await resolveAppAccess(userId, app.id);
    if (access.allowed) result.push(toUserView(app, access.role));
  }
  return result;
}

/**
 * Protokolliert eine Admin-Änderung an der App-Verwaltung (Enable/Disable/
 * Permissions) im zentralen Audit-Log. Fehler schlucken — Audit darf die
 * eigentliche Aktion nie brechen.
 */
async function auditAppAdmin(
  c: Context,
  action: AuditAction,
  appId: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    const user = getCurrentUser(c);
    await audit(AuditCategory.ADMIN_ACTION, action, {
      userId: user?.id,
      username: user?.username,
      ipAddress: clientIp(c),
      resourceType: 'app',
      resourceId: appId,
      details,
    });
  } catch (err) {
    console.error('[apps] audit failed:', err);
  }
}

// ============== App Registry Endpoints ==============

/**
 * GET /api/apps
 * Admins: alle Apps inkl. Berechtigungen und envBlocked-Hinweis (Verwaltung).
 * Alle anderen: nur Apps, die sie nutzen duerfen — ohne Berechtigungs-Details.
 */
apps.get('/', async (c) => {
  try {
    if (!isAdmin(c)) {
      return c.json({ apps: await appsForUser(c) });
    }
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
 * Freigeschaltete Apps — fuer Nicht-Admins nur die mit eigener Rolle.
 */
apps.get('/enabled', async (c) => {
  try {
    if (!isAdmin(c)) {
      return c.json({ apps: await appsForUser(c) });
    }
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
    if (appId === 'enabled' || appId === 'vertragsmanagement' || appId === 'lieferantenmanagement' || appId === 'vsm' || appId === 'wzbar-matcher' || appId === 'vorgangsmappe' || appId === 'podcast-repurposing') {
      return c.notFound();
    }

    const app = await getApp(appId);

    if (!app) {
      return c.json({ error: 'App not found' }, 404);
    }

    if (!isAdmin(c)) {
      const userId = getCurrentUserId(c);
      const access = userId ? await resolveAppAccess(userId, appId) : null;
      if (!access?.allowed) return c.json({ error: 'App not found' }, 404);
      return c.json({ app: toUserView(app, access.role) });
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
apps.put('/:appId/enable', adminMiddleware, async (c) => {
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

    await auditAppAdmin(c, AuditAction.SETTINGS_CHANGED, appId, { operation: 'enable' });
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
apps.put('/:appId/disable', adminMiddleware, async (c) => {
  try {
    const appId = c.req.param('appId');
    const app = await disableApp(appId);

    if (!app) {
      return c.json({ error: 'App not found' }, 404);
    }

    await auditAppAdmin(c, AuditAction.SETTINGS_CHANGED, appId, { operation: 'disable' });
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
apps.get('/:appId/permissions', adminMiddleware, async (c) => {
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
apps.put('/:appId/permissions', adminMiddleware, async (c) => {
  try {
    const appId = c.req.param('appId');
    const app = await getApp(appId);
    if (!app) {
      return c.json({ error: 'App not found' }, 404);
    }
    const body = await c.req.json();
    const incoming = Array.isArray(body?.permissions) ? body.permissions : [];
    const saved = await replaceAppPermissions(appId, incoming);
    await auditAppAdmin(c, AuditAction.PERMISSION_CHANGED, appId, {
      groupCount: Array.isArray(saved) ? saved.length : undefined,
    });
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
    // Personenliste nur fuer App-Nutzer (Berechtigungs-Dialoge in der App) und Admins.
    if (!isAdmin(c)) {
      const userId = getCurrentUserId(c);
      const access = userId ? await resolveAppAccess(userId, appId) : null;
      if (!access?.allowed) return c.json({ error: 'Keine Berechtigung fuer diese App' }, 403);
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
    const access = await resolveAppAccess(userId, appId);
    return c.json({
      role: access.allowed ? access.role : null,
      // Damit das Frontend zwischen "nicht freigeschaltet", "konfiguriert aber
      // kein Zugriff" und "noch nicht konfiguriert" unterscheiden kann.
      enabled: app.enabled,
      configured: (app.permissions?.groups ?? []).length > 0,
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
apps.route('/podcast-repurposing', podcastRepurposingRoutes);
apps.route('/echoloop', echoloopRoutes);
apps.route('/wohngeld', wohngeldRoutes);
apps.route('/grundsicherung', grundsicherungRoutes);

export { apps as appsRoutes };
