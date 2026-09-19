import { Hono } from 'hono';
import { listPersonen, getPerson, createPerson, updatePerson, deletePerson, getVorgang } from '../storage';
import { VersionConflictError } from '../concurrency';
import { denyIfNotAppEditor } from './_shared';
import { audit, auditUpdate } from '../audit';

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
  await audit(c, {
    aktion: 'person.erstellt', objektTyp: 'person', objektId: person.id, vorgangId,
    detail: [person.vorname, person.nachname].filter(Boolean).join(' ') || undefined,
  });
  return c.json({ person }, 201);
});

personenRoutes.put('/personen/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).vorgangId;
    const before = await getPerson(c.req.param('id'));
    const person = await updatePerson(c.req.param('id'), updates, { expectedVersion, force });
    if (!person) return c.json({ error: 'Person nicht gefunden' }, 404);
    await auditUpdate(c, {
      aktion: 'person.geaendert', objektTyp: 'person', objektId: person.id, vorgangId: person.vorgangId,
      before, after: person, felder: ['rolle', 'nachname', 'vorname', 'geburtsdatum', 'erwerbsstatus'],
    });
    return c.json({ person });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

personenRoutes.delete('/personen/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const id = c.req.param('id');
  const before = await getPerson(id);
  const ok = await deletePerson(id);
  if (ok) await audit(c, {
    aktion: 'person.geloescht', objektTyp: 'person', objektId: id, vorgangId: before?.vorgangId,
    detail: before ? [before.vorname, before.nachname].filter(Boolean).join(' ') || undefined : undefined,
  });
  return ok ? c.json({ ok: true }) : c.json({ error: 'Person nicht gefunden' }, 404);
});
