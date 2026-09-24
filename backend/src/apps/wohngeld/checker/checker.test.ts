/**
 * Goldfall „Petermann" — Abnahme-Test der Regel-Engine.
 * Quelle: docs/wohngeld-goldfall-petermann-2026-09-18.md
 */
import { test, expect, describe } from 'bun:test';
import { pruefeVorgang } from './index';
import type { Vorgang, Person, Dokument, VorgangSnapshot, PruefBefund } from '../types';

function mkVorgang(over: Partial<Vorgang> = {}): Vorgang {
  return {
    id: 'v1', akteId: 'a1', antragsId: '104-556-230', wohngeldart: 'mietzuschuss',
    antragsart: 'erstantrag', status: 'sachbearbeitung', prioritaet: 'normal',
    antragsdatum: '2026-08-12', wohnung: { miete: 704, wohnflaeche_qm: 63 },
    version: 1, created_at: '', updated_at: '', ...over,
  };
}
function mkPerson(over: Partial<Person>): Person {
  return {
    id: 'p', vorgangId: 'v1', rolle: 'haushaltsmitglied', nachname: '', vorname: '',
    version: 1, created_at: '', updated_at: '', ...over,
  };
}
function mkDok(over: Partial<Dokument>): Dokument {
  return {
    id: 'd', vorgangId: 'v1', typ: 'sonstiges', istOriginal: false,
    version: 1, created_at: '', updated_at: '', ...over,
  };
}

function buildPetermann(): VorgangSnapshot {
  const p1 = mkPerson({
    id: 'person-p1', rolle: 'antragsteller', vorname: 'Siegfried', nachname: 'Petermann',
    erwerbsstatus: 'rente_pension', vermoegen: 12500,
    einkommen: [
      { id: 'e1', art: 'rente', betrag_monatlich: 686, beruecksichtigt: true },
      { id: 'e2', art: 'lohn_gehalt', betrag_monatlich: 980, beruecksichtigt: true },
    ],
  });
  const p2 = mkPerson({
    id: 'person-p2', rolle: 'ehegatte', vorname: 'Marion Henriette', nachname: 'Petermann',
    erwerbsstatus: 'rente_pension',
    einkommen: [{ id: 'e1', art: 'rente', betrag_monatlich: 874.86, beruecksichtigt: true }],
  });
  const dokumente: Dokument[] = [
    mkDok({ id: 'd1', typ: 'wohngeldantrag', analyse: { unterschrift_vorhanden: true, datum_vorhanden: false } }),
    mkDok({ id: 'd2', typ: 'rentenbescheid', personId: 'person-p2', analyse: { rentenart_vorhanden: true, grundrentenzeiten_vorhanden: false } }),
    mkDok({ id: 'd3', typ: 'kontoauszug', personId: 'person-p1', analyse: { mietzahlung_erkannt: false, erkannte_einkuenfte: ['kapitalertraege'] } }),
    mkDok({ id: 'd4', typ: 'mietvertrag', analyse: { miete: 690, wohnflaeche_qm: 120, unterschrift_vorhanden: false } }),
  ];
  return { vorgang: mkVorgang(), personen: [p1, p2], dokumente };
}

function has(befunde: PruefBefund[], regelId: string, personId?: string): boolean {
  return befunde.some(b => b.regelId === regelId && (personId === undefined || b.personId === personId));
}

describe('Goldfall Petermann — Regel-Engine', () => {
  const befunde = pruefeVorgang(buildPetermann());

  test('Identitätsnachweis fehlt für beide Personen', () => {
    expect(has(befunde, 'identitaet-jede-person', 'person-p1')).toBe(true);
    expect(has(befunde, 'identitaet-jede-person', 'person-p2')).toBe(true);
  });

  test('Rentenbescheid nur für P1 offen (P2 liegt vor)', () => {
    expect(has(befunde, 'rentenbescheid', 'person-p1')).toBe(true);
    expect(has(befunde, 'rentenbescheid', 'person-p2')).toBe(false);
  });

  test('Verdienstbescheinigung für P1 (Lohn/Gehalt angegeben)', () => {
    expect(has(befunde, 'verdienstbescheinigung', 'person-p1')).toBe(true);
  });

  test('Vermögensnachweis für P1 (Bankguthaben 12.500 €)', () => {
    expect(has(befunde, 'vermoegensnachweise', 'person-p1')).toBe(true);
  });

  test('Kranken-/Pflegeversicherung für beide Personen', () => {
    expect(has(befunde, 'krankenversicherung-nachweis', 'person-p1')).toBe(true);
    expect(has(befunde, 'krankenversicherung-nachweis', 'person-p2')).toBe(true);
  });

  test('Vermieterbescheinigung fehlt (Mietvertrag liegt vor → nicht gefordert)', () => {
    expect(has(befunde, 'vermieterbescheinigung')).toBe(true);
    expect(has(befunde, 'mietvertrag')).toBe(false);
  });

  test('Mietzahlungsnachweis (Vollständigkeit) erfüllt, da Kontoauszug vorliegt', () => {
    expect(has(befunde, 'mietzahlungsnachweis')).toBe(false);
  });

  test('Plausibilität: Antrag ohne Datum', () => {
    expect(has(befunde, 'plausi-antrag-ohne-datum')).toBe(true);
    expect(has(befunde, 'plausi-antrag-ohne-unterschrift')).toBe(false); // ist unterschrieben
  });

  test('Plausibilität: Miethöhe (704 ↔ 690) und Wohnfläche (63 ↔ 120)', () => {
    expect(has(befunde, 'plausi-miethoehe-abweichung')).toBe(true);
    expect(has(befunde, 'plausi-wohnflaeche-abweichung')).toBe(true);
  });

  test('Plausibilität: Mietvertrag ohne Unterschrift', () => {
    expect(has(befunde, 'plausi-mietvertrag-unsigniert')).toBe(true);
  });

  test('Plausibilität: Mietzahlung nicht belegt (P1)', () => {
    expect(has(befunde, 'plausi-mietzahlung-fehlt', 'person-p1')).toBe(true);
  });

  test('Plausibilität: unerklärte Kapitalerträge auf Kontoauszug (P1)', () => {
    expect(has(befunde, 'plausi-kontoauszug-unerklaerte-einkuenfte:kapitalertraege', 'person-p1')).toBe(true);
  });

  test('Plausibilität: Grundrentenzeiten/Rentenart fehlen (P2)', () => {
    expect(has(befunde, 'plausi-rentenart-fehlt', 'person-p2')).toBe(true);
  });

  test('Miethöhe-Befund nennt konkrete Differenz im Belegtext', () => {
    const b = befunde.find(x => x.regelId === 'plausi-miethoehe-abweichung');
    expect(b?.belegtext).toContain('14');
  });
});

describe('Essenzielle Angaben — Vollständigkeit der Kernangaben', () => {
  function vollstaendigerFall(): VorgangSnapshot {
    return {
      vorgang: mkVorgang({
        antragsdatum: '2026-08-12',
        wohnung: { strasse: 'Hauptstr.', hausnummer: '1', plz: '12345', ort: 'Musterstadt', miete: 704, wohnflaeche_qm: 63 },
      }),
      personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', vorname: 'Max', nachname: 'Muster' })],
      dokumente: [],
    };
  }

  test('vollständiger Fall → Regel feuert nicht', () => {
    const befunde = pruefeVorgang(vollstaendigerFall());
    expect(has(befunde, 'essenzielle-angaben')).toBe(false);
  });

  test('fehlendes Antragsdatum → Regel feuert und nennt es im Belegtext', () => {
    const snap = vollstaendigerFall();
    snap.vorgang.antragsdatum = undefined;
    const befunde = pruefeVorgang(snap);
    expect(has(befunde, 'essenzielle-angaben')).toBe(true);
    const b = befunde.find(x => x.regelId === 'essenzielle-angaben');
    expect(b?.belegtext).toContain('Antragsdatum');
  });

  test('fehlende Miete bei Mietzuschuss → Regel feuert', () => {
    const snap = vollstaendigerFall();
    snap.vorgang.wohnung = { strasse: 'Hauptstr.', plz: '12345', ort: 'Musterstadt' };
    const befunde = pruefeVorgang(snap);
    expect(has(befunde, 'essenzielle-angaben')).toBe(true);
  });

  test('keine Person erfasst → Regel feuert', () => {
    const snap = vollstaendigerFall();
    snap.personen = [];
    const befunde = pruefeVorgang(snap);
    expect(has(befunde, 'essenzielle-angaben')).toBe(true);
  });
});

describe('Welle 3 — Vermögen/Transfer/BWZ-Regeln (WP5)', () => {
  test('Vermögen über Freigrenze (§21 Nr.3) feuert bei Überschreitung', () => {
    const snap: VorgangSnapshot = {
      vorgang: mkVorgang(),
      personen: [
        mkPerson({ id: 'p1', rolle: 'antragsteller', vorname: 'A', nachname: 'X',
          vermoegenPositionen: [{ id: 'v1', art: 'Wertpapiere', betrag: 80000 }] }),
        mkPerson({ id: 'p2', rolle: 'ehegatte', vorname: 'B', nachname: 'X', vermoegen: 20000 }),
      ], // Summe 100.000 > Freigrenze (2 Pers.) = 90.000
      dokumente: [],
    };
    const befunde = pruefeVorgang(snap);
    expect(has(befunde, 'plausi-vermoegen-ueber-freigrenze')).toBe(true);
    const b = befunde.find(x => x.regelId === 'plausi-vermoegen-ueber-freigrenze');
    expect(b?.belegtext).toContain('90.000');
  });

  test('Vermögen unter Freigrenze → Regel feuert nicht', () => {
    const snap: VorgangSnapshot = {
      vorgang: mkVorgang(),
      personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', vorname: 'A', nachname: 'X', vermoegen: 50000 })],
      dokumente: [],
    };
    expect(has(pruefeVorgang(snap), 'plausi-vermoegen-ueber-freigrenze')).toBe(false);
  });

  test('§7-Ausschluss-Hinweis bei Transferleistung mit enthaltenen Unterkunftskosten', () => {
    const snap: VorgangSnapshot = {
      vorgang: mkVorgang(),
      personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', vorname: 'A', nachname: 'X',
        transferleistungenDetail: [{ id: 't1', art: 'Bürgergeld', kduEnthalten: true, bescheidVorhanden: true }] })],
      dokumente: [],
    };
    const befunde = pruefeVorgang(snap);
    expect(has(befunde, 'ausschluss-person-transferbezug', 'p1')).toBe(true);
  });

  test('§7-Regel feuert nicht ohne enthaltene Unterkunftskosten', () => {
    const snap: VorgangSnapshot = {
      vorgang: mkVorgang(),
      personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', vorname: 'A', nachname: 'X',
        transferleistungenDetail: [{ id: 't1', art: 'Kindergeld', kduEnthalten: false, bescheidVorhanden: true }] })],
      dokumente: [],
    };
    expect(has(pruefeVorgang(snap), 'ausschluss-person-transferbezug')).toBe(false);
  });

  test('§7-Ausschluss feuert bei forml-Ausschluss-Eintrag (ausschluesse[]) + nennt Grund-Label', () => {
    const snap: VorgangSnapshot = {
      vorgang: mkVorgang(),
      personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', vorname: 'A', nachname: 'X',
        ausschluesse: [{ id: 'x1', grund: 'sgb2_buergergeld', von: '2026-01-01' }] })],
      dokumente: [],
    };
    const befunde = pruefeVorgang(snap);
    expect(has(befunde, 'ausschluss-person-transferbezug', 'p1')).toBe(true);
    const b = befunde.find(x => x.regelId === 'ausschluss-person-transferbezug');
    expect(b?.belegtext).toContain('Bürgergeld');
  });

  test('§7-Regel feuert nicht ohne Ausschluss/Transfer-Angaben', () => {
    const snap: VorgangSnapshot = {
      vorgang: mkVorgang(),
      personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', vorname: 'A', nachname: 'X' })],
      dokumente: [],
    };
    expect(has(pruefeVorgang(snap), 'ausschluss-person-transferbezug')).toBe(false);
  });

  test('BWZ-Vorschlag-Regel feuert bei fehlendem BWZ + vorhandenem Antragsdatum', () => {
    const snap: VorgangSnapshot = {
      vorgang: mkVorgang({ antragsdatum: '2026-08-12', bwz_start: undefined, bwz_ende: undefined, bwz: undefined }),
      personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', vorname: 'A', nachname: 'X' })],
      dokumente: [],
    };
    const befunde = pruefeVorgang(snap);
    expect(has(befunde, 'bwz-vorschlag-pruefen')).toBe(true);
    const b = befunde.find(x => x.regelId === 'bwz-vorschlag-pruefen');
    expect(b?.belegtext).toContain('01.08.2026');
  });

  test('BWZ-Vorschlag-Regel feuert nicht, wenn BWZ-Liste vorhanden', () => {
    const snap: VorgangSnapshot = {
      vorgang: mkVorgang({ antragsdatum: '2026-08-12', bwz: [{ id: 'b1', start: '2026-08-01', ende: '2027-07-31' }] }),
      personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', vorname: 'A', nachname: 'X' })],
      dokumente: [],
    };
    expect(has(pruefeVorgang(snap), 'bwz-vorschlag-pruefen')).toBe(false);
  });
});

describe('Altersgrenze Ausweis/KV (Stichtag Antragsdatum)', () => {
  const snap = (geb?: string): VorgangSnapshot => ({
    vorgang: mkVorgang({ antragsdatum: '2026-08-12' }),
    personen: [
      mkPerson({ id: 'pa', rolle: 'antragsteller', vorname: 'A', nachname: 'X', geburtsdatum: '1980-01-01' }),
      mkPerson({ id: 'pk', rolle: 'kind', vorname: 'K', nachname: 'X', ...(geb ? { geburtsdatum: geb } : {}) }),
    ],
    dokumente: [],
  });
  test('Kind unter 18: kein Ausweis- und kein KV-Befund', () => {
    const b = pruefeVorgang(snap('2012-05-05'));
    expect(has(b, 'identitaet-jede-person', 'pk')).toBe(false);
    expect(has(b, 'krankenversicherung-nachweis', 'pk')).toBe(false);
    expect(has(b, 'identitaet-jede-person', 'pa')).toBe(true);
  });
  test('18. Geburtstag vor dem Antragsdatum: Befunde wie bei Erwachsenen', () => {
    const b = pruefeVorgang(snap('2008-08-12'));
    expect(has(b, 'identitaet-jede-person', 'pk')).toBe(true);
    expect(has(b, 'krankenversicherung-nachweis', 'pk')).toBe(true);
  });
  test('ohne Geburtsdatum weiter verlangt', () => {
    expect(has(pruefeVorgang(snap()), 'identitaet-jede-person', 'pk')).toBe(true);
  });
});
