/**
 * Rollen-/Schreib-Gates der Grundsicherungs-Routen — Adapter auf den Antrag-Kern (`rollen.ts`).
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
 * Vier-Augen-Prinzip aktiv? Opt-in per Env `GRUNDSICHERUNG_VIERAUGEN` (Default aus).
 * Ist er an, darf ein finaler Abschluss-Vermerk nur die appRole `owner` speichern.
 */
export function vierAugenAktiv(): boolean {
  return kernVierAugenAktiv('GRUNDSICHERUNG');
}

/** Lädt den Vorgang und prüft die Einschränkung (Art. 18 DSGVO). Fehlende ID → null. */
export const denyIfVorgangEingeschraenkt = createDenyIfVorgangEingeschraenkt((id) => getVorgang(id));
