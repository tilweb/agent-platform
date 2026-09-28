/**
 * Grundsicherung-Golden — Dokumentvorlagen. Jede Vorlage liefert aus EINER Datenquelle
 *  - den Seiteninhalt (pdfmake) und
 *  - die idealen Profil-Rohwerte (`roh`, Feldnamen des DP-Profils „Grundsicherung-Eingang"),
 * damit Layout und Erwartung nicht auseinanderlaufen. Die fachlich wichtigen Kernfelder werden in
 * `faelle.ts` zusätzlich von Hand erwartet (unabhängig vom Mapping).
 *
 * Alle Personen, Anschriften, Kontonummern und Institute sind erfunden bzw. als MUSTER markiert.
 */
import type { Content } from 'pdfmake/interfaces';
import type { EingangArt } from '../../src/apps/antragspruefung/grundsicherung/types';
import {
  abschnitt, absatz, ankreuz, ankreuzReihe, aufstellung, betreff, briefkopf, dt, eur, feldZeile, kasten, klein,
  rund, tabelle, ueberschrift, unterschrift, unterschriftsfeld, zwischen, GRAU, type DokumentRahmen,
} from './bausteine';

export interface DokumentVorlage {
  typ: string;
  /** Beschreibung für Bericht/expected.json. */
  art: string;
  titel: string;
  rahmen: DokumentRahmen;
  inhalt: Content[];
  roh: Record<string, unknown>;
}

const PB = { pageBreak: 'before' } as const;

export interface Anschrift { strasse: string; hausnummer: string; plz: string; ort: string }
export interface PersonBasis { anrede: 'Frau' | 'Herr'; vorname: string; nachname: string; geburtsdatum: string }
const zeilen = (p: PersonBasis, a: Anschrift) => [p.anrede, `${p.vorname} ${p.nachname}`, `${a.strasse} ${a.hausnummer}`, `${a.plz} ${a.ort}`];

// ═══ Antrag ═══════════════════════════════════════════════════════════════

export interface AntragDaten {
  behoerde: string;
  behoerdeZusatz: string;
  antragsteller: PersonBasis & { geburtsname?: string; geburtsort: string; staatsangehoerigkeit: string; familienstand: string; telefon?: string };
  adresse: Anschrift;
  partner?: (PersonBasis & { staatsangehoerigkeit: string }) | null;
  haushalt: Array<{ nachname: string; vorname: string; geburtsdatum: string; verhaeltnis: string }>;
  anspruchsgrund: 'alter' | 'erwerbsminderung';
  em?: { voll: boolean; dauerhaft: boolean; befristet_bis?: string; traeger: string };
  wohnung: {
    flaeche: number; bewohner: number; einzug: string; vermieter: string;
    kaltmiete?: number; nebenkosten?: number; heizkosten?: number; gesamt: number;
    heizungEnthalten: boolean; warmwasser: 'zentral' | 'dezentral';
  };
  wohngeldBeantragt: boolean;
  wohngeldBezug: boolean;
  /** Ausgefüllte Einkommenszeilen (Zeilenbezeichnung aus dem Formular). */
  einkommen: Array<{ zeile: string; betrag: number; traeger: string }>;
  vermoegen: Array<{ zeile: string; betrag: number; institut: string }>;
  keinVermoegen: boolean;
  kv: { art: string; kasse: string; beitrag?: number };
  kinder: Array<{ name: string; geburtsdatum: string; wohnort: string }>;
  ueber100k: boolean;
  vorbezug?: string;
  bank: { institut: string; iban: string; inhaber: string };
  antragsdatum: string;
  ort: string;
}

const EINKOMMEN_ZEILEN = [
  'Altersrente (gesetzliche Rentenversicherung)', 'Rente wegen Erwerbsminderung', 'Witwen-/Witwerrente',
  'Betriebsrente / Zusatzversorgung (z. B. VBL)', 'Private Rente / Riester-Rente', 'Wohngeld', 'Unterhalt',
  'Erwerbseinkommen / Minijob', 'Zinsen, Kapitalerträge', 'Einnahmen aus Vermietung', 'Sonstige Einnahmen',
];
const VERMOEGEN_ZEILEN = [
  'Bargeld', 'Girokonto', 'Sparbuch / Sparkonto', 'Tagesgeld / Festgeld', 'Wertpapiere / Depot', 'Bausparvertrag',
  'Lebens-/Rentenversicherung (Rückkaufswert)', 'Bestattungsvorsorge / Sterbegeldversicherung', 'Kraftfahrzeug', 'Haus- und Grundeigentum',
];

/** Profilwert der Einkommens-/Vermögensart aus der Formularzeile (so, wie ein Mensch ihn abschreibt). */
const artAusZeile = (z: string) => z.replace(/\s*\(.*\)\s*/g, '').replace(/ \/.*$/, '').trim();

export function antrag(d: AntragDaten): DokumentVorlage {
  const at = d.antragsteller;
  const fam = (w: string) => at.familienstand === w;
  const ek = (z: string) => d.einkommen.find((e) => e.zeile === z);
  const vm = (z: string) => d.vermoegen.find((v) => v.zeile === z);
  const ortDatum = `${d.ort}, ${dt(d.antragsdatum)}`;
  const w = d.wohnung;
  const betragText = (n?: number) => (n === undefined ? '' : `${eur(n)} €`);

  const inhalt: Content[] = [
    // ── Blatt 1 ──
    {
      columns: [
        { width: '*', stack: [{ text: d.behoerde, bold: true, fontSize: 11 }, { text: d.behoerdeZusatz, fontSize: 8, color: GRAU }] },
        kasten([{ text: 'Eingangsstempel', fontSize: 7, color: GRAU }, { text: ' ', margin: [0, 18, 0, 0] }], 130),
      ],
    },
    ueberschrift('Antrag auf Leistungen der Grundsicherung im Alter und bei Erwerbsminderung', [0, 4, 0, 2]),
    klein('nach dem Vierten Kapitel des Zwölften Buches Sozialgesetzbuch (SGB XII). Bitte vollständig ausfüllen, Zutreffendes ankreuzen und die erforderlichen Nachweise beifügen. Die Angaben sind für die Prüfung Ihres Anspruchs erforderlich (§ 60 SGB I).', [0, 0, 0, 6]),
    abschnitt(1, 'Art des Antrags'),
    ankreuzReihe([['Erstantrag', true], ['Weiterbewilligungsantrag', false], ['Änderungsantrag', false]]),
    feldZeile([['Aktenzeichen (nur bei Weiterbewilligung)', '', 250], ['Leistungen beantragt ab', dt(d.antragsdatum.slice(0, 8) + '01'), '*']]),
    abschnitt(2, 'Angaben zur antragstellenden Person'),
    feldZeile([['Familienname', at.nachname, 170], ['Vorname(n)', at.vorname, 150], ['Geburtsname', at.geburtsname ?? '', '*']]),
    feldZeile([['Geburtsdatum', dt(at.geburtsdatum), 110], ['Geburtsort', at.geburtsort, 150], ['Staatsangehörigkeit', at.staatsangehoerigkeit, '*']]),
    feldZeile([['Straße, Hausnummer', `${d.adresse.strasse} ${d.adresse.hausnummer}`, 220], ['PLZ', d.adresse.plz, 60], ['Wohnort', d.adresse.ort, '*']]),
    feldZeile([['Telefon (freiwillig)', at.telefon ?? '', 220], ['E-Mail (freiwillig)', '', '*']]),
    { text: 'Familienstand', fontSize: 7, color: GRAU, margin: [0, 2, 0, 1] },
    ankreuzReihe([['ledig', fam('ledig')], ['verheiratet', fam('verheiratet')], ['eingetr. Lebenspartnerschaft', fam('lebenspartnerschaft')]], [0, 0, 0, 2]),
    ankreuzReihe([['getrennt lebend', fam('getrennt lebend')], ['geschieden', fam('geschieden')], ['verwitwet', fam('verwitwet')]]),

    // ── Blatt 2 ──
    abschnitt(3, 'Ehegatte / eingetragene:r Lebenspartner:in / Partner:in einer eheähnlichen Gemeinschaft', true),
    klein('Nur ausfüllen, wenn Sie mit einer Partnerin oder einem Partner zusammenleben. Einkommen und Vermögen der Partnerin bzw. des Partners sind in den Abschnitten 8 und 9 anzugeben.'),
    feldZeile([['Familienname', d.partner?.nachname ?? '', 170], ['Vorname(n)', d.partner?.vorname ?? '', 150], ['Geburtsdatum', d.partner ? dt(d.partner.geburtsdatum) : '', '*']]),
    feldZeile([['Staatsangehörigkeit', d.partner?.staatsangehoerigkeit ?? '', 170], ['lebt dauernd getrennt seit', '', '*']]),
    abschnitt(4, 'Weitere Personen in der Wohnung / im Haushalt'),
    klein('z. B. erwachsene Kinder, Angehörige, Untermieter:innen — ohne antragstellende Person und Partner:in.'),
    tabelle(['Familienname', 'Vorname', 'Geburtsdatum', 'Verhältnis zur antragstellenden Person'],
      (d.haushalt.length ? d.haushalt.map((h) => [h.nachname, h.vorname, dt(h.geburtsdatum), h.verhaeltnis]) : [['', '', '', '']]).concat([['', '', '', '']]),
      [110, 100, 70, '*']),
    abschnitt(5, 'Anspruchsgrund'),
    ankreuz('Ich habe die Altersgrenze nach § 41 Abs. 2 SGB XII erreicht.', d.anspruchsgrund === 'alter'),
    { text: ' ', fontSize: 3 },
    ankreuz('Ich bin dauerhaft voll erwerbsgemindert (§ 41 Abs. 3 SGB XII) bzw. beziehe eine Rente wegen Erwerbsminderung:', d.anspruchsgrund === 'erwerbsminderung'),
    { margin: [16, 3, 0, 2], stack: [
      ankreuzReihe([['volle Erwerbsminderung', d.em?.voll === true], ['teilweise Erwerbsminderung', d.em?.voll === false]], [0, 0, 0, 2]),
      ankreuzReihe([['unbefristet / auf Dauer', d.em?.dauerhaft === true], ['befristet (Rente auf Zeit)', d.em?.dauerhaft === false]], [0, 0, 0, 2]),
      feldZeile([['befristet bis', d.em?.befristet_bis ? dt(d.em.befristet_bis) : '', 120], ['Rentenversicherungsträger', d.em?.traeger ?? '', '*']]),
    ] },
    abschnitt(6, 'Rechtliche Vertretung'),
    ankreuzReihe([['keine', true], ['gesetzliche Betreuung (Bestellungsurkunde beifügen)', false], ['Vollmacht', false]]),
    feldZeile([['Name der Betreuerin/des Betreuers bzw. der/des Bevollmächtigten', '', '*']]),

    // ── Blatt 3 ──
    abschnitt(7, 'Wohnung und Kosten der Unterkunft und Heizung', true),
    { text: 'Ich wohne', fontSize: 7, color: GRAU, margin: [0, 0, 0, 1] },
    ankreuzReihe([['in einer Mietwohnung', true], ['zur Untermiete', false], ['im eigenen Haus / in der Eigentumswohnung', false]], [0, 0, 0, 2]),
    ankreuzReihe([['mietfrei bei Angehörigen', false], ['in einer Einrichtung / besonderen Wohnform', false]]),
    feldZeile([['Wohnfläche (m²)', String(w.flaeche), 90], ['Anzahl Personen in der Wohnung', String(w.bewohner), 150], ['Einzug am', dt(w.einzug), '*']]),
    feldZeile([['Vermieter:in / Hausverwaltung', w.vermieter, '*']]),
    tabelle(['Monatliche Kosten laut Mietvertrag / letzter Mieterhöhung', 'Betrag'], [
      ['Grundmiete (Nettokaltmiete)', betragText(w.kaltmiete)],
      ['Vorauszahlung Betriebskosten (kalte Nebenkosten)', betragText(w.nebenkosten)],
      ['Vorauszahlung Heizkosten', betragText(w.heizkosten)],
      [{ text: 'Gesamtmiete', bold: true, fontSize: 8.8 }, { text: `${eur(w.gesamt)} €`, bold: true, fontSize: 8.8, alignment: 'right' }],
    ], ['*', 100], { rechts: [1] }),
    ankreuz('Die Heizkosten sind in der Miete enthalten (Pauschal- oder Inklusivmiete) und werden nicht gesondert ausgewiesen.', w.heizungEnthalten),
    { text: 'Warmwasser wird bereitet', fontSize: 7, color: GRAU, margin: [0, 6, 0, 1] },
    ankreuzReihe([['zentral über die Heizung', w.warmwasser === 'zentral'], ['dezentral (Boiler, Durchlauferhitzer)', w.warmwasser === 'dezentral']]),
    zwischen('Wohngeld'),
    ankreuzReihe([['Ich beziehe Wohngeld (Bescheid beifügen)', d.wohngeldBezug], ['Ich habe Wohngeld beantragt, über den Antrag ist noch nicht entschieden', d.wohngeldBeantragt]]),

    // ── Blatt 4 ──
    abschnitt(8, 'Einkommen (Einsatzgemeinschaft)', true),
    klein('Anzugeben sind alle Einnahmen in Geld der antragstellenden Person und der Partnerin bzw. des Partners — monatliche Zahlbeträge. Nachweise (Bescheide, Mitteilungen, Kontoauszüge) beifügen.'),
    tabelle(['Einkommensart', 'ja', 'nein', 'Person', 'Zahlende Stelle', 'mtl. Betrag'],
      EINKOMMEN_ZEILEN.map((z) => {
        const e = ek(z);
        return [z, e ? 'X' : '', e ? '' : 'X', e ? at.vorname : '', e?.traeger ?? '', e ? `${eur(e.betrag)} €` : ''];
      }),
      [150, 16, 22, 50, '*', 62], { rechts: [5], fontSize: 8.2 }),
    ankreuz('Ich habe keine Einkünfte.', d.einkommen.length === 0),
    feldZeile([['Wovon wurde der Lebensunterhalt bisher bestritten? (nur ausfüllen, wenn keine Einkünfte)', '', '*']], [0, 6, 0, 3]),

    // ── Blatt 5 ──
    abschnitt(9, 'Vermögen (Einsatzgemeinschaft)', true),
    klein('Anzugeben ist das gesamte Vermögen im In- und Ausland mit dem aktuellen Stand/Wert. Kontoauszüge, Sparbuch, Depotauszüge, Versicherungsbescheinigungen beifügen. Der Barbetrag nach § 90 Abs. 2 Nr. 9 SGB XII beträgt 10.000 € je Person.'),
    tabelle(['Vermögensart', 'ja', 'nein', 'Kreditinstitut / Gesellschaft', 'Stand / Wert'],
      VERMOEGEN_ZEILEN.map((z) => {
        const v = vm(z);
        return [z, v ? 'X' : '', v ? '' : 'X', v?.institut ?? '', v ? `${eur(v.betrag)} €` : ''];
      }),
      [170, 16, 22, '*', 72], { rechts: [4], fontSize: 8.2 }),
    ankreuz('Ich (wir) verfüge(n) über kein Vermögen.', d.keinVermoegen),
    abschnitt(10, 'Vermögensübertragungen'),
    klein('Haben Sie oder Ihre Partnerin bzw. Ihr Partner in den letzten zehn Jahren Vermögen verschenkt oder übertragen (z. B. Geld, Grundstücke)?'),
    ankreuzReihe([['nein', true], ['ja (Vertrag/Nachweis beifügen)', false]]),

    // ── Blatt 6 ──
    abschnitt(11, 'Kranken- und Pflegeversicherung', true),
    tabelle(['Person', 'Art der Versicherung', 'Krankenkasse / Versicherung', 'eigener Beitrag mtl.'],
      [[`${at.vorname} ${at.nachname}`, d.kv.art, d.kv.kasse, d.kv.beitrag === undefined ? '' : `${eur(d.kv.beitrag)} €`], ['', '', '', '']],
      [100, 130, '*', 70], { rechts: [3] }),
    abschnitt(12, 'Mehrbedarfe'),
    ankreuz('Schwerbehindertenausweis mit Merkzeichen G oder aG vorhanden (Ausweis beifügen)', false),
    { text: ' ', fontSize: 3 },
    ankreuz('Kostenaufwändige Ernährung aus medizinischen Gründen (ärztliche Bescheinigung beifügen)', false),
    abschnitt(13, 'Unterhaltspflichtige Angehörige (Kinder, Eltern)'),
    klein('Kinder und Eltern werden nur herangezogen, wenn ihr jährliches Gesamteinkommen 100.000 € übersteigt (§ 94 Abs. 1a SGB XII).'),
    tabelle(['Name, Vorname', 'Geburtsdatum', 'Wohnort'],
      (d.kinder.length ? d.kinder.map((k) => [k.name, dt(k.geburtsdatum), k.wohnort]) : [['keine Kinder', '', '']]).concat([['', '', '']]),
      ['*', 80, 150]),
    { text: 'Hat ein Kind oder ein Elternteil ein jährliches Gesamteinkommen von mehr als 100.000 €?', fontSize: 9, margin: [0, 2, 0, 2] },
    ankreuzReihe([['nein', !d.ueber100k], ['ja / möglicherweise', d.ueber100k]]),
    abschnitt(14, 'Bisherige Leistungen'),
    ankreuzReihe([['keine', !d.vorbezug], ['Bürgergeld (Jobcenter)', d.vorbezug === 'Bürgergeld'], ['Hilfe zum Lebensunterhalt', false], ['Wohngeld', d.wohngeldBezug]]),

    // ── Blatt 7 ──
    abschnitt(15, 'Bankverbindung', true),
    feldZeile([['Kontoinhaber:in', d.bank.inhaber, 200], ['Kreditinstitut', d.bank.institut, '*']]),
    feldZeile([['IBAN', d.bank.iban.replace(/(.{4})/g, '$1 ').trim(), '*']]),
    abschnitt(16, 'Hinweise zum Datenschutz (§ 67a SGB X)'),
    klein('Die Erhebung Ihrer Sozialdaten erfolgt auf Grund der §§ 60 ff. SGB I und § 67a SGB X. Ihre Angaben werden ausschließlich zur Prüfung und Durchführung der Grundsicherung verwendet. Zur Prüfung vorrangiger Ansprüche können Daten mit anderen Sozialleistungsträgern abgeglichen werden (§ 118 SGB XII). Sie haben das Recht auf Auskunft, Berichtigung und Einschränkung der Verarbeitung nach Art. 15 ff. DSGVO. Verantwortliche Stelle ist der Träger der Sozialhilfe.'),
    abschnitt(17, 'Mitwirkungspflichten (§§ 60 bis 67 SGB I)'),
    klein('Sie sind verpflichtet, alle Tatsachen anzugeben, die für die Leistung erheblich sind, und Änderungen unverzüglich mitzuteilen — insbesondere Änderungen beim Einkommen (auch Rentenanpassungen zum 1. Juli), beim Vermögen, bei der Miete und bei der Zusammensetzung des Haushalts. Kommen Sie Ihren Mitwirkungspflichten nicht nach, kann die Leistung bis zur Nachholung der Mitwirkung ganz oder teilweise versagt oder entzogen werden (§ 66 SGB I). Zu Unrecht erhaltene Leistungen sind zu erstatten (§ 50 SGB X).'),
    klein('Leistungen der Grundsicherung werden nicht erbracht, wenn die Bedürftigkeit in den letzten zehn Jahren vorsätzlich oder grob fahrlässig herbeigeführt worden ist (§ 41 Abs. 4 SGB XII).'),

    // ── Blatt 8 ──
    abschnitt(18, 'Erklärung und Unterschrift', true),
    klein('Ich versichere, dass die Angaben in diesem Antrag und den Anlagen vollständig und richtig sind. Mir ist bekannt, dass falsche oder unvollständige Angaben strafrechtlich verfolgt werden können und zu Unrecht erhaltene Leistungen zu erstatten sind. Die Hinweise zum Datenschutz und zu den Mitwirkungspflichten habe ich zur Kenntnis genommen.', [0, 0, 0, 10]),
    unterschriftsfeld(ortDatum, 'Unterschrift antragstellende Person', at.nachname.length + 3),
    unterschriftsfeld(undefined, 'Unterschrift Ehegatte / Lebenspartner:in / Partner:in', null),
    unterschriftsfeld(undefined, 'Unterschrift Betreuer:in / Bevollmächtigte:r', null),
    zwischen('Beigefügte Unterlagen (bitte ankreuzen)'),
    ankreuzReihe([['Personalausweis', true], ['Rentenbescheid', true], ['Mietvertrag', true]], [0, 1, 0, 2]),
    ankreuzReihe([['Kontoauszüge der letzten 3 Monate', true], ['Nachweis Krankenversicherung', true]], [0, 1, 0, 2]),
    ankreuzReihe([['Wohngeldbescheid', d.wohngeldBezug], ['Sparbuch / Vermögensnachweise', d.vermoegen.some((v) => /Spar/.test(v.zeile))]], [0, 1, 0, 2]),
  ];

  const famWert: Record<string, string> = { verwitwet: 'verwitwet', verheiratet: 'verheiratet', ledig: 'ledig', geschieden: 'geschieden', 'getrennt lebend': 'getrennt lebend', lebenspartnerschaft: 'eingetragene Lebenspartnerschaft' };
  const roh: Record<string, unknown> = {
    antragsart: 'erstantrag',
    antragsdatum: d.antragsdatum,
    datum_vorhanden: true,
    unterschrift_vorhanden: true,
    anspruchsgrund: d.anspruchsgrund,
    antragsteller_nachname: at.nachname,
    antragsteller_vorname: at.vorname,
    ...(at.geburtsname ? { antragsteller_geburtsname: at.geburtsname } : {}),
    antragsteller_geburtsdatum: at.geburtsdatum,
    antragsteller_familienstand: famWert[at.familienstand] ?? at.familienstand,
    antragsteller_staatsangehoerigkeit: at.staatsangehoerigkeit,
    ...(d.partner ? { partner_nachname: d.partner.nachname, partner_vorname: d.partner.vorname, partner_geburtsdatum: d.partner.geburtsdatum, partner_staatsangehoerigkeit: d.partner.staatsangehoerigkeit } : {}),
    ...(d.haushalt.length ? { haushaltsangehoerige: d.haushalt } : {}),
    strasse: d.adresse.strasse, hausnummer: d.adresse.hausnummer, plz: d.adresse.plz, ort: d.adresse.ort,
    wohnsituation: 'miete',
    ...(w.kaltmiete !== undefined ? { kaltmiete: w.kaltmiete } : {}),
    ...(w.nebenkosten !== undefined ? { nebenkosten_kalt: w.nebenkosten } : {}),
    ...(w.heizkosten !== undefined ? { heizkosten: w.heizkosten } : {}),
    ...(w.heizungEnthalten ? { heizung_in_miete_enthalten: true } : {}),
    warmwasser: w.warmwasser,
    wohnflaeche_qm: w.flaeche,
    bewohner_anzahl: w.bewohner,
    einkommen: d.einkommen.map((e) => ({ art: artAusZeile(e.zeile), betrag_monat: e.betrag, traeger: e.traeger })),
    ...(d.einkommen.length === 0 ? { keine_einkuenfte: true } : {}),
    ...(d.vermoegen.length ? { vermoegen: d.vermoegen.map((v) => ({ art: artAusZeile(v.zeile), betrag: v.betrag })) } : {}),
    ...(d.keinVermoegen ? { kein_vermoegen: true } : {}),
    krankenversicherung: [{ art: d.kv.art, kasse: d.kv.kasse, ...(d.kv.beitrag !== undefined ? { beitrag: d.kv.beitrag } : {}) }],
    ...(d.em ? { em_voll: d.em.voll, em_dauerhaft: d.em.dauerhaft, ...(d.em.befristet_bis ? { em_befristet_bis: d.em.befristet_bis } : {}) } : {}),
    betreuung: 'keine',
    unterhalt_angaben_gemacht: true,
    unterhalt_ueber_100k: d.ueber100k,
    iban: d.bank.iban,
    ...(d.wohngeldBeantragt ? { wohngeld_antrag_laeuft: true } : {}),
  };
  return {
    typ: 'grundsicherungsantrag', art: 'Antrag auf Grundsicherung (Formular, 8 Blatt, 18 Abschnitte)', titel: 'Antrag Grundsicherung',
    rahmen: { kopfLinks: `${d.behoerde} — Antrag Grundsicherung (4. Kap. SGB XII)`, fussTitel: 'Antrag auf Grundsicherung im Alter und bei Erwerbsminderung', blattImKopf: true },
    inhalt, roh,
  };
}

// ═══ Personalausweis ═══════════════════════════════════════════════════════

export function personalausweis(p: PersonBasis & { geburtsname?: string; geburtsort: string; gueltigBis: string; anschrift: Anschrift; behoerde: string; nummer: string; groesse: number; augen: string }): DokumentVorlage {
  const feld = (l: string, v: string): Content => ({ stack: [{ text: l, fontSize: 6.5, color: GRAU }, { text: v, fontSize: 10, bold: true, margin: [0, 0, 0, 4] }] });
  const inhalt: Content[] = [
    { text: 'Kopie Personalausweis (Vorder- und Rückseite)', fontSize: 8, color: GRAU, margin: [0, 0, 0, 8] },
    kasten([
      { columns: [{ text: 'BUNDESREPUBLIK DEUTSCHLAND', bold: true, fontSize: 9 }, { text: 'PERSONALAUSWEIS · IDENTITY CARD', fontSize: 8, alignment: 'right' }] },
      { columns: [
        { width: 95, stack: [{ canvas: [{ type: 'rect', x: 0, y: 4, w: 85, h: 110, lineWidth: 0.8, color: '#dddddd' }] }, { text: 'Lichtbild', fontSize: 7, color: GRAU, margin: [22, -62, 0, 50] }] },
        { width: '*', margin: [0, 6, 0, 0], stack: [
          feld('Name / Surname', p.nachname.toUpperCase()),
          ...(p.geburtsname ? [feld('Geburtsname / Name at birth', p.geburtsname.toUpperCase())] : []),
          feld('Vornamen / Given names', p.vorname.toUpperCase()),
          { columns: [feld('Geburtstag / Date of birth', dt(p.geburtsdatum)), feld('Staatsangehörigkeit / Nationality', 'DEUTSCH')] },
          { columns: [feld('Geburtsort / Place of birth', p.geburtsort.toUpperCase()), feld('Gültig bis / Date of expiry', dt(p.gueltigBis))] },
          { text: p.nummer, fontSize: 11, bold: true, alignment: 'right' },
        ] },
      ] },
      { text: 'MUSTER', fontSize: 22, bold: true, color: '#e6b8b8', margin: [8, -40, 0, 8] },
    ], 380, '#f2f7ee'),
    kasten([
      { columns: [
        { width: '*', stack: [
          feld('Anschrift / Address', `${p.anschrift.plz} ${p.anschrift.ort.toUpperCase()}\n${p.anschrift.strasse.toUpperCase()} ${p.anschrift.hausnummer}`),
          { columns: [feld('Augenfarbe / Colour of eyes', p.augen.toUpperCase()), feld('Größe / Height', `${p.groesse} cm`)] },
          feld('Behörde / Authority', p.behoerde.toUpperCase()),
        ] },
      ] },
      { text: `IDD<<${p.nummer}<<<<<<<<<<<<<<<\n${p.geburtsdatum.slice(2).replace(/-/g, '')}<${p.gueltigBis.slice(2).replace(/-/g, '')}D<<<<<<<<<<<<<\n${p.nachname.toUpperCase()}<<${p.vorname.toUpperCase()}<<<<<<<<<<`, font: 'Roboto', fontSize: 8.5, characterSpacing: 1.2, margin: [0, 6, 0, 0] },
    ], 380, '#f2f7ee'),
  ];
  return {
    typ: 'personalausweis', art: 'Kopie Personalausweis (Vorder-/Rückseite)', titel: 'Personalausweis',
    rahmen: { kopfLinks: 'Kopie — Anlage zum Antrag', fussTitel: `Personalausweis ${p.vorname} ${p.nachname}`, seitenzahl: false },
    inhalt,
    roh: { nachname: p.nachname, vorname: p.vorname, geburtsdatum: p.geburtsdatum, staatsangehoerigkeit: 'deutsch', gueltig_bis: p.gueltigBis, ...(p.geburtsname ? { geburtsname: p.geburtsname } : {}) },
  };
}

// ═══ Rentenbescheid ═══════════════════════════════════════════════════════

/** Brutto, KV, PV so, dass der Zahlbetrag exakt herauskommt (KV 7,3 % + ½ Zusatzbeitrag 1,25 %, PV 3,6 %). */
export function rentenBerechnung(zahl: number) {
  let brutto = rund(zahl / (1 - 0.0855 - 0.036));
  for (let i = 0; i < 400; i++) {
    const kv = rund(brutto * 0.0855), pv = rund(brutto * 0.036);
    const z = rund(brutto - kv - pv);
    if (Math.abs(z - zahl) < 0.001) return { brutto, kv, pv };
    brutto = rund(brutto + (zahl > z ? 0.01 : -0.01));
  }
  const kv = rund(brutto * 0.0855), pv = rund(brutto * 0.036);
  return { brutto: rund(zahl + kv + pv), kv, pv };
}

export interface RentenbescheidDaten {
  traeger: string; traegerAnschrift: string; empfaenger: PersonBasis & Anschrift; vsnr: string;
  bescheiddatum: string; rentenart: string; rentenbeginn: string; zahlbetrag: number; zahlbetragAb: string;
  befristetBis?: string; antragVom: string; entgeltpunkte: number; neuberechnung?: boolean; kasse: string;
}

export function rentenbescheid(d: RentenbescheidDaten): DokumentVorlage {
  const { brutto, kv, pv } = rentenBerechnung(d.zahlbetrag);
  const e = d.empfaenger;
  const em = /Erwerbsminderung/.test(d.rentenart);
  const inhalt: Content[] = [
    ...briefkopf({
      absender: d.traeger, absenderZusatz: [d.traegerAnschrift, 'Servicetelefon 0800 1000 4800 (MUSTER)'],
      ruecksende: `${d.traeger} · ${d.traegerAnschrift}`, empfaenger: zeilen(e, e),
      infoblock: [['Versicherungsnummer', d.vsnr], ['Geburtsdatum', dt(e.geburtsdatum)], ['Datum', dt(d.bescheiddatum)]],
    }),
    betreff(d.neuberechnung ? `Neuberechnung der ${d.rentenart}` : `Rentenbescheid — ${d.rentenart}`, `Ihr Antrag vom ${dt(d.antragVom)}`),
    absatz(`Sehr geehrte${e.anrede === 'Herr' ? 'r Herr' : ' Frau'} ${e.nachname},`),
    absatz(d.neuberechnung
      ? `die ${d.rentenart} wird ab ${dt(d.zahlbetragAb)} neu berechnet. Die Neuberechnung ersetzt insoweit den bisherigen Bescheid.`
      : `auf Ihren Antrag vom ${dt(d.antragVom)} erhalten Sie von uns ${d.rentenart}. Die Rente beginnt am ${dt(d.rentenbeginn)}.`),
    ...(em ? [absatz(d.befristetBis
      ? `Die Rente ist befristet. Sie wird als Rente auf Zeit bis zum ${dt(d.befristetBis)} geleistet (§ 102 Abs. 2 SGB VI). Eine Weiterzahlung über diesen Zeitpunkt hinaus setzt einen rechtzeitigen Antrag voraus. Die volle Erwerbsminderung beruht allein auf Ihrem Gesundheitszustand.`
      : 'Die Rente wird unbefristet geleistet.')] : []),
    zwischen('Höhe der Rente'),
    aufstellung([
      [`Monatliche Rente ab ${dt(d.zahlbetragAb)}`, `${eur(brutto)} EUR`],
      ['abzüglich Beitragsanteil zur Krankenversicherung', `${eur(kv)} EUR`],
      ['abzüglich Beitrag zur Pflegeversicherung', `${eur(pv)} EUR`],
      ['Monatlicher Zahlbetrag', `${eur(d.zahlbetrag)} EUR`, true],
    ]),
    absatz(`Die laufende Zahlung von ${eur(d.zahlbetrag)} EUR wird jeweils am Ende des Monats fällig, für den sie bestimmt ist, und auf Ihr Konto überwiesen. Die Beiträge zur Kranken- und Pflegeversicherung der Rentner führen wir an die ${d.kasse} ab.`),
    absatz('Die Berechnung der Rente ergibt sich aus Anlage 1. Bitte beachten Sie die Hinweise und Mitteilungspflichten in Anlage 2.'),
    absatz('Mit freundlichen Grüßen\nIhre Deutsche Rentenversicherung', [0, 6, 0, 0]),
    // Anlage 1
    { text: 'Anlage 1 — Berechnung der Rente', bold: true, fontSize: 11, ...PB, margin: [0, 0, 0, 6] },
    klein(`Versicherungsnummer ${d.vsnr} — ${e.vorname} ${e.nachname}`),
    tabelle(['Berechnungsgröße', 'Wert'], [
      ['Summe der Entgeltpunkte', d.entgeltpunkte.toFixed(4).replace('.', ',')],
      ['Zugangsfaktor', em ? '0,8920' : '1,0000'],
      ['Rentenartfaktor', '1,0000'],
      ['persönliche Entgeltpunkte', (d.entgeltpunkte * (em ? 0.892 : 1)).toFixed(4).replace('.', ',')],
      ['aktueller Rentenwert', '40,79 EUR'],
      ['Monatsrente (brutto)', `${eur(brutto)} EUR`],
    ], ['*', 110], { rechts: [1] }),
    klein('Die Werte der Versicherungszeiten sind im Versicherungsverlauf (nicht beigefügt) dargestellt. Beitragsfreie Zeiten und Zurechnungszeiten sind nach §§ 71 ff. SGB VI bewertet.'),
    zwischen('Kranken- und Pflegeversicherung der Rentner'),
    tabelle(['Beitrag', 'Satz', 'Betrag'], [
      ['Krankenversicherung (allg. Beitragssatz ½ + ½ Zusatzbeitrag)', '8,55 %', `${eur(kv)} EUR`],
      ['Pflegeversicherung', '3,60 %', `${eur(pv)} EUR`],
    ], ['*', 50, 80], { rechts: [1, 2] }),
    // Anlage 2
    { text: 'Anlage 2 — Hinweise, Mitteilungspflichten, Rechtsbehelfsbelehrung', bold: true, fontSize: 11, ...PB, margin: [0, 0, 0, 6] },
    klein('Mitteilungspflichten: Bitte teilen Sie uns unverzüglich mit, wenn Sie Einkommen erzielen, eine weitere Rente beziehen, Ihren Wohnsitz ins Ausland verlegen oder sich Ihre Krankenversicherung ändert.'),
    klein('Rentenanpassung: Die Rente wird jeweils zum 1. Juli angepasst. Über die Anpassung erhalten Sie eine gesonderte Mitteilung.'),
    ...(em ? [klein('Hinweis zur Erwerbsminderung: Während des Bezugs einer Rente wegen Erwerbsminderung sind Hinzuverdienstgrenzen zu beachten. Wir prüfen vor Ablauf der Befristung von Amts wegen, ob die Erwerbsminderung fortbesteht.')] : []),
    zwischen('Rechtsbehelfsbelehrung'),
    klein(`Gegen diesen Bescheid kann innerhalb eines Monats nach seiner Bekanntgabe Widerspruch erhoben werden. Der Widerspruch ist schriftlich, in elektronischer Form oder zur Niederschrift bei der ${d.traeger}, ${d.traegerAnschrift}, einzulegen.`),
  ];
  return {
    typ: 'rentenbescheid', art: `Rentenbescheid (${d.rentenart}${d.befristetBis ? `, befristet bis ${dt(d.befristetBis)}` : ''}, Bescheid + 2 Anlagen)`, titel: 'Rentenbescheid',
    rahmen: { kopfLinks: d.traeger, fussTitel: `Rentenbescheid vom ${dt(d.bescheiddatum)} · VSNR ${d.vsnr}` },
    inhalt,
    roh: {
      nachname: e.nachname, vorname: e.vorname, geburtsdatum: e.geburtsdatum, rentenart: d.rentenart,
      ...(d.befristetBis ? { befristet_bis: d.befristetBis, unbefristet: false } : em ? { unbefristet: true } : {}),
      zahlbetrag: d.zahlbetrag, zahlbetrag_ab: d.zahlbetragAb, bruttorente: brutto, bescheiddatum: d.bescheiddatum, versicherungsnummer: d.vsnr,
    },
  };
}

// ═══ Rentenanpassungsmitteilung ═══════════════════════════════════════════

export function rentenanpassung(d: { empfaenger: PersonBasis & Anschrift; vsnr: string; datum: string; alt: number; neu: number; kasse: string }): DokumentVorlage {
  const a = rentenBerechnung(d.alt), n = rentenBerechnung(d.neu);
  const e = d.empfaenger;
  const inhalt: Content[] = [
    ...briefkopf({
      absender: 'Renten Service', absenderZusatz: ['im Auftrag der Deutschen Rentenversicherung · 04000 Leipzig (MUSTER)'],
      ruecksende: 'Renten Service · 04000 Leipzig', empfaenger: zeilen(e, e),
      infoblock: [['Versicherungsnummer', d.vsnr], ['Datum', dt(d.datum)]],
    }),
    betreff('Rentenanpassung 2026', 'Mitteilung über die Anpassung Ihrer Rente zum 1. Juli 2026'),
    absatz(`Sehr geehrte${e.anrede === 'Herr' ? 'r Herr' : ' Frau'} ${e.nachname},`),
    absatz('zum 1. Juli 2026 werden die Renten angepasst. Der aktuelle Rentenwert steigt von 40,79 EUR auf 42,26 EUR. Ihre Rente ändert sich daher wie folgt:'),
    tabelle(['', 'bisher', 'ab 01.07.2026'], [
      ['Monatliche Rente (brutto)', `${eur(a.brutto)} EUR`, `${eur(n.brutto)} EUR`],
      ['Beitragsanteil Krankenversicherung', `${eur(a.kv)} EUR`, `${eur(n.kv)} EUR`],
      ['Beitrag Pflegeversicherung', `${eur(a.pv)} EUR`, `${eur(n.pv)} EUR`],
      [{ text: 'Zahlbetrag', bold: true }, { text: `${eur(d.alt)} EUR`, bold: true, alignment: 'right' }, { text: `${eur(d.neu)} EUR`, bold: true, alignment: 'right' }],
    ], ['*', 90, 90], { rechts: [1, 2] }),
    absatz(`Der neue Zahlbetrag von ${eur(d.neu)} EUR wird erstmals Ende Juli 2026 auf Ihr Konto überwiesen. Beitragsempfänger der Kranken- und Pflegeversicherung: ${d.kasse}.`),
    absatz('Diese Mitteilung ist ein Verwaltungsakt. Bitte bewahren Sie sie auf — sie wird häufig als Einkommensnachweis benötigt (z. B. für Wohngeld oder Grundsicherung).'),
    { text: 'Hinweise zur Rentenanpassung', bold: true, fontSize: 11, ...PB, margin: [0, 0, 0, 6] },
    klein('Die Anpassung beruht auf der Rentenwertbestimmungsverordnung 2026. Die Beiträge zur Kranken- und Pflegeversicherung werden aus der angepassten Rente berechnet.'),
    zwischen('Rechtsbehelfsbelehrung'),
    klein('Gegen diese Mitteilung kann innerhalb eines Monats nach Bekanntgabe Widerspruch bei dem zuständigen Rentenversicherungsträger erhoben werden.'),
  ];
  return {
    typ: 'rentenanpassungsmitteilung', art: 'Rentenanpassungsmitteilung zum 01.07.2026 (2 Seiten)', titel: 'Rentenanpassung 2026',
    rahmen: { kopfLinks: 'Renten Service — Rentenanpassung 2026', fussTitel: `Rentenanpassung 2026 · VSNR ${d.vsnr}` },
    inhalt,
    roh: { nachname: e.nachname, vorname: e.vorname, stichtag: '2026-07-01', zahlbetrag_alt: d.alt, zahlbetrag_neu: d.neu },
  };
}

// ═══ Kranken-/Pflegeversicherung ══════════════════════════════════════════

export function kvNachweis(d: { kasse: string; kasseAnschrift: string; empfaenger: PersonBasis & Anschrift; kvnr: string; datum: string; seit: string }): DokumentVorlage {
  const e = d.empfaenger;
  const inhalt: Content[] = [
    ...briefkopf({
      absender: d.kasse, absenderZusatz: [d.kasseAnschrift], ruecksende: `${d.kasse} · ${d.kasseAnschrift}`, empfaenger: zeilen(e, e),
      infoblock: [['Versichertennummer', d.kvnr], ['Datum', dt(d.datum)]],
    }),
    betreff('Mitgliedsbescheinigung', 'zur Vorlage beim Sozialamt'),
    absatz('Hiermit bestätigen wir, dass'),
    aufstellung([['Name, Vorname', `${e.nachname}, ${e.vorname}`], ['Geburtsdatum', dt(e.geburtsdatum)], ['Versichertennummer', d.kvnr]], 360),
    absatz(`seit dem ${dt(d.seit)} bei uns als Mitglied in der Krankenversicherung der Rentner (KVdR) pflichtversichert ist. Die Mitgliedschaft besteht auch in der sozialen Pflegeversicherung. Die Beiträge aus der gesetzlichen Rente werden vom Rentenversicherungsträger einbehalten und abgeführt; ein eigener Beitrag ist nicht zu zahlen.`),
    absatz('Diese Bescheinigung wurde maschinell erstellt und ist ohne Unterschrift gültig.'),
  ];
  return {
    typ: 'kv_pv_nachweis', art: 'Mitgliedsbescheinigung Kranken-/Pflegeversicherung (KVdR)', titel: 'Mitgliedsbescheinigung',
    rahmen: { kopfLinks: d.kasse, fussTitel: 'Mitgliedsbescheinigung', seitenzahl: false },
    inhalt,
    roh: { nachname: e.nachname, vorname: e.vorname, art: 'pflichtversichert (KVdR)', kasse: d.kasse },
  };
}

// ═══ Mietvertrag ══════════════════════════════════════════════════════════

export interface MietvertragDaten {
  vermieter: string; vermieterAnschrift: string; mieter: Array<{ vorname: string; nachname: string }>; objekt: Anschrift & { lage: string };
  flaeche: number; zimmer: number; beginn: string; unterzeichnet: string;
  grundmiete?: number; nebenkosten?: number; heizkosten?: number; pauschal?: number;
}

export function mietvertrag(d: MietvertragDaten): DokumentVorlage {
  const mieterText = d.mieter.map((m) => `${m.vorname} ${m.nachname}`).join(' und ');
  const miete: Content[] = d.pauschal !== undefined
    ? [
      absatz(`(1) Die Miete beträgt monatlich pauschal ${eur(d.pauschal)} EUR (Pauschalmiete).`),
      absatz('(2) Mit der Pauschalmiete sind sämtliche Betriebskosten im Sinne der Betriebskostenverordnung einschließlich der Kosten für Heizung und Warmwasser abgegolten. Eine Abrechnung über Betriebs- und Heizkosten findet nicht statt.'),
    ]
    : [
      absatz('(1) Die Miete beträgt monatlich:'),
      aufstellung([
        ['Grundmiete (Nettokaltmiete)', `${eur(d.grundmiete!)} EUR`],
        ['Vorauszahlung auf die Betriebskosten (ohne Heizung)', `${eur(d.nebenkosten!)} EUR`],
        ['Vorauszahlung auf die Heiz- und Warmwasserkosten', `${eur(d.heizkosten!)} EUR`],
        ['Gesamtbetrag', `${eur(rund(d.grundmiete! + d.nebenkosten! + d.heizkosten!))} EUR`, true],
      ], 380),
      absatz('(2) Über die Vorauszahlungen wird jährlich abgerechnet. Die Heizkosten werden nach der Heizkostenverordnung verbrauchsabhängig verteilt.'),
    ];
  const inhalt: Content[] = [
    ueberschrift('Mietvertrag über Wohnraum', [0, 0, 0, 10]),
    absatz([{ text: 'Zwischen\n', color: GRAU }, { text: `${d.vermieter}, ${d.vermieterAnschrift}`, bold: true }, { text: '\n— nachstehend „Vermieter" genannt —\n\nund\n', color: GRAU }, { text: mieterText, bold: true }, { text: `\n${d.objekt.strasse} ${d.objekt.hausnummer}, ${d.objekt.plz} ${d.objekt.ort}`, color: GRAU }, { text: '\n— nachstehend „Mieter" genannt —', color: GRAU }]),
    absatz('wird folgender Mietvertrag geschlossen:'),
    zwischen('§ 1 Mietsache'),
    absatz(`(1) Vermietet wird die Wohnung im Haus ${d.objekt.strasse} ${d.objekt.hausnummer}, ${d.objekt.plz} ${d.objekt.ort}, ${d.objekt.lage}, bestehend aus ${d.zimmer} Zimmern, Küche, Bad/WC und Flur. Die Wohnfläche beträgt ${d.flaeche} m².`),
    absatz('(2) Mitvermietet sind ein Kellerraum sowie die Mitbenutzung von Waschküche und Trockenboden nach der Hausordnung.'),
    zwischen('§ 2 Mietzeit'),
    absatz(`Das Mietverhältnis beginnt am ${dt(d.beginn)} und läuft auf unbestimmte Zeit. Die Kündigung richtet sich nach den gesetzlichen Vorschriften (§§ 573 ff. BGB).`),
    zwischen('§ 3 Miete und Nebenkosten'),
    ...miete,
    { text: '§ 4 Zahlung der Miete', bold: true, fontSize: 10, margin: [0, 0, 0, 3], ...PB },
    absatz('Die Miete ist monatlich im Voraus, spätestens am dritten Werktag des Monats, auf das vom Vermieter benannte Konto zu zahlen. Für die Rechtzeitigkeit kommt es auf den Eingang des Geldes an.'),
    zwischen('§ 5 Mietsicherheit'),
    absatz('Der Mieter leistet eine Kaution in Höhe von drei Monatsgrundmieten. Sie ist getrennt vom Vermögen des Vermieters anzulegen (§ 551 BGB).'),
    zwischen('§ 6 Schönheitsreparaturen'),
    absatz('Die Schönheitsreparaturen trägt der Vermieter, soweit nicht durch den Mieter verursachte Schäden vorliegen.'),
    zwischen('§ 7 Tierhaltung, Untervermietung'),
    absatz('Kleintierhaltung ist gestattet. Eine Untervermietung bedarf der vorherigen schriftlichen Zustimmung des Vermieters.'),
    zwischen('§ 8 Hausordnung'),
    absatz('Die beigefügte Hausordnung ist Bestandteil dieses Vertrags. Die Treppenhausreinigung erfolgt im wöchentlichen Wechsel.'),
    { text: '§ 9 Sonstige Vereinbarungen', bold: true, fontSize: 10, margin: [0, 0, 0, 3], ...PB },
    absatz('Mündliche Nebenabreden bestehen nicht. Änderungen und Ergänzungen dieses Vertrags bedürfen der Schriftform. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.'),
    zwischen('Unterschriften'),
    unterschriftsfeld(`${d.objekt.ort}, ${dt(d.unterzeichnet)}`, `Vermieter (${d.vermieter})`, 11),
    ...d.mieter.map((m, i) => unterschriftsfeld(`${d.objekt.ort}, ${dt(d.unterzeichnet)}`, `Mieter (${m.vorname} ${m.nachname})`, 20 + i * 7)),
    klein('Anlagen: Hausordnung, Wohnungsübergabeprotokoll (nicht beigefügt)', [0, 10, 0, 0]),
  ];
  return {
    typ: 'mietvertrag', art: `Mietvertrag (${d.pauschal !== undefined ? 'Pauschalmiete inkl. Heizung' : 'Grundmiete + Vorauszahlungen'}, 3 Seiten)`, titel: 'Mietvertrag',
    rahmen: { kopfLinks: 'Mietvertrag über Wohnraum', fussTitel: `Mietvertrag ${d.objekt.strasse} ${d.objekt.hausnummer}, ${d.objekt.ort}` },
    inhalt,
    roh: {
      mieter: d.mieter.map((m) => ({ nachname: m.nachname, vorname: m.vorname })), beginn: d.beginn, wohnflaeche_qm: d.flaeche,
      ...(d.pauschal !== undefined ? { pauschalmiete: d.pauschal, heizkosten_enthalten: true } : { grundmiete: d.grundmiete, nebenkosten_kalt: d.nebenkosten, heizkosten: d.heizkosten }),
      unterschrift_vorhanden: true,
    },
  };
}

// ═══ Vermieterbescheinigung ═══════════════════════════════════════════════

export function vermieterbescheinigung(d: { vermieter: string; vermieterAnschrift: string; mieter: string; objekt: Anschrift; flaeche: number; bewohner: number; grundmiete: number; nebenkosten: number; heizkosten: number; gueltigAb: string; datum: string; ort: string }): DokumentVorlage {
  const inhalt: Content[] = [
    ueberschrift('Mietbescheinigung', [0, 0, 0, 2]),
    klein('zur Vorlage beim Sozialamt (Grundsicherung im Alter und bei Erwerbsminderung) — vom Vermieter bzw. von der Hausverwaltung auszufüllen', [0, 0, 0, 8]),
    feldZeile([['Vermieter:in / Hausverwaltung', `${d.vermieter}, ${d.vermieterAnschrift}`, '*']]),
    feldZeile([['Mieter:in', d.mieter, 200], ['Anschrift der Wohnung', `${d.objekt.strasse} ${d.objekt.hausnummer}, ${d.objekt.plz} ${d.objekt.ort}`, '*']]),
    feldZeile([['Wohnfläche (m²)', String(d.flaeche), 100], ['Anzahl der Bewohner:innen', String(d.bewohner), 130], ['Die Angaben gelten ab', dt(d.gueltigAb), '*']]),
    tabelle(['Monatliche Miete', 'Betrag'], [
      ['Grundmiete (Nettokaltmiete)', `${eur(d.grundmiete)} €`],
      ['Betriebskosten-Vorauszahlung (kalt, ohne Heizung)', `${eur(d.nebenkosten)} €`],
      ['Heizkosten-Vorauszahlung (inkl. Warmwasser)', `${eur(d.heizkosten)} €`],
      [{ text: 'Gesamtmiete', bold: true }, { text: `${eur(rund(d.grundmiete + d.nebenkosten + d.heizkosten))} €`, bold: true, alignment: 'right' }],
    ], ['*', 100], { rechts: [1] }),
    ankreuzReihe([['Warmwasser zentral über die Heizung', true], ['Warmwasser dezentral (Strom)', false]]),
    ankreuzReihe([['Die Miete wird regelmäßig und vollständig gezahlt', true], ['Es bestehen Mietrückstände', false]]),
    { text: 'Ich bestätige die Richtigkeit der Angaben.', margin: [0, 10, 0, 0] },
    unterschriftsfeld(`${d.ort}, ${dt(d.datum)}`, 'Unterschrift / Stempel Vermieter:in', 5),
    { text: 'Erläuterungen zur Mietbescheinigung', bold: true, fontSize: 11, ...PB, margin: [0, 0, 0, 6] },
    klein('Grundmiete: Miete für die Überlassung der Wohnung ohne Betriebs- und Heizkosten. Betriebskosten: Kosten nach § 2 Betriebskostenverordnung (z. B. Grundsteuer, Wasser, Müllabfuhr, Hausreinigung, Allgemeinstrom), ohne Heizung und Warmwasser. Heizkosten: Vorauszahlung für Heizung und — bei zentraler Versorgung — Warmwasser.'),
    klein('Die Angaben werden zur Ermittlung der Bedarfe für Unterkunft und Heizung nach § 35 SGB XII benötigt. Die Mieterin bzw. der Mieter ist verpflichtet, Änderungen der Miete unverzüglich mitzuteilen.'),
    klein('Rechtsgrundlagen: § 35 SGB XII (Bedarfe für Unterkunft und Heizung); § 60 SGB I (Angabe von Tatsachen); §§ 556, 560 BGB (Vereinbarungen über Betriebskosten, Veränderungen von Betriebskosten).'),
  ];
  return {
    typ: 'vermieterbescheinigung', art: 'Mietbescheinigung des Vermieters (Formular + Erläuterungsseite)', titel: 'Mietbescheinigung',
    rahmen: { kopfLinks: 'Mietbescheinigung — Sozialamt', fussTitel: `Mietbescheinigung ${d.mieter}` },
    inhalt,
    roh: { grundmiete: d.grundmiete, nebenkosten_kalt: d.nebenkosten, heizkosten: d.heizkosten, gueltig_ab: d.gueltigAb, bewohner_anzahl: d.bewohner },
  };
}

// ═══ Nebenkostenabrechnung ════════════════════════════════════════════════

export function nebenkostenabrechnung(d: { vermieter: string; vermieterAnschrift: string; empfaenger: PersonBasis & Anschrift; jahr: number; datum: string; flaeche: number; gesamtflaeche: number; vorausNk: number; vorausHeiz: number; heizkostenAnteil: number; posten: Array<[string, number]>; neueVorauszahlung: number }): DokumentVorlage {
  const e = d.empfaenger;
  const anteil = d.flaeche / d.gesamtflaeche;
  const zeilenBk = d.posten.map(([p, g]) => [p, `${eur(g)}`, `${d.flaeche} / ${d.gesamtflaeche} m²`, `${eur(rund(g * anteil))}`]);
  const summeBk = rund(d.posten.reduce((s, [, g]) => s + rund(g * anteil), 0));
  const summe = rund(summeBk + d.heizkostenAnteil);
  const voraus = rund((d.vorausNk + d.vorausHeiz) * 12);
  const ergebnis = rund(summe - voraus);
  const inhalt: Content[] = [
    ...briefkopf({
      absender: d.vermieter, absenderZusatz: [d.vermieterAnschrift], ruecksende: `${d.vermieter} · ${d.vermieterAnschrift}`, empfaenger: zeilen(e, e),
      infoblock: [['Objekt', `${e.strasse} ${e.hausnummer}`], ['Datum', dt(d.datum)]],
    }),
    betreff(`Betriebs- und Heizkostenabrechnung ${d.jahr}`, `Abrechnungszeitraum 01.01.${d.jahr} bis 31.12.${d.jahr}`),
    absatz(`Sehr geehrte${e.anrede === 'Herr' ? 'r Herr' : ' Frau'} ${e.nachname},`),
    absatz(`anbei erhalten Sie die Abrechnung der Betriebs- und Heizkosten für den Zeitraum 01.01.${d.jahr} bis 31.12.${d.jahr}. Umlageschlüssel für die Betriebskosten ist die Wohnfläche; die Heiz- und Warmwasserkosten wurden durch den Messdienst verbrauchsabhängig ermittelt (Einzelabrechnung Heizung liegt vor).`),
    tabelle(['Kostenart', 'Gesamtkosten Haus €', 'Umlage', 'Ihr Anteil €'], zeilenBk, ['*', 80, 90, 70], { rechts: [1, 3], fontSize: 8.4 }),
    aufstellung([
      ['Summe Betriebskosten (kalt)', `${eur(summeBk)} EUR`],
      ['Heiz- und Warmwasserkosten laut Einzelabrechnung Messdienst', `${eur(d.heizkostenAnteil)} EUR`],
      ['Gesamtkosten Ihrer Wohnung', `${eur(summe)} EUR`, true],
    ], 420),
    { text: 'Ergebnis der Abrechnung', bold: true, fontSize: 11, ...PB, margin: [0, 0, 0, 6] },
    aufstellung([
      ['Gesamtkosten Ihrer Wohnung', `${eur(summe)} EUR`],
      [`abzüglich geleistete Vorauszahlungen (12 × ${eur(rund(d.vorausNk + d.vorausHeiz))} EUR)`, `${eur(voraus)} EUR`],
      [ergebnis >= 0 ? 'Nachzahlung' : 'Guthaben', `${eur(Math.abs(ergebnis))} EUR`, true],
    ], 420),
    absatz(ergebnis >= 0
      ? `Bitte überweisen Sie den Nachzahlungsbetrag von ${eur(ergebnis)} EUR innerhalb von 30 Tagen.`
      : `Das Guthaben von ${eur(-ergebnis)} EUR verrechnen wir mit der nächsten Mietzahlung.`),
    absatz(`Neue monatliche Vorauszahlung ab 01.03.${d.jahr + 1}: ${eur(d.neueVorauszahlung)} EUR (Betriebskosten und Heizkosten zusammen).`),
    klein('Sie können die Belege zur Abrechnung nach vorheriger Terminvereinbarung in unseren Geschäftsräumen einsehen (§ 259 BGB). Einwendungen gegen die Abrechnung sind spätestens bis zum Ablauf des zwölften Monats nach Zugang mitzuteilen (§ 556 Abs. 3 BGB).'),
  ];
  return {
    typ: 'nebenkostenabrechnung', art: `Betriebs- und Heizkostenabrechnung ${d.jahr} (2 Seiten)`, titel: `Nebenkostenabrechnung ${d.jahr}`,
    rahmen: { kopfLinks: d.vermieter, fussTitel: `Betriebskostenabrechnung ${d.jahr} · ${e.strasse} ${e.hausnummer}` },
    inhalt,
    roh: { abrechnungszeitraum_von: `${d.jahr}-01-01`, abrechnungszeitraum_bis: `${d.jahr}-12-31`, heizkosten_enthalten: true, nachzahlung_guthaben: ergebnis, neue_vorauszahlung: d.neueVorauszahlung },
  };
}

// ═══ Kontoauszug ══════════════════════════════════════════════════════════

export interface Buchung {
  tag: string;
  text: string;
  betrag: number;
  /** Eingang: Zusammenfassung für die Erwartung (Absender kurz, Art). */
  eingang?: { zweck: string; art: EingangArt; wiederkehrend: boolean };
  miete?: boolean;
}

export interface KontoauszugDaten {
  bank: string; bankAnschrift: string; bic: string; inhaber: PersonBasis & Anschrift; iban: string;
  nr: number; jahr: number; von: string; bis: string; startsaldo: number; buchungen: Buchung[];
  /** Seitenumbruch nach n Buchungen (Übertrag). */
  umbruchNach?: number;
}

export function kontoauszug(d: KontoauszugDaten): DokumentVorlage {
  const e = d.inhaber;
  const endsaldo = rund(d.startsaldo + d.buchungen.reduce((s, b) => s + b.betrag, 0));
  const zeile = (b: Buchung) => [dt(b.tag).slice(0, 6), dt(b.tag).slice(0, 6), b.text, b.betrag < 0 ? `${eur(-b.betrag)} S` : '', b.betrag >= 0 ? `${eur(b.betrag)} H` : ''];
  const kopf = (blatt: number, blaetter: number): Content[] => [
    {
      columns: [
        { width: '*', stack: [{ text: d.bank, bold: true, fontSize: 13 }, { text: `${d.bankAnschrift} · BIC ${d.bic}`, fontSize: 7.5, color: GRAU }] },
        { width: 200, table: { widths: [60, '*'], body: [
          [{ text: 'Kontoauszug', fontSize: 7.5, color: GRAU }, { text: `Nr. ${d.nr}/${d.jahr}`, bold: true }],
          [{ text: 'Blatt', fontSize: 7.5, color: GRAU }, { text: `${blatt} von ${blaetter}` }],
          [{ text: 'Zeitraum', fontSize: 7.5, color: GRAU }, { text: `${dt(d.von)} – ${dt(d.bis)}` }],
        ] }, layout: 'noBorders' },
      ],
      margin: [0, 0, 0, 12],
    },
    { columns: [
      { width: 250, stack: e ? zeilen(e, e).map((z) => ({ text: z, fontSize: 9.5 })) : [] },
      { width: '*', stack: [{ text: 'Girokonto', bold: true }, { text: `IBAN ${d.iban.replace(/(.{4})/g, '$1 ').trim()}`, fontSize: 9 }, { text: `Kontoinhaber: ${e.vorname} ${e.nachname}`, fontSize: 9 }] },
    ], margin: [0, 0, 0, 12] },
  ];
  const teile = d.umbruchNach ? [d.buchungen.slice(0, d.umbruchNach), d.buchungen.slice(d.umbruchNach)] : [d.buchungen];
  const inhalt: Content[] = [];
  let saldo = d.startsaldo;
  teile.forEach((teil, i) => {
    if (i > 0) inhalt.push({ text: '', pageBreak: 'before' });
    inhalt.push(...kopf(i + 1, teile.length));
    const zeilenT: Array<Array<string | Content>> = [];
    zeilenT.push(['', '', { text: i === 0 ? `Alter Kontostand am ${dt(d.von)}` : 'Übertrag von Blatt 1', bold: true, fontSize: 8.6 }, saldo < 0 ? `${eur(-saldo)} S` : '', saldo >= 0 ? `${eur(saldo)} H` : '']);
    for (const b of teil) { zeilenT.push(zeile(b)); saldo = rund(saldo + b.betrag); }
    const letzte = i === teile.length - 1;
    zeilenT.push(['', '', { text: letzte ? `Neuer Kontostand am ${dt(d.bis)}` : 'Übertrag auf Blatt 2', bold: true, fontSize: 8.6 }, saldo < 0 ? `${eur(-saldo)} S` : '', { text: saldo >= 0 ? `${eur(saldo)} H` : '', bold: true, fontSize: 8.6, alignment: 'right' }]);
    inhalt.push(tabelle(['Bu-Tag', 'Wert', 'Vorgang / Verwendungszweck', 'Soll EUR', 'Haben EUR'], zeilenT, [34, 34, '*', 62, 62], { rechts: [3, 4], fontSize: 8.4 }));
    if (letzte) inhalt.push(klein('Bitte prüfen Sie Ihren Kontoauszug. Einwendungen sind innerhalb von sechs Wochen zu erheben. Guthaben sind als Einlagen nach Maßgabe des Einlagensicherungsgesetzes entschädigungsfähig.', [0, 8, 0, 0]));
  });

  // Erwartung: Eingänge nach Absender zusammengefasst.
  const gruppen = new Map<string, { betrag: number; verwendungszweck: string; art: EingangArt; wiederkehrend: boolean; anzahl: number }>();
  for (const b of d.buchungen) {
    if (!b.eingang) continue;
    const g = gruppen.get(b.eingang.zweck);
    if (g) g.anzahl++;
    else gruppen.set(b.eingang.zweck, { betrag: b.betrag, verwendungszweck: b.eingang.zweck, art: b.eingang.art, wiederkehrend: b.eingang.wiederkehrend, anzahl: 1 });
  }
  const miete = d.buchungen.find((b) => b.miete);
  const gross = d.buchungen.filter((b) => b.betrag <= -500 && !b.miete);
  return {
    typ: 'kontoauszug', art: `Kontoauszug ${String(d.nr).padStart(2, '0')}/${d.jahr} (${teile.length} Blatt)`, titel: `Kontoauszug ${d.nr}/${d.jahr}`,
    rahmen: { kopfLinks: `${d.bank} — Kontoauszug`, fussTitel: `Kontoauszug Nr. ${d.nr}/${d.jahr} · ${e.vorname} ${e.nachname}`, seitenzahl: false },
    inhalt,
    roh: {
      nachname: e.nachname, vorname: e.vorname, iban: d.iban, zeitraum_von: d.von, zeitraum_bis: d.bis, endsaldo,
      eingaenge: [...gruppen.values()],
      mietzahlung_erkannt: !!miete, ...(miete ? { mietzahlung_betrag: -miete.betrag } : {}),
      ...(gross.length ? { grosse_abgaenge: gross.map((b) => ({ betrag: -b.betrag, datum: b.tag, verwendungszweck: b.text })) } : {}),
    },
  };
}

// ═══ Wohngeldbescheid ═════════════════════════════════════════════════════

export function wohngeldbescheid(d: { behoerde: string; behoerdeAnschrift: string; empfaenger: PersonBasis & Anschrift; az: string; datum: string; von: string; bis: string; betrag: number; miete: number; einkommen: number }): DokumentVorlage {
  const e = d.empfaenger;
  const inhalt: Content[] = [
    ...briefkopf({
      absender: d.behoerde, absenderZusatz: [d.behoerdeAnschrift, 'Wohngeldstelle'], ruecksende: `${d.behoerde} · Wohngeldstelle · ${d.behoerdeAnschrift}`,
      empfaenger: zeilen(e, e), infoblock: [['Aktenzeichen', d.az], ['Datum', dt(d.datum)]],
    }),
    betreff('Bescheid über Wohngeld (Mietzuschuss)', `Ihr Antrag auf Weiterleistung`),
    absatz(`Sehr geehrte${e.anrede === 'Herr' ? 'r Herr' : ' Frau'} ${e.nachname},`),
    absatz([{ text: 'auf Ihren Antrag wird Ihnen für die Zeit ' }, { text: `vom ${dt(d.von)} bis ${dt(d.bis)}`, bold: true }, { text: ' ein monatliches Wohngeld (Mietzuschuss) in Höhe von ' }, { text: `${eur(d.betrag)} EUR`, bold: true }, { text: ' bewilligt.' }]),
    absatz('Das Wohngeld wird monatlich im Voraus auf das von Ihnen angegebene Konto überwiesen.'),
    zwischen('Berechnungsgrundlagen'),
    tabelle(['Merkmal', 'Wert'], [
      ['Zahl der zu berücksichtigenden Haushaltsmitglieder', '1'],
      ['Berücksichtigte Haushaltsmitglieder', `${e.vorname} ${e.nachname} (antragstellende Person)`],
      ['Zu berücksichtigende Miete / Belastung monatlich', `${eur(d.miete)} EUR`],
      ['Gesamteinkommen monatlich', `${eur(d.einkommen)} EUR`],
      ['Mietenstufe', 'II'],
      [{ text: 'Wohngeld monatlich', bold: true }, { text: `${eur(d.betrag)} EUR`, bold: true, alignment: 'right' }],
    ], ['*', 150], { rechts: [1] }),
    { text: 'Hinweise und Rechtsbehelfsbelehrung', bold: true, fontSize: 11, ...PB, margin: [0, 0, 0, 6] },
    klein('Mitteilungspflichten (§ 27 WoGG): Sie sind verpflichtet, der Wohngeldstelle unverzüglich mitzuteilen, wenn sich die Zahl der Haushaltsmitglieder verringert, die Miete um mehr als 15 % sinkt oder das Einkommen um mehr als 15 % steigt. Der Bezug von Leistungen der Grundsicherung im Alter und bei Erwerbsminderung schließt Wohngeld aus (§ 7 WoGG); ein entsprechender Antrag ist mitzuteilen.'),
    klein('Weiterleistungsantrag: Wohngeld wird nur auf Antrag weitergeleistet. Stellen Sie den Antrag rechtzeitig vor Ablauf des Bewilligungszeitraums.'),
    zwischen('Rechtsbehelfsbelehrung'),
    klein(`Gegen diesen Bescheid kann innerhalb eines Monats nach Bekanntgabe Widerspruch erhoben werden. Der Widerspruch ist schriftlich oder zur Niederschrift bei der ${d.behoerde}, Wohngeldstelle, ${d.behoerdeAnschrift}, einzulegen.`),
    absatz('Mit freundlichen Grüßen\nIm Auftrag\nWohngeldstelle', [0, 10, 0, 0]),
  ];
  return {
    typ: 'wohngeldbescheid', art: 'Wohngeldbescheid Mietzuschuss (Bescheid + Hinweisseite)', titel: 'Wohngeldbescheid',
    rahmen: { kopfLinks: `${d.behoerde} — Wohngeldstelle`, fussTitel: `Wohngeldbescheid Az. ${d.az}` },
    inhalt,
    roh: { nachname: e.nachname, vorname: e.vorname, betrag_monat: d.betrag, bwz_von: d.von, bwz_bis: d.bis, bescheiddatum: d.datum },
  };
}

// ═══ Sparbuch ═════════════════════════════════════════════════════════════

export function sparbuch(d: { bank: string; bankAnschrift: string; inhaber: PersonBasis; kontonr: string; eintraege: Array<[string, string, number]>; stichtag: string }): DokumentVorlage {
  let saldo = 0;
  const rows = d.eintraege.map(([tag, text, betrag]) => { saldo = rund(saldo + betrag); return [dt(tag), text, betrag < 0 ? `-${eur(-betrag)}` : `+${eur(betrag)}`, eur(saldo)]; });
  const inhalt: Content[] = [
    { text: 'Kopie der letzten beschriebenen Seite des Sparbuchs mit Saldenbestätigung', fontSize: 8, color: GRAU, margin: [0, 0, 0, 8] },
    kasten([
      { columns: [{ text: d.bank, bold: true, fontSize: 12 }, { text: 'SPARKASSENBUCH', alignment: 'right', bold: true }] },
      { text: `Sparkonto Nr. ${d.kontonr} · Inhaber: ${d.inhaber.vorname} ${d.inhaber.nachname} · Spareinlage mit dreimonatiger Kündigungsfrist`, fontSize: 8.5, margin: [0, 2, 0, 6] },
      tabelle(['Datum', 'Vorgang', 'Betrag EUR', 'Guthaben EUR'], rows.slice(-9), [60, '*', 70, 80], { rechts: [2, 3], fontSize: 8.6 }),
    ], '*', '#fbf8ee'),
    zwischen('Saldenbestätigung'),
    absatz(`Wir bestätigen, dass das oben genannte Sparkonto von ${d.inhaber.vorname} ${d.inhaber.nachname}, geb. ${dt(d.inhaber.geburtsdatum)}, am ${dt(d.stichtag)} ein Guthaben von ${eur(saldo)} EUR ausweist.`),
    unterschriftsfeld(`${d.bankAnschrift.split(' ').slice(-1)[0]}, ${dt(d.stichtag)}`, `${d.bank} (Stempel/Unterschrift)`, 9),
  ];
  return {
    typ: 'vermoegensnachweis', art: 'Sparbuch — Kopie letzte Seite mit Saldenbestätigung', titel: 'Sparbuch',
    rahmen: { kopfLinks: `${d.bank} — Sparkassenbuch (Kopie)`, fussTitel: `Sparkonto ${d.kontonr}`, seitenzahl: false },
    inhalt,
    roh: { nachname: d.inhaber.nachname, vorname: d.inhaber.vorname, art: 'sparbuch', stand: saldo, stichtag: d.stichtag },
  };
}

export { unterschrift };
