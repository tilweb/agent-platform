import { describe, expect, test } from 'bun:test';
import { FortschrittMelder, ausErkennung, istHaengend, type PosteingangFortschritt } from './posteingang-fortschritt';
import { meldeFortschritt, mitFortschritt, type FortschrittEreignis } from '../../extraction/fortschritt';

describe('Fortschritt der Erkennung', () => {
  test('Texte je Schritt', () => {
    expect(ausErkennung({ schritt: 'seite_klassifiziert', fertig: 7, gesamt: 18 })).toEqual({ phase: 'seiten', text: 'Seite 7 von 18 erkannt', fertig: 7, gesamt: 18 });
    expect(ausErkennung({ schritt: 'abschnitte_erkannt', anzahl: 1 }).text).toBe('1 Dokument erkannt');
    expect(ausErkennung({ schritt: 'abschnitt_auslesen', fertig: 0, gesamt: 6, label: 'Mietvertrag' }).text).toBe('Dokument 1 von 6 wird ausgelesen: Mietvertrag');
  });
  test('Kontext folgt parallelen Workern, ohne Zuhörer wirkungslos', async () => {
    const got: FortschrittEreignis[] = [];
    meldeFortschritt({ schritt: 'abschnitte_erkannt', anzahl: 9 }); // kein Zuhörer
    await mitFortschritt((e) => { got.push(e); }, async () => {
      await Promise.all([1, 2, 3].map(async (n) => { await Bun.sleep(1); meldeFortschritt({ schritt: 'seite_klassifiziert', fertig: n, gesamt: 3 }); }));
    });
    expect(got.length).toBe(3);
  });
  test('hängend nach 10 Minuten ohne Aktualisierung', () => {
    const f = (vor: number): PosteingangFortschritt => ({ phase: 'seiten', text: '', gestartet: '', aktualisiert: new Date(Date.now() - vor).toISOString() });
    expect(istHaengend(f(60_000))).toBe(false);
    expect(istHaengend(f(11 * 60_000))).toBe(true);
    expect(istHaengend(undefined)).toBe(true);
  });
});

describe('FortschrittMelder', () => {
  test('drosselt, schreibt Phasenwechsel sofort und räumt am Ende auf', async () => {
    const geschrieben: Array<PosteingangFortschritt | null> = [];
    const m = new FortschrittMelder('pe-1', async (_id, f) => { geschrieben.push(f); });
    m.setze({ phase: 'seiten', text: 'Seite 1 von 3 erkannt', fertig: 1, gesamt: 3 });
    m.setze({ phase: 'seiten', text: 'Seite 2 von 3 erkannt', fertig: 2, gesamt: 3 }); // gedrosselt
    m.setze({ phase: 'trennen', text: '3 Dokumente erkannt' }); // Phasenwechsel ⇒ sofort, ohne alte Zähler
    await m.ende();
    expect(geschrieben.map((f) => f?.phase ?? null)).toEqual(['seiten', 'trennen', null]);
    expect(geschrieben[1]?.fertig).toBeUndefined();
    m.setze({ phase: 'auslesen', text: 'nach Ende' });
    expect(geschrieben.length).toBe(3);
  });
});
