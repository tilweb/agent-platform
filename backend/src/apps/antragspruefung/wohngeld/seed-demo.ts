/**
 * Wohngeld — Demo-Seed (wiederverwendbare Logik).
 *
 * Befüllt die Wohngeld-App mit realistischen, synthetischen Demo-Daten zum
 * Live-Durchklicken (Posteingang, Sachbearbeitung, Wiedervorlage/Fristen,
 * Akten-Browser, Verfügung, Fall-Chat, Prüfschritte, Anforderungsschreiben).
 *
 * Alle angelegten Akten tragen den Marker `data.demo === true`.
 *
 * Aufruf-Kontrakt:
 *  - Kein Top-Level-Ausführen, kein `process.exit`, kein `closeSql` — die
 *    DB-Verbindung managt der Aufrufer (Boot-Seeding bzw. CLI-Wrapper).
 *  - `reset: false` (Default): **create-if-absent** — existiert bereits ≥1
 *    Demo-Akte, passiert nichts (`skipped: true`). So überschreiben Boot-
 *    Neustarts keine Änderungen der Tester.
 *  - `reset: true`: vorhandene Demo-Akten löschen (cascadet) und neu anlegen.
 *
 * Alle Personen/Adressen sind frei erfunden (KEINE echten Personen).
 */
import {
  createAkte, createVorgang, createPerson, createDokument, updateVorgang,
  createSchreiben, addNotiz, addChatMessage, addAktivitaet, setFeldStatus,
  getVorgangSnapshot, syncPruefschritte, listPruefschritte, updatePruefschritt,
  listAkten, deleteAkte, createPosteingang, listPosteingang, deletePosteingang,
} from './storage';
import { pruefeVorgang } from './checker';
import { generiereAnforderungsschreiben } from './schreiben-generator';
import { berechneBwzVorschlag } from './bwz';
import type {
  Akte, Bewilligungszeitraum, Einkommensposition, Pruefschritt,
  TransferleistungDetail, VermoegenPosition, VorgangTodo,
} from './types';

export interface SeedWohngeldResult {
  aktenCreated: number;
  vorgaengeCreated: number;
  skipped: boolean;
}

// ── kleine Helfer ────────────────────────────────────────────────────────────

let _seq = 0;
/** Stabil-eindeutige ID für eingebettete Listen-Positionen (Einkommen etc.). */
function subId(prefix: string): string {
  _seq += 1;
  return `${prefix}-${_seq.toString(36)}`;
}

type CreateAkteInput = Parameters<typeof createAkte>[0];
/** Legt eine Akte mit Demo-Marker (`data.demo === true`) an. */
async function createDemoAkte(input: Partial<Akte> & { name: string }): Promise<Akte> {
  return createAkte({ ...input, demo: true } as CreateAkteInput);
}

function einkommen(art: string, betrag_monatlich: number, bezeichnung?: string): Einkommensposition {
  return { id: subId('eink'), art, bezeichnung, betrag_monatlich, beruecksichtigt: false };
}
function vermoegen(art: string, betrag: number): VermoegenPosition {
  return { id: subId('verm'), art, betrag };
}
function transfer(art: string, kduEnthalten: boolean, bescheidVorhanden: boolean): TransferleistungDetail {
  return { id: subId('trans'), art, kduEnthalten, bescheidVorhanden };
}
function todo(text: string, erledigt = false): VorgangTodo {
  return { id: subId('todo'), text, erledigt };
}

/** ISO-Datum (YYYY-MM-DD) relativ zu heute. */
function tage(offset: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function bwzListe(antragsdatum: string): Bewilligungszeitraum[] {
  const v = berechneBwzVorschlag(antragsdatum);
  return v ? [{ id: subId('bwz'), start: v.start, ende: v.ende }] : [];
}

/** Prüfung ausführen + Prüfschritte synchronisieren (echte Befunde erzeugen). */
async function pruefen(vorgangId: string): Promise<Pruefschritt[]> {
  const snap = await getVorgangSnapshot(vorgangId);
  if (!snap) throw new Error(`Snapshot fehlt für Vorgang ${vorgangId}`);
  const befunde = pruefeVorgang(snap);
  return syncPruefschritte(vorgangId, befunde);
}

/** Alle (noch offenen) Prüfschritte eines Vorgangs auf `erledigt` setzen. */
async function alleErledigt(vorgangId: string): Promise<void> {
  const ps = await listPruefschritte(vorgangId);
  for (const p of ps) {
    if (p.status !== 'erledigt') await updatePruefschritt(p.id, { status: 'erledigt' });
  }
}

/** Anforderungsschreiben aus den offenen Prüfschritten generieren + speichern. */
async function generiereSchreiben(vorgangId: string, stichtag: string): Promise<void> {
  const snap = await getVorgangSnapshot(vorgangId);
  if (!snap) throw new Error(`Snapshot fehlt für Vorgang ${vorgangId}`);
  const ps = await listPruefschritte(vorgangId);
  const gen = generiereAnforderungsschreiben(snap.vorgang, snap.personen, ps, { fristTage: 14, stichtag });
  await createSchreiben({ vorgangId, ...gen });
}

// Bilanz-Zähler (pro seedWohngeldDemo-Lauf zurückgesetzt).
interface Bilanz { akten: number; vorgaenge: number; byStatus: Record<string, number>; }

function makeZaehler(bilanz: Bilanz) {
  return (status: string): void => {
    bilanz.vorgaenge += 1;
    bilanz.byStatus[status] = (bilanz.byStatus[status] ?? 0) + 1;
  };
}

// ── Szenarien ────────────────────────────────────────────────────────────────

type Zaehle = (status: string) => void;

/** 1) Goldfall Petermann — Rentner-Ehepaar, Mietzuschuss, Erstantrag, viele Widersprüche. */
async function szenarioPetermann(bilanz: Bilanz, zaehle: Zaehle): Promise<void> {
  const akte = await createDemoAkte({
    name: 'Petermann, Siegfried',
    antragstellerName: 'Siegfried Petermann',
    strasse: 'Brinckmannstraße', hausnummer: '5', plz: '40225', ort: 'Düsseldorf',
  });
  bilanz.akten += 1;

  const v = await createVorgang({
    akteId: akte.id, antragsId: '104-556-230',
    wohngeldart: 'mietzuschuss', antragsart: 'erstantrag', status: 'sachbearbeitung',
    sachbearbeiter: 'Katharina Vogel', prioritaet: 'normal',
    antragsdatum: '2026-08-12',
    wohnung: { strasse: 'Brinckmannstraße', hausnummer: '5', plz: '40225', ort: 'Düsseldorf', wohnflaeche_qm: 63, miete: 704 },
    iban: 'DE12 3006 0601 0000 1234 56',
    labels: ['Rentner', 'Widersprüche'],
  });
  zaehle(v.status);

  const p1 = await createPerson({
    vorgangId: v.id, rolle: 'antragsteller', nachname: 'Petermann', vorname: 'Siegfried',
    geburtsdatum: '1955-03-26', geburtsort: 'Paderborn', familienstand: 'verheiratet',
    staatsangehoerigkeit: 'Deutschland', erwerbsstatus: 'rente_pension',
    einkommen: [einkommen('rente', 686, 'Altersrente'), einkommen('lohn_gehalt', 980, 'Minijob')],
    vermoegenPositionen: [vermoegen('Bankguthaben', 12500)],
  });
  const p2 = await createPerson({
    vorgangId: v.id, rolle: 'ehegatte', nachname: 'Petermann', vorname: 'Marion',
    geburtsdatum: '1960-05-14', familienstand: 'verheiratet',
    staatsangehoerigkeit: 'Deutschland', erwerbsstatus: 'rente_pension',
    einkommen: [einkommen('rente', 874.86, 'Altersrente')],
  });

  const d1 = await createDokument({
    vorgangId: v.id, typ: 'wohngeldantrag', titel: 'Wohngeldantrag (Mietzuschuss)',
    quelle: 'antrag_petermann.pdf', seiten: 11, istOriginal: true, eingegangenAm: '2026-08-12',
    analyse: { unterschrift_vorhanden: true, datum_vorhanden: false },
    flags: [{ code: 'ohne_datum', hinweis: 'Auf S. 11 unterschrieben, aber ohne Datum.' }],
  });
  await createDokument({
    vorgangId: v.id, personId: p2.id, typ: 'rentenbescheid',
    titel: 'Rentenanpassungsmitteilung (Marion)', quelle: 'rente_marion.pdf', istOriginal: false,
    eingegangenAm: '2026-08-13',
    analyse: { rentenart_vorhanden: true, grundrentenzeiten_vorhanden: false, betrag: 874.86 },
  });
  await createDokument({
    vorgangId: v.id, personId: p1.id, typ: 'kontoauszug',
    titel: 'Kontoauszug (Siegfried)', quelle: 'konto_siegfried_2019.pdf', istOriginal: false,
    eingegangenAm: '2026-08-13',
    analyse: { mietzahlung_erkannt: false, erkannte_einkuenfte: ['kapitalertraege'] },
    flags: [{ code: 'alt', hinweis: 'Kontoauszug aus 2019 — nicht aktuell.' }],
  });
  await createDokument({
    vorgangId: v.id, typ: 'mietvertrag', titel: 'Mietvertrag (unbefristet)',
    quelle: 'mietvertrag.pdf', istOriginal: false, eingegangenAm: '2026-08-13',
    analyse: { miete: 690, wohnflaeche_qm: 120, unterschrift_vorhanden: false },
  });

  // Feld-Provenienz: extrahierte, noch unbestätigte Werte (Vorschläge der Extraktion)
  await setFeldStatus({ vorgangId: v.id, zielTyp: 'vorgang', zielId: v.id, feldPfad: 'wohnung.miete', quelle: 'llm', bestaetigt: false, quellDokumentId: d1.id, confidence: 0.82 });
  await setFeldStatus({ vorgangId: v.id, zielTyp: 'vorgang', zielId: v.id, feldPfad: 'wohnung.wohnflaeche_qm', quelle: 'llm', bestaetigt: false, quellDokumentId: d1.id, confidence: 0.71 });
  await setFeldStatus({ vorgangId: v.id, zielTyp: 'person', zielId: p1.id, feldPfad: 'geburtsdatum', quelle: 'llm', bestaetigt: false, quellDokumentId: d1.id, confidence: 0.9 });
  await setFeldStatus({ vorgangId: v.id, zielTyp: 'person', zielId: p2.id, feldPfad: 'einkommen', quelle: 'llm', bestaetigt: false, confidence: 0.65 });

  await pruefen(v.id);
  await generiereSchreiben(v.id, '2026-08-26');

  await addNotiz({ vorgangId: v.id, anker: 'sektion:allgemein', autor: 'Katharina Vogel', text: 'Rückruf am 20.08. angekündigt: Ausweiskopien und aktueller Kontoauszug werden nachgereicht.' });
  await addChatMessage({ vorgangId: v.id, rolle: 'user', content: 'Welche Widersprüche gibt es bei der Miete und Wohnfläche?' });
  await addChatMessage({
    vorgangId: v.id, rolle: 'assistant',
    content: 'Die Miete weicht ab: Antrag 704,00 € gegenüber Mietvertrag 690,00 € (Differenz 14 €). Zudem nennt der Antrag 63 m², der Mietvertrag jedoch 120 m². Beides ist mit der antragstellenden Person zu klären.',
  });
  await addAktivitaet({ vorgangId: v.id, typ: 'pruefung', akteur: 'System', beschreibung: 'Automatische Vollständigkeits- und Plausibilitätsprüfung durchgeführt.' });
}

/** 2) Alleinerziehend mit Kind — frisch im Posteingang, extrahiert, NOCH KEINE Prüfung. */
async function szenarioPosteingang(bilanz: Bilanz, zaehle: Zaehle): Promise<void> {
  const akte = await createDemoAkte({
    name: 'Neumann, Julia', antragstellerName: 'Julia Neumann',
    strasse: 'Lindenweg', hausnummer: '12', plz: '34117', ort: 'Kassel',
  });
  bilanz.akten += 1;

  const v = await createVorgang({
    akteId: akte.id, wohngeldart: 'mietzuschuss', antragsart: 'erstantrag', status: 'posteingang',
    sachbearbeiter: undefined, prioritaet: 'normal', antragsdatum: '2026-09-15',
    wohnung: { strasse: 'Lindenweg', hausnummer: '12', plz: '34117', ort: 'Kassel', wohnflaeche_qm: 58, miete: 620 },
  });
  zaehle(v.status);

  const mutter = await createPerson({
    vorgangId: v.id, rolle: 'antragsteller', nachname: 'Neumann', vorname: 'Julia',
    geburtsdatum: '1990-07-02', familienstand: 'ledig', erwerbsstatus: 'angestellt',
    einkommen: [einkommen('lohn_gehalt', 1850, 'Teilzeit Verwaltung')],
    erhaelt_kindergeld: true,
  });
  await createPerson({
    vorgangId: v.id, rolle: 'kind', nachname: 'Neumann', vorname: 'Leon',
    geburtsdatum: '2018-11-20', familienstand: 'ledig',
  });

  const d = await createDokument({
    vorgangId: v.id, typ: 'wohngeldantrag', titel: 'Wohngeldantrag (Mietzuschuss)',
    quelle: 'antrag_neumann.pdf', seiten: 9, istOriginal: true, eingegangenAm: '2026-09-15',
    analyse: { unterschrift_vorhanden: true, datum_vorhanden: true },
  });

  // Extrahierte, unbestätigte Felder — Posteingang wartet auf menschliche Bestätigung.
  await setFeldStatus({ vorgangId: v.id, zielTyp: 'vorgang', zielId: v.id, feldPfad: 'wohnung.miete', quelle: 'llm', bestaetigt: false, quellDokumentId: d.id, confidence: 0.88 });
  await setFeldStatus({ vorgangId: v.id, zielTyp: 'person', zielId: mutter.id, feldPfad: 'einkommen', quelle: 'llm', bestaetigt: false, quellDokumentId: d.id, confidence: 0.79 });
  // Bewusst KEINE Prüfung (repräsentiert den frischen Posteingang).
}

/** 3) Familie, angestellt, Weiterleistungsantrag — warte_auf_rueckmeldung, hoch, Frist in Zukunft.
 *     Zusätzlich: zweiter Vorgang unter DERSELBEN Akte (Akten-Mehrfachzuordnung). */
async function szenarioFamilieWarte(bilanz: Bilanz, zaehle: Zaehle): Promise<void> {
  const akte = await createDemoAkte({
    name: 'Schuster, Familie', antragstellerName: 'Andreas Schuster',
    strasse: 'Am Stadtpark', hausnummer: '7a', plz: '90402', ort: 'Nürnberg',
  });
  bilanz.akten += 1;

  const v = await createVorgang({
    akteId: akte.id, wohngeldart: 'mietzuschuss', antragsart: 'weiterleistungsantrag',
    status: 'warte_auf_rueckmeldung', sachbearbeiter: 'Thomas Berger', prioritaet: 'hoch',
    antragsdatum: '2026-08-01',
    wohnung: { strasse: 'Am Stadtpark', hausnummer: '7a', plz: '90402', ort: 'Nürnberg', wohnflaeche_qm: 92, miete: 1180 },
    bwz: bwzListe('2026-08-01'),
    frist: tage(12), wiedervorlage: tage(12),
    labels: ['Weiterleistung', 'Familie'],
    todos: [todo('Aktuelle Gehaltsabrechnungen anfordern'), todo('KV-Nachweis Ehegattin prüfen', true)],
  });
  zaehle(v.status);

  await createPerson({
    vorgangId: v.id, rolle: 'antragsteller', nachname: 'Schuster', vorname: 'Andreas',
    geburtsdatum: '1985-02-11', familienstand: 'verheiratet', erwerbsstatus: 'angestellt',
    einkommen: [einkommen('lohn_gehalt', 2900, 'Vollzeit')],
  });
  await createPerson({
    vorgangId: v.id, rolle: 'ehegatte', nachname: 'Schuster', vorname: 'Miriam',
    geburtsdatum: '1987-09-30', familienstand: 'verheiratet', erwerbsstatus: 'angestellt',
    einkommen: [einkommen('lohn_gehalt', 1400, 'Teilzeit')], erhaelt_kindergeld: true,
  });
  await createPerson({ vorgangId: v.id, rolle: 'kind', nachname: 'Schuster', vorname: 'Emma', geburtsdatum: '2014-04-18' });
  await createPerson({ vorgangId: v.id, rolle: 'kind', nachname: 'Schuster', vorname: 'Jonas', geburtsdatum: '2017-01-09' });

  await createDokument({ vorgangId: v.id, typ: 'wohngeldantrag', titel: 'Weiterleistungsantrag', quelle: 'weiter_schuster.pdf', seiten: 6, istOriginal: true, eingegangenAm: '2026-08-01', analyse: { unterschrift_vorhanden: true, datum_vorhanden: true } });
  await createDokument({ vorgangId: v.id, typ: 'mietvertrag', titel: 'Mietvertrag', quelle: 'mv_schuster.pdf', istOriginal: false, analyse: { miete: 1180, wohnflaeche_qm: 92, unterschrift_vorhanden: true } });
  await createDokument({ vorgangId: v.id, typ: 'mietbescheinigung', titel: 'Vermieterbescheinigung', quelle: 'vb_schuster.pdf', istOriginal: false, analyse: { miete: 1180, wohnflaeche_qm: 92 } });

  await pruefen(v.id);
  await generiereSchreiben(v.id, '2026-08-20');
  await addAktivitaet({ vorgangId: v.id, typ: 'schreiben', akteur: 'Thomas Berger', beschreibung: 'Anforderungsschreiben versendet (Frist ' + tage(12) + ').' });
  await updateVorgang(v.id, { status: 'warte_auf_rueckmeldung' });

  // Zweiter Vorgang unter derselben Akte (frühere Bewilligungsperiode, abgeschlossen).
  const v2 = await createVorgang({
    akteId: akte.id, wohngeldart: 'mietzuschuss', antragsart: 'erstantrag', status: 'abgeschlossen',
    sachbearbeiter: 'Thomas Berger', prioritaet: 'niedrig', antragsdatum: '2025-07-15',
    wohnung: { strasse: 'Am Stadtpark', hausnummer: '7a', plz: '90402', ort: 'Nürnberg', wohnflaeche_qm: 92, miete: 1120 },
    bwz: bwzListe('2025-07-15'),
    verfuegung: { entscheidung: 'bewilligt', bemerkung: 'Erstbewilligung Vorjahr — Bewilligungszeitraum abgelaufen.', erstelltAm: '2025-08-05' },
    labels: ['Vorjahr'],
  });
  zaehle(v2.status);
  await createPerson({ vorgangId: v2.id, rolle: 'antragsteller', nachname: 'Schuster', vorname: 'Andreas', geburtsdatum: '1985-02-11', erwerbsstatus: 'angestellt', einkommen: [einkommen('lohn_gehalt', 2750)] });
  await createDokument({ vorgangId: v2.id, typ: 'wohngeldantrag', titel: 'Erstantrag 2025', istOriginal: true, analyse: { unterschrift_vorhanden: true, datum_vorhanden: true } });
  await pruefen(v2.id);
  await alleErledigt(v2.id);
}

/** 4) Selbständige/r — überfällig: Frist & Wiedervorlage in der VERGANGENHEIT. */
async function szenarioUeberfaellig(bilanz: Bilanz, zaehle: Zaehle): Promise<void> {
  const akte = await createDemoAkte({
    name: 'Vogler, Katrin', antragstellerName: 'Katrin Vogler',
    strasse: 'Gartenstraße', hausnummer: '31', plz: '04109', ort: 'Leipzig',
  });
  bilanz.akten += 1;

  const v = await createVorgang({
    akteId: akte.id, wohngeldart: 'mietzuschuss', antragsart: 'erstantrag',
    status: 'warte_auf_rueckmeldung', sachbearbeiter: 'Petra Lindner', prioritaet: 'hoch',
    antragsdatum: '2026-06-10',
    wohnung: { strasse: 'Gartenstraße', hausnummer: '31', plz: '04109', ort: 'Leipzig', wohnflaeche_qm: 74, miete: 810 },
    frist: tage(-18), wiedervorlage: tage(-18),
    labels: ['Selbständig', 'Überfällig'],
    todos: [todo('Zweitanforderung vorbereiten')],
  });
  zaehle(v.status);

  await createPerson({
    vorgangId: v.id, rolle: 'antragsteller', nachname: 'Vogler', vorname: 'Katrin',
    geburtsdatum: '1979-12-03', familienstand: 'ledig', erwerbsstatus: 'selbststaendig',
    einkommen: [einkommen('selbststaendig', 2200, 'Grafikdesign (BWA)')],
  });

  await createDokument({ vorgangId: v.id, typ: 'wohngeldantrag', titel: 'Wohngeldantrag', istOriginal: true, eingegangenAm: '2026-06-10', analyse: { unterschrift_vorhanden: true, datum_vorhanden: true } });
  await createDokument({ vorgangId: v.id, typ: 'mietvertrag', titel: 'Mietvertrag', istOriginal: false, analyse: { miete: 810, wohnflaeche_qm: 74, unterschrift_vorhanden: true } });

  await pruefen(v.id);
  await generiereSchreiben(v.id, '2026-06-24');
  await addAktivitaet({ vorgangId: v.id, typ: 'schreiben', akteur: 'Petra Lindner', beschreibung: 'Erstanforderung versendet — Frist überschritten, Wiedervorlage fällig.' });
}

/** 5) Vermögen über Freigrenze — Ehepaar, Bankguthaben > 90.000 € (Freigrenze bei 2 Pers.). */
async function szenarioVermoegen(bilanz: Bilanz, zaehle: Zaehle): Promise<void> {
  const akte = await createDemoAkte({
    name: 'Reinhardt, Eheleute', antragstellerName: 'Werner Reinhardt',
    strasse: 'Höhenweg', hausnummer: '4', plz: '79104', ort: 'Freiburg',
  });
  bilanz.akten += 1;

  const v = await createVorgang({
    akteId: akte.id, wohngeldart: 'mietzuschuss', antragsart: 'erstantrag', status: 'sachbearbeitung',
    sachbearbeiter: 'Katharina Vogel', prioritaet: 'normal', antragsdatum: '2026-09-02',
    wohnung: { strasse: 'Höhenweg', hausnummer: '4', plz: '79104', ort: 'Freiburg', wohnflaeche_qm: 68, miete: 950 },
    labels: ['Vermögensprüfung'],
  });
  zaehle(v.status);

  await createPerson({
    vorgangId: v.id, rolle: 'antragsteller', nachname: 'Reinhardt', vorname: 'Werner',
    geburtsdatum: '1958-08-22', familienstand: 'verheiratet', erwerbsstatus: 'rente_pension',
    einkommen: [einkommen('rente', 1250, 'Altersrente')],
    vermoegenPositionen: [vermoegen('Bankguthaben', 78000), vermoegen('Wertpapiere', 19000)],
  });
  await createPerson({
    vorgangId: v.id, rolle: 'ehegatte', nachname: 'Reinhardt', vorname: 'Elke',
    geburtsdatum: '1961-03-15', familienstand: 'verheiratet', erwerbsstatus: 'rente_pension',
    einkommen: [einkommen('rente', 640, 'Altersrente')],
  });

  await createDokument({ vorgangId: v.id, typ: 'wohngeldantrag', titel: 'Wohngeldantrag', istOriginal: true, analyse: { unterschrift_vorhanden: true, datum_vorhanden: true } });
  await createDokument({ vorgangId: v.id, typ: 'mietvertrag', titel: 'Mietvertrag', istOriginal: false, analyse: { miete: 950, wohnflaeche_qm: 68, unterschrift_vorhanden: true } });

  await pruefen(v.id);
  await addNotiz({ vorgangId: v.id, anker: 'sektion:vermoegen', autor: 'Katharina Vogel', text: 'Haushaltsvermögen über Freigrenze — Vermögensnachweise und Zweckerklärung anfordern, dann Einzelfallbewertung (§ 21 Nr. 3).' });
}

/** 6) Transferleistungs-Ausschluss (§ 7) — Bürgergeld mit enthaltenen Unterkunftskosten. */
async function szenarioTransfer(bilanz: Bilanz, zaehle: Zaehle): Promise<void> {
  const akte = await createDemoAkte({
    name: 'Kaiser, Dennis', antragstellerName: 'Dennis Kaiser',
    strasse: 'Ruhrallee', hausnummer: '88', plz: '44139', ort: 'Dortmund',
  });
  bilanz.akten += 1;

  const v = await createVorgang({
    akteId: akte.id, wohngeldart: 'mietzuschuss', antragsart: 'erstantrag', status: 'sachbearbeitung',
    sachbearbeiter: 'Thomas Berger', prioritaet: 'normal', antragsdatum: '2026-09-05',
    wohnung: { strasse: 'Ruhrallee', hausnummer: '88', plz: '44139', ort: 'Dortmund', wohnflaeche_qm: 52, miete: 560 },
    labels: ['§7-Prüfung'],
  });
  zaehle(v.status);

  await createPerson({
    vorgangId: v.id, rolle: 'antragsteller', nachname: 'Kaiser', vorname: 'Dennis',
    geburtsdatum: '1992-06-27', familienstand: 'ledig', erwerbsstatus: 'arbeitslos',
    transferleistungenDetail: [transfer('Bürgergeld', true, true)],
  });

  await createDokument({ vorgangId: v.id, typ: 'wohngeldantrag', titel: 'Wohngeldantrag', istOriginal: true, analyse: { unterschrift_vorhanden: true, datum_vorhanden: true } });
  await createDokument({ vorgangId: v.id, typ: 'transferleistungsbescheid', titel: 'Bürgergeld-Bescheid', istOriginal: false, analyse: {} });

  await pruefen(v.id);
  await addNotiz({ vorgangId: v.id, anker: 'sektion:allgemein', autor: 'Thomas Berger', text: 'Bürgergeld mit KdU — möglicher Ausschluss nach § 7 WoGG. Vor weiterer Bearbeitung klären.' });
}

/** 7) Lastenzuschuss — Eigentümer, Erstantrag (andere Nachweislage). */
async function szenarioLastenzuschuss(bilanz: Bilanz, zaehle: Zaehle): Promise<void> {
  const akte = await createDemoAkte({
    name: 'Hofmann, Bernd', antragstellerName: 'Bernd Hofmann',
    strasse: 'Feldstraße', hausnummer: '19', plz: '24103', ort: 'Kiel',
  });
  bilanz.akten += 1;

  const v = await createVorgang({
    akteId: akte.id, wohngeldart: 'lastenzuschuss', antragsart: 'erstantrag', status: 'sachbearbeitung',
    sachbearbeiter: 'Petra Lindner', prioritaet: 'niedrig', antragsdatum: '2026-08-28',
    wohnung: { strasse: 'Feldstraße', hausnummer: '19', plz: '24103', ort: 'Kiel', wohnflaeche_qm: 110, weitere_angaben: 'Selbstgenutztes Eigenheim, monatliche Belastung (Zins + Tilgung) rd. 890 €.' },
    labels: ['Lastenzuschuss', 'Eigentum'],
  });
  zaehle(v.status);

  await createPerson({
    vorgangId: v.id, rolle: 'antragsteller', nachname: 'Hofmann', vorname: 'Bernd',
    geburtsdatum: '1966-10-08', familienstand: 'verwitwet', erwerbsstatus: 'angestellt',
    einkommen: [einkommen('lohn_gehalt', 2100, 'Angestellter')],
  });

  await createDokument({ vorgangId: v.id, typ: 'wohngeldantrag', titel: 'Antrag Lastenzuschuss', istOriginal: true, analyse: { unterschrift_vorhanden: true, datum_vorhanden: true } });
  await createDokument({ vorgangId: v.id, typ: 'sonstiges', titel: 'Darlehensvertrag / Belastungsnachweis (Bank)', quelle: 'darlehen_hofmann.pdf', istOriginal: false, analyse: {} });

  await pruefen(v.id);
  await addNotiz({ vorgangId: v.id, anker: 'sektion:wohnung', autor: 'Petra Lindner', text: 'Lastenzuschuss: Nachweise zu Belastung (Zins/Tilgung) und Bewirtschaftungskosten prüfen — nicht Mietvertrag.' });
}

/** 8) Abgeschlossen — vollständiger Fall, Entscheidung bewilligt, Prüfschritte erledigt. */
async function szenarioAbgeschlossen(bilanz: Bilanz, zaehle: Zaehle): Promise<void> {
  const akte = await createDemoAkte({
    name: 'Bauer, Renate', antragstellerName: 'Renate Bauer',
    strasse: 'Sonnenhalde', hausnummer: '2', plz: '70565', ort: 'Stuttgart',
  });
  bilanz.akten += 1;

  const v = await createVorgang({
    akteId: akte.id, wohngeldart: 'mietzuschuss', antragsart: 'erstantrag', status: 'entscheidung',
    sachbearbeiter: 'Katharina Vogel', prioritaet: 'normal', antragsdatum: '2026-07-04',
    wohnung: { strasse: 'Sonnenhalde', hausnummer: '2', plz: '70565', ort: 'Stuttgart', wohnflaeche_qm: 48, miete: 690, heizkosten: 60 },
    bwz: bwzListe('2026-07-04'),
    iban: 'DE44 6009 0100 0000 9876 54',
    verfuegung: { entscheidung: 'bewilligt', bemerkung: 'Vollständige Unterlagen, keine offenen Punkte. Bewilligung für 12 Monate.', erstelltAm: '2026-07-20' },
    labels: ['Abgeschlossen'],
  });
  zaehle(v.status);

  const p1 = await createPerson({
    vorgangId: v.id, rolle: 'antragsteller', nachname: 'Bauer', vorname: 'Renate',
    geburtsdatum: '1951-01-19', familienstand: 'verwitwet', erwerbsstatus: 'rente_pension',
    einkommen: [einkommen('rente', 1180, 'Altersrente')],
  });

  await createDokument({ vorgangId: v.id, typ: 'wohngeldantrag', titel: 'Wohngeldantrag', istOriginal: true, abgelegt: true, analyse: { unterschrift_vorhanden: true, datum_vorhanden: true } });
  await createDokument({ vorgangId: v.id, typ: 'mietvertrag', titel: 'Mietvertrag', istOriginal: false, abgelegt: true, analyse: { miete: 690, wohnflaeche_qm: 48, unterschrift_vorhanden: true } });
  await createDokument({ vorgangId: v.id, typ: 'mietbescheinigung', titel: 'Vermieterbescheinigung', istOriginal: false, abgelegt: true, analyse: { miete: 690, wohnflaeche_qm: 48 } });
  await createDokument({ vorgangId: v.id, personId: p1.id, typ: 'kontoauszug', titel: 'Kontoauszug (aktuell)', istOriginal: false, abgelegt: true, analyse: { mietzahlung_erkannt: true } });
  await createDokument({ vorgangId: v.id, personId: p1.id, typ: 'personalausweis', titel: 'Personalausweis', istOriginal: false, abgelegt: true, analyse: {} });
  await createDokument({ vorgangId: v.id, personId: p1.id, typ: 'kv_pv_nachweis', titel: 'KV-/PV-Nachweis', istOriginal: false, abgelegt: true, analyse: {} });
  await createDokument({ vorgangId: v.id, personId: p1.id, typ: 'rentenbescheid', titel: 'Rentenbescheid', istOriginal: false, abgelegt: true, analyse: { rentenart_vorhanden: true, grundrentenzeiten_vorhanden: true, betrag: 1180 } });

  await pruefen(v.id);
  await alleErledigt(v.id);
  // Bestätigte Feld-Provenienz (Mensch) — vollständig geprüft.
  await setFeldStatus({ vorgangId: v.id, zielTyp: 'vorgang', zielId: v.id, feldPfad: 'wohnung.miete', quelle: 'mensch', bestaetigt: true });
  await addAktivitaet({ vorgangId: v.id, typ: 'entscheidung', akteur: 'Katharina Vogel', beschreibung: 'Antrag bewilligt — Verfügung erstellt.' });
}

/** 9) Posteingang-Warteschlange — einige Beispiel-Eingänge (ohne echte Bytes). */
async function szenarioPosteingangQueue(): Promise<void> {
  // A) Frisch eingegangen (Scan), noch nicht ausgewertet.
  await createPosteingang({
    quelle: 'scan',
    eingegangenAm: tage(-1) + 'T08:15:00.000Z',
    status: 'eingegangen',
    hash: 'demo-eingang-a',
    data: { demo: true },
    dateien: [
      { dateiname: 'antrag_scan_001.pdf', contentType: 'application/pdf', groesse: 245678, hash: 'demo-a-1' },
      { dateiname: 'mietvertrag_scan.pdf', contentType: 'application/pdf', groesse: 132044, hash: 'demo-a-2' },
    ],
  });

  // B) Manuell eingegangen und bereits ausgewertet (analysiert), Match offen.
  await createPosteingang({
    quelle: 'manuell',
    eingegangenAm: tage(-2) + 'T10:42:00.000Z',
    status: 'analysiert',
    betreff: 'Wagner, Thomas — Erstantrag',
    hash: 'demo-eingang-b',
    matchVorschlag: [],
    data: { demo: true },
    dateien: [
      {
        dateiname: 'wohngeldantrag_wagner.pdf', contentType: 'application/pdf', groesse: 384210, hash: 'demo-b-1',
        typ: 'wohngeldantrag', titel: 'Wohngeldantrag (Mietzuschuss)',
        analyse: { unterschrift_vorhanden: true, datum_vorhanden: true },
        stammdaten: {
          antragsdatum: tage(-3), wohngeldart: 'mietzuschuss', antragsart: 'erstantrag',
          antragsteller: { vorname: 'Thomas', nachname: 'Wagner', geburtsdatum: '1972-04-19' },
          adresse: { strasse: 'Ahornweg', hausnummer: '8', plz: '55116', ort: 'Mainz' },
          wohnung: { miete: 745, wohnflaeche_qm: 66 },
        },
        fieldConfidences: { 'wohnung.miete': 0.86, 'wohnung.wohnflaeche_qm': 0.74 },
        extrahierterTextGekuerzt: 'Antrag auf Wohngeld (Mietzuschuss) — Thomas Wagner, Ahornweg 8, 55116 Mainz …',
      },
      {
        dateiname: 'gehaltsabrechnung_wagner.pdf', contentType: 'application/pdf', groesse: 92110, hash: 'demo-b-2',
        typ: 'gehaltsabrechnung', titel: 'Gehaltsabrechnung',
        analyse: { betrag: 2150 },
        identitaet: { vorname: 'Thomas', nachname: 'Wagner' },
        extrahierterTextGekuerzt: 'Verdienstabrechnung — Netto 2.150,00 EUR …',
      },
    ],
  });

  // C) Verworfen (Fehleinlieferung) — mit Grund.
  await createPosteingang({
    quelle: 'email',
    eingegangenAm: tage(-4) + 'T14:03:00.000Z',
    status: 'verworfen',
    betreff: 'Werbe-PDF (kein Antrag)',
    verworfenGrund: 'Kein Wohngeldbezug — Werbesendung.',
    hash: 'demo-eingang-c',
    data: { demo: true },
    dateien: [
      { dateiname: 'newsletter.pdf', contentType: 'application/pdf', groesse: 51200, hash: 'demo-c-1' },
    ],
  });
}

// ── öffentlicher Einstieg ────────────────────────────────────────────────────

/** IDs aller vorhandenen Demo-Akten (`data.demo === true`). */
async function findeDemoAkten(): Promise<string[]> {
  const akten = await listAkten();
  return akten.filter(a => (a as unknown as { demo?: boolean }).demo === true).map(a => a.id);
}

/** IDs aller vorhandenen Demo-Posteingänge (`data.demo === true`). */
async function findeDemoPosteingang(): Promise<string[]> {
  const eingaenge = await listPosteingang();
  return eingaenge.filter(p => (p.data as { demo?: boolean } | undefined)?.demo === true).map(p => p.id);
}

/**
 * Befüllt die Wohngeld-App mit Demo-Daten.
 *  - `reset` (Default false): create-if-absent — existieren bereits Demo-Akten,
 *    wird nichts angelegt (`skipped: true`).
 *  - `reset: true`: bestehende Demo-Akten löschen (cascadet) und neu anlegen.
 *
 * Managt KEINE DB-Verbindung (kein closeSql, kein process.exit) — das ist Sache
 * des Aufrufers.
 */
export async function seedWohngeldDemo(opts: { reset?: boolean } = {}): Promise<SeedWohngeldResult> {
  const reset = opts.reset ?? false;

  const bestehende = await findeDemoAkten();
  if (!reset && bestehende.length > 0) {
    return { aktenCreated: 0, vorgaengeCreated: 0, skipped: true };
  }
  if (reset && bestehende.length > 0) {
    for (const id of bestehende) await deleteAkte(id);
    for (const id of await findeDemoPosteingang()) await deletePosteingang(id);
  }

  const bilanz: Bilanz = { akten: 0, vorgaenge: 0, byStatus: {} };
  const zaehle = makeZaehler(bilanz);

  await szenarioPetermann(bilanz, zaehle);
  await szenarioPosteingang(bilanz, zaehle);
  await szenarioFamilieWarte(bilanz, zaehle);
  await szenarioUeberfaellig(bilanz, zaehle);
  await szenarioVermoegen(bilanz, zaehle);
  await szenarioTransfer(bilanz, zaehle);
  await szenarioLastenzuschuss(bilanz, zaehle);
  await szenarioAbgeschlossen(bilanz, zaehle);
  await szenarioPosteingangQueue();

  return { aktenCreated: bilanz.akten, vorgaengeCreated: bilanz.vorgaenge, skipped: false };
}
