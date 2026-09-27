import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { listAkten, getAkte, createAkte, updateAkte, deleteAkte, listVorgaenge } from '../storage';
import { VersionConflictError } from '../concurrency';
import { denyIfNotAppEditor } from './_shared';
import { audit, auditUpdate } from '../audit';

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
  const body = await c.req.json<{ name?: string; [k: string]: unknown }>().catch(() => null);
  if (!body?.name?.trim()) return c.json({ error: 'name ist erforderlich' }, 400);
  const { permissions: _p, id: _i, version: _v, ...rest } = body;
  void _p; void _i; void _v;
  const akte = await createAkte({ ...rest, name: body.name.trim(), ownerId: getCurrentUserId(c) });
  await audit(c, { aktion: 'akte.erstellt', objektTyp: 'akte', objektId: akte.id, detail: akte.name });
  return c.json({ akte }, 201);
});

aktenRoutes.put('/akten/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).permissions;
    delete (updates as Record<string, unknown>).ownerId;
    const before = await getAkte(c.req.param('id'));
    const akte = await updateAkte(c.req.param('id'), updates, { expectedVersion, force });
    if (!akte) return c.json({ error: 'Akte nicht gefunden' }, 404);
    await auditUpdate(c, {
      aktion: 'akte.geaendert', objektTyp: 'akte', objektId: akte.id,
      before, after: akte, felder: ['name', 'antragstellerName', 'strasse', 'hausnummer', 'plz', 'ort'],
    });
    return c.json({ akte });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

aktenRoutes.delete('/akten/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const id = c.req.param('id');
  const before = await getAkte(id);
  if (!before) return c.json({ error: 'Akte nicht gefunden' }, 404);
  // Legal Hold / Einschränkung eines enthaltenen Vorgangs sperrt die Löschung der ganzen Akte.
  const vorgaenge = await listVorgaenge({ akteId: id });
  if (vorgaenge.some((v) => v.legalHold || v.eingeschraenkt)) {
    return c.json({ error: 'Löschung gesperrt: Ein Vorgang der Akte hat einen Legal Hold oder ist eingeschränkt.' }, 409);
  }
  const ok = await deleteAkte(id);
  if (ok) await audit(c, { aktion: 'akte.geloescht', objektTyp: 'akte', objektId: id, detail: `${before.name} · ${vorgaenge.length} Vorgang/Vorgänge` });
  return ok ? c.json({ ok: true }) : c.json({ error: 'Akte nicht gefunden' }, 404);
});
