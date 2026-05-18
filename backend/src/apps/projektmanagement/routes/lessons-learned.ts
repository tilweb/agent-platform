/**
 * Routes fuer Lessons Learned (Phase E).
 *
 * Sub-Resource am Projektauftrag (= Projekt-ID nach Phase A). Permissions
 * erben vom Auftrag — Viewer liest, Editor+ schreibt/loescht.
 *
 * `/suggest`-Endpoint ruft den LLM-Coach via `withLlmTimeout` (30s). Bei
 * Timeout antwortet das Endpoint mit 504. Vorschlaege werden nicht
 * persistiert — der User entscheidet pro Vorschlag, ob er ihn als echte
 * LL anlegt.
 */

import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { VersionConflictError } from '../concurrency';
import { LlmTimeoutError } from '../llm-utils';
import {
  listLessonsLearned,
  getLessonLearned,
  createLessonLearned,
  updateLessonLearned,
  deleteLessonLearned,
  suggestLessonsLearnedFromStatusberichte,
} from '../lessons-learned-service';
import { denyIfBelowAuftragRole } from './_shared';

export const lessonsLearnedRoutes = new Hono();

lessonsLearnedRoutes.get('/projektauftraege/:projektId/lessons-learned', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const lessons = await listLessonsLearned(projektId);
    return c.json({ lessons });
  } catch (error) {
    console.error('Error listing lessons-learned:', error);
    return c.json({ error: 'Failed to list lessons-learned' }, 500);
  }
});

lessonsLearnedRoutes.get('/projektauftraege/:projektId/lessons-learned/:llId', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const llId = c.req.param('llId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'viewer');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const lesson = await getLessonLearned(projektId, llId);
    if (!lesson) return c.json({ error: 'Lesson Learned nicht gefunden' }, 404);
    return c.json({ lesson });
  } catch (error) {
    console.error('Error getting lesson-learned:', error);
    return c.json({ error: 'Failed to get lesson-learned' }, 500);
  }
});

lessonsLearnedRoutes.post('/projektauftraege/:projektId/lessons-learned', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const body = await c.req.json();
    if (!body?.title || typeof body.title !== 'string') {
      return c.json({ error: '`title` ist erforderlich' }, 400);
    }
    const lesson = await createLessonLearned(projektId, {
      title: body.title,
      themengebiet: body.themengebiet,
      kategorie: body.kategorie,
      beschreibung: body.beschreibung,
      auswirkung: body.auswirkung,
      empfehlung: body.empfehlung,
    }, userId);
    return c.json({ lesson }, 201);
  } catch (error) {
    console.error('Error creating lesson-learned:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to create lesson-learned' }, 500);
  }
});

lessonsLearnedRoutes.put('/projektauftraege/:projektId/lessons-learned/:llId', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const llId = c.req.param('llId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const body = await c.req.json();
    const lesson = await updateLessonLearned(projektId, llId, {
      title: body.title,
      themengebiet: body.themengebiet,
      kategorie: body.kategorie,
      beschreibung: body.beschreibung,
      auswirkung: body.auswirkung,
      empfehlung: body.empfehlung,
      expectedVersion: body.expectedVersion,
    });
    return c.json({ lesson });
  } catch (error) {
    if (error instanceof VersionConflictError) {
      return c.json({ error: 'version_conflict', current: error.current }, 409);
    }
    if (error instanceof Error && /nicht gefunden/.test(error.message)) {
      return c.json({ error: error.message }, 404);
    }
    console.error('Error updating lesson-learned:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to update lesson-learned' }, 500);
  }
});

lessonsLearnedRoutes.delete('/projektauftraege/:projektId/lessons-learned/:llId', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const llId = c.req.param('llId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const ok = await deleteLessonLearned(projektId, llId);
    if (!ok) return c.json({ error: 'Lesson Learned nicht gefunden' }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting lesson-learned:', error);
    return c.json({ error: 'Failed to delete lesson-learned' }, 500);
  }
});

/**
 * POST /api/apps/projektmanagement/projektauftraege/:projektId/lessons-learned/suggest
 * Erzeugt LL-Vorschlaege via LLM aus den letzten Statusberichten.
 * Nicht persistiert — User klickt im UI auf "Uebernehmen" pro Vorschlag.
 */
lessonsLearnedRoutes.post('/projektauftraege/:projektId/lessons-learned/suggest', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const denied = await denyIfBelowAuftragRole(userId, projektId, 'editor');
    if (denied) return c.json({ error: denied.error }, denied.status);

    const suggestions = await suggestLessonsLearnedFromStatusberichte(projektId, userId);
    return c.json({ suggestions });
  } catch (error) {
    if (error instanceof LlmTimeoutError) {
      console.warn('LLM-Timeout bei lessons-learned suggest:', error.message);
      return c.json({ error: 'LLM-Aufruf hat zu lange gedauert. Bitte erneut versuchen.' }, 504);
    }
    console.error('Error suggesting lessons-learned:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to suggest lessons-learned' }, 500);
  }
});
