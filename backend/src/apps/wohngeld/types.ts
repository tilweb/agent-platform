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
  bwz_start?: string;            // Bewilligungszeitraum
  bwz_ende?: string;
  iban?: string;
  wohnung?: WohnungMiete;
  labels?: string[];
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
  vermoegen?: number;             // z. B. Bankguthaben
  transferleistungen?: string[];
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

/** Nachforderungsschreiben. */
export interface Schreiben extends Timestamped, Versioned {
  id: string;
  vorgangId: string;
  art: SchreibenArt;
  betreff?: string;
  frist?: string;                // ISO
  body?: string;                 // generierter Text (Markdown/HTML)
  exportPfad?: string;
}

/** Aktivität / Audit-Eintrag (append-only). */
export interface Aktivitaet {
  id: string;
  vorgangId: string;
  typ: string;                   // z. B. 'status_change', 'pruefung', 'schreiben'
  akteur?: string;
  beschreibung?: string;
  created_at: string;
}

// ── Fall-Chat (grounded Fall-Q&A, Stufe C1) ────────────────────────────────

/**
 * Quelle einer belegten Chat-Aussage. In C1 ausschließlich Fall-Dokumente
 * (Recht-RAG folgt in C2). Wird aus dem vom Modell markierten Quellen-Block
 * aufgelöst (Dokument-ID → Label).
 */
export interface ChatSource {
  art: 'dokument';
  dokumentId: string;
  label: string;
  seite?: number;
}

/** Chat-Nachricht (append-only) im Fall-Verlauf eines Vorgangs. */
export interface ChatMessage {
  id: string;
  vorgangId: string;
  rolle: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
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
