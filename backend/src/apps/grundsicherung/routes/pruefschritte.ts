import { Hono } from 'hono';
import {
  listPruefschritte, getPruefschritt, createPruefschritt, updatePruefschritt, deletePruefschritt, getVorgang,
} from '../storage';
import { VersionConflictError } from '../concurrency';
import { denyIfNotAppEditor, denyIfEingeschraenkt, denyIfVorgangEingeschraenkt } from './_shared';
import { audit } from '../audit';
import { PRUEF_STATUS, type Pruefschritt } from '../types';

export const pruefschritteRoutes = new Hono();

pruefschritteRoutes.get('/vorgaenge/:vorgangId/pruefschritte', async (c) => {
  return c.json({ pruefschritte: await listPruefschritte(c.req.param('vorgangId')) });
});

/** Manuell ergänzter Prüfschritt / Anforderung (automatisch=false). */
pruefschritteRoutes.post('/vorgaenge/:vorgangId/pruefschritte', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const eingeschr = denyIfEingeschraenkt(vorgang);
  if (eingeschr) return c.json(eingeschr, 403);
  const body = await c.req.json<{ titel?: string; [k: string]: unknown }>().catch(() => null);
  if (!body?.titel?.trim()) return c.json({ error: 'titel ist erforderlich' }, 400);
  const { id: _i, vorgangId: _v, automatisch: _a, version: _ve, ...rest } = body;
  void _i; void _v; void _a; void _ve;
  const pruefschritt = await createPruefschritt({ ...(rest as Partial<Pruefschritt>), vorgangId, titel: body.titel.trim(), automatisch: false });
  await audit(c, { aktion: 'pruefschritt.angelegt', objektTyp: 'pruefschritt', objektId: pruefschritt.id, vorgangId, detail: pruefschritt.titel });
  return c.json({ pruefschritt }, 201);
});

/** Status/Details ändern (z. B. Sachbearbeitung setzt „erledigt"/„verworfen"). */
pruefschritteRoutes.put('/pruefschritte/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    for (const f of ['id', 'vorgangId', 'automatisch', 'regelId', 'version']) delete (updates as Record<string, unknown>)[f];
    if (updates.status !== undefined && !PRUEF_STATUS.includes(updates.status as Pruefschritt['status'])) return c.json({ error: 'Unbekannter Status' }, 400);
    const before = await getPruefschritt(c.req.param('id'));
    if (!before) return c.json({ error: 'Prüfschritt nicht gefunden' }, 404);
    const eingeschr = await denyIfVorgangEingeschraenkt(before.vorgangId);
    if (eingeschr) return c.json(eingeschr, 403);
    const pruefschritt = await updatePruefschritt(before.id, updates as Partial<Pruefschritt>, { expectedVersion, force });
    if (!pruefschritt) return c.json({ error: 'Prüfschritt nicht gefunden' }, 404);
    if (updates.status && updates.status !== before.status) {
      await audit(c, {
        aktion: 'pruefschritt.status_geaendert', objektTyp: 'pruefschritt', objektId: pruefschritt.id, vorgangId: pruefschritt.vorgangId,
        detail: pruefschritt.titel, vorher: { status: before.status }, nachher: { status: pruefschritt.status },
      });
    } else {
      await audit(c, { aktion: 'pruefschritt.geaendert', objektTyp: 'pruefschritt', objektId: pruefschritt.id, vorgangId: pruefschritt.vorgangId, detail: pruefschritt.titel });
    }
    return c.json({ pruefschritt });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

pruefschritteRoutes.delete('/pruefschritte/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const id = c.req.param('id');
  const before = await getPruefschritt(id);
  if (!before) return c.json({ error: 'Prüfschritt nicht gefunden' }, 404);
  const eingeschr = await denyIfVorgangEingeschraenkt(before.vorgangId);
  if (eingeschr) return c.json(eingeschr, 403);
  const ok = await deletePruefschritt(id);
  if (ok) await audit(c, { aktion: 'pruefschritt.geloescht', objektTyp: 'pruefschritt', objektId: id, vorgangId: before.vorgangId, detail: before.titel });
  return ok ? c.json({ ok: true }) : c.json({ error: 'Prüfschritt nicht gefunden' }, 404);
});
