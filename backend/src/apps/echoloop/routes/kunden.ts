/**
 * Kunden-CRUD + Prozess-Liste je Kunde.
 */
import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { listKunden, getKunde, createKunde, updateKunde, deleteKunde, listProzesse } from '../storage';
import { VersionConflictError } from '../concurrency';
import { denyIfNotAppEditor } from './_shared';

export const kundenRoutes = new Hono();

kundenRoutes.get('/kunden', async (c) => {
  const kunden = await listKunden();
  return c.json({ kunden });
});

kundenRoutes.get('/kunden/:id', async (c) => {
  const kunde = await getKunde(c.req.param('id'));
  if (!kunde) return c.json({ error: 'Kunde nicht gefunden' }, 404);
  return c.json({ kunde });
});

kundenRoutes.get('/kunden/:id/prozesse', async (c) => {
  const kunde = await getKunde(c.req.param('id'));
  if (!kunde) return c.json({ error: 'Kunde nicht gefunden' }, 404);
  const prozesse = await listProzesse(c.req.param('id'));
  return c.json({ prozesse });
});

kundenRoutes.post('/kunden', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const body = await c.req.json<{ name?: string; branche?: string; notizen?: string }>();
  if (!body?.name?.trim()) return c.json({ error: 'name ist erforderlich' }, 400);
  const kunde = await createKunde({
    name: body.name.trim(), branche: body.branche, notizen: body.notizen, ownerId: getCurrentUserId(c),
  });
  return c.json({ kunde }, 201);
});

kundenRoutes.put('/kunden/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).permissions;
    const kunde = await updateKunde(c.req.param('id'), updates, { expectedVersion, force });
    if (!kunde) return c.json({ error: 'Kunde nicht gefunden' }, 404);
    return c.json({ kunde });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

kundenRoutes.delete('/kunden/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const ok = await deleteKunde(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Kunde nicht gefunden' }, 404);
});
