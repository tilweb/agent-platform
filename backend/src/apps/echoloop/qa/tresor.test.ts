/**
 * Tresor-Sweep-Tests: jede Secret-Klasse wird erkannt, sauberer Input bleibt
 * sauber, Redaktion schwärzt ohne die Zeile zu verlieren, der harte Gate wirft.
 * Zusätzlich: der compliance-sichere Übungsfall enthält KEINE Credentials
 * (Regressions-Wächter — falls je eine Fixture mit Klartext-Secret hereinkäme).
 */
import { test, expect, describe } from 'bun:test';
import {
  tresorSweep, sweepText, sweepVariablen, redactVariablen, redact,
  assertTresorClean, TresorError,
} from './tresor';
import type { EmmaVariable } from '../extract/emma';
import { extractProcessFromPdf } from '../extract/emma';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const V = (over: Partial<EmmaVariable>): EmmaVariable => ({
  p: '999', id: '1', name: 'X', typ: 'string', init: '', schnitt: 'Privat', pos: 1, fund: [], ...over,
});

describe('Tresor · Secret-Erkennung', () => {
  const cases: [string, string][] = [
    ['private-key', '-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END'],
    ['jwt', 'token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N'],
    ['cloud-key', 'AKIAIOSFODNN7EXAMPLE liegt im Skript'],
    ['api-token', 'ghp_1234567890abcdefghijklmnopqrstuvwxyz'],
    ['connection-string', 'Server=db;User=sa;Password=Sup3rGeheim!;'],
    ['url-credential', 'postgres://user:s3cretpw@host:5432/db'],
    ['bearer', 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345'],
  ];
  for (const [erwartet, text] of cases) {
    test(`erkennt ${erwartet}`, () => {
      const found = sweepText(text, 't');
      expect(found.length).toBeGreaterThan(0);
      expect(found.map((f) => f.klasse)).toContain(erwartet);
      // Klartext darf im Auszug nicht mehr vollständig stehen.
      for (const f of found) expect(f.auszug).not.toBe(text);
    });
  }

  test('sauberer Fachtext liefert keine Funde', () => {
    const r = tresorSweep({ text: 'Rechnungsbetrag prüfen, Schwellwert 1000 EUR, Lieferantenname abgleichen.' });
    expect(r.clean).toBe(true);
    expect(r.findings).toHaveLength(0);
  });
});

describe('Tresor · EMMA-Variablen', () => {
  test('password-Typ mit Init = Fund; leerer Init = sauber', () => {
    const funde = sweepVariablen([
      V({ p: '210', id: '42', typ: 'password', init: 'Hunter2!' }),
      V({ p: '210', id: '43', typ: 'password', init: '' }),
      V({ p: '210', id: '44', typ: 'string', init: 'Normalwert' }),
    ]);
    expect(funde).toHaveLength(1);
    expect(funde[0]!.klasse).toBe('password-variable');
    expect(funde[0]!.fundort).toBe('variable P210/id42 (Init)');
  });

  test('redactVariablen schwärzt betroffene Zeile, lässt Rest unberührt', () => {
    const vars = [
      V({ p: '210', id: '42', typ: 'password', init: 'Hunter2!' }),
      V({ p: '210', id: '44', typ: 'string', init: 'Normalwert' }),
    ];
    const { variablen, findings } = redactVariablen(vars);
    expect(findings).toHaveLength(1);
    expect(variablen[0]!.init).toBe('🔒 [Tresor]');
    expect(variablen[1]!.init).toBe('Normalwert');
    // Original unverändert (reine Funktion).
    expect(vars[0]!.init).toBe('Hunter2!');
  });
});

describe('Tresor · harter Gate', () => {
  test('assertTresorClean wirft TresorError bei Fund', () => {
    expect(() => assertTresorClean({ text: 'pwd=GeheimGeheim123' })).toThrow(TresorError);
  });
  test('assertTresorClean passiert bei sauberem Input', () => {
    expect(() => assertTresorClean({ text: 'Alles gut hier.' })).not.toThrow();
  });
  test('redact hält kurze Werte vollständig maskiert', () => {
    expect(redact('abc')).toBe('••••');
    expect(redact('Sup3rGeheimesPasswort')).toContain('geschwärzt');
  });
});

test('Übungsfall-Gold-Run ist tresor-sauber (keine Credentials in der Fixture)', async () => {
  const dir = join(import.meta.dir, '..', 'extract', '__fixtures__', 'uebungsfall', 'prozesse');
  const vars: EmmaVariable[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.pdf'))) {
    const nr = f.match(/Prozess_(\d+)/)?.[1] ?? '';
    const p = await extractProcessFromPdf(new Uint8Array(readFileSync(join(dir, f))), nr);
    vars.push(...p.variablen);
  }
  expect(tresorSweep({ variablen: vars }).clean).toBe(true);
});
