/**
 * Spaces API Routes
 *
 * REST endpoints for managing spaces, members, memory, and KB links.
 */

import { Hono } from 'hono';
import { authMiddleware, getCurrentUserId } from '../auth/middleware';
import { internalError } from '../utils/errorHandler';
import {
  createSpace,
  getSpace,
  updateSpace,
  archiveSpace,
  deleteSpace,
  listUserSpaces,
  getMembers,
  addMember,
  updateMemberRole,
  removeMember,
  updateSettings,
  getMemory,
  addAbout,
  addInstruction,
  addContext,
  deleteMemoryItem,
  setContextActive,
  getKBLinks,
  linkKBCollection,
  unlinkKBCollection,
  listChats,
  getChat,
  deleteChat,
  getSpaceContext,
} from '../spaces';
import type { SpaceRole, MemorySection, Priority, MemorySource } from '../spaces';

export const spaceRoutes = new Hono();

// Apply auth middleware to all routes
spaceRoutes.use('*', authMiddleware);

// =============================================================================
// Space CRUD
// =============================================================================

/**
 * GET /api/spaces - List spaces for current user
 */
spaceRoutes.get('/', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const includeArchived = c.req.query('includeArchived') === 'true';
  const result = await listUserSpaces(userId, includeArchived);

  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }

  return c.json({ spaces: result.data });
});

/**
 * POST /api/spaces - Create a new space
 */
spaceRoutes.post('/', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { name, description, icon, color } = body;

    if (!name) {
      return c.json({ error: 'Name ist erforderlich' }, 400);
    }

    // Input length validation
    if (name.length > 100) {
      return c.json({ error: 'Name darf maximal 100 Zeichen lang sein' }, 400);
    }
    if (description && description.length > 1000) {
      return c.json({ error: 'Beschreibung darf maximal 1000 Zeichen lang sein' }, 400);
    }

    const result = await createSpace(userId, name, { description, icon, color });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data, 201);
  } catch (error: any) {
    console.error('Error creating space:', error);
    return c.json({ error: 'Fehler beim Erstellen des Spaces' }, 500);
  }
});

/**
 * GET /api/spaces/:id - Get space details
 */
spaceRoutes.get('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const result = await getSpace(spaceId, userId);

  if (!result.success) {
    const status = result.error?.includes('nicht gefunden') ? 404 : 403;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.data);
});

/**
 * PUT /api/spaces/:id - Update space
 */
spaceRoutes.put('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { name, description, icon, color } = body;

    // Input length validation
    if (name && name.length > 100) {
      return c.json({ error: 'Name darf maximal 100 Zeichen lang sein' }, 400);
    }
    if (description && description.length > 1000) {
      return c.json({ error: 'Beschreibung darf maximal 1000 Zeichen lang sein' }, 400);
    }

    const result = await updateSpace(spaceId, userId, { name, description, icon, color });

    if (!result.success) {
      const status = result.error?.includes('nicht gefunden') ? 404 : 403;
      return c.json({ error: result.error }, status);
    }

    return c.json(result.data);
  } catch (error: any) {
    console.error('Error updating space:', error);
    return c.json({ error: 'Fehler beim Aktualisieren' }, 500);
  }
});

/**
 * DELETE /api/spaces/:id - Delete space
 */
spaceRoutes.delete('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const result = await deleteSpace(spaceId, userId);

  if (!result.success) {
    const status = result.error?.includes('nicht gefunden') ? 404 : 403;
    return c.json({ error: result.error }, status);
  }

  return c.json({ success: true });
});

/**
 * POST /api/spaces/:id/archive - Archive space
 */
spaceRoutes.post('/:id/archive', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const result = await archiveSpace(spaceId, userId, true);

  if (!result.success) {
    const status = result.error?.includes('nicht gefunden') ? 404 : 403;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.data);
});

/**
 * POST /api/spaces/:id/unarchive - Unarchive space
 */
spaceRoutes.post('/:id/unarchive', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const result = await archiveSpace(spaceId, userId, false);

  if (!result.success) {
    const status = result.error?.includes('nicht gefunden') ? 404 : 403;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.data);
});

// =============================================================================
// Members
// =============================================================================

/**
 * GET /api/spaces/:id/members - List space members
 */
spaceRoutes.get('/:id/members', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const result = await getMembers(spaceId, userId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json({ members: result.data });
});

/**
 * POST /api/spaces/:id/members - Add a member
 */
spaceRoutes.post('/:id/members', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { userId: targetUserId, role } = body;

    if (!targetUserId || !role) {
      return c.json({ error: 'userId und role sind erforderlich' }, 400);
    }

    const validRoles: SpaceRole[] = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Ungültige Rolle. Erlaubt: admin, editor, viewer' }, 400);
    }

    const result = await addMember(spaceId, userId, targetUserId, role);

    if (!result.success) {
      return c.json({ error: result.error }, 403);
    }

    return c.json(result.data, 201);
  } catch (error: any) {
    console.error('Error adding member:', error);
    return c.json({ error: 'Fehler beim Hinzufügen' }, 500);
  }
});

/**
 * PUT /api/spaces/:id/members/:userId - Update member role
 */
spaceRoutes.put('/:id/members/:userId', async (c) => {
  const currentUserId = getCurrentUserId(c);
  if (!currentUserId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const targetUserId = c.req.param('userId');

  try {
    const body = await c.req.json();
    const { role } = body;

    if (!role) {
      return c.json({ error: 'role ist erforderlich' }, 400);
    }

    const validRoles: SpaceRole[] = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Ungültige Rolle. Erlaubt: admin, editor, viewer' }, 400);
    }

    const result = await updateMemberRole(spaceId, currentUserId, targetUserId, role);

    if (!result.success) {
      return c.json({ error: result.error }, 403);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error updating member role:', error);
    return c.json({ error: 'Fehler beim Aktualisieren' }, 500);
  }
});

/**
 * DELETE /api/spaces/:id/members/:userId - Remove member
 */
spaceRoutes.delete('/:id/members/:userId', async (c) => {
  const currentUserId = getCurrentUserId(c);
  if (!currentUserId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const targetUserId = c.req.param('userId');

  const result = await removeMember(spaceId, currentUserId, targetUserId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json({ success: true });
});

// =============================================================================
// Settings
// =============================================================================

/**
 * PUT /api/spaces/:id/settings - Update space settings
 */
spaceRoutes.put('/:id/settings', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const result = await updateSettings(spaceId, userId, body);

    if (!result.success) {
      return c.json({ error: result.error }, 403);
    }

    return c.json(result.data);
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return c.json({ error: 'Fehler beim Aktualisieren' }, 500);
  }
});

// =============================================================================
// Memory
// =============================================================================

/**
 * GET /api/spaces/:id/memory - Get space memory
 */
spaceRoutes.get('/:id/memory', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const result = await getMemory(spaceId, userId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json(result.data);
});

/**
 * POST /api/spaces/:id/memory/about - Add about item
 */
spaceRoutes.post('/:id/memory/about', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { content, source = 'manual' } = body;

    if (!content) {
      return c.json({ error: 'content ist erforderlich' }, 400);
    }

    const result = await addAbout(spaceId, userId, content, source as MemorySource);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data, 201);
  } catch (error: any) {
    console.error('Error adding about item:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/spaces/:id/memory/instructions - Add instruction
 */
spaceRoutes.post('/:id/memory/instructions', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { content, priority = 'normal', source = 'manual' } = body;

    if (!content) {
      return c.json({ error: 'content ist erforderlich' }, 400);
    }

    const validPriorities: Priority[] = ['high', 'normal'];
    if (!validPriorities.includes(priority)) {
      return c.json({ error: 'Ungültige Priorität. Erlaubt: high, normal' }, 400);
    }

    const result = await addInstruction(
      spaceId,
      userId,
      content,
      priority as Priority,
      source as MemorySource
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data, 201);
  } catch (error: any) {
    console.error('Error adding instruction:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/spaces/:id/memory/context - Add context item
 */
spaceRoutes.post('/:id/memory/context', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { name, description, active = true, source = 'manual' } = body;

    if (!name) {
      return c.json({ error: 'name ist erforderlich' }, 400);
    }

    const result = await addContext(
      spaceId,
      userId,
      name,
      description,
      active,
      source as MemorySource
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data, 201);
  } catch (error: any) {
    console.error('Error adding context item:', error);
    return internalError(c, error);
  }
});

/**
 * DELETE /api/spaces/:id/memory/:section/:itemId - Delete memory item
 */
spaceRoutes.delete('/:id/memory/:section/:itemId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const section = c.req.param('section');
  const itemId = c.req.param('itemId');

  const validSections: MemorySection[] = ['about', 'instructions', 'context'];
  if (!validSections.includes(section as MemorySection)) {
    return c.json({ error: 'Ungültige Section. Erlaubt: about, instructions, context' }, 400);
  }

  const result = await deleteMemoryItem(spaceId, userId, section as MemorySection, itemId);

  if (!result.success) {
    return c.json({ error: result.error }, 404);
  }

  return c.json({ success: true });
});

/**
 * PUT /api/spaces/:id/memory/context/:itemId/active - Toggle context active
 */
spaceRoutes.put('/:id/memory/context/:itemId/active', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const itemId = c.req.param('itemId');

  try {
    const body = await c.req.json();
    const { active } = body;

    if (typeof active !== 'boolean') {
      return c.json({ error: 'active muss ein boolean sein' }, 400);
    }

    const result = await setContextActive(spaceId, userId, itemId, active);

    if (!result.success) {
      return c.json({ error: result.error }, 404);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error updating context:', error);
    return c.json({ error: 'Fehler beim Aktualisieren' }, 500);
  }
});

// =============================================================================
// KB Collections
// =============================================================================

/**
 * GET /api/spaces/:id/collections - Get linked KB collections
 */
spaceRoutes.get('/:id/collections', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const result = await getKBLinks(spaceId, userId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json(result.data);
});

/**
 * POST /api/spaces/:id/collections - Link a KB collection
 */
spaceRoutes.post('/:id/collections', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { collectionId } = body;

    if (!collectionId) {
      return c.json({ error: 'collectionId ist erforderlich' }, 400);
    }

    const result = await linkKBCollection(spaceId, userId, collectionId);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data, 201);
  } catch (error: any) {
    console.error('Error linking collection:', error);
    return c.json({ error: 'Fehler beim Verknüpfen' }, 500);
  }
});

/**
 * DELETE /api/spaces/:id/collections/:collId - Unlink a KB collection
 */
spaceRoutes.delete('/:id/collections/:collId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const collectionId = c.req.param('collId');

  const result = await unlinkKBCollection(spaceId, userId, collectionId);

  if (!result.success) {
    return c.json({ error: result.error }, 404);
  }

  return c.json({ success: true });
});

// =============================================================================
// Chats
// =============================================================================

/**
 * GET /api/spaces/:id/chats - List space chats
 */
spaceRoutes.get('/:id/chats', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const result = await listChats(spaceId, userId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json({ chats: result.data });
});

/**
 * GET /api/spaces/:id/chats/:chatId - Get a space chat
 */
spaceRoutes.get('/:id/chats/:chatId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const chatId = c.req.param('chatId');

  const result = await getChat(spaceId, userId, chatId);

  if (!result.success) {
    const status = result.error?.includes('nicht gefunden') ? 404 : 403;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.data);
});

/**
 * DELETE /api/spaces/:id/chats/:chatId - Delete a space chat
 */
spaceRoutes.delete('/:id/chats/:chatId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const chatId = c.req.param('chatId');

  const result = await deleteChat(spaceId, userId, chatId);

  if (!result.success) {
    const status = result.error?.includes('nicht gefunden') ? 404 : 403;
    return c.json({ error: result.error }, status);
  }

  return c.json({ success: true });
});

// =============================================================================
// Context for Chat Integration
// =============================================================================

/**
 * GET /api/spaces/:id/context - Get space context for chat
 */
spaceRoutes.get('/:id/context', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const spaceId = c.req.param('id');
  const result = await getSpaceContext(spaceId, userId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json(result.data);
});
