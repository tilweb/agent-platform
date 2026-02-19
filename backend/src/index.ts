import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { bodyLimit } from 'hono/body-limit';
import { apiRateLimit } from './middleware/rateLimit';
import { csrfProtection } from './middleware/csrf';
import { securityHeaders } from './middleware/securityHeaders';
import { chatRoutes, chatHistoryRoutes, skillRoutes, toolRoutes, customToolRoutes, mcpRoutes, sharedChatRoutes, knowledgeStreamRoutes, exportRoutes } from './routes/chat';
import { agentRoutes } from './routes/agents';
import { knowledgeRoutes } from './routes/knowledge';
import { memoryRoutes } from './routes/memory';
import { tasksRoutes } from './routes/tasks';
import { commandRoutes } from './routes/commands';
import { tablesRoutes } from './routes/tables';
import providerRoutes from './routes/providers';
import { authRoutes } from './routes/auth';
import { connectionRoutes } from './routes/connections';
import { searchRoutes } from './routes/search';
import { projectRoutes } from './routes/projects';
import { usersRoutes } from './routes/users';
import { appsRoutes } from './routes/apps';
import { transcriptionRoutes } from './routes/transcription';
import { attachmentRoutes } from './routes/attachments';
import { rbacRoutes } from './routes/rbac';
import { adminRoutes } from './routes/admin';
import { imageRoutes } from './routes/images';
import { notificationRoutes } from './routes/notifications';
import { imageGenerationService } from './services/imageGeneration';
import { setupTools } from './tools';
import { mcpManager } from './mcp';
import { startExecutor } from './services/taskExecutor';
import { recoverTasks } from './services/taskService';
import { llmService } from './services/llm';
import { registerCommands } from './commands';
import { registerProviders } from './connections/providers';

const app = new Hono();

// Global error handler - catches unhandled errors and returns safe responses
app.onError((err, c) => {
  console.error('[Global Error]', err);
  return c.json({ error: 'Interner Serverfehler' }, 500);
});

// Initialize tools, MCP, LLM, commands, and task executor
async function initialize() {
  // Register slash commands first (no dependencies)
  registerCommands();

  // Initialize LLM service with configured providers
  try {
    await llmService.initialize();
  } catch (error) {
    console.error('LLM service initialization failed:', error);
  }

  // Initialize image generation service
  try {
    await imageGenerationService.reload();
  } catch (error) {
    console.error('Image generation service initialization failed:', error);
  }

  await setupTools();

  // Register connection providers (and their tools)
  registerProviders();

  await mcpManager.initialize();

  // Recover interrupted tasks and start executor
  try {
    const recovered = await recoverTasks();
    if (recovered.recovered > 0) {
      console.log(`Recovered ${recovered.recovered} interrupted tasks`);
    }
    await startExecutor();
  } catch (error) {
    console.error('Failed to start task executor:', error);
  }
}
initialize().catch(console.error);

// Middleware
app.use('*', logger());

// CORS Configuration
// In production with K8s Ingress: same-origin, no CORS needed.
// In dev with Vite Proxy: same-origin via proxy, no CORS needed.
// FRONTEND_URL can be set as fallback for setups without proxy/ingress.
const frontendUrl = process.env.FRONTEND_URL;

function buildOriginWhitelist(): string[] {
  const origins = new Set<string>();
  if (frontendUrl) {
    origins.add(frontendUrl);
    if (frontendUrl.includes('localhost')) {
      origins.add(frontendUrl.replace('localhost', '127.0.0.1'));
    } else if (frontendUrl.includes('127.0.0.1')) {
      origins.add(frontendUrl.replace('127.0.0.1', 'localhost'));
    }
  }
  return [...origins];
}

const ALLOWED_ORIGINS = buildOriginWhitelist();

app.use('*', cors({
  origin: (origin) => {
    // No origin (same-origin requests, curl, etc.) - allow
    if (!origin) return null;
    // If FRONTEND_URL is set, check against whitelist
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }
    // No FRONTEND_URL configured — same-origin only (reject cross-origin)
    if (ALLOWED_ORIGINS.length === 0) {
      console.warn(`[CORS] Rejected cross-origin request from: ${origin} (set FRONTEND_URL to allow)`);
      return null;
    }
    console.warn(`[CORS] Rejected origin: ${origin}`);
    return null;
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Type'],
}));

// Security headers (CSP, X-Frame-Options, etc.)
app.use('*', securityHeaders({
  connectSrc: ['https://api.adacor.ai'],
}));

// Global rate limiting for API routes (100 req/min fallback)
app.use('/api/*', apiRateLimit);

// CSRF protection for state-changing requests
app.use('/api/*', csrfProtection({
  skipPaths: [
    '/api/shared/',  // Public shared chat access
  ],
}));

// Body size limit for API requests (configurable via MAX_BODY_SIZE_MB, default 10 MB)
const maxBodySizeMb = parseInt(process.env.MAX_BODY_SIZE_MB || '10', 10);
app.use('/api/*', bodyLimit({
  maxSize: maxBodySizeMb * 1024 * 1024,
  onError: (c) => c.json({ error: `Request body zu groß (max. ${maxBodySizeMb} MB)` }, 413),
}));

// Health check (no rate limit, no CSRF, no auth)
app.get('/health', (c) => c.json({
  status: 'ok',
  service: 'backend',
  uptime: Math.floor(process.uptime()),
  timestamp: new Date().toISOString(),
}));

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/connections', connectionRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/chats', chatHistoryRoutes);
app.route('/api/shared', sharedChatRoutes);  // Public shared chat access (no auth)
app.route('/api/exports', exportRoutes);    // Document export downloads
app.route('/api/agents', agentRoutes);
app.route('/api/skills', skillRoutes);
// Custom tools must be registered before general tools (to avoid /:name matching "custom")
app.route('/api/custom-tools', customToolRoutes);
app.route('/api/tools', toolRoutes);
app.route('/api/mcp', mcpRoutes);
app.route('/api/knowledge', knowledgeRoutes);
app.route('/api/knowledge', knowledgeStreamRoutes);  // Streaming routes from chat.ts
app.route('/api/memory', memoryRoutes);
app.route('/api/tasks', tasksRoutes);
app.route('/api/tables', tablesRoutes);
app.route('/api/providers', providerRoutes);
app.route('/api/commands', commandRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api/users', usersRoutes);
app.route('/api/apps', appsRoutes);
app.route('/api/transcribe', transcriptionRoutes);
app.route('/api/chats', attachmentRoutes);  // Attachment retrieval API
app.route('/api/resources', rbacRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/images', imageRoutes);
app.route('/api/notifications', notificationRoutes);

const port = parseInt(process.env.PORT || '3001');

console.log(`🚀 Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120, // 120 seconds — needed for long-running SSE streams during multi-agent delegation
};
