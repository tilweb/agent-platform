/**
 * VSM Routes
 * REST API endpoints for Value Stream Mapping
 */

import { Hono } from 'hono';
import {
  createProjekt,
  listProjekte,
  getProjektDetails,
  updateProjekt,
  updateVsmData,
  removeProjekt,
  getStats,
} from './service';
import { analyzeVsm } from './analysis';
import type { VsmProjektFilters } from './types';
import { requireAppAccess } from '../permissions-middleware';
import { getCurrentUserId } from '../../auth/middleware';

const vsm = new Hono();

// Berechtigungs-Pruefung
vsm.use('*', requireAppAccess('vsm'));

// ============== Stats ==============

vsm.get('/stats', async (c) => {
  try {
    const stats = await getStats();
    return c.json({ stats });
  } catch (error) {
    console.error('Error fetching VSM stats:', error);
    return c.json({ error: 'Failed to fetch stats' }, 500);
  }
});

// ============== Projekte CRUD ==============

/**
 * GET /api/apps/vsm/projekte
 */
vsm.get('/projekte', async (c) => {
  try {
    const filters: VsmProjektFilters = {
      search: c.req.query('search') || undefined,
      status: c.req.query('status') || undefined,
    };
    const projekte = await listProjekte(filters);
    return c.json({ projekte });
  } catch (error) {
    console.error('Error listing VSM projects:', error);
    return c.json({ error: 'Failed to list projects' }, 500);
  }
});

/**
 * POST /api/apps/vsm/projekte
 */
vsm.post('/projekte', async (c) => {
  try {
    const body = await c.req.json();
    const userId = getCurrentUserId(c) ?? 'system';
    const projekt = await createProjekt(body, userId);
    return c.json({ projekt }, 201);
  } catch (error) {
    console.error('Error creating VSM project:', error);
    return c.json({ error: 'Failed to create project' }, 500);
  }
});

/**
 * GET /api/apps/vsm/projekte/:id
 */
vsm.get('/projekte/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const projekt = await getProjektDetails(id);
    if (!projekt) {
      return c.json({ error: 'Project not found' }, 404);
    }
    return c.json({ projekt });
  } catch (error) {
    console.error('Error fetching VSM project:', error);
    return c.json({ error: 'Failed to fetch project' }, 500);
  }
});

/**
 * PUT /api/apps/vsm/projekte/:id
 */
vsm.put('/projekte/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const userId = getCurrentUserId(c) ?? 'system';
    const projekt = await updateProjekt(id, body, userId);
    if (!projekt) {
      return c.json({ error: 'Project not found' }, 404);
    }
    return c.json({ projekt });
  } catch (error) {
    console.error('Error updating VSM project:', error);
    return c.json({ error: 'Failed to update project' }, 500);
  }
});

/**
 * DELETE /api/apps/vsm/projekte/:id
 */
vsm.delete('/projekte/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await removeProjekt(id);
    if (!deleted) {
      return c.json({ error: 'Project not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting VSM project:', error);
    return c.json({ error: 'Failed to delete project' }, 500);
  }
});

// ============== VSM Data Sections ==============

/**
 * PUT /api/apps/vsm/projekte/:id/data/:section
 * Update a specific VSM data section
 */
vsm.put('/projekte/:id/data/:section', async (c) => {
  try {
    const id = c.req.param('id');
    const section = c.req.param('section');
    const body = await c.req.json();
    const userId = getCurrentUserId(c) ?? 'system';

    const projekt = await updateVsmData(id, section, body.data, userId);
    if (!projekt) {
      return c.json({ error: 'Project not found' }, 404);
    }
    return c.json({ projekt });
  } catch (error) {
    console.error('Error updating VSM data section:', error);
    const message = error instanceof Error ? error.message : 'Failed to update section';
    return c.json({ error: message }, 400);
  }
});

// ============== Analysis ==============

/**
 * POST /api/apps/vsm/projekte/:id/analyse
 * Run AI analysis on VSM data
 */
vsm.post('/projekte/:id/analyse', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = getCurrentUserId(c) ?? 'system';

    const projekt = await getProjektDetails(id);
    if (!projekt) {
      return c.json({ error: 'Project not found' }, 404);
    }

    // Check if there's enough data to analyze
    const hasProcessSteps = projekt.vsm_data.prozessschritte && projekt.vsm_data.prozessschritte.length > 0;
    if (!hasProcessSteps) {
      return c.json({ error: 'Mindestens ein Prozessschritt muss erfasst sein' }, 400);
    }

    // Run analysis
    const ergebnis = await analyzeVsm(projekt, userId);

    // Save result
    const updated = await updateProjekt(id, {
      analyse_ergebnis: ergebnis,
      status: 'analyse',
    }, userId);

    return c.json({ analyse: ergebnis, projekt: updated });
  } catch (error) {
    console.error('Error analyzing VSM:', error);
    return c.json({ error: 'Analyse fehlgeschlagen' }, 500);
  }
});

export { vsm as vsmRoutes };
