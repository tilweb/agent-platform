/**
 * Antrag-Kern — Grep-Wächter: Der Kern enthält keine Fachbegriffe einer App und
 * importiert nichts aus einer App.
 *
 * Ausgenommen vom Begriffs-Check: diese Datei selbst und `tabellen.test.ts`
 * (prüft bewusst die Fabrik-Gleichheit für die bestehenden App-Tabellen).
 */
import { test, expect } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = import.meta.dir;
const SELBST = 'fachfrei.test.ts';
const BEGRIFFE_AUSNAHMEN = new Set([SELBST, 'tabellen.test.ts']);
const VERBOTEN = /wohngeld|wogg|wohngeld_/i;
const APP_IMPORT = /from\s+['"][^'"]*apps\/wohngeld[^'"]*['"]|from\s+['"]\.\.\/wohngeld[^'"]*['"]|import\(\s*['"][^'"]*wohngeld[^'"]*['"]\s*\)/;

function tsDateien(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...tsDateien(join(dir, e.name), r));
    else if (e.name.endsWith('.ts')) out.push(r);
  }
  return out;
}

const dateien = tsDateien(DIR);

test('Kern-Dateien gefunden', () => {
  expect(dateien.length).toBeGreaterThan(5);
});

test('keine Fachbegriffe im Kern', () => {
  const treffer = dateien
    .filter((f) => !BEGRIFFE_AUSNAHMEN.has(f))
    .flatMap((f) => readFileSync(join(DIR, f), 'utf8').split('\n')
      .map((z, i) => (VERBOTEN.test(z) ? `${f}:${i + 1}: ${z.trim()}` : null))
      .filter((x): x is string => x !== null));
  expect(treffer).toEqual([]);
});

test('keine Importe aus einer Fach-App', () => {
  const treffer = dateien
    .filter((f) => f !== SELBST)
    .flatMap((f) => readFileSync(join(DIR, f), 'utf8').split('\n')
      .map((z, i) => (APP_IMPORT.test(z) ? `${f}:${i + 1}: ${z.trim()}` : null))
      .filter((x): x is string => x !== null));
  expect(treffer).toEqual([]);
});
