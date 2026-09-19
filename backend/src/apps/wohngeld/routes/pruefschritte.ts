import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import {
  listPruefschritte, getPruefschritt, createPruefschritt, updatePruefschritt, deletePruefschritt,
  getVorgang, addAktivitaet,
} from '../storage';
import { VersionConflictError } from '../concurrency';
import { denyIfNotAppEditor } from './_shared';

export const pruefschritteRoutes = new Hono();

pruefschritteRoutes.get('/vorgaenge/:vorgangId/pruefschritte', async (c) => {
  return c.json({ pruefschritte: await listPruefschritte(c.req.param('vorgangId')) });
});

/** Manuell ergänzter Prüfschritt / Anforderung. */
pruefschritteRoutes.post('/vorgaenge/:vorgangId/pruefschritte', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  if (!(await getVorgang(vorgangId))) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const body = await c.req.json<{ titel?: string; [k: string]: unknown }>();
  if (!body?.titel?.trim()) return c.json({ error: 'titel ist erforderlich' }, 400);
  const pruefschritt = await createPruefschritt({ ...body, vorgangId, titel: body.titel.trim() });
  return c.json({ pruefschritt }, 201);
});

/** Status/Details ändern (z. B. Sachbearbeitung setzt „erledigt"/„verworfen"). */
pruefschritteRoutes.put('/pruefschritte/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).vorgangId;
    const before = await getPruefschritt(c.req.param('id'));
    const pruefschritt = await updatePruefschritt(c.req.param('id'), updates, { expectedVersion, force });
    if (!pruefschritt) return c.json({ error: 'Prüfschritt nicht gefunden' }, 404);
    if (before && updates.status && updates.status !== before.status) {
      await addAktivitaet({
        vorgangId: pruefschritt.vorgangId, typ: 'pruefschritt',
        akteur: getCurrentUserId(c),
        beschreibung: `Prüfschritt „${pruefschritt.titel}" → ${updates.status}`,
      });
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
  const ok = await deletePruefschritt(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Prüfschritt nicht gefunden' }, 404);
});
