/**
 * Fehlalarm-Klassen aus der Golden-Messung (docs/wohngeld-fehlalarme-2026-09-28.md) — je Änderung
 * positiv (echter Fall wird weiter gemeldet) und negativ (Fehlalarm-Muster bleibt still).
 */
import { describe, expect, test } from 'bun:test';
import { ordneNachweisZu } from '../haushalt';
import type { Dokument, DokumentAnalyse, DokumentTyp, KontoEingang, Person, PruefBefund, Vorgang, VorgangSnapshot } from '../types';
import { eingangAusnahme, pruefeAbgleiche } from './abgleich';
import { pruefeVorgang } from './index';
import { ladeKonstanten, STANDARD_KONSTANTEN } from './konstanten';
import { pruefeVorrang } from './vorrang';

const basis = { version: 1, created_at: '', updated_at: '' };
const vorgang = (over: Partial<Vorgang> = {}): Vorgang => ({
  ...basis, id: 'v', akteId: 'a', antragsId: 'X', wohngeldart: 'mietzuschuss', antragsart: 'erstantrag',
  status: 'sachbearbeitung', prioritaet: 'normal', antragsdatum: '2026-09-01', wohnung: { miete: 500, plz: '12345', ort: 'Ort' }, ...over,
});
const person = (over: Partial<Person> = {}): Person => ({
  ...basis, id: 'p1', vorgangId: 'v', rolle: 'antragsteller', vorname: 'Anna', nachname: 'Muster', geburtsdatum: '1980-01-01', ...over,
});
let n = 0;
const dok = (typ: DokumentTyp, analyse: DokumentAnalyse, over: Partial<Dokument> = {}): Dokument => ({
  ...basis, id: `d${++n}`, vorgangId: 'v', typ, istOriginal: false, analyse, ...over,
});
const snap = (s: Partial<VorgangSnapshot>): VorgangSnapshot => ({ vorgang: vorgang(), personen: [person()], dokumente: [], ...s });
const ids = (b: PruefBefund[]) => b.map((x) => x.regelId.split(':')[0]);
const finde = (b: PruefBefund[], id: string) => b.find((x) => x.regelId === id);

// ── 1. Unterschrift Mietvertrag ─────────────────────────────────────────────

describe('plausi-mietvertrag-unsigniert: Hinweis zum Sichten statt Anforderung', () => {
  test('ohne Konfidenz → info mit Seitenangabe und Titel „bitte sichten"', () => {
    const mv = dok('mietvertrag', { unterschrift_vorhanden: false, unterschrift_seite: 4 });
    const b = finde(pruefeVorgang(snap({ dokumente: [mv] })), 'plausi-mietvertrag-unsigniert')!;
    expect(b).toMatchObject({ typ: 'info', titel: 'Unterschrift im Mietvertrag bitte sichten', quellDokumentId: mv.id });
    expect(b.belegtext).toContain('(Seite 4)');
  });
  test('Konfidenz 0,7 (Pipeline-Deckel) bleibt Hinweis — Standard-Schwelle 0,9', () => {
    expect(STANDARD_KONSTANTEN.UNTERSCHRIFT_LEER_MIN_KONFIDENZ).toBe(0.9);
    const b = finde(pruefeVorgang(snap({ dokumente: [dok('mietvertrag', { unterschrift_vorhanden: false, unterschrift_konfidenz: 0.7 })] })), 'plausi-mietvertrag-unsigniert')!;
    expect(b.typ).toBe('info');
  });
  test('Konfidenz über der Schwelle → Anforderung „Mietvertrag ohne Unterschrift"', () => {
    const b = finde(pruefeVorgang(snap({ dokumente: [dok('mietvertrag', { unterschrift_vorhanden: false, unterschrift_konfidenz: 0.95 })] })), 'plausi-mietvertrag-unsigniert')!;
    expect(b).toMatchObject({ typ: 'anforderung', titel: 'Mietvertrag ohne Unterschrift' });
  });
  test('unterschrieben oder nicht gelesen → kein Befund; Env-Override der Schwelle', () => {
    expect(ids(pruefeVorgang(snap({ dokumente: [dok('mietvertrag', { unterschrift_vorhanden: true })] })))).not.toContain('plausi-mietvertrag-unsigniert');
    expect(ids(pruefeVorgang(snap({ dokumente: [dok('mietvertrag', {})] })))).not.toContain('plausi-mietvertrag-unsigniert');
    expect(ladeKonstanten({ WOHNGELD_UNTERSCHRIFT_LEER_MIN_KONFIDENZ: '0,7' }).UNTERSCHRIFT_LEER_MIN_KONFIDENZ).toBe(0.7);
  });
  test('Antrag ohne Unterschrift bleibt Anforderung (Erkennung in der Messung fehlerfrei)', () => {
    const b = finde(pruefeVorgang(snap({ dokumente: [dok('wohngeldantrag', { unterschrift_vorhanden: false })] })), 'plausi-antrag-ohne-unterschrift')!;
    expect(b.typ).toBe('anforderung');
  });
});

// ── 2. Vorrang Grundsicherung ───────────────────────────────────────────────

const rentnerin = (betrag: number, over: Partial<Person> = {}) => person({
  geburtsdatum: '1950-06-19', einkommen: [{ id: 'e1', art: 'rente', betrag_monatlich: betrag, beruecksichtigt: true }], ...over,
});
const vorrangIds = (s: VorgangSnapshot) => ids(pruefeVorrang(s));

describe('vorrang-grundsicherung-mitpruefen: Orientierungswert, Belegvermögen, Heim', () => {
  test('Rente unter dem Orientierungswert → Hinweis nennt Summe und Orientierungswert', () => {
    const b = pruefeVorrang(snap({ personen: [rentnerin(1078.4)] }))[0]!;
    expect(b.regelId).toBe('vorrang-grundsicherung-mitpruefen');
    expect(b.belegtext).toContain('1.078,40 € brutto');
    expect(b.belegtext).toContain('Orientierungswert 1.250,00 €');
  });
  test('Rente über dem Orientierungswert (alleinstehend) → kein Hinweis', () => {
    expect(vorrangIds(snap({ personen: [rentnerin(1265.3)] }))).not.toContain('vorrang-grundsicherung-mitpruefen');
  });
  test('Paar: Summe beider Renten gegen den Paar-Wert (F04-Muster 1.318,40 + 742,90 €)', () => {
    const paar = (a: number, b: number) => snap({ personen: [
      rentnerin(a, { geburtsdatum: '1956-02-17' }),
      person({ id: 'p2', rolle: 'ehegatte', vorname: 'Halina', geburtsdatum: '1958-08-30', einkommen: [{ id: 'e2', art: 'rente', betrag_monatlich: b, beruecksichtigt: true }] }),
    ] });
    expect(vorrangIds(paar(1318.4, 742.9))).not.toContain('vorrang-grundsicherung-mitpruefen');
    expect(vorrangIds(paar(1100, 600))).toContain('vorrang-grundsicherung-mitpruefen');
  });
  test('Orientierungswert per Konfiguration (kommunal festzulegen)', () => {
    const s = snap({ personen: [rentnerin(1184.2)] });
    expect(ids(pruefeVorrang(s, { konstanten: { GRUNDSICHERUNG_ORIENTIERUNG_PERSON_EUR: 1100 } }))).toEqual([]);
    expect(ladeKonstanten({ WOHNGELD_GRUNDSICHERUNG_ORIENTIERUNG_PERSON_EUR: '1300' }).GRUNDSICHERUNG_ORIENTIERUNG_PERSON_EUR).toBe(1300);
  });
  test('Einkommen ohne Betrag → Höhe unbekannt, Hinweis bleibt', () => {
    const s = snap({ personen: [person({ geburtsdatum: '1950-01-01', einkommen: [{ id: 'e', art: 'rente', beruecksichtigt: true }] })] });
    const b = pruefeVorrang(s)[0]!;
    expect(b.belegtext).toContain('Höhe nicht vollständig erfasst');
  });
  test('Vermögen aus Belegen (Depot, Kontostand) über 10.000 € → kein Hinweis (F22-Muster)', () => {
    const depot = dok('vermoegensnachweis', { betrag: 140216.84 }, { personId: 'p1' });
    expect(vorrangIds(snap({ personen: [rentnerin(1000)], dokumente: [depot] }))).toEqual([]);
    const konto = dok('kontoauszug', { endsaldo: 12500, iban: 'DE1' }, { personId: 'p1' });
    expect(vorrangIds(snap({ personen: [rentnerin(1000)], dokumente: [konto] }))).toEqual([]);
  });
  test('kleiner Kontostand → Hinweis nennt das belegte Vermögen', () => {
    const konto = dok('kontoauszug', { endsaldo: 850, iban: 'DE1' }, { personId: 'p1' });
    const b = pruefeVorrang(snap({ personen: [rentnerin(1000)], dokumente: [konto] }))[0]!;
    expect(b.belegtext).toContain('belegte Vermögen (850,00 €)');
  });
  test('Heimfall (Heimvertrag liegt vor) → kein Hinweis (F26-Muster)', () => {
    const heim = dok('mietvertrag', { mietdokument: 'heimvertrag', miete: 1064.7 });
    expect(vorrangIds(snap({ personen: [rentnerin(1000)], dokumente: [heim] }))).toEqual([]);
  });
});

// ── 3. Identität / Zuordnung ───────────────────────────────────────────────

describe('identitaet-jede-person und Ausweis-Zuordnung', () => {
  const zwei = [
    { id: 'P1', vorname: 'Günther', nachname: 'Schäfle', geburtsdatum: '1951-10-07' },
    { id: 'P2', vorname: 'Gisela', nachname: 'Schäfle', geburtsdatum: '1953-02-01' },
  ];
  test('Ausweis ohne lesbares Geburtsdatum, Name mit einem Lesefehler → richtige Person', () => {
    expect(ordneNachweisZu('personalausweis', { vorname: 'GÜNTER', nachname: 'SCHÄFLE' }, zwei)).toEqual({ personId: 'P1', grund: 'name' });
    expect(ordneNachweisZu('personalausweis', { vorname: 'Gisela', nachname: 'SCHAEFLE' }, zwei)).toEqual({ personId: 'P2', grund: 'name' });
  });
  test('Lesefehler-Toleranz ist nicht beliebig: zwei Abweichungen oder Mehrdeutigkeit → unklar', () => {
    expect(ordneNachweisZu('personalausweis', { vorname: 'Gunnar', nachname: 'Schaefer' }, zwei)).toEqual({ grund: 'unklar' });
    const gleich = [{ id: 'A', vorname: 'Sabine', nachname: 'Meier' }, { id: 'B', vorname: 'Sabine', nachname: 'Mayer' }];
    expect(ordneNachweisZu('personalausweis', { vorname: 'Sabine', nachname: 'Meyer' }, gleich)).toEqual({ grund: 'unklar' });
  });
  test('Geburtsdatum widerspricht → keine Zuordnung über den Namen', () => {
    expect(ordneNachweisZu('personalausweis', { vorname: 'Günter', nachname: 'Schäfle', geburtsdatum: '1960-01-01' }, zwei).personId).toBeUndefined();
  });
  test('Weiterleistungsantrag: kein Ausweis und kein Mietvertrag verlangt, wenn Vermieterbescheinigung vorliegt (F04-Muster)', () => {
    const s = snap({ vorgang: vorgang({ antragsart: 'weiterleistungsantrag' }), dokumente: [dok('mietbescheinigung', { miete: 500 })] });
    const i = ids(pruefeVorgang(s));
    expect(i).not.toContain('identitaet-jede-person');
    expect(i).not.toContain('mietvertrag');
  });
  test('Erstantrag ohne Ausweis/Mietvertrag → weiter Anforderungen', () => {
    const i = ids(pruefeVorgang(snap({ dokumente: [dok('mietbescheinigung', { miete: 500 })] })));
    expect(i).toContain('identitaet-jede-person');
    expect(i).toContain('mietvertrag');
  });
});

// ── 4. Kontoeingänge ───────────────────────────────────────────────────────

describe('plausi-kontoauszug-unerklaerte-eingaenge: Umbuchung, Erstattung, Haushalt, Transfer', () => {
  const konto = (eingaenge: KontoEingang[], over: Partial<Dokument> = {}) => dok('kontoauszug', { iban: 'DE02120300000000202051', eingaenge }, { personId: 'p1', ...over });
  const wiederkehrend = (verwendungszweck: string, art: KontoEingang['art'], betrag = 300): KontoEingang => ({ verwendungszweck, art, betrag, wiederkehrend: true });
  const gemeldet = (s: VorgangSnapshot) => finde(pruefeAbgleiche(s), 'plausi-kontoauszug-unerklaerte-eingaenge');

  test('Umbuchung vom eigenen Sparkonto (Stichwort) → nicht gemeldet (F26-Muster)', () => {
    expect(gemeldet(snap({ dokumente: [konto([wiederkehrend('Übertrag Sparkonto 1588214 Heimkosten-Eigenanteil', 'sonstige', 800)])] }))).toBeUndefined();
    expect(gemeldet(snap({ dokumente: [konto([wiederkehrend('Umbuchung Tagesgeld', 'kapitalertrag', 800)])] }))).toBeUndefined();
  });
  test('Gegen-IBAN = eigenes Konto des Haushalts → Umbuchung', () => {
    const giro = konto([wiederkehrend('Gutschrift von DE89 3704 0044 0532 0130 00 Rücklage', 'miete_einnahme')]);
    const spar = dok('kontoauszug', { iban: 'DE89370400440532013000' }, { personId: 'p1' });
    expect(gemeldet(snap({ dokumente: [giro, spar] }))).toBeUndefined();
    expect(eingangAusnahme({ verwendungszweck: 'DE89 3704 0044 0532 0130 00', art: 'sonstige' }, { ibans: new Set(['DE89370400440532013000']), personen: [], arten: new Set() })).toBe('Umbuchung zwischen eigenen Konten');
  });
  test('Erstattungen (Krankenkasse, Finanzamt, Nebenkostenguthaben) → nicht gemeldet', () => {
    for (const z of ['AOK Erstattung Zuzahlung', 'Finanzamt Steuererstattung 2025', 'Nebenkostenguthaben 2025 Hausverwaltung', 'Rücklastschrift Stadtwerke']) {
      expect(gemeldet(snap({ dokumente: [konto([wiederkehrend(z, 'kapitalertrag')])] }))).toBeUndefined();
    }
  });
  test('Krankengeld der Krankenkasse ist keine Erstattung → wird gemeldet', () => {
    const f = gemeldet(snap({ dokumente: [konto([wiederkehrend('AOK Krankengeld 07/2026', 'sozialleistung', 1100)])] }));
    expect(f?.belegtext).toContain('AOK Krankengeld');
  });
  test('Mietanteil eines Haushaltsmitglieds → nicht gemeldet (F23-Muster); Fremder mit gleicher Art → gemeldet', () => {
    const tochter = person({ id: 'p2', rolle: 'kind', vorname: 'Derya', nachname: 'Yıldırım' });
    const mutter = person({ vorname: 'Aylin', nachname: 'Yıldırım' });
    expect(gemeldet(snap({ personen: [mutter, tochter], dokumente: [konto([wiederkehrend('Derya Yildirim Mietanteil August', 'miete_einnahme', 362.5)])] }))).toBeUndefined();
    const f = gemeldet(snap({ personen: [mutter, tochter], dokumente: [konto([wiederkehrend('Emre Kaplan Untermiete Zimmer', 'miete_einnahme', 350)])] }));
    expect(f?.belegtext).toContain('Emre Kaplan');
  });
  test('Erwerbseingang mit dem eigenen Namen im Verwendungszweck bleibt prüfbar (kein Haushalts-Freibrief)', () => {
    const f = gemeldet(snap({ dokumente: [konto([wiederkehrend('Gaststätte Hafen Lohn Anna Muster', 'erwerb', 480)])] }));
    expect(f?.belegtext).toContain('Gaststätte Hafen');
  });
  test('Kindergeld/Familienkasse und Wohngeld nie; Pflegegeld nur mit erfasstem Pflegegrad', () => {
    expect(gemeldet(snap({ dokumente: [konto([wiederkehrend('Familienkasse KG 07/2026', 'sozialleistung', 259)])] }))).toBeUndefined();
    const pflege = konto([wiederkehrend('AOK Bayern Pflegekasse Pflegegeld 07/2026', 'sozialleistung', 599)]);
    expect(gemeldet(snap({ personen: [person({ pflege_behinderung: { pflegegrad: 3 } })], dokumente: [pflege] }))).toBeUndefined();
    expect(gemeldet(snap({ dokumente: [pflege] }))).toBeDefined();
  });
  test('angegebene Transferleistung (Jobcenter) → nicht gemeldet; ohne Angabe → gemeldet', () => {
    const jc = konto([wiederkehrend('Jobcenter Bürgergeld 08/2026', 'sonstige', 400)]);
    expect(gemeldet(snap({ personen: [person({ ausschluesse: [{ id: 'x', grund: 'sgb2_buergergeld' }] })], dokumente: [jc] }))).toBeUndefined();
    const jcSozial = konto([wiederkehrend('Jobcenter Bürgergeld 08/2026', 'sozialleistung', 400)]);
    expect(gemeldet(snap({ dokumente: [jcSozial] }))).toBeDefined();
  });
  test('ausgenommene Eingänge werden im Befund genannt, wenn die Regel sie sonst gemeldet hätte', () => {
    const f = gemeldet(snap({ dokumente: [konto([
      wiederkehrend('Deutsche Rentenversicherung', 'rente', 900),
      wiederkehrend('Umbuchung Tagesgeld', 'kapitalertrag', 50),
    ])] }))!;
    expect(f.belegtext).toContain('Nicht als Einkommen gewertet: „Umbuchung Tagesgeld" (Umbuchung zwischen eigenen Konten)');
  });
});

describe('plausi-kontoauszug-unerklaerte-einkuenfte (Ja/Nein-Erkennung ohne Eingangsliste)', () => {
  const flag = (over: Partial<Dokument> = {}) => dok('kontoauszug', { erkannte_einkuenfte: ['v_und_v'] }, { personId: 'p1', ...over });
  test('Untermietvertrag erklärt „Mieteinnahmen" (F25-Muster)', () => {
    const um = dok('mietvertrag', { mietdokument: 'untermietvertrag', miete: 350 });
    expect(ids(pruefeVorgang(snap({ dokumente: [flag(), um] })))).not.toContain('plausi-kontoauszug-unerklaerte-einkuenfte');
  });
  test('Mietanteil eines Haushaltsmitglieds mit Bürgergeld (F23-Muster)', () => {
    const tochter = person({ id: 'p2', rolle: 'kind', vorname: 'Derya', ausschluesse: [{ id: 'x', grund: 'sgb2_buergergeld' }] });
    expect(ids(pruefeVorgang(snap({ personen: [person(), tochter], dokumente: [flag()] })))).not.toContain('plausi-kontoauszug-unerklaerte-einkuenfte');
  });
  test('sonst weiter gemeldet (positiv)', () => {
    expect(ids(pruefeVorgang(snap({ dokumente: [flag()] })))).toContain('plausi-kontoauszug-unerklaerte-einkuenfte');
  });
});

// ── 5. Kleine Posten ───────────────────────────────────────────────────────

describe('essenzielle-angaben / vermieterbescheinigung', () => {
  test('Antrag ohne Datum: Antragsdatum nicht doppelt als essenzielle Angabe (F12-Muster)', () => {
    const s = snap({ vorgang: vorgang({ antragsdatum: undefined }), dokumente: [dok('wohngeldantrag', { datum_vorhanden: false, unterschrift_vorhanden: true })] });
    const i = ids(pruefeVorgang(s));
    expect(i).toContain('plausi-antrag-ohne-datum');
    expect(i).not.toContain('essenzielle-angaben');
  });
  test('ohne Antragsformular fehlt das Antragsdatum weiter als essenzielle Angabe', () => {
    expect(ids(pruefeVorgang(snap({ vorgang: vorgang({ antragsdatum: undefined }) })))).toContain('essenzielle-angaben');
  });
  test('Heimbewohner: keine Miethöhe im Antrag und keine Vermieterbescheinigung nötig (F26-Muster)', () => {
    const s = snap({ vorgang: vorgang({ wohnung: { plz: '23568', ort: 'Lübeck' } }), dokumente: [dok('mietvertrag', { mietdokument: 'heimvertrag', miete: 1064.7 })] });
    const i = ids(pruefeVorgang(s));
    expect(i).not.toContain('essenzielle-angaben');
    expect(i).not.toContain('vermieterbescheinigung');
    const ohneHeim = ids(pruefeVorgang(snap({ vorgang: vorgang({ wohnung: { plz: '23568', ort: 'Lübeck' } }), dokumente: [dok('mietvertrag', { miete: 500 })] })));
    expect(ohneHeim).toContain('essenzielle-angaben');
    expect(ohneHeim).toContain('vermieterbescheinigung');
  });
});
