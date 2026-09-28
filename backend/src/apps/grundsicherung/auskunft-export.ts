/**
 * Grundsicherung — Betroffenen-Auskunft (Art. 15/20 DSGVO) → DocumentData / JSON.
 *
 * Sammelt ALLE zu einer Person gespeicherten Fachdaten (Stammdaten, Rolle in der
 * Einsatzgemeinschaft, Erwerbsminderung, Schwerbehinderung, Mehrbedarf, Kranken-/
 * Pflegeversicherung, Einkommen, Vermögen, Unterhalt Kinder/Eltern) plus Kontext (Vorgang,
 * Dokumentenliste OHNE Datei-Bytes, Protokoll-Auszug). Reine Funktionen (DB-frei, testbar).
 * Muster: wohngeld/auskunft-export.ts.
 */
import type { DocumentData, DocumentSection } from '../../services/documentGenerator/types';
import { dayPart } from '../_antrag-kern/datum';
import { DOKUMENT_TYP_LABEL, type Akte, type AuditEintrag, type Dokument, type Person, type Vorgang } from './types';

const ROLLE_LABEL: Record<string, string> = {
  antragsteller: 'Antragsteller/in (Einsatzgemeinschaft)', partner: 'Partner/in (Einsatzgemeinschaft)', haushaltsangehoerig: 'Haushaltsangehörige/r',
};
const FAMILIENSTAND_LABEL: Record<string, string> = {
  ledig: 'ledig', verheiratet: 'verheiratet', getrennt_lebend: 'getrennt lebend', geschieden: 'geschieden', verwitwet: 'verwitwet',
  lebenspartnerschaft: 'eingetragene Lebenspartnerschaft', eheaehnlich: 'eheähnliche Gemeinschaft',
};
const BETREUUNG_LABEL: Record<string, string> = { keine: 'keine', betreuung: 'rechtliche Betreuung', vollmacht: 'Vollmacht' };
const KV_LABEL: Record<string, string> = { pflicht: 'pflichtversichert', familie: 'familienversichert', freiwillig: 'freiwillig versichert', privat: 'privat versichert', keine: 'nicht versichert' };
const STATUS_LABEL: Record<string, string> = {
  posteingang: 'Posteingang', sachbearbeitung: 'In Bearbeitung', warte_auf_rueckmeldung: 'Wartet auf Rückmeldung',
  entscheidung: 'Entscheidung', abgeschlossen: 'Abgeschlossen',
};
const ANTRAGSART_LABEL: Record<string, string> = { erstantrag: 'Erstantrag', weiterbewilligung: 'Weiterbewilligung', aenderung: 'Änderung' };
const ANSPRUCHSGRUND_LABEL: Record<string, string> = { alter: 'Alter', erwerbsminderung: 'Dauerhafte volle Erwerbsminderung' };
const AKTION_LABEL: Record<string, string> = {
  'vorgang.geoeffnet': 'Fall geöffnet', 'vorgang.erstellt': 'Vorgang erstellt', 'vorgang.geaendert': 'Vorgang geändert',
  'person.erstellt': 'Person angelegt', 'person.geaendert': 'Person geändert', 'person.geloescht': 'Person gelöscht',
  'dokument.hochgeladen': 'Dokument(e) hochgeladen', 'dokument.zugeordnet': 'Dokument(e) zugeordnet', 'dokument.geaendert': 'Dokument geändert',
  'dokument.geloescht': 'Dokument gelöscht', 'dokument.heruntergeladen': 'Dokument heruntergeladen', 'dokument.vorschau': 'Dokument angesehen',
  'pruefung.ausgefuehrt': 'Prüfung ausgeführt', 'schreiben.generiert': 'Schreiben erzeugt', 'schreiben.versendet': 'Schreiben versendet',
  'schreiben.exportiert': 'Schreiben exportiert', 'person.auskunft_exportiert': 'Auskunft exportiert',
  'vorrang_grunddaten.gelesen': 'Grunddaten zur Vorrangprüfung abgerufen',
};

function fmtDatum(iso?: string): string {
  const d = dayPart(iso);
  if (!d) return '—';
  const [y, m, t] = d.split('-');
  return `${t}.${m}.${y}`;
}
function fmtZeit(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${fmtDatum(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function eur(v?: number): string {
  return v == null ? '—' : v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
const janein = (v?: boolean) => (v == null ? '—' : v ? 'Ja' : 'Nein');
function personName(p: Person): string {
  return [p.vorname, p.nachname].filter(Boolean).join(' ') || 'Person';
}

export interface AuskunftInput {
  person: Person;
  vorgang: Vorgang | null;
  akte: Akte | null;
  /** Nur Dokumente dieser Person (ohne Datei-Bytes). */
  dokumente: Dokument[];
  /** Protokoll-Einträge des Vorgangs. */
  protokoll: AuditEintrag[];
}

/** Strukturierte JSON-Auskunft (Art. 20 — Datenübertragbarkeit). KEINE Datei-Bytes, keine fremden Personen. */
export function auskunftToJson(input: AuskunftInput): Record<string, unknown> {
  const { person: p, vorgang, akte, dokumente, protokoll } = input;
  return {
    erstelltAm: new Date().toISOString(),
    hinweis: 'Auskunft nach Art. 15 DSGVO über die zu dieser Person gespeicherten Daten. Enthält keine Dokumentdateien und keine Daten anderer Personen im Detail.',
    person: {
      id: p.id, rolle: p.rolle, nachname: p.nachname, vorname: p.vorname, geburtsname: p.geburtsname,
      geburtsdatum: p.geburtsdatum, geburtsort: p.geburtsort, familienstand: p.familienstand,
      staatsangehoerigkeit: p.staatsangehoerigkeit, betreuung: p.betreuung, telefon: p.telefon, email: p.email,
      erwerbsminderung: p.erwerbsminderung, schwerbehinderung: p.schwerbehinderung,
      mehrbedarf_ernaehrung: p.mehrbedarf_ernaehrung, krankenversicherung: p.krankenversicherung,
      einkommen: p.einkommen ?? [], vermoegen: p.vermoegen ?? [], unterhalt_kinder_eltern: p.unterhalt_kinder_eltern,
      bemerkung: p.bemerkung, created_at: p.created_at, updated_at: p.updated_at,
    },
    vorgang: vorgang ? {
      vorgangsnummer: vorgang.vorgangsnummer, aktenzeichen: vorgang.aktenzeichen, antragsart: vorgang.antragsart,
      anspruchsgrund: vorgang.anspruchsgrund, status: vorgang.status, antragsdatum: vorgang.antragsdatum,
      ersteingang: vorgang.ersteingang, wohnsituation: vorgang.wohnsituation, wohnung: vorgang.wohnung,
    } : null,
    akte: akte ? { name: akte.name, antragstellerName: akte.antragstellerName, strasse: akte.strasse, hausnummer: akte.hausnummer, plz: akte.plz, ort: akte.ort } : null,
    dokumente: dokumente.map((d) => ({ id: d.id, typ: d.typ, titel: d.titel, eingegangenAm: d.eingegangenAm, created_at: d.created_at })),
    protokoll: protokoll.map((e) => ({
      timestamp: e.timestamp, aktion: e.aktion, akteurName: e.akteurName, akteurRolle: e.akteurRolle,
      objektTyp: e.objektTyp, objektId: e.objektId, ergebnis: e.ergebnis, detail: e.detail,
    })),
  };
}

export function auskunftToDocument(input: AuskunftInput): DocumentData {
  const { person: p, vorgang, akte, dokumente, protokoll } = input;
  const name = personName(p);
  const metadata: Record<string, string> = {
    'Betroffene Person': name,
    'Rolle': ROLLE_LABEL[p.rolle] ?? p.rolle,
    'Erstellt am': fmtDatum(new Date().toISOString()),
  };
  if (vorgang) metadata['Vorgangsnummer'] = vorgang.vorgangsnummer;

  const s: DocumentSection[] = [];
  s.push({
    title: '', type: 'text',
    content: 'Auskunft nach Art. 15 DSGVO über die zu dieser Person im Verfahren „Grundsicherung im Alter und bei Erwerbsminderung" (SGB XII, Viertes Kapitel) gespeicherten personenbezogenen Daten. Rechtsgrundlage der Verarbeitung: öffentliche Aufgabe (Art. 6 Abs. 1 lit. e DSGVO i. V. m. SGB XII, § 67a ff. SGB X). Diese Auskunft enthält keine Dokumentdateien; auf Nachweise wird nur mit Typ und Datum verwiesen.',
  });
  s.push({
    title: 'Stammdaten', type: 'keyvalue',
    content: { items: [
      { key: 'Name', value: name },
      { key: 'Geburtsname', value: p.geburtsname || '—' },
      { key: 'Geburtsdatum', value: fmtDatum(p.geburtsdatum) },
      { key: 'Geburtsort', value: p.geburtsort || '—' },
      { key: 'Familienstand', value: p.familienstand ? (FAMILIENSTAND_LABEL[p.familienstand] ?? p.familienstand) : '—' },
      { key: 'Staatsangehörigkeit', value: p.staatsangehoerigkeit || '—' },
      { key: 'Rechtliche Vertretung', value: p.betreuung ? (BETREUUNG_LABEL[p.betreuung] ?? p.betreuung) : '—' },
      { key: 'Telefon', value: p.telefon || '—' },
      { key: 'E-Mail', value: p.email || '—' },
    ] },
  });

  const em = p.erwerbsminderung;
  if (em && Object.keys(em).length) {
    s.push({
      title: 'Erwerbsminderung (Gesundheitsdaten, Art. 9 DSGVO)', type: 'keyvalue',
      content: { items: [
        { key: 'Volle Erwerbsminderung', value: janein(em.voll) },
        { key: 'Dauerhaft', value: janein(em.dauerhaft) },
        { key: 'Befristet bis', value: fmtDatum(em.befristet_bis) },
        { key: 'Arbeitsmarktabhängig', value: janein(em.arbeitsmarktabhaengig) },
        { key: 'Feststellung Rentenversicherung', value: janein(em.feststellung_rv) },
      ] },
    });
  }
  const sb = p.schwerbehinderung;
  if ((sb && Object.keys(sb).length) || p.mehrbedarf_ernaehrung != null) {
    s.push({
      title: 'Schwerbehinderung und Mehrbedarf (Gesundheitsdaten, Art. 9 DSGVO)', type: 'keyvalue',
      content: { items: [
        { key: 'Grad der Behinderung (GdB)', value: sb?.gdb != null ? String(sb.gdb) : '—' },
        { key: 'Merkzeichen', value: sb?.merkzeichen?.length ? sb.merkzeichen.join(', ') : '—' },
        { key: 'Ausweis gültig bis', value: fmtDatum(sb?.gueltig_bis) },
        { key: 'Mehrbedarf kostenaufwändige Ernährung', value: janein(p.mehrbedarf_ernaehrung) },
      ] },
    });
  }
  const kv = p.krankenversicherung;
  if (kv && Object.keys(kv).length) {
    s.push({
      title: 'Kranken- und Pflegeversicherung', type: 'keyvalue',
      content: { items: [
        { key: 'Art', value: kv.art ? (KV_LABEL[kv.art] ?? kv.art) : '—' },
        { key: 'Kasse/Versicherung', value: kv.kasse || '—' },
        { key: 'Beitrag monatlich', value: eur(kv.beitrag) },
      ] },
    });
  }
  if (p.einkommen?.length) {
    s.push({
      title: 'Einkommen', type: 'table',
      content: { headers: ['Art', 'Betrag monatlich', 'Zahlende Stelle'], rows: p.einkommen.map((e) => [e.art || '—', eur(e.betrag_monat), e.traeger || '—']) },
    });
  }
  if (p.vermoegen !== undefined) {
    s.push(p.vermoegen.length
      ? { title: 'Vermögen', type: 'table', content: { headers: ['Art', 'Betrag', 'Schonvermögen (Vermerk)'], rows: p.vermoegen.map((v) => [v.art || '—', eur(v.betrag), v.schonvermoegen ? 'Ja' : '—']) } }
      : { title: 'Vermögen', type: 'text', content: 'Erklärung: kein Vermögen vorhanden.' });
  }
  const u = p.unterhalt_kinder_eltern;
  if (u && Object.keys(u).length) {
    s.push({
      title: 'Unterhaltspflichtige Kinder/Eltern (§ 94 Abs. 1a SGB XII)', type: 'keyvalue',
      content: { items: [
        { key: 'Angaben gemacht', value: janein(u.angegeben) },
        { key: 'Einkommen über 100.000 € möglich', value: janein(u.ueber_100k_moeglich) },
      ] },
    });
  }
  if (p.bemerkung) s.push({ title: 'Bemerkung', type: 'text', content: p.bemerkung });

  if (vorgang) {
    const adresse = [akte?.strasse && `${akte.strasse} ${akte.hausnummer ?? ''}`.trim(), [akte?.plz, akte?.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    s.push({
      title: 'Zugehöriger Vorgang', type: 'keyvalue',
      content: { items: [
        { key: 'Vorgangsnummer', value: vorgang.vorgangsnummer },
        ...(vorgang.aktenzeichen ? [{ key: 'Aktenzeichen', value: vorgang.aktenzeichen }] : []),
        { key: 'Antragsart', value: ANTRAGSART_LABEL[vorgang.antragsart] ?? vorgang.antragsart },
        { key: 'Anspruchsgrund', value: vorgang.anspruchsgrund ? (ANSPRUCHSGRUND_LABEL[vorgang.anspruchsgrund] ?? vorgang.anspruchsgrund) : '—' },
        { key: 'Status', value: STATUS_LABEL[vorgang.status] ?? vorgang.status },
        { key: 'Antragsdatum', value: fmtDatum(vorgang.antragsdatum) },
        ...(vorgang.ersteingang?.datum || vorgang.ersteingang?.stelle
          ? [{ key: 'Ersteingang', value: [fmtDatum(vorgang.ersteingang.datum), vorgang.ersteingang.stelle].filter((x) => x && x !== '—').join(', ') }]
          : []),
        ...(adresse ? [{ key: 'Anschrift', value: adresse }] : []),
      ] },
    });
  }
  s.push({
    title: `Dokumente der Person (${dokumente.length})`, type: dokumente.length ? 'table' : 'text',
    content: dokumente.length
      ? { headers: ['Typ', 'Titel', 'Eingegangen am'], rows: dokumente.map((d) => [DOKUMENT_TYP_LABEL[d.typ] ?? d.typ, d.titel || '—', fmtDatum(d.eingegangenAm || d.created_at)]) }
      : 'Keine dieser Person zugeordneten Dokumente.',
  });
  s.push({
    title: `Protokoll-Auszug (${protokoll.length})`, type: protokoll.length ? 'table' : 'text',
    content: protokoll.length
      ? { headers: ['Zeitpunkt', 'Aktion', 'Akteur', 'Detail'], rows: protokoll.map((e) => [fmtZeit(e.timestamp), AKTION_LABEL[e.aktion] ?? e.aktion, e.akteurName || '—', e.detail || '—']) }
      : 'Keine Protokolleinträge zu dieser Person/dem Vorgang.',
  });

  return { title: `Auskunft nach Art. 15 DSGVO – ${name}`, metadata, sections: s };
}
