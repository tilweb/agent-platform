/**
 * WZ-Branchen-Matcher Routes
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { match, history, detail } from './service';
import { isIndexReady, loadEmbeddings, loadCatalog } from './storage';
import { getNeighborhood } from './neighborhood';
import { requireAppAccess } from '../permissions-middleware';

const wzbar = new Hono();

// Berechtigungs-Pruefung
wzbar.use('*', requireAppAccess('wzbar-matcher'));

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
 * POST /api/apps/wzbar-matcher/match/stream — SSE-Variante fuer die
 * UX-Zwischenanzeige: Event `activities` sobald der Splitter fertig ist
 * (erkannte Taetigkeiten, waehrend die Codes noch rechnen), dann `record`
 * mit dem Endergebnis bzw. `error`. Cache-Treffer liefern direkt `record`.
 */
wzbar.post('/match/stream', async (c) => {
  const body = await c.req.json<{ inputText?: string }>().catch(() => null);
  const inputText = (body?.inputText ?? '').trim();

  return streamSSE(c, async (stream) => {
    if (!inputText) {
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: 'inputText fehlt' }) });
      return;
    }
    try {
      const record = await match(inputText, 'user_default', (activities) => {
        // fire-and-forget: writeSSE ist async, aber der Match soll nicht warten
        void stream.writeSSE({
          event: 'activities',
          data: JSON.stringify({ activities: activities.map(a => ({ text: a.text })) }),
        });
      });
      await stream.writeSSE({ event: 'record', data: JSON.stringify({ record }) });
    } catch (error) {
      console.error('[wzbar-matcher] match/stream error:', error);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: error instanceof Error ? error.message : 'Match fehlgeschlagen' }),
      });
    }
  });
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
 * GET /api/apps/wzbar-matcher/neighborhood/:code
 * Liefert das hierarchische Umfeld (Eltern/Geschwister/Kinder) eines WZ-Codes.
 */
wzbar.get('/neighborhood/:code', async (c) => {
  try {
    const code = c.req.param('code');
    const nodes = await getNeighborhood(code);
    return c.json({ code, nodes });
  } catch (error) {
    console.error('[wzbar-matcher] neighborhood error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Umfeld konnte nicht geladen werden' },
      400,
    );
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
