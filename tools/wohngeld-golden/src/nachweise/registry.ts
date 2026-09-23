/**
 * Sammelt die Generator-Tabellen der Nachweis-Familien. Jede Familie exportiert
 * `GENERATOREN_<FAMILIE>: Partial<Record<DokArt, Generator>>` aus ihrer eigenen Datei.
 */
import type { DokArt, Generator } from '../types';
import { GENERATOREN_FORMULARE } from '../formulare/weitere';
import { GENERATOREN_BESCHEIDE } from './bescheide';
import { GENERATOREN_FINANZEN } from './finanzen';
import { GENERATOREN_KARTEN } from './karten';
import { GENERATOREN_URKUNDEN } from './urkunden';

export const ERWEITERUNGEN: Partial<Record<DokArt, Generator>> = {
  ...GENERATOREN_FORMULARE,
  ...GENERATOREN_KARTEN,
  ...GENERATOREN_BESCHEIDE,
  ...GENERATOREN_FINANZEN,
  ...GENERATOREN_URKUNDEN,
};
