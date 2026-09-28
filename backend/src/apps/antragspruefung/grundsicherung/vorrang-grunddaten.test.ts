import { describe, expect, test } from 'bun:test';
import { grunddatenFuerVorrangpruefung } from './vorrang-grunddaten';
import { vollstaendigkeit } from '../vorrang/grunddaten';
import type { Dokument, Person, Vorgang, VorgangSnapshot } from './types';

const basis = { version: 1, created_at: '', updated_at: '' };
function mkVorgang(over: Partial<Vorgang> = {}): Vorgang {
  return {
    ...basis, id: 'v1', akteId: 'a1', vorgangsnummer: 'G-1', antragsart: 'erstantrag',
    status: 'sachbearbeitung', prioritaet: 'normal', ...over,
  };
}
function mkPerson(over: Partial<Person>): Person {
  return { ...basis, id: 'p', vorgangId: 'v1', rolle: 'haushaltsangehoerig', nachname: '', vorname: '', ...over };
}
function mkDok(over: Partial<Dokument>): Dokument {
  return { ...basis, id: 'd', vorgangId: 'v1', typ: 'sonstiges', istOriginal: false, ...over };
}

/** Rentnerin mit Partner (EM-Rente) zur Miete, Wohngeldbescheid liegt bei. */
function grundsicherungPaar(): VorgangSnapshot {
  return {
    vorgang: mkVorgang({
      anspruchsgrund: 'alter', antragsdatum: '2026-08-20', wohnsituation: 'miete',
      ersteingang: { datum: '2026-08-03', stelle: 'Wohngeldstelle der Stadt' },
      vorbezug: { leistung: 'buergergeld', bis: '2026-07-31' },
      wohnung: {
        kaltmiete: 410, nebenkosten_kalt: 95, heizkosten: 70, warmwasser: 'zentral',
        wohnflaeche_qm: 55, bewohner_anzahl: 2,
      },
    }),
    personen: [
      mkPerson({
        id: 'p2', rolle: 'partner', vorname: 'Karl', nachname: 'Beispiel', geburtsdatum: '1968-04-11', familienstand: 'verheiratet',
        erwerbsminderung: { voll: true, dauerhaft: true },
        einkommen: [{ id: 'e3', art: 'em_rente', betrag_monat: 690 }],
        vermoegen: [],
        krankenversicherung: { art: 'pflicht' },
        schwerbehinderung: { gdb: 80, merkzeichen: ['G'] },
      }),
      mkPerson({
        id: 'p1', rolle: 'antragsteller', vorname: 'Anna', nachname: 'Beispiel', geburtsdatum: '1959-03-02', familienstand: 'verheiratet',
        einkommen: [
          { id: 'e1', art: 'altersrente', betrag_monat: 780 },
          { id: 'e2', art: 'zusatzversorgung', betrag_monat: 112 },
          { id: 'e4', art: 'wohngeld' },
        ],
        vermoegen: [
          { id: 'v1', art: 'girokonto', betrag: 1350 },
          { id: 'v2', art: 'bestattungsvorsorge', betrag: 3500, schonvermoegen: true },
        ],
        krankenversicherung: { art: 'freiwillig', beitrag: 205.3 },
      }),
    ],
    dokumente: [
      mkDok({ id: 'd1', typ: 'grundsicherungsantrag', eingegangenAm: '2026-08-20' }),
      mkDok({ id: 'd2', typ: 'wohngeldbescheid', personId: 'p1', analyse: { betrag_monat: 140, bwz_von: '2026-03-01', bwz_bis: '2027-02-28' } }),
    ],
  };
}

describe('Grundsicherung → Vorrang-Grunddaten', () => {
  const g = grunddatenFuerVorrangpruefung(grundsicherungPaar());

  test('Einsatzgemeinschaft: Antragstellerin zuerst, Partner mit Verwandtschaft aus Familienstand', () => {
    expect(g.quelle).toBe('grundsicherung');
    // maßgebliches Antragsdatum = Ersteingang (§ 16 Abs. 2 SGB I)
    expect(g.stichtag).toBe('2026-08-03');
    expect(g.haushalt).toEqual([
      { rolle: 'antragsteller', geburtsdatum: '1959-03-02', verwandtschaft: undefined, vermoegen_angegeben: true, personId: 'p1' },
      { rolle: 'partner', geburtsdatum: '1968-04-11', verwandtschaft: 'ehegatte', vermoegen_angegeben: true, personId: 'p2' },
    ]);
    expect(g.partnerschaft).toBe('verheiratet');
  });

  test('Einkommensarten und Rentenarten abgebildet; fehlender Betrag bleibt undefined', () => {
    expect(g.einkommen).toEqual([
      { person: 0, art: 'gesetzliche_rente', art_quelle: 'altersrente', rentenart: 'alter', betrag_monat: 780 },
      { person: 0, art: 'betriebs_privatrente', art_quelle: 'zusatzversorgung', betrag_monat: 112 },
      { person: 0, art: 'wohngeld', art_quelle: 'wohngeld', betrag_monat: undefined },
      { person: 1, art: 'gesetzliche_rente', art_quelle: 'em_rente', rentenart: 'volle_em', betrag_monat: 690 },
    ]);
    expect(g.einkommen[0]!.brutto).toBeUndefined();
  });

  test('Vermögensarten mit Schonvermögen-Vermerk', () => {
    expect(g.vermoegen).toEqual([
      { person: 0, art: 'konto', art_quelle: 'girokonto', betrag: 1350 },
      { person: 0, art: 'bestattungsvorsorge', art_quelle: 'bestattungsvorsorge', betrag: 3500, schonvermoegen: true },
    ]);
  });

  test('Wohnkosten getrennt, keine Bruttokaltmiete gebildet', () => {
    expect(g.wohnkosten).toEqual({
      kaltmiete: 410, nebenkosten_kalt: 95, heizkosten: 70, warmwasser_erzeugung: 'zentral',
      heizung_in_miete: undefined, wohnflaeche_qm: 55, bewohner: 2, eigentum: false,
    });
    expect(g.wohnkosten.bruttokaltmiete).toBeUndefined();
  });

  test('Alter/Erwerbsminderung, Schwerbehinderung, KV/PV-Abzüge', () => {
    // 1959 → 66 J. 2 M. → 01.05.2025
    expect(g.alter_em).toEqual([
      { person: 0, altersgrenze_erreicht: true, altersgrenze_am: '2025-05-01', em_voll_dauerhaft: undefined },
      { person: 1, altersgrenze_erreicht: false, altersgrenze_am: '2035-04-10', em_voll_dauerhaft: true },
    ]);
    expect(g.schwerbehinderung).toEqual([{ person: 0, gdb: undefined }, { person: 1, gdb: 80, merkzeichen: ['G'] }]);
    expect(g.abzuege).toEqual([
      { person: 0, kv_pv_selbst_gezahlt: true, kv_pv_beitrag_monat: 205.3 },
      { person: 1, kv_pv_selbst_gezahlt: false, kv_pv_beitrag_monat: undefined },
    ]);
  });

  test('Transferleistungen aus Einkommen, Vorbezug und Wohngeldbescheid; Ersteingang bei der Wohngeldstelle', () => {
    expect(g.transferleistungen).toEqual([
      { person: 0, art: 'wohngeld', art_quelle: 'wohngeld', stand: 'bezug', herkunft: 'angabe' },
      { art: 'sgb2', art_quelle: 'buergergeld', stand: 'bezug', bis: '2026-07-31', herkunft: 'angabe' },
      { person: 0, art: 'wohngeld', art_quelle: 'wohngeldbescheid', stand: 'bezug', von: '2026-03-01', bis: '2027-02-28', herkunft: 'dokument' },
    ]);
    expect(g.eingang).toEqual({
      antragsdatum: '2026-08-20', datum: '2026-08-03', erste_stelle: 'wohngeldstelle',
      erste_stelle_bezeichnung: 'Wohngeldstelle der Stadt',
    });
  });

  test('Vollständigkeit: nur der fehlende Wohngeld-Betrag', () => {
    expect(vollstaendigkeit(g).fehlend).toEqual(['einkommen[2].betrag_monat']);
  });
});

describe('Grundsicherung → Vorrang-Grunddaten: Sonderfälle', () => {
  test('ohne Angaben bleibt alles unbekannt statt geraten', () => {
    const g = grunddatenFuerVorrangpruefung({
      vorgang: mkVorgang(),
      personen: [mkPerson({ id: 'p1', rolle: 'antragsteller' })],
      dokumente: [],
    });
    expect(g.stichtag).toBeUndefined();
    expect(g.partnerschaft).toBeUndefined();
    expect(g.haushalt[0]!.vermoegen_angegeben).toBeUndefined();
    expect(g.wohnkosten.eigentum).toBeUndefined();
    expect(g.alter_em[0]).toEqual({ person: 0, altersgrenze_erreicht: undefined, altersgrenze_am: undefined, em_voll_dauerhaft: undefined });
    expect(g.abzuege[0]).toEqual({ person: 0, kv_pv_selbst_gezahlt: undefined, kv_pv_beitrag_monat: undefined });
    expect(g.eingang).toEqual({ antragsdatum: undefined, datum: undefined, erste_stelle: 'grundsicherungstraeger' });
    expect(vollstaendigkeit(g).fehlend).toEqual([
      'haushalt[0].geburtsdatum', 'haushalt[0].vermoegen_angegeben', 'partnerschaft', 'einkommen',
      'wohnkosten.eigentum', 'wohnkosten.kaltmiete', 'wohnkosten.nebenkosten_kalt', 'wohnkosten.heizkosten',
      'wohnkosten.wohnflaeche_qm', 'wohnkosten.bewohner',
      'alter_em[0].altersgrenze_erreicht', 'alter_em[0].em_voll_dauerhaft', 'eingang.datum',
    ]);
  });

  test('Alleinstehend verwitwet → „keine"; befristete EM → nicht dauerhaft; Eigentum; paralleler Wohngeldantrag', () => {
    const g = grunddatenFuerVorrangpruefung({
      vorgang: mkVorgang({ anspruchsgrund: 'erwerbsminderung', antragsdatum: '2026-08-01', wohnsituation: 'eigentum', wohngeld_antrag_laeuft: true }),
      personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', familienstand: 'verwitwet', geburtsdatum: '1970-01-01', erwerbsminderung: { voll: true, befristet_bis: '2027-12-31' } })],
      dokumente: [],
    });
    expect(g.partnerschaft).toBe('keine');
    expect(g.alter_em[0]!.em_voll_dauerhaft).toBe(false);
    expect(g.wohnkosten.eigentum).toBe(true);
    expect(g.transferleistungen).toEqual([{ art: 'wohngeld', art_quelle: 'wohngeld_antrag_laeuft', stand: 'beantragt', herkunft: 'angabe' }]);
    expect(g.eingang.erste_stelle).toBe('grundsicherungstraeger');
  });
});
