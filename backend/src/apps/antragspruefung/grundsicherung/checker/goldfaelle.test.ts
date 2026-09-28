/**
 * Grundsicherung — Abnahmetest der Regel-Engine (Welle G2).
 *
 * 1. Drei Goldfälle aus docs/grundsicherung-app-spec-2026-09-27.md (Abschnitt „Goldfälle"):
 *    erwartete Regel-IDs erscheinen, offensichtlich falsche Befunde nicht.
 * 2. Je Regel ein Positiv- und ein Negativtest (tabellengetrieben): Ein vollständiger, stimmiger
 *    Basisfall erzeugt KEINEN Befund; je Regel erzeugt eine gezielte Änderung genau diese Regel.
 */
import { describe, expect, test } from 'bun:test';
import { pruefeVorgang } from './index';
import { ladeKonstanten } from './konstanten';
import { REGELKATALOG } from './regeln';
import type { Dokument, DokumentAnalyse, DokumentTyp, Person, PruefBefund, Vorgang, VorgangSnapshot } from '../types';

const HEUTE = '2026-09-27';

function mkVorgang(over: Partial<Vorgang> = {}): Vorgang {
  return {
    id: 'v1', akteId: 'a1', vorgangsnummer: 'GS-2026-0001', antragsart: 'erstantrag', anspruchsgrund: 'alter',
    status: 'sachbearbeitung', prioritaet: 'normal', version: 1, created_at: '', updated_at: '', ...over,
  };
}
function mkPerson(over: Partial<Person> & { id: string }): Person {
  return { vorgangId: 'v1', rolle: 'antragsteller', nachname: '', vorname: '', version: 1, created_at: '', updated_at: '', ...over };
}
let dokZaehler = 0;
function mkDok(typ: DokumentTyp, personId: string | undefined, analyse?: DokumentAnalyse, over: Partial<Dokument> = {}): Dokument {
  dokZaehler += 1;
  return { id: `d-${typ}-${dokZaehler}`, vorgangId: 'v1', typ, personId, istOriginal: false, analyse, version: 1, created_at: '', updated_at: '', ...over };
}
function ids(befunde: PruefBefund[]): string[] {
  return [...new Set(befunde.map((b) => b.regelId))].sort();
}
function pruefe(s: VorgangSnapshot): PruefBefund[] {
  return pruefeVorgang(s, { heute: HEUTE });
}
function eindeutig(befunde: PruefBefund[]): void {
  const keys = befunde.map((b) => `${b.regelId}::${b.personId ?? ''}`);
  expect(new Set(keys).size).toBe(keys.length); // Sync-Schlüssel regelId+personId darf nicht kollidieren
}

// ── Basisfall: vollständig und stimmig (Rentnerin, Mietwohnung, allein) ──────

const P1 = 'p-anna';
function basis(): VorgangSnapshot {
  const vorgang = mkVorgang({
    antragsdatum: '2026-08-12', wohnsituation: 'miete', iban: 'DE02120300000000202051',
    wohnung: { kaltmiete: 450, nebenkosten_kalt: 90, heizkosten: 70, warmwasser: 'zentral', bewohner_anzahl: 1 },
  });
  const anna = mkPerson({
    id: P1, rolle: 'antragsteller', vorname: 'Anna', nachname: 'Muster', geburtsdatum: '1955-04-10', familienstand: 'verwitwet',
    krankenversicherung: { art: 'pflicht', kasse: 'AOK' },
    einkommen: [{ id: 'e1', art: 'altersrente', betrag_monat: 800, traeger: 'DRV' }],
    vermoegen: [{ id: 'm1', art: 'girokonto', betrag: 1200 }],
    unterhalt_kinder_eltern: { angegeben: true, ueber_100k_moeglich: false },
  });
  const dokumente: Dokument[] = [
    mkDok('grundsicherungsantrag', P1, { unterschrift_vorhanden: true, datum_vorhanden: true }),
    mkDok('personalausweis', P1, { geburtsdatum: '1955-04-10', nachname: 'Muster', vorname: 'Anna' }),
    mkDok('rentenbescheid', P1, { rentenart: 'altersrente', zahlbetrag: 800, bescheiddatum: '2026-07-10', geburtsdatum: '1955-04-10', unbefristet: true }),
    mkDok('kv_pv_nachweis', P1, { art: 'pflicht' }),
    mkDok('mietvertrag', undefined, { mieter: ['Anna Muster'], beginn: '2019-01-01', grundmiete: 450, nebenkosten_kalt: 90, heizkosten: 70, unterschrift_vorhanden: true }),
    mkDok('vermieterbescheinigung', undefined, { grundmiete: 450, nebenkosten_kalt: 90, heizkosten: 70, gueltig_ab: '2026-01-01' }),
    mkDok('nebenkostenabrechnung', undefined, { heizkosten_enthalten: true, abrechnungszeitraum_bis: '2025-12-31' }),
    mkDok('kontoauszug', P1, {
      iban: 'DE02120300000000202051', zeitraum_von: '2026-05-01', zeitraum_bis: '2026-07-31', endsaldo: 1200,
      eingaenge: [{ betrag: 800, verwendungszweck: 'Deutsche Rentenversicherung', art: 'rente', wiederkehrend: true, anzahl: 3 }],
      mietzahlung_erkannt: true, mietzahlung_betrag: 610, grosse_abgaenge: [{ betrag: 400, verwendungszweck: 'Bargeld' }],
    }),
  ];
  return { vorgang, personen: [anna], dokumente };
}

type Snap = VorgangSnapshot;
const person = (s: Snap, id = P1) => s.personen.find((p) => p.id === id)!;
const dok = (s: Snap, typ: DokumentTyp) => s.dokumente.find((d) => d.typ === typ)!;
const analyse = <T = Record<string, unknown>>(s: Snap, typ: DokumentTyp) => dok(s, typ).analyse as T & Record<string, unknown>;
const ohne = (s: Snap, ...typen: DokumentTyp[]) => { s.dokumente = s.dokumente.filter((d) => !typen.includes(d.typ)); };
const setzeGeburtsdatum = (s: Snap, g: string) => {
  person(s).geburtsdatum = g;
  analyse(s, 'personalausweis').geburtsdatum = g;
  analyse(s, 'rentenbescheid').geburtsdatum = g;
};
const emFall = (s: Snap, bescheid: Record<string, unknown>) => {
  s.vorgang.anspruchsgrund = 'erwerbsminderung';
  setzeGeburtsdatum(s, '1968-02-10');
  person(s).einkommen = [{ id: 'e1', art: 'em_rente', betrag_monat: 800 }];
  person(s).erwerbsminderung = { voll: true };
  Object.assign(analyse(s, 'rentenbescheid'), { rentenart: 'volle_em', unbefristet: undefined, ...bescheid });
};

describe('Basisfall (vollständig und stimmig)', () => {
  test('erzeugt keinen einzigen Befund', () => {
    expect(ids(pruefe(basis()))).toEqual([]);
  });
});

// ── Je Regel: Änderung am Basisfall, die genau diese Regel auslöst ──────────

const POSITIV: Array<[string, (s: Snap) => void]> = [
  // Vollständigkeit
  ['antrag-vollstaendig-unterschrieben', (s) => ohne(s, 'grundsicherungsantrag')],
  ['identitaet-jede-person', (s) => ohne(s, 'personalausweis')],
  ['bankverbindung', (s) => { s.vorgang.iban = undefined; }],
  ['betreuung-bestellungsurkunde', (s) => { person(s).betreuung = 'betreuung'; }],
  ['vollmacht-bevollmaechtigte', (s) => { person(s).betreuung = 'vollmacht'; }],
  ['anspruchsgrund-alter-nachweis', (s) => { person(s).geburtsdatum = undefined; delete analyse(s, 'personalausweis').geburtsdatum; delete analyse(s, 'rentenbescheid').geburtsdatum; }],
  ['em-rentenbescheid-unbefristet', (s) => { emFall(s, {}); ohne(s, 'rentenbescheid'); }],
  ['em-feststellung-rv', (s) => emFall(s, { befristet_bis: '2027-12-31' })],
  ['mietvertrag', (s) => ohne(s, 'mietvertrag')],
  ['plausi-mietvertrag-unsigniert', (s) => { analyse(s, 'mietvertrag').unterschrift_vorhanden = false; }],
  ['mietbescheinigung-aktuell', (s) => ohne(s, 'vermieterbescheinigung')],
  ['nebenkostenabrechnung', (s) => ohne(s, 'nebenkostenabrechnung')],
  ['heizkosten-nachweis', (s) => ohne(s, 'nebenkostenabrechnung', 'vermieterbescheinigung')],
  ['mietzahlungsnachweis', (s) => ohne(s, 'kontoauszug')],
  ['eigentum-kostenaufstellung', (s) => { s.vorgang.wohnsituation = 'eigentum'; }],
  ['kv-pv-nachweis', (s) => ohne(s, 'kv_pv_nachweis')],
  ['rentenbescheid', (s) => ohne(s, 'rentenbescheid')],
  ['rentenanpassungsmitteilung', (s) => { analyse(s, 'rentenbescheid').bescheiddatum = '2025-05-01'; }],
  ['betriebsrente-nachweis', (s) => { person(s).einkommen!.push({ id: 'e2', art: 'betriebsrente', betrag_monat: 112 }); }],
  ['wohngeldbescheid', (s) => { person(s).einkommen!.push({ id: 'e2', art: 'wohngeld', betrag_monat: 90 }); }],
  ['schwerbehindertenausweis-g', (s) => { person(s).schwerbehinderung = { gdb: 70, merkzeichen: ['G'] }; }],
  ['ernaehrung-aerztliche-bescheinigung', (s) => { person(s).mehrbedarf_ernaehrung = true; }],
  ['vermoegenserklaerung', (s) => { person(s).vermoegen = undefined; }],
  ['kontoauszuege', (s) => { analyse(s, 'kontoauszug').zeitraum_von = '2026-07-01'; }],
  ['lebensversicherung-rueckkaufswert', (s) => { person(s).vermoegen!.push({ id: 'm2', art: 'lebensversicherung', betrag: 3000 }); }],
  ['bestattungsvorsorge-vertrag', (s) => { person(s).vermoegen!.push({ id: 'm2', art: 'bestattungsvorsorge', betrag: 4000 }); }],
  ['angaben-kinder-eltern', (s) => { person(s).unterhalt_kinder_eltern = undefined; }],
  ['kein-einkommen-erklaerung', (s) => { person(s).einkommen = []; }],
  // Plausibilität
  ['plausi-altersgrenze-nicht-erreicht', (s) => setzeGeburtsdatum(s, '1960-12-15')],
  ['plausi-altersgrenze-folgemonat', (s) => setzeGeburtsdatum(s, '1960-05-10')],
  ['plausi-geburtsdatum-abweichung', (s) => { analyse(s, 'personalausweis').geburtsdatum = '1955-04-11'; }],
  ['plausi-em-rente-befristet', (s) => emFall(s, { befristet_bis: '2027-12-31' })],
  ['plausi-em-rente-teilweise-oder-arbeitsmarkt', (s) => emFall(s, { unbefristet: true, arbeitsmarktabhaengig: true })],
  ['plausi-partner-fehlt', (s) => { person(s).familienstand = 'verheiratet'; }],
  ['plausi-regelbedarfsstufe-inkonsistent', (s) => { analyse(s, 'grundsicherungsantrag').regelbedarfsstufe = 2; }],
  ['plausi-miete-abweichung', (s) => { s.vorgang.wohnung!.kaltmiete = 520; }],
  ['plausi-miete-nicht-gezahlt', (s) => { Object.assign(analyse(s, 'kontoauszug'), { mietzahlung_erkannt: false, mietzahlung_betrag: undefined }); }],
  ['plausi-heizung-in-miete-unklar', (s) => { ohne(s, 'vermieterbescheinigung'); Object.assign(analyse(s, 'mietvertrag'), { heizkosten: undefined, heizkosten_enthalten: true }); }],
  ['plausi-rente-abweichung', (s) => { person(s).einkommen![0]!.betrag_monat = 850; }],
  ['plausi-rentenanpassung-fehlt', (s) => { analyse(s, 'rentenbescheid').bescheiddatum = '2025-05-01'; }],
  ['plausi-kontoauszug-unerklaerte-eingaenge', (s) => { (analyse(s, 'kontoauszug').eingaenge as unknown[]).push({ betrag: 112, verwendungszweck: 'VBL', art: 'betriebsrente', wiederkehrend: true, anzahl: 3 }); }],
  ['plausi-wohngeld-als-einkommen', (s) => { s.dokumente.push(mkDok('wohngeldbescheid', undefined, { betrag_monat: 90, bwz_von: '2026-01-01', bwz_bis: '2026-12-31' })); }],
  ['plausi-vermoegen-ueber-schonbetrag', (s) => { person(s).vermoegen!.push({ id: 'm2', art: 'sparbuch', betrag: 12000 }); }],
  ['plausi-kontostand-abweichung', (s) => { analyse(s, 'kontoauszug').endsaldo = 7300; }],
  ['plausi-grosse-abgaenge', (s) => { analyse(s, 'kontoauszug').grosse_abgaenge = [{ betrag: 5000, datum: '2026-06-02', verwendungszweck: 'Barauszahlung' }]; }],
  ['plausi-merkzeichen-g-nicht-beantragt', (s) => { s.dokumente.push(mkDok('schwerbehindertenausweis', P1, { gdb: 60, merkzeichen: ['G'] })); }],
  ['plausi-ausweis-abgelaufen', (s) => { s.dokumente.push(mkDok('schwerbehindertenausweis', P1, { gdb: 50, merkzeichen: [], gueltig_bis: '2027-01-31' })); }],
  ['plausi-antrag-ohne-datum', (s) => { s.vorgang.antragsdatum = undefined; analyse(s, 'grundsicherungsantrag').datum_vorhanden = false; }],
  // Vorrang
  ['vorrang-wohngeldbescheid-liegt-vor', (s) => { s.dokumente.push(mkDok('wohngeldbescheid', undefined, { betrag_monat: 90, bwz_von: '2026-01-01', bwz_bis: '2026-12-31' })); }],
  ['vorrang-wohngeld-antrag-parallel', (s) => { s.vorgang.wohngeld_antrag_laeuft = true; }],
  ['vorrang-vermoegen-ueber-schonbetrag', (s) => { person(s).vermoegen!.push({ id: 'm2', art: 'sparbuch', betrag: 12000 }); }],
  ['vorrang-weiterleitung-antragsdatum', (s) => { s.vorgang.ersteingang = { datum: '2026-08-03', stelle: 'Wohngeldstelle' }; }],
  ['vorrang-sgb2-statt-sgb12', (s) => emFall(s, { befristet_bis: '2027-12-31' })],
  // Prüfumfang
  ['ausserhalb-pruefumfang', (s) => { s.vorgang.wohnsituation = 'einrichtung'; }],
];

describe('je Regel: Positivtest (Änderung löst die Regel aus) und Negativtest (Basisfall nicht)', () => {
  const basisIds = new Set(ids(pruefe(basis())));
  test('jede Katalogregel hat einen Positivtest', () => {
    const getestet = new Set(POSITIV.map(([id]) => id));
    expect(REGELKATALOG.map((r) => r.id).filter((id) => !getestet.has(id))).toEqual([]);
  });
  for (const [regelId, aendern] of POSITIV) {
    test(regelId, () => {
      expect(basisIds.has(regelId)).toBe(false);
      const s = basis();
      aendern(s);
      const befunde = pruefe(s);
      expect(ids(befunde)).toContain(regelId);
      eindeutig(befunde);
      const b = befunde.find((x) => x.regelId === regelId)!;
      expect(b.belegtext.length).toBeGreaterThan(30);
      expect(b.typ).toBe(REGELKATALOG.find((r) => r.id === regelId)!.typ);
    });
  }
});

describe('Unterschrift Mietvertrag: Hinweis statt Anforderung (Fehlalarm-Klasse, 2026-09-28)', () => {
  test('ohne Konfidenz → Hinweis zum Sichten mit Seite, keine Nachforderung „mietvertrag"', () => {
    const s = basis();
    Object.assign(analyse(s, 'mietvertrag'), { unterschrift_vorhanden: false, unterschrift_seite: 3 });
    const b = pruefe(s).find((x) => x.regelId === 'plausi-mietvertrag-unsigniert')!;
    expect(b.typ).toBe('info');
    expect(b.titel).toBe('Unterschrift im Mietvertrag bitte sichten');
    expect(b.belegtext).toContain('(Seite 3)');
    expect(ids(pruefe(s))).not.toContain('mietvertrag');
  });
  test('Konfidenz 0,7 (Pipeline-Deckel) bleibt Hinweis; ab Schwelle → Anforderung', () => {
    const s = basis();
    Object.assign(analyse(s, 'mietvertrag'), { unterschrift_vorhanden: false, unterschrift_konfidenz: 0.7 });
    expect(pruefe(s).find((x) => x.regelId === 'plausi-mietvertrag-unsigniert')!.typ).toBe('info');
    const k = { ...ladeKonstanten({}), UNTERSCHRIFT_LEER_MIN_KONFIDENZ: 0.7 };
    const b = pruefeVorgang(s, { heute: HEUTE, konstanten: k }).find((x) => x.regelId === 'plausi-mietvertrag-unsigniert')!;
    expect(b.typ).toBe('anforderung');
    expect(b.titel).toBe('Mietvertrag ohne Unterschrift');
  });
  test('Env-Override GRUNDSICHERUNG_UNTERSCHRIFT_LEER_MIN_KONFIDENZ', () => {
    expect(ladeKonstanten({ GRUNDSICHERUNG_UNTERSCHRIFT_LEER_MIN_KONFIDENZ: '0,65' }).UNTERSCHRIFT_LEER_MIN_KONFIDENZ).toBe(0.65);
  });
});

describe('gezielte Negativtests (Abgrenzungen)', () => {
  test('Antrag mit Unterschrift auf einem von zwei Exemplaren → keine Nachforderung', () => {
    const s = basis();
    s.dokumente.push(mkDok('grundsicherungsantrag', P1, { unterschrift_vorhanden: false }));
    expect(ids(pruefe(s))).not.toContain('antrag-vollstaendig-unterschrieben');
  });
  test('unterschriftsloser Antrag → Nachforderung', () => {
    const s = basis();
    analyse(s, 'grundsicherungsantrag').unterschrift_vorhanden = false;
    expect(ids(pruefe(s))).toContain('antrag-vollstaendig-unterschrieben');
  });
  test('Altersgrenze im Antragsmonat erreicht (Geburt am Monatsersten) → keine Altersgrenzen-Befunde', () => {
    const s = basis();
    setzeGeburtsdatum(s, '1960-05-01'); // erreicht mit Ablauf 31.08.2026 = Antragsmonat
    const i = ids(pruefe(s));
    expect(i).not.toContain('plausi-altersgrenze-nicht-erreicht');
    expect(i).not.toContain('plausi-altersgrenze-folgemonat');
  });
  test('Ersteingang vor Antragsdatum ist maßgeblich für die Altersgrenze', () => {
    const s = basis();
    setzeGeburtsdatum(s, '1960-04-10');           // erreicht 09.08.2026
    s.vorgang.ersteingang = { datum: '2026-07-20', stelle: 'Rentenversicherung' };
    expect(ids(pruefe(s))).toContain('plausi-altersgrenze-folgemonat');
  });
  test('unbefristete volle EM-Rente → keine EM-Befunde, kein SGB-II-Hinweis', () => {
    const s = basis();
    emFall(s, { unbefristet: true });
    const i = ids(pruefe(s));
    for (const id of ['em-feststellung-rv', 'plausi-em-rente-befristet', 'plausi-em-rente-teilweise-oder-arbeitsmarkt', 'vorrang-sgb2-statt-sgb12', 'em-rentenbescheid-unbefristet', 'rentenbescheid']) expect(i).not.toContain(id);
  });
  test('befristete EM-Rente mit positiver RV-Feststellung → keine Feststellungs-Nachforderung', () => {
    const s = basis();
    emFall(s, { befristet_bis: '2027-12-31' });
    s.dokumente.push(mkDok('em_feststellung_rv', P1, { dauerhaft_voll_erwerbsgemindert: true }));
    expect(ids(pruefe(s))).not.toContain('em-feststellung-rv');
  });
  test('negative RV-Feststellung → SGB-II-Hinweis', () => {
    const s = basis();
    emFall(s, { unbefristet: true });
    s.dokumente.push(mkDok('em_feststellung_rv', P1, { dauerhaft_voll_erwerbsgemindert: false }));
    // unbefristeter Bescheid belegt Dauerhaftigkeit bereits; negative Feststellung bleibt Hinweis
    expect(ids(pruefe(s))).toContain('vorrang-sgb2-statt-sgb12');
  });
  test('Pauschalmiete → keine Betriebskostenabrechnung, kein Heizkostennachweis', () => {
    const s = basis();
    ohne(s, 'nebenkostenabrechnung', 'vermieterbescheinigung');
    Object.assign(analyse(s, 'mietvertrag'), { pauschalmiete: 610, grundmiete: undefined, nebenkosten_kalt: undefined, heizkosten: undefined, heizkosten_enthalten: true });
    const i = ids(pruefe(s));
    expect(i).not.toContain('nebenkostenabrechnung');
    expect(i).not.toContain('heizkosten-nachweis');
    expect(i).toContain('plausi-heizung-in-miete-unklar');
  });
  test('Neuvertrag (< 12 Monate) → keine Betriebskostenabrechnung, keine Mietbescheinigung', () => {
    const s = basis();
    ohne(s, 'nebenkostenabrechnung', 'vermieterbescheinigung');
    analyse(s, 'mietvertrag').beginn = '2026-03-01';
    const i = ids(pruefe(s));
    expect(i).not.toContain('nebenkostenabrechnung');
    expect(i).not.toContain('mietbescheinigung-aktuell');
  });
  test('Miete im Toleranzband (5 % / 10 €) → keine Abweichung', () => {
    const s = basis();
    s.vorgang.wohnung!.kaltmiete = 458;
    expect(ids(pruefe(s))).not.toContain('plausi-miete-abweichung');
  });
  test('Rentenbetrag innerhalb 1 € → keine Abweichung', () => {
    const s = basis();
    person(s).einkommen![0]!.betrag_monat = 800.5;
    expect(ids(pruefe(s))).not.toContain('plausi-rente-abweichung');
  });
  test('Rentenanpassungsmitteilung liegt vor → weder Nachforderung noch Plausi-Hinweis', () => {
    const s = basis();
    analyse(s, 'rentenbescheid').bescheiddatum = '2025-05-01';
    s.dokumente.push(mkDok('rentenanpassungsmitteilung', P1, { stichtag: '2026-07-01', zahlbetrag_neu: 800 }));
    const i = ids(pruefe(s));
    expect(i).not.toContain('rentenanpassungsmitteilung');
    expect(i).not.toContain('plausi-rentenanpassung-fehlt');
  });
  test('Bewilligungszeitraum endet vor dem Anpassungsstichtag → keine Anpassungsmitteilung nötig', () => {
    const s = basis();
    analyse(s, 'rentenbescheid').bescheiddatum = '2025-05-01';
    s.vorgang.bwz = { start: '2026-01-01', ende: '2026-06-30' };
    expect(ids(pruefe(s))).not.toContain('rentenanpassungsmitteilung');
  });
  test('einmaliger oder angegebener Eingang → nicht unerklärt', () => {
    const s = basis();
    (analyse(s, 'kontoauszug').eingaenge as unknown[]).push({ betrag: 250, verwendungszweck: 'Erstattung Stadtwerke', art: 'erstattung', wiederkehrend: false });
    (analyse(s, 'kontoauszug').eingaenge as unknown[]).push({ betrag: 300, verwendungszweck: 'Nachzahlung', art: 'sonstige', wiederkehrend: false });
    expect(ids(pruefe(s))).not.toContain('plausi-kontoauszug-unerklaerte-eingaenge');
  });
  test('Partnerin im Antrag → kein plausi-partner-fehlt; Stufe 2 passt', () => {
    const s = basis();
    person(s).familienstand = 'verheiratet';
    analyse(s, 'grundsicherungsantrag').regelbedarfsstufe = 2;
    s.personen.push(mkPerson({ id: 'p-karl', rolle: 'partner', vorname: 'Karl', nachname: 'Muster', geburtsdatum: '1953-01-02' }));
    const i = ids(pruefe(s));
    expect(i).not.toContain('plausi-partner-fehlt');
    expect(i).not.toContain('plausi-regelbedarfsstufe-inkonsistent');
  });
  test('erwachsenes Kind als Haushaltsangehörige:r → kein Partner-Befund, keine Nachweise für das Kind', () => {
    const s = basis();
    s.personen.push(mkPerson({ id: 'p-kind', rolle: 'haushaltsangehoerig', vorname: 'Lena', nachname: 'Muster', geburtsdatum: '1985-06-01' }));
    const befunde = pruefe(s);
    expect(ids(befunde)).toEqual([]);
    expect(befunde.some((b) => b.personId === 'p-kind')).toBe(false);
  });
  test('Vermögen über der Wohngeld-Freigrenze → Plausi-Hinweis, aber kein Wohngeld-Vorrang', () => {
    const s = basis();
    person(s).vermoegen!.push({ id: 'm2', art: 'depot', betrag: 70000 });
    const i = ids(pruefe(s));
    expect(i).toContain('plausi-vermoegen-ueber-schonbetrag');
    expect(i).not.toContain('vorrang-vermoegen-ueber-schonbetrag');
  });
  test('geschütztes Vermögen (Eigenheim, Schonvermögen) zählt nicht zum Barbetrag', () => {
    const s = basis();
    person(s).vermoegen!.push({ id: 'm2', art: 'eigenheim', betrag: 180000 }, { id: 'm3', art: 'sparbuch', betrag: 15000, schonvermoegen: true });
    expect(ids(pruefe(s))).not.toContain('plausi-vermoegen-ueber-schonbetrag');
  });
  test('Kontostand: weniger als angegeben nur bei genau einem Girokonto', () => {
    const s = basis();
    analyse(s, 'kontoauszug').endsaldo = 200;          // Angabe Girokonto 1.200 €
    expect(ids(pruefe(s))).toContain('plausi-kontostand-abweichung');
    person(s).vermoegen = [{ id: 'm1', art: 'sparbuch', betrag: 1200 }]; // Auszug gehört evtl. zu anderem Konto
    expect(ids(pruefe(s))).not.toContain('plausi-kontostand-abweichung');
  });
  test('Abgang unter der Schwelle → kein Befund; Schwelle konfigurierbar', () => {
    const s = basis(); // 400 € Abgang im Basisfall
    expect(ids(pruefeVorgang(s, { heute: HEUTE, konstanten: { GROSSE_ABGAENGE_SCHWELLE: 300 } }))).toContain('plausi-grosse-abgaenge');
  });
  test('Kontoauszug-Zeitraum kommunal konfigurierbar', () => {
    const s = basis(); // 3 Monate belegt
    expect(ids(pruefeVorgang(s, { heute: HEUTE, konstanten: { KONTOAUSZUG_MONATE: 6 } }))).toContain('kontoauszuege');
  });
  test('abgelaufener Wohngeldbescheid → kein Vorrang-Hinweis, aber Wohngeld-Einkommen klären', () => {
    const s = basis();
    s.dokumente.push(mkDok('wohngeldbescheid', undefined, { betrag_monat: 90, bwz_von: '2025-01-01', bwz_bis: '2025-12-31' }));
    const i = ids(pruefe(s));
    expect(i).not.toContain('vorrang-wohngeldbescheid-liegt-vor');
  });
  test('Merkzeichen G nur beantragt bei EM-Person unter Altersgrenze ohne volle EM → kein G-Nachweis', () => {
    const s = basis();
    setzeGeburtsdatum(s, '1968-02-10');
    s.vorgang.anspruchsgrund = undefined;
    person(s).schwerbehinderung = { merkzeichen: ['G'] };
    expect(ids(pruefe(s))).not.toContain('schwerbehindertenausweis-g');
  });
  test('Ausweis mit G, im Antrag angegeben → kein Nicht-beantragt-Hinweis, kein Nachweis-Befund', () => {
    const s = basis();
    person(s).schwerbehinderung = { merkzeichen: ['G'] };
    s.dokumente.push(mkDok('schwerbehindertenausweis', P1, { merkzeichen: ['G'] }));
    const i = ids(pruefe(s));
    expect(i).not.toContain('plausi-merkzeichen-g-nicht-beantragt');
    expect(i).not.toContain('schwerbehindertenausweis-g');
    expect(i).not.toContain('plausi-ausweis-abgelaufen');
  });
  test('Antragsdatum erfasst, Formular ohne Datum → kein plausi-antrag-ohne-datum', () => {
    const s = basis();
    analyse(s, 'grundsicherungsantrag').datum_vorhanden = false;
    expect(ids(pruefe(s))).not.toContain('plausi-antrag-ohne-datum');
  });
});

// ── Goldfälle (Spec) ───────────────────────────────────────────────────────

describe('Goldfall 1 — alleinstehende Rentnerin, Miete, Pauschalmiete, Betriebsrente nicht angegeben', () => {
  const E = 'p-erika';
  const s: Snap = {
    vorgang: mkVorgang({
      antragsdatum: '2026-06-15', wohnsituation: 'miete', iban: 'DE44500105175407324931',
      wohnung: { heizung_in_miete_enthalten: true, bewohner_anzahl: 1 },
    }),
    personen: [mkPerson({
      id: E, rolle: 'antragsteller', vorname: 'Erika', nachname: 'Schmidt', geburtsdatum: '1956-09-03', familienstand: 'verwitwet',
      krankenversicherung: { art: 'pflicht' },
      einkommen: [{ id: 'e1', art: 'altersrente', betrag_monat: 780 }],
      vermoegen: [{ id: 'm1', art: 'girokonto', betrag: 640 }],
      unterhalt_kinder_eltern: { angegeben: true },
    })],
    dokumente: [
      mkDok('grundsicherungsantrag', E, { unterschrift_vorhanden: true, datum_vorhanden: true }),
      mkDok('personalausweis', E, { geburtsdatum: '1956-09-03' }),
      mkDok('rentenbescheid', E, { rentenart: 'altersrente', zahlbetrag: 780, bescheiddatum: '2025-03-12', geburtsdatum: '1956-09-03' }),
      mkDok('kv_pv_nachweis', E),
      mkDok('mietvertrag', undefined, { mieter: ['Erika Schmidt'], beginn: '2012-05-01', pauschalmiete: 650, heizkosten_enthalten: true, unterschrift_vorhanden: true }),
      mkDok('kontoauszug', E, {
        zeitraum_von: '2026-03-01', zeitraum_bis: '2026-05-31', endsaldo: 655,
        eingaenge: [
          { betrag: 780, verwendungszweck: 'Deutsche Rentenversicherung', art: 'rente', wiederkehrend: true, anzahl: 3 },
          { betrag: 112, verwendungszweck: 'VBL', art: 'betriebsrente', wiederkehrend: true, anzahl: 3 },
        ],
        mietzahlung_erkannt: true, mietzahlung_betrag: 650,
      }),
    ],
  };
  const befunde = pruefe(s);
  const i = ids(befunde);

  test('erwartete Befunde', () => {
    for (const id of ['rentenanpassungsmitteilung', 'plausi-kontoauszug-unerklaerte-eingaenge', 'plausi-heizung-in-miete-unklar', 'betriebsrente-nachweis']) expect(i).toContain(id);
  });
  test('Belegtext nennt die Quelle', () => {
    const b = befunde.find((x) => x.regelId === 'plausi-kontoauszug-unerklaerte-eingaenge')!;
    expect(b.belegtext).toContain('Kontoauszug 05/2026: 3 Eingänge „VBL" à 112,00 €');
    expect(b.personId).toBe(E);
  });
  test('keine offensichtlich falschen Befunde', () => {
    for (const id of [
      'identitaet-jede-person', 'mietvertrag', 'rentenbescheid', 'heizkosten-nachweis', 'nebenkostenabrechnung', 'mietzahlungsnachweis',
      'kontoauszuege', 'plausi-rente-abweichung', 'plausi-miete-nicht-gezahlt', 'plausi-partner-fehlt', 'plausi-altersgrenze-nicht-erreicht',
      'plausi-vermoegen-ueber-schonbetrag', 'plausi-kontostand-abweichung', 'kv-pv-nachweis', 'angaben-kinder-eltern',
      'vorrang-sgb2-statt-sgb12', 'vorrang-wohngeldbescheid-liegt-vor',
    ]) expect(i).not.toContain(id);
    eindeutig(befunde);
  });
});

describe('Goldfall 2 — Paar, Antragsteller 58 J., EM-Rente befristet, Partnerin nicht im Antrag', () => {
  const K = 'p-klaus';
  const s: Snap = {
    vorgang: mkVorgang({
      anspruchsgrund: 'erwerbsminderung', antragsdatum: '2026-09-02', wohnsituation: 'miete', iban: 'DE89370400440532013000',
      wohnung: { kaltmiete: 520, nebenkosten_kalt: 110, heizkosten: 85, bewohner_anzahl: 2 },
    }),
    personen: [mkPerson({
      id: K, rolle: 'antragsteller', vorname: 'Klaus', nachname: 'Berger', geburtsdatum: '1968-02-10', familienstand: 'verheiratet',
      erwerbsminderung: { voll: true, befristet_bis: '2027-12-31' },
      krankenversicherung: { art: 'pflicht' },
      einkommen: [{ id: 'e1', art: 'em_rente', betrag_monat: 950 }],
      vermoegen: [],
      unterhalt_kinder_eltern: { angegeben: true },
    })],
    dokumente: [
      mkDok('grundsicherungsantrag', K, { unterschrift_vorhanden: true, datum_vorhanden: true }),
      mkDok('personalausweis', K, { geburtsdatum: '1968-02-10' }),
      mkDok('rentenbescheid', K, { rentenart: 'volle_em', befristet_bis: '2027-12-31', zahlbetrag: 950, bescheiddatum: '2026-07-15', geburtsdatum: '1968-02-10' }),
      mkDok('kv_pv_nachweis', K),
      mkDok('mietvertrag', undefined, { mieter: ['Klaus Berger', 'Sabine Berger'], beginn: '2015-04-01', grundmiete: 520, nebenkosten_kalt: 110, heizkosten: 85, unterschrift_vorhanden: true }),
    ],
  };
  const befunde = pruefe(s);
  const i = ids(befunde);

  test('erwartete Befunde', () => {
    for (const id of ['plausi-em-rente-befristet', 'em-feststellung-rv', 'plausi-partner-fehlt', 'vorrang-sgb2-statt-sgb12']) expect(i).toContain(id);
  });
  test('Partner-Befund nennt Mitmieterin und Familienstand', () => {
    const b = befunde.find((x) => x.regelId === 'plausi-partner-fehlt')!;
    expect(b.belegtext).toContain('„Sabine Berger"');
    expect(b.belegtext).toContain('verheiratet');
  });
  test('keine offensichtlich falschen Befunde', () => {
    for (const id of [
      'plausi-altersgrenze-nicht-erreicht', 'plausi-altersgrenze-folgemonat', 'anspruchsgrund-alter-nachweis', 'em-rentenbescheid-unbefristet',
      'rentenbescheid', 'rentenanpassungsmitteilung', 'plausi-rente-abweichung', 'mietvertrag', 'plausi-miete-abweichung',
      'plausi-em-rente-teilweise-oder-arbeitsmarkt', 'plausi-vermoegen-ueber-schonbetrag', 'vermoegenserklaerung',
    ]) expect(i).not.toContain(id);
    eindeutig(befunde);
  });
});

describe('Goldfall 3 — Rentner mit Wohngeld und Sparbuch 14.200 €', () => {
  const H = 'p-horst';
  const s: Snap = {
    vorgang: mkVorgang({
      antragsdatum: '2026-08-20', wohnsituation: 'miete', iban: 'DE12500105170648489890',
      wohnung: { kaltmiete: 480, nebenkosten_kalt: 95, heizkosten: 75, bewohner_anzahl: 1 },
    }),
    personen: [mkPerson({
      id: H, rolle: 'antragsteller', vorname: 'Horst', nachname: 'Lehmann', geburtsdatum: '1957-11-22', familienstand: 'verwitwet',
      krankenversicherung: { art: 'pflicht' },
      einkommen: [{ id: 'e1', art: 'altersrente', betrag_monat: 1020 }],
      vermoegen: [{ id: 'm1', art: 'sparbuch', betrag: 14200 }, { id: 'm2', art: 'girokonto', betrag: 900 }],
      unterhalt_kinder_eltern: { angegeben: true },
    })],
    dokumente: [
      mkDok('grundsicherungsantrag', H, { unterschrift_vorhanden: true, datum_vorhanden: true }),
      mkDok('personalausweis', H, { geburtsdatum: '1957-11-22' }),
      mkDok('rentenbescheid', H, { rentenart: 'altersrente', zahlbetrag: 1020, bescheiddatum: '2026-07-01' }),
      mkDok('kv_pv_nachweis', H),
      mkDok('mietvertrag', undefined, { mieter: ['Horst Lehmann'], beginn: '2004-10-01', grundmiete: 480, nebenkosten_kalt: 95, heizkosten: 75, unterschrift_vorhanden: true }),
      mkDok('vermieterbescheinigung', undefined, { grundmiete: 480, nebenkosten_kalt: 95, heizkosten: 75 }),
      mkDok('nebenkostenabrechnung', undefined, { heizkosten_enthalten: true }),
      mkDok('wohngeldbescheid', undefined, { betrag_monat: 186, bwz_von: '2026-03-01', bwz_bis: '2027-02-28', bescheiddatum: '2026-02-18' }),
      mkDok('vermoegensnachweis', H, { art: 'sparbuch', stand: 14200, stichtag: '2026-07-31' }),
      mkDok('kontoauszug', H, {
        zeitraum_von: '2026-05-01', zeitraum_bis: '2026-07-31', endsaldo: 950,
        eingaenge: [
          { betrag: 1020, verwendungszweck: 'Deutsche Rentenversicherung', art: 'rente', wiederkehrend: true, anzahl: 3 },
          { betrag: 186, verwendungszweck: 'Wohngeld Stadt', art: 'wohngeld', wiederkehrend: true, anzahl: 3 },
        ],
        mietzahlung_erkannt: true, mietzahlung_betrag: 650,
      }),
    ],
  };
  const befunde = pruefe(s);
  const i = ids(befunde);

  test('erwartete Befunde', () => {
    for (const id of ['vorrang-wohngeldbescheid-liegt-vor', 'plausi-wohngeld-als-einkommen', 'plausi-vermoegen-ueber-schonbetrag', 'vorrang-vermoegen-ueber-schonbetrag']) expect(i).toContain(id);
  });
  test('Vermögen über Schonbetrag ist nur Hinweis (info), keine Ablehnung', () => {
    expect(befunde.find((b) => b.regelId === 'plausi-vermoegen-ueber-schonbetrag')!.typ).toBe('info');
    expect(befunde.filter((b) => b.regelId.startsWith('vorrang-')).every((b) => b.typ === 'info')).toBe(true);
  });
  test('keine offensichtlich falschen Befunde', () => {
    for (const id of [
      'wohngeldbescheid', 'plausi-kontoauszug-unerklaerte-eingaenge', 'plausi-kontostand-abweichung', 'plausi-rente-abweichung',
      'rentenanpassungsmitteilung', 'plausi-miete-abweichung', 'kontoauszuege', 'vermoegenserklaerung', 'plausi-partner-fehlt',
      'vorrang-sgb2-statt-sgb12', 'plausi-altersgrenze-nicht-erreicht',
    ]) expect(i).not.toContain(id);
    eindeutig(befunde);
  });
});

describe('Konstanten', () => {
  test('Env-Override GRUNDSICHERUNG_* (Zahl, Datum), ungültige Werte ignoriert', () => {
    const k = ladeKonstanten({
      GRUNDSICHERUNG_KONTOAUSZUG_MONATE: '6', GRUNDSICHERUNG_GROSSE_ABGAENGE_SCHWELLE: '2500,50',
      GRUNDSICHERUNG_RENTENANPASSUNG_STICHTAG: '2027-07-01', GRUNDSICHERUNG_SCHONBETRAG_JE_PERSON: 'abc',
    });
    expect(k.KONTOAUSZUG_MONATE).toBe(6);
    expect(k.GROSSE_ABGAENGE_SCHWELLE).toBe(2500.5);
    expect(k.RENTENANPASSUNG_STICHTAG).toBe('2027-07-01');
    expect(k.SCHONBETRAG_JE_PERSON).toBe(10000);
  });
});
