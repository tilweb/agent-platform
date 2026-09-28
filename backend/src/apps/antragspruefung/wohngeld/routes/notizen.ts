/**
 * Wohngeld — Notizen je Sektion/Person (WP4), Adapter auf den Antrag-Kern.
 *
 *  - GET    /vorgaenge/:id/notizen  → { notizen }
 *  - POST   /vorgaenge/:id/notizen  { anker, text } → { notiz }
 *  - DELETE /notizen/:id            → { ok }
 *
 * Mechanik liegt in `apps/_antrag-kern/notizen.ts`.
 */
import { notizenStore, getVorgang } from '../storage';
import { createNotizenRoutes } from '../../kern/notizen';
import { denyIfNotAppEditor, denyIfVorgangEingeschraenkt } from './_shared';
import { audit } from '../audit';

export const notizenRoutes = createNotizenRoutes({
  store: notizenStore,
  vorgangExistiert: async (id) => !!(await getVorgang(id)),
  guards: { denyIfNotAppEditor, denyIfVorgangEingeschraenkt },
  audit,
});
