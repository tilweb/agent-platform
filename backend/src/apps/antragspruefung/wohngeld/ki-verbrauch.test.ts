import { expect, test } from 'bun:test';
import { fasseZusammen, labelFuer, type KiVerbrauchEintrag } from './ki-verbrauch';

function e(p: Partial<KiVerbrauchEintrag>): KiVerbrauchEintrag {
  const promptTokens = p.promptTokens ?? 0;
  const completionTokens = p.completionTokens ?? 0;
  return {
    id: 'x', zeitpunkt: '2026-09-27T10:00:00Z', aktion: 'fall_chat', label: '', phase: 'bearbeitung',
    aufrufe: 1, ohneAngabe: 0, modelle: {}, ...p, promptTokens, completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

test('fasst Summe, Phasen, Aktionen und Modelle zusammen', () => {
  const u = fasseZusammen([
    e({ aktion: 'posteingang_auswertung', phase: 'ersterfassung', aufrufe: 6, promptTokens: 30000, completionTokens: 2000,
      modelle: { qwen: { aufrufe: 4, promptTokens: 20000, completionTokens: 1500, ohneAngabe: 0 }, mistral: { aufrufe: 2, promptTokens: 10000, completionTokens: 500, ohneAngabe: 0 } } }),
    e({ aktion: 'fall_chat', promptTokens: 3000, completionTokens: 400, modelle: { qwen: { aufrufe: 1, promptTokens: 3000, completionTokens: 400, ohneAngabe: 0 } } }),
    e({ aktion: 'fall_chat', promptTokens: 3500, completionTokens: 300, ohneAngabe: 1 }),
  ]);
  expect(u.summe).toEqual({ anzahl: 3, aufrufe: 8, promptTokens: 36500, completionTokens: 2700, totalTokens: 39200, ohneAngabe: 1 });
  expect(u.jePhase.ersterfassung.totalTokens).toBe(32000);
  expect(u.jePhase.bearbeitung.totalTokens).toBe(7200);
  expect(u.jeAktion.map((a) => [a.aktion, a.anzahl, a.totalTokens])).toEqual([
    ['posteingang_auswertung', 1, 32000], ['fall_chat', 2, 7200],
  ]);
  expect(u.jeAktion[1]!.label).toBe('Assistent: Frage zum Fall');
  expect(u.jeModell.map((m) => [m.modell, m.aufrufe, m.totalTokens])).toEqual([['qwen', 5, 24900], ['mistral', 2, 10500]]);
});

test('leer ergibt Nullsummen; unbekannte Aktion behält ihren Schlüssel als Label', () => {
  const u = fasseZusammen([]);
  expect(u.summe.totalTokens).toBe(0);
  expect(u.jeAktion).toEqual([]);
  expect(labelFuer('neu_irgendwas')).toBe('neu_irgendwas');
});
