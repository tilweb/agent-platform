/**
 * Vertragsauswertung (`contract-structured`) — Ergebnis-Typen.
 *
 * DP liefert je Vertragsdokument Strukturbaum, Gueltigkeit, Katalog, Klausel-
 * Inventar, Fristinformation (ohne Datumsberechnung — das macht das
 * Fristenradar), Verknuepfungsschluessel und Befunde. Spezifikation:
 * docs/vertragsextraktion-strategie-spec-2026-10-08.md
 */

import type { PdfSignatur } from './signatur';

export type SeitenRolle =
  | 'vertragstext'
  | 'deckblatt'
  | 'unterschriften'
  | 'anlage'
  | 'mandat'
  | 'muster'
  | 'vorlage'
  | 'datenblatt'
  | 'sonstiges'
  | 'leer';

export const SEITEN_ROLLEN: SeitenRolle[] = [
  'vertragstext', 'deckblatt', 'unterschriften', 'anlage', 'mandat', 'muster', 'vorlage', 'datenblatt', 'sonstiges', 'leer',
];

/** Rollen, deren Inhalt NICHT als Vertragsinhalt gilt (bleiben im Baum fuer „Ask the contract"). */
export const NICHT_BINDEND: ReadonlySet<SeitenRolle> = new Set(['muster', 'vorlage', 'datenblatt', 'mandat', 'leer']);

/** Transkription einer Seite (P2). */
export interface SeitenTranskript {
  seite: number;
  rolle: SeitenRolle;
  /** Markdown mit Auszeichnung (## Kopf, ~~gestrichen~~, [x]/[ ], {{hs: …}}, {{unterschrift: …}}, {{stempel: …}}). */
  text: string;
  /** Wiederkehrender Briefkopf/Fusszeile — NICHT Vertragsinhalt. */
  fusszeile?: string;
  /** true, wenn die Seite nicht transkribiert werden konnte. */
  fehler?: string;
}

export interface Klausel {
  /** Stabile ID: `§6`, `§6.3`, `Z7.2`, `2.5.3`, `Anl1`, `rubrum`, `praeambel`, `unterschriften`. */
  id: string;
  /** 1 = Abschnitt (§/Ziffer/Anlage), 2+ = Absatz/Unterpunkt. */
  ebene: number;
  /** Nummer, wie sie im Vertrag steht (z. B. "§ 6", "3", "2.5.3") oder implizit vergeben. */
  nummer?: string;
  /** true, wenn die Absatznummer implizit (vom Parser) vergeben wurde. */
  implizit?: boolean;
  titel?: string;
  /** Titel der umschliessenden Abschnitte, aussen → innen (inkl. eigenem Titel). */
  titelpfad: string[];
  text: string;
  seiten: [number, number];
  rolle: SeitenRolle;
  eltern?: string;
  /** Abschnitt mit Begriffsbestimmungen — wird jedem Inventar-Aufruf als Kontext mitgegeben. */
  definitionen?: boolean;
}

export type KatalogStatus = 'gefunden' | 'nicht_geregelt' | 'anlage_fehlt' | 'delegiert' | 'geerbt' | 'bedingt';

export interface KatalogWert {
  status: KatalogStatus;
  wert: unknown;
  bedingung?: string;
  verweis?: string;
  klauseln: string[];
}

export type KatalogElement =
  | 'vertragsart' | 'parteien' | 'vertragsnummern' | 'unterschriften' | 'datum_abschluss' | 'beginn' | 'laufzeit'
  | 'verlaengerung' | 'kuendigung' | 'entgelte' | 'zahlungsbedingungen' | 'preisanpassung' | 'haftung'
  | 'gewaehrleistung' | 'verfuegbarkeit_sla' | 'vertragsstrafe' | 'vertraulichkeit' | 'exklusivitaet_wettbewerb'
  | 'gerichtsstand' | 'rechtswahl' | 'schriftform' | 'widerruf' | 'anlagen';

export type Modalitaet = 'muss' | 'soll' | 'bemueht' | 'kann' | 'darf_nicht';
export type FristEinheit = 'tage' | 'werktage' | 'wochen' | 'monate' | 'jahre';

/** Fristinformation — bewusst ohne berechnetes Datum. */
export interface FristAngabe {
  dauer?: number;
  einheit?: FristEinheit;
  richtung?: 'vor' | 'nach' | 'bis' | 'innerhalb';
  bezug?: string;
  zum?: string;
  wortlaut: string;
}

export interface FristRegel extends FristAngabe {
  art: string;
  partei?: string;
  form?: string;
  klauseln: string[];
}

export type InventarTyp = 'pflicht' | 'recht' | 'frist' | 'ausschluss' | 'haftung' | 'zahlung' | 'sonstiges';

export interface InventarEintrag {
  typ: InventarTyp;
  partei: string;
  gegenueber?: string;
  inhalt: string;
  modalitaet: Modalitaet;
  ausloeser?: string;
  bedingung?: string;
  frist?: FristAngabe;
  klauseln: string[];
}

export type BefundTyp =
  | 'anlage_fehlt' | 'unterschrift_fehlt' | 'unterschrift_pruefen' | 'beilage_nicht_unterzeichnet' | 'verweis_ins_leere' | 'platzhalter' | 'widerspruch' | 'verarbeitung'
  | 'nach_signatur_geaendert' | 'signatur_beschaedigt';

export interface VertragsBefund {
  typ: BefundTyp;
  text: string;
  klauseln: string[];
}

export interface Verknuepfung {
  art: 'vertragsnummer' | 'kundennummer' | 'rahmenvertrag' | 'zusatz_zu' | 'ersetzt' | 'sonstige';
  wert: string;
  klausel?: string;
}

export interface Querverweis {
  von: string;
  text: string;
  ziel?: string;
}

export interface GueltigkeitsAngabe {
  art: 'gestrichen' | 'nicht_angekreuzt' | 'handschriftlich';
  text: string;
  klausel: string;
}

/** Schema-Version des `vertrag`-Objekts (API, docs/dp-api-vertrag-schema-2026-10-12.md). Bei inkompatiblen Aenderungen erhoehen. */
export const VERTRAG_SCHEMA_VERSION = 1;

export interface VertragsAuswertung {
  version: typeof VERTRAG_SCHEMA_VERSION;
  seiten: Array<{ seite: number; rolle: SeitenRolle }>;
  klauseln: Klausel[];
  gueltigkeit: GueltigkeitsAngabe[];
  katalog: Partial<Record<KatalogElement, KatalogWert>>;
  inventar: InventarEintrag[];
  fristen: FristRegel[];
  verknuepfungen: Verknuepfung[];
  verweise: Querverweis[];
  befunde: VertragsBefund[];
  /** Fundstellen der eigenen Profilfelder (Feld-ID → Klausel-IDs); nur belegte Felder. */
  feld_fundstellen?: Record<string, string[]>;
  /** Elektronische PDF-Signaturen (ausgelesen, Gueltigkeit NICHT geprueft); nur wenn vorhanden. */
  signaturen?: PdfSignatur[];
}

/** Volltext eines Dokuments (Basisprofil „Allgemein"; Ersatz fuer Docling/Markitdown, auch bei Scans). */
export interface Volltext {
  seiten: Array<{ seite: number; rolle: SeitenRolle; text: string; fehler?: string }>;
  gliederung: Klausel[];
  /** Elektronische PDF-Signaturen (wie `VertragsAuswertung.signaturen`); nur wenn vorhanden. */
  signaturen?: PdfSignatur[];
}
