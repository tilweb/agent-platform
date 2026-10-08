import { expect, test } from 'bun:test';
import { normDatum, vergleiche } from './vergleich';
import type { VertragsAuswertung } from '../../src/services/extraction/contract/types';

test('normDatum', () => {
  expect(normDatum('01.11.2022')).toBe('2022-11-01');
  expect(normDatum('ab 1.7.23')).toBe('2023-07-01');
  expect(normDatum('2024-08-01')).toBe('2024-08-01');
  expect(normDatum(null)).toBeNull();
});

test('vergleiche: Katalog, Unterschriften, Befunde, Erweiterung, Kern', () => {
  const v = {
    version: 1, seiten: [], klauseln: [], gueltigkeit: [], fristen: [], verweise: [],
    katalog: {
      parteien: { status: 'gefunden', wert: [{ rolle: 'Auftraggeber', name: 'Kerst & Schweitzer oHG' }], klauseln: [] },
      beginn: { status: 'gefunden', wert: { datum: '01.11.2022' }, klauseln: [] },
      kuendigung: { status: 'gefunden', wert: { frist: { dauer: 3, einheit: 'monate' } }, klauseln: [] },
      unterschriften: { status: 'gefunden', wert: [{ partei: 'Auftraggeber', vorhanden: true }, { partei: 'Auftragnehmer', vorhanden: false }], klauseln: [] },
    },
    inventar: [{ typ: 'pflicht', partei: 'AN', inhalt: 'Wartung jährlich', modalitaet: 'muss', klauseln: [] }],
    verknuepfungen: [],
    befunde: [{ typ: 'unterschrift_fehlt', text: 'Unterschrift fehlt: Auftragnehmer.', klauseln: [] }, { typ: 'anlage_fehlt', text: 'Anlage 1 wird referenziert …', klauseln: [] }],
  } as unknown as VertragsAuswertung;
  const p = vergleiche(v, { ladepunkte: [{}, {}] }, {
    parteien: ['Kerst', 'EMobility'], beginn: '2022-11-01', kuendigung: { dauer: 3, einheit: 'monate' },
    unterschriften: { Auftraggeber: true, Auftragnehmer: false }, anlagen_fehlen: ['1'], ladepunkte_anzahl: 2, kern: ['jährlich', 'Reinigung'],
    nicht_geregelt: ['vertragsstrafe'],
  });
  expect(p.filter((x) => !x.ok).map((x) => x.was)).toEqual(['Partei EMobility', 'Kern „Reinigung"']);
});
