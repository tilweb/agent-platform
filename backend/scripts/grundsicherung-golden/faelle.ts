/**
 * Grundsicherung-Golden — die drei Goldfälle der Spec (docs/grundsicherung-app-spec-2026-09-27.md,
 * „Goldfälle"; Werte wie `apps/grundsicherung/seed-demo.ts`) als vollständige Unterlagen.
 *
 * Gegenüber dem Seed realistischer ausgestaltet: Kontoauszüge je Monat, Personalausweis,
 * Mitgliedsbescheinigung, Rentenbescheid mit Anlagen, Fall 3 mit altem Rentenbescheid +
 * Rentenanpassungsmitteilung 2026 und Mietvertrag von 2004 (aktuelle Miete per Mietbescheinigung).
 * Die Spec-Befunde bleiben fachlich begründet (Kontrolle: Befunde aus den Soll-Werten).
 *
 * `kern`: von Hand erwartete Kernfelder (Pfade in {typ, analyse, stammdaten, identitaet} nach
 * dem App-Mapping). `null` = darf NICHT gesetzt sein.
 */
import {
  antrag, kontoauszug, kvNachweis, mietvertrag, nebenkostenabrechnung, personalausweis, rentenanpassung,
  rentenbescheid, sparbuch, vermieterbescheinigung, wohngeldbescheid,
  type Anschrift, type Buchung, type DokumentVorlage, type KontoauszugDaten, type PersonBasis,
} from './dokumente';
import { rund } from './bausteine';

export interface FallDokument { vorlage: DokumentVorlage; kern: Record<string, unknown> }
export interface Fall {
  id: string;
  titel: string;
  beschreibung: string;
  dokumente: FallDokument[];
  /** Erwartete Befunde laut Spec (Goldfall-Abnahme). */
  befundeSpec: string[];
}

const AT = 'stammdaten.personen[rolle=antragsteller]';

/** Monatsauszüge mit durchgehendem Saldo; der letzte Auszug endet auf `endsaldo`. */
function auszuege(basis: Omit<KontoauszugDaten, 'nr' | 'von' | 'bis' | 'startsaldo' | 'buchungen' | 'umbruchNach'>, monate: Array<{ nr: number; von: string; bis: string; buchungen: Buchung[]; umbruchNach?: number }>, endsaldo: number): DokumentVorlage[] {
  const summe = monate.reduce((s, m) => s + m.buchungen.reduce((t, b) => t + b.betrag, 0), 0);
  let saldo = rund(endsaldo - summe);
  return monate.map((m) => {
    const v = kontoauszug({ ...basis, ...m, startsaldo: saldo });
    saldo = rund(saldo + m.buchungen.reduce((t, b) => t + b.betrag, 0));
    return v;
  });
}

// ═══ GS01 — Erika Schmidt ══════════════════════════════════════════════════

function fallSchmidt(): Fall {
  const adr: Anschrift = { strasse: 'Lindenweg', hausnummer: '7', plz: '34117', ort: 'Kassel' };
  const p: PersonBasis & Anschrift = { anrede: 'Frau', vorname: 'Erika', nachname: 'Schmidt', geburtsdatum: '1956-09-03', ...adr };
  const iban = 'DE44500105175407324931';
  const vsnr = '12 030956 S 012';
  const monat = (m: string, rentenTag: string, extra: Buchung[]): Buchung[] => [
    { tag: `2026-${m}-01`, text: 'DAUERAUFTRAG Hausverwaltung Kramer MIETE LINDENWEG 7 WHG 3', betrag: -650, miete: true },
    { tag: `2026-${m}-04`, text: 'LASTSCHRIFT Stadtwerke Kassel-Muster ABSCHLAG STROM VK 3004711', betrag: -52 },
    { tag: `2026-${m}-09`, text: 'KARTENZAHLUNG REWE MARKT KASSEL', betrag: -38.47 },
    { tag: `2026-${m}-12`, text: 'LASTSCHRIFT Muster-Telefon GmbH FESTNETZ RG 2026', betrag: -24.99 },
    { tag: `2026-${m}-16`, text: 'BARGELDAUSZAHLUNG GA KASSEL KOENIGSPLATZ', betrag: -150 },
    ...extra,
    { tag: `2026-${m}-27`, text: `GUTSCHRIFT VBL VERSORGUNGSANSTALT D. BUNDES U. D. LAENDER BETRIEBSRENTE ${m}/2026 VERS-NR 0418872305`, betrag: 112, eingang: { zweck: 'VBL Betriebsrente', art: 'betriebsrente', wiederkehrend: true } },
    { tag: rentenTag, text: `GUTSCHRIFT DEUTSCHE RENTENVERSICHERUNG HESSEN RENTE ${m}/26 VSNR ${vsnr.replace(/ /g, '')}`, betrag: 780, eingang: { zweck: 'Deutsche Rentenversicherung', art: 'rente', wiederkehrend: true } },
  ];
  const konto = auszuege({ bank: 'Kasseler Musterbank eG', bankAnschrift: 'Obere Königsstraße 1, 34117 Kassel', bic: 'GENODEMUSTER', inhaber: p, iban, jahr: 2026 }, [
    { nr: 3, von: '2026-03-01', bis: '2026-03-31', buchungen: monat('03', '2026-03-31', [{ tag: '2026-03-20', text: 'KARTENZAHLUNG APOTHEKE AM LINDENWEG', betrag: -11.3 }]) },
    { nr: 4, von: '2026-04-01', bis: '2026-04-30', umbruchNach: 5, buchungen: monat('04', '2026-04-30', [
      { tag: '2026-04-15', text: 'LASTSCHRIFT RUNDFUNK ARD ZDF DRADIO BEITRAG 04-06/2026', betrag: -55.08 },
      { tag: '2026-04-21', text: 'KARTENZAHLUNG ALDI SUED KASSEL', betrag: -31.2 },
      { tag: '2026-04-24', text: 'KARTENZAHLUNG DROGERIE MUSTER KASSEL', betrag: -9.85 },
    ]) },
    { nr: 5, von: '2026-05-01', bis: '2026-05-31', buchungen: monat('05', '2026-05-29', [{ tag: '2026-05-19', text: 'KARTENZAHLUNG ALDI SUED KASSEL', betrag: -27.64 }]) },
  ], 655);
  const kontoKern = (von: string, bis: string, i: number): Record<string, unknown> => ({
    typ: 'kontoauszug', 'identitaet.nachname': 'Schmidt', 'analyse.zeitraum_von': von, 'analyse.zeitraum_bis': bis,
    'analyse.endsaldo': konto[i]!.roh.endsaldo, 'analyse.mietzahlung_betrag': 650,
    'analyse.eingaenge[art=rente].betrag': 780, 'analyse.eingaenge[art=rente].wiederkehrend': true,
    'analyse.eingaenge[art=betriebsrente].betrag': 112, 'analyse.eingaenge[art=betriebsrente].wiederkehrend': true,
  });

  return {
    id: 'GS01', titel: 'Alleinstehende Rentnerin, Pauschalmiete, Betriebsrente nicht angegeben',
    beschreibung: 'Erika Schmidt (geb. 03.09.1956), verwitwet, Altersrente 780 €, Rentenbescheid von 03/2025 (Anpassung 2026 fehlt), Pauschalmiete 650 € inkl. Heizung, Kontoauszüge 03–05/2026 mit monatlich 112 € VBL-Betriebsrente, die im Antrag fehlt.',
    befundeSpec: ['rentenanpassungsmitteilung', 'plausi-kontoauszug-unerklaerte-eingaenge', 'plausi-heizung-in-miete-unklar', 'betriebsrente-nachweis'],
    dokumente: [
      {
        vorlage: antrag({
          behoerde: 'Stadt Kassel — Sozialamt', behoerdeZusatz: 'Obere Königsstraße 8, 34117 Kassel (MUSTER)',
          antragsteller: { ...p, geburtsort: 'Hann. Münden', staatsangehoerigkeit: 'deutsch', familienstand: 'verwitwet', geburtsname: 'Wagner', telefon: '0561 000000' },
          adresse: adr, partner: null, haushalt: [], anspruchsgrund: 'alter',
          wohnung: { flaeche: 46, bewohner: 1, einzug: '2012-05-01', vermieter: 'Hausverwaltung Kramer, Wilhelmshöher Allee 90, 34119 Kassel', gesamt: 650, heizungEnthalten: true, warmwasser: 'zentral' },
          wohngeldBeantragt: false, wohngeldBezug: false,
          einkommen: [{ zeile: 'Altersrente (gesetzliche Rentenversicherung)', betrag: 780, traeger: 'Deutsche Rentenversicherung Hessen' }],
          vermoegen: [{ zeile: 'Girokonto', betrag: 640, institut: 'Kasseler Musterbank eG' }], keinVermoegen: false,
          kv: { art: 'pflichtversichert (KVdR)', kasse: 'Hessische Musterkrankenkasse' },
          kinder: [{ name: 'Schmidt, Petra', geburtsdatum: '1981-02-14', wohnort: 'Göttingen' }], ueber100k: false,
          bank: { institut: 'Kasseler Musterbank eG', iban, inhaber: 'Erika Schmidt' }, antragsdatum: '2026-06-15', ort: 'Kassel',
        }),
        kern: {
          typ: 'grundsicherungsantrag', 'stammdaten.antragsteller.nachname': 'Schmidt', 'stammdaten.antragsteller.vorname': 'Erika',
          'stammdaten.antragsteller.geburtsdatum': '1956-09-03', 'stammdaten.anspruchsgrund': 'alter', 'stammdaten.antragsdatum': '2026-06-15',
          'stammdaten.wohnsituation': 'miete', 'stammdaten.wohnung.heizung_in_miete_enthalten': true, 'stammdaten.wohnung.kaltmiete': null,
          'stammdaten.iban': iban, [`${AT}.familienstand`]: 'verwitwet', [`${AT}.einkommen[art=altersrente].betrag_monat`]: 780,
          [`${AT}.einkommen[art=zusatzversorgung]`]: null, [`${AT}.vermoegen[art=girokonto].betrag`]: 640,
          'stammdaten.personen[rolle=partner]': null, 'analyse.unterschrift_vorhanden': true,
        },
      },
      {
        vorlage: personalausweis({ ...p, geburtsname: 'Wagner', geburtsort: 'Hann. Münden', gueltigBis: '2031-04-30', anschrift: adr, behoerde: 'Stadt Kassel', nummer: 'L01X00T47', groesse: 164, augen: 'grün' }),
        kern: { typ: 'personalausweis', 'identitaet.nachname': 'Schmidt', 'identitaet.vorname': 'Erika', 'identitaet.geburtsdatum': '1956-09-03' },
      },
      {
        vorlage: rentenbescheid({
          traeger: 'Deutsche Rentenversicherung Hessen', traegerAnschrift: 'Städelstraße 28, 60596 Frankfurt am Main', empfaenger: p, vsnr,
          bescheiddatum: '2025-03-12', rentenart: 'Regelaltersrente', rentenbeginn: '2022-08-01', zahlbetrag: 780, zahlbetragAb: '2025-04-01',
          antragVom: '2025-01-20', entgeltpunkte: 22.1348, neuberechnung: true, kasse: 'Hessische Musterkrankenkasse',
        }),
        kern: { typ: 'rentenbescheid', 'identitaet.nachname': 'Schmidt', 'analyse.rentenart': 'altersrente', 'analyse.zahlbetrag': 780, 'analyse.bescheiddatum': '2025-03-12', 'analyse.geburtsdatum': '1956-09-03' },
      },
      {
        vorlage: kvNachweis({ kasse: 'Hessische Musterkrankenkasse', kasseAnschrift: 'Kölnische Straße 5, 34117 Kassel', empfaenger: p, kvnr: 'S123456789', datum: '2026-06-02', seit: '2022-08-01' }),
        kern: { typ: 'kv_pv_nachweis', 'identitaet.nachname': 'Schmidt' },
      },
      {
        vorlage: mietvertrag({
          vermieter: 'Hausverwaltung Kramer', vermieterAnschrift: 'Wilhelmshöher Allee 90, 34119 Kassel', mieter: [{ vorname: 'Erika', nachname: 'Schmidt' }],
          objekt: { ...adr, lage: '1. Obergeschoss rechts (Wohnung 3)' }, flaeche: 46, zimmer: 2, beginn: '2012-05-01', unterzeichnet: '2012-04-10', pauschal: 650,
        }),
        kern: { typ: 'mietvertrag', 'analyse.mieter': ['Erika Schmidt'], 'analyse.beginn': '2012-05-01', 'analyse.pauschalmiete': 650, 'analyse.heizkosten_enthalten': true, 'analyse.heizkosten': null, 'analyse.unterschrift_vorhanden': true },
      },
      { vorlage: konto[0]!, kern: kontoKern('2026-03-01', '2026-03-31', 0) },
      { vorlage: konto[1]!, kern: kontoKern('2026-04-01', '2026-04-30', 1) },
      { vorlage: konto[2]!, kern: kontoKern('2026-05-01', '2026-05-31', 2) },
    ],
  };
}

// ═══ GS02 — Klaus Berger ═══════════════════════════════════════════════════

function fallBerger(): Fall {
  const adr: Anschrift = { strasse: 'Am Mühlbach', hausnummer: '12', plz: '97082', ort: 'Würzburg' };
  const p: PersonBasis & Anschrift = { anrede: 'Herr', vorname: 'Klaus', nachname: 'Berger', geburtsdatum: '1968-02-10', ...adr };
  const iban = 'DE89370400440532013000';
  const vsnr = '13 100268 B 505';
  const vermieter = 'Wohnbau Mainfranken-Muster GmbH';
  const monat = (m: string, rentenTag: string, extra: Buchung[]): Buchung[] => [
    { tag: `2026-${m}-01`, text: `DAUERAUFTRAG ${vermieter} MIETE AM MUEHLBACH 12 WE 7`, betrag: -715, miete: true },
    { tag: `2026-${m}-03`, text: 'UEBERWEISUNG SABINE BERGER HAUSHALTSGELD', betrag: 300, eingang: { zweck: 'Sabine Berger Haushaltsgeld', art: 'zuwendung', wiederkehrend: true } },
    { tag: `2026-${m}-05`, text: 'LASTSCHRIFT Stadtwerke Wuerzburg-Muster ABSCHLAG STROM', betrag: -61 },
    { tag: `2026-${m}-10`, text: 'KARTENZAHLUNG EDEKA WUERZBURG', betrag: -64.3 },
    { tag: `2026-${m}-14`, text: 'LASTSCHRIFT Muster-Mobilfunk AG RECHNUNG', betrag: -14.99 },
    { tag: `2026-${m}-18`, text: 'BARGELDAUSZAHLUNG GA WUERZBURG SANDERAU', betrag: -100 },
    ...extra,
    { tag: rentenTag, text: `GUTSCHRIFT DEUTSCHE RENTENVERSICHERUNG NORDBAYERN RENTE ${m}/26 VSNR ${vsnr.replace(/ /g, '')}`, betrag: 950, eingang: { zweck: 'Deutsche Rentenversicherung', art: 'rente', wiederkehrend: true } },
  ];
  const konto = auszuege({ bank: 'Mainfränkische Musterbank eG', bankAnschrift: 'Theaterstraße 1, 97070 Würzburg', bic: 'GENODEMFMUS', inhaber: p, iban, jahr: 2026 }, [
    { nr: 7, von: '2026-07-01', bis: '2026-07-31', buchungen: monat('07', '2026-07-31', [{ tag: '2026-07-22', text: 'KARTENZAHLUNG APOTHEKE SANDERAU', betrag: -23.4 }]) },
    { nr: 8, von: '2026-08-01', bis: '2026-08-31', buchungen: monat('08', '2026-08-31', [{ tag: '2026-08-20', text: 'KARTENZAHLUNG NETTO WUERZBURG', betrag: -41.75 }, { tag: '2026-08-25', text: 'LASTSCHRIFT Muster-Versicherung HAFTPFLICHT JAHRESBEITRAG', betrag: -68.9 }]) },
  ], 312.4);
  const kontoKern = (von: string, bis: string, i: number): Record<string, unknown> => ({
    typ: 'kontoauszug', 'identitaet.nachname': 'Berger', 'analyse.zeitraum_von': von, 'analyse.zeitraum_bis': bis,
    'analyse.endsaldo': konto[i]!.roh.endsaldo, 'analyse.mietzahlung_betrag': 715, 'analyse.eingaenge[art=rente].betrag': 950,
  });

  return {
    id: 'GS02', titel: 'Paar, Antragsteller 58 J., EM-Rente befristet, Partnerin nicht im Antrag',
    beschreibung: 'Klaus Berger (geb. 10.02.1968), verheiratet, Rente wegen voller Erwerbsminderung 950 € befristet bis 31.12.2027. Partnerin Sabine Berger fehlt im Antrag, ist aber Mitmieterin und überweist monatlich Haushaltsgeld. Kein Vermögen angegeben.',
    befundeSpec: ['plausi-em-rente-befristet', 'em-feststellung-rv', 'plausi-partner-fehlt', 'vorrang-sgb2-statt-sgb12'],
    dokumente: [
      {
        vorlage: antrag({
          behoerde: 'Stadt Würzburg — Fachbereich Soziales', behoerdeZusatz: 'Karmelitenstraße 20, 97070 Würzburg (MUSTER)',
          antragsteller: { ...p, geburtsort: 'Kitzingen', staatsangehoerigkeit: 'deutsch', familienstand: 'verheiratet' },
          adresse: adr, partner: null, haushalt: [], anspruchsgrund: 'erwerbsminderung',
          em: { voll: true, dauerhaft: false, befristet_bis: '2027-12-31', traeger: 'Deutsche Rentenversicherung Nordbayern' },
          wohnung: { flaeche: 68, bewohner: 2, einzug: '2015-04-01', vermieter: `${vermieter}, Schießhausstraße 9, 97072 Würzburg`, kaltmiete: 520, nebenkosten: 110, heizkosten: 85, gesamt: 715, heizungEnthalten: false, warmwasser: 'zentral' },
          wohngeldBeantragt: false, wohngeldBezug: false,
          einkommen: [{ zeile: 'Rente wegen Erwerbsminderung', betrag: 950, traeger: 'Deutsche Rentenversicherung Nordbayern' }],
          vermoegen: [], keinVermoegen: true,
          kv: { art: 'pflichtversichert (KVdR)', kasse: 'BKK Muster Franken' },
          kinder: [], ueber100k: false,
          bank: { institut: 'Mainfränkische Musterbank eG', iban, inhaber: 'Klaus Berger' }, antragsdatum: '2026-09-02', ort: 'Würzburg',
        }),
        kern: {
          typ: 'grundsicherungsantrag', 'stammdaten.antragsteller.nachname': 'Berger', 'stammdaten.antragsteller.vorname': 'Klaus',
          'stammdaten.antragsteller.geburtsdatum': '1968-02-10', 'stammdaten.anspruchsgrund': 'erwerbsminderung', 'stammdaten.antragsdatum': '2026-09-02',
          'stammdaten.wohnung.kaltmiete': 520, 'stammdaten.wohnung.nebenkosten_kalt': 110, 'stammdaten.wohnung.heizkosten': 85, 'stammdaten.wohnung.bewohner_anzahl': 2,
          'stammdaten.iban': iban, [`${AT}.familienstand`]: 'verheiratet', [`${AT}.einkommen[art=em_rente].betrag_monat`]: 950,
          [`${AT}.erwerbsminderung.befristet_bis`]: '2027-12-31', [`${AT}.erwerbsminderung.voll`]: true, [`${AT}.vermoegen`]: [],
          'stammdaten.personen[rolle=partner]': null, 'analyse.unterschrift_vorhanden': true,
        },
      },
      {
        vorlage: personalausweis({ ...p, geburtsort: 'Kitzingen', gueltigBis: '2029-11-15', anschrift: adr, behoerde: 'Stadt Würzburg', nummer: 'T22000129', groesse: 181, augen: 'braun' }),
        kern: { typ: 'personalausweis', 'identitaet.nachname': 'Berger', 'identitaet.geburtsdatum': '1968-02-10' },
      },
      {
        vorlage: rentenbescheid({
          traeger: 'Deutsche Rentenversicherung Nordbayern', traegerAnschrift: 'Wittelsbacherring 11, 95444 Bayreuth', empfaenger: p, vsnr,
          bescheiddatum: '2026-07-15', rentenart: 'Rente wegen voller Erwerbsminderung', rentenbeginn: '2025-01-01', zahlbetrag: 950, zahlbetragAb: '2026-07-01',
          befristetBis: '2027-12-31', antragVom: '2025-03-04', entgeltpunkte: 26.1182, kasse: 'BKK Muster Franken',
        }),
        kern: { typ: 'rentenbescheid', 'identitaet.nachname': 'Berger', 'analyse.rentenart': 'volle_em', 'analyse.befristet_bis': '2027-12-31', 'analyse.zahlbetrag': 950, 'analyse.bescheiddatum': '2026-07-15', 'analyse.unbefristet': false },
      },
      {
        vorlage: kvNachweis({ kasse: 'BKK Muster Franken', kasseAnschrift: 'Juliuspromenade 3, 97070 Würzburg', empfaenger: p, kvnr: 'B987654321', datum: '2026-08-20', seit: '2025-01-01' }),
        kern: { typ: 'kv_pv_nachweis', 'identitaet.nachname': 'Berger' },
      },
      {
        vorlage: mietvertrag({
          vermieter, vermieterAnschrift: 'Schießhausstraße 9, 97072 Würzburg', mieter: [{ vorname: 'Klaus', nachname: 'Berger' }, { vorname: 'Sabine', nachname: 'Berger' }],
          objekt: { ...adr, lage: '2. Obergeschoss links (Wohneinheit 7)' }, flaeche: 68, zimmer: 3, beginn: '2015-04-01', unterzeichnet: '2015-02-26',
          grundmiete: 520, nebenkosten: 110, heizkosten: 85,
        }),
        kern: { typ: 'mietvertrag', 'analyse.mieter': ['Klaus Berger', 'Sabine Berger'], 'analyse.beginn': '2015-04-01', 'analyse.grundmiete': 520, 'analyse.nebenkosten_kalt': 110, 'analyse.heizkosten': 85, 'analyse.unterschrift_vorhanden': true },
      },
      {
        vorlage: nebenkostenabrechnung({
          vermieter, vermieterAnschrift: 'Schießhausstraße 9, 97072 Würzburg', empfaenger: p, jahr: 2025, datum: '2026-05-12', flaeche: 68, gesamtflaeche: 612,
          vorausNk: 110, vorausHeiz: 85, heizkostenAnteil: 1046.3,
          posten: [['Grundsteuer', 2840.12], ['Wasser/Abwasser', 3312.5], ['Müllbeseitigung', 1498.2], ['Hausreinigung', 1980], ['Gartenpflege', 760.4], ['Allgemeinstrom', 412.88], ['Gebäudeversicherung', 1602.3], ['Hauswart', 1596]],
          neueVorauszahlung: 200,
        }),
        kern: { typ: 'nebenkostenabrechnung', 'analyse.heizkosten_enthalten': true, 'analyse.abrechnungszeitraum_bis': '2025-12-31' },
      },
      { vorlage: konto[0]!, kern: kontoKern('2026-07-01', '2026-07-31', 0) },
      { vorlage: konto[1]!, kern: kontoKern('2026-08-01', '2026-08-31', 1) },
    ],
  };
}

// ═══ GS03 — Horst Lehmann ══════════════════════════════════════════════════

function fallLehmann(): Fall {
  const adr: Anschrift = { strasse: 'Hafenstraße', hausnummer: '31', plz: '26789', ort: 'Leer' };
  const p: PersonBasis & Anschrift = { anrede: 'Herr', vorname: 'Horst', nachname: 'Lehmann', geburtsdatum: '1957-11-22', ...adr };
  const iban = 'DE12500105170648489890';
  const vsnr = '18 221157 L 031';
  const vermieter = 'Wohnungsbau Leer-Muster GmbH';
  const monat = (m: string, rente: number, rentenTag: string, extra: Buchung[]): Buchung[] => [
    { tag: `2026-${m}-01`, text: `GUTSCHRIFT STADT LEER WOHNGELDSTELLE WOHNGELD ${m}/2026 AZ WG-2026-0413`, betrag: 186, eingang: { zweck: 'Stadt Leer Wohngeld', art: 'wohngeld', wiederkehrend: true } },
    { tag: `2026-${m}-02`, text: `DAUERAUFTRAG ${vermieter} MIETE HAFENSTR 31`, betrag: -650, miete: true },
    { tag: `2026-${m}-06`, text: 'LASTSCHRIFT Stadtwerke Leer-Muster ABSCHLAG STROM', betrag: -45 },
    { tag: `2026-${m}-11`, text: 'KARTENZAHLUNG FAMILA LEER', betrag: -57.12 },
    { tag: `2026-${m}-15`, text: 'BARGELDAUSZAHLUNG GA LEER BAHNHOFSRING', betrag: -200 },
    ...extra,
    { tag: rentenTag, text: `GUTSCHRIFT DEUTSCHE RENTENVERSICHERUNG OLDENBURG-BREMEN RENTE ${m}/26 VSNR ${vsnr.replace(/ /g, '')}`, betrag: rente, eingang: { zweck: 'Deutsche Rentenversicherung', art: 'rente', wiederkehrend: true } },
  ];
  const konto = auszuege({ bank: 'Sparkasse Leer-Musterland', bankAnschrift: 'Mühlenstraße 1, 26789 Leer', bic: 'NOLADEMUSTR', inhaber: p, iban, jahr: 2026 }, [
    { nr: 5, von: '2026-05-01', bis: '2026-05-31', buchungen: monat('05', 985.4, '2026-05-29', [{ tag: '2026-05-20', text: 'KARTENZAHLUNG ROSSMANN LEER', betrag: -14.6 }]) },
    { nr: 6, von: '2026-06-01', bis: '2026-06-30', buchungen: monat('06', 985.4, '2026-06-30', [{ tag: '2026-06-19', text: 'LASTSCHRIFT Muster-Telefon GmbH FESTNETZ', betrag: -29.99 }]) },
    { nr: 7, von: '2026-07-01', bis: '2026-07-31', buchungen: monat('07', 1020, '2026-07-31', [{ tag: '2026-07-16', text: 'LASTSCHRIFT RUNDFUNK ARD ZDF DRADIO BEITRAG 07-09/2026', betrag: -55.08 }]) },
  ], 950);
  const kontoKern = (von: string, bis: string, i: number, rente: number): Record<string, unknown> => ({
    typ: 'kontoauszug', 'identitaet.nachname': 'Lehmann', 'analyse.zeitraum_von': von, 'analyse.zeitraum_bis': bis,
    'analyse.endsaldo': konto[i]!.roh.endsaldo, 'analyse.mietzahlung_betrag': 650,
    'analyse.eingaenge[art=rente].betrag': rente, 'analyse.eingaenge[art=wohngeld].betrag': 186,
  });

  return {
    id: 'GS03', titel: 'Rentner mit Wohngeld und Sparbuch 14.200 €',
    beschreibung: 'Horst Lehmann (geb. 22.11.1957), verwitwet, Regelaltersrente 1.020 € ab 07/2026 (Bescheid 2023 + Anpassungsmitteilung 2026), Wohngeld 186 € (Bescheid liegt bei, im Antrag nicht als Einkommen angegeben), Sparbuch 14.200 € und Girokonto 900 €.',
    befundeSpec: ['vorrang-wohngeldbescheid-liegt-vor', 'plausi-wohngeld-als-einkommen', 'plausi-vermoegen-ueber-schonbetrag', 'vorrang-vermoegen-ueber-schonbetrag'],
    dokumente: [
      {
        vorlage: antrag({
          behoerde: 'Landkreis Leer — Sozialamt', behoerdeZusatz: 'Bergmannstraße 37, 26789 Leer (MUSTER)',
          antragsteller: { ...p, geburtsort: 'Emden', staatsangehoerigkeit: 'deutsch', familienstand: 'verwitwet' },
          adresse: adr, partner: null, haushalt: [], anspruchsgrund: 'alter',
          wohnung: { flaeche: 52, bewohner: 1, einzug: '2004-10-01', vermieter: `${vermieter}, Ledastraße 4, 26789 Leer`, kaltmiete: 480, nebenkosten: 95, heizkosten: 75, gesamt: 650, heizungEnthalten: false, warmwasser: 'zentral' },
          wohngeldBeantragt: false, wohngeldBezug: true,
          einkommen: [{ zeile: 'Altersrente (gesetzliche Rentenversicherung)', betrag: 1020, traeger: 'Deutsche Rentenversicherung Oldenburg-Bremen' }],
          vermoegen: [{ zeile: 'Girokonto', betrag: 900, institut: 'Sparkasse Leer-Musterland' }, { zeile: 'Sparbuch / Sparkonto', betrag: 14200, institut: 'Sparkasse Leer-Musterland' }], keinVermoegen: false,
          kv: { art: 'pflichtversichert (KVdR)', kasse: 'Ostfriesische Musterkrankenkasse' },
          kinder: [{ name: 'Lehmann, Jens', geburtsdatum: '1984-07-02', wohnort: 'Oldenburg' }], ueber100k: false,
          bank: { institut: 'Sparkasse Leer-Musterland', iban, inhaber: 'Horst Lehmann' }, antragsdatum: '2026-08-20', ort: 'Leer',
        }),
        kern: {
          typ: 'grundsicherungsantrag', 'stammdaten.antragsteller.nachname': 'Lehmann', 'stammdaten.antragsteller.vorname': 'Horst',
          'stammdaten.antragsteller.geburtsdatum': '1957-11-22', 'stammdaten.anspruchsgrund': 'alter', 'stammdaten.antragsdatum': '2026-08-20',
          'stammdaten.wohnung.kaltmiete': 480, 'stammdaten.wohnung.nebenkosten_kalt': 95, 'stammdaten.wohnung.heizkosten': 75,
          'stammdaten.iban': iban, [`${AT}.familienstand`]: 'verwitwet', [`${AT}.einkommen[art=altersrente].betrag_monat`]: 1020,
          [`${AT}.einkommen[art=wohngeld]`]: null, [`${AT}.vermoegen[art=sparbuch].betrag`]: 14200, [`${AT}.vermoegen[art=girokonto].betrag`]: 900,
          'analyse.unterschrift_vorhanden': true,
        },
      },
      {
        vorlage: personalausweis({ ...p, geburtsort: 'Emden', gueltigBis: '2030-03-09', anschrift: adr, behoerde: 'Stadt Leer', nummer: 'C4X7Y0K12', groesse: 176, augen: 'blau' }),
        kern: { typ: 'personalausweis', 'identitaet.nachname': 'Lehmann', 'identitaet.geburtsdatum': '1957-11-22' },
      },
      {
        vorlage: rentenbescheid({
          traeger: 'Deutsche Rentenversicherung Oldenburg-Bremen', traegerAnschrift: 'Huntestraße 11, 26135 Oldenburg', empfaenger: p, vsnr,
          bescheiddatum: '2023-09-14', rentenart: 'Regelaltersrente', rentenbeginn: '2023-11-01', zahlbetrag: 912.37, zahlbetragAb: '2023-11-01',
          antragVom: '2023-06-28', entgeltpunkte: 26.4211, kasse: 'Ostfriesische Musterkrankenkasse',
        }),
        kern: { typ: 'rentenbescheid', 'identitaet.nachname': 'Lehmann', 'analyse.rentenart': 'altersrente', 'analyse.zahlbetrag': 912.37, 'analyse.bescheiddatum': '2023-09-14' },
      },
      {
        vorlage: rentenanpassung({ empfaenger: p, vsnr, datum: '2026-06-12', alt: 985.4, neu: 1020, kasse: 'Ostfriesische Musterkrankenkasse' }),
        kern: { typ: 'rentenanpassungsmitteilung', 'identitaet.nachname': 'Lehmann', 'analyse.stichtag': '2026-07-01', 'analyse.zahlbetrag_neu': 1020, 'analyse.zahlbetrag_alt': 985.4 },
      },
      {
        vorlage: kvNachweis({ kasse: 'Ostfriesische Musterkrankenkasse', kasseAnschrift: 'Große Straße 1, 26789 Leer', empfaenger: p, kvnr: 'L456789123', datum: '2026-08-11', seit: '2023-11-01' }),
        kern: { typ: 'kv_pv_nachweis', 'identitaet.nachname': 'Lehmann' },
      },
      {
        vorlage: mietvertrag({
          vermieter, vermieterAnschrift: 'Ledastraße 4, 26789 Leer', mieter: [{ vorname: 'Horst', nachname: 'Lehmann' }],
          objekt: { ...adr, lage: 'Erdgeschoss Mitte' }, flaeche: 52, zimmer: 2, beginn: '2004-10-01', unterzeichnet: '2004-09-06',
          grundmiete: 395, nebenkosten: 80, heizkosten: 60,
        }),
        kern: { typ: 'mietvertrag', 'analyse.beginn': '2004-10-01', 'analyse.grundmiete': 395, 'analyse.nebenkosten_kalt': 80, 'analyse.heizkosten': 60 },
      },
      {
        vorlage: vermieterbescheinigung({ vermieter, vermieterAnschrift: 'Ledastraße 4, 26789 Leer', mieter: 'Horst Lehmann', objekt: adr, flaeche: 52, bewohner: 1, grundmiete: 480, nebenkosten: 95, heizkosten: 75, gueltigAb: '2026-01-01', datum: '2026-08-05', ort: 'Leer' }),
        kern: { typ: 'vermieterbescheinigung', 'analyse.grundmiete': 480, 'analyse.nebenkosten_kalt': 95, 'analyse.heizkosten': 75, 'analyse.gueltig_ab': '2026-01-01' },
      },
      {
        vorlage: nebenkostenabrechnung({
          vermieter, vermieterAnschrift: 'Ledastraße 4, 26789 Leer', empfaenger: p, jahr: 2025, datum: '2026-04-22', flaeche: 52, gesamtflaeche: 780,
          vorausNk: 95, vorausHeiz: 75, heizkostenAnteil: 868.44,
          posten: [['Grundsteuer', 2310.4], ['Wasser/Abwasser', 3970.15], ['Müllbeseitigung', 1642.8], ['Hausreinigung', 2400], ['Allgemeinstrom', 498.3], ['Gebäudeversicherung', 2104.9], ['Aufzug', 1830]],
          neueVorauszahlung: 170,
        }),
        kern: { typ: 'nebenkostenabrechnung', 'analyse.heizkosten_enthalten': true, 'analyse.abrechnungszeitraum_bis': '2025-12-31' },
      },
      {
        vorlage: wohngeldbescheid({ behoerde: 'Stadt Leer', behoerdeAnschrift: 'Rathausstraße 1, 26789 Leer', empfaenger: p, az: 'WG-2026-0413', datum: '2026-02-18', von: '2026-03-01', bis: '2027-02-28', betrag: 186, miete: 575, einkommen: 985.4 }),
        kern: { typ: 'wohngeldbescheid', 'analyse.betrag_monat': 186, 'analyse.bwz_von': '2026-03-01', 'analyse.bwz_bis': '2027-02-28', 'analyse.bescheiddatum': '2026-02-18' },
      },
      {
        vorlage: sparbuch({
          bank: 'Sparkasse Leer-Musterland', bankAnschrift: 'Mühlenstraße 1, 26789 Leer', inhaber: p, kontonr: '0801 447 219', stichtag: '2026-07-31',
          eintraege: [['2019-03-01', 'Übertrag aus altem Sparbuch', 11800], ['2020-12-31', 'Zinsen 2020', 1.18], ['2021-06-15', 'Einzahlung', 1500], ['2021-12-31', 'Zinsen 2021', 1.33],
            ['2022-12-31', 'Zinsen 2022', 1.33], ['2023-12-31', 'Zinsen 2023', 66.5], ['2024-05-10', 'Einzahlung', 600], ['2024-12-31', 'Zinsen 2024', 131.27], ['2025-12-31', 'Zinsen 2025', 98.39]],
        }),
        kern: { typ: 'vermoegensnachweis', 'identitaet.nachname': 'Lehmann', 'analyse.art': 'sparbuch', 'analyse.stand': 14200, 'analyse.stichtag': '2026-07-31' },
      },
      { vorlage: konto[0]!, kern: kontoKern('2026-05-01', '2026-05-31', 0, 985.4) },
      { vorlage: konto[1]!, kern: kontoKern('2026-06-01', '2026-06-30', 1, 985.4) },
      { vorlage: konto[2]!, kern: kontoKern('2026-07-01', '2026-07-31', 2, 1020) },
    ],
  };
}

export function alleFaelle(): Fall[] {
  return [fallSchmidt(), fallBerger(), fallLehmann()];
}
