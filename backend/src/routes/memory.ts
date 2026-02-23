/**
 * Memory API Routes (v2)
 *
 * REST endpoints for managing user memory data.
 * Sections: about, instructions, context
 *
 * All routes require authentication - each user has their own memory.
 */

import { Hono } from 'hono';
import { authMiddleware, requireUserId } from '../auth';
import { internalError, validationError, notFoundError } from '../utils/errorHandler';
import {
  loadUserMemory,
  addAboutItem,
  addInstruction,
  addContextItem,
  deleteMemoryItem,
  setContextActive,
  updateMemorySettings,
  isValidSection,
  getAllSections,
  type MemorySection,
  type Priority,
} from '../services/userMemory';

export const memoryRoutes = new Hono();

// Require authentication for all memory routes
memoryRoutes.use('/*', authMiddleware);

// GET /api/memory - Get all memory data
memoryRoutes.get('/', async (c) => {
  try {
    const userId = requireUserId(c);
    const memory = await loadUserMemory(userId);
    return c.json(memory);
  } catch (error: any) {
    console.error('Error loading memory:', error);
    return internalError(c, error);
  }
});

// GET /api/memory/sections - List available sections
memoryRoutes.get('/sections', async (c) => {
  return c.json({
    sections: getAllSections(),
  });
});

// PUT /api/memory/settings - Update memory settings
memoryRoutes.put('/settings', async (c) => {
  try {
    const userId = requireUserId(c);
    const body = await c.req.json();
    const settings = await updateMemorySettings(body, userId);
    return c.json(settings);
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return internalError(c, error);
  }
});

// GET /api/memory/:section - Get items from a specific section
memoryRoutes.get('/:section', async (c) => {
  const section = c.req.param('section');

  if (!isValidSection(section)) {
    return validationError(c, `Invalid section. Valid sections: ${getAllSections().join(', ')}`);
  }

  try {
    const userId = requireUserId(c);
    const memory = await loadUserMemory(userId);
    return c.json({ section, items: memory[section as MemorySection] });
  } catch (error: any) {
    console.error('Error loading section:', error);
    return internalError(c, error);
  }
});

// POST /api/memory/about - Add new about item
memoryRoutes.post('/about', async (c) => {
  try {
    const userId = requireUserId(c);
    const body = await c.req.json();
    const { content, source = 'manual' } = body;

    if (!content) {
      return validationError(c, 'Content is required');
    }

    const item = await addAboutItem(content, source, userId);
    return c.json(item, 201);
  } catch (error: any) {
    console.error('Error adding about item:', error);
    return internalError(c, error);
  }
});

// POST /api/memory/instructions - Add new instruction
memoryRoutes.post('/instructions', async (c) => {
  try {
    const userId = requireUserId(c);
    const body = await c.req.json();
    const { content, priority = 'normal', source = 'manual' } = body;

    if (!content) {
      return validationError(c, 'Content is required');
    }

    const validPriorities: Priority[] = ['high', 'normal'];
    if (!validPriorities.includes(priority)) {
      return validationError(c, 'Invalid priority. Use "high" or "normal"');
    }

    const item = await addInstruction(content, priority, source, userId);
    return c.json(item, 201);
  } catch (error: any) {
    console.error('Error adding instruction:', error);
    return internalError(c, error);
  }
});

// POST /api/memory/context - Add new context item
memoryRoutes.post('/context', async (c) => {
  try {
    const userId = requireUserId(c);
    const body = await c.req.json();
    const { name, description, active = true, source = 'manual' } = body;

    if (!name) {
      return validationError(c, 'Name is required');
    }

    const item = await addContextItem(name, description, active, source, userId);
    return c.json(item, 201);
  } catch (error: any) {
    console.error('Error adding context item:', error);
    return internalError(c, error);
  }
});

// PUT /api/memory/context/:id/active - Toggle context active status
memoryRoutes.put('/context/:id/active', async (c) => {
  const userId = requireUserId(c);
  const itemId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { active } = body;

    if (typeof active !== 'boolean') {
      return validationError(c, 'active must be a boolean');
    }

    const success = await setContextActive(itemId, active, userId);

    if (!success) {
      return notFoundError(c, 'Item');
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error updating context:', error);
    return internalError(c, error);
  }
});

// DELETE /api/memory/:section/:id - Delete an item from any section
memoryRoutes.delete('/:section/:id', async (c) => {
  const userId = requireUserId(c);
  const section = c.req.param('section');
  const itemId = c.req.param('id');

  if (!isValidSection(section)) {
    return validationError(c, `Invalid section. Valid sections: ${getAllSections().join(', ')}`);
  }

  try {
    const deleted = await deleteMemoryItem(section as MemorySection, itemId, userId);

    if (!deleted) {
      return notFoundError(c, 'Item');
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting memory item:', error);
    return internalError(c, error);
  }
});
