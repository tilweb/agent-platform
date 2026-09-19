import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import {
  listSchreiben, getSchreiben, createSchreiben, updateSchreiben, deleteSchreiben,
  getVorgang, listPersonen, listPruefschritte, addAktivitaet,
} from '../storage';
import { VersionConflictError } from '../concurrency';
import { generiereAnforderungsschreiben } from '../schreiben-generator';
import { denyIfNotAppEditor } from './_shared';

export const schreibenRoutes = new Hono();

schreibenRoutes.get('/vorgaenge/:vorgangId/schreiben', async (c) => {
  return c.json({ schreiben: await listSchreiben(c.req.param('vorgangId')) });
});

schreibenRoutes.get('/schreiben/:id', async (c) => {
  const schreiben = await getSchreiben(c.req.param('id'));
  if (!schreiben) return c.json({ error: 'Schreiben nicht gefunden' }, 404);
  return c.json({ schreiben });
});

/**
 * Anforderungsschreiben aus den offenen Prüfschritten (Typ „anforderung") generieren.
 * Erzeugt einen Entwurf (deterministischer Text), den die Sachbearbeitung editieren kann.
 */
schreibenRoutes.post('/vorgaenge/:vorgangId/schreiben/generieren', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  const vorgang = await getVorgang(vorgangId);
  if (!vorgang) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const body = await c.req.json<{ art?: string; fristTage?: number }>().catch(() => ({} as { art?: string; fristTage?: number }));
  const [personen, pruefschritte] = await Promise.all([listPersonen(vorgangId), listPruefschritte(vorgangId)]);
  const entwurf = generiereAnforderungsschreiben(vorgang, personen, pruefschritte, {
    art: (body?.art as never) ?? 'erstanforderung',
    fristTage: body?.fristTage ?? 14,
  });
  const schreiben = await createSchreiben({ vorgangId, ...entwurf });
  await addAktivitaet({ vorgangId, typ: 'schreiben', akteur: getCurrentUserId(c), beschreibung: 'Anforderungsschreiben generiert' });
  return c.json({ schreiben }, 201);
});

schreibenRoutes.put('/schreiben/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  try {
    const body = await c.req.json<{ expectedVersion?: number; force?: boolean; [k: string]: unknown }>();
    const { expectedVersion, force, ...updates } = body ?? {};
    delete (updates as Record<string, unknown>).vorgangId;
    const schreiben = await updateSchreiben(c.req.param('id'), updates, { expectedVersion, force });
    if (!schreiben) return c.json({ error: 'Schreiben nicht gefunden' }, 404);
    return c.json({ schreiben });
  } catch (err) {
    if (err instanceof VersionConflictError) return c.json({ error: 'version_conflict', current: err.current }, 409);
    return c.json({ error: 'Update fehlgeschlagen' }, 500);
  }
});

schreibenRoutes.delete('/schreiben/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const ok = await deleteSchreiben(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Schreiben nicht gefunden' }, 404);
});
