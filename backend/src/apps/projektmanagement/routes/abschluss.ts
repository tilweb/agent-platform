/**
 * Routes fuer Abschlussbericht (Phase F).
 *
 * 1:1 Sub-Resource am Projektauftrag. Permissions erben vom Auftrag —
 * Viewer liest, Editor+ schreibt + finalize, Owner loescht + reopen.
 *
 * Suggest-Endpoint ruft den LLM-Coach via `withLlmTimeout` (30s); bei
 * Timeout → 504.
 *
 * Export-Endpoint laedt Auftrag + alle SBs + LLs und ruft
 * `mapAbschlussberichtToDocument` mit appConfig fuer Label-Resolution.
 */

import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { VersionConflictError } from '../concurrency';
import { LlmTimeoutError } from '../llm-utils';
import {
  getAbschlussbericht,
  createAbschlussbericht,
  updateAbschlussbericht,
  deleteAbschlussbericht,
  finalizeAbschlussbericht,
  reopenAbschlussbericht,
  suggestAbschlussDraft,
} from '../abschluss-service';
import { listLessonsLearned } from '../lessons-learned-service';
import { listStatusberichte } from '../statusbericht-service';
import { getProjektauftragDetails } from '../service';
import { getConfig } from '../storage';
import {
  generateDocument,
  mapAbschlussberichtToDocument,
  getMimeType,
  getFileExtension,
  type DocumentFormat,
} from '../../../services/documentGenerator';
import { denyIfBelowAuftragRole } from './_shared';

export const abschlussRoutes = new Hono();

abschlussRoutes.get('/projektauftraege/:projektId/abschlussbericht', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const bericht = await getAbschlussbericht(projektId);
    return c.json({ abschlussbericht: bericht });
  } catch (error) {
    console.error('Error getting Abschlussbericht:', error);
    return c.json({ error: 'Failed to get Abschlussbericht' }, 500);
  }
});

abschlussRoutes.post('/projektauftraege/:projektId/abschlussbericht', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    let overrides: any = undefined;
    try {
      const body = await c.req.json();
      overrides = body?.overrides;
    } catch {
      // Body optional
    }
    const bericht = await createAbschlussbericht(projektId, { overrides }, userId);
    return c.json({ abschlussbericht: bericht }, 201);
  } catch (error) {
    if (error instanceof Error && /existiert bereits/.test(error.message)) {
      return c.json({ error: error.message }, 409);
    }
    console.error('Error creating Abschlussbericht:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create Abschlussbericht' }, 500);
  }
});

abschlussRoutes.put('/projektauftraege/:projektId/abschlussbericht', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const body = await c.req.json();
    const bericht = await updateAbschlussbericht(projektId, {
      data: body?.data,
      expectedVersion: body?.expectedVersion,
    });
    return c.json({ abschlussbericht: bericht });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    if (error instanceof Error && /final/.test(error.message)) {
      return c.json({ error: error.message }, 409);
    }
    if (error instanceof Error && /nicht gefunden/.test(error.message)) {
      return c.json({ error: error.message }, 404);
    }
    console.error('Error updating Abschlussbericht:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update Abschlussbericht' }, 500);
  }
});

abschlussRoutes.delete('/projektauftraege/:projektId/abschlussbericht', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'owner');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const ok = await deleteAbschlussbericht(projektId);
    if (!ok) return c.json({ error: 'Abschlussbericht nicht gefunden' }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting Abschlussbericht:', error);
    return c.json({ error: 'Failed to delete Abschlussbericht' }, 500);
  }
});

abschlussRoutes.post('/projektauftraege/:projektId/abschlussbericht/finalize', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    let expectedVersion: number | undefined;
    try {
      const body = await c.req.json();
      expectedVersion = body?.expectedVersion;
    } catch {
      // Body optional
    }
    const bericht = await finalizeAbschlussbericht(projektId, expectedVersion);
    return c.json({ abschlussbericht: bericht });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    console.error('Error finalizing Abschlussbericht:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to finalize' }, 500);
  }
});

abschlussRoutes.post('/projektauftraege/:projektId/abschlussbericht/reopen', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'owner');
    if (denied) return c.json({ error: denied.error }, denied.status);

    let expectedVersion: number | undefined;
    try {
      const body = await c.req.json();
      expectedVersion = body?.expectedVersion;
    } catch {
      // Body optional
    }
    const bericht = await reopenAbschlussbericht(projektId, expectedVersion);
    return c.json({ abschlussbericht: bericht });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    console.error('Error reopening Abschlussbericht:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to reopen' }, 500);
  }
});

abschlussRoutes.post('/projektauftraege/:projektId/abschlussbericht/suggest', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const suggestion = await suggestAbschlussDraft(projektId, userId);
    return c.json({ suggestion });
  } catch (error) {
    if (error instanceof LlmTimeoutError) {
      console.warn('LLM-Timeout bei abschluss suggest:', error.message);
      return c.json({ error: 'LLM-Aufruf hat zu lange gedauert. Bitte erneut versuchen.' }, 504);
    }
    console.error('Error suggesting Abschlussbericht draft:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to suggest' }, 500);
  }
});

abschlussRoutes.get('/projektauftraege/:projektId/abschlussbericht/export/:format', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const format = c.req.param('format') as DocumentFormat;
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const bericht = await getAbschlussbericht(projektId);
    if (!bericht) return c.json({ error: 'Abschlussbericht nicht gefunden' }, 404);

    const auftrag = await getProjektauftragDetails(projektId);
    const lessons = await listLessonsLearned(projektId);
    const appConfig = await getConfig();
    const sbs = await listStatusberichte(projektId);
    const documentData = mapAbschlussberichtToDocument(bericht, auftrag, lessons, appConfig, sbs);

    const buffer = await generateDocument(documentData, format);
    const filename = `Abschlussbericht_${auftrag?.name || projektId}.${getFileExtension(format)}`;
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': getMimeType(format),
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting Abschlussbericht:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to export' }, 500);
  }
});
