/**
 * Lieferantenmanagement Types
 * All interfaces for supplier management
 */

// ============== Supplier ==============

export interface Adresse {
  strasse: string;
  plz: string;
  ort: string;
  land: string;
}

export interface Stammdaten {
  kundennummer: string;
  vertragsnummern: string[];
  auftragsnummern: string[];
  adresse: Adresse;
  url: string;
}

export interface Ansprechpartner {
  id: string;
  name: string;
  rolle: string;
  telefon: string;
  email: string;
  ist_hauptansprechpartner: boolean;
}

export type ZertifizierungsTyp = 'ISO27001' | 'TISAX' | 'PCI_DSS' | 'ISO23001' | 'ISO22301';

export interface Zertifizierung {
  id: string;
  typ: ZertifizierungsTyp;
  gueltig_bis: string;
  ausgestellt_am: string;
  zertifizierer: string;
  nachweis_vorhanden: boolean;
  dokument_id?: string;
}

export type SlaRelevanz = 'sla_kritisch' | 'sla_relevant' | 'sla_gering' | 'sla_keine';
export type DatenschutzNiveau = 'hoch_vertraulich' | 'gelegentlich_hoch' | 'nicht_sensibel' | 'keine';
export type Vertraulichkeit = 'dauerhaft_hoch' | 'gelegentlich_hoch' | 'nicht_sensibel' | 'keine';
export type Kundenbezug = 'direkt' | 'indirekt' | 'kein';
export type Ausschreibungsvolumen = 'ueber_250k' | '120k_250k' | '10k_120k' | 'unter_10k';
export type RisikoLevel = 'very_high' | 'high' | 'medium' | 'low';
export type Bonitaet = 'gut' | 'ausreichend' | 'mangelhaft' | 'unbekannt';

export interface BiaBewerung {
  sla_relevanz: SlaRelevanz;
  datenschutz_niveau: DatenschutzNiveau;
  vertraulichkeit: Vertraulichkeit;
  kundenbezug: Kundenbezug;
  ausschreibungsvolumen: Ausschreibungsvolumen;
  ergebnis: RisikoLevel;
  berechnet_am: string;
}

export interface Risikobewertung {
  bonitaet: Bonitaet;
  bonitaet_datum: string;
  bonitaet_quelle: string;
  bia: BiaBewerung;
  dora_relevant: boolean;
  naechste_pruefung: string;
}

export interface VertragsDokument {
  vorhanden: boolean;
  abgeschlossen_am: string;
  gueltig_bis: string;
  dokument_id?: string;
  contract_id?: string;
}

export type DoraKonformStatus = 'ja' | 'nein' | 'nicht_anwendbar';
export type DatenschutzRolle = 'verantwortlicher' | 'auftragsverarbeiter' | 'gemeinsame_verantwortung';

export interface Regulatorik {
  personenbezogene_daten: boolean;
  datenschutz_rolle?: DatenschutzRolle;
  avv: VertragsDokument;
  nda: VertragsDokument;
  rahmenvertrag: VertragsDokument & { dora_konform: DoraKonformStatus | boolean };
}

export type LeistungStatus = 'active' | 'inactive';

export interface Leistung {
  id: string;
  bezeichnung: string;
  abteilung: string;
  status: LeistungStatus;
  beschreibung: string;
  team_id?: string;
  risikobewertung: Risikobewertung;
  regulatorik: Regulatorik;
}

export type LifecyclePhase = 'vorbereitung' | 'risikoanalyse' | 'vertragspruefung' | 'betrieb' | 'beendigung';

export interface PhasenHistorie {
  phase: LifecyclePhase;
  eingetreten_am: string;
  abgeschlossen_am: string | null;
  bearbeiter: string;
}

export interface Lifecycle {
  phase: LifecyclePhase;
  phasen_historie: PhasenHistorie[];
}

export interface Verantwortlichkeiten {
  fachverantwortlicher: string;
  ism_verantwortlicher: string;
}

export type SupplierStatus = 'active' | 'inactive' | 'beendet';

export interface Supplier {
  id: string;
  firmenname: string;
  status: SupplierStatus;
  created_at: string;
  updated_at: string;
  created_by: string;
  stammdaten: Stammdaten;
  ansprechpartner: Ansprechpartner[];
  zertifizierungen: Zertifizierung[];
  leistungen: Leistung[];
  lifecycle: Lifecycle;
  verantwortlichkeiten: Verantwortlichkeiten;
  gesamtrisiko: RisikoLevel;
  notizen: string;
}

// ============== Audit ==============

export type AuditTyp = 'vertragspruefung' | 'soc_bericht' | 'bonitaetspruefung' | 'interview' | 'vor_ort_pruefung' | 'dokumentenpruefung';
export type AuditStatus = 'geplant' | 'in_durchfuehrung' | 'abgeschlossen' | 'uebersprungen';
export type AuditBewertung = 'bestanden' | 'bestanden_mit_auflagen' | 'nicht_bestanden' | null;

export interface AuditMassnahme {
  beschreibung: string;
  faellig_bis: string;
  status: 'offen' | 'erledigt';
}

export interface Audit {
  id: string;
  supplier_id: string;
  leistung_id: string;
  typ: AuditTyp;
  scope?: string;
  status: AuditStatus;
  geplant_fuer: string;
  durchgefuehrt_am: string;
  pruefer: string;
  team_id?: string;
  ergebnis: string | null;
  bewertung: AuditBewertung;
  massnahmen: AuditMassnahme[];
  notizen: string;
  dokument_id?: string;
  created_at: string;
  updated_at: string;
}

// ============== Audit Plan ==============

export interface AuditPlanEintrag {
  supplier_id: string;
  leistung_id: string;
  bia_level: RisikoLevel;
  erforderliche_scopes: string[];
  geplante_audits: string[];
  status: 'offen' | 'teilweise' | 'erledigt';
}

export interface AuditPlan {
  jahr: number;
  eintraege: AuditPlanEintrag[];
}

// ============== Dokumente ==============

export type DokumentTyp =
  | 'zertifizierung_nachweis' | 'avv_dokument' | 'nda_dokument'
  | 'rahmenvertrag_dokument' | 'bonitaetsnachweis' | 'audit_bericht' | 'sonstiges';

export interface DokumentMeta {
  id: string;
  supplier_id: string;
  typ: DokumentTyp;
  dateiname: string;
  dateityp: string;
  dateigroesse: number;
  hochgeladen_am: string;
  hochgeladen_von: string;
  referenz_typ?: 'zertifizierung' | 'leistung' | 'audit';
  referenz_id?: string;
  notizen?: string;
}

// ============== Changelog ==============

export type ChangelogAktion = 'erstellt' | 'geaendert' | 'phase_gewechselt' | 'geloescht';

export interface ChangelogEntry {
  timestamp: string;
  user: string;
  aktion: ChangelogAktion;
  bereich: string;
  feld?: string;
  alter_wert?: string;
  neuer_wert?: string;
  details?: Record<string, any>;
}

// ============== Config ==============

export interface LieferantenConfig {
  zertifizierungstypen: Array<{ id: ZertifizierungsTyp; label: string }>;
  abteilungen: string[];
  bia_stufen: Array<{ id: string; label: string; wert: number }>;
  lifecycle_phasen: Array<{ id: LifecyclePhase; label: string; reihenfolge: number }>;
  review_zyklen: Record<RisikoLevel, { monate: number | null; label: string }>;
  audit_typen: Array<{ id: AuditTyp; label: string }>;
  pruefungs_scopes: Array<{ id: string; label: string }>;
  scope_regeln: Record<string, string[]>;
  bonitaet_stufen: Array<{ id: Bonitaet; label: string }>;
  teams: Array<{ id: string; name: string }>;
}

// ============== Filter ==============

export interface SupplierFilters {
  search?: string;
  status?: SupplierStatus;
  abteilung?: string;
  bia_level?: RisikoLevel;
  dora?: boolean;
}
