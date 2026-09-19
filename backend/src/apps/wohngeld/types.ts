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

/** Empfänger-Kategorie einer Unterhaltsverpflichtung (§ 18 WoGG). */
export type UnterhaltEmpfaengerKategorie =
  | 'auswaertige_ausbildung'   // Nr. 1
  | 'kind_anderer_elternteil'  // Nr. 2
  | 'ehegatte_getrennt'        // Nr. 3
  | 'sonstige';                // Nr. 4

/** Eine Vermögensposition einer Person (§ 21 Nr. 3). */
export interface VermoegenPosition {
  id: string;
  art: string;             // z. B. 'Bankguthaben', 'Wertpapiere', 'Bausparvertrag'
  betrag?: number;
}

/** Eine Unterhaltsverpflichtung gegenüber Person außerhalb des Haushalts (§ 18). */
export interface Unterhaltsverpflichtung {
  id: string;
  empfaengerKategorie: UnterhaltEmpfaengerKategorie;
  betrag?: number;
  titelVorhanden: boolean;  // Titel/Vereinbarung/Bescheid → Abzug bis tatsächliche Höhe
}

/** Ein erhaltener Unterhaltsanspruch (§ 14 Abs. 2 Nr. 19–22). */
export interface Unterhaltsanspruch {
  id: string;
  art: string;             // z. B. 'Kindesunterhalt', 'Ehegattenunterhalt', 'Unterhaltsvorschuss'
  betrag?: number;
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
  transferleistungenDetail?: TransferleistungDetail[];
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
