/**
 * MCP Runner — Dedicated container for running MCP server processes
 */

import { Hono } from 'hono';
import { bearerAuth } from './auth';
import { api } from './routes';
import { processManager } from './process-manager';

const port = parseInt(process.env.MCP_RUNNER_PORT || '3002', 10);
const secret = process.env.MCP_RUNNER_SECRET || '';
const debug = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

const app = new Hono();

// Debug request logging middleware
if (debug) {
  app.use('*', async (c, next) => {
    const start = performance.now();
    const method = c.req.method;
    const path = c.req.path;

    // Log request body for mutating requests
    let bodySnippet = '';
    if (method === 'POST' || method === 'PUT') {
      try {
        const cloned = c.req.raw.clone();
        const body = await cloned.json();
        // Summarize: show top-level keys + tool call details
        if (body.arguments !== undefined) {
          bodySnippet = ` args=${JSON.stringify(body.arguments)}`;
        } else {
          const keys = Object.keys(body);
          bodySnippet = ` body={${keys.join(', ')}}`;
        }
      } catch { /* not JSON or empty */ }
    }

    await next();

    const ms = (performance.now() - start).toFixed(1);
    const status = c.res.status;
    console.log(`[DEBUG] ${method} ${path}${bodySnippet} → ${status} (${ms}ms)`);
  });
}

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
if (debug) {
  console.log('DEBUG logging enabled');
}
if (!secret) {
  console.warn('WARNING: MCP_RUNNER_SECRET not set — API is unprotected!');
}

export default {
  port,
  fetch: app.fetch,
};
