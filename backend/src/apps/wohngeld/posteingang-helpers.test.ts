import { test, expect, describe } from 'bun:test';
import { leiteBetreffAb } from './posteingang-helpers';
import type { PosteingangDatei } from './types';

describe('Betreff-Ableitung', () => {
  test('aus Antrag-Stammdaten: „Nachname, Vorname — Antragsart"', () => {
    const dateien: PosteingangDatei[] = [{
      dateiname: 'antrag.pdf', contentType: 'application/pdf', groesse: 1, hash: 'x',
      typ: 'wohngeldantrag',
      stammdaten: { antragsart: 'erstantrag', antragsteller: { vorname: 'Anna', nachname: 'Müller' } },
    }];
    expect(leiteBetreffAb(dateien)).toBe('Müller, Anna — Erstantrag');
  });

  test('ohne Antrag: erste Nachweis-Identität', () => {
    const dateien: PosteingangDatei[] = [{
      dateiname: 'ausweis.pdf', contentType: 'application/pdf', groesse: 1, hash: 'x',
      typ: 'personalausweis', identitaet: { nachname: 'Schmidt', vorname: 'Peter' },
    }];
    expect(leiteBetreffAb(dateien)).toBe('Schmidt, Peter');
  });

  test('ohne Identität: erster Dateiname', () => {
    const dateien: PosteingangDatei[] = [{
      dateiname: 'scan_001.pdf', contentType: 'application/pdf', groesse: 1, hash: 'x',
    }];
    expect(leiteBetreffAb(dateien)).toBe('scan_001.pdf');
  });
});
