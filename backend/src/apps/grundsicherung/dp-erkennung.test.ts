/**
 * Grundsicherung — Profil-Vorlage und Abbildung Profil-Rohwerte → DokumentAnalyse-Vertrag /
 * Antrags-Stammdaten (je Dokumenttyp mind. ein Fall). Keine LLM-/DB-Aufrufe.
 */
import { describe, expect, test } from 'bun:test';
import { buildGrundsicherungEingangProject, GRUNDSICHERUNG_PROFIL_ID } from '../../extraction/templates/grundsicherung-eingang';
import {
  abschnitteAusErgebnis, antragAusRohwerten, baueExtraktion, BEKANNTE_EINKOMMENS_ARTEN, einkommensArtAus, eingangArtAus,
  eingangSchluessel, fasseEingaengeZusammen, markiereWiederkehrendeEingaenge,
  mappeAbschnitt, merkzeichenAus, rentenartAus, typVonAbschnitt, vermoegensArtAus, vorlagenHash, zahl,
} from './dp-erkennung';
import { DOKUMENT_TYPEN, VERMOEGENS_ARTEN } from './types';

const profil = buildGrundsicherungEingangProject();

describe('Profil-Vorlage „Grundsicherung-Eingang"', () => {
  test('ID, 21 Segmenttypen = Dokumenttypen der App (1:1)', () => {
    expect(profil.id).toBe(GRUNDSICHERUNG_PROFIL_ID);
    expect(Object.keys(profil.segments!).sort()).toEqual([...DOKUMENT_TYPEN].sort());
    expect(Object.keys(profil.segments!)).toHaveLength(21);
    for (const id of Object.keys(profil.segments!)) expect(typVonAbschnitt(id)).toBe(id as never);
  });
  test('jede Beschreibung ist konkret; extrahierende Segmente haben Felder', () => {
    for (const def of Object.values(profil.segments!)) {
      expect(def.description.length).toBeGreaterThan(80);
      if (def.mode !== 'classify-only') expect(Object.keys(def.fields ?? {}).length).toBeGreaterThan(0);
    }
  });
  test('Antrag nicht wiederholbar (mehrseitiges Formular), Nachweise wiederholbar', () => {
    expect(profil.segments!.grundsicherungsantrag!.repeatable).toBeFalsy();
    expect(profil.segments!.kontoauszug!.repeatable).toBe(true);
    expect(profil.segments!.rentenbescheid!.repeatable).toBe(true);
    expect(profil.segments!.kontoauszug!.description).toContain('eigenes Dokument');
  });
  test('Antrag bildet die Stammdaten des Vertrags ab', () => {
    const f = Object.keys(profil.segments!.grundsicherungsantrag!.fields!);
    for (const k of ['anspruchsgrund', 'wohnsituation', 'kaltmiete', 'nebenkosten_kalt', 'heizkosten', 'einkommen', 'vermoegen', 'kein_vermoegen',
      'krankenversicherung', 'schwerbehinderung', 'mehrbedarf_ernaehrung', 'unterhalt_ueber_100k', 'iban', 'unterschrift_vorhanden',
      'antragsdatum', 'vorbezug_leistung', 'wohngeld_antrag_laeuft', 'partner_nachname', 'haushaltsangehoerige', 'antragsteller_familienstand']) {
      expect(f).toContain(k);
    }
  });
  test('Vorlagen-Fingerabdruck stabil und inhaltsabhängig', () => {
    expect(vorlagenHash(profil)).toBe(vorlagenHash(buildGrundsicherungEingangProject()));
    expect(vorlagenHash({ ...profil, instructions: 'x' })).not.toBe(vorlagenHash(profil));
  });
});

describe('Vokabular', () => {
  test('Zahlen mit Dezimalkomma', () => {
    expect(zahl('1.234,56')).toBe(1234.56);
    expect(zahl('468,50 €')).toBe(468.5);
    expect(zahl('')).toBeUndefined();
  });
  test('Einkommensarten landen im Vokabular der Regel-Engine', () => {
    const faelle: Array<[string, string]> = [
      ['Regelaltersrente', 'altersrente'], ['Rente wegen voller Erwerbsminderung', 'em_rente'], ['große Witwenrente', 'hinterbliebenenrente'],
      ['Zusatzversorgung (VBL)', 'zusatzversorgung'], ['Betriebsrente', 'betriebsrente'], ['Wohngeld', 'wohngeld'],
      ['Minijob', 'minijob'], ['private Rentenversicherung', 'private_rente'], ['Zinsen', 'kapitalertraege'],
    ];
    for (const [t, art] of faelle) {
      expect(einkommensArtAus(t)).toBe(art);
      expect(BEKANNTE_EINKOMMENS_ARTEN.has(art)).toBe(true);
    }
  });
  test('Vermögensarten wie die Regel-Engine sie unterscheidet', () => {
    expect(vermoegensArtAus('Sparbuch Sparkasse')).toBe('sparbuch');
    expect(vermoegensArtAus('Bestattungsvorsorge')).toBe('bestattungsvorsorge');
    expect((VERMOEGENS_ARTEN.konto as readonly string[]).includes(vermoegensArtAus('Girokonto')!)).toBe(true);
    expect(vermoegensArtAus('Lebensversicherung (Allianz)')).toBe('lebensversicherung');
  });
  test('Rentenart, Merkzeichen, Eingangsart', () => {
    expect(rentenartAus('Rente wegen teilweiser Erwerbsminderung')).toBe('teilweise_em');
    expect(rentenartAus('Rente wegen voller Erwerbsminderung')).toBe('volle_em');
    expect(rentenartAus('Regelaltersrente')).toBe('altersrente');
    expect(merkzeichenAus('G, B')).toEqual(['G', 'B']);
    expect(merkzeichenAus('keine')).toEqual([]);
    expect(eingangArtAus(undefined, 'VBL Karlsruhe')).toBe('betriebsrente');
    expect(eingangArtAus('wohngeld', 'x')).toBe('wohngeld');
  });
});

describe('Antrag → Stammdaten + Analyse', () => {
  const roh = {
    antragsart: 'Erstantrag', antragsdatum: '15.06.2026', anspruchsgrund: 'Altersgrenze erreicht',
    unterschrift_vorhanden: true, datum_vorhanden: 'false', regelbedarfsstufe: 2,
    antragsteller_nachname: 'Berger', antragsteller_vorname: 'Klaus', antragsteller_geburtsdatum: '1956-02-10', antragsteller_familienstand: 'verheiratet',
    partner_nachname: 'Berger', partner_vorname: 'Sabine', partner_geburtsdatum: '1958-07-01',
    haushaltsangehoerige: [{ nachname: 'Berger', vorname: 'Tim', geburtsdatum: '1990-01-01', verhaeltnis: 'Sohn' }, { nachname: 'Berger', vorname: 'Klaus' }],
    strasse: 'Am Mühlbach', hausnummer: '12', plz: '97082', ort: 'Würzburg', wohnsituation: 'Mietwohnung',
    kaltmiete: '520,00', nebenkosten_kalt: 110, heizkosten: 85, warmwasser: 'zentral über Heizung', bewohner_anzahl: 3,
    einkommen: [
      { nachname: 'Berger', vorname: 'Klaus', art: 'Altersrente', betrag_monat: '950,00', traeger: 'DRV' },
      { vorname: 'Sabine', art: 'Minijob', betrag_monat: 450 },
      { art: 'Betriebsrente', betrag_monat: 80 },
      { nachname: 'Fremd', vorname: 'Otto', art: 'Unterhalt', betrag_monat: 100 },
    ],
    vermoegen: [{ vorname: 'Klaus', nachname: 'Berger', art: 'Sparbuch', betrag: 3000 }],
    krankenversicherung: [{ vorname: 'Klaus', art: 'pflichtversichert (KVdR)', kasse: 'AOK' }, { vorname: 'Sabine', art: 'familienversichert' }],
    schwerbehinderung: [{ vorname: 'Klaus', gdb: 70, merkzeichen: 'G' }],
    mehrbedarf_ernaehrung: [{ vorname: 'Sabine', erkrankung: 'Zöliakie' }],
    unterhalt_angaben_gemacht: true, unterhalt_ueber_100k: false,
    iban: 'DE89 3704 0044 0532 0130 00', wohngeld_antrag_laeuft: true, vorbezug_leistung: 'Bürgergeld', vorbezug_bis: '2026-05-31',
  };
  const s = antragAusRohwerten(roh);

  test('Vorgangsdaten', () => {
    expect(s).toMatchObject({
      antragsart: 'erstantrag', antragsdatum: '2026-06-15', anspruchsgrund: 'alter', wohnsituation: 'miete',
      iban: 'DE89370400440532013000', wohngeld_antrag_laeuft: true, vorbezug: { leistung: 'Bürgergeld', bis: '2026-05-31' },
      adresse: { strasse: 'Am Mühlbach', hausnummer: '12', plz: '97082', ort: 'Würzburg' },
      wohnung: { kaltmiete: 520, nebenkosten_kalt: 110, heizkosten: 85, warmwasser: 'zentral', bewohner_anzahl: 3 },
      antragsteller: { nachname: 'Berger', vorname: 'Klaus', geburtsdatum: '1956-02-10' },
    });
  });
  test('Personen mit Rolle, Familienstand; Doppelnennung der antragstellenden Person entfällt', () => {
    expect(s.personen!.map((p) => [p.rolle, p.vorname])).toEqual([['antragsteller', 'Klaus'], ['partner', 'Sabine'], ['haushaltsangehoerig', 'Tim']]);
    expect(s.personen![1]!.familienstand).toBe('verheiratet');
    expect(s.personen![2]!.verhaeltnis).toBe('Sohn');
  });
  test('Einkommen/Vermögen/KV/Schwerbehinderung/Mehrbedarf je Person; unbekannter Name gezählt', () => {
    const [klaus, sabine, tim] = s.personen!;
    expect(klaus!.einkommen).toEqual([{ art: 'altersrente', betrag_monat: 950, traeger: 'DRV' }, { art: 'betriebsrente', betrag_monat: 80 }]);
    expect(sabine!.einkommen).toEqual([{ art: 'minijob', betrag_monat: 450 }]);
    expect(s.nichtZugeordnet).toBe(1);
    expect(klaus!.vermoegen).toEqual([{ art: 'sparbuch', betrag: 3000 }]);
    expect(sabine!.vermoegen).toEqual([]);            // Abschnitt beantwortet → Erklärung „nichts"
    expect(tim!.vermoegen).toBeUndefined();           // Haushaltsangehörige: keine Erklärung
    expect(klaus!.krankenversicherung).toEqual({ art: 'pflicht', kasse: 'AOK' });
    expect(sabine!.krankenversicherung).toEqual({ art: 'familie' });
    expect(klaus!.schwerbehinderung).toEqual({ gdb: 70, merkzeichen: ['G'] });
    expect(sabine!.mehrbedarf_ernaehrung).toBe(true);
    expect(klaus!.unterhalt_kinder_eltern).toEqual({ angegeben: true, ueber_100k_moeglich: false });
    expect(tim!.unterhalt_kinder_eltern).toBeUndefined();
  });
  test('„kein Vermögen" ⇒ vermoegen: [] je Person der Einsatzgemeinschaft; ohne Angabe undefined', () => {
    expect(antragAusRohwerten({ antragsteller_nachname: 'A', kein_vermoegen: true }).personen![0]!.vermoegen).toEqual([]);
    expect(antragAusRohwerten({ antragsteller_nachname: 'A' }).personen![0]!.vermoegen).toBeUndefined();
  });
  test('Erwerbsminderung und Weiterbewilligung per Aktenzeichen', () => {
    const x = antragAusRohwerten({ anspruchsgrund: 'dauerhaft voll erwerbsgemindert', em_voll: true, em_befristet_bis: '31.12.2027', aktenzeichen: '50.2-123' });
    expect(x.anspruchsgrund).toBe('erwerbsminderung');
    expect(x.antragsart).toBe('weiterbewilligung');
    expect(x.personen![0]!.erwerbsminderung).toEqual({ voll: true, befristet_bis: '2027-12-31' });
  });
  test('Abschnitt → AntragAnalyse, Identität, Konfidenzpfade', () => {
    const e = mappeAbschnitt('grundsicherungsantrag', roh, { kaltmiete: 0.9, antragsteller_nachname: 0.8, antragsdatum: 0.7 });
    expect(e.typ).toBe('grundsicherungsantrag');
    expect(e.analyse).toEqual({ unterschrift_vorhanden: true, datum_vorhanden: false, regelbedarfsstufe: 2 });
    expect(e.identitaet).toEqual({ nachname: 'Berger', vorname: 'Klaus', geburtsdatum: '1956-02-10' });
    expect(e.confidenceByPfad).toEqual({ 'wohnung.kaltmiete': 0.9, nachname: 0.8, antragsdatum: 0.7 });
  });
});

describe('Nachweise → DokumentAnalyse-Vertrag (je Dokumenttyp)', () => {
  const P = { nachname: 'Schmidt', vorname: 'Erika' };
  const faelle: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
    ['personalausweis', { ...P, geburtsdatum: '03.09.1956', gueltig_bis: '2030-01-01' }, { geburtsdatum: '1956-09-03', nachname: 'Schmidt', vorname: 'Erika' }],
    ['betreuerausweis', { ...P, art: 'Betreuerausweis', vertreter_name: 'H. Maier' }, { art: 'Betreuerausweis' }],
    ['rentenbescheid', { ...P, rentenart: 'Rente wegen voller Erwerbsminderung', befristet_bis: '2027-12-31', unbefristet: false, zahlbetrag: '950,00', bescheiddatum: '2026-07-15', geburtsdatum: '1968-02-10', grundrentenzuschlag: 'nein' },
      { rentenart: 'volle_em', befristet_bis: '2027-12-31', unbefristet: false, zahlbetrag: 950, bescheiddatum: '2026-07-15', geburtsdatum: '1968-02-10', grundrentenzuschlag: false }],
    ['rentenanpassungsmitteilung', { ...P, stichtag: '2026-07-01', zahlbetrag_alt: 780, zahlbetrag_neu: '813,50' }, { stichtag: '2026-07-01', zahlbetrag_alt: 780, zahlbetrag_neu: 813.5 }],
    ['em_feststellung_rv', { ...P, dauerhaft_voll_erwerbsgemindert: true, datum: '2026-05-02' }, { dauerhaft_voll_erwerbsgemindert: true, datum: '2026-05-02' }],
    ['betriebsrente_mitteilung', { ...P, traeger: 'VBL', betrag_monat: 112 }, { traeger: 'VBL', betrag_monat: 112 }],
    ['kontoauszug', {
      ...P, iban: 'DE44 5001 0517 5407 3249 31', zeitraum_von: '2026-03-01', zeitraum_bis: '2026-05-31', endsaldo: '655,00',
      eingaenge: [{ betrag: 780, verwendungszweck: 'Deutsche Rentenversicherung', art: 'rente', wiederkehrend: true, anzahl: 3 }, { betrag: 112, verwendungszweck: 'VBL', wiederkehrend: true, anzahl: 3 }],
      mietzahlung_erkannt: true, mietzahlung_betrag: 650, grosse_abgaenge: [{ betrag: -5000, datum: '2026-04-02', verwendungszweck: 'Barauszahlung' }],
    }, {
      iban: 'DE44500105175407324931', zeitraum_von: '2026-03-01', zeitraum_bis: '2026-05-31', endsaldo: 655,
      eingaenge: [{ betrag: 780, verwendungszweck: 'Deutsche Rentenversicherung', art: 'rente', wiederkehrend: true, anzahl: 3 }, { betrag: 112, verwendungszweck: 'VBL', art: 'betriebsrente', wiederkehrend: true, anzahl: 3 }],
      mietzahlung_erkannt: true, mietzahlung_betrag: 650, grosse_abgaenge: [{ betrag: 5000, datum: '2026-04-02', verwendungszweck: 'Barauszahlung' }],
    }],
    ['mietvertrag', { mieter: [{ vorname: 'Klaus', nachname: 'Berger' }, { vorname: 'Sabine', nachname: 'Berger' }], beginn: '2015-04-01', grundmiete: 520, nebenkosten_kalt: 110, heizkosten: 85, unterschrift_vorhanden: true },
      { mieter: ['Klaus Berger', 'Sabine Berger'], beginn: '2015-04-01', grundmiete: 520, nebenkosten_kalt: 110, heizkosten: 85, unterschrift_vorhanden: true }],
    ['vermieterbescheinigung', { grundmiete: 480, nebenkosten_kalt: 95, heizkosten: 75, gueltig_ab: '2026-01-01', bewohner_anzahl: 1 }, { grundmiete: 480, nebenkosten_kalt: 95, heizkosten: 75, gueltig_ab: '2026-01-01' }],
    ['nebenkostenabrechnung', { heizkosten_enthalten: true, abrechnungszeitraum_bis: '2025-12-31', nachzahlung_guthaben: 42 }, { heizkosten_enthalten: true, abrechnungszeitraum_bis: '2025-12-31' }],
    ['energieabrechnung', { art: 'Fernwärme', abschlag: 70 }, { art: 'Fernwärme' }],
    ['eigentum_nachweis', { art: 'Grundsteuerbescheid', betrag: 210 }, { art: 'Grundsteuerbescheid' }],
    ['vermoegensnachweis', { ...P, art: 'Sparbuch', stand: '14.200,00', stichtag: '2026-07-31' }, { art: 'sparbuch', stand: 14200, stichtag: '2026-07-31' }],
    ['bestattungsvorsorge', { ...P, art: 'Treuhandvertrag', betrag: 4000 }, { art: 'Treuhandvertrag' }],
    ['kv_pv_nachweis', { ...P, art: 'pflichtversichert', kasse: 'AOK' }, { art: 'pflichtversichert' }],
    ['schwerbehindertenausweis', { ...P, gdb: 60, merkzeichen: 'G, B', gueltig_bis: '2027-01-31' }, { gdb: 60, merkzeichen: ['G', 'B'], gueltig_bis: '2027-01-31' }],
    ['aerztliche_bescheinigung', { ...P, zweck: 'Krankenkost', datum: '2026-06-01' }, { zweck: 'ernaehrung', datum: '2026-06-01' }],
    ['wohngeldbescheid', { ...P, betrag_monat: 186, bwz_von: '2026-03-01', bwz_bis: '2027-02-28', bescheiddatum: '2026-02-18' }, { betrag_monat: 186, bwz_von: '2026-03-01', bwz_bis: '2027-02-28', bescheiddatum: '2026-02-18' }],
    ['transferleistungsbescheid', { ...P, leistung: 'Bürgergeld', betrag_monat: 563 }, { art: 'Bürgergeld' }],
    ['sonstiges', { irgendwas: 1 }, {}],
  ];
  for (const [abschnitt, roh, erwartet] of faelle) {
    test(abschnitt, () => {
      const e = mappeAbschnitt(abschnitt, roh);
      expect(e.typ).toBe(abschnitt as never);
      expect(e.analyse).toEqual(erwartet as never);
    });
  }
  test('alle Dokumenttypen abgedeckt', () => {
    expect([...faelle.map(([a]) => a), 'grundsicherungsantrag'].sort()).toEqual([...DOKUMENT_TYPEN].sort());
  });
  test('nicht erkannt ⇒ Feld weglassen (nie false/0 raten)', () => {
    expect(mappeAbschnitt('kontoauszug', { iban: 'DE1' }).analyse).toEqual({ iban: 'DE1' });
    expect(mappeAbschnitt('mietvertrag', {}).analyse).toEqual({});
  });
  test('Identität für Match und Personenzuordnung', () => {
    expect(mappeAbschnitt('rentenbescheid', { ...P, geburtsdatum: '1956-09-03' }).identitaet).toEqual({ ...P, geburtsdatum: '1956-09-03' });
    expect(mappeAbschnitt('mietvertrag', { mieter: [P] }).identitaet).toBeUndefined();
  });
  test('unbekannter Abschnitt → sonstiges', () => {
    expect(mappeAbschnitt('gehaltsabrechnung', { brutto: 1 }).typ).toBe('sonstiges');
  });
});

describe('Segmentergebnis → Abschnitte', () => {
  test('wiederholbar, Leerseite, unbekannt, Konfidenzen, Extraktion', () => {
    const a = abschnitteAusErgebnis({
      segments: [
        { type: 'kontoauszug', instance: 2, pageFrom: 14, pageTo: 14, confidence: 0.88 },
        { type: 'grundsicherungsantrag', instance: 1, pageFrom: 1, pageTo: 12, confidence: 0.97 },
        { type: 'leerseite', instance: 1, pageFrom: 13, pageTo: 13, confidence: 1 },
        { type: 'unbekannt', instance: 1, pageFrom: 15, pageTo: 15, confidence: 0.4 },
      ],
      data: {
        grundsicherungsantrag: { antragsteller_nachname: 'Schmidt', antragsteller_vorname: 'Erika', kaltmiete: 450, _beleg: 'x' },
        kontoauszug: [{ endsaldo: 1 }, { endsaldo: 655, nachname: 'Schmidt' }],
      },
      fieldConfidences: { 'grundsicherungsantrag.kaltmiete': 0.9, 'kontoauszug[2].endsaldo': 0.8 },
      segmentContexts: { 'kontoauszug[2]': 'Kontoauszug Nr. 5' },
    }, profil);
    expect(a.map((x) => [x.typ, x.seiteVon, x.seiteBis])).toEqual([['grundsicherungsantrag', 1, 12], ['kontoauszug', 14, 14], ['sonstiges', 15, 15]]);
    expect(a[0]!.rohwerte._beleg).toBeUndefined();
    expect(a[0]!.confidenceByPfad).toEqual({ 'wohnung.kaltmiete': 0.9 });
    expect(a[1]!.analyse).toEqual({ endsaldo: 655 });
    expect(a[1]!.text).toBe('Kontoauszug Nr. 5');
    expect(a[1]!.extraktion.felder).toContainEqual({ gruppe: 'Kontoauszug', label: 'Neuer Kontostand (Endsaldo) in EUR', wert: '655,00 €', confidence: 0.8 });
    expect(a[2]!.titel).toBe('Nicht erkanntes Dokument');
  });
  test('Transparenz: Listenfelder je Zeile', () => {
    const x = baueExtraktion(profil.segments!.grundsicherungsantrag, { einkommen: [{ vorname: 'Erika', art: 'Altersrente', betrag_monat: 780 }], unterschrift_vorhanden: true });
    expect(x.felder).toContainEqual({ gruppe: 'Einkommen je Person', label: '1.', wert: 'Erika, Altersrente, 780,00 €' });
    expect(x.felder).toContainEqual({ gruppe: 'Antrag auf Grundsicherung', label: 'Unterschrift vorhanden', wert: 'Ja' });
  });
});

describe('Kontoeingänge und Mieter (Befunde Golden-Messung 2026-09-28)', () => {
  test('Mieter:innen doppelt gelesen (Vertragskopf + Unterschriftenblock) → je Person einmal', () => {
    const a = mappeAbschnitt('mietvertrag', { mieter: [{ vorname: 'Klaus', nachname: 'Berger' }, { vorname: 'Sabine', nachname: 'Berger' }, { vorname: 'Klaus', nachname: 'BERGER' }] });
    expect((a.analyse as { mieter?: string[] }).mieter).toEqual(['Klaus Berger', 'Sabine Berger']);
  });
  test('Absender-Schlüssel ohne Monat/Nummern', () => {
    expect(eingangSchluessel({ verwendungszweck: 'VBL VERSORGUNGSANSTALT D. BUNDES BETRIEBSRENTE 03/2026' })).toBe('vbl versorgungsanstalt');
    expect(eingangSchluessel({ verwendungszweck: 'DEUTSCHE RENTENVERSICHERUNG HESSEN RENTE 04/26' })).toBe('deutsche rentenversicherung');
    expect(eingangSchluessel({ art: 'rente' })).toBe('art:rente');
  });
  test('doppelt gelesene Zeile im selben Auszug → eine Zeile, wiederkehrend', () => {
    const e = fasseEingaengeZusammen([
      { betrag: 112, verwendungszweck: 'VBL VERSORGUNGSANSTALT', art: 'betriebsrente', wiederkehrend: false, anzahl: 1 },
      { betrag: 780, verwendungszweck: 'DEUTSCHE RENTENVERSICHERUNG', art: 'rente', wiederkehrend: false, anzahl: 1 },
      { betrag: 112, verwendungszweck: 'VBL VERSORGUNGSANSTALT', art: 'betriebsrente', wiederkehrend: false, anzahl: 1 },
    ]);
    expect(e).toEqual([
      { betrag: 112, verwendungszweck: 'VBL VERSORGUNGSANSTALT', art: 'betriebsrente', wiederkehrend: true, anzahl: 2 },
      { betrag: 780, verwendungszweck: 'DEUTSCHE RENTENVERSICHERUNG', art: 'rente', wiederkehrend: false, anzahl: 1 },
    ]);
  });
  test('Monatsauszüge: derselbe Absender in zwei Auszügen → wiederkehrend; einmaliger Eingang bleibt', () => {
    const k = (iban: string | undefined, eingaenge: unknown[]) => ({ typ: 'kontoauszug' as const, analyse: { ...(iban ? { iban } : {}), eingaenge } as never });
    const vbl = (m: string) => ({ betrag: 112, verwendungszweck: `VBL VERSORGUNGSANSTALT BETRIEBSRENTE ${m}/2026`, art: 'betriebsrente', wiederkehrend: false, anzahl: 1 });
    const erst = { betrag: 38.2, verwendungszweck: 'STADTWERKE ERSTATTUNG', art: 'erstattung', wiederkehrend: false };
    const out = markiereWiederkehrendeEingaenge([
      { typ: 'grundsicherungsantrag' as const, analyse: {} },
      k('DE1', [vbl('03'), erst]), k('DE1', [vbl('04')]), k(undefined, [vbl('05')]), k('DE2', [{ betrag: 50, verwendungszweck: 'VBL VERSORGUNGSANSTALT X', wiederkehrend: false }]),
    ]);
    const e = (i: number) => (out[i]!.analyse as { eingaenge: Array<{ wiederkehrend?: boolean }> }).eingaenge;
    expect(e(1)[0]!.wiederkehrend).toBe(true);
    expect(e(1)[1]!.wiederkehrend).toBe(false);
    expect(e(2)[0]!.wiederkehrend).toBe(true);
    expect(e(3)[0]!.wiederkehrend).toBe(true);   // ohne IBAN: zählt zu jedem Konto
    expect(e(4)[0]!.wiederkehrend).toBe(true);   // anderes Konto, aber Auszug ohne IBAN trägt denselben Absender
  });
  test('einzelner Auszug: nichts wird markiert; Segmentergebnis wendet die Wiederkehr an', () => {
    const einer = [{ typ: 'kontoauszug' as const, analyse: { eingaenge: [{ verwendungszweck: 'VBL', wiederkehrend: false }] } as never }];
    expect(markiereWiederkehrendeEingaenge(einer)).toBe(einer);
    const a = abschnitteAusErgebnis({
      segments: [
        { type: 'kontoauszug', instance: 1, pageFrom: 1, pageTo: 1, confidence: 0.9 },
        { type: 'kontoauszug', instance: 2, pageFrom: 2, pageTo: 2, confidence: 0.9 },
      ],
      data: { kontoauszug: [
        { eingaenge: [{ betrag: 780, verwendungszweck: 'DEUTSCHE RENTENVERSICHERUNG RENTE 03/26', art: 'rente', wiederkehrend: false }] },
        { eingaenge: [{ betrag: 780, verwendungszweck: 'DEUTSCHE RENTENVERSICHERUNG RENTE 04/26', art: 'rente', wiederkehrend: false }] },
      ] },
    }, profil);
    for (const x of a) expect((x.analyse as { eingaenge: Array<{ wiederkehrend?: boolean }> }).eingaenge[0]!.wiederkehrend).toBe(true);
  });
});
