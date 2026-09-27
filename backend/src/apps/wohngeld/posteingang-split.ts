/**
 * Wohngeld — Mehrdokument-Split im Posteingang (Adapter auf den Antrag-Kern).
 *
 * Eine Sammel-PDF (Antrag + Nachweise in einer Datei) wird an Dokumentgrenzen in
 * eigenständige Teil-PDFs getrennt. Logik in `apps/_antrag-kern/posteingang/split.ts`;
 * hier nur ENV-Präfix (`WOHNGELD_SPLIT`, `WOHNGELD_SPLIT_MAX_SEITEN`), Temp-Präfix,
 * Log-Präfix und die Wohngeld-Dateiablage.
 *
 * Spec: docs/wohngeld-posteingang-mehrdok-split-spec-2026-09-23.md
 */
import {
  createSplit, standardSplitDeps, type SeitenBereich, type SplitDeps, type TrennErgebnis,
} from '../_antrag-kern/posteingang/split';
import { ablage } from './filestore';
import type { PosteingangDatei } from './types';

// Reine Helfer, die Wohngeld direkt nutzt (weitere im Kern).
export {
  istPdf, brauchtGrenzpruefung, bereicheText,
  type SeitenBereich, type SplitDeps, type TrennErgebnis,
} from '../_antrag-kern/posteingang/split';

/** Standard-Abhängigkeiten (Vision-Urteil, poppler, Wohngeld-Dateiablage). */
export const defaultSplitDeps: SplitDeps = standardSplitDeps(ablage);

export const split = createSplit({
  envPraefix: 'WOHNGELD',
  tmpPraefix: 'wohngeld-split-',
  logPraefix: '[wohngeld]',
  deps: defaultSplitDeps,
});

/** Split global abschaltbar (`WOHNGELD_SPLIT=false`). Default an. */
export const splitAktiv = split.splitAktiv;
/** Obergrenze für die automatische Grenzprüfung (`WOHNGELD_SPLIT_MAX_SEITEN`, Default 40). */
export const splitMaxSeiten = split.splitMaxSeiten;
/** Baut die Teil-Dateien (Bytes speichern, Provenienz setzen). */
export const baueTeile: (
  original: PosteingangDatei, bytes: Uint8Array, seitenGesamt: number,
  bereiche: SeitenBereich[], manuell: boolean, deps?: SplitDeps,
) => Promise<PosteingangDatei[]> = split.baueTeile;
/** Automatische, konservative Grenzprüfung einer (ungetrennten) PDF. */
export const pruefeUndTrenne: (
  datei: PosteingangDatei, opts?: { userId?: string }, deps?: SplitDeps,
) => Promise<TrennErgebnis<PosteingangDatei>> = split.pruefeUndTrenne;
/** Manuelle Trennung/Zusammenführung durch die Fachkraft. */
export const trenneManuell: (
  original: PosteingangDatei, startSeiten: number[], deps?: SplitDeps,
) => Promise<TrennErgebnis<PosteingangDatei> & { seitenGesamt: number }> = split.trenneManuell;
