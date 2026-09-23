/**
 * Wohngeld — Feld-Provenienz (WP3): KI-Vorschlag-Bestätigung auf Feldebene.
 *
 *  - GET    /vorgaenge/:id/feldstatus                     → { feldStatus }
 *  - POST   /vorgaenge/:id/feldstatus/:fsId/bestaetigen   → bestaetigt=true
 *  - POST   /vorgaenge/:id/feldstatus/:fsId/verwerfen     → Feldwert leeren + Status löschen
 *  - POST   /vorgaenge/:id/feldstatus/alle-bestaetigen    → alle offenen bestätigen
 */
import { Hono } from 'hono';
import {
  listFeldStatus, getFeldStatus, bestaetigeFeld, bestaetigeAlle, loescheFeldStatus,
  getVorgang, updateVorgang, getPerson, updatePerson,
} from '../storage';
import { denyIfNotAppEditor, denyIfVorgangEingeschraenkt } from './_shared';
import { audit } from '../audit';
import { vermerkeEntscheidungen } from '../lernbeispiele';
import type { Vorgang } from '../types';

export const feldstatusRoutes = new Hono();

/** Updates-Objekt zum Leeren eines Vorgang-Feldpfads (1–2 Ebenen). */
function clearVorgangUpdates(vorgang: Vorgang, feldPfad: string): Record<string, unknown> {
  if (feldPfad.startsWith('wohnung.')) {
    const key = feldPfad.slice('wohnung.'.length);
    const wohnung: Record<string, unknown> = { ...(vorgang.wohnung || {}) };
    delete wohnung[key];
    return { wohnung };
  }
  // Enums mit NOT-NULL-Default: auf Default zurücksetzen statt NULL.
  if (feldPfad === 'wohngeldart') return { wohngeldart: 'mietzuschuss' };
  if (feldPfad === 'antragsart') return { antragsart: 'erstantrag' };
  return { [feldPfad]: undefined };
}

/** Updates-Objekt zum Leeren eines Person-Feldpfads. */
function clearPersonUpdates(feldPfad: string): Record<string, unknown> {
  // NOT-NULL-Textspalten: auf leeren String setzen.
  if (feldPfad === 'nachname' || feldPfad === 'vorname') return { [feldPfad]: '' };
  return { [feldPfad]: undefined };
}

feldstatusRoutes.get('/vorgaenge/:vorgangId/feldstatus', async (c) => {
  return c.json({ feldStatus: await listFeldStatus(c.req.param('vorgangId')) });
});

feldstatusRoutes.post('/vorgaenge/:vorgangId/feldstatus/:fsId/bestaetigen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const eingeschr = await denyIfVorgangEingeschraenkt(c.req.param('vorgangId'));
  if (eingeschr) return c.json(eingeschr, 403);
  const fs = await bestaetigeFeld(c.req.param('fsId'));
  if (!fs) return c.json({ error: 'Feld-Status nicht gefunden' }, 404);
  await audit(c, { aktion: 'feld.bestaetigt', objektTyp: 'feldstatus', objektId: fs.id, vorgangId: fs.vorgangId, detail: fs.feldPfad });
  await vermerkeEntscheidungen(fs.vorgangId, [fs], 'bestaetigt');
  return c.json({ feldStatus: fs });
});

feldstatusRoutes.post('/vorgaenge/:vorgangId/feldstatus/:fsId/verwerfen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const eingeschr = await denyIfVorgangEingeschraenkt(c.req.param('vorgangId'));
  if (eingeschr) return c.json(eingeschr, 403);
  const fs = await getFeldStatus(c.req.param('fsId'));
  if (!fs) return c.json({ error: 'Feld-Status nicht gefunden' }, 404);

  if (fs.zielTyp === 'vorgang') {
    const vorgang = await getVorgang(fs.zielId);
    if (vorgang) await updateVorgang(fs.zielId, clearVorgangUpdates(vorgang, fs.feldPfad));
  } else if (fs.zielTyp === 'person') {
    const person = await getPerson(fs.zielId);
    if (person) await updatePerson(fs.zielId, clearPersonUpdates(fs.feldPfad));
  }
  await loescheFeldStatus(fs.id);
  await vermerkeEntscheidungen(fs.vorgangId, [fs], 'verworfen');
  await audit(c, { aktion: 'feld.verworfen', objektTyp: 'feldstatus', objektId: fs.id, vorgangId: fs.vorgangId, detail: fs.feldPfad });
  return c.json({ ok: true });
});

feldstatusRoutes.post('/vorgaenge/:vorgangId/feldstatus/alle-bestaetigen', async (c) => {
  const denied = denyIfNotAppEditor(c);
  if (denied) return c.json(denied, 403);
  const vorgangId = c.req.param('vorgangId');
  const eingeschr = await denyIfVorgangEingeschraenkt(vorgangId);
  if (eingeschr) return c.json(eingeschr, 403);
  const offenVorher = (await listFeldStatus(vorgangId)).filter((f) => !f.bestaetigt);
  const feldStatus = await bestaetigeAlle(vorgangId);
  await vermerkeEntscheidungen(vorgangId, offenVorher, 'bestaetigt');
  await audit(c, { aktion: 'feld.alle_bestaetigt', objektTyp: 'feldstatus', vorgangId, detail: 'Alle offenen KI-Vorschläge bestätigt' });
  return c.json({ feldStatus });
});
