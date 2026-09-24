import { test, expect, describe } from 'bun:test';
import { verfuegungToDocument } from './verfuegung-export';
import { berechneVorgangEinkommen } from './einkommen';
import type { Vorgang, Akte, Person, Pruefschritt } from './types';

function mkVorgang(over: Partial<Vorgang> = {}): Vorgang {
  return {
    id: 'v1', akteId: 'a1', antragsId: 'WG-42', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag',
    status: 'entscheidung', prioritaet: 'normal', version: 1, created_at: '', updated_at: '',
    wohnung: { miete: 700, heizkosten: 80 }, ...over,
  };
}
function mkAkte(over: Partial<Akte> = {}): Akte {
  return { id: 'a1', name: 'Mustermann', antragstellerName: 'Max Mustermann', strasse: 'Hauptstr.', hausnummer: '1', plz: '12345', ort: 'Berlin', version: 1, created_at: '', updated_at: '', ...over };
}
function mkPerson(over: Partial<Person> = {}): Person {
  return { id: 'p1', vorgangId: 'v1', rolle: 'antragsteller', nachname: 'Mustermann', vorname: 'Max', version: 1, created_at: '', updated_at: '', ...over };
}
function mkPruef(over: Partial<Pruefschritt> = {}): Pruefschritt {
  return { id: 'ps1', vorgangId: 'v1', regelId: 'r', kategorie: 'vollstaendigkeit', typ: 'anforderung', status: 'offen', titel: 'Titel', automatisch: true, version: 1, created_at: '', updated_at: '', ...over };
}

describe('verfuegungToDocument', () => {
  const personen = [mkPerson()];
  const einkommen = berechneVorgangEinkommen(personen, [], 0);

  test('Titel + Kopf-Metadaten', () => {
    const doc = verfuegungToDocument(mkVorgang(), mkAkte(), personen, einkommen, []);
    expect(doc.title).toBe('Verfügung – WG-42');
    expect(doc.metadata['Vorgangsnummer']).toBe('WG-42');
    expect(doc.metadata['Antragsteller']).toBe('Max Mustermann');
    expect(doc.metadata['Wohngeldart']).toBe('Mietzuschuss');
  });

  test('enthält Sektionen für Personen, Einkommen, Wohnung, Entscheidung', () => {
    const doc = verfuegungToDocument(mkVorgang(), mkAkte(), personen, einkommen, []);
    const titles = doc.sections.map((s) => s.title);
    expect(titles).toContain('Haushaltsmitglieder');
    expect(titles.some((t) => t.startsWith('Anrechenbares Einkommen'))).toBe(true);
    expect(titles).toContain('Wohnung & Miete');
    expect(titles).toContain('Entscheidung');
  });

  test('Prüfstatus trennt erledigte von offenen Anforderungen', () => {
    const pruef = [mkPruef({ id: 'ps1', status: 'erledigt', titel: 'Mietvertrag' }), mkPruef({ id: 'ps2', status: 'offen', titel: 'Kontoauszug' })];
    const doc = verfuegungToDocument(mkVorgang(), mkAkte(), personen, einkommen, pruef);
    const erledigt = doc.sections.find((s) => s.title.startsWith('Erledigte Anforderungen'));
    const offen = doc.sections.find((s) => s.title.startsWith('Offene Anforderungen'));
    expect(erledigt?.title).toBe('Erledigte Anforderungen (1)');
    expect(offen?.title).toBe('Offene Anforderungen (1)');
    expect((erledigt?.content as { items: string[] }).items).toContain('Mietvertrag');
    expect((offen?.content as { items: string[] }).items).toContain('Kontoauszug');
  });

  test('Entscheidung + Bemerkung aus vorgang.verfuegung', () => {
    const v = mkVorgang({ verfuegung: { entscheidung: 'bewilligt', bemerkung: 'Alles vollständig' } });
    const doc = verfuegungToDocument(v, mkAkte(), personen, einkommen, []);
    const ent = doc.sections.find((s) => s.title === 'Entscheidung');
    const items = (ent?.content as { items: { key: string; value: string }[] }).items;
    expect(items.find((i) => i.key === 'Entscheidung')?.value).toBe('Bewilligt');
    expect(items.find((i) => i.key === 'Bemerkung')?.value).toBe('Alles vollständig');
  });
});
