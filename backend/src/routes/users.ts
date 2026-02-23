/**
 * Users API Routes
 *
 * Endpoints for:
 * - User listing (for member selection in spaces)
 * - User preferences (model selection per user)
 */

import { Hono } from 'hono';
import { authMiddleware, getCurrentUserId } from '../auth/middleware';
import { internalError, validationError, unauthorizedError, notFoundError } from '../utils/errorHandler';
import { listUsers } from '../auth/storage';
import {
  getAllUserModelPreferences,
  setUserModelPreference,
  clearUserModelPreference,
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
 * Used for member selection dropdowns in space management.
 * Returns minimal user info: id, username, displayName, email
 */
usersRoutes.get('/', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
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
    return internalError(c, error);
  }
});

/**
 * GET /api/users/search - Search users by name or email
 */
usersRoutes.get('/search', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
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
    return internalError(c, error);
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
    return unauthorizedError(c);
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
    return internalError(c, error);
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
    return unauthorizedError(c);
  }

  const purpose = c.req.param('purpose') as ModelPurpose;

  // Validate purpose
  if (!VALID_PURPOSES.includes(purpose)) {
    return validationError(c, `Ungültiger Zweck. Erlaubt: ${VALID_PURPOSES.join(', ')}`);
  }

  try {
    const body = await c.req.json<{ provider_id: string; model_id: string }>();

    if (!body.provider_id || !body.model_id) {
      return validationError(c, 'provider_id und model_id sind erforderlich');
    }

    // Validate that the provider exists and is enabled
    const provider = await getProvider(body.provider_id);
    if (!provider) {
      return notFoundError(c, 'Provider');
    }
    if (!provider.enabled) {
      return validationError(c, 'Provider ist deaktiviert');
    }

    // Validate that the model exists
    const model = provider.models.find(m => m.id === body.model_id);
    if (!model) {
      return notFoundError(c, 'Modell');
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
    return internalError(c, error);
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
    return unauthorizedError(c);
  }

  const purpose = c.req.param('purpose') as ModelPurpose;

  // Validate purpose
  if (!VALID_PURPOSES.includes(purpose)) {
    return validationError(c, `Ungültiger Zweck. Erlaubt: ${VALID_PURPOSES.join(', ')}`);
  }

  try {
    await clearUserModelPreference(userId, purpose);

    return c.json({
      success: true,
      message: `Modellauswahl für ${purpose} auf System-Standard zurückgesetzt`,
    });
  } catch (error: any) {
    console.error('Error clearing user preference:', error);
    return internalError(c, error);
  }
});
