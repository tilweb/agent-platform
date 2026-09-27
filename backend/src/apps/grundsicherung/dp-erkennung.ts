/**
 * Grundsicherung — Erkennung über das Document-Processing-Segmentprofil „Grundsicherung-Eingang".
 *
 * Ein Sammel-PDF wird vom DP seitenweise klassifiziert (Bilderkennung, auch für Scans), in
 * Abschnitte getrennt und je Abschnitt ausgelesen. Diese Datei bildet das Ergebnis auf die
 * Grundsicherungs-Begriffe ab: Dokumenttyp, DokumentAnalyse-Vertrag der Regel-Engine
 * (`types.ts`), Antrags-Stammdaten (Personen, Wohnung, Einkommen/Vermögen je Person …) und
 * Identität (Match, Personenzuordnung). NUR Profil-Weg — kein eigener Klassifikations-/Legacy-Weg.
 *
 * Die Abbildung ist rein (DB-/LLM-frei) und getestet; `ladeProfil`/`erkenneDokumente` sind die
 * dünne IO-Schicht (Profil anlegen/anheben wie Wohngeld, DP-Aufruf).
 *
 * Spec: docs/grundsicherung-app-spec-2026-09-27.md (Posteingang und Erkennung).
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ExtractionProject, ProjectField, SegmentInstance, SegmentTypeDef, TrainingExample } from '../../extraction/learning/types';
import {
  GRUNDSICHERUNG_PROFIL_ID, GRUNDSICHERUNG_PROFIL_VORLAGE_STAND, buildGrundsicherungEingangProject,
} from '../../extraction/templates/grundsicherung-eingang';
import { stableHash } from '../../extraction/learning/snapshot';
import { dayPart } from '../_antrag-kern/datum';
import { gleichePerson } from './namen';
import {
  DOKUMENT_TYPEN, DOKUMENT_TYP_LABEL, EINKOMMENS_ARTEN,
  type AntragPerson, type Anspruchsgrund, type Antragsart, type Betreuung, type DokumentAnalyse,
  type DokumentExtraktion, type DokumentExtraktionFeld, type DokumentTyp, type EingangArt,
  type ExtrahierteStammdaten, type Familienstand, type Identitaet, type KontoAbgang, type KontoEingang,
  type KrankenversicherungArt, type Rentenart, type VermoegensnachweisArt, type Wohnsituation,
} from './types';

export { GRUNDSICHERUNG_PROFIL_ID, GRUNDSICHERUNG_PROFIL_VORLAGE_STAND };

/** Abschnittstyp des Profils → Dokumenttyp (1:1; unbekannte/fremde → sonstiges). */
export function typVonAbschnitt(abschnitt: string): DokumentTyp {
  return (DOKUMENT_TYPEN as readonly string[]).includes(abschnitt) ? (abschnitt as DokumentTyp) : 'sonstiges';
}

/** Ergebnis der Abbildung EINES Abschnitts. */
export interface AbschnittErgebnis {
  typ: DokumentTyp;
  titel: string;
  analyse: DokumentAnalyse;
  stammdaten?: ExtrahierteStammdaten;
  identitaet?: Identitaet;
  /** Konfidenz je Feld-Status-Pfad (Vorgang: z. B. `wohnung.kaltmiete`; Antragsteller-Person: `nachname`). */
  confidenceByPfad?: Record<string, number>;
}

/** Ein erkannter Abschnitt (Seitenbereich) mit Abbildung und Transparenz-Übersicht. */
export interface ErkannterAbschnitt extends AbschnittErgebnis {
  abschnitt: string;
  seiteVon: number;
  seiteBis: number;
  konfidenz: number;
  text: string;
  rohwerte: Record<string, unknown>;
  extraktion: DokumentExtraktion;
}

// ── Rohwert-Helfer (rein) ───────────────────────────────────────────────────

export const zahl = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const s = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v;
    const n = Number(s.replace(/[^\d.\-]/g, ''));
    return Number.isFinite(n) && /\d/.test(s) ? n : undefined;
  }
  return undefined;
};
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined);
const wahr = (v: unknown): boolean | undefined => {
  if (typeof v === 'boolean') return v;
  const t = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (['true', 'ja', 'yes', 'x'].includes(t)) return true;
  if (['false', 'nein', 'no'].includes(t)) return false;
  return undefined;
};
/** ISO-Datum (JJJJ-MM-TT); toleriert TT.MM.JJJJ. */
export const datum = (v: unknown): string | undefined => {
  const t = text(v);
  if (!t) return undefined;
  const de = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (de) return `${de[3]}-${de[2]!.padStart(2, '0')}-${de[1]!.padStart(2, '0')}`;
  return dayPart(t) ?? undefined;
};
const rund = (n: number) => Math.round(n * 100) / 100;
const zeilen = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : []).filter((z): z is Record<string, unknown> => !!z && typeof z === 'object' && !Array.isArray(z));
/** Entfernt undefined-Werte (kompakte, vergleichbare Objekte). */
const kompakt = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const klein = (v: unknown) => (text(v) ?? '').toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

// ── Formulartexte → Vokabular der App (rein) ────────────────────────────────

export function antragsartAus(v: unknown): Antragsart | undefined {
  const t = klein(v);
  if (!t) return undefined;
  if (/weiter|folge/.test(t)) return 'weiterbewilligung';
  if (/aender/.test(t)) return 'aenderung';
  if (/erst|neu/.test(t)) return 'erstantrag';
  return undefined;
}

export function anspruchsgrundAus(v: unknown): Anspruchsgrund | undefined {
  const t = klein(v);
  if (!t) return undefined;
  if (/erwerbsminder|erwerbsgemind|erwerbsunfaehig|\bem\b/.test(t)) return 'erwerbsminderung';
  if (/alter/.test(t)) return 'alter';
  return undefined;
}

export function wohnsituationAus(v: unknown): Wohnsituation | undefined {
  const t = klein(v);
  if (!t) return undefined;
  if (/einrichtung|heim|besondere wohnform|stationaer/.test(t)) return 'einrichtung';
  if (/untermiet/.test(t)) return 'untermiete';
  if (/eigentum|eigenheim|eigenes haus|eigentuemer/.test(t)) return 'eigentum';
  if (/angehoerig|mietfrei|bei_angehoerigen|eltern|kind/.test(t)) return 'bei_angehoerigen';
  if (/miet/.test(t)) return 'miete';
  return undefined;
}

export function familienstandAus(v: unknown): Familienstand | undefined {
  const t = klein(v);
  if (!t) return undefined;
  if (/getrennt/.test(t)) return 'getrennt_lebend';
  if (/verwitwet|witwe/.test(t)) return 'verwitwet';
  if (/geschieden/.test(t)) return 'geschieden';
  if (/lebenspartnerschaft|eingetragen/.test(t)) return 'lebenspartnerschaft';
  if (/eheaehnlich|lebensgemeinschaft/.test(t)) return 'eheaehnlich';
  if (/verheiratet/.test(t)) return 'verheiratet';
  if (/ledig/.test(t)) return 'ledig';
  return undefined;
}

export function kvArtAus(v: unknown): KrankenversicherungArt | undefined {
  const t = klein(v);
  if (!t) return undefined;
  if (/nicht versichert|keine|ohne/.test(t)) return 'keine';
  if (/privat|pkv|basistarif/.test(t)) return 'privat';
  if (/famili/.test(t)) return 'familie';
  if (/freiwillig/.test(t)) return 'freiwillig';
  if (/pflicht|kvdr|rentner/.test(t)) return 'pflicht';
  return undefined;
}

export function betreuungAus(v: unknown): Betreuung | undefined {
  const t = klein(v);
  if (!t) return undefined;
  if (/vollmacht|bevollmaecht/.test(t)) return 'vollmacht';
  if (/keine|nein/.test(t)) return 'keine';
  if (/betreu/.test(t)) return 'betreuung';
  return undefined;
}

export function rentenartAus(v: unknown): Rentenart | undefined {
  const t = klein(v);
  if (!t) return undefined;
  if (/witwe|witwer|waise|hinterblieben|erziehungsrente/.test(t)) return 'hinterbliebene';
  if (/teilweise/.test(t)) return 'teilweise_em';
  if (/erwerbsminder|erwerbsgemind|erwerbsunfaehig/.test(t)) return 'volle_em';
  if (/alter/.test(t)) return 'altersrente';
  return 'sonstige';
}

/** Einkommensart (Formulartext) → Wert aus `EINKOMMENS_ARTEN`. */
export function einkommensArtAus(v: unknown): string | undefined {
  const t = klein(v);
  if (!t) return undefined;
  if (/wohngeld|lastenzuschuss/.test(t)) return 'wohngeld';
  if (/vbl|zvk|zusatzversorg/.test(t)) return 'zusatzversorgung';
  if (/betriebsrente|betriebliche|pensionskasse|werksrente/.test(t)) return 'betriebsrente';
  if (/pension|ruhegehalt|versorgungsbez/.test(t)) return 'pension';
  if (/riester|privatrente/.test(t) || (/privat/.test(t) && /rente|versicherung/.test(t))) return 'private_rente';
  if (/witwe|witwer|hinterblieben|waisen/.test(t)) return 'hinterbliebenenrente';
  if (/erwerbsminder|em-rente|em rente|erwerbsunfaehig/.test(t)) return 'em_rente';
  if (/altersrente|regelalters|rente/.test(t)) return 'altersrente';
  if (/unterhalt/.test(t)) return 'unterhalt';
  if (/minijob|geringfueg/.test(t)) return 'minijob';
  if (/lohn|gehalt|erwerb|arbeitsentgelt|nebenjob/.test(t)) return 'erwerbseinkommen';
  if (/zins|kapital|dividend/.test(t)) return 'kapitalertraege';
  if (/vermiet|mieteinnahm|untermiet/.test(t)) return 'vermietung';
  if (/selbst|gewerb|freiberuf/.test(t)) return 'selbstaendig';
  if (/werkstatt|wfbm/.test(t)) return 'wfbm_entgelt';
  if (/krankengeld/.test(t)) return 'krankengeld';
  if (/arbeitslosengeld|alg/.test(t)) return 'arbeitslosengeld';
  if (/zuwendung|geschenk|unterstuetzung/.test(t)) return 'zuwendung';
  if (/buergergeld|sozialhilfe|grundsicherung|leistung/.test(t)) return 'sozialleistung';
  return 'sonstiges';
}

/** Vermögensart (Formulartext) → Wert der Regel-Engine (`VERMOEGENS_ARTEN`) bzw. sprechender Schlüssel. */
export function vermoegensArtAus(v: unknown): string | undefined {
  const t = klein(v);
  if (!t) return undefined;
  if (/sterbegeld/.test(t)) return 'sterbegeldversicherung';
  if (/bestattung|treuhand/.test(t)) return 'bestattungsvorsorge';
  if (/riester/.test(t)) return 'riester';
  if (/kapitalversicherung/.test(t)) return 'kapitalversicherung';
  if (/lebensversicherung|rueckkauf/.test(t)) return 'lebensversicherung';
  if (/bauspar/.test(t)) return 'bausparvertrag';
  if (/depot|wertpapier|aktie|fonds/.test(t)) return 'depot';
  if (/sparbuch/.test(t)) return 'sparbuch';
  if (/tagesgeld/.test(t)) return 'tagesgeld';
  if (/festgeld/.test(t)) return 'festgeld';
  if (/sparkonto/.test(t)) return 'sparkonto';
  if (/girokonto|konto|bankguthaben/.test(t)) return 'girokonto';
  if (/kfz|auto|pkw|fahrzeug/.test(t)) return 'kfz';
  if (/eigenheim|eigentumswohnung|selbst genutzt|eigenes haus/.test(t)) return 'eigenheim';
  if (/grund|haus|immobil|wohnung/.test(t)) return 'immobilie';
  if (/bargeld/.test(t)) return 'bargeld';
  return 'sonstiges';
}

export function vermoegensnachweisArtAus(v: unknown): VermoegensnachweisArt | undefined {
  const a = vermoegensArtAus(v);
  if (!a) return undefined;
  const erlaubt: VermoegensnachweisArt[] = ['girokonto', 'sparbuch', 'tagesgeld', 'depot', 'bausparvertrag', 'lebensversicherung', 'riester'];
  if (a === 'kapitalversicherung') return 'lebensversicherung';
  return (erlaubt as string[]).includes(a) ? (a as VermoegensnachweisArt) : 'sonstiges';
}

const EINGANG_ARTEN: readonly EingangArt[] = ['rente', 'betriebsrente', 'wohngeld', 'unterhalt', 'erwerb', 'kapitalertrag', 'miete_einnahme', 'zuwendung', 'sozialleistung', 'erstattung', 'sonstige'];

/** Art eines Kontoeingangs (Profilwert, sonst aus dem Verwendungszweck abgeleitet). */
export function eingangArtAus(art: unknown, verwendungszweck?: unknown): EingangArt {
  const a = klein(art).replace(/\s+/g, '_');
  if ((EINGANG_ARTEN as readonly string[]).includes(a)) return a as EingangArt;
  const t = `${klein(art)} ${klein(verwendungszweck)}`;
  if (/vbl|zvk|betriebsrente|zusatzversorg|pensionskasse/.test(t)) return 'betriebsrente';
  if (/wohngeld/.test(t)) return 'wohngeld';
  if (/rentenversicherung|renten service|rente/.test(t)) return 'rente';
  if (/unterhalt/.test(t)) return 'unterhalt';
  if (/lohn|gehalt/.test(t)) return 'erwerb';
  if (/zins|dividend|ertrag/.test(t)) return 'kapitalertrag';
  if (/miete/.test(t)) return 'miete_einnahme';
  if (/erstatt|gutschrift|rueckzahl/.test(t)) return 'erstattung';
  if (/jobcenter|sozialamt|krankengeld|arbeitsagentur/.test(t)) return 'sozialleistung';
  return 'sonstige';
}

/** „G, aG, B" → ['G', 'aG', 'B'] (Schreibweise der Merkzeichen erhalten, Duplikate raus). */
export function merkzeichenAus(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const t = text(v);
  if (t === undefined) return undefined;
  if (/^(keine?|-|—)$/i.test(t)) return [];
  const teile = t.split(/[,;/\s]+/).map((x) => x.replace(/[^A-Za-z]/g, '')).filter(Boolean);
  return [...new Set(teile)];
}

export function zweckAus(v: unknown): 'ernaehrung' | 'em_befund' | 'sonstiges' | undefined {
  const t = klein(v);
  if (!t) return undefined;
  if (/ernaehrung|krankenkost|kostform|diaet/.test(t)) return 'ernaehrung';
  if (/em_befund|erwerb|leistungsfaehig|befund|gutacht/.test(t)) return 'em_befund';
  return 'sonstiges';
}

function warmwasserAus(v: unknown): 'zentral' | 'dezentral' | undefined {
  const t = klein(v);
  if (/dezentral|boiler|durchlauf|strom/.test(t)) return 'dezentral';
  if (/zentral|heizung/.test(t)) return 'zentral';
  return undefined;
}

function regelbedarfsstufeAus(v: unknown): 1 | 2 | 3 | undefined {
  const n = zahl(v);
  return n === 1 || n === 2 || n === 3 ? n : undefined;
}

// ── Antrag → Stammdaten + Analyse ───────────────────────────────────────────

const PARTNERSCHAFT: readonly Familienstand[] = ['verheiratet', 'lebenspartnerschaft', 'eheaehnlich'];

/**
 * Antragsdaten aus den Profil-Rohwerten: Personen (Einsatzgemeinschaft + Haushaltsangehörige) mit
 * ihren Einkommen/Vermögen/KV/Schwerbehinderung/Mehrbedarf, Wohnung, Anspruchsgrund, Verfahren.
 * Zeilen ohne Namen gehören der antragstellenden Person; Zeilen mit unbekanntem Namen werden
 * gezählt (`nichtZugeordnet`), nicht geraten.
 */
export function antragAusRohwerten(w: Record<string, unknown>): ExtrahierteStammdaten {
  const famAt = familienstandAus(w.antragsteller_familienstand);
  const anspruchsgrund = anspruchsgrundAus(w.anspruchsgrund);
  const at: AntragPerson = kompakt({
    rolle: 'antragsteller' as const,
    nachname: text(w.antragsteller_nachname), vorname: text(w.antragsteller_vorname),
    geburtsname: text(w.antragsteller_geburtsname), geburtsdatum: datum(w.antragsteller_geburtsdatum),
    familienstand: famAt, staatsangehoerigkeit: text(w.antragsteller_staatsangehoerigkeit),
    betreuung: betreuungAus(w.betreuung),
  });
  const em = kompakt({ voll: wahr(w.em_voll), dauerhaft: wahr(w.em_dauerhaft), befristet_bis: datum(w.em_befristet_bis) });
  if (Object.keys(em).length || anspruchsgrund === 'erwerbsminderung') at.erwerbsminderung = em;

  const personen: AntragPerson[] = [at];
  const partnerName = { nachname: text(w.partner_nachname), vorname: text(w.partner_vorname) };
  if (partnerName.nachname || partnerName.vorname) {
    personen.push(kompakt({
      rolle: 'partner' as const, ...partnerName, geburtsdatum: datum(w.partner_geburtsdatum),
      staatsangehoerigkeit: text(w.partner_staatsangehoerigkeit),
      familienstand: famAt && PARTNERSCHAFT.includes(famAt) ? famAt : undefined,
    }));
  }
  for (const z of zeilen(w.haushaltsangehoerige)) {
    const p = kompakt({ rolle: 'haushaltsangehoerig' as const, nachname: text(z.nachname), vorname: text(z.vorname), geburtsdatum: datum(z.geburtsdatum), verhaeltnis: text(z.verhaeltnis) });
    if (!p.nachname && !p.vorname) continue;
    if (personen.some((x) => gleichePerson(x, p))) continue;
    personen.push(p);
  }

  let nichtZugeordnet = 0;
  /** Person einer Zeile: ohne Namen → antragstellende Person; unbekannter Name → null. */
  const personFuer = (z: Record<string, unknown>): AntragPerson | null => {
    const n = { nachname: text(z.nachname), vorname: text(z.vorname) };
    if (!n.nachname && !n.vorname) return at;
    return personen.find((p) => gleichePerson(p, n)) ?? null;
  };
  const eg = personen.filter((p) => p.rolle !== 'haushaltsangehoerig');

  // Einkommen
  const hatEinkommenZeilen = zeilen(w.einkommen).length > 0;
  for (const z of zeilen(w.einkommen)) {
    const art = einkommensArtAus(z.art);
    const betrag = zahl(z.betrag_monat);
    if (!art && betrag === undefined) continue;
    const p = personFuer(z);
    if (!p) { nichtZugeordnet++; continue; }
    p.einkommen = [...(p.einkommen ?? []), kompakt({ art: art ?? 'sonstiges', betrag_monat: betrag, traeger: text(z.traeger) })];
  }
  if (wahr(w.keine_einkuenfte) === true && !hatEinkommenZeilen) for (const p of eg) p.einkommen = p.einkommen ?? [];

  // Vermögen — Abschnitt beantwortet (Zeilen oder „kein Vermögen") ⇒ jede Person der EG hat eine Erklärung.
  const vermoegenZeilen = zeilen(w.vermoegen);
  const vermoegenBeantwortet = vermoegenZeilen.length > 0 || wahr(w.kein_vermoegen) === true;
  for (const z of vermoegenZeilen) {
    const art = vermoegensArtAus(z.art);
    const betrag = zahl(z.betrag);
    if (!art && betrag === undefined) continue;
    const p = personFuer(z);
    if (!p) { nichtZugeordnet++; continue; }
    p.vermoegen = [...(p.vermoegen ?? []), kompakt({ art: art ?? 'sonstiges', betrag })];
  }
  if (vermoegenBeantwortet) for (const p of eg) p.vermoegen = p.vermoegen ?? [];

  // Kranken-/Pflegeversicherung
  for (const z of zeilen(w.krankenversicherung)) {
    const kv = kompakt({ art: kvArtAus(z.art), kasse: text(z.kasse), beitrag: zahl(z.beitrag) });
    if (!Object.keys(kv).length) continue;
    const p = personFuer(z);
    if (p) p.krankenversicherung = kv; else nichtZugeordnet++;
  }
  // Schwerbehinderung
  for (const z of zeilen(w.schwerbehinderung)) {
    const sb = kompakt({ gdb: zahl(z.gdb), merkzeichen: merkzeichenAus(z.merkzeichen), gueltig_bis: datum(z.gueltig_bis) });
    if (!Object.keys(sb).length) continue;
    const p = personFuer(z);
    if (p) p.schwerbehinderung = sb; else nichtZugeordnet++;
  }
  // Mehrbedarf kostenaufwändige Ernährung
  for (const z of zeilen(w.mehrbedarf_ernaehrung)) {
    const p = personFuer(z);
    if (p) p.mehrbedarf_ernaehrung = true; else nichtZugeordnet++;
  }
  // Unterhaltspflichtige Kinder/Eltern (§ 94 Abs. 1a SGB XII) — nur Angabe erheben.
  const angegeben = wahr(w.unterhalt_angaben_gemacht);
  const ueber100k = wahr(w.unterhalt_ueber_100k);
  if (angegeben !== undefined || ueber100k !== undefined) {
    for (const p of eg) p.unterhalt_kinder_eltern = kompakt({ angegeben: angegeben ?? true, ueber_100k_moeglich: ueber100k });
  }

  const adresse = kompakt({ strasse: text(w.strasse), hausnummer: text(w.hausnummer), plz: text(w.plz), ort: text(w.ort) });
  const wohnung = kompakt({
    kaltmiete: zahl(w.kaltmiete), nebenkosten_kalt: zahl(w.nebenkosten_kalt), heizkosten: zahl(w.heizkosten),
    warmwasser: warmwasserAus(w.warmwasser), wohnflaeche_qm: zahl(w.wohnflaeche_qm), bewohner_anzahl: zahl(w.bewohner_anzahl),
    heizung_in_miete_enthalten: wahr(w.heizung_in_miete_enthalten),
  });
  const vorbezug = kompakt({ leistung: text(w.vorbezug_leistung), bis: datum(w.vorbezug_bis) });

  return kompakt({
    antragsart: antragsartAus(w.antragsart) ?? (text(w.aktenzeichen) ? 'weiterbewilligung' as const : undefined),
    antragsdatum: datum(w.antragsdatum),
    aktenzeichen: text(w.aktenzeichen),
    anspruchsgrund,
    antragsteller: at.nachname || at.vorname ? kompakt({ nachname: at.nachname, vorname: at.vorname, geburtsdatum: at.geburtsdatum }) : undefined,
    adresse: Object.keys(adresse).length ? adresse : undefined,
    wohnsituation: wohnsituationAus(w.wohnsituation),
    wohnung: Object.keys(wohnung).length ? wohnung : undefined,
    iban: text(w.iban)?.replace(/\s+/g, '').toUpperCase(),
    vorbezug: vorbezug.leistung ? vorbezug : undefined,
    wohngeld_antrag_laeuft: wahr(w.wohngeld_antrag_laeuft),
    personen,
    nichtZugeordnet: nichtZugeordnet || undefined,
  });
}

/** Profilfeld des Antrags → Feld-Status-Pfad (Vorgang bzw. antragstellende Person). */
const ANTRAG_KONFIDENZ_PFAD: Record<string, string> = {
  antragsdatum: 'antragsdatum', antragsart: 'antragsart', anspruchsgrund: 'anspruchsgrund', aktenzeichen: 'aktenzeichen',
  wohnsituation: 'wohnsituation', iban: 'iban', wohngeld_antrag_laeuft: 'wohngeld_antrag_laeuft',
  strasse: 'wohnung.strasse', hausnummer: 'wohnung.hausnummer', plz: 'wohnung.plz', ort: 'wohnung.ort',
  kaltmiete: 'wohnung.kaltmiete', nebenkosten_kalt: 'wohnung.nebenkosten_kalt', heizkosten: 'wohnung.heizkosten',
  warmwasser: 'wohnung.warmwasser', wohnflaeche_qm: 'wohnung.wohnflaeche_qm', bewohner_anzahl: 'wohnung.bewohner_anzahl',
  heizung_in_miete_enthalten: 'wohnung.heizung_in_miete_enthalten',
  antragsteller_nachname: 'nachname', antragsteller_vorname: 'vorname', antragsteller_geburtsdatum: 'geburtsdatum',
  antragsteller_familienstand: 'familienstand', antragsteller_staatsangehoerigkeit: 'staatsangehoerigkeit',
};

// ── Abbildung je Abschnitt (rein) ───────────────────────────────────────────

function identitaetAus(w: Record<string, unknown>): Identitaet | undefined {
  const id = kompakt({ nachname: text(w.nachname), vorname: text(w.vorname), geburtsdatum: datum(w.geburtsdatum) });
  return id.nachname || id.vorname ? id : undefined;
}

/**
 * Bildet die Werte EINES Abschnitts auf den DokumentAnalyse-Vertrag ab. Konvention des Vertrags:
 * nicht erkannt = Feld weglassen (nie `false`/`0` raten). `conf`: Konfidenzen je Profilfeld.
 */
export function mappeAbschnitt(abschnitt: string, w: Record<string, unknown>, conf: Record<string, number> = {}): AbschnittErgebnis {
  const typ = typVonAbschnitt(abschnitt);
  const titel = DOKUMENT_TYP_LABEL[typ];
  const a = <T extends Record<string, unknown>>(o: T) => kompakt(o) as unknown as DokumentAnalyse;

  switch (typ) {
    case 'grundsicherungsantrag': {
      const stammdaten = antragAusRohwerten(w);
      const confidenceByPfad: Record<string, number> = {};
      for (const [feld, pfad] of Object.entries(ANTRAG_KONFIDENZ_PFAD)) if (typeof conf[feld] === 'number') confidenceByPfad[pfad] = conf[feld]!;
      return {
        typ, titel, stammdaten, identitaet: stammdaten.antragsteller, confidenceByPfad,
        analyse: a({
          unterschrift_vorhanden: wahr(w.unterschrift_vorhanden), datum_vorhanden: wahr(w.datum_vorhanden),
          regelbedarfsstufe: regelbedarfsstufeAus(w.regelbedarfsstufe), bisheriger_lebensunterhalt: text(w.bisheriger_lebensunterhalt),
        }),
      };
    }
    case 'personalausweis':
      return { typ, titel, identitaet: identitaetAus(w), analyse: a({ geburtsdatum: datum(w.geburtsdatum), nachname: text(w.nachname), vorname: text(w.vorname) }) };
    case 'rentenbescheid':
      return {
        typ, titel, identitaet: identitaetAus(w),
        analyse: a({
          rentenart: rentenartAus(w.rentenart), befristet_bis: datum(w.befristet_bis), unbefristet: wahr(w.unbefristet),
          arbeitsmarktabhaengig: wahr(w.arbeitsmarktabhaengig), zahlbetrag: zahl(w.zahlbetrag), zahlbetrag_ab: datum(w.zahlbetrag_ab),
          bescheiddatum: datum(w.bescheiddatum), geburtsdatum: datum(w.geburtsdatum), grundrentenzuschlag: wahr(w.grundrentenzuschlag),
        }),
      };
    case 'rentenanpassungsmitteilung':
      return { typ, titel, identitaet: identitaetAus(w), analyse: a({ stichtag: datum(w.stichtag), zahlbetrag_neu: zahl(w.zahlbetrag_neu), zahlbetrag_alt: zahl(w.zahlbetrag_alt) }) };
    case 'em_feststellung_rv':
      return { typ, titel, identitaet: identitaetAus(w), analyse: a({ dauerhaft_voll_erwerbsgemindert: wahr(w.dauerhaft_voll_erwerbsgemindert), datum: datum(w.datum) }) };
    case 'betriebsrente_mitteilung':
      return { typ, titel, identitaet: identitaetAus(w), analyse: a({ traeger: text(w.traeger), betrag_monat: zahl(w.betrag_monat) }) };
    case 'kontoauszug': {
      const eingaenge: KontoEingang[] = zeilen(w.eingaenge).map((z) => kompakt({
        betrag: zahl(z.betrag), verwendungszweck: text(z.verwendungszweck), art: eingangArtAus(z.art, z.verwendungszweck),
        wiederkehrend: wahr(z.wiederkehrend), anzahl: zahl(z.anzahl),
      })).filter((e) => e.betrag !== undefined || e.verwendungszweck);
      const abgaenge: KontoAbgang[] = zeilen(w.grosse_abgaenge).flatMap((z) => {
        const betrag = zahl(z.betrag);
        return betrag === undefined ? [] : [kompakt({ betrag: Math.abs(betrag), datum: datum(z.datum), verwendungszweck: text(z.verwendungszweck) })];
      });
      return {
        typ, titel, identitaet: identitaetAus(w),
        analyse: a({
          iban: text(w.iban)?.replace(/\s+/g, '').toUpperCase(), zeitraum_von: datum(w.zeitraum_von), zeitraum_bis: datum(w.zeitraum_bis),
          endsaldo: zahl(w.endsaldo), eingaenge: eingaenge.length ? eingaenge : undefined,
          mietzahlung_erkannt: wahr(w.mietzahlung_erkannt), mietzahlung_betrag: zahl(w.mietzahlung_betrag),
          grosse_abgaenge: abgaenge.length ? abgaenge : undefined,
        }),
      };
    }
    case 'mietvertrag': {
      const mieter = zeilen(w.mieter).map((z) => [text(z.vorname), text(z.nachname)].filter(Boolean).join(' ')).filter(Boolean);
      return {
        typ, titel,
        analyse: a({
          mieter: mieter.length ? mieter : undefined, beginn: datum(w.beginn), grundmiete: zahl(w.grundmiete),
          nebenkosten_kalt: zahl(w.nebenkosten_kalt), heizkosten: zahl(w.heizkosten), pauschalmiete: zahl(w.pauschalmiete),
          heizkosten_enthalten: wahr(w.heizkosten_enthalten), unterschrift_vorhanden: wahr(w.unterschrift_vorhanden),
        }),
      };
    }
    case 'vermieterbescheinigung':
      return { typ, titel, analyse: a({ grundmiete: zahl(w.grundmiete), nebenkosten_kalt: zahl(w.nebenkosten_kalt), heizkosten: zahl(w.heizkosten), gueltig_ab: datum(w.gueltig_ab) }) };
    case 'nebenkostenabrechnung':
      return { typ, titel, analyse: a({ heizkosten_enthalten: wahr(w.heizkosten_enthalten), abrechnungszeitraum_bis: datum(w.abrechnungszeitraum_bis) }) };
    case 'vermoegensnachweis':
      return {
        typ, titel, identitaet: identitaetAus(w),
        analyse: a({ art: vermoegensnachweisArtAus(w.art), stand: zahl(w.stand), stichtag: datum(w.stichtag), rueckkaufswert: zahl(w.rueckkaufswert) }),
      };
    case 'schwerbehindertenausweis':
      return { typ, titel, identitaet: identitaetAus(w), analyse: a({ gdb: zahl(w.gdb), merkzeichen: merkzeichenAus(w.merkzeichen), gueltig_bis: datum(w.gueltig_bis) }) };
    case 'aerztliche_bescheinigung':
      return { typ, titel, identitaet: identitaetAus(w), analyse: a({ zweck: zweckAus(w.zweck), datum: datum(w.datum) }) };
    case 'wohngeldbescheid':
      return {
        typ, titel, identitaet: identitaetAus(w),
        analyse: a({ betrag_monat: zahl(w.betrag_monat), bwz_von: datum(w.bwz_von), bwz_bis: datum(w.bwz_bis), bescheiddatum: datum(w.bescheiddatum) }),
      };
    case 'betreuerausweis':
    case 'bestattungsvorsorge':
    case 'kv_pv_nachweis':
      return { typ, titel, identitaet: identitaetAus(w), analyse: a({ art: text(w.art) }) };
    case 'transferleistungsbescheid':
      return { typ, titel, identitaet: identitaetAus(w), analyse: a({ art: text(w.leistung) }) };
    case 'energieabrechnung':
    case 'eigentum_nachweis':
      return { typ, titel, analyse: a({ art: text(w.art) }) };
    default:
      return { typ: 'sonstiges', titel: DOKUMENT_TYP_LABEL.sonstiges, analyse: {} };
  }
}

// ── Transparenz: gelesene Werte je Abschnitt ────────────────────────────────

function fmtWert(f: { type: string; label: string }, v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein';
  if (f.type === 'date') {
    const d = datum(v);
    if (d) { const [y, m, t] = d.split('-'); return `${t}.${m}.${y}`; }
  }
  if (f.type === 'number') {
    const n = zahl(v);
    if (n === undefined) return String(v);
    return /EUR/.test(f.label) ? `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : n.toLocaleString('de-DE');
  }
  return String(v);
}

/**
 * Transparente Übersicht dessen, was aus einem Abschnitt gelesen wurde (Profilfelder mit Wert,
 * Listen je Zeile). Ohne `erzeugtAm` (setzt der Aufrufer) — deterministisch.
 */
export function baueExtraktion(def: SegmentTypeDef | undefined, werte: Record<string, unknown>, conf: Record<string, number> = {}): DokumentExtraktion {
  const felder: DokumentExtraktionFeld[] = [];
  const gruppe = def?.label ?? 'Dokument';
  for (const [key, f] of Object.entries(def?.fields ?? {}) as Array<[string, ProjectField]>) {
    const v = werte[key];
    if (f.type === 'list') {
      zeilen(v).forEach((z, i) => {
        const teile = Object.entries(f.item_fields ?? {}).map(([k, sf]) => fmtWert(sf, z[k])).filter(Boolean);
        if (teile.length) felder.push({ gruppe: f.label, label: `${i + 1}.`, wert: teile.join(', ') });
      });
      continue;
    }
    const wert = fmtWert(f, v);
    if (wert === undefined) continue;
    felder.push({ gruppe, label: f.label, wert, ...(typeof conf[key] === 'number' ? { confidence: conf[key] } : {}) });
  }
  return { felder, modell: `Profil „Grundsicherung-Eingang"`, stand: GRUNDSICHERUNG_PROFIL_VORLAGE_STAND };
}

// ── DP-Segmentergebnis → Abschnitte (rein) ──────────────────────────────────

/** Ergebnis des DP-Aufrufs (Ausschnitt von `extract()`). */
export interface ProfilErgebnis {
  segments?: SegmentInstance[];
  data: Record<string, unknown>;
  fieldConfidences?: Record<string, number>;
  segmentContexts?: Record<string, string>;
}

/** Zerlegt ein DP-Segmentergebnis in Abschnitte (nach Seiten sortiert); Leerseiten fallen weg. */
export function abschnitteAusErgebnis(r: ProfilErgebnis, profil: ExtractionProject): ErkannterAbschnitt[] {
  const defs = profil.segments ?? {};
  const out: ErkannterAbschnitt[] = [];
  for (const seg of [...(r.segments ?? [])].sort((a, b) => a.pageFrom - b.pageFrom)) {
    if (seg.type === 'leerseite') continue;
    const def = defs[seg.type];
    const key = def?.repeatable ? `${seg.type}[${seg.instance}]` : seg.type;
    const rohAlle = r.data[seg.type];
    const roh = (def?.repeatable ? (Array.isArray(rohAlle) ? rohAlle[seg.instance - 1] : undefined) : rohAlle) as Record<string, unknown> | undefined;
    const werte = { ...(roh ?? {}) };
    delete werte._beleg;
    const conf: Record<string, number> = {};
    for (const [pfad, v] of Object.entries(r.fieldConfidences ?? {})) if (pfad.startsWith(`${key}.`)) conf[pfad.slice(key.length + 1)] = v;
    const abschnitt = def ? seg.type : 'sonstiges';
    const e = mappeAbschnitt(abschnitt, werte, conf);
    out.push({
      ...e,
      titel: seg.type === 'unbekannt' ? 'Nicht erkanntes Dokument' : e.titel,
      extraktion: baueExtraktion(def, werte, conf),
      abschnitt: seg.type, seiteVon: seg.pageFrom, seiteBis: seg.pageTo, konfidenz: seg.confidence,
      text: r.segmentContexts?.[key] ?? '',
      rohwerte: werte,
    });
  }
  return out;
}

// ── Profil laden / anlegen / anheben (IO) ───────────────────────────────────

/** Fingerabdruck der pflegbaren Profilteile — erkennt, ob ein Profil in der Oberfläche bearbeitet wurde. */
export function vorlagenHash(p: Pick<ExtractionProject, 'segments' | 'instructions' | 'extraction' | 'fields'>): string {
  return stableHash([p.segments ?? null, p.instructions ?? null, p.extraction ?? null, p.fields ?? null]).slice(0, 16);
}

interface VorlagenMarke { stand: string; hash: string }

/** Beispiele für die Auswertung: ohne Testbestand und ohne gespeicherte Originaldateien. */
export function fuerAuswertung(beispiele: TrainingExample[]): TrainingExample[] {
  return beispiele
    .filter((b) => b.dataset?.purpose !== 'test')
    .map((b) => (b.dataset?.original ? { ...b, dataset: { ...b.dataset, original: undefined } } : b));
}

export type GeladenesProfil = { profil: ExtractionProject; beispiele: TrainingExample[]; quelle: 'datenbank' | 'vorlage' };

/**
 * Lädt das Profil aus der DP-Datenbank (UI-gepflegter Stand) und legt es beim ersten Gebrauch aus
 * der Vorlage an. Nie bearbeitete Profile werden auf neue Vorlagenstände angehoben (Fingerabdruck
 * in `learning.grundsicherung_vorlage`); gepflegte bleiben unangetastet. Ohne erreichbare
 * Datenbank läuft die Vorlage im Speicher.
 */
export async function ladeProfil(): Promise<GeladenesProfil> {
  try {
    const { getProject, createProject, updateProject, mutateProject } = await import('../../extraction/learning/projects');
    const { getExtractionExamples } = await import('../../extraction/learning/examples');
    const vorlage = buildGrundsicherungEingangProject();
    const marke: VorlagenMarke = { stand: GRUNDSICHERUNG_PROFIL_VORLAGE_STAND, hash: vorlagenHash(vorlage) };
    const markieren = () => mutateProject(GRUNDSICHERUNG_PROFIL_ID, (p) => ({ learning: { ...p.learning, grundsicherung_vorlage: marke } as ExtractionProject['learning'] }));

    let profil = await getProject(GRUNDSICHERUNG_PROFIL_ID);
    if (!profil) {
      await createProject({ name: vorlage.name, description: vorlage.description, fields: vorlage.fields, instructions: vorlage.instructions, extraction: vorlage.extraction, segments: vorlage.segments });
      await markieren();
      profil = await getProject(GRUNDSICHERUNG_PROFIL_ID);
      console.log('[grundsicherung] Document-Processing-Profil „Grundsicherung-Eingang" aus Vorlage angelegt');
    } else {
      const bisher = (profil.learning as unknown as { grundsicherung_vorlage?: VorlagenMarke }).grundsicherung_vorlage;
      if (bisher?.stand !== marke.stand || bisher.hash !== marke.hash) {
        const unbearbeitet = !!bisher && vorlagenHash(profil) === bisher.hash;
        if (unbearbeitet) {
          await updateProject(GRUNDSICHERUNG_PROFIL_ID, { description: vorlage.description, instructions: vorlage.instructions, extraction: vorlage.extraction, segments: vorlage.segments, fields: vorlage.fields });
          await markieren();
          profil = await getProject(GRUNDSICHERUNG_PROFIL_ID) ?? profil;
          console.log(`[grundsicherung] DP-Profil auf Vorlage ${GRUNDSICHERUNG_PROFIL_VORLAGE_STAND} angehoben`);
        } else {
          console.warn(`[grundsicherung] DP-Profil „Grundsicherung-Eingang" ist gepflegt (oder ohne Vorlagen-Marke) — Vorlage ${GRUNDSICHERUNG_PROFIL_VORLAGE_STAND} bitte bei Bedarf in der Document-Processing-Oberfläche übernehmen.`);
        }
      }
    }
    if (profil) return { profil, beispiele: fuerAuswertung(await getExtractionExamples(GRUNDSICHERUNG_PROFIL_ID)), quelle: 'datenbank' };
  } catch (err) {
    console.warn('[grundsicherung] DP-Profil nicht aus der Datenbank ladbar — Vorlage im Speicher:', err instanceof Error ? err.message : err);
  }
  return { profil: buildGrundsicherungEingangProject(), beispiele: [], quelle: 'vorlage' };
}

/** Ergebnis einer Profil-Erkennung über eine Datei. */
export interface ProfilLauf {
  abschnitte: ErkannterAbschnitt[];
  seiten: number;
  quelle: 'datenbank' | 'vorlage';
  profilHash?: string;
  hinweise: string[];
}

/**
 * Erkennt alle Dokumente einer Datei (PDF oder Bild) über das Segmentprofil. Wirft bei
 * Verarbeitungsfehlern (der Aufrufer markiert die Datei dann als fehlerhaft ausgewertet).
 */
export async function erkenneDokumente(
  bytes: Uint8Array,
  opts: { filename?: string; userId?: string; profil?: GeladenesProfil } = {},
): Promise<ProfilLauf> {
  const { extract, captureSnapshot } = await import('../../extraction/learning/service');
  const geladen = opts.profil ?? await ladeProfil();
  const snapshot = await captureSnapshot(geladen.profil, geladen.beispiele);
  const dir = await mkdtemp(join(tmpdir(), 'gs-dp-'));
  try {
    const endung = (opts.filename?.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? 'pdf').toLowerCase();
    const dateiname = opts.filename ?? `eingang.${endung}`;
    const pfad = join(dir, `eingang.${endung}`);
    await writeFile(pfad, bytes);
    const r = await extract(GRUNDSICHERUNG_PROFIL_ID, { type: 'file', path: pfad, filename: dateiname }, opts.userId, snapshot);
    if (!r.success) throw new Error(r.error ?? 'Document Processing lieferte kein Ergebnis');
    const abschnitte = abschnitteAusErgebnis(r, geladen.profil);
    const seiten = (r.pageImages?.length ?? 0) || Math.max(0, ...abschnitte.map((a) => a.seiteBis));
    const hinweise = (r.validations ?? []).filter((v) => v.rule_id === 'segmentierung').map((v) => v.message);
    return { abschnitte, seiten, quelle: geladen.quelle, profilHash: r.audit?.profile_hash, hinweise };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Einkommensarten, die die Regel-Engine kennt (alle Gruppen, flach) — für Tests/Validierung. */
export const BEKANNTE_EINKOMMENS_ARTEN: ReadonlySet<string> = new Set(Object.values(EINKOMMENS_ARTEN).flat());
