/**
 * Prozess-CRUD + Baustand-/Artefakt-Liste je Prozess.
 */
import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import {
  getProzess, createProzess, updateProzess, deleteProzess,
  getKunde, listBaustaende, listArtefakte,
} from '../storage';
import { VersionConflictError } from '../concurrency';
import { denyIfNotAppEditor } from './_shared';
import { lvarFuerProzess } from '../lvar/service';
import { sanitizeStand } from '../lvar/stand';

export const prozesseRoutes = new Hono();

/** L-VAR-Explorer (Reiter 1 NK/Kopplung · 2 Steckbriefe · 3 CFG) einer Prozess-Familie. */
prozesseRoutes.get('/prozesse/:id/lvar', async (c) => {
  const lvar = await lvarFuerProzess(c.req.param('id'));
  return c.json({ lvar });
});

/** Menschlichen L-VAR-Arbeitsstand (abhaken/Feedback/Status) speichern — Optimistic-Locking. */
prozesseRoutes.put('/prozesse/:id/lvar-stand', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ stand?: unknown; expectedVersion?: number; force?: boolean }>();
    const prozess = await updateProzess(
      c.req.param('id'),
      { lvarStand: sanitizeStand(body?.stand) } as never,
      { expectedVersion: body?.expectedVersion, force: body?.force },
    );
    if (!prozess) return c.json({ error: 'Prozess nicht gefunden' }, 404);
    return c.json({ version: prozess.version });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: (err.current as { version?: number })?.version }, 409);
    return c.json({ error: 'Stand speichern fehlgeschlagen' }, 500);
  }
});

prozesseRoutes.get('/prozesse/:id', async (c) => {
  const prozess = await getProzess(c.req.param('id'));
  if (!prozess) return c.json({ error: 'Prozess nicht gefunden' }, 404);
  return c.json({ prozess });
});

prozesseRoutes.get('/prozesse/:id/baustaende', async (c) => {
  const prozess = await getProzess(c.req.param('id'));
  if (!prozess) return c.json({ error: 'Prozess nicht gefunden' }, 404);
  const baustaende = await listBaustaende(c.req.param('id'));
  return c.json({ baustaende });
});

prozesseRoutes.get('/prozesse/:id/artefakte', async (c) => {
  const artefakte = await listArtefakte(c.req.param('id'));
  return c.json({ artefakte });
});

prozesseRoutes.post('/prozesse', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const body = await c.req.json<{ kundeId?: string; name?: string; emmaPlanNr?: string; beschreibung?: string; systeme?: string[] }>();
  if (!body?.kundeId) return c.json({ error: 'kundeId ist erforderlich' }, 400);
  if (!body?.name?.trim()) return c.json({ error: 'name ist erforderlich' }, 400);
  const kunde = await getKunde(body.kundeId);
  if (!kunde) return c.json({ error: 'Kunde nicht gefunden' }, 404);
  const prozess = await createProzess({
    kundeId: body.kundeId, name: body.name.trim(), emmaPlanNr: body.emmaPlanNr,
    beschreibung: body.beschreibung, systeme: body.systeme, ownerId: getCurrentUserId(c),
  });
  return c.json({ prozess }, 201);
});

prozesseRoutes.put('/prozesse/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).permissions;
    delete (updates as Record<string, unknown>).kundeId;
    const prozess = await updateProzess(c.req.param('id'), updates, { expectedVersion, force });
    if (!prozess) return c.json({ error: 'Prozess nicht gefunden' }, 404);
    return c.json({ prozess });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

prozesseRoutes.delete('/prozesse/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const ok = await deleteProzess(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Prozess nicht gefunden' }, 404);
});
