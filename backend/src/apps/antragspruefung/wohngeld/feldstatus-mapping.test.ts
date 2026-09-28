import { test, expect, describe } from 'bun:test';
import { feldStatusVorgangPfade, feldStatusPersonPfade, feldStatusHaushaltPfade } from './feldstatus-mapping';
import type { ExtrahierteStammdaten } from './extraction';

describe('feldStatusVorgangPfade', () => {
  test('vollständige Stammdaten → alle Vorgang-Pfade', () => {
    const s: ExtrahierteStammdaten = {
      antragsdatum: '2026-09-01',
      wohngeldart: 'mietzuschuss',
      antragsart: 'erstantrag',
      adresse: { strasse: 'Hauptstr.', hausnummer: '5', plz: '12345', ort: 'Musterstadt' },
      wohnung: { miete: 620.5, wohnflaeche_qm: 55 },
    };
    expect(feldStatusVorgangPfade(s)).toEqual([
      'antragsdatum', 'wohngeldart', 'antragsart',
      'wohnung.strasse', 'wohnung.hausnummer', 'wohnung.plz', 'wohnung.ort',
      'wohnung.miete', 'wohnung.wohnflaeche_qm',
    ]);
  });

  test('nur befüllte Felder werden aufgenommen', () => {
    const s: ExtrahierteStammdaten = { antragsdatum: '2026-09-01', wohnung: { miete: 500 } };
    expect(feldStatusVorgangPfade(s)).toEqual(['antragsdatum', 'wohnung.miete']);
  });

  test('miete=0 zählt als befüllt (nicht undefined)', () => {
    const s: ExtrahierteStammdaten = { wohnung: { miete: 0 } };
    expect(feldStatusVorgangPfade(s)).toEqual(['wohnung.miete']);
  });

  test('undefined/leer → keine Pfade', () => {
    expect(feldStatusVorgangPfade(undefined)).toEqual([]);
    expect(feldStatusVorgangPfade({})).toEqual([]);
  });
});

describe('feldStatusPersonPfade', () => {
  test('Antragsteller mit Name + Geburtsdatum', () => {
    expect(feldStatusPersonPfade({ vorname: 'Erika', nachname: 'Mustermann', geburtsdatum: '1960-05-12' }))
      .toEqual(['nachname', 'vorname', 'geburtsdatum']);
  });

  test('nur Nachname', () => {
    expect(feldStatusPersonPfade({ nachname: 'Mustermann' })).toEqual(['nachname']);
  });

  test('undefined → keine Pfade', () => {
    expect(feldStatusPersonPfade(undefined)).toEqual([]);
  });
});


test('Haushaltsperson aus dem Antrag: Name, Geburtsdatum, Erwerbsstatus, Einkommensliste', () => {
  expect(feldStatusHaushaltPfade({ vorname: 'Olga', nachname: 'Weber', geburtsdatum: '1988-11-27', erwerbsstatus: 'angestellt', einkommen: [{}] }))
    .toEqual(['nachname', 'vorname', 'geburtsdatum', 'erwerbsstatus', 'einkommen']);
  expect(feldStatusHaushaltPfade({ vorname: 'Sofia', nachname: 'Weber', einkommen: [] })).toEqual(['nachname', 'vorname']);
  expect(feldStatusHaushaltPfade({ vorname: 'Kai', pflege_behinderung: { pflegegrad: 3 }, ausschluesse: [{}], vermoegenPositionen: [{}] }))
    .toEqual(['vorname', 'pflege_behinderung', 'ausschluesse', 'vermoegenPositionen']);
});
