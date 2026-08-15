/**
 * Routes fuer die Kapazitaetsplanung (zentrale Personen-Stammdaten).
 *
 * Pfade:
 *   GET    /kapazitaeten/personen        — Liste
 *   GET    /kapazitaeten/personen/:id     — Detail
 *   POST   /kapazitaeten/personen         — Anlegen (App-Editor+)
 *   PUT    /kapazitaeten/personen/:id      — Update (App-Editor+, expectedVersion)
 *   DELETE /kapazitaeten/personen/:id      — Loeschen (App-Editor+)
 *
 * requireAppAccess wird vom Aggregator (../routes.ts) global gesetzt — alle
 * Endpoints setzen also mind. App-Viewer voraus; Schreiben zusaetzlich App-Editor+.
 */

import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { VersionConflictError } from '../concurrency';
import {
  listPersonen,
  getPerson,
  createPerson,
  updatePerson,
  deletePerson,
} from '../kapazitaet-storage';
import { denyIfNotAppEditor } from './_shared';
import type { KapazitaetspersonCreateInput, KapazitaetspersonUpdateInput } from '../types';

export const kapazitaetenRoutes = new Hono();

// ============== List ==============

kapazitaetenRoutes.get('/kapazitaeten/personen', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const personen = await listPersonen();
    return c.json({ personen });
  } catch (error) {
    console.error('listPersonen error:', error);
    return c.json({ error: 'Failed to list personen' }, 500);
  }
});

// ============== Detail ==============

kapazitaetenRoutes.get('/kapazitaeten/personen/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const person = await getPerson(c.req.param('id'));
    if (!person) return c.json({ error: 'Person nicht gefunden' }, 404);
    return c.json({ person });
  } catch (error) {
    console.error('getPerson error:', error);
    return c.json({ error: 'Failed to get person' }, 500);
  }
});

// ============== Create ==============

kapazitaetenRoutes.post('/kapazitaeten/personen', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json({ error: denied.error }, 403);

    const body = await c.req.json<KapazitaetspersonCreateInput>();
    if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
      return c.json({ error: 'name ist erforderlich' }, 400);
    }
    const person = await createPerson({
      name: body.name.trim(),
      role: body.role,
      wochenarbeitszeit_pct: body.wochenarbeitszeit_pct,
      linie_avg_pt: body.linie_avg_pt,
      linie_monate: body.linie_monate,
      ownerId: userId,
    });
    return c.json({ person }, 201);
  } catch (error: any) {
    console.error('createPerson error:', error);
    return c.json({ error: error?.message || 'Failed to create person' }, 500);
  }
});

// ============== Update ==============

kapazitaetenRoutes.put('/kapazitaeten/personen/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json({ error: denied.error }, 403);

    const body = await c.req.json<KapazitaetspersonUpdateInput>();
    const person = await updatePerson(c.req.param('id'), {
      name: body.name,
      role: body.role,
      wochenarbeitszeit_pct: body.wochenarbeitszeit_pct,
      linie_avg_pt: body.linie_avg_pt,
      linie_monate: body.linie_monate,
      expectedVersion: body.expectedVersion,
    });
    return c.json({ person });
  } catch (error: any) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    console.error('updatePerson error:', error);
    return c.json({ error: error?.message || 'Failed to update person' }, 500);
  }
});

// ============== Delete ==============

kapazitaetenRoutes.delete('/kapazitaeten/personen/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json({ error: denied.error }, 403);

    const ok = await deletePerson(c.req.param('id'));
    if (!ok) return c.json({ error: 'Person nicht gefunden' }, 404);
    return c.json({ ok: true });
  } catch (error) {
    console.error('deletePerson error:', error);
    return c.json({ error: 'Failed to delete person' }, 500);
  }
});
