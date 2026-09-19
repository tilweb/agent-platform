/**
 * GOV-4 — Tests für die reine Betroffenen-Auskunft (auskunftToDocument / auskunftToJson).
 * DB-frei: nur das Mapping Domäne → DocumentData/JSON.
 */
import { test, expect, describe } from 'bun:test';
import { auskunftToDocument, auskunftToJson, type AuskunftInput } from './auskunft-export';
import type { Person, Vorgang, Akte, Dokument, AuditEintrag } from './types';

function mkPerson(over: Partial<Person> = {}): Person {
  return {
    id: 'p1', vorgangId: 'v1', rolle: 'antragsteller', nachname: 'Müller', vorname: 'Erika',
    geburtsdatum: '1980-05-01', erwerbsstatus: 'angestellt',
    einkommen: [{ id: 'e1', art: 'lohn_gehalt', bezeichnung: 'Gehalt', betrag_monatlich: 2000, beruecksichtigt: true }],
    vermoegenPositionen: [{ id: 'vm1', art: 'Bankguthaben', betrag: 5000 }],
    unterhaltsverpflichtungen: [{ id: 'u1', empfaengerKategorie: 'kind_anderer_elternteil', betrag: 300, titelVorhanden: true }],
    transferleistungenDetail: [{ id: 't1', art: 'Bürgergeld', kduEnthalten: false, bescheidVorhanden: true }],
    pflege_behinderung: { schwerbehinderungsgrad: 50 },
    version: 1, created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-02T00:00:00.000Z', ...over,
  };
}
function mkVorgang(over: Partial<Vorgang> = {}): Vorgang {
  return {
    id: 'v1', akteId: 'a1', antragsId: 'WG-77', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag',
    status: 'sachbearbeitung', prioritaet: 'normal', wohnung: { miete: 650 },
    version: 1, created_at: '', updated_at: '', ...over,
  };
}
function mkAkte(over: Partial<Akte> = {}): Akte {
  return { id: 'a1', name: 'Müller', antragstellerName: 'Erika Müller', strasse: 'Weg', hausnummer: '2', plz: '10115', ort: 'Berlin', version: 1, created_at: '', updated_at: '', ...over };
}
function mkDok(over: Partial<Dokument> = {}): Dokument {
  return { id: 'd1', vorgangId: 'v1', personId: 'p1', typ: 'gehaltsabrechnung', istOriginal: false, version: 1, created_at: '2026-01-03T00:00:00.000Z', updated_at: '', ...over };
}
function mkAudit(over: Partial<AuditEintrag> = {}): AuditEintrag {
  return { id: 'au1', timestamp: '2026-01-04T10:30:00.000Z', aktion: 'vorgang.geoeffnet', objektTyp: 'vorgang', vorgangId: 'v1', ergebnis: 'ok', akteurName: 'Sachbearbeiter A', ...over };
}

function input(over: Partial<AuskunftInput> = {}): AuskunftInput {
  return { person: mkPerson(), vorgang: mkVorgang(), akte: mkAkte(), dokumente: [mkDok()], protokoll: [mkAudit()], ...over };
}

describe('auskunftToDocument', () => {
  test('Titel + Metadaten enthalten Name und Antrags-ID', () => {
    const doc = auskunftToDocument(input());
    expect(doc.title).toBe('Auskunft nach Art. 15 DSGVO – Erika Müller');
    expect(doc.metadata['Betroffene Person']).toBe('Erika Müller');
    expect(doc.metadata['Antrags-ID']).toBe('WG-77');
  });

  test('enthält alle Fachdaten-Sektionen', () => {
    const titles = auskunftToDocument(input()).sections.map((s) => s.title);
    expect(titles).toContain('Stammdaten');
    expect(titles).toContain('Einkommenspositionen');
    expect(titles).toContain('Vermögen');
    expect(titles).toContain('Unterhaltsverpflichtungen (§ 18 WoGG)');
    expect(titles).toContain('Transferleistungen (§ 7 WoGG)');
    expect(titles.some((t) => t.startsWith('Pflege & Behinderung'))).toBe(true);
    expect(titles).toContain('Zugehöriger Vorgang');
    expect(titles.some((t) => t.startsWith('Dokumente der Person'))).toBe(true);
    expect(titles.some((t) => t.startsWith('Protokoll-Auszug'))).toBe(true);
  });

  test('Dokument-Sektion listet Typ/Datum, aber keine Datei-Bytes', () => {
    const doc = auskunftToDocument(input());
    const sec = doc.sections.find((s) => s.title.startsWith('Dokumente der Person'));
    expect(sec?.title).toBe('Dokumente der Person (1)');
    const rows = (sec?.content as { rows: string[][] }).rows;
    expect(rows[0]).toContain('Gehaltsabrechnung');
    expect(JSON.stringify(doc)).not.toContain('s3Key');
  });

  test('leere Dokumente/Protokoll → Hinweistext statt Tabelle', () => {
    const doc = auskunftToDocument(input({ dokumente: [], protokoll: [] }));
    const dok = doc.sections.find((s) => s.title.startsWith('Dokumente der Person'));
    expect(dok?.type).toBe('text');
  });
});

describe('auskunftToJson', () => {
  test('bündelt Person, Vorgang, Dokumente (ohne Bytes) und Protokoll', () => {
    const json = auskunftToJson(input()) as any;
    expect(json.person.nachname).toBe('Müller');
    expect(json.person.einkommen).toHaveLength(1);
    expect(json.vorgang.antragsId).toBe('WG-77');
    expect(json.dokumente[0]).toEqual({ id: 'd1', typ: 'gehaltsabrechnung', titel: undefined, eingegangenAm: undefined, created_at: '2026-01-03T00:00:00.000Z' });
    expect(json.protokoll[0].aktion).toBe('vorgang.geoeffnet');
  });
});
