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
import type { ScoredKandidat } from './matching';

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

// ── DokumentAnalyse-Vertrag (Regel-Engine G2 ↔ Extraktion G3) ───────────────
//
// Die Regel-Engine (`checker/`) liest AUSSCHLIESSLICH die unten je Dokumenttyp beschriebenen
// Felder. Die Extraktion (Welle G3) bildet ihre Ergebnisse exakt auf diese Felder ab.
//
// Konventionen:
// - Alle Felder sind optional. „Nicht erkannt" = Feld weglassen (NICHT `false`/`0` setzen):
//   `false` bedeutet „geprüft und nicht vorhanden" und löst Befunde aus, fehlend löst keine aus.
// - Datumsangaben als ISO-Datum `YYYY-MM-DD`, Beträge in Euro als Zahl (Punkt als Dezimaltrenner),
//   Monatsbeträge sind Zahlbeträge (netto, nach Abzug KV/PV bei Renten).
// - Personenbezug läuft über `Dokument.personId` (Zuordnung in G3), nicht über Felder hier.
// - Typen ohne eigenen Eintrag (Betreuerausweis, Energieabrechnung, Transferleistungsbescheid,
//   Sonstiges) werden von den Regeln nur über ihr VORHANDENSEIN ausgewertet.
// Fachgrundlage: docs/grundsicherung-regelkatalog-2026-09-27.md Abschnitt 6.

/** Antrag auf Grundsicherung (Erst-/Weiterbewilligungsantrag). */
export interface AntragAnalyse {
  /** Antrag unterschrieben (Antragsteller:in bzw. Vertretung). → antrag-vollstaendig-unterschrieben */
  unterschrift_vorhanden?: boolean;
  /** Datum bei der Unterschrift vorhanden. → plausi-antrag-ohne-datum */
  datum_vorhanden?: boolean;
  /** Im Antrag angegebene/übernommene Regelbedarfsstufe. → plausi-regelbedarfsstufe-inkonsistent */
  regelbedarfsstufe?: 1 | 2 | 3;
  /** Freitext „wovon wurde der Lebensunterhalt bisher bestritten". Vorhanden → kein-einkommen-erklaerung erfüllt. */
  bisheriger_lebensunterhalt?: string;
}

/** Personalausweis / Reisepass. */
export interface AusweisAnalyse {
  /** → plausi-geburtsdatum-abweichung, Altersgrenze */
  geburtsdatum?: string;
  nachname?: string;
  vorname?: string;
}

/** Rentenart laut Rentenbescheid. */
export type Rentenart = 'altersrente' | 'volle_em' | 'teilweise_em' | 'hinterbliebene' | 'sonstige';

/** Rentenbescheid der gesetzlichen Rentenversicherung. */
export interface RentenbescheidAnalyse {
  /** → plausi-em-rente-*, em-feststellung-rv */
  rentenart?: Rentenart;
  /** Befristung („Rente auf Zeit") bis. Gesetzt ⇒ befristet. → plausi-em-rente-befristet */
  befristet_bis?: string;
  /** Ausdrücklich unbefristet (`true`) bzw. ausdrücklich befristet ohne erkanntes Datum (`false`). */
  unbefristet?: boolean;
  /** Volle EM-Rente nur wegen verschlossenem Teilzeitarbeitsmarkt („Arbeitsmarktrente"). */
  arbeitsmarktabhaengig?: boolean;
  /** Monatlicher Zahlbetrag. → plausi-rente-abweichung, plausi-rentenanpassung-fehlt */
  zahlbetrag?: number;
  /** Ab wann der Zahlbetrag gilt. Liegt er am/nach dem Anpassungsstichtag, gilt der Bescheid als aktuell. */
  zahlbetrag_ab?: string;
  /** Datum des Bescheids. → rentenanpassungsmitteilung */
  bescheiddatum?: string;
  /** Im Bescheid genanntes Geburtsdatum. → plausi-geburtsdatum-abweichung */
  geburtsdatum?: string;
  /** Grundrentenzuschlag ausgewiesen (vorgesehen für spätere Regel plausi-grundrente-*; im ersten Wurf ungenutzt). */
  grundrentenzuschlag?: boolean;
}

/** Rentenanpassungsmitteilung. */
export interface RentenanpassungAnalyse {
  /** Anpassungsstichtag, z. B. 2026-07-01. → rentenanpassungsmitteilung */
  stichtag?: string;
  /** Neuer monatlicher Zahlbetrag ab Stichtag. → plausi-rente-abweichung */
  zahlbetrag_neu?: number;
  zahlbetrag_alt?: number;
}

/** Feststellung des RV-Trägers zur Erwerbsminderung (Ersuchen § 45 SGB XII / § 109a SGB VI). */
export interface EmFeststellungAnalyse {
  /** Ergebnis: dauerhaft voll erwerbsgemindert ja/nein. → em-feststellung-rv, vorrang-sgb2-statt-sgb12 */
  dauerhaft_voll_erwerbsgemindert?: boolean;
  datum?: string;
}

/** Leistungsmitteilung Betriebsrente / Zusatzversorgung / Pension / private Rente. */
export interface BetriebsrenteAnalyse {
  traeger?: string;
  betrag_monat?: number;
}

/** Art eines (gruppierten) Zahlungseingangs auf dem Kontoauszug. */
export type EingangArt =
  | 'rente' | 'betriebsrente' | 'wohngeld' | 'unterhalt' | 'erwerb' | 'kapitalertrag'
  | 'miete_einnahme' | 'zuwendung' | 'sozialleistung' | 'erstattung' | 'sonstige';

/** Gleichartige Eingänge eines Kontoauszugs, zusammengefasst (z. B. „3 × VBL à 112,00 €"). */
export interface KontoEingang {
  /** Einzelbetrag je Buchung. */
  betrag?: number;
  /** Auftraggeber/Verwendungszweck, wie auf dem Auszug (z. B. „VBL"). */
  verwendungszweck?: string;
  art?: EingangArt;
  /** Regelmäßig wiederkehrend (mindestens zweimal im Zeitraum oder als Dauerzahlung erkennbar). */
  wiederkehrend?: boolean;
  /** Anzahl Buchungen im Auszugszeitraum. */
  anzahl?: number;
}

/** Größere Abbuchung/Barabhebung ohne erkennbaren Zweck. Die Schwelle filtert der Checker. */
export interface KontoAbgang {
  betrag: number;
  datum?: string;
  verwendungszweck?: string;
}

/** Kontoauszug (Giro, Spar, Tagesgeld, Online). */
export interface KontoauszugAnalyse {
  iban?: string;
  /** Zeitraum des Auszugs. → kontoauszuege (Abdeckung in Monaten) */
  zeitraum_von?: string;
  zeitraum_bis?: string;
  /** Kontostand am Ende des Zeitraums. → plausi-kontostand-abweichung, plausi-vermoegen-ueber-schonbetrag */
  endsaldo?: number;
  /** → plausi-kontoauszug-unerklaerte-eingaenge, plausi-rente-abweichung, plausi-wohngeld-als-einkommen, betriebsrente-nachweis */
  eingaenge?: KontoEingang[];
  /** Mietzahlung erkennbar (`false` = Auszug geprüft, keine Miete gefunden). → plausi-miete-nicht-gezahlt */
  mietzahlung_erkannt?: boolean;
  /** Betrag der erkannten Mietzahlung. → plausi-miete-abweichung */
  mietzahlung_betrag?: number;
  /** → plausi-grosse-abgaenge */
  grosse_abgaenge?: KontoAbgang[];
}

/** Mietvertrag / Untermietvertrag. */
export interface MietvertragAnalyse {
  /** Namen aller Mieter:innen („Vorname Nachname"). → plausi-partner-fehlt */
  mieter?: string[];
  /** Mietbeginn. → mietbescheinigung-aktuell, nebenkostenabrechnung */
  beginn?: string;
  /** Grundmiete (Kaltmiete). → plausi-miete-abweichung */
  grundmiete?: number;
  /** Vorauszahlung kalte Nebenkosten. */
  nebenkosten_kalt?: number;
  /** Vorauszahlung Heizkosten. */
  heizkosten?: number;
  /** Pauschal-/Inklusivmiete ohne Aufschlüsselung (Gesamtbetrag). → plausi-heizung-in-miete-unklar */
  pauschalmiete?: number;
  /** Heizkosten sind in der Miete enthalten (ohne eigenen Betrag). */
  heizkosten_enthalten?: boolean;
  /** Von beiden Seiten unterschrieben. → mietvertrag */
  unterschrift_vorhanden?: boolean;
}

/** Vermieterbescheinigung / Mietbescheinigung / Mieterhöhung. */
export interface VermieterbescheinigungAnalyse {
  grundmiete?: number;
  nebenkosten_kalt?: number;
  heizkosten?: number;
  gueltig_ab?: string;
}

/** Betriebs-/Heizkostenabrechnung des Vermieters. */
export interface NebenkostenabrechnungAnalyse {
  /** Heizkostenanteil in der Abrechnung ausgewiesen. → heizkosten-nachweis */
  heizkosten_enthalten?: boolean;
  abrechnungszeitraum_bis?: string;
}

/** Vermögensart eines Vermögensnachweises. */
export type VermoegensnachweisArt =
  | 'girokonto' | 'sparbuch' | 'tagesgeld' | 'depot' | 'bausparvertrag' | 'lebensversicherung' | 'riester' | 'sonstiges';

/** Sparbuch, Depotauszug, Bausparvertrag, Rückkaufswert-Bescheinigung, Riester-Bescheinigung. */
export interface VermoegensnachweisAnalyse {
  art?: VermoegensnachweisArt;
  /** Stand/Guthaben bzw. Kurswert. → plausi-vermoegen-ueber-schonbetrag */
  stand?: number;
  stichtag?: string;
  /** Rückkaufswert (Lebens-/Kapitalversicherung). → lebensversicherung-rueckkaufswert */
  rueckkaufswert?: number;
}

/** Schwerbehindertenausweis / Feststellungsbescheid. */
export interface SchwerbehindertenausweisAnalyse {
  gdb?: number;
  /** z. B. ['G'], ['G', 'aG', 'B']. → schwerbehindertenausweis-g, plausi-merkzeichen-g-nicht-beantragt */
  merkzeichen?: string[];
  /** Gültig bis; unbefristete Ausweise ohne Feld. → plausi-ausweis-abgelaufen */
  gueltig_bis?: string;
}

/** Ärztliche Bescheinigung. */
export interface AerztlicheBescheinigungAnalyse {
  /** Wofür die Bescheinigung ausgestellt ist. `em_befund` erfüllt NICHT den Ernährungsnachweis. */
  zweck?: 'ernaehrung' | 'em_befund' | 'sonstiges';
  datum?: string;
}

/** Wohngeld-/Lastenzuschussbescheid. */
export interface WohngeldbescheidAnalyse {
  betrag_monat?: number;
  /** Bewilligungszeitraum. → vorrang-wohngeldbescheid-liegt-vor (Überschneidung mit dem Antragsmonat) */
  bwz_von?: string;
  bwz_bis?: string;
  bescheiddatum?: string;
}

/** Nachweise für Kranken-/Pflegeversicherung, Eigentum, Bestattungsvorsorge: Vorhandensein genügt. */
export interface VorhandenseinAnalyse {
  /** Freie Kurzbeschreibung (nur Anzeige, von keiner Regel gelesen). */
  art?: string;
}

/** Zuordnung Dokumenttyp → Analyse-Felder (der Vertrag, den G3 bedient). */
export interface DokumentAnalyseJeTyp {
  grundsicherungsantrag: AntragAnalyse;
  personalausweis: AusweisAnalyse;
  betreuerausweis: VorhandenseinAnalyse;
  rentenbescheid: RentenbescheidAnalyse;
  rentenanpassungsmitteilung: RentenanpassungAnalyse;
  em_feststellung_rv: EmFeststellungAnalyse;
  betriebsrente_mitteilung: BetriebsrenteAnalyse;
  kontoauszug: KontoauszugAnalyse;
  mietvertrag: MietvertragAnalyse;
  vermieterbescheinigung: VermieterbescheinigungAnalyse;
  nebenkostenabrechnung: NebenkostenabrechnungAnalyse;
  energieabrechnung: VorhandenseinAnalyse;
  eigentum_nachweis: VorhandenseinAnalyse;
  vermoegensnachweis: VermoegensnachweisAnalyse;
  bestattungsvorsorge: VorhandenseinAnalyse;
  kv_pv_nachweis: VorhandenseinAnalyse;
  schwerbehindertenausweis: SchwerbehindertenausweisAnalyse;
  aerztliche_bescheinigung: AerztlicheBescheinigungAnalyse;
  wohngeldbescheid: WohngeldbescheidAnalyse;
  transferleistungsbescheid: VorhandenseinAnalyse;
  sonstiges: VorhandenseinAnalyse;
}

/**
 * Strukturierte, aus dem Dokument gelesene Werte (Grundlage der Plausibilitätsvergleiche).
 * Welche Felder gelten, bestimmt `Dokument.typ` (siehe {@link DokumentAnalyseJeTyp});
 * typsicherer Zugriff über `analyseVon()`.
 */
export type DokumentAnalyse = DokumentAnalyseJeTyp[DokumentTyp];

/** Analyse eines Dokuments typsicher lesen — nur wenn der Typ passt, sonst `undefined`. */
export function analyseVon<T extends DokumentTyp>(
  dok: { typ: DokumentTyp; analyse?: DokumentAnalyse },
  typ: T,
): DokumentAnalyseJeTyp[T] | undefined {
  return dok.typ === typ ? (dok.analyse as DokumentAnalyseJeTyp[T] | undefined) : undefined;
}

// ── Vokabular der Einkommens-/Vermögensarten (Person.einkommen[].art / .vermoegen[].art) ──

/**
 * Einkommensarten, die die Regel-Engine kennt. `Einkommensposition.art` bleibt `string`
 * (erweiterbar), die Erfassung (G3/G4) soll aber diese Werte verwenden.
 */
export const EINKOMMENS_ARTEN = {
  /** Gesetzliche Renten → rentenbescheid, rentenanpassungsmitteilung, plausi-rente-* */
  gesetzlicheRente: ['altersrente', 'em_rente', 'hinterbliebenenrente', 'rente'],
  /** Betriebs-/Zusatz-/Privatrenten, Pensionen → betriebsrente-nachweis */
  betriebsrente: ['betriebsrente', 'zusatzversorgung', 'pension', 'private_rente'],
  wohngeld: ['wohngeld'],
  unterhalt: ['unterhalt'],
  erwerb: ['erwerbseinkommen', 'minijob'],
  kapitalertrag: ['kapitalertraege'],
  vermietung: ['vermietung'],
  zuwendung: ['zuwendung'],
  sozialleistung: ['sozialleistung', 'krankengeld', 'arbeitslosengeld', 'grundsicherungsgeld'],
  /** Lösen den Hinweis „außerhalb des Prüfumfangs" aus. */
  selbstaendig: ['selbstaendig'],
  wfbm: ['wfbm_entgelt'],
} as const;

/** Vermögensarten, die die Regel-Engine unterscheidet (`VermoegenPosition.art`). */
export const VERMOEGENS_ARTEN = {
  /** Konten — Vergleich mit Kontoauszug-Endsaldo. */
  konto: ['girokonto', 'sparkonto', 'sparbuch', 'tagesgeld', 'festgeld'],
  lebensversicherung: ['lebensversicherung', 'kapitalversicherung'],
  bestattungsvorsorge: ['bestattungsvorsorge', 'sterbegeldversicherung'],
  /** Nicht Barvermögen i. S. d. Barbetrags (eigene Angemessenheitsprüfung, nicht im ersten Wurf). */
  keinBarvermoegen: ['eigenheim', 'immobilie', 'kfz', 'hausrat', 'bestattungsvorsorge', 'sterbegeldversicherung', 'riester'],
} as const;

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
  /** Erkennung über das DP-Segmentprofil „Grundsicherung-Eingang" (Provenienz, Lernsignal). */
  profil?: ProfilErkennung;
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

/** Datei im Umschlag mit den fachlichen Auswertungsfeldern (nach der Auswertung befüllt). */
export interface PosteingangDatei extends PosteingangDateiBasis<DokumentTyp> {
  titel?: string;
  analyse?: DokumentAnalyse;
  /** Nur beim Antrag: Antragsdaten (Stammdaten, Personen, Wohnung …). */
  stammdaten?: ExtrahierteStammdaten;
  /** Match-/Zuordnungs-Signal aus Nachweisen (Name, Geburtsdatum). */
  identitaet?: Identitaet;
  extraktion?: DokumentExtraktion;
  /** Konfidenz je Feld-Status-Pfad (0..1). */
  fieldConfidences?: Record<string, number>;
  extrahierterTextGekuerzt?: string;
  /** Erkennung über das DP-Segmentprofil (Abschnitt + Rohwerte). */
  profil?: ProfilErkennung;
}

export interface Posteingang extends KernPosteingang<PosteingangDatei, ScoredKandidat>, Timestamped, Versioned {}

// ── Erkennung (DP-Segmentprofil „Grundsicherung-Eingang") ───────────────────

/** Herkunft einer Auswertung aus dem DP-Segmentprofil. */
export interface ProfilErkennung {
  /** Abschnittstyp des Profils (= Dokumenttyp der App). */
  abschnitt: string;
  /** Klassifikations-Konfidenz (0..1). */
  konfidenz: number;
  /** Rohwerte des Profils — Initialextraktion (Transparenz, spätere Lernbeispiele). */
  rohwerte: Record<string, unknown>;
  quelle: 'datenbank' | 'vorlage';
  profilHash?: string;
  /** Vorlagenstand der App zum Zeitpunkt der Erkennung (Governance). */
  vorlageStand?: string;
}

/** Identitäts-Signal eines Dokuments (Match, Personenzuordnung). */
export interface Identitaet {
  nachname?: string;
  vorname?: string;
  geburtsdatum?: string;
}

/** Eine Person, wie sie aus dem Antrag gelesen wurde (Grundlage für das Anlegen der Personen). */
export interface AntragPerson {
  rolle: PersonRolle;
  nachname?: string;
  vorname?: string;
  geburtsname?: string;
  geburtsdatum?: string;
  familienstand?: Familienstand;
  staatsangehoerigkeit?: string;
  /** Freitext „Verhältnis zur antragstellenden Person" (nur Haushaltsangehörige). */
  verhaeltnis?: string;
  betreuung?: Betreuung;
  erwerbsminderung?: Erwerbsminderung;
  schwerbehinderung?: Schwerbehinderung;
  mehrbedarf_ernaehrung?: boolean;
  krankenversicherung?: Krankenversicherung;
  einkommen?: Array<Omit<Einkommensposition, 'id'>>;
  /** `[]` = ausdrücklich kein Vermögen; fehlt = keine Angabe. */
  vermoegen?: Array<Omit<VermoegenPosition, 'id'>>;
  unterhalt_kinder_eltern?: UnterhaltKinderEltern;
}

/** Aus dem Antrag gelesene Stammdaten (nur beim Dokumenttyp `grundsicherungsantrag`). */
export interface ExtrahierteStammdaten {
  antragsart?: Antragsart;
  antragsdatum?: string;
  aktenzeichen?: string;
  anspruchsgrund?: Anspruchsgrund;
  /** Kurzform für Match/Betreff (= Person mit Rolle antragsteller). */
  antragsteller?: Identitaet;
  adresse?: { strasse?: string; hausnummer?: string; plz?: string; ort?: string };
  wohnsituation?: Wohnsituation;
  /** Wohnkosten getrennt (ohne Adresse). */
  wohnung?: Omit<Wohnung, 'strasse' | 'hausnummer' | 'plz' | 'ort'>;
  iban?: string;
  vorbezug?: Vorbezug;
  wohngeld_antrag_laeuft?: boolean;
  /** Personen der Einsatzgemeinschaft und Haushaltsangehörige (Antragsteller:in zuerst). */
  personen?: AntragPerson[];
  /** Einkommenszeilen, die keiner Person zugeordnet werden konnten (Hinweis). */
  nichtZugeordnet?: number;
  /** Nur aus dem Posteingang-Formular: von Hand erfasster Ersteingang (§ 16 Abs. 2 SGB I). */
  ersteingang?: Ersteingang;
}

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
