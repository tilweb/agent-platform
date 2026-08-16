/**
 * pfad_befunde gegen den cfg_generator-Golden-Testfall (_test_cfg_generator.py:295-311):
 * Stamm aus C_BasisPfad, kuerzbar [C_ArchivPfad,C_VorlagePfad], extern [C_FremdPfad],
 * trenner [C_TeilPfad]; C_BasisPfad in keiner Liste.
 */
import { test, expect, describe } from 'bun:test';
import { pfadBefunde, pfadNachRga, type PfadZeile } from './pfad';

const pfz: PfadZeile[] = [
  { schluessel: 'C_BasisPfad', wert: 'J:\\EMMA\\Fam' },
  { schluessel: 'C_ArchivPfad', wert: 'J:\\EMMA\\Fam\\0900_Archiv' },
  { schluessel: 'C_VorlagePfad', wert: 'J:\\EMMA\\Fam\\0800_Vorlagen' },
  { schluessel: 'C_FremdPfad', wert: 'C:\\Program Files\\EVA' },
  { schluessel: 'C_TeilPfad', wert: '\\0100_Eingang' },
];
const b = pfadBefunde(pfz);

describe('pfad_befunde · Golden', () => {
  test('Stamm aus C_BasisPfad-Konvention', () => {
    expect(b.stamm).toBe('J:\\EMMA\\Fam');
  });
  test('kuerzbar = C_ArchivPfad + C_VorlagePfad (mit Rest)', () => {
    expect(b.kuerzbar.map((k) => k.schluessel).sort()).toEqual(['C_ArchivPfad', 'C_VorlagePfad']);
    expect(b.kuerzbar.find((k) => k.schluessel === 'C_ArchivPfad')!.rest).toBe('0900_Archiv');
  });
  test('extern = C_FremdPfad (anderes Laufwerk)', () => {
    expect(b.extern.map((e) => e.schluessel)).toEqual(['C_FremdPfad']);
  });
  test('trenner = C_TeilPfad (führender Separator, kein Vollpfad)', () => {
    expect(b.trenner).toEqual(['C_TeilPfad']);
  });
  test('C_BasisPfad steht in keiner Befund-Liste', () => {
    const alle = [...b.kuerzbar.map((k) => k.schluessel), ...b.extern.map((e) => e.schluessel), ...b.trenner];
    expect(alle).not.toContain('C_BasisPfad');
  });
});

describe('pfad_befunde · RGA-Mapping + Kanten', () => {
  test('kuerzbar>1 → D9-Hinweis, extern → D10-Hinweis (keine Levels)', () => {
    const h = pfadNachRga(b);
    const dims = h.map((x) => x.dim);
    expect(dims).toContain('D9');
    expect(dims).toContain('D10');
    expect(h.find((x) => x.dim === 'D9')!.hinweis).toContain('2');
  });
  test('UNC-Pfad ist Vollpfad (extern, wenn außerhalb Stamm)', () => {
    const r = pfadBefunde([{ schluessel: 'C_A', wert: '\\\\srv\\share\\x' }, { schluessel: 'C_B', wert: '\\\\srv\\share\\y' }]);
    // ohne C_BasisPfad → häufigster Präfix \\srv\share; beide darunter → kuerzbar
    expect(r.kuerzbar.length + r.extern.length).toBe(2);
  });
  test('einzelner Backslash ist kein Vollpfad → trenner', () => {
    const r = pfadBefunde([{ schluessel: 'C_T', wert: '\\teil' }]);
    expect(r.trenner).toEqual(['C_T']);
  });
});
