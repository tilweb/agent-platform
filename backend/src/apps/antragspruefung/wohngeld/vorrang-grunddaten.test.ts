import { describe, expect, test } from 'bun:test';
import { grunddatenFuerVorrangpruefung, rentenartAusText } from './vorrang-grunddaten';
import { vollstaendigkeit } from '../vorrang/grunddaten';
import type { Dokument, Person, Vorgang, VorgangSnapshot } from './types';

const basis = { version: 1, created_at: '', updated_at: '' };
function mkVorgang(over: Partial<Vorgang> = {}): Vorgang {
  return {
    ...basis, id: 'v1', akteId: 'a1', antragsId: 'W-1', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag',
    status: 'sachbearbeitung', prioritaet: 'normal', ...over,
  };
}
function mkPerson(over: Partial<Person>): Person {
  return { ...basis, id: 'p', vorgangId: 'v1', rolle: 'haushaltsmitglied', nachname: '', vorname: '', ...over };
}
function mkDok(over: Partial<Dokument>): Dokument {
  return { ...basis, id: 'd', vorgangId: 'v1', typ: 'sonstiges', istOriginal: false, ...over };
}

/** Rentnerehepaar zur Miete — realistischer Wohngeld-Erstantrag. */
function wohngeldRentnerpaar(): VorgangSnapshot {
  return {
    vorgang: mkVorgang({
      antragsdatum: '2026-08-12',
      wohnung: { miete: 612.5, heizkosten: 95, warmwasser: 18, wohnflaeche_qm: 58 },
    }),
    personen: [
      mkPerson({
        id: 'p2', rolle: 'ehegatte', vorname: 'Erika', nachname: 'Muster', geburtsdatum: '1956-02-03', familienstand: 'verheiratet',
        einkommen: [{ id: 'e3', art: 'rente', betrag_jaehrlich: 6000, beruecksichtigt: true }],
        pflege_behinderung: { schwerbehinderungsgrad: 50 },
      }),
      mkPerson({
        id: 'p1', rolle: 'antragsteller', vorname: 'Hans', nachname: 'Muster', geburtsdatum: '1958-05-20', familienstand: 'verheiratet',
        einkommen: [
          { id: 'e1', art: 'rente', betrag_monatlich: 1080, beruecksichtigt: true },
          { id: 'e2', art: 'kapitalertraege', betrag_monatlich: 12.4, beruecksichtigt: false },
        ],
        vermoegenPositionen: [
          { id: 'v1', art: 'Bankguthaben', betrag: 4200 },
          { id: 'v2', art: 'Bausparvertrag', betrag: 1800 },
          { id: 'v3', art: 'Wertpapierdepot' },
        ],
      }),
    ],
    dokumente: [
      mkDok({ id: 'd1', typ: 'wohngeldantrag', eingegangenAm: '2026-08-14' }),
      mkDok({
        id: 'd2', typ: 'rentenbescheid', personId: 'p1',
        profil: { abschnitt: 'rentenbescheid', konfidenz: 0.9, quelle: 'vorlage', rohwerte: { rentenart: 'Regelaltersrente' } },
      }),
    ],
  };
}

describe('Wohngeld → Vorrang-Grunddaten', () => {
  const g = grunddatenFuerVorrangpruefung(wohngeldRentnerpaar());

  test('Haushalt: Antragsteller zuerst, Ehegatte eindeutig als Partner', () => {
    expect(g.quelle).toBe('wohngeld');
    expect(g.stichtag).toBe('2026-08-12');
    expect(g.haushalt.map((h) => [h.rolle, h.verwandtschaft, h.personId])).toEqual([
      ['antragsteller', undefined, 'p1'],
      ['partner', 'ehegatte', 'p2'],
    ]);
    expect(g.partnerschaft).toBe('verheiratet');
    expect(g.haushalt[0]!.vermoegen_angegeben).toBe(true);
    expect(g.haushalt[1]!.vermoegen_angegeben).toBeUndefined();
  });

  test('Einkommensarten abgebildet, Jahresbetrag auf Monat, Rentenart aus dem Bescheid', () => {
    expect(g.einkommen).toEqual([
      { person: 0, art: 'rente_unbestimmt', art_quelle: 'rente', rentenart: 'alter', betrag_monat: 1080, brutto: true },
      { person: 0, art: 'kapital', art_quelle: 'kapitalertraege', betrag_monat: 12.4, brutto: true },
      { person: 1, art: 'rente_unbestimmt', art_quelle: 'rente', betrag_monat: 500, brutto: true },
    ]);
  });

  test('Vermögensarten aus Freitext, fehlender Betrag bleibt undefined', () => {
    expect(g.vermoegen).toEqual([
      { person: 0, art: 'konto', art_quelle: 'Bankguthaben', betrag: 4200 },
      { person: 0, art: 'bausparvertrag', art_quelle: 'Bausparvertrag', betrag: 1800 },
      { person: 0, art: 'wertpapiere', art_quelle: 'Wertpapierdepot', betrag: undefined },
    ]);
    expect(g.vermoegen[2]!.schonvermoegen).toBeUndefined();
  });

  test('Bruttokaltmiete statt getrennter Kosten; nicht erfasste Wohnwerte bleiben leer', () => {
    expect(g.wohnkosten.bruttokaltmiete).toBe(612.5);
    expect(g.wohnkosten.kaltmiete).toBeUndefined();
    expect(g.wohnkosten.nebenkosten_kalt).toBeUndefined();
    expect(g.wohnkosten.heizkosten).toBe(95);
    expect(g.wohnkosten.warmwasser_kosten).toBe(18);
    expect(g.wohnkosten.warmwasser_erzeugung).toBeUndefined();
    expect(g.wohnkosten.bewohner).toBeUndefined();
    expect(g.wohnkosten.eigentum).toBe(false);
  });

  test('Altersgrenze aus Geburtsdatum, Erwerbsminderung unbekannt, Schwerbehinderung ohne Merkzeichen', () => {
    // 1958 → 66 Jahre: 20.05.2024; 1956 → 65 J. 10 M.
    expect(g.alter_em[0]).toEqual({ person: 0, altersgrenze_erreicht: true, altersgrenze_am: '2024-05-19', em_voll_dauerhaft: undefined });
    expect(g.alter_em[1]!.altersgrenze_erreicht).toBe(true);
    expect(g.schwerbehinderung).toEqual([{ person: 0, gdb: undefined }, { person: 1, gdb: 50 }]);
    expect(g.schwerbehinderung[1]!.merkzeichen).toBeUndefined();
    expect(g.abzuege).toEqual([{ person: 0 }, { person: 1 }]);
  });

  test('Eingang: Antragsdatum und Eingangsstempel des Antrags, Wohngeldstelle', () => {
    expect(g.eingang).toEqual({ antragsdatum: '2026-08-12', datum: '2026-08-14', erste_stelle: 'wohngeldstelle' });
    expect(g.transferleistungen).toEqual([]);
  });

  test('Vollständigkeit nennt nur die Lücken der Wohngeld-Erfassung', () => {
    expect(vollstaendigkeit(g).fehlend).toEqual([
      'haushalt[1].vermoegen_angegeben', 'vermoegen[2].betrag', 'wohnkosten.bewohner',
    ]);
  });
});

describe('Wohngeld → Vorrang-Grunddaten: Sonderfälle', () => {
  test('zwei Ehe-/Lebenspartner-Personen → nicht eindeutig, alle haushaltsangehörig', () => {
    const s = wohngeldRentnerpaar();
    s.personen.push(mkPerson({ id: 'p3', rolle: 'lebenspartner', vorname: 'X', nachname: 'Y' }));
    const g = grunddatenFuerVorrangpruefung(s);
    expect(g.haushalt.filter((h) => h.rolle === 'partner')).toEqual([]);
    expect(g.partnerschaft).toBeUndefined();
  });

  test('getrennt lebender Ehegatte ist kein Partner', () => {
    const s = wohngeldRentnerpaar();
    s.personen[0]!.familienstand = 'getrennt_lebend';
    const g = grunddatenFuerVorrangpruefung(s);
    expect(g.haushalt.map((h) => h.rolle)).toEqual(['antragsteller', 'haushaltsangehoerig']);
    expect(g.partnerschaft).toBeUndefined();
  });

  test('Alleinstehende: Partnerschaft „keine"; Lastenzuschuss = Eigentum; ohne Antragsdatum Altersgrenze unbekannt', () => {
    const g = grunddatenFuerVorrangpruefung({
      vorgang: mkVorgang({ wohngeldart: 'lastenzuschuss' }),
      personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', geburtsdatum: '1950-01-01', vermoegen: 0 })],
      dokumente: [],
    });
    expect(g.partnerschaft).toBe('keine');
    expect(g.wohnkosten.eigentum).toBe(true);
    expect(g.wohnkosten.bruttokaltmiete).toBeUndefined();
    expect(g.alter_em[0]!.altersgrenze_erreicht).toBeUndefined();
    expect(g.haushalt[0]!.vermoegen_angegeben).toBe(true);
    expect(g.vermoegen).toEqual([]);
    expect(vollstaendigkeit(g).fehlend).toContain('eingang.datum');
  });

  test('§-7-Ausschlüsse und Legacy-Transferleistungen werden Transferleistungen', () => {
    const g = grunddatenFuerVorrangpruefung({
      vorgang: mkVorgang({ antragsdatum: '2026-08-01' }),
      personen: [
        mkPerson({ id: 'p1', rolle: 'antragsteller', ausschluesse: [{ id: 'a1', grund: 'grundsicherung_alter_em', von: '2025-01-01' }] }),
        mkPerson({ id: 'p2', rolle: 'kind', transferleistungen: ['Bürgergeld'] }),
      ],
      dokumente: [],
    });
    expect(g.transferleistungen).toEqual([
      { person: 0, art: 'grundsicherung', art_quelle: 'grundsicherung_alter_em', stand: 'bezug', von: '2025-01-01', bis: undefined, herkunft: 'angabe' },
      { person: 1, art: 'sgb2', art_quelle: 'Bürgergeld', stand: 'bezug', herkunft: 'angabe' },
    ]);
    expect(g.haushalt[1]!.verwandtschaft).toBe('kind');
  });
});

describe('rentenartAusText', () => {
  test('Rentenarten und Dauer der Erwerbsminderung', () => {
    expect(rentenartAusText('Regelaltersrente')).toEqual({ rentenart: 'alter' });
    expect(rentenartAusText('Große Witwenrente')).toEqual({ rentenart: 'hinterbliebene' });
    expect(rentenartAusText('Rente wegen voller Erwerbsminderung')).toEqual({ rentenart: 'volle_em', dauerhaft: undefined });
    expect(rentenartAusText('Rente wegen voller Erwerbsminderung, unbefristet')).toEqual({ rentenart: 'volle_em', dauerhaft: true });
    expect(rentenartAusText('Rente wegen voller Erwerbsminderung auf Zeit bis 31.12.2027')).toEqual({ rentenart: 'volle_em', dauerhaft: false });
    expect(rentenartAusText('Rente wegen teilweiser Erwerbsminderung').rentenart).toBe('teilweise_em');
    expect(rentenartAusText(undefined)).toEqual({});
  });
});
