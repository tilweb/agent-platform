/**
 * Antrag-Kern — reine KI-Verbrauch-Aggregation mit App-Labels.
 */
import { expect, test } from 'bun:test';
import { fasseZusammen, labelAus, type KiVerbrauchEintrag } from './ki-verbrauch';

function e(p: Partial<KiVerbrauchEintrag>): KiVerbrauchEintrag {
  const promptTokens = p.promptTokens ?? 0;
  const completionTokens = p.completionTokens ?? 0;
  return {
    id: 'x', zeitpunkt: '2026-09-27T10:00:00Z', aktion: 'a', label: '', phase: 'bearbeitung',
    aufrufe: 1, ohneAngabe: 0, modelle: {}, ...p, promptTokens, completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

test('fasseZusammen: Summe, Phasen, Aktionen mit Labels, Modelle', () => {
  const labels = { erfassen: 'Erfassen', fragen: 'Fragen' };
  const u = fasseZusammen([
    e({ aktion: 'erfassen', phase: 'ersterfassung', aufrufe: 2, promptTokens: 1000, completionTokens: 100,
      modelle: { m1: { aufrufe: 2, promptTokens: 1000, completionTokens: 100, ohneAngabe: 0 } } }),
    e({ aktion: 'fragen', promptTokens: 300, completionTokens: 30 }),
    e({ aktion: 'fragen', promptTokens: 200, completionTokens: 20, ohneAngabe: 1 }),
  ], (a) => labelAus(labels, a));
  expect(u.summe).toEqual({ anzahl: 3, aufrufe: 4, promptTokens: 1500, completionTokens: 150, totalTokens: 1650, ohneAngabe: 1 });
  expect(u.jePhase.ersterfassung.totalTokens).toBe(1100);
  expect(u.jePhase.bearbeitung.totalTokens).toBe(550);
  expect(u.jeAktion.map((a) => [a.aktion, a.label, a.anzahl])).toEqual([['erfassen', 'Erfassen', 1], ['fragen', 'Fragen', 2]]);
  expect(u.jeModell).toEqual([{ modell: 'm1', aufrufe: 2, promptTokens: 1000, completionTokens: 100, ohneAngabe: 0, totalTokens: 1100 }]);
});

test('ohne Labels: Schlüssel als Label; unbekannte Aktion behält Schlüssel', () => {
  expect(fasseZusammen([e({ aktion: 'x' })]).jeAktion[0]!.label).toBe('x');
  expect(labelAus({ a: 'A' }, 'b')).toBe('b');
});
