import { Hono } from 'hono';
import { optionalAuthMiddleware } from '../auth';

const docsRoutes = new Hono();

// Docs config is public (needed before login to render sidebar)
docsRoutes.use('*', optionalAuthMiddleware);

/**
 * GET /api/docs/config
 * Returns docs configuration (feature flags).
 */
docsRoutes.get('/config', (c) => {
  const entwicklerDocsEnabled = process.env.DOCS_DEVELOPER_ENABLED !== 'false';
  const partnerDocsEnabled = process.env.DOCS_PARTNER_ENABLED === 'true';
  return c.json({ entwicklerDocsEnabled, partnerDocsEnabled });
});

export { docsRoutes };
