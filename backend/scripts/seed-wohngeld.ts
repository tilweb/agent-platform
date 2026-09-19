#!/usr/bin/env bun
/**
 * Seed: Realistische, synthetische Demo-Daten für die Wohngeld-App.
 *
 * Zweck: die App live durchklickbar machen (Posteingang, Sachbearbeitung,
 * Wiedervorlage/Fristen, Akten-Browser, Verfügung, Fall-Chat, Prüfschritte,
 * Anforderungsschreiben). Alle angelegten Akten tragen den Marker
 * `data.demo === true`.
 *
 * Idempotenz: Beim Start werden zunächst ALLE bestehenden Demo-Akten gelöscht
 * (deleteAkte cascadet Vorgänge/Personen/Dokumente/Prüfschritte/Schreiben/…),
 * danach wird frisch angelegt. Mehrfach-Ausführung ist damit sauber.
 *   --keep   bestehende Demo-Akten NICHT löschen (nur zusätzlich anlegen).
 *
 * Ausführung (im backend/):
 *   cd backend && /Users/andreasbachmann/.bun/bin/bun run scripts/seed-wohngeld.ts
 *
 * Voraussetzung: dieselbe DB-Env wie die App (z. B. SCALINGO_POSTGRES in
 * backend/.env). Ohne DB-Env bricht das Skript mit einer freundlichen Meldung ab.
 *
 * WICHTIG: NICHT committen — reines Demo-/Dev-Werkzeug.
 *
 * Alle Personen/Adressen sind frei erfunden (KEINE echten Personen).
 */
import {
  createAkte, createVorgang, createPerson, createDokument, updateVorgang,
  createSchreiben, addNotiz, addChatMessage, addAktivitaet, setFeldStatus,
  getVorgangSnapshot, syncPruefschritte, listPruefschritte, updatePruefschritt,
  listAkten, deleteAkte,
} from '../src/apps/wohngeld/storage';
import { pruefeVorgang } from '../src/apps/wohngeld/checker';
import { generiereAnforderungsschreiben } from '../src/apps/wohngeld/schreiben-generator';
import { berechneBwzVorschlag } from '../src/apps/wohngeld/bwz';
import { closeSql } from '../src/db/client';
import type {
  Akte, Bewilligungszeitraum, Einkommensposition, Pruefschritt,
  TransferleistungDetail, VermoegenPosition, VorgangTodo,
} from '../src/apps/wohngeld/types';

// ── Env-Guard ────────────────────────────────────────────────────────────────
if (!process.env.SCALINGO_POSTGRES) {
  console.error(
    '\n✗ SCALINGO_POSTGRES ist nicht gesetzt.\n' +
      '  Das Seed-Skript schreibt in dieselbe Postgres-DB wie die App.\n' +
      '  Setze die Verbindung in backend/.env (SCALINGO_POSTGRES=postgres://…) und\n' +
      '  führe dann erneut aus:\n' +
      '    cd backend && /Users/andreasbachmann/.bun/bin/bun run scripts/seed-wohngeld.ts\n',
  );
  process.exit(1);
}

const KEEP = process.argv.includes('--keep');

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
  const d = new Date('2026-09-19T00:00:00Z');
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

// Bilanz-Zähler
const bilanz = { akten: 0, vorgaenge: 0, byStatus: {} as Record<string, number> };
function zaehle(status: string): void {
  bilanz.vorgaenge += 1;
  bilanz.byStatus[status] = (bilanz.byStatus[status] ?? 0) + 1;
}

// ── Reset: bestehende Demo-Akten entfernen ───────────────────────────────────

async function resetDemo(): Promise<number> {
  const akten = await listAkten();
  const demo = akten.filter(a => (a as unknown as { demo?: boolean }).demo === true);
  for (const a of demo) await deleteAkte(a.id);
  return demo.length;
}

// ── Szenarien ────────────────────────────────────────────────────────────────

/** 1) Goldfall Petermann — Rentner-Ehepaar, Mietzuschuss, Erstantrag, viele Widersprüche. */
async function szenarioPetermann(): Promise<void> {
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
async function szenarioPosteingang(): Promise<void> {
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
async function szenarioFamilieWarte(): Promise<void> {
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
async function szenarioUeberfaellig(): Promise<void> {
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
async function szenarioVermoegen(): Promise<void> {
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
async function szenarioTransfer(): Promise<void> {
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
async function szenarioLastenzuschuss(): Promise<void> {
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
async function szenarioAbgeschlossen(): Promise<void> {
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

// ── Ablauf ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n▶ Wohngeld-Demo-Seed${KEEP ? ' (--keep: kein Reset)' : ''}`);

  if (!KEEP) {
    const removed = await resetDemo();
    console.log(`  Reset: ${removed} bestehende Demo-Akte(n) gelöscht.`);
  }

  await szenarioPetermann();
  await szenarioPosteingang();
  await szenarioFamilieWarte();
  await szenarioUeberfaellig();
  await szenarioVermoegen();
  await szenarioTransfer();
  await szenarioLastenzuschuss();
  await szenarioAbgeschlossen();

  console.log('\n========== BILANZ ==========');
  console.log(`Akten:    ${bilanz.akten}`);
  console.log(`Vorgänge: ${bilanz.vorgaenge}`);
  console.log('Nach Status:');
  for (const [status, n] of Object.entries(bilanz.byStatus).sort()) {
    console.log(`  ${status.padEnd(24)} ${n}`);
  }
  console.log('\n✓ Demo-Daten angelegt. App starten und live durchklicken.');
  console.log('  Erneut ausführen ist idempotent (Demo-Akten werden vorher gelöscht).');
}

try {
  await main();
  await closeSql();
  process.exit(0);
} catch (err) {
  console.error('\n✗ Seed fehlgeschlagen:', err instanceof Error ? err.message : err);
  await closeSql();
  process.exit(1);
}
