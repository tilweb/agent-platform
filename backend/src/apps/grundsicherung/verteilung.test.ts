/**
 * Grundsicherung — Kernlogik der Verteilung (`verteileDokumente`) mit In-Memory-Speichern:
 * neuer Vorgang, Personen aus dem Antrag, personId der Nachweise, Feld-Status, Ersteingang,
 * Nachreichung (nur leere Felder, keine Personen-Dubletten), Auto-Prüfung, Match.
 */
import { describe, expect, test } from 'bun:test';
import { createVerteilung, type DokumentVorlage } from './verteilung';
import { fakeContext, fakeVerteilungDeps } from './test-fakes';
import type { Akte, ExtrahierteStammdaten, Person, Vorgang } from './types';

const stammdaten: ExtrahierteStammdaten = {
  antragsart: 'erstantrag', antragsdatum: '2026-09-02', anspruchsgrund: 'alter', wohnsituation: 'miete',
  antragsteller: { nachname: 'Schmidt', vorname: 'Erika', geburtsdatum: '1956-09-03' },
  adresse: { strasse: 'Lindenweg', hausnummer: '7', plz: '34117', ort: 'Kassel' },
  wohnung: { kaltmiete: 450, heizkosten: 70 }, iban: 'DE44500105175407324931',
  personen: [
    { rolle: 'antragsteller', nachname: 'Schmidt', vorname: 'Erika', geburtsdatum: '1956-09-03', einkommen: [{ art: 'altersrente', betrag_monat: 780 }], vermoegen: [] },
    { rolle: 'partner', nachname: 'Schmidt', vorname: 'Karl', geburtsdatum: '1953-01-02', vermoegen: [] },
  ],
};
const dok = (o: Partial<DokumentVorlage> & Pick<DokumentVorlage, 'typ'>): DokumentVorlage => ({ dateiname: `${o.typ}.pdf`, storageRef: `local:ablage/${o.typ}.pdf`, analyse: {}, ...o });
const antragDok = dok({ typ: 'grundsicherungsantrag', stammdaten, identitaet: stammdaten.antragsteller, analyse: { unterschrift_vorhanden: true }, confidenceByPfad: { 'wohnung.kaltmiete': 0.9, nachname: 0.8 } });

describe('verteileDokumente — neuer Vorgang', () => {
  const f = fakeVerteilungDeps();
  const v = createVerteilung(f.deps);
  const lauf = v.verteileDokumente(fakeContext(), {
    dokumente: [
      antragDok,
      dok({ typ: 'rentenbescheid', identitaet: { vorname: 'Karl', nachname: 'Schmidt' }, analyse: { zahlbetrag: 610 } }),
      dok({ typ: 'kontoauszug', identitaet: { nachname: 'Schmidt' } }),
      dok({ typ: 'mietvertrag', analyse: { mieter: ['Erika Schmidt', 'Karl Schmidt'] } }),
    ],
    eingegangenAm: '2026-09-03T08:00:00.000Z',
    ersteingang: { datum: '2026-09-01', stelle: 'Wohngeldstelle Kassel' },
  });

  test('Akte und Vorgang aus den Antragsdaten, Ersteingang gesetzt', async () => {
    const r = await lauf;
    if (!r.ok) throw new Error(r.error);
    expect(r.istNeuerVorgang).toBe(true);
    expect(r.akte).toMatchObject({ name: 'Schmidt, Erika', antragstellerName: 'Erika Schmidt', plz: '34117', ownerId: 'u1' });
    expect(r.vorgang).toMatchObject({
      antragsdatum: '2026-09-02', anspruchsgrund: 'alter', wohnsituation: 'miete', iban: 'DE44500105175407324931',
      wohnung: { strasse: 'Lindenweg', hausnummer: '7', plz: '34117', ort: 'Kassel', kaltmiete: 450, heizkosten: 70 },
      ersteingang: { datum: '2026-09-01', stelle: 'Wohngeldstelle Kassel' },
    });
  });
  test('Personen der Einsatzgemeinschaft angelegt; Nachweise mit personId', async () => {
    const r = await lauf;
    if (!r.ok) throw new Error(r.error);
    const [erika, karl] = r.personen;
    expect(r.personen.map((p) => p.rolle)).toEqual(['antragsteller', 'partner']);
    expect(erika!.einkommen![0]).toMatchObject({ art: 'altersrente', betrag_monat: 780 });
    const [antrag, rente, konto, miete] = r.dokumente;
    expect(antrag!.personId).toBe(erika!.id);
    expect(rente!.personId).toBe(karl!.id);
    expect(konto!.personId).toBeUndefined();                 // nur Nachname bei zwei Schmidts → unklar
    expect(konto!.flags?.[0]?.code).toBe('person-unklar');
    expect(miete!.personId).toBeUndefined();                 // Haushaltsdokument
    expect(antrag!.pfad).toBe('ablage/grundsicherungsantrag.pdf');
    expect(antrag!.eingegangenAm).toBe('2026-09-03T08:00:00.000Z');
  });
  test('Feld-Status: übernommene Antragswerte + Personenfelder als KI-Vorschlag', async () => {
    const r = await lauf;
    if (!r.ok) throw new Error(r.error);
    const vorgangPfade = f.feldStatus.filter((x) => x.zielTyp === 'vorgang').map((x) => x.feldPfad);
    expect(vorgangPfade).toContain('wohnung.kaltmiete');
    expect(vorgangPfade).toContain('anspruchsgrund');
    expect(vorgangPfade).not.toContain('ersteingang');       // Metadatum des Eingangs, kein KI-Wert
    expect(f.feldStatus.every((x) => x.quelle === 'llm' && x.bestaetigt === false)).toBe(true);
    expect(f.feldStatus.find((x) => x.feldPfad === 'wohnung.kaltmiete')!.confidence).toBe(0.9);
    const erikaFs = f.feldStatus.filter((x) => x.zielId === r.personen[0]!.id);
    expect(erikaFs.map((x) => x.feldPfad)).toEqual(['nachname', 'vorname', 'geburtsdatum', 'einkommen', 'vermoegen']);
    expect(erikaFs[0]!.confidence).toBe(0.8);
  });
  test('Auto-Prüfung und Protokoll', async () => {
    const r = await lauf;
    if (!r.ok) throw new Error(r.error);
    expect(r.befundeCount).toBe(3);
    expect(f.pruefungen).toEqual([r.vorgang.id]);
    expect(f.audits[0]).toMatchObject({ aktion: 'dokument.hochgeladen', vorgangId: r.vorgang.id });
    expect(f.audits[0]!.detail).toContain('2 Person(en) aus dem Antrag angelegt');
    expect(f.audits[0]!.detail).toContain('Ersteingang bei „Wohngeldstelle Kassel"');
  });
});

describe('verteileDokumente — Nachreichung an bestehenden Vorgang', () => {
  const meta = { version: 1, created_at: '', updated_at: '' };
  const akte: Akte = { id: 'a1', name: 'Schmidt, Erika', ...meta };
  const vorgang: Vorgang = {
    id: 'v1', akteId: 'a1', vorgangsnummer: 'GS-1', antragsart: 'erstantrag', status: 'sachbearbeitung', prioritaet: 'normal',
    antragsdatum: '2026-08-30', wohnung: { kaltmiete: 500 }, ersteingang: { stelle: 'Rentenversicherung' }, ...meta,
  };
  const erika: Person = { id: 'p1', vorgangId: 'v1', rolle: 'antragsteller', nachname: 'Schmidt', vorname: 'Erika', geburtsdatum: '1956-09-03', ...meta };

  test('nur leere Felder gefüllt, keine Personen-Dubletten, Nachweis der vorhandenen Person zugeordnet', async () => {
    const f = fakeVerteilungDeps({ akten: [akte], vorgaenge: [vorgang], personen: [erika] });
    const r = await createVerteilung(f.deps).verteileDokumente(fakeContext(), {
      vorgangId: 'v1', viaVorschlag: true, matchLevel: 'hoch', pruefen: false,
      dokumente: [antragDok, dok({ typ: 'personalausweis', identitaet: { geburtsdatum: '1956-09-03' } })],
      ersteingang: { datum: '2026-08-01', stelle: 'Wohngeldstelle' },
    });
    if (!r.ok) throw new Error(r.error);
    expect(r.istNeuerVorgang).toBe(false);
    expect(r.vorgang.antragsdatum).toBe('2026-08-30');                      // Handeingabe bleibt
    expect(r.vorgang.wohnung).toMatchObject({ kaltmiete: 500, heizkosten: 70, plz: '34117' });
    expect(r.vorgang.ersteingang).toEqual({ stelle: 'Rentenversicherung' }); // vorhandener Ersteingang bleibt
    expect(r.personen).toEqual([]);
    expect([...f.personen.values()]).toHaveLength(1);
    expect(r.dokumente.map((x) => x.personId)).toEqual(['p1', 'p1']);
    expect(f.feldStatus.map((x) => x.feldPfad)).not.toContain('antragsdatum');
    expect(f.feldStatus.map((x) => x.feldPfad)).not.toContain('wohnung.kaltmiete');
    expect(f.pruefungen).toEqual([]);
    expect(f.audits[0]).toMatchObject({ aktion: 'dokument.zugeordnet' });
  });
  test('Fehler als Wert', async () => {
    const f = fakeVerteilungDeps();
    const v = createVerteilung(f.deps);
    expect(await v.verteileDokumente(fakeContext(), { dokumente: [] })).toMatchObject({ ok: false, status: 400 });
    expect(await v.verteileDokumente(fakeContext(), { vorgangId: 'x', dokumente: [antragDok] })).toMatchObject({ ok: false, status: 404 });
    expect(await v.verteileDokumente(fakeContext(), { dokumente: [dok({ typ: 'kontoauszug' })] })).toMatchObject({ ok: false, status: 400 });
  });
  test('Match-Vorschlag über alle Vorgänge (Name + Geburtsdatum der antragstellenden Person)', async () => {
    const f = fakeVerteilungDeps({ akten: [akte], vorgaenge: [vorgang], personen: [erika] });
    const k = await createVerteilung(f.deps).ermittleMatchKandidaten({ nachname: 'Schmidt', vorname: 'Erika', geburtsdatum: '1956-09-03' });
    expect(k[0]).toMatchObject({ vorgangId: 'v1', level: 'hoch', antragstellerName: 'Schmidt, Erika' });
  });
});
