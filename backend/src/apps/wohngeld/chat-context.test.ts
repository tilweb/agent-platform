import { test, expect, describe } from 'bun:test';
import { buildFallKontext, dokumentLabel } from './chat-context';
import type { Vorgang, Person, Dokument, Pruefschritt, VorgangSnapshot } from './types';

function mkVorgang(over: Partial<Vorgang> = {}): Vorgang {
  return {
    id: 'v1', akteId: 'a1', antragsId: '123-456-789',
    wohngeldart: 'mietzuschuss', antragsart: 'erstantrag', status: 'sachbearbeitung',
    prioritaet: 'normal', version: 1, created_at: '', updated_at: '',
    antragsdatum: '2026-09-01',
    wohnung: { strasse: 'Hauptstr.', hausnummer: '5', plz: '63067', ort: 'Offenbach', miete: 704, wohnflaeche_qm: 60 },
    ...over,
  };
}

function mkPerson(over: Partial<Person> = {}): Person {
  return {
    id: 'p1', vorgangId: 'v1', rolle: 'antragsteller', nachname: 'Petermann', vorname: 'Erika',
    version: 1, created_at: '', updated_at: '', ...over,
  };
}

function mkDokument(over: Partial<Dokument> = {}): Dokument {
  return {
    id: 'dok-1', vorgangId: 'v1', typ: 'rentenbescheid', istOriginal: false,
    version: 1, created_at: '', updated_at: '', ...over,
  };
}

function mkPruef(over: Partial<Pruefschritt> = {}): Pruefschritt {
  return {
    id: 'pr1', vorgangId: 'v1', regelId: 'r1', kategorie: 'vollstaendigkeit', typ: 'anforderung',
    status: 'offen', titel: 'Rentenbescheid fehlt', automatisch: true,
    version: 1, created_at: '', updated_at: '', ...over,
  };
}

describe('buildFallKontext', () => {
  test('enthält die Kernfelder des Vorgangs', () => {
    const snapshot: VorgangSnapshot = { vorgang: mkVorgang(), personen: [mkPerson()], dokumente: [] };
    const { text } = buildFallKontext(snapshot, []);
    expect(text).toContain('123-456-789');
    expect(text).toContain('Mietzuschuss');
    expect(text).toContain('Erstantrag');
    expect(text).toContain('Erika Petermann');
    expect(text).toContain('Offenbach');
    expect(text).toContain('704');
  });

  test('§13-Gesamteinkommen erscheint mit Herleitung', () => {
    const person = mkPerson({
      einkommen: [{ id: 'e1', art: 'rente', betrag_monatlich: 1000, beruecksichtigt: true }],
    });
    const snapshot: VorgangSnapshot = { vorgang: mkVorgang(), personen: [person], dokumente: [] };
    const { text } = buildFallKontext(snapshot, []);
    expect(text).toContain('Gesamteinkommen (§ 13 WoGG)');
    // 1000 €/Monat → 12.000 €/Jahr rohes Jahreseinkommen
    expect(text).toContain('12.000');
    expect(text).toContain('Gesamteinkommen/Monat');
  });

  test('Dokumente werden mit id → label in der Rückgabe aufgelöst', () => {
    const dok = mkDokument({ typ: 'rentenbescheid', titel: 'DRV Bund' });
    const snapshot: VorgangSnapshot = { vorgang: mkVorgang(), personen: [], dokumente: [dok] };
    const { text, dokumente } = buildFallKontext(snapshot, []);
    expect(dokumente).toHaveLength(1);
    expect(dokumente[0]!.id).toBe('dok-1');
    expect(dokumente[0]!.label).toContain('Rentenbescheid');
    expect(text).toContain('[dok-1]');
  });

  test('offene Prüfschritte werden gelistet, erledigte nicht', () => {
    const snapshot: VorgangSnapshot = { vorgang: mkVorgang(), personen: [], dokumente: [] };
    const offen = mkPruef({ titel: 'Rentenbescheid fehlt', status: 'offen' });
    const erledigt = mkPruef({ id: 'pr2', titel: 'Mietvertrag geprüft', status: 'erledigt' });
    const { text } = buildFallKontext(snapshot, [offen, erledigt]);
    expect(text).toContain('Rentenbescheid fehlt');
    expect(text).not.toContain('Mietvertrag geprüft');
  });

  test('extrahierter Text wird längenbegrenzt', () => {
    const langerText = 'A'.repeat(5000);
    const dok = mkDokument({ extrahierterText: langerText });
    const snapshot: VorgangSnapshot = { vorgang: mkVorgang(), personen: [], dokumente: [dok] };
    const { text } = buildFallKontext(snapshot, []);
    expect(text).toContain('[gekürzt]');
    expect(text).not.toContain('A'.repeat(2000));
  });
});

describe('dokumentLabel', () => {
  test('kombiniert Typ-Label mit Titel', () => {
    expect(dokumentLabel(mkDokument({ typ: 'mietvertrag', titel: 'WBG 2024' }))).toBe('Mietvertrag – WBG 2024');
  });
  test('fällt auf reinen Typ zurück', () => {
    expect(dokumentLabel(mkDokument({ typ: 'kontoauszug', titel: undefined, quelle: undefined }))).toBe('Kontoauszug');
  });
});
