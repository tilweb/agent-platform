/**
 * MCP Runner — Dedicated container for running MCP server processes
 */

import { Hono } from 'hono';
import { bearerAuth } from './auth';
import { api } from './routes';
import { processManager } from './process-manager';

const port = parseInt(process.env.MCP_RUNNER_PORT || '3002', 10);
const secret = process.env.MCP_RUNNER_SECRET || '';

const app = new Hono();

// Health endpoint (no auth)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    servers: processManager.serverCount,
    connected: processManager.connectedCount,
    uptime: Math.floor(process.uptime()),
  });
});

// Protected API routes
if (secret) {
  app.use('/api/*', bearerAuth(secret));
}

app.route('/api', api);

// Graceful shutdown
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down MCP servers...`);

  try {
    await processManager.disconnectAll();
    console.log('All MCP servers disconnected.');
  } catch (err) {
    console.error('Error during shutdown:', err);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

console.log(`MCP Runner listening on port ${port}`);
if (!secret) {
  console.warn('WARNING: MCP_RUNNER_SECRET not set — API is unprotected!');
}

export default {
  port,
  fetch: app.fetch,
};
