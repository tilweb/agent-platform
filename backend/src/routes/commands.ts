/**
 * Commands Routes
 * REST API for the slash command system
 */

import { Hono } from 'hono';
import { commandRegistry } from '../commands/registry';
import type { ExecuteCommandRequest } from '../commands/types';

export const commandRoutes = new Hono();

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
    return c.json({ error: 'Failed to list commands' }, 500);
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
      return c.json({ error: 'Command not found' }, 404);
    }

    return c.json({ command });
  } catch (error) {
    console.error('Error getting command:', error);
    return c.json({ error: 'Failed to get command' }, 500);
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
      return c.json({ error: 'Command not found' }, 404);
    }

    const options = await commandRegistry.getOptions(commandId);
    return c.json({ options });
  } catch (error) {
    console.error('Error getting command options:', error);
    return c.json({ error: 'Failed to get command options' }, 500);
  }
});

/**
 * POST /api/commands/execute
 * Execute a command
 */
commandRoutes.post('/execute', async (c) => {
  try {
    const body = await c.req.json<ExecuteCommandRequest>();
    const { command, optionId, args } = body;

    if (!command) {
      return c.json({ error: 'Command is required' }, 400);
    }

    const result = await commandRegistry.execute(command, optionId, args);
    return c.json(result);
  } catch (error) {
    console.error('Error executing command:', error);
    return c.json(
      {
        success: false,
        message: `Fehler: ${(error as Error).message}`,
      },
      500
    );
  }
});
