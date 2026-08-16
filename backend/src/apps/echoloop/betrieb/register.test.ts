/**
 * Phase-4 Register-Workflows: Regel-Backlog-Zustandsmaschine (nie Kandidat→Standard
 * ohne Review) + Gold-Registry supersede-not-overwrite.
 */
import { test, expect, describe } from 'bun:test';
import {
  uebergang, istScharf, UebergangFehler, pinGold, aktuellerGold, goldHistorie,
  type RegelKandidat, type GoldEintrag,
} from './register';

const kandidat = (status: RegelKandidat['status']): RegelKandidat =>
  ({ id: 'PM-W-a', titel: 'Key-Tippen', quelle: 'FX-WERT-1', status, datum: '2026-08-16' });

describe('Regel-Backlog · Zustandsmaschine', () => {
  test('gültiger Weg: kandidat → beobachtend → im_review → standard', () => {
    let k = kandidat('kandidat');
    k = uebergang(k, 'beobachtend', '2026-08-16');
    k = uebergang(k, 'im_review', '2026-08-17', '0 FP auf Fixtures');
    k = uebergang(k, 'standard', '2026-08-18', 'Review-Freigabe');
    expect(k.status).toBe('standard');
    expect(istScharf(k)).toBe(true);
  });

  test('Sprung Kandidat → Standard ist verboten (nie nebenbei)', () => {
    expect(() => uebergang(kandidat('kandidat'), 'standard', '2026-08-16')).toThrow(UebergangFehler);
  });

  test('beobachtend → standard verboten (Review-Pflicht)', () => {
    expect(() => uebergang(kandidat('beobachtend'), 'standard', '2026-08-16')).toThrow(UebergangFehler);
  });

  test('im_review → beobachtend (mehr Beobachtung nötig) erlaubt', () => {
    expect(uebergang(kandidat('im_review'), 'beobachtend', '2026-08-16').status).toBe('beobachtend');
  });

  test('verworfen → kandidat (Wiederaufnahme als frischer Kandidat)', () => {
    expect(uebergang(kandidat('verworfen'), 'kandidat', '2026-08-16').status).toBe('kandidat');
  });

  test('standard ist Endzustand', () => {
    expect(() => uebergang(kandidat('standard'), 'beobachtend', '2026-08-16')).toThrow(UebergangFehler);
  });

  test('nur „standard"-Kandidaten sind scharf', () => {
    expect(istScharf(kandidat('beobachtend'))).toBe(false);
    expect(istScharf(kandidat('im_review'))).toBe(false);
  });
});

describe('Gold-Registry · supersede-not-overwrite', () => {
  let reg: GoldEintrag[] = [];
  reg = pinGold(reg, 'uebungsfall.zielnamen', 21, '2026-08-16', 'erstes Pin');
  reg = pinGold(reg, 'uebungsfall.zielnamen', 21, '2026-08-17', 'neu bestätigt nach Engine-Sprung');

  test('alter Eintrag wird abgelöst, nicht überschrieben (Historie bleibt)', () => {
    const hist = goldHistorie(reg, 'uebungsfall.zielnamen');
    expect(hist).toHaveLength(2);
    expect(hist[0]!.version).toBe(1);
    expect(hist[0]!.supersededBy).toBe(2);   // v1 abgelöst durch v2
    expect(hist[1]!.supersededBy).toBeUndefined();
  });

  test('aktueller Wert = höchste, nicht abgelöste Version', () => {
    const aktiv = aktuellerGold(reg, 'uebungsfall.zielnamen')!;
    expect(aktiv.version).toBe(2);
    expect(aktiv.begruendung).toContain('Engine-Sprung');
  });

  test('verschiedene Keys sind unabhängig', () => {
    const r2 = pinGold(reg, 'uebungsfall.cfg', 1, '2026-08-16');
    expect(aktuellerGold(r2, 'uebungsfall.cfg')!.version).toBe(1);
    expect(aktuellerGold(r2, 'uebungsfall.zielnamen')!.version).toBe(2);
  });
});
