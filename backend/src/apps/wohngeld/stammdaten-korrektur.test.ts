import { expect, test } from 'bun:test';
import { korrigiereStammdaten } from './stammdaten-uebernahme';
import type { ExtrahierteStammdaten } from './extraction';

test('Formular-Korrektur behält erkannten Haushalt und Wohngeldnummer, gesetzte Werte gewinnen', () => {
  const erkannt: ExtrahierteStammdaten = {
    antragsdatum: '2026-09-01', wohngeldnummer: 'WG-4711',
    antragsteller: { vorname: 'Erna', nachname: 'Schmitt', geburtsdatum: '1958-03-12' },
    adresse: { strasse: 'Hauptstr.', hausnummer: '3', plz: '12345', ort: 'Musterstadt' },
    wohnung: { miete: 510, wohnflaeche_qm: 58 },
    haushalt: { mitglieder: [{ vorname: 'Karl', nachname: 'Schmitt', geburtsdatum: '1956-07-01' }], einnahmen: [], behinderung: [] } as never,
  };
  // Form wie das Posteingang-Formular sie schickt (ohne haushalt/wohngeldnummer, teils leer).
  const r = korrigiereStammdaten(erkannt, {
    antragsdatum: '2026-09-02',
    antragsteller: { vorname: 'Erna', nachname: 'Schmidt', geburtsdatum: undefined },
    adresse: { strasse: 'Hauptstraße', hausnummer: undefined, plz: undefined, ort: undefined },
    wohnung: { miete: 520, wohnflaeche_qm: undefined },
  });
  expect(r.wohngeldnummer).toBe('WG-4711');
  expect(r.haushalt).toEqual(erkannt.haushalt);
  expect(r.antragsdatum).toBe('2026-09-02');
  expect(r.antragsteller).toEqual({ vorname: 'Erna', nachname: 'Schmidt', geburtsdatum: '1958-03-12' });
  expect(r.adresse).toEqual({ strasse: 'Hauptstraße', hausnummer: '3', plz: '12345', ort: 'Musterstadt' });
  expect(r.wohnung).toEqual({ miete: 520, wohnflaeche_qm: 58 });
});

test('ohne erkannte Daten gilt die Korrektur', () => {
  expect(korrigiereStammdaten(undefined, { antragsteller: { nachname: 'Neu' } }).antragsteller).toEqual({ nachname: 'Neu' });
});
