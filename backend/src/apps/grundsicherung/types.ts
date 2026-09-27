/**
 * Grundsicherung im Alter und bei Erwerbsminderung (SGB XII, 4. Kapitel) — Domänen-Typen.
 *
 * Fachlicher Rahmen: Assistenz für die VOLLSTÄNDIGKEITS- und PLAUSIBILITÄTSPRÜFUNG
 * (Human-in-the-Loop). KEINE Berechnung von Bedarf oder Zahlbetrag (macht das Fachverfahren).
 * Regelbedarfsstufe, Schonbetrag, Altersgrenze nur als Prüfmerkmal.
 *
 * Hierarchie:  Akte → Vorgang → { Personen, Dokumente, Prüfschritte, Schreiben, Aktivitäten }
 *
 * Persistenz-Konvention (wie Wohngeld): strukturierte Identitäts-/Filterspalten +
 * `data` jsonb für den Domänenrest + `permissions` + `version` (Optimistic Locking).
 * Spec: docs/grundsicherung-app-spec-2026-09-27.md (Abschnitt Datenmodell).
 */
import type { Posteingang as KernPosteingang, PosteingangDateiBasis } from '../_antrag-kern/posteingang/typen';
import type { FeldStatus as KernFeldStatus } from '../_antrag-kern/feldstatus';

// ── gemeinsame Basis ────────────────────────────────────────────────────────

export interface Timestamped {
  created_at: string;
  updated_at: string;
}

export interface Versioned {
  version: number;
}

export interface AppPermissions {
  groups?: Array<{ groupId: string; role: 'owner' | 'editor' | 'viewer' }>;
}

// ── Aufzählungen ────────────────────────────────────────────────────────────

/** Antragsart. */
export type Antragsart = 'erstantrag' | 'weiterbewilligung' | 'aenderung';
export const ANTRAGSARTEN: readonly Antragsart[] = ['erstantrag', 'weiterbewilligung', 'aenderung'];

/** Anspruchsgrund (§ 41 Abs. 2/3 SGB XII). */
export type Anspruchsgrund = 'alter' | 'erwerbsminderung';
export const ANSPRUCHSGRUENDE: readonly Anspruchsgrund[] = ['alter', 'erwerbsminderung'];

/** Wohnsituation. `einrichtung` liegt außerhalb des Prüfumfangs (erster Wurf). */
export type Wohnsituation = 'miete' | 'untermiete' | 'eigentum' | 'bei_angehoerigen' | 'einrichtung';

/** Status eines Vorgangs (Stufen wie Wohngeld, Muster Abschnitt 2). */
export type VorgangStatus =
  | 'posteingang'
  | 'sachbearbeitung'
  | 'warte_auf_rueckmeldung'
  | 'entscheidung'
  | 'abgeschlossen';
export const VORGANG_STATUS: readonly VorgangStatus[] = [
  'posteingang', 'sachbearbeitung', 'warte_auf_rueckmeldung', 'entscheidung', 'abgeschlossen',
];

export type Prioritaet = 'niedrig' | 'normal' | 'hoch';

/** Rolle einer Person: Einsatzgemeinschaft (Antragsteller + Partner) oder Haushaltsangehörige(r). */
export type PersonRolle = 'antragsteller' | 'partner' | 'haushaltsangehoerig';
export const PERSON_ROLLEN: readonly PersonRolle[] = ['antragsteller', 'partner', 'haushaltsangehoerig'];

export type Familienstand =
  | 'ledig' | 'verheiratet' | 'getrennt_lebend' | 'geschieden' | 'verwitwet'
  | 'lebenspartnerschaft' | 'eheaehnlich';

/** Rechtliche Vertretung. */
export type Betreuung = 'keine' | 'betreuung' | 'vollmacht';

export type KrankenversicherungArt = 'pflicht' | 'familie' | 'freiwillig' | 'privat' | 'keine';

/**
 * Dokument-/Nachweis-Typ (erster Wurf). Übrige Katalog-Typen laufen als `sonstiges`.
 */
export type DokumentTyp =
  | 'grundsicherungsantrag'
  | 'personalausweis'
  | 'betreuerausweis'
  | 'rentenbescheid'
  | 'rentenanpassungsmitteilung'
  | 'em_feststellung_rv'
  | 'betriebsrente_mitteilung'
  | 'kontoauszug'
  | 'mietvertrag'
  | 'vermieterbescheinigung'
  | 'nebenkostenabrechnung'
  | 'energieabrechnung'
  | 'eigentum_nachweis'
  | 'vermoegensnachweis'
  | 'bestattungsvorsorge'
  | 'kv_pv_nachweis'
  | 'schwerbehindertenausweis'
  | 'aerztliche_bescheinigung'
  | 'wohngeldbescheid'
  | 'transferleistungsbescheid'
  | 'sonstiges';

export const DOKUMENT_TYPEN: readonly DokumentTyp[] = [
  'grundsicherungsantrag', 'personalausweis', 'betreuerausweis', 'rentenbescheid',
  'rentenanpassungsmitteilung', 'em_feststellung_rv', 'betriebsrente_mitteilung', 'kontoauszug',
  'mietvertrag', 'vermieterbescheinigung', 'nebenkostenabrechnung', 'energieabrechnung',
  'eigentum_nachweis', 'vermoegensnachweis', 'bestattungsvorsorge', 'kv_pv_nachweis',
  'schwerbehindertenausweis', 'aerztliche_bescheinigung', 'wohngeldbescheid',
  'transferleistungsbescheid', 'sonstiges',
];

export const DOKUMENT_TYP_LABEL: Record<DokumentTyp, string> = {
  grundsicherungsantrag: 'Antrag auf Grundsicherung',
  personalausweis: 'Personalausweis / Pass',
  betreuerausweis: 'Betreuerausweis / Vollmacht',
  rentenbescheid: 'Rentenbescheid',
  rentenanpassungsmitteilung: 'Rentenanpassungsmitteilung',
  em_feststellung_rv: 'Feststellung Erwerbsminderung (Rentenversicherung)',
  betriebsrente_mitteilung: 'Mitteilung Betriebsrente / Zusatzversorgung',
  kontoauszug: 'Kontoauszug',
  mietvertrag: 'Mietvertrag',
  vermieterbescheinigung: 'Vermieterbescheinigung',
  nebenkostenabrechnung: 'Nebenkostenabrechnung',
  energieabrechnung: 'Heiz-/Energiekostenabrechnung',
  eigentum_nachweis: 'Nachweis Wohneigentum / Hauslasten',
  vermoegensnachweis: 'Vermögensnachweis',
  bestattungsvorsorge: 'Bestattungsvorsorgevertrag',
  kv_pv_nachweis: 'Kranken-/Pflegeversicherungsnachweis',
  schwerbehindertenausweis: 'Schwerbehindertenausweis',
  aerztliche_bescheinigung: 'Ärztliche Bescheinigung',
  wohngeldbescheid: 'Wohngeldbescheid',
  transferleistungsbescheid: 'Bescheid über andere Sozialleistungen',
  sonstiges: 'Sonstiges',
};

/** Prüfschritt-Kategorie (Muster Abschnitt 3). */
export type PruefKategorie = 'vollstaendigkeit' | 'plausibilitaet';

/** Prüfschritt-Typ. `anforderung` = Nachforderung beim Antragsteller, `info` = Hinweis für die Sachbearbeitung. */
export type PruefTyp = 'anforderung' | 'info';

/** Prüfschritt-Status. */
export type PruefStatus = 'offen' | 'erledigt' | 'verworfen';
export const PRUEF_STATUS: readonly PruefStatus[] = ['offen', 'erledigt', 'verworfen'];

export type SchreibenArt = 'erstanforderung' | 'erinnerung' | 'zweitanforderung' | 'sonstiges';

/**
 * Ergebnis beim Abschluss eines Vorgangs (nur Vermerk, keine Bescheiderstellung).
 * Steuert die kürzere Aufbewahrungsfrist bei Ablehnung/Rücknahme.
 */
export type AbschlussErgebnis = 'bewilligt' | 'abgelehnt' | 'zurueckgenommen' | 'weitergeleitet' | 'offen';
export const ABSCHLUSS_ERGEBNISSE: readonly AbschlussErgebnis[] = ['bewilligt', 'abgelehnt', 'zurueckgenommen', 'weitergeleitet', 'offen'];

// ── Entitäten ───────────────────────────────────────────────────────────────

/** Ebene 1 — Akte (E-Akte, personen-/adressbezogen). */
export interface Akte extends Timestamped, Versioned {
  id: string;
  ownerId?: string;
  /** Anzeigename der Akte (i. d. R. „Nachname, Vorname"). */
  name: string;
  antragstellerName?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  notizen?: string;
  permissions?: AppPermissions;
}

/** Wohnung und Heizung (Kosten getrennt, keine Angemessenheitsprüfung im ersten Wurf). */
export interface Wohnung {
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  kaltmiete?: number;
  nebenkosten_kalt?: number;
  heizkosten?: number;
  warmwasser?: 'zentral' | 'dezentral';
  wohnflaeche_qm?: number;
  /** Personen in der Wohnung (Kopfteil der Wohnkosten). */
  bewohner_anzahl?: number;
  /** Pauschalmiete: Heizkosten in der Miete enthalten. */
  heizung_in_miete_enthalten?: boolean;
}

/** Bewilligungszeitraum — nur Vorschlag (12 Monate ab Monatserster des Antragsmonats, § 44 SGB XII). */
export interface Bewilligungszeitraum {
  start?: string;  // ISO (YYYY-MM-DD)
  ende?: string;   // ISO (YYYY-MM-DD)
}

/** Ersteingang bei einer anderen Stelle (§ 16 Abs. 2 SGB I) — maßgeblich für das Antragsdatum. */
export interface Ersteingang {
  datum?: string;  // ISO
  stelle?: string;
}

/** Vorheriger Leistungsbezug (z. B. Bürgergeld bis zum Rentenbeginn). */
export interface Vorbezug {
  leistung?: string;   // z. B. 'buergergeld', 'hilfe_zum_lebensunterhalt', 'wohngeld'
  traeger?: string;
  bis?: string;        // ISO
}

/** Aufgabe/Todo eines Vorgangs. */
export interface VorgangTodo {
  id: string;
  text: string;
  erledigt: boolean;
}

/** Abschluss-Vermerk (keine Bescheiderstellung — die macht das Fachverfahren). */
export interface VorgangAbschluss {
  ergebnis?: AbschlussErgebnis;
  bemerkung?: string;
  am?: string;         // ISO
}

/** Ebene 2 — Vorgang (= ein Antrag, eigene Vorgangsnummer). */
export interface Vorgang extends Timestamped, Versioned {
  id: string;
  akteId: string;
  /** Interne Vorgangsnummer der App (≠ Aktenzeichen des Fachverfahrens). */
  vorgangsnummer: string;
  antragsart: Antragsart;
  /** Bis zur Erfassung leer. */
  anspruchsgrund?: Anspruchsgrund;
  status: VorgangStatus;
  /** Anzeigename der zuständigen Sachbearbeitung. */
  sachbearbeiter?: string;
  prioritaet: Prioritaet;
  ownerId?: string;
  // ── Domänen-Details (im data-jsonb) ──
  /** Nutzer-ID der zuständigen Sachbearbeitung. */
  sachbearbeiterId?: string;
  /** Aktenzeichen des Fachverfahrens. */
  aktenzeichen?: string;
  /** Zeitpunkt des letzten Prüflaufs (ISO). Fehlt ⇒ „noch nicht geprüft". */
  geprueftAm?: string;
  antragsdatum?: string;          // ISO
  wohnsituation?: Wohnsituation;
  wohnung?: Wohnung;
  bwz?: Bewilligungszeitraum;
  ersteingang?: Ersteingang;
  vorbezug?: Vorbezug;
  /** Parallel läuft ein Wohngeldantrag (Vorrang-Hinweis). */
  wohngeld_antrag_laeuft?: boolean;
  iban?: string;
  labels?: string[];
  /** Frist des zuletzt versendeten Anforderungsschreibens (ISO). */
  frist?: string;
  /** Wiedervorlagedatum (ISO). */
  wiedervorlage?: string;
  todos?: VorgangTodo[];
  abschluss?: VorgangAbschluss;
  /** Aufbewahrungs-Enddatum (ISO). Bei Abschluss automatisch gesetzt. */
  aufbewahrungBis?: string;
  /** Legal Hold: verhindert Löschung, auch nach Fristablauf. */
  legalHold?: boolean;
  /** Verarbeitung eingeschränkt (Art. 18 DSGVO): nur noch lesend. */
  eingeschraenkt?: boolean;
  permissions?: AppPermissions;
}

/** Feststellung der Erwerbsminderung (§ 41 Abs. 3, § 45 SGB XII). */
export interface Erwerbsminderung {
  voll?: boolean;
  dauerhaft?: boolean;
  befristet_bis?: string;         // ISO
  /** „Arbeitsmarktrente" — volle EM nur wegen verschlossenem Teilzeitarbeitsmarkt. */
  arbeitsmarktabhaengig?: boolean;
  /** Feststellung durch den Rentenversicherungsträger liegt vor. */
  feststellung_rv?: boolean;
}

export interface Schwerbehinderung {
  gdb?: number;
  merkzeichen?: string[];         // z. B. ['G', 'aG']
  gueltig_bis?: string;           // ISO
}

export interface Krankenversicherung {
  art?: KrankenversicherungArt;
  kasse?: string;
  beitrag?: number;               // monatlich
}

/** Eine Einkommensposition (Zuflussprinzip, monatlich). */
export interface Einkommensposition {
  id: string;
  art: string;                    // z. B. 'altersrente', 'em_rente', 'betriebsrente', 'wohngeld', 'unterhalt'
  betrag_monat?: number;
  traeger?: string;
}

/** Eine Vermögensposition. */
export interface VermoegenPosition {
  id: string;
  art: string;                    // z. B. 'girokonto', 'sparbuch', 'lebensversicherung', 'bestattungsvorsorge'
  betrag?: number;
  /** Nach Angabe/Einschätzung geschützt (z. B. angemessene Bestattungsvorsorge) — nur Vermerk. */
  schonvermoegen?: boolean;
}

/** Angaben zu Unterhaltspflichtigen Kindern/Eltern (§ 94 Abs. 1a SGB XII) — nur Angabe erheben. */
export interface UnterhaltKinderEltern {
  angegeben?: boolean;
  /** Hinweis, dass ein Einkommen über 100.000 € möglich ist. */
  ueber_100k_moeglich?: boolean;
}

/** Person (Einsatzgemeinschaft oder Haushaltsangehörige). */
export interface Person extends Timestamped, Versioned {
  id: string;
  vorgangId: string;
  rolle: PersonRolle;
  nachname: string;
  vorname: string;
  // ── Domänen-Details (im data-jsonb) ──
  geburtsname?: string;
  geburtsdatum?: string;          // ISO
  geburtsort?: string;
  familienstand?: Familienstand;
  staatsangehoerigkeit?: string;
  betreuung?: Betreuung;
  erwerbsminderung?: Erwerbsminderung;
  schwerbehinderung?: Schwerbehinderung;
  /** Mehrbedarf für kostenaufwändige Ernährung geltend gemacht (§ 30 Abs. 5 SGB XII). */
  mehrbedarf_ernaehrung?: boolean;
  krankenversicherung?: Krankenversicherung;
  einkommen?: Einkommensposition[];
  vermoegen?: VermoegenPosition[];
  unterhalt_kinder_eltern?: UnterhaltKinderEltern;
  telefon?: string;
  email?: string;
  bemerkung?: string;
}

/** Erkannter Hinweis/Flag zu einem Dokument (z. B. „ohne Unterschrift"). */
export interface DokumentFlag {
  code: string;
  hinweis: string;
}

/**
 * Strukturierte, aus dem Dokument gelesene Werte (Grundlage der Plausibilitätsvergleiche).
 * Die konkreten Felder legt die Extraktion (G3) fest; die Regel-Engine (G2) liest sie.
 */
export type DokumentAnalyse = Record<string, unknown>;

/** Ein einzelner, aus dem Dokument gezogener Wert (Transparenz-Ansicht). */
export interface DokumentExtraktionFeld {
  gruppe?: string;
  label: string;
  wert: string;
  confidence?: number;
  seite?: number;
}

/** Transparente Zusammenfassung dessen, WAS die KI aus einem Dokument gezogen hat. */
export interface DokumentExtraktion {
  felder: DokumentExtraktionFeld[];
  modell?: string;
  stand?: string;
  erzeugtAm?: string;
}

/** Dokument / Nachweis (Eingang). `eingegangenAm` = rechtliches Eingangsdatum. */
export interface Dokument extends Timestamped, Versioned {
  id: string;
  vorgangId: string;
  personId?: string;
  typ: DokumentTyp;
  titel?: string;
  quelle?: string;                // Dateiname / Eingangskanal
  seiten?: number;
  istOriginal: boolean;
  s3Key?: string;
  pfad?: string;
  eingegangenAm?: string;
  extrahierterText?: string;
  flags?: DokumentFlag[];
  analyse?: DokumentAnalyse;
  extraktion?: DokumentExtraktion;
  /** Ins Fachverfahren abgelegt (nur Status). */
  abgelegt?: boolean;
}

/** Prüfschritt (Muster Abschnitt 3). */
export interface Pruefschritt extends Timestamped, Versioned {
  id: string;
  vorgangId: string;
  personId?: string;              // leer = fallübergreifend
  /** Stabile Regel-ID aus dem Regelkatalog (Idempotenz beim Neu-Prüfen). */
  regelId: string;
  kategorie: PruefKategorie;
  typ: PruefTyp;
  status: PruefStatus;
  titel: string;
  belegtext?: string;
  quellDokumentId?: string;
  /** true = von der Regel-Engine erzeugt, false = manuell ergänzt. */
  automatisch: boolean;
}

/** Ein Anforderungspunkt eines Schreibens mit Provenienz. */
export interface SchreibenItem {
  text: string;
  regelId?: string;
  quellDokumentId?: string;
  personId?: string;
  titel?: string;
}

/** Nachforderungsschreiben (§ 60 SGB I; Rechtsfolgenbelehrung § 66 SGB I). */
export interface Schreiben extends Timestamped, Versioned {
  id: string;
  vorgangId: string;
  art: SchreibenArt;
  betreff?: string;
  frist?: string;                 // ISO
  body?: string;
  items?: SchreibenItem[];
  exportPfad?: string;
}

/** Pflegbarer Textbaustein. */
export interface Textbaustein extends Timestamped {
  id: string;
  kategorie: string;
  titel: string;
  text: string;
}

/** Aktivität (Verlauf, append-only). */
export interface Aktivitaet {
  id: string;
  vorgangId: string;
  typ: string;
  akteur?: string;
  beschreibung?: string;
  created_at: string;
}

export type { FeldDiff, AuditEintrag } from '../_antrag-kern/audit';

// ── Posteingang (Mechanik aus dem Kern; fachliche Auswertung folgt in G3) ────

export type {
  PosteingangQuelle, PosteingangStatus, PosteingangTeilVon, PosteingangTrennung,
} from '../_antrag-kern/posteingang/typen';

/** Datei im Umschlag. Fachliche Auswertungsfelder ergänzt G3. */
export interface PosteingangDatei extends PosteingangDateiBasis<DokumentTyp> {
  titel?: string;
  analyse?: DokumentAnalyse;
  extraktion?: DokumentExtraktion;
}

export interface Posteingang extends KernPosteingang<PosteingangDatei, unknown>, Timestamped, Versioned {}

// ── Feld-Provenienz / Notizen (Kern) ────────────────────────────────────────

/** Ziel-Entität eines Feld-Status. */
export type FeldStatusZielTyp = 'vorgang' | 'person';

export type { FeldQuelle } from '../_antrag-kern/feldstatus';

export interface FeldStatus extends KernFeldStatus<FeldStatusZielTyp> {}

export type { Notiz } from '../_antrag-kern/notizen';

// ── Regel-Engine (Input/Output der reinen Prüf-Funktionen) ──────────────────

/** Aggregierter Fall-Snapshot als Input für die Regel-Engine (rein, DB-frei). */
export interface VorgangSnapshot {
  vorgang: Vorgang;
  personen: Person[];
  dokumente: Dokument[];
}

/** Ergebnis-Kandidat der Regel-Engine (vor Persistenz als Prüfschritt). */
export interface PruefBefund {
  regelId: string;
  personId?: string;
  kategorie: PruefKategorie;
  typ: PruefTyp;
  titel: string;
  belegtext: string;
  quellDokumentId?: string;
}
