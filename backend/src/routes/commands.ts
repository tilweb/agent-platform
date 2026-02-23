/**
 * Commands Routes
 * REST API for the slash command system
 */

import { Hono } from 'hono';
import { commandRegistry } from '../commands/registry';
import type { ExecuteCommandRequest } from '../commands/types';
import { authMiddleware } from '../auth';
import { uploadRateLimit } from '../middleware/rateLimit';
import { internalError, notFoundError, validationError } from '../utils/errorHandler';

export const commandRoutes = new Hono();

// Require authentication for all command operations
commandRoutes.use('/*', authMiddleware);

/**
 * GET /api/commands
 * List all available commands
 */
commandRoutes.get('/', async (c) => {
  try {
    const commands = commandRegistry.getCommands();
    return c.json({ commands });
  } catch (error) {
    console.error('Error listing commands:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/commands/:id
 * Get a specific command
 */
commandRoutes.get('/:id', async (c) => {
  try {
    const commandId = c.req.param('id');
    const command = commandRegistry.getCommand(commandId);

    if (!command) {
      return notFoundError(c, 'Command');
    }

    return c.json({ command });
  } catch (error) {
    console.error('Error getting command:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/commands/:id/options
 * Get options for a command (e.g., list of agents for /agent)
 */
commandRoutes.get('/:id/options', async (c) => {
  try {
    const commandId = c.req.param('id');

    if (!commandRegistry.has(commandId)) {
      return notFoundError(c, 'Command');
    }

    const options = await commandRegistry.getOptions(commandId);
    return c.json({ options });
  } catch (error) {
    console.error('Error getting command options:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/commands/execute
 * Execute a command
 */
commandRoutes.post('/execute', uploadRateLimit, async (c) => {
  try {
    const body = await c.req.json<ExecuteCommandRequest>();
    const { command, optionId, args } = body;

    if (!command) {
      return validationError(c, 'Command is required');
    }

    const result = await commandRegistry.execute(command, optionId, args);
    return c.json(result);
  } catch (error) {
    console.error('Error executing command:', error);
    return internalError(c, error);
  }
});
