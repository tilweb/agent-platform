import { describe, expect, test } from 'bun:test';
import { buildWohngeldEingangProject } from '../../extraction/templates/wohngeld-eingang';
import { ABSCHNITT_ZU_TYP, abschnitteAusErgebnis, bruttokalt, haushaltAusRohwerten, mappeAbschnitt } from './dp-erkennung';

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
