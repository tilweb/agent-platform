import { describe, expect, test } from 'bun:test';
import { generiereAnforderungsschreiben, RECHTSFOLGENBELEHRUNG, STANDARD_FRIST_TAGE } from './schreiben-generator';
import { bodyToSections, schreibenToDocument } from './schreiben-export';
import { auskunftToDocument, auskunftToJson } from './auskunft-export';
import type { Person, Pruefschritt, Schreiben, Vorgang } from './types';

const meta = { version: 1, created_at: '', updated_at: '' };
const vorgang = { antragsdatum: '2026-06-15', vorgangsnummer: 'GS-100-200-300', aktenzeichen: undefined } as Pick<Vorgang, 'antragsdatum' | 'vorgangsnummer' | 'aktenzeichen'>;
const erika: Person = { id: 'p1', vorgangId: 'v1', rolle: 'antragsteller', vorname: 'Erika', nachname: 'Schmidt', ...meta };
const ps = (o: Partial<Pruefschritt> & Pick<Pruefschritt, 'regelId' | 'titel'>): Pruefschritt => ({
  id: o.regelId, vorgangId: 'v1', kategorie: 'vollstaendigkeit', typ: 'anforderung', status: 'offen', automatisch: true, ...meta, ...o,
});
const schritte = [
  ps({ regelId: 'bankverbindung', titel: 'Bankverbindung', belegtext: 'IBAN fehlt.' }),
  ps({ regelId: 'rentenanpassungsmitteilung', titel: 'Rentenanpassungsmitteilung 2026', personId: 'p1', quellDokumentId: 'd1' }),
  ps({ regelId: 'plausi-heizung-in-miete-unklar', titel: 'Heizung in Miete unklar', typ: 'info', kategorie: 'plausibilitaet' }),
  ps({ regelId: 'kontoauszuege', titel: 'Kontoauszüge', personId: 'p1', status: 'erledigt' }),
  ps({ regelId: 'mietvertrag', titel: 'Mietvertrag', status: 'verworfen' }),
];

describe('Nachforderungsschreiben (§ 60 SGB I)', () => {
  const s = generiereAnforderungsschreiben(vorgang, [erika], schritte, { stichtag: '2026-09-20' });
  test('Inhalt nur aus offenen Anforderungen, gegliedert fallweit / je Person, mit Provenienz', () => {
    expect(s.items!.map((i) => i.regelId)).toEqual(['bankverbindung', 'rentenanpassungsmitteilung']);
    expect(s.items![1]).toMatchObject({ personId: 'p1', quellDokumentId: 'd1' });
    expect(s.body).toContain('**Allgemein**\n- Bankverbindung — IBAN fehlt.');
    expect(s.body).toContain('**Erika Schmidt**\n- Rentenanpassungsmitteilung 2026');
    expect(s.body).not.toContain('Heizung in Miete');
    expect(s.body).not.toContain('Kontoauszüge');
    expect(s.body).not.toContain('Mietvertrag');
  });
  test('Frist (Standard 14 Tage ab Stichtag) im Text und im Feld', () => {
    expect(STANDARD_FRIST_TAGE).toBe(14);
    expect(s.frist).toBe('2026-10-04');
    expect(s.body).toContain('bis zum **04.10.2026**');
    expect(generiereAnforderungsschreiben(vorgang, [erika], schritte, { stichtag: '2026-12-25', fristTage: 21 }).frist).toBe('2027-01-15');
  });
  test('Rechtsfolgenbelehrung § 66 Abs. 1, 3 SGB I; Textbaustein ersetzt den Standard', () => {
    expect(s.body).toContain('**Hinweis auf die Folgen fehlender Mitwirkung (§ 66 SGB I)**');
    expect(s.body).toContain(RECHTSFOLGENBELEHRUNG);
    expect(RECHTSFOLGENBELEHRUNG).toContain('§ 66 Abs. 1 SGB I');
    expect(RECHTSFOLGENBELEHRUNG).toContain('§ 60 Abs. 1');
    const eigen = generiereAnforderungsschreiben(vorgang, [erika], schritte, { textbausteine: [{ titel: 'Rechtsfolgenbelehrung', text: 'Kommunaler Text.' }] });
    expect(eigen.body).toContain('Kommunaler Text.');
    expect(eigen.body).not.toContain(RECHTSFOLGENBELEHRUNG);
  });
  test('Betreff, Art, Zeichen', () => {
    expect(s.art).toBe('erstanforderung');
    expect(s.betreff).toBe('Ihr Antrag auf Grundsicherung vom 15.06.2026 — fehlende Unterlagen (Mitwirkung nach § 60 SGB I)');
    expect(s.body).toContain('Zeichen GS-100-200-300');
    const erinnerung = generiereAnforderungsschreiben(vorgang, [erika], schritte, { art: 'erinnerung' });
    expect(erinnerung.betreff!.startsWith('Erinnerung: ')).toBe(true);
    expect(erinnerung.art).toBe('erinnerung');
  });
  test('ohne offene Anforderungen', () => {
    expect(generiereAnforderungsschreiben(vorgang, [], []).body).toContain('keine offenen Anforderungen');
  });
});

describe('Export (documentGenerator) und Auskunft', () => {
  test('Body → Abschnitte: Listen mit Überschrift, Belehrung als Fließtext mit Überschrift', () => {
    const s = generiereAnforderungsschreiben(vorgang, [erika], schritte, { stichtag: '2026-09-20' });
    const sec = bodyToSections(s.body!);
    expect(sec.find((x) => x.title === 'Allgemein')).toMatchObject({ type: 'list', content: { items: ['Bankverbindung — IBAN fehlt.'] } });
    expect(sec.find((x) => x.title === 'Erika Schmidt')!.type).toBe('list');
    const belehrung = sec.find((x) => x.title.startsWith('Hinweis auf die Folgen'))!;
    expect(belehrung.type).toBe('text');
    expect(String(belehrung.content)).toContain('§ 66 Abs. 1 SGB I');
    expect(sec.some((x) => x.type === 'list' && (x.content as { items: string[] }).items.length === 0)).toBe(false);
  });
  test('Schreiben → DocumentData mit Metadaten', () => {
    const schreiben = { id: 's1', vorgangId: 'v1', art: 'erstanforderung', betreff: 'B', frist: '2026-10-04', body: 'Text', ...meta } as Schreiben;
    const doc = schreibenToDocument(schreiben, { vorgangsnummer: 'GS-1', aktenzeichen: '50.2' } as Vorgang, { id: 'a', name: 'Schmidt, Erika', antragstellerName: 'Erika Schmidt', plz: '34117', ort: 'Kassel', ...meta });
    expect(doc.title).toBe('B');
    expect(doc.metadata).toMatchObject({ Aktenzeichen: '50.2', Vorgangsnummer: 'GS-1', 'Frist für Unterlagen': '04.10.2026' });
    expect(doc.sections[0]).toMatchObject({ title: 'Empfänger' });
  });
  test('Auskunft Art. 15: Fachdaten der Person, nur ihre Dokumente, JSON ohne Dateien', () => {
    const person: Person = {
      ...erika, geburtsdatum: '1956-09-03', familienstand: 'verwitwet', krankenversicherung: { art: 'pflicht', kasse: 'AOK' },
      einkommen: [{ id: 'e', art: 'altersrente', betrag_monat: 780 }], vermoegen: [], schwerbehinderung: { gdb: 50, merkzeichen: ['G'] },
      unterhalt_kinder_eltern: { angegeben: true, ueber_100k_moeglich: false }, erwerbsminderung: { voll: true },
    };
    const input = {
      person, vorgang: { vorgangsnummer: 'GS-1', antragsart: 'erstantrag', status: 'sachbearbeitung', ersteingang: { datum: '2026-09-01', stelle: 'Wohngeldstelle' } } as Vorgang, akte: null,
      dokumente: [{ id: 'd1', vorgangId: 'v1', typ: 'rentenbescheid', istOriginal: false, s3Key: 'geheim', ...meta } as never],
      protokoll: [{ id: 'l', timestamp: '2026-09-01T10:00:00Z', aktion: 'person.erstellt', objektTyp: 'person' } as never],
    };
    const doc = auskunftToDocument(input);
    const titel = doc.sections.map((s) => s.title);
    for (const t of ['Stammdaten', 'Kranken- und Pflegeversicherung', 'Einkommen', 'Vermögen', 'Unterhaltspflichtige Kinder/Eltern (§ 94 Abs. 1a SGB XII)', 'Zugehöriger Vorgang']) expect(titel).toContain(t);
    expect(titel.some((t) => t.startsWith('Erwerbsminderung'))).toBe(true);
    expect(doc.sections.find((s) => s.title === 'Vermögen')!.content).toBe('Erklärung: kein Vermögen vorhanden.');
    const j = auskunftToJson(input) as { person: { einkommen: unknown[] }; dokumente: Array<Record<string, unknown>> };
    expect(j.person.einkommen).toHaveLength(1);
    expect(j.dokumente[0]!.s3Key).toBeUndefined();
  });
});
