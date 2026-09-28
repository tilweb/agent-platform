import { describe, expect, test } from 'bun:test';
import { stammdatenUebernahme } from './stammdaten-uebernahme';

const S = {
  antragsdatum: '2026-09-01', wohngeldart: 'mietzuschuss' as const, antragsart: 'weiterleistungsantrag' as const, wohngeldnummer: 'WG-4711',
  adresse: { strasse: 'Hauptstr.', hausnummer: '5', plz: '12345', ort: 'Musterstadt' }, wohnung: { miete: 480.5, wohnflaeche_qm: 55 },
};

describe('stammdatenUebernahme', () => {
  test('neuer Vorgang: alles übernehmen', () => {
    const r = stammdatenUebernahme({ wohngeldart: 'mietzuschuss', antragsart: 'erstantrag' }, S, false);
    expect(r.updates).toMatchObject({ antragsdatum: '2026-09-01', antragsart: 'weiterleistungsantrag', wohngeldnummer: 'WG-4711', wohnung: { plz: '12345', miete: 480.5 } });
    expect(r.pfade).toContain('wohnung.miete');
    expect(r.pfade).toContain('wohngeldart');
  });
  test('bestehender Vorgang: nur leere Felder, Handeingaben bleiben', () => {
    const r = stammdatenUebernahme(
      { antragsdatum: '2026-08-15', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag', wohngeldnummer: 'ALT-1', wohnung: { plz: '99999', miete: 500 } },
      S, true,
    );
    expect(r.updates.antragsdatum).toBeUndefined();
    expect(r.updates.wohngeldnummer).toBeUndefined();
    expect(r.updates.antragsart).toBe('weiterleistungsantrag');
    expect(r.updates.wohnung).toEqual({ plz: '99999', miete: 500, strasse: 'Hauptstr.', hausnummer: '5', ort: 'Musterstadt', wohnflaeche_qm: 55 });
    expect(r.pfade.sort()).toEqual(['antragsart', 'wohnung.hausnummer', 'wohnung.ort', 'wohnung.strasse', 'wohnung.wohnflaeche_qm']);
  });
  test('nichts gelesen ⇒ keine Änderungen', () => {
    expect(stammdatenUebernahme({ wohngeldart: 'mietzuschuss', antragsart: 'erstantrag' }, {}, true)).toEqual({ updates: {}, pfade: [] });
  });
});
