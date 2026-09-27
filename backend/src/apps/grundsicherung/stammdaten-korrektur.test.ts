import { describe, expect, test } from 'bun:test';
import { ersteingangMitKorrektur, korrigiereStammdaten } from './stammdaten-uebernahme';
import type { ExtrahierteStammdaten } from './types';

const erkannt: ExtrahierteStammdaten = {
  antragsdatum: '2026-09-01',
  anspruchsgrund: 'alter',
  antragsteller: { vorname: 'Erna', nachname: 'Schmitt', geburtsdatum: '1958-03-12' },
  adresse: { strasse: 'Hauptstr.', hausnummer: '3', plz: '12345', ort: 'Musterstadt' },
  wohnung: { kaltmiete: 420, nebenkosten_kalt: 90, heizkosten: 70, warmwasser: 'zentral', bewohner_anzahl: 2 },
  iban: 'DE02120300000000202051',
  personen: [
    { rolle: 'antragsteller', vorname: 'Erna', nachname: 'Schmitt', geburtsdatum: '1958-03-12' },
    { rolle: 'partner', vorname: 'Karl', nachname: 'Schmitt', geburtsdatum: '1956-07-01' },
  ],
};

describe('korrigiereStammdaten', () => {
  test('Formularwerte gewinnen, nicht angezeigte erkannte Daten bleiben erhalten', () => {
    const r = korrigiereStammdaten(erkannt, {
      antragsdatum: '2026-09-02',
      antragsteller: { vorname: 'Erna', nachname: 'Schmidt', geburtsdatum: '1958-03-12' },
      adresse: { strasse: 'Hauptstraße' },
      wohnung: { kaltmiete: 430 },
    });
    expect(r.antragsdatum).toBe('2026-09-02');
    expect(r.adresse).toEqual({ strasse: 'Hauptstraße', hausnummer: '3', plz: '12345', ort: 'Musterstadt' });
    expect(r.wohnung).toEqual({ kaltmiete: 430, nebenkosten_kalt: 90, heizkosten: 70, warmwasser: 'zentral', bewohner_anzahl: 2 });
    expect(r.iban).toBe(erkannt.iban);
    expect(r.personen).toHaveLength(2);
    expect(r.personen![0]!.nachname).toBe('Schmidt');
    expect(r.personen![1]!.vorname).toBe('Karl');
    expect(r.anspruchsgrund).toBe('alter');
  });

  test('leere Formularwerte überschreiben nichts; ohne erkannte Daten gilt das Formular', () => {
    const r = korrigiereStammdaten(erkannt, { antragsdatum: '', wohnung: { kaltmiete: undefined } });
    expect(r.antragsdatum).toBe('2026-09-01');
    expect(r.wohnung!.kaltmiete).toBe(420);
    const neu = korrigiereStammdaten(undefined, { antragsteller: { nachname: 'Neu' } });
    expect(neu.antragsteller).toEqual({ nachname: 'Neu' });
  });
});

describe('ersteingangMitKorrektur', () => {
  test('manuelle Angaben gewinnen feldweise, sonst die abgeleiteten', () => {
    expect(ersteingangMitKorrektur({ datum: '2026-08-20', stelle: 'Wohngeldstelle' }, { datum: '2026-08-18' }))
      .toEqual({ datum: '2026-08-18', stelle: 'Wohngeldstelle' });
    expect(ersteingangMitKorrektur(undefined, { stelle: 'Rentenversicherung' })).toEqual({ stelle: 'Rentenversicherung' });
    expect(ersteingangMitKorrektur(undefined, { datum: '' })).toBeUndefined();
  });
});
