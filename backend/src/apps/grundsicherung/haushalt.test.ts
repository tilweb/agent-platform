import { describe, expect, test } from 'bun:test';
import { feldStatusPersonPfade, ordneNachweisZu, personenAusAntrag } from './haushalt';
import { matchVorgaenge } from './matching';
import { ersteingangAus, ersteingangUebernahme, leiteBetreffAb, stammdatenUebernahme, stelleAusBetreff } from './stammdaten-uebernahme';
import type { ExtrahierteStammdaten, PosteingangDatei } from './types';

const antrag: ExtrahierteStammdaten = {
  antragsart: 'erstantrag', antragsdatum: '2026-09-02', anspruchsgrund: 'erwerbsminderung', wohnsituation: 'miete',
  antragsteller: { nachname: 'Berger', vorname: 'Klaus', geburtsdatum: '1968-02-10' },
  adresse: { strasse: 'Am Mühlbach', hausnummer: '12', plz: '97082', ort: 'Würzburg' },
  wohnung: { kaltmiete: 520, heizkosten: 85 }, iban: 'DE89370400440532013000',
  personen: [
    { rolle: 'antragsteller', nachname: 'Berger', vorname: 'Klaus', geburtsdatum: '1968-02-10', familienstand: 'verheiratet',
      einkommen: [{ art: 'em_rente', betrag_monat: 950 }], vermoegen: [], erwerbsminderung: { voll: true } },
    { rolle: 'partner', nachname: 'Berger', vorname: 'Sabine', geburtsdatum: '1970-03-01', vermoegen: [] },
    { rolle: 'haushaltsangehoerig', nachname: 'Berger', vorname: 'Tim', verhaeltnis: 'Sohn' },
  ],
};

describe('Personen aus dem Antrag', () => {
  const p = personenAusAntrag(antrag);
  test('Rollen, IDs für Listenpositionen, vermoegen [] bleibt Erklärung', () => {
    expect(p.map((x) => x.rolle)).toEqual(['antragsteller', 'partner', 'haushaltsangehoerig']);
    expect(p[0]!.einkommen![0]!.id).toBeTruthy();
    expect(p[0]!.einkommen![0]!.art).toBe('em_rente');
    expect(p[1]!.vermoegen).toEqual([]);
    expect(p[2]!.bemerkung).toBe('Verhältnis laut Antrag: Sohn');
  });
  test('Feld-Status-Pfade = alles, was die KI in die Person schreibt', () => {
    expect(feldStatusPersonPfade(p[0]!)).toEqual(['nachname', 'vorname', 'geburtsdatum', 'familienstand', 'erwerbsminderung', 'einkommen', 'vermoegen']);
    expect(feldStatusPersonPfade(p[2]!)).toEqual(['nachname', 'vorname']);
  });
});

describe('Nachweise den Personen zuordnen (personId)', () => {
  const personen = [
    { id: 'k', rolle: 'antragsteller' as const, vorname: 'Klaus', nachname: 'Berger', geburtsdatum: '1968-02-10' },
    { id: 's', rolle: 'partner' as const, vorname: 'Sabine', nachname: 'Berger', geburtsdatum: '1970-03-01' },
    { id: 't', rolle: 'haushaltsangehoerig' as const, vorname: 'Tim', nachname: 'Berger' },
  ];
  test('Antrag → antragstellende Person; Haushaltsdokumente ohne Person', () => {
    expect(ordneNachweisZu('grundsicherungsantrag', undefined, personen)).toEqual({ personId: 'k', grund: 'antrag' });
    expect(ordneNachweisZu('mietvertrag', { nachname: 'Berger' }, personen)).toEqual({ grund: 'haushalt' });
  });
  test('Geburtsdatum, Name, nur Vorname', () => {
    expect(ordneNachweisZu('personalausweis', { geburtsdatum: '01.03.1970' }, personen).personId).toBe('s');
    expect(ordneNachweisZu('rentenbescheid', { vorname: 'Klaus', nachname: 'Berger' }, personen).personId).toBe('k');
    expect(ordneNachweisZu('kontoauszug', { vorname: 'Sabine', nachname: 'Müller' }, personen).personId).toBe('s');
  });
  test('Widerspruch / Mehrdeutigkeit ⇒ unklar', () => {
    expect(ordneNachweisZu('rentenbescheid', { vorname: 'Klaus', nachname: 'Berger', geburtsdatum: '1950-01-01' }, personen).grund).toBe('unklar');
    expect(ordneNachweisZu('kontoauszug', { nachname: 'Berger' }, personen).grund).toBe('unklar');
    expect(ordneNachweisZu('kontoauszug', {}, personen).grund).toBe('unklar');
  });
  test('einzige Person der Einsatzgemeinschaft bei Nachweis ohne lesbaren Namen', () => {
    expect(ordneNachweisZu('kv_pv_nachweis', {}, [personen[0]!, personen[2]!])).toEqual({ personId: 'k', grund: 'einzige-person' });
    expect(ordneNachweisZu('kv_pv_nachweis', {}, [])).toEqual({ grund: 'keine-person' });
  });
});

describe('Match über Name + Geburtsdatum', () => {
  const kandidaten = [
    { vorgangId: 'v1', vorgangsnummer: 'GS-1', nachname: 'Schmidt', vorname: 'Erika', geburtsdatum: '1956-09-03', plz: '34117', ort: 'Kassel' },
    { vorgangId: 'v2', vorgangsnummer: 'GS-2', nachname: 'Schmidt', vorname: 'Erich', geburtsdatum: '1950-01-01' },
    { vorgangId: 'v3', vorgangsnummer: 'GS-3', aktenzeichen: '50.2-777', nachname: 'Berger', vorname: 'Klaus' },
  ];
  test('Name + Geburtsdatum ⇒ hoch; antragsId = Vorgangsnummer', () => {
    const r = matchVorgaenge({ nachname: 'Schmidt', vorname: 'Erika', geburtsdatum: '03.09.1956' }, kandidaten);
    expect(r[0]).toMatchObject({ vorgangId: 'v1', level: 'hoch', antragsId: 'GS-1', vorgangsnummer: 'GS-1' });
    expect(r.find((x) => x.vorgangId === 'v2')?.level ?? 'gering').toBe('gering');
  });
  test('nur Nachname ⇒ gering; ohne Daten kein Vorschlag', () => {
    expect(matchVorgaenge({ nachname: 'Schmidt' }, kandidaten).every((x) => x.level === 'gering')).toBe(true);
    expect(matchVorgaenge({}, kandidaten)).toEqual([]);
  });
  test('Aktenzeichen bzw. Vorgangsnummer ist starkes Signal', () => {
    expect(matchVorgaenge({ aktenzeichen: '50.2-777' }, kandidaten)[0]).toMatchObject({ vorgangId: 'v3', level: 'hoch' });
    expect(matchVorgaenge({ aktenzeichen: 'gs 2' }, kandidaten)[0]).toMatchObject({ vorgangId: 'v2', level: 'hoch' });
  });
  test('abweichendes Geburtsdatum ⇒ gering', () => {
    const r = matchVorgaenge({ nachname: 'Schmidt', vorname: 'Erika', geburtsdatum: '1960-01-01', plz: '34117', ort: 'Kassel' }, kandidaten);
    expect(r[0]!.level).toBe('gering');
  });
});

describe('Antragsdaten übernehmen (leere Felder)', () => {
  test('neuer Vorgang: alles', () => {
    const u = stammdatenUebernahme({ antragsart: 'erstantrag' }, antrag, false);
    expect(u.updates).toMatchObject({ antragsdatum: '2026-09-02', anspruchsgrund: 'erwerbsminderung', wohnsituation: 'miete', iban: 'DE89370400440532013000' });
    expect(u.updates.wohnung).toEqual({ strasse: 'Am Mühlbach', hausnummer: '12', plz: '97082', ort: 'Würzburg', kaltmiete: 520, heizkosten: 85 });
    expect(u.pfade).toContain('antragsart');
    expect(u.pfade).toContain('wohnung.kaltmiete');
  });
  test('Nachreichung: nur leere Felder, Handeingaben bleiben', () => {
    const u = stammdatenUebernahme({ antragsart: 'erstantrag', antragsdatum: '2026-08-30', wohnung: { kaltmiete: 500 } }, antrag, true);
    expect(u.updates.antragsdatum).toBeUndefined();
    expect(u.updates.wohnung).toEqual({ kaltmiete: 500, strasse: 'Am Mühlbach', hausnummer: '12', plz: '97082', ort: 'Würzburg', heizkosten: 85 });
    expect(u.pfade).not.toContain('wohnung.kaltmiete');
    expect(u.pfade).not.toContain('antragsdatum');
    expect(u.pfade).toContain('wohnung.heizkosten');
  });
});

describe('Weiterleitung → Ersteingang (§ 16 Abs. 2 SGB I)', () => {
  test('Stelle aus Betreff', () => {
    expect(stelleAusBetreff('Weitergeleitet von Wohngeldstelle Stadt Leer')).toBe('Wohngeldstelle Stadt Leer');
    expect(stelleAusBetreff('Schmidt, Erika — Erstantrag (weitergeleitet von Deutsche Rentenversicherung)')).toBe('Deutsche Rentenversicherung');
    expect(stelleAusBetreff('Weiterleitung: Jobcenter Kassel')).toBe('Jobcenter Kassel');
    expect(stelleAusBetreff('Schmidt, Erika — Erstantrag')).toBeUndefined();
  });
  test('nur Quelle „weiterleitung"; Metadatum vor Betreff; unbekannte Stelle leer', () => {
    expect(ersteingangAus({ quelle: 'scan', eingegangenAm: '2026-09-03T08:00:00Z' })).toBeUndefined();
    expect(ersteingangAus({ quelle: 'weiterleitung', eingegangenAm: '2026-09-03T08:00:00Z', betreff: 'weitergeleitet von X', data: { weitergeleitetVon: 'Wohngeldstelle' } }))
      .toEqual({ datum: '2026-09-03', stelle: 'Wohngeldstelle' });
    expect(ersteingangAus({ quelle: 'weiterleitung', eingegangenAm: '2026-09-03T08:00:00Z' })).toEqual({ datum: '2026-09-03' });
  });
  test('Ersteingang nur, wenn am Vorgang noch keiner steht', () => {
    expect(ersteingangUebernahme({}, { datum: '2026-09-03' })).toEqual({ ersteingang: { datum: '2026-09-03' } });
    expect(ersteingangUebernahme({ ersteingang: { stelle: 'DRV' } }, { datum: '2026-09-03' })).toEqual({});
    expect(ersteingangUebernahme({}, undefined)).toEqual({});
  });
  test('Betreff aus Antrag; Weiterleitungshinweis bleibt erhalten', () => {
    const dateien = [{ dateiname: 'a.pdf', contentType: 'application/pdf', groesse: 1, hash: 'h', typ: 'grundsicherungsantrag', stammdaten: antrag }] as PosteingangDatei[];
    expect(leiteBetreffAb(dateien)).toBe('Berger, Klaus — Erstantrag');
    expect(leiteBetreffAb(dateien, 'Weitergeleitet von Wohngeldstelle Leer')).toBe('Berger, Klaus — Erstantrag (weitergeleitet von Wohngeldstelle Leer)');
    expect(stelleAusBetreff(leiteBetreffAb(dateien, 'Weitergeleitet von Wohngeldstelle Leer'))).toBe('Wohngeldstelle Leer');
  });
});
