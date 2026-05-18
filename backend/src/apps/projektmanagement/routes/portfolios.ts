/**
 * Routes fuer Portfolios (Phase D).
 *
 * Pfade:
 *   GET    /portfolios                   — Liste (?status=active|archived, ?limit, ?offset)
 *   GET    /portfolios/:id               — Detail
 *   POST   /portfolios                   — Anlegen (App-Editor+)
 *   PUT    /portfolios/:id               — Update (Portfolio-Editor+, expectedVersion)
 *   DELETE /portfolios/:id               — Loeschen (Portfolio-Owner; Projekte werden NICHT mitgeloescht)
 *   GET    /portfolios/:id/projekte      — Zugeordnete Projekte (RBAC-gefiltert)
 *   GET    /portfolios/:id/projekte/available  — Projekte ohne Portfolio (fuer Hinzufuegen-Selector)
 *   GET    /portfolios/:id/dashboard     — PMO-Dashboard-Aggregat (Phase D Step 3)
 *
 * Permissions:
 * - Lesen: Portfolio-Viewer-Rolle (App-Floor reicht aus, also App-Viewer+ sieht alle Portfolios)
 * - Aendern: Portfolio-Editor+
 * - Loeschen: Portfolio-Owner
 *
 * requireAppAccess wird vom Aggregator (../routes.ts) global gesetzt — alle
 * Endpoints hier setzen also voraus, dass der User mind. App-Viewer ist.
 */

import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { VersionConflictError } from '../concurrency';
import {
  listPortfolios,
  getPortfolio,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
} from '../portfolio-service';
import { listProjekteByPortfolio, listProjekteWithoutPortfolio } from '../projekt-service';
import { getEffectiveAuftragRole } from '../permissions';
import {
  denyIfBelowPortfolioRole,
  denyIfNotAppEditor,
} from './_shared';
import { getPortfolioDashboard } from '../portfolio-dashboard-service';
import type { PortfolioStatus } from '../types';
// Hinweis: getPortfolioDashboard kommt aus portfolio-dashboard-service.ts (Phase D3).

export const portfoliosRoutes = new Hono();

// ============== List ==============

portfoliosRoutes.get('/portfolios', async (c) => {
  try {
    const status = c.req.query('status') as PortfolioStatus | undefined;
    const limitParam = c.req.query('limit');
    const offsetParam = c.req.query('offset');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    const portfolios = await listPortfolios({
      status,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
    return c.json({ portfolios });
  } catch (error) {
    console.error('listPortfolios error:', error);
    return c.json({ error: 'Failed to list portfolios' }, 500);
  }
});

// ============== Detail ==============

portfoliosRoutes.get('/portfolios/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowPortfolioRole(userId, id, 'viewer');
    if (denied) {
      const portfolio = await getPortfolio(id);
      if (!portfolio) return c.json({ error: 'Portfolio nicht gefunden' }, 404);
      return c.json({ error: denied.error }, denied.status);
    }
    const portfolio = await getPortfolio(id);
    if (!portfolio) return c.json({ error: 'Portfolio nicht gefunden' }, 404);
    return c.json({ portfolio });
  } catch (error) {
    console.error('getPortfolio error:', error);
    return c.json({ error: 'Failed to get portfolio' }, 500);
  }
});

// ============== Create ==============

portfoliosRoutes.post('/portfolios', async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = denyIfNotAppEditor(c);
    if (denied) return c.json({ error: denied.error }, 403);

    const body = await c.req.json<{
      name?: string;
      description?: string;
      strategy?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    }>();
    if (!body?.name || typeof body.name !== 'string' || !body.name.trim()) {
      return c.json({ error: 'name ist erforderlich' }, 400);
    }

    const status = body.status === 'archived' ? 'archived' : 'active';
    const portfolio = await createPortfolio({
      name: body.name,
      description: body.description,
      strategy: body.strategy,
      status,
      ownerId: userId,
      metadata: body.metadata,
    });
    return c.json({ portfolio }, 201);
  } catch (error: any) {
    console.error('createPortfolio error:', error);
    return c.json({ error: error?.message || 'Failed to create portfolio' }, 500);
  }
});

// ============== Update ==============

portfoliosRoutes.put('/portfolios/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowPortfolioRole(userId, id, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const body = await c.req.json<{
      name?: string;
      description?: string | null;
      strategy?: string | null;
      status?: PortfolioStatus;
      metadata?: Record<string, unknown>;
      expectedVersion?: number;
    }>();
    const portfolio = await updatePortfolio(id, {
      name: body.name,
      description: body.description,
      strategy: body.strategy,
      status: body.status,
      metadata: body.metadata,
      expectedVersion: body.expectedVersion,
    });
    return c.json({ portfolio });
  } catch (error: any) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    console.error('updatePortfolio error:', error);
    return c.json({ error: error?.message || 'Failed to update portfolio' }, 500);
  }
});

// ============== Delete ==============

portfoliosRoutes.delete('/portfolios/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowPortfolioRole(userId, id, 'owner');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const deleted = await deletePortfolio(id);
    if (!deleted) return c.json({ error: 'Portfolio nicht gefunden' }, 404);
    return c.json({ ok: true });
  } catch (error) {
    console.error('deletePortfolio error:', error);
    return c.json({ error: 'Failed to delete portfolio' }, 500);
  }
});

// ============== Projects of Portfolio ==============

portfoliosRoutes.get('/portfolios/:id/projekte', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowPortfolioRole(userId, id, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    // RBAC: nur Projekte, auf die der User Auftrags-Viewer+-Rolle hat.
    // Portfolio-ID-Zuordnung schliesst die Projekte ein, aber der einzelne
    // Auftrag kann andere Permissions haben.
    const all = await listProjekteByPortfolio(id);
    const withRoles = await Promise.all(
      all.map(async (p) => {
        const role = await getEffectiveAuftragRole(userId, p.id);
        return role ? { ...p, role } : null;
      }),
    );
    const projekte = withRoles.filter((p): p is NonNullable<typeof p> => p !== null);
    return c.json({ projekte });
  } catch (error) {
    console.error('list portfolio projekte error:', error);
    return c.json({ error: 'Failed to list portfolio projekte' }, 500);
  }
});

portfoliosRoutes.get('/portfolios/:id/projekte/available', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowPortfolioRole(userId, id, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    // Projekte ohne Portfolio + RBAC-Filter (Auftrags-Viewer+ erforderlich).
    const candidates = await listProjekteWithoutPortfolio();
    const accessible = await Promise.all(
      candidates.map(async (p) => {
        const role = await getEffectiveAuftragRole(userId, p.id);
        return role ? p : null;
      }),
    );
    const projekte = accessible.filter((p): p is NonNullable<typeof p> => p !== null);
    return c.json({ projekte });
  } catch (error) {
    console.error('list available projekte error:', error);
    return c.json({ error: 'Failed to list available projekte' }, 500);
  }
});

// ============== Dashboard ==============

portfoliosRoutes.get('/portfolios/:id/dashboard', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowPortfolioRole(userId, id, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const dashboard = await getPortfolioDashboard(id, userId);
    if (!dashboard) return c.json({ error: 'Portfolio nicht gefunden' }, 404);
    return c.json({ dashboard });
  } catch (error) {
    console.error('getPortfolioDashboard error:', error);
    return c.json({ error: 'Failed to get portfolio dashboard' }, 500);
  }
});
