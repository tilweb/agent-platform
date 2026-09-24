import { describe, expect, test } from 'bun:test';
import {
  alterAm, ausschlussGrundAusText, einkommensArtAusText, erwerbsstatusAusText, kindergeldEmpfaenger,
  normName, ordneNachweisZu, personenAusAntrag, rolleAusVerhaeltnis,
} from './haushalt';
import type { ExtrahierteStammdaten } from './extraction';

const FAMILIE: ExtrahierteStammdaten = {
  antragsdatum: '2026-09-01',
  antragsteller: { vorname: 'Andrej', nachname: 'Weber', geburtsdatum: '1986-03-19' },
  haushalt: {
    antragstellerErwerbsstatus: 'Arbeitnehmer/in',
    mitglieder: [
      { vorname: 'Olga', nachname: 'Weber', geburtsdatum: '1988-11-27', verhaeltnis: 'Ehefrau', erwerbsstatus: 'Arbeitnehmer/in' },
      { vorname: 'Sofia', nachname: 'Weber', geburtsdatum: '2016-09-02', verhaeltnis: 'Tochter', erwerbsstatus: 'Nichterwerbsperson' },
    ],
    einnahmen: [
      { vorname: 'Andrej', nachname: 'Weber', art: 'Gehalt/Lohn', brutto: 2640, turnus: 'monatlich' },
      { vorname: 'Olga', nachname: 'Weber', art: 'Minijob (geringfügige Beschäftigung)', brutto: 480, turnus: 'monatlich' },
      { vorname: 'Sofia', nachname: 'Weber', art: 'keine Einnahmen' },
    ],
    behinderung: [{ vorname: 'Olga', nachname: 'Weber', gdb: 50 }],
    transfer: [],
  },
};

describe('Formulartexte', () => {
  test('Namen ohne Diakritika', () => {
    expect(normName('Şeyma Kılıç')).toBe('seyma kilic');
    expect(normName('Müller-Lüdenscheidt')).toBe('mueller-luedenscheidt');
  });
  test('Rolle aus Verhältnis', () => {
    expect(rolleAusVerhaeltnis('Ehefrau')).toBe('ehegatte');
    expect(rolleAusVerhaeltnis('Lebensgefährte')).toBe('lebenspartner');
    expect(rolleAusVerhaeltnis('Sohn')).toBe('kind');
    expect(rolleAusVerhaeltnis('Pflegekind')).toBe('kind');
    expect(rolleAusVerhaeltnis('Mutter')).toBe('haushaltsmitglied');
  });
  test('Erwerbsstatus', () => {
    expect(erwerbsstatusAusText('Arbeitnehmer/in')).toBe('angestellt');
    expect(erwerbsstatusAusText('Rentner/in oder Pensionär/in')).toBe('rente_pension');
    expect(erwerbsstatusAusText('Auszubildende/r oder Student/in')).toBe('ausbildung_studium');
    expect(erwerbsstatusAusText('sonstige Nichterwerbsperson')).toBe('ohne_erwerb');
    expect(erwerbsstatusAusText('zurzeit arbeitslos')).toBe('arbeitslos');
    expect(erwerbsstatusAusText(undefined)).toBeUndefined();
  });
  test('Einkommensart', () => {
    expect(einkommensArtAusText('Gehalt/Lohn')).toBe('lohn_gehalt');
    expect(einkommensArtAusText('Minijob')).toBe('lohn_gehalt');
    expect(einkommensArtAusText('Altersrente')).toBe('rente');
    expect(einkommensArtAusText('Arbeitslosengeld')).toBe('alg1');
    expect(einkommensArtAusText('keine Einnahmen')).toBeNull();
    expect(einkommensArtAusText('Einkünfte aus selbständiger Arbeit')).toBe('selbststaendig');
  });
  test('Ausschlussgrund', () => {
    expect(ausschlussGrundAusText('Bürgergeld (SGB II)')).toBe('sgb2_buergergeld');
    expect(ausschlussGrundAusText('Grundsicherung im Alter')).toBe('grundsicherung_alter_em');
    expect(ausschlussGrundAusText('Leistungen nach dem Asylbewerberleistungsgesetz')).toBe('asylblg');
    expect(ausschlussGrundAusText('etwas anderes')).toBe('sonstiger_grund');
  });
  test('Alter zum Stichtag', () => {
    expect(alterAm('2008-09-02', '2026-09-01')).toBe(17);
    expect(alterAm('2008-09-01', '2026-09-01')).toBe(18);
    expect(alterAm('01.09.2008', '2026-09-01')).toBe(18);
    expect(alterAm(undefined, '2026-09-01')).toBeUndefined();
  });
});

describe('personenAusAntrag', () => {
  test('legt Antragsteller und Haushaltsmitglieder mit Merkmalen an', () => {
    const { personen, nichtZugeordnet } = personenAusAntrag(FAMILIE);
    expect(nichtZugeordnet).toBe(0);
    expect(personen.map((p) => [p.schluessel, p.rolle, p.vorname, p.erwerbsstatus])).toEqual([
      ['P1', 'antragsteller', 'Andrej', 'angestellt'],
      ['P2', 'ehegatte', 'Olga', 'angestellt'],
      ['P3', 'kind', 'Sofia', 'ohne_erwerb'],
    ]);
    expect(personen[0]!.einkommen?.map((e) => [e.art, e.betrag_monatlich, e.beruecksichtigt])).toEqual([['lohn_gehalt', 2640, false]]);
    expect(personen[1]!.einkommen?.[0]?.art).toBe('lohn_gehalt');
    expect(personen[2]!.einkommen).toBeUndefined();
    expect(personen[1]!.pflege_behinderung).toEqual({ schwerbehinderungsgrad: 50 });
  });

  test('ohne Antragsteller-Namen keine Personen', () => {
    expect(personenAusAntrag({ antragsteller: {} }).personen).toEqual([]);
    expect(personenAusAntrag(undefined).personen).toEqual([]);
  });

  test('nur laufende Transferleistung wird Ausschlussgrund; Vermögen am Antragsteller', () => {
    const { personen } = personenAusAntrag({
      antragsteller: { vorname: 'Kai', nachname: 'Brandt' },
      haushalt: {
        mitglieder: [{ vorname: 'Lea', nachname: 'Brandt', verhaeltnis: 'Tochter' }],
        einnahmen: [{ vorname: 'Kai', nachname: 'Brandt', art: 'Zinsen', brutto: 1200, turnus: 'jährlich' }],
        behinderung: [],
        transfer: [
          { vorname: 'Kai', nachname: 'Brandt', leistung: 'Bürgergeld (SGB II)', bewilligt: '2026-05-01' },
          { vorname: 'Lea', nachname: 'Brandt', leistung: 'Bürgergeld (SGB II)', bewilligt: '2025-01-01', weggefallen: '2026-01-31' },
        ],
        vermoegen: 95000,
      },
    });
    expect(personen[0]!.ausschluesse?.map((a) => a.grund)).toEqual(['sgb2_buergergeld']);
    expect(personen[1]!.ausschluesse).toBeUndefined();
    expect(personen[0]!.vermoegen).toBe(95000);
    expect(personen[0]!.einkommen?.[0]).toMatchObject({ art: 'kapitalertraege', betrag_jaehrlich: 1200 });
  });

  test('nicht zuordenbarer Block wird gezählt, nicht geraten', () => {
    const { personen, nichtZugeordnet } = personenAusAntrag({
      antragsteller: { vorname: 'Kai', nachname: 'Brandt' },
      haushalt: { mitglieder: [], einnahmen: [{ vorname: 'Jemand', nachname: 'Anders', art: 'Gehalt/Lohn', brutto: 1 }], behinderung: [], transfer: [] },
    });
    expect(nichtZugeordnet).toBe(1);
    expect(personen[0]!.einkommen).toBeUndefined();
  });

  test('Mitglied ohne Nachnamen erbt den des Antragstellers', () => {
    const { personen } = personenAusAntrag({
      antragsteller: { vorname: 'Kai', nachname: 'Brandt' },
      haushalt: { mitglieder: [{ vorname: 'Lea', verhaeltnis: 'Tochter' }], einnahmen: [], behinderung: [], transfer: [] },
    });
    expect(personen[1]!.nachname).toBe('Brandt');
  });
});

describe('ordneNachweisZu', () => {
  const P = [
    { id: 'a', vorname: 'Andrej', nachname: 'Weber', geburtsdatum: '1986-03-19' },
    { id: 'b', vorname: 'Olga', nachname: 'Weber', geburtsdatum: '1988-11-27' },
    { id: 'c', vorname: 'Sofia', nachname: 'Weber', geburtsdatum: '2016-09-02' },
  ];
  test('Geburtsdatum entscheidet', () => {
    expect(ordneNachweisZu('personalausweis', { nachname: 'WEBER', vorname: 'OLGA', geburtsdatum: '27.11.1988' }, P)).toEqual({ personId: 'b', grund: 'geburtsdatum' });
  });
  test('Vor- und Nachname in der Familie', () => {
    expect(ordneNachweisZu('gehaltsabrechnung', { nachname: 'Weber', vorname: 'Andrej' }, P)).toEqual({ personId: 'a', grund: 'name' });
  });
  test('nur Nachname in der Familie ist mehrdeutig', () => {
    expect(ordneNachweisZu('rentenbescheid', { nachname: 'Weber' }, P)).toEqual({ grund: 'unklar' });
  });
  test('Widerspruch Name ↔ Geburtsdatum ⇒ unklar', () => {
    expect(ordneNachweisZu('personalausweis', { nachname: 'Weber', vorname: 'Olga', geburtsdatum: '1990-01-01' }, P)).toEqual({ grund: 'unklar' });
  });
  test('abweichender Nachname (Geburtsname) mit eindeutigem Vornamen', () => {
    expect(ordneNachweisZu('kv_pv_nachweis', { nachname: 'Schmidt', vorname: 'Olga' }, P)).toEqual({ personId: 'b', grund: 'name' });
  });
  test('mehrere Vornamen, Diakritika', () => {
    const Q = [{ id: 'x', vorname: 'Şeyma', nachname: 'Kılıç' }, { id: 'y', vorname: 'Elif', nachname: 'Kılıç' }];
    expect(ordneNachweisZu('gehaltsabrechnung', { vorname: 'Seyma', nachname: 'Kilic' }, Q)).toEqual({ personId: 'x', grund: 'name' });
    expect(ordneNachweisZu('kontoauszug', { vorname: 'Duc Anh', nachname: 'Nguyen' }, [{ id: 'n', vorname: 'Duc Anh', nachname: 'Nguyen' }, { id: 'm', vorname: 'Thi Mai', nachname: 'Nguyen' }])).toEqual({ personId: 'n', grund: 'name' });
  });
  test('Haushaltsunterlagen bekommen keine Person', () => {
    expect(ordneNachweisZu('mietvertrag', { nachname: 'Weber', vorname: 'Andrej' }, P)).toEqual({ grund: 'haushalt' });
    expect(ordneNachweisZu('wohngeldantrag', undefined, P)).toEqual({ grund: 'haushalt' });
  });
  test('Ein-Personen-Haushalt ohne gelesene Identität', () => {
    expect(ordneNachweisZu('kontoauszug', undefined, [P[0]!])).toEqual({ personId: 'a', grund: 'einzige-person' });
    expect(ordneNachweisZu('kontoauszug', undefined, P)).toEqual({ grund: 'unklar' });
  });
  test('Ein-Personen-Haushalt mit fremdem Namen ⇒ unklar', () => {
    expect(ordneNachweisZu('gehaltsabrechnung', { vorname: 'Kevin', nachname: 'Brandes' }, [P[0]!])).toEqual({ grund: 'unklar' });
  });
  test('ohne Personen', () => {
    expect(ordneNachweisZu('personalausweis', { nachname: 'X' }, [])).toEqual({ grund: 'keine-person' });
  });
});

describe('kindergeldEmpfaenger', () => {
  const P = [
    { id: 'a', rolle: 'antragsteller' as const, geburtsdatum: '1986-03-19' },
    { id: 'b', rolle: 'ehegatte' as const, geburtsdatum: '1988-11-27' },
    { id: 'c', rolle: 'kind' as const, geburtsdatum: '2016-09-02' },
  ];
  test('Bescheid bestimmt die Person', () => {
    expect(kindergeldEmpfaenger(P, [{ typ: 'kindergeldnachweis', personId: 'b' }], '2026-09-01')).toBe('b');
  });
  test('ohne Bescheid die antragstellende Person', () => {
    expect(kindergeldEmpfaenger(P, [], '2026-09-01')).toBe('a');
  });
  test('ohne Kinder unter 18 kein Kindergeld', () => {
    expect(kindergeldEmpfaenger([P[0]!, { id: 'd', rolle: 'kind', geburtsdatum: '2000-01-01' }], [], '2026-09-01')).toBeUndefined();
  });
});
