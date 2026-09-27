import { test, expect } from 'bun:test';
import { leereFeldUpdates, PERSON_FELD_DEFAULTS, VORGANG_FELD_DEFAULTS } from './feldstatus-hooks';

test('einfaches Feld wird geleert', () => {
  expect(leereFeldUpdates({ antragsdatum: '2026-03-01' }, 'antragsdatum')).toEqual({ antragsdatum: undefined });
});

test('verschachteltes Feld: nur der Schlüssel fällt weg', () => {
  const vorgang = { wohnung: { kaltmiete: 420, heizkosten: 80 } };
  expect(leereFeldUpdates(vorgang, 'wohnung.kaltmiete')).toEqual({ wohnung: { heizkosten: 80 } });
  expect(vorgang.wohnung.kaltmiete).toBe(420); // Eingabe unverändert
});

test('verschachteltes Feld ohne Elternobjekt → keine Änderung', () => {
  expect(leereFeldUpdates({}, 'erwerbsminderung.voll')).toEqual({});
});

test('Pflichtspalten werden auf Default gesetzt', () => {
  expect(leereFeldUpdates({ antragsart: 'aenderung' }, 'antragsart', VORGANG_FELD_DEFAULTS)).toEqual({ antragsart: 'erstantrag' });
  expect(leereFeldUpdates({ nachname: 'Muster' }, 'nachname', PERSON_FELD_DEFAULTS)).toEqual({ nachname: '' });
});
