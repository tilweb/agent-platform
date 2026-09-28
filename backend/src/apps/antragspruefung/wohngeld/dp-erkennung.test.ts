import { describe, expect, test } from 'bun:test';
import { buildWohngeldEingangProject } from '../../../extraction/templates/wohngeld-eingang';
import { ABSCHNITT_ZU_TYP, abschnitteAusErgebnis, bruttokalt, fuerAuswertung, haushaltAusRohwerten, mappeAbschnitt } from './dp-erkennung';

describe('Profil-Vorlage', () => {
  const p = buildWohngeldEingangProject();
  test('jeder Abschnittstyp hat eine Abbildung und eine Beschreibung', () => {
    for (const [id, def] of Object.entries(p.segments!)) {
      expect(ABSCHNITT_ZU_TYP[id]).toBeTruthy();
      expect(def.description.length).toBeGreaterThan(40);
    }
  });
  test('Antrag nicht wiederholbar, Nachweise wiederholbar', () => {
    expect(p.segments!.wohngeldantrag!.repeatable).toBeFalsy();
    expect(p.segments!.gehaltsabrechnung!.repeatable).toBe(true);
    expect(p.segments!.personalausweis!.repeatable).toBe(true);
  });
});

test('Bruttokaltmiete aus Bestandteilen', () => {
  expect(bruttokalt({ gesamtmiete: 468.5, heizkosten: 62, warmwasser: 18 })).toBe(388.5);
  expect(bruttokalt({ gesamtmiete: '877,00', heizkosten: '78,00', warmwasser: 22 })).toBe(777);
  expect(bruttokalt({})).toBeUndefined();
});

describe('Abbildung je Abschnitt', () => {
  test('Antrag → Stammdaten, Bruttokaltmiete, Konfidenzpfade', () => {
    const e = mappeAbschnitt('wohngeldantrag', {
      antragsteller_nachname: 'Kessler', antragsteller_vorname: 'Waltraud', antragsteller_geburtsdatum: '1952-03-14',
      plz: '34127', ort: 'Kassel', gesamtmiete: 468.5, heizkosten: 62, warmwasser: 18, wohnflaeche_qm: 48,
      unterschrift_vorhanden: true, datum_vorhanden: true, antragsdatum: '2026-08-18',
    }, { gesamtmiete: 0.9, antragsteller_nachname: 0.8 });
    expect(e.typ).toBe('wohngeldantrag');
    expect(e.stammdaten!.wohnung!.miete).toBe(388.5);
    expect(e.stammdaten!.antragsart).toBe('erstantrag');
    expect(e.confidenceByPfad).toEqual({ 'wohnung.miete': 0.9, nachname: 0.8 });
    expect(e.analyse.unterschrift_vorhanden).toBe(true);
  });
  test('Wohngeldnummer ⇒ Weiterleistungsantrag', () => {
    expect(mappeAbschnitt('wohngeldantrag', { wohngeldnummer: 'WG-123' }).stammdaten!.antragsart).toBe('weiterleistungsantrag');
  });
  test('Mietvertrag ohne Gesamtmiete: Grundmiete + Nebenkosten', () => {
    expect(mappeAbschnitt('mietvertrag', { grundmiete: 545, nebenkosten: 165 }).analyse.miete).toBe(710);
  });
  test('Nachweise: Typ-Abbildung, Betrag, Identität', () => {
    const e = mappeAbschnitt('lohnersatzbescheid', { nachname: 'Brandes', vorname: 'Jan', betrag: 1149.9 });
    expect(e.typ).toBe('verdienstbescheinigung');
    expect(e.analyse.betrag).toBe(1149.9);
    expect(e.identitaet).toEqual({ nachname: 'Brandes', vorname: 'Jan', geburtsdatum: undefined });
    expect(mappeAbschnitt('aufenthaltstitel', {}).typ).toBe('personalausweis');
    expect(mappeAbschnitt('kontoauszug', { mietzahlung_erkannt: false, kapitalertraege_erkannt: true }).analyse)
      .toEqual({ mietzahlung_erkannt: false, erkannte_einkuenfte: ['kapitalertraege'] });
  });
});

describe('Abbildung für den Abgleich Antrag ↔ Beleg', () => {
  test('Mietvertrag: Bruttokalt aus Grundmiete + Nebenkosten, Heizung, Mieter, Beginn', () => {
    const a = mappeAbschnitt('mietvertrag', {
      grundmiete: 520, nebenkosten: 120, heizkosten: 70, warmwasser: 20, gesamtmiete: 640, mietbeginn: '01.08.2012',
      mieter: [{ vorname: 'Günther', nachname: 'Schäfle', geburtsdatum: '1951-10-07' }, { vorname: '' }],
    }).analyse;
    expect(a.miete).toBe(640);
    expect(a.heizkosten_warmwasser).toBe(90);
    expect(a.miete_gueltig_ab).toBe('2012-08-01');
    expect(a.mietdokument).toBe('mietvertrag');
    expect(a.mieter).toEqual([{ vorname: 'Günther', nachname: 'Schäfle', geburtsdatum: '1951-10-07' }]);
  });
  test('Vermieterbescheinigung und Mieterhöhung: Art und „gültig ab"', () => {
    const vb = mappeAbschnitt('vermieterbescheinigung', { gesamtmiete: 877, heizkosten: 78, warmwasser: 22, miete_seit: '2026-06-01' }).analyse;
    expect(vb).toMatchObject({ miete: 777, heizkosten_warmwasser: 100, miete_gueltig_ab: '2026-06-01', mietdokument: 'vermieterbescheinigung' });
    const mh = mappeAbschnitt('mieterhoehung', { neue_gesamtmiete: 877, heizung_warmwasser: 100, gueltig_ab: '01.06.2026' }).analyse;
    expect(mh).toMatchObject({ miete: 777, mietdokument: 'mieterhoehung', miete_gueltig_ab: '2026-06-01' });
  });
  test('Rentenbescheid: Rentenart, Brutto, Zahlbetrag, gültig ab, Person', () => {
    const a = mappeAbschnitt('rentenbescheid', { nachname: 'Kessler', vorname: 'Waltraud', geburtsdatum: '14.03.1952', rentenart: 'Regelaltersrente', betrag: 1184.2, zahlbetrag: '1.037,36', gueltig_ab: '2026-07-01' }).analyse;
    expect(a).toMatchObject({ einkommensart: 'rente', rentenart: 'Regelaltersrente', betrag: 1184.2, zahlbetrag: 1037.36, betrag_gueltig_ab: '2026-07-01', person_nachname: 'Kessler', person_geburtsdatum: '1952-03-14' });
  });
  test('Gehaltsabrechnung und Lohnersatz: Einkommensart, Monat, Arbeitgeber', () => {
    expect(mappeAbschnitt('gehaltsabrechnung', { brutto: 1380, abrechnungsmonat: '07/2026', arbeitgeber: 'Rheinufer Apotheken OHG' }).analyse)
      .toMatchObject({ einkommensart: 'lohn_gehalt', betrag: 1380, abrechnungsmonat: '2026-07', arbeitgeber: 'Rheinufer Apotheken OHG' });
    expect(mappeAbschnitt('lohnersatzbescheid', { leistungsart: 'Elterngeld', betrag: 780 }).analyse.einkommensart).toBe('elterngeld');
    expect(mappeAbschnitt('lohnersatzbescheid', { betrag: 780 }).analyse.einkommensart).toBeUndefined();
    expect(mappeAbschnitt('steuerunterlagen', { jahreseinkuenfte: 30000 }).analyse.einkommensart).toBeUndefined();
  });
  test('Kontoauszug: Saldo, IBAN, Mietzahlung, Eingänge (unbekannte Art → sonstige, leere Zeilen weg)', () => {
    const a = mappeAbschnitt('kontoauszug', {
      iban: 'DE12 3705 0211 0019 0447 36', zeitraum_bis: '31.07.2026', endsaldo: '-12,50', mietzahlung_betrag: -620,
      eingaenge: [{ verwendungszweck: 'Gaststätte', betrag: 480, art: 'erwerb', wiederkehrend: 'true' }, { art: 'lotto' , verwendungszweck: 'X' }, {}],
    }).analyse;
    expect(a).toMatchObject({ iban: 'DE12370502110019044736', zeitraum_bis: '2026-07-31', endsaldo: -12.5, mietzahlung_betrag: 620 });
    expect(a.eingaenge).toEqual([{ verwendungszweck: 'Gaststätte', betrag: 480, art: 'erwerb', wiederkehrend: true }, { verwendungszweck: 'X', art: 'sonstige' }]);
  });
  test('nicht erkannt ⇒ Felder fehlen', () => {
    const a = mappeAbschnitt('kontoauszug', { mietzahlung_erkannt: true, zeitraum_bis: 'Juli' }).analyse;
    expect(a).toEqual({ mietzahlung_erkannt: true });
  });
});

test('Segmentergebnis → Abschnitte (wiederholbar, Leerseite, unbekannt)', () => {
  const profil = buildWohngeldEingangProject();
  const a = abschnitteAusErgebnis({
    segments: [
      { type: 'gehaltsabrechnung', instance: 2, pageFrom: 3, pageTo: 3, confidence: 0.9 },
      { type: 'wohngeldantrag', instance: 1, pageFrom: 1, pageTo: 1, confidence: 0.95 },
      { type: 'gehaltsabrechnung', instance: 1, pageFrom: 2, pageTo: 2, confidence: 0.8 },
      { type: 'leerseite', instance: 1, pageFrom: 4, pageTo: 4, confidence: 1 },
      { type: 'unbekannt', instance: 1, pageFrom: 5, pageTo: 5, confidence: 0 },
    ],
    data: {
      wohngeldantrag: { antragsteller_nachname: 'A' },
      gehaltsabrechnung: [{ nachname: 'A', brutto: 1000 }, { nachname: 'A', brutto: 1100 }],
    },
    fieldConfidences: { 'gehaltsabrechnung[2].brutto': 0.7 },
    segmentContexts: { 'gehaltsabrechnung[2]': 'Juli' },
  }, profil);
  expect(a.map((x) => [x.seiteVon, x.typ])).toEqual([[1, 'wohngeldantrag'], [2, 'gehaltsabrechnung'], [3, 'gehaltsabrechnung'], [5, 'sonstiges']]);
  expect(a[2]!.analyse.betrag).toBe(1100);
  expect(a[2]!.text).toBe('Juli');
  expect(a[3]!.titel).toBe('Nicht erkanntes Dokument');
});

describe('haushaltAusRohwerten', () => {
  test('normalisiert Listen, verwirft leere Blöcke, summiert Vermögen', () => {
    const h = haushaltAusRohwerten({
      antragsteller_erwerbsstatus: 'Arbeitnehmer/in',
      haushaltsmitglieder: [{ nachname: 'Weber', vorname: 'Olga', geburtsdatum: '1988-11-27', verhaeltnis: 'Ehefrau' }, { nachname: '', vorname: '' }],
      einnahmen: [{ nachname: 'Weber', vorname: 'Andrej', art: 'Gehalt/Lohn', brutto: '2.640,00', turnus: 'monatlich' }, { nachname: 'Weber', vorname: 'Olga' }],
      behinderung_pflege: [{ nachname: 'Weber', vorname: 'Olga', gdb: 50, pflegegrad: null }],
      transferleistungen: [{ nachname: 'Weber', vorname: 'Olga', leistung: '' }],
      vermoegen_geld: 40000, vermoegen_immobilien: '85.000,00',
    });
    expect(h).toEqual({
      antragstellerErwerbsstatus: 'Arbeitnehmer/in',
      mitglieder: [{ nachname: 'Weber', vorname: 'Olga', geburtsdatum: '1988-11-27', verhaeltnis: 'Ehefrau' }],
      einnahmen: [{ nachname: 'Weber', vorname: 'Andrej', art: 'Gehalt/Lohn', brutto: 2640, turnus: 'monatlich' }],
      behinderung: [{ nachname: 'Weber', vorname: 'Olga', gdb: 50 }],
      transfer: [],
      vermoegen: 125000,
      vermoegenArten: [{ art: 'Immobilien, Grundbesitz', betrag: 85000 }, { art: 'Geldvermögen, Forderungen', betrag: 40000 }],
    });
  });
  test('ohne Haushaltsangaben undefined', () => {
    expect(haushaltAusRohwerten({ antragsteller_nachname: 'X' })).toBeUndefined();
  });
  test('Antrag trägt den Haushalt in den Stammdaten', () => {
    const e = mappeAbschnitt('wohngeldantrag', { antragsteller_nachname: 'Weber', antragsteller_vorname: 'Andrej', haushaltsmitglieder: [{ nachname: 'Weber', vorname: 'Olga' }] });
    expect(e.stammdaten?.haushalt?.mitglieder).toEqual([{ nachname: 'Weber', vorname: 'Olga' }]);
  });
});

describe('haushaltAusRohwerten — Dubletten aus der abschnittsweisen Extraktion', () => {
  test('gleichnamige Mitglieder zusammengeführt, Antragsteller entfernt, doppelte Einnahmen entfernt', () => {
    const h = haushaltAusRohwerten({
      antragsteller_vorname: 'Andrej', antragsteller_nachname: 'Weber',
      haushaltsmitglieder: [
        { nachname: 'Weber', vorname: 'Sofia', geburtsdatum: '2016-09-02', verhaeltnis: 'Tochter' },
        { nachname: 'Weber', vorname: 'Andrej' },
        { nachname: 'Weber', vorname: 'Sofia', erwerbsstatus: 'Nichterwerbsperson' },
      ],
      einnahmen: [
        { nachname: 'Weber', vorname: 'Andrej', art: 'Gehalt/Lohn', brutto: 2640 },
        { nachname: 'Weber', vorname: 'Andrej', art: 'Gehalt/Lohn', brutto: 2640 },
      ],
    });
    expect(h?.mitglieder).toEqual([{ nachname: 'Weber', vorname: 'Sofia', geburtsdatum: '2016-09-02', verhaeltnis: 'Tochter', erwerbsstatus: 'Nichterwerbsperson' }]);
    expect(h?.einnahmen).toHaveLength(1);
  });
});

describe('fuerAuswertung', () => {
  test('ohne Testbestand und ohne gespeicherte Originaldateien', () => {
    const b = (id: string, purpose: 'train' | 'test', original?: object) => ({ id, dataset: { purpose, ...(original ? { original } : {}) } }) as never;
    const r = fuerAuswertung([b('t1', 'test', { base64: 'AAAA' }), b('a1', 'train', { base64: 'BBBB' }), b('a2', 'train')]);
    expect(r.map((x: { id: string }) => x.id)).toEqual(['a1', 'a2']);
    expect((r[0] as { dataset: { original?: unknown } }).dataset.original).toBeUndefined();
  });
});

describe('Mietvertrag: Unterschrift mit Konfidenz und Seite (Hinweis zum Sichten)', () => {
  const p = buildWohngeldEingangProject();
  const erg = (boxes?: Record<string, { page: number }>) => abschnitteAusErgebnis({
    segments: [{ type: 'mietvertrag', instance: 1, pageFrom: 16, pageTo: 19, confidence: 0.9 }],
    data: { mietvertrag: { unterschrift_vorhanden: false, grundmiete: 400 } },
    fieldConfidences: { 'mietvertrag.unterschrift_vorhanden': 0.7 },
    ...(boxes ? { boxes } : {}),
  }, p)[0]!;
  test('ohne Fundstelle: letzte Seite des Vertrags, Konfidenz aus der Extraktion', () => {
    const a = erg();
    expect(a.analyse).toMatchObject({ unterschrift_vorhanden: false, unterschrift_konfidenz: 0.7, unterschrift_seite: 4 });
    const feld = a.extraktion!.felder.find((f) => f.label === 'Unterschrift')!;
    expect(feld).toMatchObject({ wert: 'fehlt', seite: 4, confidence: 0.7 });
  });
  test('mit Fundstelle: deren Seite, relativ zum Abschnitt; unplausible Fundstelle → letzte Seite', () => {
    expect(erg({ 'mietvertrag.unterschrift_vorhanden': { page: 18 } }).analyse!.unterschrift_seite).toBe(3);
    expect(erg({ 'mietvertrag.unterschrift_vorhanden': { page: 30 } }).analyse!.unterschrift_seite).toBe(4);
  });
});

describe('Haushalt: Frage 7 (Mitbewohner) und Frage 8 (verstorben) gehören nicht zu Frage 6', () => {
  test('als Haushaltsmitglied mitgelesene Mitbewohner/Verstorbene werden entfernt (Golden F24, F27)', () => {
    const h = haushaltAusRohwerten({
      antragsteller_vorname: 'Zofia', antragsteller_nachname: 'Kowalczyk',
      haushaltsmitglieder: [{ vorname: 'Jannik', nachname: 'Brüggemann' }, { vorname: 'Selin', nachname: 'Aydin' }, { vorname: 'Christa', nachname: 'Pöllmann' }],
      weitere_personen: [{ vorname: 'Jannik', nachname: 'Brüggemann' }, { vorname: 'Selin', nachname: 'Aydın' }],
      verstorbene: [{ vorname: 'Christa', nachname: 'Pöllmann' }],
      einnahmen: [{ vorname: 'Zofia', nachname: 'Kowalczyk', art: 'BAföG', brutto: 812 }],
    })!;
    expect(h.mitglieder).toEqual([]);
  });
  test('echte Haushaltsmitglieder bleiben (Namensgleichheit nur mit Vorname)', () => {
    const h = haushaltAusRohwerten({
      antragsteller_vorname: 'Josef', antragsteller_nachname: 'Pöllmann',
      haushaltsmitglieder: [{ vorname: 'Anna', nachname: 'Pöllmann', geburtsdatum: '2001-01-01', verhaeltnis: 'Tochter' }],
      verstorbene: [{ vorname: 'Christa', nachname: 'Pöllmann' }],
    })!;
    expect(h.mitglieder.map((m) => m.vorname)).toEqual(['Anna']);
  });
});
