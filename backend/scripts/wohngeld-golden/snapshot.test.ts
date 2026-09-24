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

test('Posteingang-Zustand: Ein-Personen-Haushalt, Ausweis wird zugeordnet', () => {
  const s = posteingangSnapshot([
    { typ: 'wohngeldantrag', stammdaten: { antragsteller: { vorname: 'Anna', nachname: 'Muster' }, wohnung: { miete: 500 } }, analyse: {} },
    { typ: 'personalausweis', analyse: {} },
  ]);
  expect(s.personen).toHaveLength(1);
  expect(s.dokumente[1]!.personId).toBe('P1');
  expect(s.zuordnungen.map((z) => z.grund)).toEqual(['haushalt', 'einzige-person']);
  expect(pruefeVorgang(s).map((b) => b.regelId)).not.toContain('identitaet-jede-person');
});

test('Posteingang-Zustand: Familie aus dem Antrag, Nachweise je Person, Kindergeld', () => {
  const s = posteingangSnapshot([
    {
      typ: 'wohngeldantrag', analyse: {},
      stammdaten: {
        antragsdatum: '2026-09-01', antragsteller: { vorname: 'Andrej', nachname: 'Weber', geburtsdatum: '1986-03-19' }, wohnung: { miete: 500 },
        haushalt: {
          mitglieder: [
            { vorname: 'Olga', nachname: 'Weber', geburtsdatum: '1988-11-27', verhaeltnis: 'Ehefrau', erwerbsstatus: 'Arbeitnehmer/in' },
            { vorname: 'Sofia', nachname: 'Weber', geburtsdatum: '2016-09-02', verhaeltnis: 'Tochter' },
          ],
          einnahmen: [
            { vorname: 'Andrej', nachname: 'Weber', art: 'Gehalt/Lohn', brutto: 2640 },
            { vorname: 'Olga', nachname: 'Weber', art: 'Minijob', brutto: 480 },
          ],
          behinderung: [], transfer: [],
        },
      },
    },
    { typ: 'personalausweis', identitaet: { vorname: 'Andrej', nachname: 'Weber', geburtsdatum: '1986-03-19' } },
    { typ: 'personalausweis', identitaet: { vorname: 'Olga', nachname: 'Weber', geburtsdatum: '1988-11-27' } },
    { typ: 'gehaltsabrechnung', identitaet: { vorname: 'Andrej', nachname: 'Weber' }, analyse: { betrag: 2640 } },
  ]);
  expect(s.personen.map((p) => p.rolle)).toEqual(['antragsteller', 'ehegatte', 'kind']);
  expect(s.dokumente.map((d) => d.personId)).toEqual([undefined, 'P1', 'P2', 'P1']);
  expect(s.personen[0]!.erhaelt_kindergeld).toBe(true);
  const ids = pruefeVorgang(s).map((b) => `${b.regelId}:${b.personId ?? ''}`);
  expect(ids).toContain('verdienstbescheinigung:P2');      // Minijob ohne Abrechnung
  expect(ids).toContain('kindergeld-nachweis:P1');         // Kind unter 18, kein Bescheid
  expect(ids).not.toContain('identitaet-jede-person:P3');  // Kind: kein Ausweis verlangt
  expect(ids).not.toContain('identitaet-jede-person:P1');
});
