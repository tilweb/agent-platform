import { expect, test } from 'bun:test';
import { korrigierteWerte, lernbeispieleAktiv } from './lernbeispiele';

const roh = { antragsteller_nachname: 'Kesler', antragsteller_vorname: 'Waltraud', gesamtmiete: 468.5, heizkosten: 62, warmwasser: 18, plz: '34127', ort: 'Kassel' };

test('bestätigt bleibt, verworfen übernimmt den Vorgangswert; Miete wird zur Gesamtmiete zurückgerechnet', () => {
  const k = korrigierteWerte(roh, { nachname: 'verworfen', vorname: 'bestaetigt', 'wohnung.miete': 'verworfen', 'wohnung.plz': 'bestaetigt' },
    { antragsdatum: '2026-08-18', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag', wohnung: { miete: 390, plz: '34127' } },
    { vorname: 'Waltraud', nachname: 'Kessler', geburtsdatum: '1952-03-14' });
  expect(k.antragsteller_nachname).toBe('Kessler');
  expect(k.antragsteller_vorname).toBe('Waltraud');
  expect(k.gesamtmiete).toBe(470);
  expect(k.plz).toBe('34127');
});

test('verworfen ohne neuen Wert ⇒ null', () => {
  const k = korrigierteWerte(roh, { 'wohnung.ort': 'verworfen' }, { antragsdatum: undefined, wohngeldart: 'mietzuschuss', antragsart: 'erstantrag', wohnung: {} });
  expect(k.ort).toBeNull();
});

test('standardmäßig ausgeschaltet', () => {
  const alt = process.env.WOHNGELD_LERNBEISPIELE;
  delete process.env.WOHNGELD_LERNBEISPIELE;
  expect(lernbeispieleAktiv()).toBe(false);
  if (alt !== undefined) process.env.WOHNGELD_LERNBEISPIELE = alt;
});
