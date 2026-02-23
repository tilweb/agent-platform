/**
 * Spaces API Routes
 *
 * REST endpoints for managing spaces, members, memory, and KB links.
 */

import { Hono } from 'hono';
import { authMiddleware, getCurrentUserId } from '../auth/middleware';
import { internalError, validationError, unauthorizedError, forbiddenError, notFoundError } from '../utils/errorHandler';
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
    return unauthorizedError(c);
  }

  const includeArchived = c.req.query('includeArchived') === 'true';
  const result = await listUserSpaces(userId, includeArchived);

  if (!result.success) {
    return internalError(c, new Error(result.error || 'Fehler beim Laden der Spaces'));
  }

  return c.json({ spaces: result.data });
});

/**
 * POST /api/spaces - Create a new space
 */
spaceRoutes.post('/', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  try {
    const body = await c.req.json();
    const { name, description, icon, color } = body;

    if (!name) {
      return validationError(c, 'Name ist erforderlich');
    }

    // Input length validation
    if (name.length > 100) {
      return validationError(c, 'Name darf maximal 100 Zeichen lang sein');
    }
    if (description && description.length > 1000) {
      return validationError(c, 'Beschreibung darf maximal 1000 Zeichen lang sein');
    }

    const result = await createSpace(userId, name, { description, icon, color });

    if (!result.success) {
      return validationError(c, result.error || 'Fehler beim Erstellen');
    }

    return c.json(result.data, 201);
  } catch (error: any) {
    console.error('Error creating space:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/spaces/:id - Get space details
 */
spaceRoutes.get('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const result = await getSpace(spaceId, userId);

  if (!result.success) {
    return result.error?.includes('nicht gefunden')
      ? notFoundError(c, 'Space')
      : forbiddenError(c, result.error);
  }

  return c.json(result.data);
});

/**
 * PUT /api/spaces/:id - Update space
 */
spaceRoutes.put('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { name, description, icon, color } = body;

    // Input length validation
    if (name && name.length > 100) {
      return validationError(c, 'Name darf maximal 100 Zeichen lang sein');
    }
    if (description && description.length > 1000) {
      return validationError(c, 'Beschreibung darf maximal 1000 Zeichen lang sein');
    }

    const result = await updateSpace(spaceId, userId, { name, description, icon, color });

    if (!result.success) {
      return result.error?.includes('nicht gefunden')
        ? notFoundError(c, 'Space')
        : forbiddenError(c, result.error);
    }

    return c.json(result.data);
  } catch (error: any) {
    console.error('Error updating space:', error);
    return internalError(c, error);
  }
});

/**
 * DELETE /api/spaces/:id - Delete space
 */
spaceRoutes.delete('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const result = await deleteSpace(spaceId, userId);

  if (!result.success) {
    return result.error?.includes('nicht gefunden')
      ? notFoundError(c, 'Space')
      : forbiddenError(c, result.error);
  }

  return c.json({ success: true });
});

/**
 * POST /api/spaces/:id/archive - Archive space
 */
spaceRoutes.post('/:id/archive', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const result = await archiveSpace(spaceId, userId, true);

  if (!result.success) {
    return result.error?.includes('nicht gefunden')
      ? notFoundError(c, 'Space')
      : forbiddenError(c, result.error);
  }

  return c.json(result.data);
});

/**
 * POST /api/spaces/:id/unarchive - Unarchive space
 */
spaceRoutes.post('/:id/unarchive', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const result = await archiveSpace(spaceId, userId, false);

  if (!result.success) {
    return result.error?.includes('nicht gefunden')
      ? notFoundError(c, 'Space')
      : forbiddenError(c, result.error);
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
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const result = await getMembers(spaceId, userId);

  if (!result.success) {
    return forbiddenError(c, result.error);
  }

  return c.json({ members: result.data });
});

/**
 * POST /api/spaces/:id/members - Add a member
 */
spaceRoutes.post('/:id/members', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { userId: targetUserId, role } = body;

    if (!targetUserId || !role) {
      return validationError(c, 'userId und role sind erforderlich');
    }

    const validRoles: SpaceRole[] = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return validationError(c, 'Ungültige Rolle. Erlaubt: admin, editor, viewer');
    }

    const result = await addMember(spaceId, userId, targetUserId, role);

    if (!result.success) {
      return forbiddenError(c, result.error);
    }

    return c.json(result.data, 201);
  } catch (error: any) {
    console.error('Error adding member:', error);
    return internalError(c, error);
  }
});

/**
 * PUT /api/spaces/:id/members/:userId - Update member role
 */
spaceRoutes.put('/:id/members/:userId', async (c) => {
  const currentUserId = getCurrentUserId(c);
  if (!currentUserId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const targetUserId = c.req.param('userId');

  try {
    const body = await c.req.json();
    const { role } = body;

    if (!role) {
      return validationError(c, 'role ist erforderlich');
    }

    const validRoles: SpaceRole[] = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return validationError(c, 'Ungültige Rolle. Erlaubt: admin, editor, viewer');
    }

    const result = await updateMemberRole(spaceId, currentUserId, targetUserId, role);

    if (!result.success) {
      return forbiddenError(c, result.error);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error updating member role:', error);
    return internalError(c, error);
  }
});

/**
 * DELETE /api/spaces/:id/members/:userId - Remove member
 */
spaceRoutes.delete('/:id/members/:userId', async (c) => {
  const currentUserId = getCurrentUserId(c);
  if (!currentUserId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const targetUserId = c.req.param('userId');

  const result = await removeMember(spaceId, currentUserId, targetUserId);

  if (!result.success) {
    return forbiddenError(c, result.error);
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
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const result = await updateSettings(spaceId, userId, body);

    if (!result.success) {
      return forbiddenError(c, result.error);
    }

    return c.json(result.data);
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return internalError(c, error);
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
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const result = await getMemory(spaceId, userId);

  if (!result.success) {
    return forbiddenError(c, result.error);
  }

  return c.json(result.data);
});

/**
 * POST /api/spaces/:id/memory/about - Add about item
 */
spaceRoutes.post('/:id/memory/about', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { content, source = 'manual' } = body;

    if (!content) {
      return validationError(c, 'content ist erforderlich');
    }

    const result = await addAbout(spaceId, userId, content, source as MemorySource);

    if (!result.success) {
      return validationError(c, result.error || 'Fehler beim Hinzufügen');
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
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { content, priority = 'normal', source = 'manual' } = body;

    if (!content) {
      return validationError(c, 'content ist erforderlich');
    }

    const validPriorities: Priority[] = ['high', 'normal'];
    if (!validPriorities.includes(priority)) {
      return validationError(c, 'Ungültige Priorität. Erlaubt: high, normal');
    }

    const result = await addInstruction(
      spaceId,
      userId,
      content,
      priority as Priority,
      source as MemorySource
    );

    if (!result.success) {
      return validationError(c, result.error || 'Fehler beim Hinzufügen');
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
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { name, description, active = true, source = 'manual' } = body;

    if (!name) {
      return validationError(c, 'name ist erforderlich');
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
      return validationError(c, result.error || 'Fehler beim Hinzufügen');
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
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const section = c.req.param('section');
  const itemId = c.req.param('itemId');

  const validSections: MemorySection[] = ['about', 'instructions', 'context'];
  if (!validSections.includes(section as MemorySection)) {
    return validationError(c, 'Ungültige Section. Erlaubt: about, instructions, context');
  }

  const result = await deleteMemoryItem(spaceId, userId, section as MemorySection, itemId);

  if (!result.success) {
    return notFoundError(c, 'Memory-Eintrag');
  }

  return c.json({ success: true });
});

/**
 * PUT /api/spaces/:id/memory/context/:itemId/active - Toggle context active
 */
spaceRoutes.put('/:id/memory/context/:itemId/active', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const itemId = c.req.param('itemId');

  try {
    const body = await c.req.json();
    const { active } = body;

    if (typeof active !== 'boolean') {
      return validationError(c, 'active muss ein boolean sein');
    }

    const result = await setContextActive(spaceId, userId, itemId, active);

    if (!result.success) {
      return notFoundError(c, 'Context-Eintrag');
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error updating context:', error);
    return internalError(c, error);
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
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const result = await getKBLinks(spaceId, userId);

  if (!result.success) {
    return forbiddenError(c, result.error);
  }

  return c.json(result.data);
});

/**
 * POST /api/spaces/:id/collections - Link a KB collection
 */
spaceRoutes.post('/:id/collections', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { collectionId } = body;

    if (!collectionId) {
      return validationError(c, 'collectionId ist erforderlich');
    }

    const result = await linkKBCollection(spaceId, userId, collectionId);

    if (!result.success) {
      return validationError(c, result.error || 'Fehler beim Verknüpfen');
    }

    return c.json(result.data, 201);
  } catch (error: any) {
    console.error('Error linking collection:', error);
    return internalError(c, error);
  }
});

/**
 * DELETE /api/spaces/:id/collections/:collId - Unlink a KB collection
 */
spaceRoutes.delete('/:id/collections/:collId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const collectionId = c.req.param('collId');

  const result = await unlinkKBCollection(spaceId, userId, collectionId);

  if (!result.success) {
    return notFoundError(c, 'Collection-Verknüpfung');
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
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const result = await listChats(spaceId, userId);

  if (!result.success) {
    return forbiddenError(c, result.error);
  }

  return c.json({ chats: result.data });
});

/**
 * GET /api/spaces/:id/chats/:chatId - Get a space chat
 */
spaceRoutes.get('/:id/chats/:chatId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const chatId = c.req.param('chatId');

  const result = await getChat(spaceId, userId, chatId);

  if (!result.success) {
    return result.error?.includes('nicht gefunden')
      ? notFoundError(c, 'Chat')
      : forbiddenError(c, result.error);
  }

  return c.json(result.data);
});

/**
 * DELETE /api/spaces/:id/chats/:chatId - Delete a space chat
 */
spaceRoutes.delete('/:id/chats/:chatId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const chatId = c.req.param('chatId');

  const result = await deleteChat(spaceId, userId, chatId);

  if (!result.success) {
    return result.error?.includes('nicht gefunden')
      ? notFoundError(c, 'Chat')
      : forbiddenError(c, result.error);
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
    return unauthorizedError(c);
  }

  const spaceId = c.req.param('id');
  const result = await getSpaceContext(spaceId, userId);

  if (!result.success) {
    return forbiddenError(c, result.error);
  }

  return c.json(result.data);
});
