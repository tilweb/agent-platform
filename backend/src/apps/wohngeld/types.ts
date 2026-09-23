/**
 * Wohngeld-Antragsassistent — Domänen-Typen.
 *
 * Fachlicher Rahmen: Assistenz für die VOLLSTÄNDIGKEITS- und PLAUSIBILITÄTSPRÜFUNG
 * von Wohngeldanträgen (Human-in-the-Loop). KEINE Betragsberechnung (§19 WoGG).
 *
 * Hierarchie:  Akte → Vorgang → { Personen, Dokumente, Prüfschritte, Schreiben, Aktivitäten }
 *
 * Persistenz-Konvention (wie echoloop): strukturierte Identitäts-/Filterspalten +
 * `data` jsonb für den Domänenrest + `permissions` + `version` (Optimistic Locking).
 */

// Typ-only Importe (werden beim Transpilieren entfernt — kein Laufzeit-Zyklus,
// obwohl extraction.ts/matching.ts ihrerseits aus dieser Datei Typen beziehen).
import type { ExtrahierteStammdaten, Identitaet } from './extraction';
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

/** Wohngeldart (§ 1 WoGG). V1-Fokus: Mietzuschuss. */
export type Wohngeldart = 'mietzuschuss' | 'lastenzuschuss';

/** Antragsart. */
export type Antragsart = 'erstantrag' | 'weiterleistungsantrag' | 'erhoehungsantrag' | 'aenderungsantrag';

/** Status eines Vorgangs (grober Workflow). */
export type VorgangStatus =
  | 'posteingang'
  | 'sachbearbeitung'
  | 'warte_auf_rueckmeldung'
  | 'entscheidung'
  | 'abgeschlossen';

export type Prioritaet = 'niedrig' | 'normal' | 'hoch';

/** Rolle einer Person im Haushalt / in der Bedarfsgemeinschaft. */
export type PersonRolle =
  | 'antragsteller'
  | 'ehegatte'
  | 'lebenspartner'
  | 'kind'
  | 'haushaltsmitglied';

/** Erwerbsstatus (steuert erforderliche Einkommensnachweise). */
export type Erwerbsstatus =
  | 'angestellt'
  | 'selbststaendig'
  | 'rente_pension'
  | 'arbeitslos'
  | 'ausbildung_studium'
  | 'ohne_erwerb'
  | 'sonstiges';

/** Dokument-/Nachweis-Typ (Ergebnis der Klassifikation). */
export type DokumentTyp =
  | 'wohngeldantrag'
  | 'personalausweis'
  | 'mietvertrag'
  | 'mietbescheinigung'
  | 'rentenbescheid'
  | 'verdienstbescheinigung'
  | 'gehaltsabrechnung'
  | 'kontoauszug'
  | 'kv_pv_nachweis'
  | 'schwerbehindertenausweis'
  | 'pflegenachweis'
  | 'kindergeldnachweis'
  | 'unterhaltsnachweis'
  | 'transferleistungsbescheid'
  | 'vermoegensnachweis'
  | 'sonstiges';

/** Prüfschritt-Kategorie. */
export type PruefKategorie = 'vollstaendigkeit' | 'plausibilitaet';

/** Prüfschritt-Typ (Handlungsbedarf). `anforderung` = Nachforderung nötig. */
export type PruefTyp = 'anforderung' | 'info';

/** Prüfschritt-Status. */
export type PruefStatus = 'offen' | 'erledigt' | 'verworfen';

export type SchreibenArt = 'erstanforderung' | 'erinnerung' | 'zweitanforderung' | 'sonstiges';

// ── Entitäten ───────────────────────────────────────────────────────────────

/** Ebene 1 — Akte (E-Akte, personen-/adressbezogen). */
export interface Akte extends Timestamped, Versioned {
  id: string;
  ownerId?: string;
  /** Anzeigename der Akte (i. d. R. Nachname bzw. „Nachname, Vorname"). */
  name: string;
  antragstellerName?: string;
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  notizen?: string;
  permissions?: AppPermissions;
}

/** Ein Bewilligungszeitraum (§ 25 WoGG, i. d. R. 12 Monate). */
export interface Bewilligungszeitraum {
  id: string;
  start?: string;  // ISO (YYYY-MM-DD)
  ende?: string;   // ISO (YYYY-MM-DD)
}

/** Aufgabe/Todo eines Vorgangs (Welle 4, WP8). */
export interface VorgangTodo {
  id: string;
  text: string;
  erledigt: boolean;
}

/** Entscheidung einer Verfügung (Welle 5, WP11). KEINE §19-Betragsfestsetzung. */
export type VerfuegungEntscheidung = 'bewilligt' | 'abgelehnt' | 'teilweise' | 'offen';

/** Verfügung/Entscheidung eines Vorgangs (Welle 5, WP11). */
export interface VorgangVerfuegung {
  entscheidung?: VerfuegungEntscheidung;
  bemerkung?: string;
  erstelltAm?: string;   // ISO
}

/** Wohnung & Miete (Teil des Vorgangs). */
export interface WohnungMiete {
  strasse?: string;
  hausnummer?: string;
  plz?: string;
  ort?: string;
  wohnflaeche_qm?: number;
  miete?: number;         // Bruttokaltmiete lt. Antrag
  heizkosten?: number;
  warmwasser?: number;
  weitere_angaben?: string;
}

/** Ebene 2 — Vorgang (= „Antrag", eigene Antrags-ID, Prüf-/Plausibilisierungs-Einheit). */
export interface Vorgang extends Timestamped, Versioned {
  id: string;
  akteId: string;
  /** Fachliche Antrags-ID (Abrechnungseinheit lt. Ausschreibung). Eindeutig. */
  antragsId: string;
  wohngeldart: Wohngeldart;
  antragsart: Antragsart;
  status: VorgangStatus;
  sachbearbeiter?: string;
  prioritaet: Prioritaet;
  ownerId?: string;
  // Domänen-Details (im data-jsonb):
  antragsdatum?: string;         // ISO
  bwz_start?: string;            // Legacy-Bewilligungszeitraum (weiter befüllt für Kompatibilität)
  bwz_ende?: string;
  /** Bewilligungszeiträume als Liste (Welle 3, WP5). Führend, wenn vorhanden. */
  bwz?: Bewilligungszeitraum[];
  iban?: string;
  wohnung?: WohnungMiete;
  labels?: string[];
  /** Frist des zuletzt versendeten Anforderungsschreibens (Welle 4, WP7). ISO. */
  frist?: string;
  /** Wiedervorlagedatum (Welle 4, WP7). ISO. */
  wiedervorlage?: string;
  /** Aufgaben/Todos je Vorgang (Welle 4, WP8). */
  todos?: VorgangTodo[];
  /** Verfügung/Entscheidung (Welle 5, WP11). */
  verfuegung?: VorgangVerfuegung;
  /** GOV-5 — Aufbewahrungs-Enddatum (ISO). Bei Abschluss automatisch gesetzt (Retention). */
  aufbewahrungBis?: string;
  /** GOV-5 — Legal Hold: verhindert Löschung, auch nach Fristablauf. */
  legalHold?: boolean;
  /** GOV-5 — Verarbeitung eingeschränkt (Art. 18 DSGVO): nur noch lesend. */
  eingeschraenkt?: boolean;
  permissions?: AppPermissions;
}

/** Eine Einkommensposition einer Person (§14 WoGG). */
export interface Einkommensposition {
  id: string;
  art: string;             // z. B. 'rente', 'lohn_gehalt', 'kapitalertraege', ...
  bezeichnung?: string;
  betrag_monatlich?: number;
  betrag_jaehrlich?: number;
  beruecksichtigt: boolean; // von Sachbearbeitung bestätigt
}

/** Pflege- & Behinderungsangaben. */
export interface PflegeBehinderung {
  schwerbehinderungsgrad?: number;
  pflegegrad?: number;
  pflegebeduerftig?: boolean;
}

/** Empfänger-Kategorie einer Unterhaltsverpflichtung (§ 18 WoGG) — Legacy-Shape. */
export type UnterhaltEmpfaengerKategorie =
  | 'auswaertige_ausbildung'   // Nr. 1
  | 'kind_anderer_elternteil'  // Nr. 2
  | 'ehegatte_getrennt'        // Nr. 3
  | 'sonstige';                // Nr. 4

/**
 * Verwandtschaftsverhältnis zum Empfänger einer Unterhaltsverpflichtung
 * (forml-Feldset, Welle 2). Steuert die § 18-Kappung (siehe einkommen.ts).
 */
export type UnterhaltVerwandtschaft =
  | 'kind'
  | 'ehegatte_getrennt'        // getrennt lebender/früherer Ehegatte/Lebenspartner
  | 'elternteil'
  | 'auswaertige_ausbildung'   // Person in auswärtiger Ausbildung
  | 'sonstige';

/** Zahlungsfrequenz einer Betragsangabe (forml-Feldset, Welle 2). */
export type Frequenz =
  | 'taeglich'
  | 'woechentlich'
  | 'vierzehntaegig'
  | 'monatlich'
  | 'vierteljaehrlich'
  | 'jaehrlich'
  | 'einmalig'
  | 'schwankend'
  | 'sonstige';

/** Ausschluss-Grund nach § 7 WoGG (forml-Feldset, Welle 2). */
export type AusschlussGrund =
  | 'sgb2_buergergeld'
  | 'grundsicherung_alter_em'
  | 'hilfe_lebensunterhalt_sgb12'
  | 'ergaenzende_hilfe_bvg'
  | 'hilfe_stationaer'
  | 'kinder_jugendhilfe_sgb8'
  | 'asylblg'
  | 'ausbildungsfoerderung'
  | 'sonstiger_grund';

/** Eine Vermögensposition einer Person (§ 21 Nr. 3). */
export interface VermoegenPosition {
  id: string;
  art: string;             // z. B. 'Bankguthaben', 'Wertpapiere', 'Bausparvertrag'
  betrag?: number;
}

/** Kinderbetreuungskosten einer Person (Erfassung/Anzeige — KEIN § 13-Abzug). */
export interface Kinderbetreuungskosten {
  id: string;
  frequenz?: Frequenz;
  bemerkung?: string;
  betrag?: number;
}

/**
 * Eine Unterhaltsverpflichtung gegenüber Person außerhalb des Haushalts (§ 18).
 * Führend ist die neue Shape (`verwandtschaft` + `frequenz`); die Legacy-Felder
 * (`empfaengerKategorie` + `titelVorhanden`) bleiben lesbar und werden weiter unterstützt.
 */
export interface Unterhaltsverpflichtung {
  id: string;
  // Neue Shape (forml-Feldset, Welle 2):
  verwandtschaft?: UnterhaltVerwandtschaft;
  empfaengerVorname?: string;
  empfaengerNachname?: string;
  frequenz?: Frequenz;
  betrag?: number;
  // Legacy-Shape (weiter unterstützt):
  empfaengerKategorie?: UnterhaltEmpfaengerKategorie;
  titelVorhanden?: boolean;  // Titel/Vereinbarung/Bescheid → Abzug bis tatsächliche Höhe
}

/**
 * Ein erhaltener Unterhaltsanspruch (§ 14 Abs. 2 Nr. 19–22). Führend ist die neue
 * Shape (`vonVorname`/`vonNachname` + `frequenz`); Legacy-`art` bleibt lesbar.
 */
export interface Unterhaltsanspruch {
  id: string;
  // Neue Shape (forml-Feldset, Welle 2):
  vonVorname?: string;
  vonNachname?: string;
  frequenz?: Frequenz;
  betrag?: number;
  // Legacy-Shape:
  art?: string;            // z. B. 'Kindesunterhalt', 'Ehegattenunterhalt', 'Unterhaltsvorschuss'
}

/** Ein Ausschluss-Tatbestand nach § 7 WoGG (forml-Feldset, Welle 2). */
export interface Ausschluss {
  id: string;
  grund?: AusschlussGrund;
  von?: string;            // ISO (YYYY-MM-DD)
  bis?: string;            // ISO (YYYY-MM-DD)
  freitext?: string;
}

/** Eine Transferleistung einer Person (§ 7 WoGG — mögliche Ausschlusswirkung). */
export interface TransferleistungDetail {
  id: string;
  art: string;             // z. B. 'Bürgergeld', 'Grundsicherung', 'AsylbLG'
  kduEnthalten: boolean;   // Unterkunftskosten in der Leistung enthalten → Ausschluss § 7
  bescheidVorhanden: boolean;
}

/** Person (Antragsteller / Haushaltsmitglied). */
export interface Person extends Timestamped, Versioned {
  id: string;
  vorgangId: string;
  rolle: PersonRolle;
  nachname: string;
  vorname: string;
  // Domänen-Details (im data-jsonb):
  geburtsname?: string;
  titel?: string;
  geburtsdatum?: string;
  geburtsort?: string;
  geschlecht?: 'maennlich' | 'weiblich' | 'divers';
  familienstand?: string;
  telefon?: string;
  email?: string;
  erwerbsstatus?: Erwerbsstatus;
  staatsangehoerigkeit?: string;
  eu_ewr?: boolean;
  erhaelt_kindergeld?: boolean;
  hat_werbungskosten?: boolean;
  pflege_behinderung?: PflegeBehinderung;
  einkommen?: Einkommensposition[];
  vermoegen?: number;             // Legacy: Einzelzahl (weiter unterstützt); führend ist vermoegenPositionen
  transferleistungen?: string[];  // Legacy: Freitext-Liste; führend ist transferleistungenDetail
  // Strukturierte Listen (Welle 3, WP5):
  vermoegenPositionen?: VermoegenPosition[];
  unterhaltsverpflichtungen?: Unterhaltsverpflichtung[];
  unterhaltsansprueche?: Unterhaltsanspruch[];
  transferleistungenDetail?: TransferleistungDetail[];  // Legacy: führend sind jetzt `ausschluesse`
  // forml-Feldset (Welle 2):
  kinderbetreuungskosten?: Kinderbetreuungskosten[];
  ausschluesse?: Ausschluss[];
  bemerkung?: string;
}

/** Erkannter Hinweis/Flag zu einem Dokument (z. B. „ohne Unterschrift"). */
export interface DokumentFlag {
  code: string;
  hinweis: string;
}

/**
 * Strukturierte, aus dem Dokument extrahierte Werte — Grundlage der
 * Plausibilitätsvergleiche (Antrag ↔ Nachweis). Wird in Phase 4 von der
 * Extraktion befüllt; für Tests direkt gesetzt.
 */
export interface DokumentAnalyse {
  miete?: number;                       // z. B. aus Mietvertrag/Vermieterbescheinigung
  wohnflaeche_qm?: number;
  unterschrift_vorhanden?: boolean;
  datum_vorhanden?: boolean;
  rentenart_vorhanden?: boolean;        // Rentenbescheid nennt Rentenart
  grundrentenzeiten_vorhanden?: boolean;
  mietzahlung_erkannt?: boolean;        // Kontoauszug zeigt Mietabgang
  /** Auf dem Kontoauszug erkannte, ggf. nicht deklarierte Einkunftsarten. */
  erkannte_einkuenfte?: string[];       // z. B. ['kapitalertraege']
  betrag?: number;                      // generischer Betrag (z. B. Renten-/Gehaltshöhe)
}

/** Ein einzelner, aus dem Dokument gezogener Wert (für die Transparenz-Ansicht). */
export interface DokumentExtraktionFeld {
  /** Gruppen-Knoten im Extraktions-Baum, z. B. 'Antragsteller' | 'Adresse' | 'Analyse'. */
  gruppe?: string;
  /** Lesbares deutsches Label des Feldes. */
  label: string;
  /** Formatierter Anzeigewert (Datum TT.MM.JJJJ, Euro, ja/nein …). */
  wert: string;
  /** Konfidenz des Extraktionswerts (0..1), sofern die Pipeline sie geliefert hat. */
  confidence?: number;
  /** Seite im Dokument, aus der der Wert stammt (aus der Provenienz `p:N`). */
  seite?: number;
}

/**
 * Transparente Zusammenfassung dessen, WAS die KI aus einem Dokument gezogen hat.
 * Wird beim Anlegen eines Dokuments aus der Extraktion befüllt (Posteingang
 * `verteilen` + Direkt-Upload) und im `data`-jsonb abgelegt (keine Migration).
 */
export interface DokumentExtraktion {
  felder: DokumentExtraktionFeld[];
  /** Genutztes Extraktionsmodell (Modell-ID). */
  modell?: string;
  /** Prompt-/Regelkatalog-Stand (Nachvollziehbarkeit). */
  stand?: string;
  /** Zeitpunkt der Extraktion (ISO). Im Aufruf-/Route-Kontext gesetzt. */
  erzeugtAm?: string;
}

/** Dokument / Nachweis (Eingang). */
export interface Dokument extends Timestamped, Versioned {
  id: string;
  vorgangId: string;
  personId?: string;             // zugeordnete Person (optional)
  typ: DokumentTyp;
  titel?: string;
  quelle?: string;               // z. B. Dateiname / Eingangskanal
  seiten?: number;
  istOriginal: boolean;          // Originaldatei vs. klassifizierter Nachweis
  s3Key?: string;
  pfad?: string;
  eingegangenAm?: string;
  extrahierterText?: string;     // pdftotext-Ergebnis (gekürzt)
  flags?: DokumentFlag[];
  analyse?: DokumentAnalyse;
  /** Transparente Übersicht der extrahierten Werte (Extraktions-Baum). */
  extraktion?: DokumentExtraktion;
  /** Ins Fachverfahren abgelegt (Welle 5, WP10). Nur Status, keine echte Schnittstelle. */
  abgelegt?: boolean;
}

/** Prüfschritt (Vollständigkeit oder Plausibilität). */
export interface Pruefschritt extends Timestamped, Versioned {
  id: string;
  vorgangId: string;
  personId?: string;             // null = fallübergreifend
  /** Stabile Regel-ID (aus dem Regel-Katalog), für Idempotenz beim Neu-Prüfen. */
  regelId: string;
  kategorie: PruefKategorie;
  typ: PruefTyp;
  status: PruefStatus;
  titel: string;
  belegtext?: string;            // Begründung / Nachvollziehbarkeit
  quellDokumentId?: string;      // referenziertes Dokument
  /** true = von der Regel-Engine erzeugt, false = manuell ergänzt. */
  automatisch: boolean;
}

/**
 * Ein Anforderungspunkt eines Schreibens mit Provenienz (Welle 3, WP6).
 * Verknüpft die Textzeile mit dem auslösenden Prüfschritt/Beleg.
 */
export interface SchreibenItem {
  text: string;
  regelId?: string;
  quellDokumentId?: string;
  personId?: string;
  titel?: string;                // Titel des zugehörigen Prüfschritts (für ⓘ-Anzeige)
}

/** Nachforderungsschreiben. */
export interface Schreiben extends Timestamped, Versioned {
  id: string;
  vorgangId: string;
  art: SchreibenArt;
  betreff?: string;
  frist?: string;                // ISO
  body?: string;                 // generierter Text (Markdown/HTML)
  items?: SchreibenItem[];       // je Anforderungspunkt mit Bezug (Provenienz)
  exportPfad?: string;
}

/** Pflegbarer Textbaustein für Anforderungsschreiben (Welle 3, WP6). */
export interface Textbaustein extends Timestamped {
  id: string;
  kategorie: string;             // z. B. 'Miete', 'Einkommen', 'Allgemein'
  titel: string;
  text: string;
}

/** Aktivität (Legacy-Verlauf, append-only). Rückwärtskompatibel — neue Einträge laufen über AuditEintrag. */
export interface Aktivitaet {
  id: string;
  vorgangId: string;
  typ: string;                   // z. B. 'status_change', 'pruefung', 'schreiben'
  akteur?: string;
  beschreibung?: string;
  created_at: string;
}

/** Geänderte Felder eines Updates: feldPfad → { alt, neu }. */
export type FeldDiff = Record<string, { alt: unknown; neu: unknown }>;

/**
 * GOV-1 — Audit-/Protokoll-Eintrag (append-only, revisionssicher).
 * Eine Zeile je fachlich relevanter Aktion — inkl. Lesezugriff (`vorgang.geoeffnet`)
 * und Downloads/Exporte. Akteur vollständig (id+name+rolle+ip); bei Änderungen
 * Vorher/Nachher als Diff der Kernfelder.
 */
export interface AuditEintrag {
  id: string;
  timestamp: string;
  akteurId?: string;
  akteurName?: string;
  akteurRolle?: string;          // 'owner' | 'editor' | 'viewer' (wirksame Rolle zum Zeitpunkt)
  aktion: string;                // Enum, z. B. 'vorgang.geaendert', 'dokument.hochgeladen'
  objektTyp: string;             // vorgang | person | dokument | pruefschritt | schreiben | notiz | feldstatus | akte | verfuegung | chat | textbaustein
  objektId?: string;
  vorgangId?: string;            // Fallbezug (für Filter)
  ergebnis: string;              // 'ok' | 'fehler'
  vorher?: unknown;
  nachher?: unknown;
  detail?: string;
  ip?: string;
}

/**
 * Ein KI-Nutzungseintrag eines Falls (GOV-3 / AI Act Art. 12) — abgeleitet aus
 * `audit.usage_log`. Nur Metadaten (kein Prompt-/Antwort-Volltext): wann wurde
 * WELCHES Modell zu WELCHEM Zweck unter WELCHEM Wissensstand eingesetzt.
 */
export interface KiNutzungEintrag {
  timestamp: string;
  source: string;                // z. B. 'chat', 'document_analysis'
  operation?: string;            // z. B. 'wohngeld_fall_chat', 'wohngeld_klassifikation'
  modelId?: string;
  providerId?: string;
  promptVersion?: string;        // Prompt-/Regelkatalog-Stand
  rechtStand?: string;           // Rechtsstand des genutzten §-Korpus (nur Fall-Chat)
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

// ── Posteingang-Warteschlange (persistenter Umschlag/Batch) ─────────────────

/** Kanal, über den ein Eingang eingeliefert wurde. */
export type PosteingangQuelle = 'manuell' | 'scan' | 'email' | 'import';

/** Zustand eines Eingangs im Zustandsautomaten (siehe Spec §4). */
export type PosteingangStatus =
  | 'eingegangen'
  | 'in_analyse'
  | 'analysiert'
  | 'fehler'
  | 'zugeordnet'
  | 'verworfen';

/**
 * Eine Datei im Umschlag. Vor der Analyse nur Ablage-/Metadaten; nach der Analyse
 * zusätzlich Klassifikation + extrahierte Werte. Die Analyse-Felder (`stammdaten`,
 * `identitaet`, `extraktion`, `fieldConfidences`) werden gespeichert, damit die
 * Zuordnung verlustfrei aus den Refs rekonstruiert werden kann (kein Re-Upload).
 */
export interface PosteingangDatei {
  dateiname: string;
  s3Key?: string;
  pfad?: string;
  contentType: string;
  groesse: number;
  hash: string;                 // Datei-Hash (SHA-256, hex) — Dedupe/Idempotenz
  // nach Analyse befüllt:
  typ?: DokumentTyp;            // Klassifikation (überschreibbar)
  titel?: string;
  analyse?: DokumentAnalyse;
  stammdaten?: ExtrahierteStammdaten;  // nur beim Wohngeldantrag
  identitaet?: Identitaet;             // Match-Signal aus Nachweisen
  extraktion?: DokumentExtraktion;
  fieldConfidences?: Record<string, number>;
  extrahierterTextGekuerzt?: string;
  analyseFehler?: string;
  /** Gesetzt an jedem Teil einer getrennten Sammel-PDF (Mehrdokument-Split). */
  teilVon?: PosteingangTeilVon;
  /** Ergebnis der Grenzprüfung an einer ungetrennten PDF. */
  trennung?: PosteingangTrennung;
}

/** Herkunft eines Teil-Dokuments: das Original + Seitenbereich. */
export interface PosteingangTeilVon {
  dateiname: string;
  s3Key?: string;
  pfad?: string;
  hash: string;
  contentType: string;
  groesse: number;
  seitenGesamt: number;
  seiteVon: number;
  seiteBis: number;
  teilNr: number;
  teileGesamt: number;
  manuell?: boolean;
}

/** Ergebnis der Dokumentgrenzen-Prüfung einer (ungetrennten) PDF. */
export interface PosteingangTrennung {
  status: 'ein_dokument' | 'unsicher' | 'nicht_moeglich';
  seitenGesamt?: number;
  hinweis?: string;
  manuell?: boolean;
}

/**
 * Eingang = Umschlag/Batch. Persistente Warteschlange (multi-antragsfähig).
 * `matchVorschlag` ist das Ergebnis der Umschlag-Match-Ermittlung auf
 * Umschlag-Ebene (Kandidaten inkl. Level + Vergleichstabelle).
 */
export interface Posteingang extends Timestamped, Versioned {
  id: string;
  quelle: PosteingangQuelle;
  eingegangenAm: string;          // ISO — fristauslösend (rechtlich relevant)
  betreff?: string;
  status: PosteingangStatus;
  dateien: PosteingangDatei[];
  matchVorschlag?: ScoredKandidat[];
  zugeordneterVorgangId?: string;
  zugeordneteAkteId?: string;
  bearbeiterId?: string;
  verworfenGrund?: string;
  hash?: string;                  // Umschlag-Hash (Dedupe gegen Doppel-Scans)
  data?: Record<string, unknown>; // Erweiterungen (z. B. demo:true, idempotencyKey)
}

// ── Feld-Provenienz (Welle 2, WP3) ─────────────────────────────────────────

/** Ziel-Entität eines Feld-Status. */
export type FeldStatusZielTyp = 'vorgang' | 'person';

/** Herkunft eines Feldwerts. */
export type FeldQuelle = 'llm' | 'mensch';

/**
 * Feld-Provenienz: markiert einen extrahierten Feldwert als Vorschlag, den die
 * Sachbearbeitung bestätigt/verwirft. Generisch statt Umbau jedes Feldes.
 */
export interface FeldStatus {
  id: string;
  vorgangId: string;
  zielTyp: FeldStatusZielTyp;
  zielId: string;
  feldPfad: string;             // z. B. 'wohnung.miete' oder 'geburtsdatum'
  quelle: FeldQuelle;
  bestaetigt: boolean;
  quellDokumentId?: string;
  confidence?: number;
  created_at: string;
  updated_at: string;
}

// ── Notizen je Sektion/Person (Welle 2, WP4) ────────────────────────────────

/** Interne Notiz zu einer Sektion oder Person eines Vorgangs (append-only). */
export interface Notiz {
  id: string;
  vorgangId: string;
  anker: string;                // z. B. 'sektion:allgemein' | 'person:<id>'
  autor?: string;
  text: string;
  created_at: string;
}

// ── Fall-Chat (grounded Fall-Q&A, Stufen C1 + C2) ──────────────────────────

/**
 * Quelle einer belegten Chat-Aussage. Wird aus dem vom Modell markierten
 * Quellen-Block aufgelöst:
 *  - `dokument`: Fall-Nachweis (C1), Auflösung Dokument-ID → Label.
 *  - `recht`:    Rechtsquelle aus dem statischen Korpus (C2), Auflösung
 *                Chunk-ID → Label/URL (§ + Gesetz + Titel, klickbar).
 */
export type ChatSource =
  | { art: 'dokument'; dokumentId: string; label: string; seite?: number }
  | { art: 'recht'; ref: string; label: string; url?: string };

/**
 * Vom Modell vorgeschlagene App-Aktion (Stufe G / C4). NUR Vorschlag — die
 * Ausführung passiert erst nach Klick + Bestätigung durch den Menschen.
 * `id` stammt aus einer festen Whitelist; `label` ist der deutsche Anzeigetext.
 */
export interface ChatAction {
  id: string;
  label: string;
}

/** Chat-Nachricht (append-only) im Fall-Verlauf eines Vorgangs. */
export interface ChatMessage {
  id: string;
  vorgangId: string;
  rolle: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  /** Vorgeschlagene Aktionen (C4) — nur bei Assistenz-Antworten, Ausführung per Klick. */
  actions?: ChatAction[];
  model?: string;
  tokens?: number;
  created_at: string;
}

// ── Regel-Engine (Input/Output der reinen Prüf-Funktionen) ──────────────────

/** Aggregierter Fall-Snapshot als Input für die Regel-Engine (rein, DB-frei). */
export interface VorgangSnapshot {
  vorgang: Vorgang;
  personen: Person[];
  dokumente: Dokument[];
}

/** Ergebnis-Kandidat der Regel-Engine (vor Persistenz als Pruefschritt). */
export interface PruefBefund {
  regelId: string;
  personId?: string;
  kategorie: PruefKategorie;
  typ: PruefTyp;
  titel: string;
  belegtext: string;
  quellDokumentId?: string;
}
