/**
 * Projects API Routes
 *
 * REST endpoints for managing projects, members, memory, and KB links.
 */

import { Hono } from 'hono';
import { authMiddleware, getCurrentUserId } from '../auth/middleware';
import {
  createProject,
  getProject,
  updateProject,
  archiveProject,
  deleteProject,
  listUserProjects,
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
  getProjectContext,
} from '../projects';
import type { ProjectRole, MemorySection, Priority, MemorySource } from '../projects';

export const projectRoutes = new Hono();

// Apply auth middleware to all routes
projectRoutes.use('*', authMiddleware);

// =============================================================================
// Project CRUD
// =============================================================================

/**
 * GET /api/projects - List projects for current user
 */
projectRoutes.get('/', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const includeArchived = c.req.query('includeArchived') === 'true';
  const result = await listUserProjects(userId, includeArchived);

  if (!result.success) {
    return c.json({ error: result.error }, 500);
  }

  return c.json({ projects: result.data });
});

/**
 * POST /api/projects - Create a new project
 */
projectRoutes.post('/', async (c) => {
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

    const result = await createProject(userId, name, { description, icon, color });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data, 201);
  } catch (error: any) {
    console.error('Error creating project:', error);
    return c.json({ error: 'Fehler beim Erstellen des Projekts' }, 500);
  }
});

/**
 * GET /api/projects/:id - Get project details
 */
projectRoutes.get('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const result = await getProject(projectId, userId);

  if (!result.success) {
    const status = result.error?.includes('nicht gefunden') ? 404 : 403;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.data);
});

/**
 * PUT /api/projects/:id - Update project
 */
projectRoutes.put('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');

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

    const result = await updateProject(projectId, userId, { name, description, icon, color });

    if (!result.success) {
      const status = result.error?.includes('nicht gefunden') ? 404 : 403;
      return c.json({ error: result.error }, status);
    }

    return c.json(result.data);
  } catch (error: any) {
    console.error('Error updating project:', error);
    return c.json({ error: 'Fehler beim Aktualisieren' }, 500);
  }
});

/**
 * DELETE /api/projects/:id - Delete project
 */
projectRoutes.delete('/:id', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const result = await deleteProject(projectId, userId);

  if (!result.success) {
    const status = result.error?.includes('nicht gefunden') ? 404 : 403;
    return c.json({ error: result.error }, status);
  }

  return c.json({ success: true });
});

/**
 * POST /api/projects/:id/archive - Archive project
 */
projectRoutes.post('/:id/archive', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const result = await archiveProject(projectId, userId, true);

  if (!result.success) {
    const status = result.error?.includes('nicht gefunden') ? 404 : 403;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.data);
});

/**
 * POST /api/projects/:id/unarchive - Unarchive project
 */
projectRoutes.post('/:id/unarchive', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const result = await archiveProject(projectId, userId, false);

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
 * GET /api/projects/:id/members - List project members
 */
projectRoutes.get('/:id/members', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const result = await getMembers(projectId, userId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json({ members: result.data });
});

/**
 * POST /api/projects/:id/members - Add a member
 */
projectRoutes.post('/:id/members', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { userId: targetUserId, role } = body;

    if (!targetUserId || !role) {
      return c.json({ error: 'userId und role sind erforderlich' }, 400);
    }

    const validRoles: ProjectRole[] = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Ungültige Rolle. Erlaubt: admin, editor, viewer' }, 400);
    }

    const result = await addMember(projectId, userId, targetUserId, role);

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
 * PUT /api/projects/:id/members/:userId - Update member role
 */
projectRoutes.put('/:id/members/:userId', async (c) => {
  const currentUserId = getCurrentUserId(c);
  if (!currentUserId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const targetUserId = c.req.param('userId');

  try {
    const body = await c.req.json();
    const { role } = body;

    if (!role) {
      return c.json({ error: 'role ist erforderlich' }, 400);
    }

    const validRoles: ProjectRole[] = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Ungültige Rolle. Erlaubt: admin, editor, viewer' }, 400);
    }

    const result = await updateMemberRole(projectId, currentUserId, targetUserId, role);

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
 * DELETE /api/projects/:id/members/:userId - Remove member
 */
projectRoutes.delete('/:id/members/:userId', async (c) => {
  const currentUserId = getCurrentUserId(c);
  if (!currentUserId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const targetUserId = c.req.param('userId');

  const result = await removeMember(projectId, currentUserId, targetUserId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json({ success: true });
});

// =============================================================================
// Settings
// =============================================================================

/**
 * PUT /api/projects/:id/settings - Update project settings
 */
projectRoutes.put('/:id/settings', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');

  try {
    const body = await c.req.json();
    const result = await updateSettings(projectId, userId, body);

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
 * GET /api/projects/:id/memory - Get project memory
 */
projectRoutes.get('/:id/memory', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const result = await getMemory(projectId, userId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json(result.data);
});

/**
 * POST /api/projects/:id/memory/about - Add about item
 */
projectRoutes.post('/:id/memory/about', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { content, source = 'manual' } = body;

    if (!content) {
      return c.json({ error: 'content ist erforderlich' }, 400);
    }

    const result = await addAbout(projectId, userId, content, source as MemorySource);

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result.data, 201);
  } catch (error: any) {
    console.error('Error adding about item:', error);
    return c.json({ error: error.message || 'Fehler beim Hinzufügen' }, 500);
  }
});

/**
 * POST /api/projects/:id/memory/instructions - Add instruction
 */
projectRoutes.post('/:id/memory/instructions', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');

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
      projectId,
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
    return c.json({ error: error.message || 'Fehler beim Hinzufügen' }, 500);
  }
});

/**
 * POST /api/projects/:id/memory/context - Add context item
 */
projectRoutes.post('/:id/memory/context', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { name, description, active = true, source = 'manual' } = body;

    if (!name) {
      return c.json({ error: 'name ist erforderlich' }, 400);
    }

    const result = await addContext(
      projectId,
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
    return c.json({ error: error.message || 'Fehler beim Hinzufügen' }, 500);
  }
});

/**
 * DELETE /api/projects/:id/memory/:section/:itemId - Delete memory item
 */
projectRoutes.delete('/:id/memory/:section/:itemId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const section = c.req.param('section');
  const itemId = c.req.param('itemId');

  const validSections: MemorySection[] = ['about', 'instructions', 'context'];
  if (!validSections.includes(section as MemorySection)) {
    return c.json({ error: 'Ungültige Section. Erlaubt: about, instructions, context' }, 400);
  }

  const result = await deleteMemoryItem(projectId, userId, section as MemorySection, itemId);

  if (!result.success) {
    return c.json({ error: result.error }, 404);
  }

  return c.json({ success: true });
});

/**
 * PUT /api/projects/:id/memory/context/:itemId/active - Toggle context active
 */
projectRoutes.put('/:id/memory/context/:itemId/active', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const itemId = c.req.param('itemId');

  try {
    const body = await c.req.json();
    const { active } = body;

    if (typeof active !== 'boolean') {
      return c.json({ error: 'active muss ein boolean sein' }, 400);
    }

    const result = await setContextActive(projectId, userId, itemId, active);

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
 * GET /api/projects/:id/collections - Get linked KB collections
 */
projectRoutes.get('/:id/collections', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const result = await getKBLinks(projectId, userId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json(result.data);
});

/**
 * POST /api/projects/:id/collections - Link a KB collection
 */
projectRoutes.post('/:id/collections', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { collectionId } = body;

    if (!collectionId) {
      return c.json({ error: 'collectionId ist erforderlich' }, 400);
    }

    const result = await linkKBCollection(projectId, userId, collectionId);

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
 * DELETE /api/projects/:id/collections/:collId - Unlink a KB collection
 */
projectRoutes.delete('/:id/collections/:collId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const collectionId = c.req.param('collId');

  const result = await unlinkKBCollection(projectId, userId, collectionId);

  if (!result.success) {
    return c.json({ error: result.error }, 404);
  }

  return c.json({ success: true });
});

// =============================================================================
// Chats
// =============================================================================

/**
 * GET /api/projects/:id/chats - List project chats
 */
projectRoutes.get('/:id/chats', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const result = await listChats(projectId, userId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json({ chats: result.data });
});

/**
 * GET /api/projects/:id/chats/:chatId - Get a project chat
 */
projectRoutes.get('/:id/chats/:chatId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const chatId = c.req.param('chatId');

  const result = await getChat(projectId, userId, chatId);

  if (!result.success) {
    const status = result.error?.includes('nicht gefunden') ? 404 : 403;
    return c.json({ error: result.error }, status);
  }

  return c.json(result.data);
});

/**
 * DELETE /api/projects/:id/chats/:chatId - Delete a project chat
 */
projectRoutes.delete('/:id/chats/:chatId', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const chatId = c.req.param('chatId');

  const result = await deleteChat(projectId, userId, chatId);

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
 * GET /api/projects/:id/context - Get project context for chat
 */
projectRoutes.get('/:id/context', async (c) => {
  const userId = getCurrentUserId(c);
  if (!userId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const projectId = c.req.param('id');
  const result = await getProjectContext(projectId, userId);

  if (!result.success) {
    return c.json({ error: result.error }, 403);
  }

  return c.json(result.data);
});
