/**
 * Grundsicherung — Feld-Provenienz (Adapter auf den Antrag-Kern).
 * Hooks: beim Verwerfen Feldwert leeren; nach jeder Entscheidung automatische Neuprüfung.
 */
import { feldStatusStore, getVorgang, updateVorgang, getPerson, updatePerson } from '../storage';
import { createFeldstatusRoutes } from '../../_antrag-kern/feldstatus';
import { denyIfNotAppEditor, denyIfVorgangEingeschraenkt } from './_shared';
import { audit } from '../audit';
import { pruefeAutomatisch } from '../pruefung';
import { leereFeldUpdates, PERSON_FELD_DEFAULTS, VORGANG_FELD_DEFAULTS } from '../feldstatus-hooks';
import type { FeldStatus, FeldStatusZielTyp } from '../types';

/** Verwerfen: vorgeschlagenen Feldwert am Ziel leeren (bzw. auf Default zurücksetzen). */
async function leereFeld(fs: FeldStatus): Promise<void> {
  if (fs.zielTyp === 'vorgang') {
    const vorgang = await getVorgang(fs.zielId);
    if (vorgang) await updateVorgang(fs.zielId, leereFeldUpdates(vorgang as unknown as Record<string, unknown>, fs.feldPfad, VORGANG_FELD_DEFAULTS));
  } else if (fs.zielTyp === 'person') {
    const person = await getPerson(fs.zielId);
    if (person) await updatePerson(fs.zielId, leereFeldUpdates(person as unknown as Record<string, unknown>, fs.feldPfad, PERSON_FELD_DEFAULTS));
  }
}

export const feldstatusRoutes = createFeldstatusRoutes<FeldStatusZielTyp>({
  store: feldStatusStore,
  guards: { denyIfNotAppEditor, denyIfVorgangEingeschraenkt },
  audit,
  beiVerwerfen: leereFeld,
  nachAenderung: async (vorgangId) => { await pruefeAutomatisch(vorgangId); },
});
