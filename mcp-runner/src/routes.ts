/**
 * MCP Runner HTTP Routes
 */

import { Hono } from 'hono';
import { processManager } from './process-manager';
import type { ConnectRequest, ToolCallRequest, WarmRequest } from './types';

const api = new Hono();

// List all servers
api.get('/servers', (c) => {
  return c.json(processManager.getAllStatuses());
});

// Get single server status
api.get('/servers/:id/status', (c) => {
  const status = processManager.getStatus(c.req.param('id'));
  if (!status) {
    return c.json({ error: 'Server not found' }, 404);
  }
  return c.json(status);
});

// Connect / spawn a server
api.post('/servers/:id/connect', async (c) => {
  const body = await c.req.json<ConnectRequest>();
  const id = c.req.param('id');

  // Ensure ID in path matches body
  if (body.id && body.id !== id) {
    return c.json({ error: 'ID mismatch between path and body' }, 400);
  }
  body.id = id;

  if (!body.name || !body.command) {
    return c.json({ error: 'name and command are required' }, 400);
  }

  try {
    await processManager.connect(body);
    const status = processManager.getStatus(id);
    return c.json(status);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Disconnect a server
api.post('/servers/:id/disconnect', async (c) => {
  const id = c.req.param('id');
  try {
    await processManager.disconnect(id);
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// List tools from a server
api.get('/servers/:id/tools', (c) => {
  const id = c.req.param('id');
  const conn = processManager.getConnection(id);
  if (!conn) {
    return c.json({ error: 'Server not found' }, 404);
  }
  return c.json(conn.getTools());
});

// Call a tool
api.post('/servers/:id/tools/:toolName/call', async (c) => {
  const { id, toolName } = c.req.param();
  try {
    const body = await c.req.json<ToolCallRequest>();
    const result = await processManager.callTool(id, toolName, body.arguments || {});
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Refresh tools
api.post('/servers/:id/refresh', async (c) => {
  const id = c.req.param('id');
  try {
    const tools = await processManager.refreshTools(id);
    return c.json(tools);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Pre-download npm package into cache
api.post('/warm', async (c) => {
  try {
    const body = await c.req.json<WarmRequest>();
    if (!body.command) {
      return c.json({ error: 'command is required' }, 400);
    }
    const result = await processManager.warmCache(body.command, body.args);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export { api };
