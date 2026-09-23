import { expect, test } from 'bun:test';
import { pruefeVorgang } from '../../src/apps/wohngeld/checker';
import { posteingangSnapshot, regelwerkSnapshot, type FallKurz } from './snapshot';

const fall: FallKurz = {
  antragsdatum: '2026-08-18',
  personen: [
    { id: 'P1', vorname: 'Anna', nachname: 'Muster', geburtsdatum: '1980-01-01', erwerb: 'Arbeitnehmer', staatsangehoerigkeit: 'deutsch', einnahmen: [{ art: 'Gehalt/Lohn', brutto: 2000, turnus: 'monatlich' }] },
    { id: 'P2', vorname: 'Ben', nachname: 'Muster', geburtsdatum: '2019-05-05', verhaeltnis: 'Sohn', erwerb: 'Nichterwerbsperson', staatsangehoerigkeit: 'deutsch', einnahmen: [] },
  ],
  antrag: { schwerbehinderung: [{ person: 'P1', gdb: 50 }] },
};
const erwartung = {
  dokumente: [
    { typ: 'wohngeldantrag' as const, person: 'P1', erwartet: { stammdaten: { antragsdatum: '2026-08-18', 'wohnung.miete': 500, 'adresse.plz': '12345' }, analyse: { unterschrift_vorhanden: true } } },
    { typ: 'gehaltsabrechnung' as const, person: 'P1', erwartet: { analyse: { betrag: 2000 } } },
    { typ: 'mietvertrag' as const, erwartet: { analyse: { miete: 520 } } },
  ],
};

test('Regelwerk-Zustand: Personen, Kindergeld, Schwerbehinderung, Personenbezug', () => {
  const s = regelwerkSnapshot(fall, erwartung);
  expect(s.personen.map((p) => p.rolle)).toEqual(['antragsteller', 'kind']);
  expect(s.personen[0]!.erhaelt_kindergeld).toBe(true);
  expect(s.personen[0]!.einkommen![0]!.art).toBe('lohn_gehalt');
  expect(s.dokumente[1]!.personId).toBe('P1');
  expect(s.vorgang.wohnung?.miete).toBe(500);
  const ids = pruefeVorgang(s).map((b) => b.regelId);
  expect(ids).toContain('kindergeld-nachweis');
  expect(ids).toContain('schwerbehinderung-nachweis');
  expect(ids).toContain('plausi-miethoehe-abweichung');
  expect(ids).not.toContain('verdienstbescheinigung');
});

test('Posteingang-Zustand: nur antragstellende Person, Dokumente ohne Personenbezug', () => {
  const s = posteingangSnapshot([
    { typ: 'wohngeldantrag', stammdaten: { antragsteller: { vorname: 'Anna', nachname: 'Muster' }, wohnung: { miete: 500 } }, analyse: {} },
    { typ: 'personalausweis', analyse: {} },
  ]);
  expect(s.personen).toHaveLength(1);
  expect(s.dokumente.every((d) => !d.personId)).toBe(true);
  expect(pruefeVorgang(s).map((b) => b.regelId)).toContain('identitaet-jede-person');
});
