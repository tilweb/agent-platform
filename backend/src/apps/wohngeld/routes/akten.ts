import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { listAkten, getAkte, createAkte, updateAkte, deleteAkte, listVorgaenge } from '../storage';
import { VersionConflictError } from '../concurrency';
import { denyIfNotAppEditor } from './_shared';

export const aktenRoutes = new Hono();

aktenRoutes.get('/akten', async (c) => {
  return c.json({ akten: await listAkten() });
});

aktenRoutes.get('/akten/:id', async (c) => {
  const akte = await getAkte(c.req.param('id'));
  if (!akte) return c.json({ error: 'Akte nicht gefunden' }, 404);
  return c.json({ akte });
});

aktenRoutes.get('/akten/:id/vorgaenge', async (c) => {
  const akte = await getAkte(c.req.param('id'));
  if (!akte) return c.json({ error: 'Akte nicht gefunden' }, 404);
  return c.json({ vorgaenge: await listVorgaenge({ akteId: akte.id }) });
});

aktenRoutes.post('/akten', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const body = await c.req.json<{ name?: string; [k: string]: unknown }>();
  if (!body?.name?.trim()) return c.json({ error: 'name ist erforderlich' }, 400);
  const akte = await createAkte({ ...body, name: body.name.trim(), ownerId: getCurrentUserId(c) });
  return c.json({ akte }, 201);
});

aktenRoutes.put('/akten/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).permissions;
    const akte = await updateAkte(c.req.param('id'), updates, { expectedVersion, force });
    if (!akte) return c.json({ error: 'Akte nicht gefunden' }, 404);
    return c.json({ akte });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

aktenRoutes.delete('/akten/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const ok = await deleteAkte(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Akte nicht gefunden' }, 404);
});
