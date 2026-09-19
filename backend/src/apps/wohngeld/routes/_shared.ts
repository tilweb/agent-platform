import type { Context } from 'hono';
import { getVorgang } from '../storage';

type AppRole = 'owner' | 'editor' | 'viewer';

/** Editor-/Owner-Gate für Schreiboperationen. Gibt Fehlerobjekt zurück oder null. */
export function denyIfNotAppEditor(c: Context): { error: string } | null {
  const appRole = c.get('appRole') as AppRole | undefined;
  if (appRole !== 'owner' && appRole !== 'editor') {
    return { error: 'App-Editor- oder -Owner-Rolle erforderlich.' };
  }
  return null;
}

/**
 * Owner-/DSB-Gate. Das Gesamt-Protokoll ist eine Datenschutz-/Revisionssicht
 * (DSB), nicht für jeden Bearbeiter — nur `owner` darf zugreifen. Gibt
 * Fehlerobjekt zurück oder null.
 */
export function denyIfNotAppOwner(c: Context): { error: string } | null {
  const appRole = c.get('appRole') as AppRole | undefined;
  if (appRole !== 'owner') {
    return { error: 'App-Owner-Rolle (DSB/Revision) erforderlich.' };
  }
  return null;
}

/** Wirksame App-Rolle aus dem Context (von requireAppAccess gesetzt). */
export function getAppRole(c: Context): AppRole | undefined {
  return c.get('appRole') as AppRole | undefined;
}

/**
 * Vier-Augen-Prinzip aktiv? Opt-in per ENV-Schalter `WOHNGELD_VIERAUGEN`
 * (default aus). Ist er an, darf eine finale Verfügungs-Entscheidung nur die
 * appRole `owner` (Entscheider) speichern — der `editor` bereitet vor.
 */
export function vierAugenAktiv(): boolean {
  const raw = (process.env.WOHNGELD_VIERAUGEN || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes' || raw === 'ja';
}

/**
 * Reiner Helfer (testbar): Darf ein Nutzer mit `appRole` eine FINALE
 * Verfügungs-Entscheidung speichern?
 *  - Vier-Augen aus: jeder Editor/Owner darf entscheiden (unverändertes Verhalten).
 *  - Vier-Augen an:  nur `owner` (Entscheider-Rolle), Bearbeiter ≠ Entscheider.
 */
export function darfEntscheiden(appRole: AppRole | string | undefined, vierAugen: boolean): boolean {
  if (vierAugen) return appRole === 'owner';
  return appRole === 'owner' || appRole === 'editor';
}

/**
 * GOV-5 / Art. 18 DSGVO — reiner Helfer: sperrt schreibende Zugriffe, wenn die
 * Verarbeitung des Vorgangs eingeschränkt ist ("nur lesend"). Gibt Fehlerobjekt
 * zurück oder null. Das Setzen/Aufheben der Einschränkung selbst ist davon
 * ausgenommen (eigene Route).
 */
export function denyIfEingeschraenkt(
  vorgang: { eingeschraenkt?: boolean } | null | undefined,
): { error: string } | null {
  if (vorgang?.eingeschraenkt) {
    return { error: 'Verarbeitung eingeschränkt (Art. 18 DSGVO) — nur lesend.' };
  }
  return null;
}

/**
 * Bequemer Wrapper: lädt den Vorgang und prüft die Einschränkung. Für Routen,
 * die nur die vorgangId (bzw. die eines Kind-Objekts) kennen. Fehlende ID → null
 * (nichts zu sperren).
 */
export async function denyIfVorgangEingeschraenkt(
  vorgangId: string | null | undefined,
): Promise<{ error: string } | null> {
  if (!vorgangId) return null;
  const vorgang = await getVorgang(vorgangId);
  return denyIfEingeschraenkt(vorgang);
}
