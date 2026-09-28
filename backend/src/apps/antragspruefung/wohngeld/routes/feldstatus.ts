/**
 * Wohngeld — Feld-Provenienz (WP3): KI-Vorschlag-Bestätigung auf Feldebene
 * (Adapter auf den Antrag-Kern).
 *
 *  - GET    /vorgaenge/:id/feldstatus                     → { feldStatus }
 *  - POST   /vorgaenge/:id/feldstatus/:fsId/bestaetigen   → bestaetigt=true
 *  - POST   /vorgaenge/:id/feldstatus/:fsId/verwerfen     → Feldwert leeren + Status löschen
 *  - POST   /vorgaenge/:id/feldstatus/alle-bestaetigen    → alle offenen bestätigen
 *
 * Mechanik (Gates, Store, Audit, Reihenfolge) liegt in `apps/_antrag-kern/feldstatus.ts`.
 * Hier bleiben die fachlichen Hooks: Feld leeren beim Verwerfen, Einkommen übernehmen,
 * Lernbeispiele, automatische Prüfung.
 */
import {
  feldStatusStore, getVorgang, updateVorgang, getPerson, updatePerson,
} from '../storage';
import { createFeldstatusRoutes } from '../../kern/feldstatus';
import { denyIfNotAppEditor, denyIfVorgangEingeschraenkt } from './_shared';
import { audit } from '../audit';
import { vermerkeEntscheidungen } from '../lernbeispiele';
import type { FeldStatus, FeldStatusZielTyp, Vorgang } from '../types';
import { pruefeAutomatisch } from '../pruefung';

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

/**
 * Bestätigte Einkommensliste (KI-Vorschlag aus dem Antrag) ⇒ Positionen gelten als von der
 * Sachbearbeitung berücksichtigt. Nicht fatal.
 */
async function uebernimmBestaetigung(fs: Pick<FeldStatus, 'zielTyp' | 'zielId' | 'feldPfad'>): Promise<void> {
  if (fs.zielTyp !== 'person' || fs.feldPfad !== 'einkommen') return;
  try {
    const person = await getPerson(fs.zielId);
    if (!person?.einkommen?.some((e) => !e.beruecksichtigt)) return;
    await updatePerson(person.id, { einkommen: person.einkommen.map((e) => ({ ...e, beruecksichtigt: true })) }, { force: true });
  } catch (err) {
    console.warn('[wohngeld] Einkommen nicht als berücksichtigt markiert:', err instanceof Error ? err.message : err);
  }
}

/** Verwerfen: vorgeschlagenen Feldwert am Ziel leeren (bzw. auf Default zurücksetzen). */
async function leereFeld(fs: FeldStatus): Promise<void> {
  if (fs.zielTyp === 'vorgang') {
    const vorgang = await getVorgang(fs.zielId);
    if (vorgang) await updateVorgang(fs.zielId, clearVorgangUpdates(vorgang, fs.feldPfad));
  } else if (fs.zielTyp === 'person') {
    const person = await getPerson(fs.zielId);
    if (person) await updatePerson(fs.zielId, clearPersonUpdates(fs.feldPfad));
  }
}

export const feldstatusRoutes = createFeldstatusRoutes<FeldStatusZielTyp>({
  store: feldStatusStore,
  guards: { denyIfNotAppEditor, denyIfVorgangEingeschraenkt },
  audit,
  beiBestaetigt: uebernimmBestaetigung,
  beiVerwerfen: leereFeld,
  beiEntscheidung: vermerkeEntscheidungen,
  // verworfener Wert kann Befunde ändern
  nachAenderung: async (vorgangId, entscheidung) => {
    if (entscheidung === 'verworfen') await pruefeAutomatisch(vorgangId);
  },
});
