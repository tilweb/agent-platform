/**
 * Fristen / Wiedervorlage (§ Gap H, Welle 4, WP7) — Adapter auf den Antrag-Kern.
 *
 * Reines Datums-Rechnen liegt in `apps/_antrag-kern/datum.ts`; hier nur der
 * Wohngeld-spezifische Wiedervorlage-Puffer.
 */
export { plusTage, istUeberfaellig, tageBisFrist } from '../_antrag-kern/datum';

/** Standard-Puffer: Wiedervorlage = Frist + N Tage (ENV-tunebar, Default 3). */
export const WIEDERVORLAGE_PUFFER_TAGE = Number(process.env.WOHNGELD_WIEDERVORLAGE_PUFFER_TAGE) || 3;
