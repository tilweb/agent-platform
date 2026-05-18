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
import { imageGenerationService } from './services/imageGeneration';
import { setupTools } from './tools';
import { mcpManager } from './mcp';
import { startExecutor } from './services/taskExecutor';
import { recoverTasks } from './services/taskService';
import { llmService } from './services/llm';
import { registerCommands } from './commands';
import { registerProviders } from './connections/providers';
import { syncBuiltInApps } from './apps/registry';
import { publicApiRouter } from './public-api/router';
import { brandingRoutes } from './routes/branding';
import { runMigrations } from './db/migrate';
import { migrateAuftraegeToProjekteIfNeeded } from './apps/projektmanagement/projekt-service';
import { ensureBucket } from './storage/s3';
import { seedDemoUsers } from '../../scripts/seed-demo-users';
import { seedCustomSkillsFromDisk } from './skills';
import { seedProjectsFromDisk } from './projects';
import { seedChatsFromDisk } from './services/chatStorage';
import { seedKbFromDisk } from './services/kbStorage';

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

  // Daten-Migration Phase A: Projektauftrag → Projekt (1:1, gleiche ID).
  // Idempotent — Boot 2..N sehen nur "0 created, N skipped". Springt frueh raus
  // wenn keine DB konfiguriert ist (Dev ohne SCALINGO_POSTGRES).
  if (process.env.SCALINGO_POSTGRES) {
    try {
      const r = await migrateAuftraegeToProjekteIfNeeded();
      if (r.created > 0 || r.errors > 0) {
        console.log(`[migrate-projekte] created=${r.created} skipped=${r.skipped} errors=${r.errors}`);
      }
    } catch (error) {
      console.warn('[migrate-projekte] skipped/failed (server will still start):', error instanceof Error ? error.message : error);
    }
  }

  // Demo-Seed-Block — laeuft NUR wenn die Instanz ausdruecklich als Demo-
  // Instanz gekennzeichnet ist (`SEED_DEMO_DATA=true`) UND die DB erreichbar
  // ist. Fuer echte Customer-Instanzen bleibt das aus, der Bootstrap-Admin
  // legt sich beim ersten Login selbst an.
  //
  // Was hier reinfaellt:
  // - Demo-User (demo1..4, marketing1..3, ruhrpm, andreas_bachmann, …)
  // - Bundled Projekte/Chats aus data/projects/ + data/chats/
  // - Bundled KB-Collections + Dokumente aus data/knowledge-base/
  //
  // Was IMMER laeuft (s.u., ausserhalb dieses Blocks):
  // - DB-Migrationen
  // - Custom-Skills (Plattform-Skills, kein Demo-Inhalt)
  // - Apps-Registry-Sync, Tools, Provider — Plattform-Grundgeruest
  const seedDemoData = process.env.SEED_DEMO_DATA === 'true';
  const allowDemoSeedInProd = process.env.ALLOW_DEMO_SEED_IN_PRODUCTION === 'true';
  if (seedDemoData && process.env.NODE_ENV === 'production' && !allowDemoSeedInProd) {
    console.error(
      '\n========================================================\n' +
      '[FATAL] SEED_DEMO_DATA=true is forbidden when NODE_ENV=production.\n' +
      'Demo users have well-known passwords (demo1, demo2, ...) and must NEVER\n' +
      'run in a real Customer-deployment. Aborting startup.\n' +
      '\n' +
      'Wenn dies eine Demo-Instanz ist (Scalingo "workplace-demo" o.ae.):\n' +
      '  set ALLOW_DEMO_SEED_IN_PRODUCTION=true zusaetzlich.\n' +
      'Wenn nicht: set SEED_DEMO_DATA=false.\n' +
      '========================================================\n'
    );
    process.exit(1);
  }
  if (seedDemoData && process.env.SCALINGO_POSTGRES) {
    if (allowDemoSeedInProd) {
      console.warn('[seed] DEMO INSTANCE — ALLOW_DEMO_SEED_IN_PRODUCTION=true bestaetigt; seeding mit bekannten Passwoertern.');
    } else {
      console.warn('[seed] DEMO MODE ACTIVE — seeding demo users with well-known passwords');
    }
    console.log('[seed] SEED_DEMO_DATA=true — running demo data seeds');
    try {
      const result = await seedDemoUsers();
      if (result.created.length > 0) {
        console.log(`[seed] Demo users created: ${result.created.length}`);
      }
    } catch (error) {
      console.warn('[seed] Demo user seed skipped:', error instanceof Error ? error.message : error);
    }

    try {
      await seedProjectsFromDisk();
    } catch (error) {
      console.warn('[seed] Projects seed skipped:', error instanceof Error ? error.message : error);
    }

    try {
      await seedChatsFromDisk();
    } catch (error) {
      console.warn('[seed] Chats seed skipped:', error instanceof Error ? error.message : error);
    }

    try {
      await seedKbFromDisk();
    } catch (error) {
      console.warn('[seed] KB seed skipped:', error instanceof Error ? error.message : error);
    }
  } else if (process.env.SCALINGO_POSTGRES) {
    console.log('[seed] SEED_DEMO_DATA != "true" — skipping demo seeds (Customer-Mode)');
  }

  // Custom Skills aus data/skills/custom/ — sind Plattform-Skills (keine
  // Demo-Daten) und werden auch fuer echte Customer geseedet. Idempotent.
  if (process.env.SCALINGO_POSTGRES) {
    try {
      await seedCustomSkillsFromDisk();
    } catch (error) {
      console.warn('[seed] Custom-skills seed skipped:', error instanceof Error ? error.message : error);
    }
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

  // Migrate file-based custom agents to DB (idempotent, no-op once done)
  try {
    const { migrateFileAgentsToDb } = await import('./services/agents');
    const result = await migrateFileAgentsToDb();
    if (result.migrated.length > 0) {
      console.log(`[agents] migrated to DB: ${result.migrated.join(', ')}`);
    }
  } catch (error) {
    console.error('Custom-agents migration failed:', error);
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
