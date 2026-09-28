/**
 * Rollen-/Schreib-Gates der Wohngeld-Routen — Adapter auf den Antrag-Kern (`rollen.ts`).
 */
import { getVorgang } from '../storage';
import {
  vierAugenAktiv as kernVierAugenAktiv,
  createDenyIfVorgangEingeschraenkt,
} from '../../kern/rollen';

export {
  denyIfNotAppEditor, denyIfNotAppOwner, getAppRole, darfEntscheiden, denyIfEingeschraenkt,
} from '../../kern/rollen';

/**
 * Vier-Augen-Prinzip aktiv? Opt-in per ENV-Schalter `WOHNGELD_VIERAUGEN`
 * (default aus). Ist er an, darf eine finale Verfügungs-Entscheidung nur die
 * appRole `owner` (Entscheider) speichern — der `editor` bereitet vor.
 */
export function vierAugenAktiv(): boolean {
  return kernVierAugenAktiv('WOHNGELD');
}

/**
 * Lädt den Vorgang und prüft die Einschränkung (Art. 18 DSGVO). Fehlende ID → null.
 */
export const denyIfVorgangEingeschraenkt = createDenyIfVorgangEingeschraenkt((id) => getVorgang(id));
