import { Hono } from 'hono';
import { listPersonen, getPerson, createPerson, updatePerson, deletePerson, getVorgang } from '../storage';
import { VersionConflictError } from '../concurrency';
import { denyIfNotAppEditor } from './_shared';

export const personenRoutes = new Hono();

personenRoutes.get('/vorgaenge/:vorgangId/personen', async (c) => {
  return c.json({ personen: await listPersonen(c.req.param('vorgangId')) });
});

personenRoutes.get('/personen/:id', async (c) => {
  const person = await getPerson(c.req.param('id'));
  if (!person) return c.json({ error: 'Person nicht gefunden' }, 404);
  return c.json({ person });
});

personenRoutes.post('/vorgaenge/:vorgangId/personen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  if (!(await getVorgang(vorgangId))) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const body = await c.req.json<Record<string, unknown>>();
  const person = await createPerson({ ...body, vorgangId });
  return c.json({ person }, 201);
});

personenRoutes.put('/personen/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).vorgangId;
    const person = await updatePerson(c.req.param('id'), updates, { expectedVersion, force });
    if (!person) return c.json({ error: 'Person nicht gefunden' }, 404);
    return c.json({ person });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

personenRoutes.delete('/personen/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const ok = await deletePerson(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Person nicht gefunden' }, 404);
});
