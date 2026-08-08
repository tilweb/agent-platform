import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { join } from 'path';
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
import { extractionProjectRoutes } from './routes/extraction-projects';
import { extractionJobRoutes } from './routes/extraction-jobs';
import { extractionInboxRoutes } from './routes/extraction-inbox';
import { imageGenerationService } from './services/imageGeneration';
import { setupTools } from './tools';
import { mcpManager } from './mcp';
import { startExecutor } from './services/taskExecutor';
import { recoverTasks } from './services/taskService';
import { recoverStaleRuns } from './extraction/learning';
import { llmService } from './services/llm';
import { registerCommands } from './commands';
import { registerProviders } from './connections/providers';
import { syncBuiltInApps } from './apps/registry';
import { publicApiRouter } from './public-api/router';
import { brandingRoutes } from './routes/branding';
import { runMigrations } from './db/migrate';
import { ensureBucket } from './storage/s3';

const app = new Hono();

// Initialize tools, MCP, LLM, commands, and task executor
async function initialize() {
  // Register slash commands first (no dependencies)
  registerCommands();

  // Run pending DB migrations (idempotent, no-op without SCALINGO_POSTGRES)
  try {
    await runMigrations();
  } catch (error) {
    console.error('DB migrations failed:', error);
  }

  // Ensure S3 bucket exists (idempotent, no-op without FLOW_S3_*)
  try {
    await ensureBucket();
  } catch (error) {
    console.error('S3 bucket init failed:', error);
  }

  // Sync built-in apps into the registry (idempotent, preserves admin enable state)
  try {
    await syncBuiltInApps();
  } catch (error) {
    console.error('Built-in apps sync failed:', error);
  }

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

  // Verwaiste Document-Processing-Läufe aufräumen (fire-and-forget-Batches, die
  // ein vorheriger Prozess-Crash/Neustart mitten in 'processing' zurückließ).
  try {
    const stale = await recoverStaleRuns();
    if (stale > 0) console.log(`Recovered ${stale} stale extraction batch run(s)`);
  } catch (error) {
    console.error('Failed to recover stale extraction runs:', error);
  }
}
initialize().catch(console.error);

// Middleware
app.use('*', logger());

// CORS Configuration - explicit origin whitelist
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  process.env.API_BASE_URL || 'http://localhost:3001',
  // Add additional allowed origins here if needed
].filter(Boolean) as string[];

app.use('*', cors({
  origin: (origin) => {
    // No origin (same-origin requests, curl, etc.) - allow
    if (!origin) {
      return ALLOWED_ORIGINS[0] || null;
    }
    // Check against whitelist
    if (ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }
    // In development, also allow the default Vite port
    if (process.env.NODE_ENV !== 'production' && origin === 'http://localhost:5173') {
      return origin;
    }
    // Reject unknown origins
    console.warn(`[CORS] Rejected origin: ${origin}`);
    return null;
  },
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Type'],
}));

// Security headers (CSP, X-Frame-Options, etc.)
// Wenn PLATFORM_LOGO_URL eine externe HTTPS-URL ist, deren Origin der CSP
// img-src whitelist hinzufuegen, damit der Browser das Logo laden darf.
const extraImgSrc: string[] = [];
try {
  if (process.env.PLATFORM_LOGO_URL && process.env.PLATFORM_LOGO_URL.startsWith('http')) {
    const origin = new URL(process.env.PLATFORM_LOGO_URL).origin;
    extraImgSrc.push(origin);
  }
} catch {
  /* invalid URL — fail open, browser will block if necessary */
}
app.use('*', securityHeaders({
  connectSrc: ['https://api.adacor.ai'],
  imgSrc: extraImgSrc.length > 0 ? extraImgSrc : undefined,
}));

// Global rate limiting for API routes (100 req/min fallback)
app.use('/api/*', apiRateLimit);

// CSRF protection for state-changing requests
app.use('/api/*', csrfProtection({
  skipPaths: [
    '/api/shared/',     // Public shared chat access
    '/api/public/',     // Public API: Bearer-token auth (API-key), CSRF not applicable
  ],
}));

// Health check (no rate limit, no CSRF)
app.get('/health', (c) => c.json({ status: 'ok' }));

// Public API (API-key-authenticated, versioned) — own rate-limit layer per key
app.route('/api/public/v1', publicApiRouter);

// Branding (public, unauth'd) — Title/Logo per Customer-Environment via ENV
app.route('/api/branding', brandingRoutes);

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
app.route('/api/extraction', extractionProjectRoutes);
app.route('/api/extraction', extractionJobRoutes);    // Heavy-Pipeline (P0+, /jobs/* Sub-Paths)
app.route('/api/extraction', extractionInboxRoutes);  // Posteingang (Welle 4, /inbox/* Sub-Paths)

// Production: serve built frontend (same-origin, no CORS needed)
if (process.env.NODE_ENV === 'production') {
  const frontendDir = join(import.meta.dir, '../../frontend/dist');

  // Serve static assets (JS, CSS, images, etc.)
  app.use('/assets/*', serveStatic({ root: frontendDir }));

  // SPA fallback: try file first, then index.html for client-side routing
  app.get('*', serveStatic({ root: frontendDir }));
  app.get('*', serveStatic({ root: frontendDir, path: 'index.html' }));
}

const port = parseInt(process.env.PORT || '3001');

console.log(`🚀 Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120, // 120 seconds — needed for long-running SSE streams during multi-agent delegation
};
