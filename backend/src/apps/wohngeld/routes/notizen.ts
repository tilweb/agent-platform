/**
 * Wohngeld — Notizen je Sektion/Person (WP4).
 *
 *  - GET    /vorgaenge/:id/notizen  → { notizen }
 *  - POST   /vorgaenge/:id/notizen  { anker, text } → { notiz }
 *  - DELETE /notizen/:id            → { ok }
 */
import { Hono } from 'hono';
import { getCurrentUserId } from '../../../auth/middleware';
import { listNotizen, addNotiz, loescheNotiz, getVorgang } from '../storage';
import { denyIfNotAppEditor } from './_shared';

export const notizenRoutes = new Hono();

notizenRoutes.get('/vorgaenge/:vorgangId/notizen', async (c) => {
  return c.json({ notizen: await listNotizen(c.req.param('vorgangId')) });
});

notizenRoutes.post('/vorgaenge/:vorgangId/notizen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  if (!(await getVorgang(vorgangId))) return c.json({ error: 'Vorgang nicht gefunden' }, 404);
  const body = await c.req.json<{ anker?: string; text?: string }>().catch(() => null);
  if (!body?.anker?.trim()) return c.json({ error: 'anker ist erforderlich' }, 400);
  if (!body?.text?.trim()) return c.json({ error: 'text ist erforderlich' }, 400);
  const notiz = await addNotiz({
    vorgangId, anker: body.anker.trim(), text: body.text.trim(), autor: getCurrentUserId(c),
  });
  return c.json({ notiz }, 201);
});

notizenRoutes.delete('/notizen/:id', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const ok = await loescheNotiz(c.req.param('id'));
  return ok ? c.json({ ok: true }) : c.json({ error: 'Notiz nicht gefunden' }, 404);
});
