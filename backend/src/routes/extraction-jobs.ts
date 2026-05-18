/**
 * Heavy Extraction Pipeline — HTTP-Routes.
 *
 * Pfade unter `/api/extraction/jobs/*`. Wird parallel zu `extraction-projects.ts`
 * gemountet (gleiches Prefix, kollidiert nicht weil andere Sub-Pfade).
 *
 * P0: nur ein synchroner Debug-Endpoint `/jobs/run-sync` zum End-to-End-Smoken
 * der Strategy-Registry. Asynchrone Job-Endpoints (POST /jobs, GET /jobs/:id/stream
 * etc.) folgen in P5 — die Strategy + Pipeline-Logik ist dann schon stabil.
 */

import { Hono } from 'hono';
import { getCurrentUserId } from '../auth/middleware';
import { runPipeline } from '../services/extraction';
import type { ExtractionSchema, PreparedFile } from '../services/extraction';
import { applyExtractionDefaults } from '../services/extraction';

export const extractionJobRoutes = new Hono();

/**
 * GET /api/extraction/jobs/strategies
 * Listet die registrierten Strategy-IDs. Nuetzlich fuer Diagnose im
 * Frontend / fuer App-Adapter, die wissen wollen welche Strategien
 * verfuegbar sind.
 */
extractionJobRoutes.get('/jobs/strategies', async (c) => {
  const { listStrategies } = await import('../services/extraction');
  return c.json({ strategies: listStrategies() });
});

/**
 * POST /api/extraction/jobs/run-sync
 *
 * Synchroner Debug-Pfad: Caller schickt bereits vorbereitete `PreparedFile[]`
 * + ExtractionSchema, Pipeline laeuft durch und returnt das Ergebnis.
 * Gedacht fuer:
 *   - Smoke-Tests im Browser/curl
 *   - App-Adapter, die _noch_ keinen Async-Job brauchen (kurze Dokumente)
 *
 * Async-Variante mit Job-Modell + SSE kommt in P5.
 */
extractionJobRoutes.post('/jobs/run-sync', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);

    const body = await c.req.json<{
      files: PreparedFile[];
      schema: {
        id: string;
        name: string;
        profile: ExtractionSchema['profile'];
        config?: Partial<ExtractionSchema['config']>;
      };
    }>();

    if (!body?.files || !Array.isArray(body.files) || body.files.length === 0) {
      return c.json({ error: 'files[] ist erforderlich' }, 400);
    }
    if (!body?.schema?.profile) {
      return c.json({ error: 'schema.profile ist erforderlich' }, 400);
    }

    const schema: ExtractionSchema = {
      id: body.schema.id,
      name: body.schema.name,
      profile: body.schema.profile,
      config: applyExtractionDefaults(body.schema.config),
    };

    const result = await runPipeline({
      files: body.files,
      schema,
      userId,
    });

    return c.json({ result });
  } catch (err: any) {
    console.error('[extraction] run-sync error:', err);
    return c.json({ error: err?.message || 'Extraction failed' }, 500);
  }
});

/**
 * POST /api/extraction/jobs
 *
 * Async-Job-Start. Stub: 501 in P0 — wird in P5 implementiert (TaskService-
 * Adapter + SSE-Stream).
 */
extractionJobRoutes.post('/jobs', async (c) => {
  return c.json(
    { error: 'Async jobs werden in Phase 5 verfuegbar. Bis dahin: /jobs/run-sync.' },
    501,
  );
});

extractionJobRoutes.get('/jobs/:id', async (c) => {
  return c.json({ error: 'Async jobs werden in Phase 5 verfuegbar.' }, 501);
});

extractionJobRoutes.get('/jobs/:id/stream', async (c) => {
  return c.json({ error: 'Async jobs werden in Phase 5 verfuegbar.' }, 501);
});

extractionJobRoutes.post('/jobs/:id/cancel', async (c) => {
  return c.json({ error: 'Async jobs werden in Phase 5 verfuegbar.' }, 501);
});

extractionJobRoutes.get('/jobs/:id/result', async (c) => {
  return c.json({ error: 'Async jobs werden in Phase 5 verfuegbar.' }, 501);
});
