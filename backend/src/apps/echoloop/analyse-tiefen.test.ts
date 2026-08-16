/**
 * Tests des Analyse-Tiefen-Regelmoduls: getragene Tiefe aus dem Inventar,
 * Seite-1-Über-Versprechen, T-B-Pflicht, Behauptungs-Klassen, Klassen-Scan-
 * Pflicht (Zufallsfund-Markierung) und Vollständigkeits-Regel.
 */
import { test, expect, describe } from 'bun:test';
import {
  maxTiefe, deklariereTiefe, darfBehaupten, klassenScan, markiereZufallsfund,
  vollstaendigkeitZulaessig, offenePanelFragen, type PanelPflichtEintrag,
} from './analyse-tiefen';

describe('Analyse-Tiefen · getragene Tiefe', () => {
  test('nur I1 → T-A', () => expect(maxTiefe({ I1: true })).toBe('T-A'));
  test('I1+I2 → T-B', () => expect(maxTiefe({ I1: true, I2: true })).toBe('T-B'));
  test('I1+I2+I5+I6 → T-C', () => expect(maxTiefe({ I1: true, I2: true, I5: true, I6: true })).toBe('T-C'));
  test('kein I1 → null (keine Analyse)', () => expect(maxTiefe({ I2: true, I5: true })).toBeNull());
  test('I5+I6 ohne Betriebsdaten → nur T-A (T-C setzt I2 voraus)', () =>
    expect(maxTiefe({ I1: true, I5: true, I6: true })).toBe('T-A'));
});

describe('Analyse-Tiefen · Seite-1-Deklaration', () => {
  test('gedeckte Deklaration → getragen, kein Hinweis', () => {
    const d = deklariereTiefe('T-A', { I1: true });
    expect(d.getragen).toBe(true);
    expect(d.tbPflichtVerletzt).toBe(false);
  });
  test('Über-Versprechen (T-C bei nur I1) → nicht getragen', () => {
    const d = deklariereTiefe('T-C', { I1: true });
    expect(d.getragen).toBe(false);
    expect(d.maxGetragen).toBe('T-A');
    expect(d.hinweise.join(' ')).toContain('nicht mehr versprechen');
  });
  test('Betriebsdaten da, aber T-A deklariert → T-B-Pflicht verletzt', () => {
    const d = deklariereTiefe('T-A', { I1: true, I2: true });
    expect(d.tbPflichtVerletzt).toBe(true);
    expect(d.hinweise.join(' ')).toContain('T-B ist Pflicht');
  });
});

describe('Analyse-Tiefen · Behauptungs-Klassen', () => {
  test('T-A darf Struktur/Risiko, aber nicht Verhalten/Vollständigkeit', () => {
    expect(darfBehaupten('T-A', 'struktur')).toBe(true);
    expect(darfBehaupten('T-A', 'verhalten')).toBe(false);
    expect(darfBehaupten('T-A', 'vollstaendigkeit')).toBe(false);
  });
  test('T-B darf Verhalten/Zahlen, nicht Vollständigkeit/Soll', () => {
    expect(darfBehaupten('T-B', 'zahlen')).toBe(true);
    expect(darfBehaupten('T-B', 'soll')).toBe(false);
  });
  test('T-C darf Vollständigkeit + Soll', () => {
    expect(darfBehaupten('T-C', 'vollstaendigkeit')).toBe(true);
    expect(darfBehaupten('T-C', 'soll')).toBe(true);
  });
});

describe('Analyse-Tiefen · Klassen-Scan-Pflicht', () => {
  test('scannt über den ganzen Satz, meldet Vollständigkeit', () => {
    const r = klassenScan(['1', '2', '3'], (nr) => (nr === '2' ? ['treffer'] : []));
    expect(r.treffer).toEqual(['treffer']);
    expect(r.abgedeckteProzesse).toEqual(['1', '2', '3']);
    expect(r.vollstaendig).toBe(true);
  });
  test('Einzelfund ohne vollständigen Scan → als Zufallsfund markiert', () => {
    expect(markiereZufallsfund({ aspekt: 'x' }, false)).toEqual({ aspekt: 'x', zufallsfund: true });
    expect(markiereZufallsfund({ aspekt: 'x' }, true)).toEqual({ aspekt: 'x' });
  });
});

describe('Analyse-Tiefen · Vollständigkeits-Regel', () => {
  const liste: PanelPflichtEintrag[] = [
    { klasse: 'Bindung/Reihenfolge', frage: 'Ist S12 an den Fund gebunden?', erledigt: true, beleg: 'Panel-Screenshot' },
    { klasse: 'Wertfehler', frage: 'Betragsformat geprüft?', erledigt: false },
  ];
  test('offene Frage → Vollständigkeits-Aussage unzulässig', () => {
    expect(offenePanelFragen(liste)).toHaveLength(1);
    expect(vollstaendigkeitZulaessig(liste)).toBe(false);
  });
  test('alle abgearbeitet → zulässig', () => {
    expect(vollstaendigkeitZulaessig(liste.map((e) => ({ ...e, erledigt: true })))).toBe(true);
  });
  test('leere Liste → unzulässig (kein Beweis)', () => {
    expect(vollstaendigkeitZulaessig([])).toBe(false);
  });
});
