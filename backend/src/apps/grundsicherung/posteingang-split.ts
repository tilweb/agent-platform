/**
 * Grundsicherung — Mehrdokument-Split im Posteingang (Adapter auf den Antrag-Kern).
 *
 * Wird für die manuelle Trennungskorrektur und das Bilden der Teil-Dateien nach der
 * Profil-Erkennung gebraucht. ENV-Präfix `GRUNDSICHERUNG` (`GRUNDSICHERUNG_SPLIT=false` schaltet
 * das automatische Trennen ab, `GRUNDSICHERUNG_SPLIT_MAX_SEITEN`), Ablage der App.
 */
import { createSplit, standardSplitDeps, type SplitDeps } from '../_antrag-kern/posteingang/split';
import { ablage } from './filestore';

export { istPdf, brauchtGrenzpruefung, bereicheText, type SeitenBereich } from '../_antrag-kern/posteingang/split';

export const defaultSplitDeps: SplitDeps = standardSplitDeps(ablage);

export const split = createSplit({
  envPraefix: 'GRUNDSICHERUNG',
  tmpPraefix: 'grundsicherung-split-',
  logPraefix: '[grundsicherung]',
  deps: defaultSplitDeps,
});
