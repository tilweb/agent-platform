/**
 * Users API Routes
 *
 * Endpoints for:
 * - User listing (for member selection in projects)
 * - User preferences (model selection per user)
 */

import { Hono } from 'hono';
import { authMiddleware, getCurrentUserId } from '../auth/middleware';
import { listUsers } from '../auth/storage';
import {
  getAllUserModelPreferences,
  setUserModelPreference,
  clearUserModelPreference,
  getFavoriteAgents,
  setFavoriteAgents,
  type ModelPurpose,
} from '../services/userPreferences';
import { getProvider, getActiveSelection, getSystemDefaultModel } from '../services/providers';

export const usersRoutes = new Hono();

// Apply auth middleware to all routes
usersRoutes.use('*', authMiddleware);

// Valid model purposes
const VALID_PURPOSES: ModelPurpose[] = ['chat', 'vision', 'tts', 'stt', 'text_to_image', 'image_to_image'];

/**
 * GET /api/users - List all active users
 *
 * Used for member selection dropdowns in project management.
 * Returns minimal user info: id, username, displayName, email
 */
usersRoutes.get('/', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const allUsers = await listUsers();

    // Filter to only active users and sanitize
    const users = allUsers
      .filter((u) => u.isActive)
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        email: u.email,
      }));

    return c.json({ users });
  } catch (error: any) {
    console.error('Error listing users:', error);
    return c.json({ error: 'Fehler beim Laden der Benutzer' }, 500);
  }
});

/**
 * GET /api/users/search - Search users by name or email
 */
usersRoutes.get('/search', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const query = c.req.query('q')?.toLowerCase();
  if (!query || query.length < 2) {
    return c.json({ users: [] });
  }

  try {
    const allUsers = await listUsers();

    // Filter by search query
    const users = allUsers
      .filter((u) => u.isActive)
      .filter((u) => {
        const username = u.username.toLowerCase();
        const displayName = (u.displayName || '').toLowerCase();
        const email = (u.email || '').toLowerCase();

        return (
          username.includes(query) ||
          displayName.includes(query) ||
          email.includes(query)
        );
      })
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        email: u.email,
      }))
      .slice(0, 20); // Limit results

    return c.json({ users });
  } catch (error: any) {
    console.error('Error searching users:', error);
    return c.json({ error: 'Fehler bei der Suche' }, 500);
  }
});

// ============== User Preferences: Model Selection ==============

/**
 * GET /api/users/preferences/models
 * Get the current user's model preferences
 *
 * Returns user preferences along with system defaults for comparison
 */
usersRoutes.get('/preferences/models', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    // Get user's preferences
    const userPreferences = await getAllUserModelPreferences(userId);

    // Get system defaults for comparison
    const systemDefaults = await getActiveSelection();

    return c.json({
      preferences: userPreferences || {},
      systemDefaults,
    });
  } catch (error: any) {
    console.error('Error getting user preferences:', error);
    return c.json({ error: 'Fehler beim Laden der Einstellungen' }, 500);
  }
});

/**
 * PUT /api/users/preferences/models/:purpose
 * Set the current user's model preference for a specific purpose
 *
 * Body: { provider_id: string, model_id: string }
 */
usersRoutes.put('/preferences/models/:purpose', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const purpose = c.req.param('purpose') as ModelPurpose;

  // Validate purpose
  if (!VALID_PURPOSES.includes(purpose)) {
    return c.json({
      error: `Ungültiger Zweck. Erlaubt: ${VALID_PURPOSES.join(', ')}`,
    }, 400);
  }

  try {
    const body = await c.req.json<{ provider_id: string; model_id: string }>();

    if (!body.provider_id || !body.model_id) {
      return c.json({
        error: 'provider_id und model_id sind erforderlich',
      }, 400);
    }

    // Validate that the provider exists and is enabled
    const provider = await getProvider(body.provider_id);
    if (!provider) {
      return c.json({ error: 'Provider nicht gefunden' }, 404);
    }
    if (!provider.enabled) {
      return c.json({ error: 'Provider ist deaktiviert' }, 400);
    }

    // Validate that the model exists
    const model = provider.models.find(m => m.id === body.model_id);
    if (!model) {
      return c.json({ error: 'Modell nicht gefunden' }, 404);
    }

    // Set the preference
    await setUserModelPreference(userId, purpose, body.provider_id, body.model_id);

    return c.json({
      success: true,
      preference: {
        purpose,
        provider_id: body.provider_id,
        model_id: body.model_id,
      },
    });
  } catch (error: any) {
    console.error('Error setting user preference:', error);
    return c.json({ error: error.message || 'Fehler beim Speichern' }, 500);
  }
});

/**
 * DELETE /api/users/preferences/models/:purpose
 * Clear the current user's model preference for a specific purpose
 * (reverts to using system default)
 */
usersRoutes.delete('/preferences/models/:purpose', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const purpose = c.req.param('purpose') as ModelPurpose;

  // Validate purpose
  if (!VALID_PURPOSES.includes(purpose)) {
    return c.json({
      error: `Ungültiger Zweck. Erlaubt: ${VALID_PURPOSES.join(', ')}`,
    }, 400);
  }

  try {
    await clearUserModelPreference(userId, purpose);

    return c.json({
      success: true,
      message: `Modellauswahl für ${purpose} auf System-Standard zurückgesetzt`,
    });
  } catch (error: any) {
    console.error('Error clearing user preference:', error);
    return c.json({ error: error.message || 'Fehler beim Zurücksetzen' }, 500);
  }
});

// ============== User Preferences: Favoriten-Agenten (Chat-Sidebar) ==============

/**
 * GET /api/users/preferences/favorite-agents
 * Get the current user's favorite agent IDs
 */
usersRoutes.get('/preferences/favorite-agents', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const agentIds = await getFavoriteAgents(userId);
    return c.json({ agent_ids: agentIds });
  } catch (error: any) {
    console.error('Error getting favorite agents:', error);
    return c.json({ error: 'Fehler beim Laden der Favoriten' }, 500);
  }
});

/**
 * PUT /api/users/preferences/favorite-agents
 * Replace the current user's favorite agent IDs
 *
 * Body: { agent_ids: string[] }
 */
usersRoutes.put('/preferences/favorite-agents', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json<{ agent_ids?: unknown }>();
    if (!Array.isArray(body.agent_ids)) {
      return c.json({ error: 'agent_ids muss ein Array von Agent-IDs sein' }, 400);
    }

    const saved = await setFavoriteAgents(userId, body.agent_ids as string[]);
    return c.json({ success: true, agent_ids: saved });
  } catch (error: any) {
    console.error('Error setting favorite agents:', error);
    return c.json({ error: error.message || 'Fehler beim Speichern der Favoriten' }, 500);
  }
});
