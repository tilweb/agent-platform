import { Hono } from 'hono';
import { listDokumente, getDokument, createDokument, updateDokument, deleteDokument, getVorgang } from '../storage';
import { VersionConflictError } from '../concurrency';
import { denyIfNotAppEditor } from './_shared';

export const dokumenteRoutes = new Hono();

dokumenteRoutes.get('/vorgaenge/:vorgangId/dokumente', async (c) => {
  return c.json({ dokumente: await listDokumente(c.req.param('vorgangId')) });
});

dokumenteRoutes.get('/dokumente/:id', async (c) => {
  const dokument = await getDokument(c.req.param('id'));
  if (!dokument) return c.json({ error: 'Dokument nicht gefunden' }, 404);
  return c.json({ dokument });
});

dokumenteRoutes.post('/vorgaenge/:vorgangId/dokumente', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  if (!(await getVorgang(vorgangId))) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const body = await c.req.json<Record<string, unknown>>();
  const dokument = await createDokument({ ...body, vorgangId });
  return c.json({ dokument }, 201);
});

dokumenteRoutes.put('/dokumente/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).vorgangId;
    const dokument = await updateDokument(c.req.param('id'), updates, { expectedVersion, force });
    if (!dokument) return c.json({ error: 'Dokument nicht gefunden' }, 404);
    return c.json({ dokument });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

dokumenteRoutes.delete('/dokumente/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const ok = await deleteDokument(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Dokument nicht gefunden' }, 404);
});
