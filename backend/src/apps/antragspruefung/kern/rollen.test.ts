import { test, expect } from 'bun:test';
import { darfEntscheiden, vierAugenAktiv, createDenyIfVorgangEingeschraenkt } from './rollen';

test('darfEntscheiden: Vier-Augen aus → editor und owner dürfen entscheiden', () => {
  expect(darfEntscheiden('owner', false)).toBe(true);
  expect(darfEntscheiden('editor', false)).toBe(true);
});

test('darfEntscheiden: Vier-Augen aus → viewer darf nicht', () => {
  expect(darfEntscheiden('viewer', false)).toBe(false);
  expect(darfEntscheiden(undefined, false)).toBe(false);
});

test('darfEntscheiden: Vier-Augen an → nur owner darf entscheiden', () => {
  expect(darfEntscheiden('owner', true)).toBe(true);
  expect(darfEntscheiden('editor', true)).toBe(false);
  expect(darfEntscheiden('viewer', true)).toBe(false);
  expect(darfEntscheiden(undefined, true)).toBe(false);
});

test('vierAugenAktiv liest <praefix>_VIERAUGEN (default aus)', () => {
  const name = 'KERNTEST_VIERAUGEN';
  const alt = process.env[name];
  try {
    delete process.env[name];
    expect(vierAugenAktiv('KERNTEST')).toBe(false);
    for (const v of ['1', 'true', 'ON', 'yes', 'ja']) {
      process.env[name] = v;
      expect(vierAugenAktiv('KERNTEST')).toBe(true);
    }
    process.env[name] = 'nein';
    expect(vierAugenAktiv('KERNTEST')).toBe(false);
  } finally {
    if (alt === undefined) delete process.env[name]; else process.env[name] = alt;
  }
});

test('createDenyIfVorgangEingeschraenkt: sperrt nur eingeschränkte Vorgänge', async () => {
  const deny = createDenyIfVorgangEingeschraenkt(async (id) => (id === 'gesperrt' ? { eingeschraenkt: true } : id === 'frei' ? {} : null));
  expect(await deny('gesperrt')).not.toBeNull();
  expect(await deny('frei')).toBeNull();
  expect(await deny('fehlt')).toBeNull();
  expect(await deny(undefined)).toBeNull();
});
