/**
 * Antrag-Kern — App-Rollen und Schreib-Gates für Routen.
 *
 * Die wirksame App-Rolle setzt `requireAppAccess` in den Hono-Context (`appRole`).
 * Gates geben ein Fehlerobjekt zurück oder null.
 */
import type { Context } from 'hono';

export type AppRole = 'owner' | 'editor' | 'viewer';

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
 * Vier-Augen-Prinzip aktiv? Opt-in per ENV-Schalter `<envPraefix>_VIERAUGEN`
 * (default aus). Ist er an, darf eine finale Entscheidung nur die appRole
 * `owner` (Entscheider) speichern — der `editor` bereitet vor.
 */
export function vierAugenAktiv(envPraefix: string): boolean {
  const raw = (process.env[`${envPraefix}_VIERAUGEN`] || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes' || raw === 'ja';
}

/**
 * Reiner Helfer (testbar): Darf ein Nutzer mit `appRole` eine FINALE
 * Entscheidung speichern?
 *  - Vier-Augen aus: jeder Editor/Owner darf entscheiden.
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
 * Wrapper-Fabrik: lädt den Vorgang über `getVorgang` und prüft die Einschränkung.
 * Für Routen, die nur die vorgangId (bzw. die eines Kind-Objekts) kennen.
 * Fehlende ID → null (nichts zu sperren).
 */
export function createDenyIfVorgangEingeschraenkt(
  getVorgang: (id: string) => Promise<{ eingeschraenkt?: boolean } | null | undefined>,
) {
  return async function denyIfVorgangEingeschraenkt(
    vorgangId: string | null | undefined,
  ): Promise<{ error: string } | null> {
    if (!vorgangId) return null;
    const vorgang = await getVorgang(vorgangId);
    return denyIfEingeschraenkt(vorgang);
  };
}
