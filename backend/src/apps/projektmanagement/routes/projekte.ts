/**
 * Routes fuer die Phase-A-Entity `Projekt` (paProjekte).
 *
 * Pfade: `/projekte`, `/projekte/:id`.
 *
 * Permission-Check: requireAppAccess wird vom Aggregator (`../routes.ts`)
 * global gesetzt. Phase-A nutzt nur den App-Owner-Floor; Resource-Level-
 * Permissions auf Projekt kommen mit Phase D/F.
 */

import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { VersionConflictError } from '../concurrency';
import {
  listProjekte,
  getProjekt,
  createProjekt,
  updateProjekt,
  deleteProjekt,
} from '../projekt-service';

export const projekteRoutes = new Hono();

projekteRoutes.get('/projekte', async (c) => {
  try {
    const projekte = await listProjekte();
    return c.json({ projekte });
  } catch (error) {
    console.error('listProjekte error:', error);
    return c.json({ error: 'Failed to list projekte' }, 500);
  }
});

projekteRoutes.get('/projekte/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const projekt = await getProjekt(id);
    if (!projekt) return c.json({ error: 'Projekt nicht gefunden' }, 404);
    return c.json({ projekt });
  } catch (error) {
    console.error('getProjekt error:', error);
    return c.json({ error: 'Failed to get projekt' }, 500);
  }
});

projekteRoutes.post('/projekte', async (c) => {
  try {
    const body = await c.req.json<{
      id?: string;
      name?: string;
      lifecycle?: string;
      portfolioId?: string;
      ideeId?: string;
      ownerId?: string;
      metadata?: Record<string, unknown>;
    }>();
    if (!body?.name || typeof body.name !== 'string') {
      return c.json({ error: 'name ist erforderlich' }, 400);
    }
    const userId = getCurrentUserId(c);
    const projekt = await createProjekt({
      id: body.id,
      name: body.name,
      lifecycle: body.lifecycle as never,
      portfolioId: body.portfolioId,
      ideeId: body.ideeId,
      ownerId: body.ownerId ?? userId,
      metadata: body.metadata,
    });
    return c.json({ projekt }, 201);
  } catch (error: any) {
    console.error('createProjekt error:', error);
    return c.json({ error: error?.message || 'Failed to create projekt' }, 500);
  }
});

projekteRoutes.put('/projekte/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{
      name?: string;
      lifecycle?: string;
      portfolioId?: string | null;
      metadata?: Record<string, unknown>;
      expectedVersion?: number;
    }>();
    const projekt = await updateProjekt(id, {
      name: body.name,
      lifecycle: body.lifecycle as never,
      portfolioId: body.portfolioId,
      metadata: body.metadata,
      expectedVersion: body.expectedVersion,
    });
    return c.json({ projekt });
  } catch (error: any) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    console.error('updateProjekt error:', error);
    return c.json({ error: error?.message || 'Failed to update projekt' }, 500);
  }
});

projekteRoutes.delete('/projekte/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await deleteProjekt(id);
    if (!deleted) return c.json({ error: 'Projekt nicht gefunden' }, 404);
    return c.json({ ok: true });
  } catch (error) {
    console.error('deleteProjekt error:', error);
    return c.json({ error: 'Failed to delete projekt' }, 500);
  }
});
