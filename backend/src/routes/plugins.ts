/**
 * Plugin API Routes
 *
 * Admin endpoints for managing plugin configurations.
 * Regular users can read plugin status but not modify configs.
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { authMiddleware, getCurrentUser, requireUserId } from '../auth';
import { internalError, validationError, notFoundError, forbiddenError } from '../utils/errorHandler';
import {
  pluginRegistry,
  savePluginConfig,
  loadPluginConfigMasked,
  deletePluginConfig,
  isPluginConfigured,
} from '../plugins';
import { toolRegistry } from '../tools/registry';

export const pluginRoutes = new Hono();

// Auth for all routes
pluginRoutes.use('*', authMiddleware);

/**
 * Admin-only middleware
 */
const requireAdmin: MiddlewareHandler = async (c, next) => {
  const user = getCurrentUser(c);
  if (!user || user.role !== 'admin') {
    return forbiddenError(c, 'Admin-Rechte erforderlich');
  }
  await next();
};

/**
 * GET /api/plugins — List all plugins with status
 */
pluginRoutes.get('/', async (c) => {
  try {
    const typeFilter = c.req.query('type');
    const plugins = pluginRegistry.list(
      typeFilter ? { type: typeFilter as any } : undefined
    );
    return c.json({ plugins });
  } catch (error: any) {
    console.error('List plugins error:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/plugins/:id — Get single plugin info
 */
pluginRoutes.get('/:id', async (c) => {
  try {
    const pluginId = c.req.param('id');
    const info = pluginRegistry.getInfo(pluginId);
    if (!info) {
      return notFoundError(c, 'Plugin');
    }
    return c.json(info);
  } catch (error: any) {
    console.error('Get plugin error:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/plugins/:id/config — Get config values (secrets masked)
 */
pluginRoutes.get('/:id/config', requireAdmin, async (c) => {
  try {
    const pluginId = c.req.param('id');
    const manifest = pluginRegistry.getManifest(pluginId);
    if (!manifest) {
      return notFoundError(c, 'Plugin');
    }

    const config = await loadPluginConfigMasked(pluginId, manifest.configSchema || []);
    return c.json({
      pluginId,
      configSchema: manifest.configSchema || [],
      config: config?.values || {},
      configuredAt: config?.configuredAt,
      configuredBy: config?.configuredBy,
    });
  } catch (error: any) {
    console.error('Get plugin config error:', error);
    return internalError(c, error);
  }
});

/**
 * PUT /api/plugins/:id/config — Save config (admin only)
 */
pluginRoutes.put('/:id/config', requireAdmin, async (c) => {
  try {
    const pluginId = c.req.param('id');
    const manifest = pluginRegistry.getManifest(pluginId);
    if (!manifest) {
      return notFoundError(c, 'Plugin');
    }

    const body = await c.req.json();
    const values = body.values;
    if (!values || typeof values !== 'object') {
      return validationError(c, 'Ungültige Konfiguration');
    }

    // Validate required fields
    const schema = manifest.configSchema || [];
    for (const field of schema) {
      if (field.required && !values[field.key] && values[field.key] !== false) {
        return validationError(c, `Pflichtfeld "${field.label}" fehlt`);
      }
    }

    const user = getCurrentUser(c);
    await savePluginConfig(pluginId, schema, values, user?.username);

    // Update registry status
    const configured = await isPluginConfigured(pluginId, schema);
    await pluginRegistry.updateConfigured(pluginId, configured, user?.username);

    return c.json({ success: true, configured });
  } catch (error: any) {
    console.error('Save plugin config error:', error);
    return internalError(c, error);
  }
});

/**
 * DELETE /api/plugins/:id/config — Remove config (admin only)
 */
pluginRoutes.delete('/:id/config', requireAdmin, async (c) => {
  try {
    const pluginId = c.req.param('id');
    const manifest = pluginRegistry.getManifest(pluginId);
    if (!manifest) {
      return notFoundError(c, 'Plugin');
    }

    const deleted = await deletePluginConfig(pluginId);
    await pluginRegistry.updateConfigured(pluginId, false);

    return c.json({ success: true, deleted });
  } catch (error: any) {
    console.error('Delete plugin config error:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/plugins/:id/enable — Enable plugin (admin only)
 */
pluginRoutes.post('/:id/enable', requireAdmin, async (c) => {
  try {
    const pluginId = c.req.param('id');
    const success = await pluginRegistry.setEnabled(pluginId, true);
    if (!success) {
      return notFoundError(c, 'Plugin');
    }
    toolRegistry.setPluginDisabled(pluginId, false);
    console.log(`Plugin enabled: ${pluginId}`);
    return c.json({ success: true, enabled: true });
  } catch (error: any) {
    console.error('Enable plugin error:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/plugins/:id/disable — Disable plugin (admin only)
 */
pluginRoutes.post('/:id/disable', requireAdmin, async (c) => {
  try {
    const pluginId = c.req.param('id');
    const success = await pluginRegistry.setEnabled(pluginId, false);
    if (!success) {
      return notFoundError(c, 'Plugin');
    }
    toolRegistry.setPluginDisabled(pluginId, true);
    console.log(`Plugin disabled: ${pluginId}`);
    return c.json({ success: true, enabled: false });
  } catch (error: any) {
    console.error('Disable plugin error:', error);
    return internalError(c, error);
  }
});
