/**
 * Vorrang-Hinweise Grundsicherung (Spiegelregeln) — positiv/negativ.
 */
import { describe, expect, test } from 'bun:test';
import { pruefeVorgang } from './index';
import { pruefeVorrang } from './vorrang';
import type { Dokument, Person, Vorgang, VorgangSnapshot } from '../types';

const basis = { version: 1, created_at: '', updated_at: '' };
function mkVorgang(over: Partial<Vorgang> = {}): Vorgang {
  return {
    ...basis, id: 'v1', akteId: 'a1', antragsId: 'W-1', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag',
    status: 'sachbearbeitung', prioritaet: 'normal', antragsdatum: '2026-08-12',
    wohnung: { miete: 520, heizkosten: 70, wohnflaeche_qm: 50 }, ...over,
  };
}
function mkPerson(over: Partial<Person>): Person {
  return { ...basis, id: 'p', vorgangId: 'v1', rolle: 'haushaltsmitglied', nachname: 'Muster', vorname: 'Hans', ...over };
}
function mkDok(over: Partial<Dokument>): Dokument {
  return { ...basis, id: 'd', vorgangId: 'v1', typ: 'sonstiges', istOriginal: false, ...over };
}
function rentner(over: Partial<Person> = {}): Person {
  return mkPerson({
    id: 'p1', rolle: 'antragsteller', geburtsdatum: '1957-04-10',
    einkommen: [{ id: 'e1', art: 'rente', betrag_monatlich: 830, beruecksichtigt: true }],
    ...over,
  });
}
const ids = (s: VorgangSnapshot) => pruefeVorrang(s).map((b) => b.regelId);

describe('vorrang-grundsicherung-mitpruefen', () => {
  test('Altersgrenze erreicht, nur Rente, kein Vermögen erfasst → Hinweis', () => {
    const befunde = pruefeVorrang({ vorgang: mkVorgang(), personen: [rentner()], dokumente: [] });
    expect(befunde).toHaveLength(1);
    const b = befunde[0]!;
    expect(b).toMatchObject({ regelId: 'vorrang-grundsicherung-mitpruefen', kategorie: 'plausibilitaet', typ: 'info' });
    expect(b.personId).toBeUndefined();
    expect(b.belegtext).toContain('Hans Muster hat die Altersgrenze erreicht');
    expect(b.belegtext).toContain('nur Rente');
    expect(b.belegtext).toContain('Vermögen ist nicht erfasst');
    expect(b.belegtext).not.toMatch(/Seb|\.ts\b|Welle/);
  });

  test('Vermögen unter 10.000 € je Person des Paares → Hinweis mit Betrag', () => {
    const befunde = pruefeVorrang({
      vorgang: mkVorgang(),
      personen: [
        rentner({ vermoegenPositionen: [{ id: 'v', art: 'Sparbuch', betrag: 14000 }] }),
        mkPerson({ id: 'p2', rolle: 'ehegatte', vorname: 'Erika', geburtsdatum: '1962-01-01', einkommen: [{ id: 'e', art: 'rente', betrag_monatlich: 300, beruecksichtigt: true }] }),
      ],
      dokumente: [],
    });
    expect(befunde.map((b) => b.regelId)).toEqual(['vorrang-grundsicherung-mitpruefen']);
    expect(befunde[0]!.belegtext).toContain('14.000,00 €');
  });

  test('dauerhaft voll erwerbsgemindert laut Rentenbescheid (unter Altersgrenze) → Hinweis', () => {
    const befunde = pruefeVorrang({
      vorgang: mkVorgang(),
      personen: [rentner({ geburtsdatum: '1975-02-02' })],
      dokumente: [mkDok({ id: 'd1', typ: 'rentenbescheid', personId: 'p1', profil: { abschnitt: 'rentenbescheid', konfidenz: 0.9, quelle: 'vorlage', rohwerte: { rentenart: 'Rente wegen voller Erwerbsminderung, unbefristet' } } })],
    });
    expect(befunde).toHaveLength(1);
    expect(befunde[0]!.belegtext).toContain('dauerhaft voll erwerbsgemindert');
  });

  test('negativ: befristete EM-Rente, Erwerbseinkommen, Vermögen über Grenze, Altersgrenze nicht erreicht, ohne Antragsdatum', () => {
    const emBefristet = mkDok({ id: 'd1', typ: 'rentenbescheid', personId: 'p1', profil: { abschnitt: 'rentenbescheid', konfidenz: 0.9, quelle: 'vorlage', rohwerte: { rentenart: 'Rente wegen voller Erwerbsminderung auf Zeit' } } });
    expect(ids({ vorgang: mkVorgang(), personen: [rentner({ geburtsdatum: '1975-02-02' })], dokumente: [emBefristet] })).toEqual([]);
    expect(ids({ vorgang: mkVorgang(), personen: [rentner({ einkommen: [
      { id: 'e1', art: 'rente', betrag_monatlich: 830, beruecksichtigt: true },
      { id: 'e2', art: 'lohn_gehalt', betrag_monatlich: 520, beruecksichtigt: true },
    ] })], dokumente: [] })).toEqual([]);
    expect(ids({ vorgang: mkVorgang(), personen: [rentner({ vermoegenPositionen: [{ id: 'v', art: 'Bankguthaben', betrag: 10000 }] })], dokumente: [] })).toEqual([]);
    expect(ids({ vorgang: mkVorgang(), personen: [rentner({ geburtsdatum: '1965-01-01' })], dokumente: [] })).toEqual([]);
    expect(ids({ vorgang: mkVorgang({ antragsdatum: undefined }), personen: [rentner()], dokumente: [] })).toEqual([]);
  });

  test('negativ: nur ein weiteres Haushaltsmitglied erfüllt die Merkmale — es gehört nicht zur Einsatzgemeinschaft', () => {
    expect(ids({
      vorgang: mkVorgang(),
      personen: [
        mkPerson({ id: 'p1', rolle: 'antragsteller', geburtsdatum: '1990-01-01', einkommen: [{ id: 'e', art: 'lohn_gehalt', betrag_monatlich: 1500, beruecksichtigt: true }] }),
        mkPerson({ id: 'p2', rolle: 'haushaltsmitglied', geburtsdatum: '1940-01-01', einkommen: [{ id: 'e', art: 'rente', betrag_monatlich: 600, beruecksichtigt: true }] }),
      ],
      dokumente: [],
    })).toEqual([]);
  });
});

describe('vorrang-grundsicherungsbescheid-bei-wohngeld', () => {
  test('Grundsicherung als § 7-Ausschluss erfasst → ein Hinweis für den Haushalt, kein „mitprüfen"', () => {
    const befunde = pruefeVorrang({
      vorgang: mkVorgang(),
      personen: [rentner({ ausschluesse: [{ id: 'a', grund: 'grundsicherung_alter_em', von: '2026-01-01' }] })],
      dokumente: [],
    });
    expect(befunde.map((b) => b.regelId)).toEqual(['vorrang-grundsicherungsbescheid-bei-wohngeld']);
    expect(befunde[0]!.typ).toBe('info');
    expect(befunde[0]!.personId).toBeUndefined();
    expect(befunde[0]!.belegtext).toContain('01.01.2026');
    expect(befunde[0]!.belegtext).toContain('§ 7 Abs. 1 Satz 3 WoGG');
  });

  test('Legacy-Transferleistung „Grundsicherung" → Hinweis', () => {
    expect(ids({ vorgang: mkVorgang(), personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', transferleistungenDetail: [{ id: 't', art: 'Grundsicherung', kduEnthalten: true, bescheidVorhanden: true }] })], dokumente: [] }))
      .toEqual(['vorrang-grundsicherungsbescheid-bei-wohngeld']);
  });

  test('negativ: Bürgergeld, beendeter Grundsicherungsbezug, ohne Angaben', () => {
    expect(ids({ vorgang: mkVorgang(), personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', ausschluesse: [{ id: 'a', grund: 'sgb2_buergergeld' }] })], dokumente: [] })).toEqual([]);
    expect(ids({ vorgang: mkVorgang(), personen: [mkPerson({ id: 'p1', rolle: 'antragsteller', ausschluesse: [{ id: 'a', grund: 'grundsicherung_alter_em', bis: '2026-06-30' }] })], dokumente: [] })).toEqual([]);
    expect(ids({ vorgang: mkVorgang(), personen: [mkPerson({ id: 'p1', rolle: 'antragsteller' })], dokumente: [] })).toEqual([]);
  });

  test('§-7-Personenregel bleibt daneben bestehen, mit anderem Titel und Bezug', () => {
    const befunde = pruefeVorgang({
      vorgang: mkVorgang(),
      personen: [rentner({ ausschluesse: [{ id: 'a', grund: 'grundsicherung_alter_em' }] })],
      dokumente: [],
    });
    const person = befunde.filter((b) => b.regelId === 'ausschluss-person-transferbezug');
    const vorrang = befunde.filter((b) => b.regelId === 'vorrang-grundsicherungsbescheid-bei-wohngeld');
    expect(person).toHaveLength(1);
    expect(vorrang).toHaveLength(1);
    expect(person[0]!.personId).toBe('p1');
    expect(vorrang[0]!.personId).toBeUndefined();
    expect(person[0]!.titel).not.toBe(vorrang[0]!.titel);
  });
});
