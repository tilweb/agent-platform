/**
 * Registrierte Fälle: jede Datei `F<nn>.ts` in diesem Ordner, die eine gleichnamige
 * Konstante exportiert (z. B. `export const F07: Fall`). Kein manuelles Eintragen nötig.
 */
import { readdirSync } from 'node:fs';
import type { Fall } from '../types';

const dateien = readdirSync(import.meta.dir).filter((f) => /^F\d{2}\.ts$/.test(f)).sort();
const geladen: Fall[] = [];
for (const datei of dateien) {
  const id = datei.replace('.ts', '');
  try {
    const mod = (await import(`./${datei}`)) as Record<string, Fall>;
    const fall = mod[id];
    if (!fall) throw new Error(`exportiert keine Konstante ${id}`);
    if (fall.id !== id) throw new Error(`fall.id ist „${fall.id}", erwartet „${id}"`);
    geladen.push(fall);
  } catch (err) {
    // Ein defekter Fall soll die übrigen nicht blockieren — laut melden, überspringen.
    console.error(`⚠ ${datei} übersprungen: ${err instanceof Error ? err.message : err}`);
  }
}

export const FAELLE: Fall[] = geladen;
