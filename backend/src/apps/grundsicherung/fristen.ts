/**
 * Grundsicherung — Fristen / Wiedervorlage (Adapter auf den Antrag-Kern).
 */
export { plusTage, istUeberfaellig, tageBisFrist } from '../_antrag-kern/datum';

/** Standard-Puffer: Wiedervorlage = Frist + N Tage (Env `GRUNDSICHERUNG_WIEDERVORLAGE_PUFFER_TAGE`, Default 3). */
export function wiedervorlagePufferTage(): number {
  const n = Number(process.env.GRUNDSICHERUNG_WIEDERVORLAGE_PUFFER_TAGE);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 3;
}
