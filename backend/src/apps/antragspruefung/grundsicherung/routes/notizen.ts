/**
 * Grundsicherung — Notizen je Sektion/Person (Adapter auf den Antrag-Kern).
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
