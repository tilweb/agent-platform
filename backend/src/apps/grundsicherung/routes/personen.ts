import { Hono } from 'hono';
import { listPersonen, getPerson, createPerson, updatePerson, deletePerson, getVorgang } from '../storage';
import { VersionConflictError } from '../concurrency';
import { denyIfNotAppEditor, denyIfEingeschraenkt, denyIfVorgangEingeschraenkt } from './_shared';
import { audit, auditUpdate } from '../audit';
import { pruefeAutomatisch } from '../pruefung';
import { PERSON_ROLLEN, type Person } from '../types';

export const personenRoutes = new Hono();

/** Kernfelder einer Person, deren Änderung im Protokoll als Diff erscheint. */
const PERSON_AUDIT_FELDER: Array<keyof Person & string> = [
  'rolle', 'nachname', 'vorname', 'geburtsdatum', 'familienstand', 'staatsangehoerigkeit', 'betreuung',
  'erwerbsminderung', 'schwerbehinderung', 'mehrbedarf_ernaehrung', 'krankenversicherung',
  'einkommen', 'vermoegen', 'unterhalt_kinder_eltern',
];

function ohneSystemfelder(body: Record<string, unknown>): Record<string, unknown> {
  const { id: _i, vorgangId: _v, version: _ve, created_at: _c, updated_at: _u, ...rest } = body;
  void _i; void _v; void _ve; void _c; void _u;
  return rest;
}

personenRoutes.get('/vorgaenge/:vorgangId/personen', async (c) => {
  return c.json({ personen: await listPersonen(c.req.param('vorgangId')) });
});

personenRoutes.get('/personen/:id', async (c) => {
  const person = await getPerson(c.req.param('id'));
  if (!person) return c.json({ error: 'Person nicht gefunden' }, 404);
  return c.json({ person });
});

// TODO(G3): Betroffenenauskunft Art. 15/20 DSGVO — GET /personen/:id/auskunft/export (PDF/JSON,
// Editor-Gate, auditiert `person.auskunft_exportiert`) nach Vorbild wohngeld/auskunft-export.ts,
// mit den Grundsicherungs-Inhalten (Einkommen, Vermögen, KV, Schwerbehinderung, Unterhalt).

personenRoutes.post('/vorgaenge/:vorgangId/personen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const eingeschr = denyIfEingeschraenkt(vorgang);
  if (eingeschr) return c.json(eingeschr, 403);
  const body = ohneSystemfelder((await c.req.json<Record<string, unknown>>().catch(() => null)) ?? {});
  if (body.rolle !== undefined && !PERSON_ROLLEN.includes(body.rolle as Person['rolle'])) return c.json({ error: 'Unbekannte Rolle' }, 400);
  const person = await createPerson({ ...(body as Partial<Person>), vorgangId });
  await audit(c, {
    aktion: 'person.erstellt', objektTyp: 'person', objektId: person.id, vorgangId,
    detail: [person.vorname, person.nachname].filter(Boolean).join(' ') || undefined,
  });
  await pruefeAutomatisch(vorgangId);
  return c.json({ person }, 201);
});

personenRoutes.put('/personen/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...rest } = body ?? {};
    const updates = ohneSystemfelder(rest) as Partial<Person>;
    if (updates.rolle !== undefined && !PERSON_ROLLEN.includes(updates.rolle)) return c.json({ error: 'Unbekannte Rolle' }, 400);
    const before = await getPerson(c.req.param('id'));
    if (!before) return c.json({ error: 'Person nicht gefunden' }, 404);
    const eingeschr = await denyIfVorgangEingeschraenkt(before.vorgangId);
    if (eingeschr) return c.json(eingeschr, 403);
    const person = await updatePerson(before.id, updates, { expectedVersion, force });
    if (!person) return c.json({ error: 'Person nicht gefunden' }, 404);
    await auditUpdate(c, {
      aktion: 'person.geaendert', objektTyp: 'person', objektId: person.id, vorgangId: person.vorgangId,
      before, after: person, felder: PERSON_AUDIT_FELDER,
    });
    await pruefeAutomatisch(person.vorgangId);
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
  if (!before) return c.json({ error: 'Person nicht gefunden' }, 404);
  const eingeschr = await denyIfVorgangEingeschraenkt(before.vorgangId);
  if (eingeschr) return c.json(eingeschr, 403);
  const ok = await deletePerson(id);
  if (ok) {
    await audit(c, {
      aktion: 'person.geloescht', objektTyp: 'person', objektId: id, vorgangId: before.vorgangId,
      detail: [before.vorname, before.nachname].filter(Boolean).join(' ') || undefined,
    });
    await pruefeAutomatisch(before.vorgangId);
  }
  return ok ? c.json({ ok: true }) : c.json({ error: 'Person nicht gefunden' }, 404);
});
