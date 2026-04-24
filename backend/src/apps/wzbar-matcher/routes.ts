/**
 * WZ-Branchen-Matcher Routes
 */

import { Hono } from 'hono';
import { match, history, detail } from './service';
import { isIndexReady, loadEmbeddings, loadCatalog } from './storage';

const wzbar = new Hono();

/**
 * POST /api/apps/wzbar-matcher/match
 * body: { inputText: string }
 */
wzbar.post('/match', async (c) => {
  try {
    const body = await c.req.json<{ inputText?: string }>();
    const inputText = (body?.inputText ?? '').trim();
    if (!inputText) {
      return c.json({ error: 'inputText fehlt' }, 400);
    }
    const userId = 'user_default';
    const record = await match(inputText, userId);
    return c.json({ record }, 201);
  } catch (error) {
    console.error('[wzbar-matcher] match error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Match fehlgeschlagen' },
      500,
    );
  }
});

/**
 * GET /api/apps/wzbar-matcher/history?limit=20
 */
wzbar.get('/history', async (c) => {
  try {
    const limitRaw = c.req.query('limit');
    const limit = limitRaw ? Math.max(1, Math.min(200, Number(limitRaw))) : 50;
    const records = await history(limit);
    return c.json({ records });
  } catch (error) {
    console.error('[wzbar-matcher] history error:', error);
    return c.json({ error: 'Historie konnte nicht geladen werden' }, 500);
  }
});

/**
 * GET /api/apps/wzbar-matcher/matches/:id
 */
wzbar.get('/matches/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const record = await detail(id);
    if (!record) return c.json({ error: 'Match nicht gefunden' }, 404);
    return c.json({ record });
  } catch (error) {
    console.error('[wzbar-matcher] detail error:', error);
    return c.json({ error: 'Match konnte nicht geladen werden' }, 500);
  }
});

/**
 * GET /api/apps/wzbar-matcher/status
 */
wzbar.get('/status', async (c) => {
  const ready = await isIndexReady();
  if (!ready) {
    return c.json({ catalogSize: 0, indexReady: false, embeddingModel: null, embeddingDimensions: null });
  }
  try {
    const [catalog, index] = await Promise.all([loadCatalog(), loadEmbeddings()]);
    return c.json({
      catalogSize: catalog.length,
      indexReady: true,
      embeddingModel: index.model,
      embeddingDimensions: index.dimensions,
    });
  } catch (error) {
    return c.json({ catalogSize: 0, indexReady: false, embeddingModel: null, embeddingDimensions: null });
  }
});

export { wzbar as wzbarMatcherRoutes };
