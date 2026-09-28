/** Wohngeld-Adapter des Kern-Splits: ENV-Präfix WOHNGELD_* (Logik-Tests im Antrag-Kern). */
import { test, expect } from 'bun:test';
import { splitAktiv, splitMaxSeiten } from './posteingang-split';

test('Schalter WOHNGELD_SPLIT / WOHNGELD_SPLIT_MAX_SEITEN', () => {
  const alt = { a: process.env.WOHNGELD_SPLIT, m: process.env.WOHNGELD_SPLIT_MAX_SEITEN };
  try {
    delete process.env.WOHNGELD_SPLIT;
    delete process.env.WOHNGELD_SPLIT_MAX_SEITEN;
    expect(splitAktiv()).toBe(true);
    expect(splitMaxSeiten()).toBe(40);
    process.env.WOHNGELD_SPLIT = 'FALSE';
    process.env.WOHNGELD_SPLIT_MAX_SEITEN = '25';
    expect(splitAktiv()).toBe(false);
    expect(splitMaxSeiten()).toBe(25);
  } finally {
    if (alt.a === undefined) delete process.env.WOHNGELD_SPLIT; else process.env.WOHNGELD_SPLIT = alt.a;
    if (alt.m === undefined) delete process.env.WOHNGELD_SPLIT_MAX_SEITEN; else process.env.WOHNGELD_SPLIT_MAX_SEITEN = alt.m;
  }
});
