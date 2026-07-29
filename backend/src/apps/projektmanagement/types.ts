/**
 * Projektmanagement Types
 * Type definitions for the KI PM-Assistent
 */

// ============== Core Entities ==============

export interface Task {
  id: string;
  name: string;
  responsible: string;
  start_date: string;
  end_date: string;
  effort: number; // in hours or days
  status?: 'open' | 'in_progress' | 'completed';
}

export interface Milestone {
  id: string;
  name: string;
  date: string;
  description?: string;
}

export interface BudgetItem {
  id: string;
  item: string;
  provider?: string;
  amount: number;
  category?: string;
}

export interface Risk {
  id: string;
  type: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email?: string;
  availability?: number; // percentage
  // Im Frontend (Personen-Maske) genutzte Felder — Persistenz via jsonb-Blob.
  company?: string;
  status?: string;
  interest?: string;
  influence?: string;
  gruppe?: string;        // konfigurierbar: Auftraggeber / Projektteam / Stakeholder
  aufgabe?: string;       // Freitext
  bemerkung?: string;     // Freitext
  geplanter_einsatz?: { wert: number | string; einheit: '%' | 'PT' }; // nur Projektidee
}

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  interest: 'low' | 'medium' | 'high';
  influence: 'low' | 'medium' | 'high';
  expectations?: string;
  status?: string;
}

// ============== Projektauftrag ==============

export interface Projektauftrag {
  id: string;

  // Schritt 1: Basis
  name: string;
  project_type: 'internal' | 'external' | 'research' | 'infrastructure';
  start_date: string;
  end_date: string;
  projektleiter: string;
  auftraggeber: string;
  description?: string;

  // Schritt 2: Ziele
  goals: string;
  criteria: string[];

  // Schritt 3: Umfang
  scope: string;
  in_scope: string[];
  out_scope: string[];

  // Schritt 4: Aufgaben
  tasks: Task[];

  // Schritt 5: Meilensteine
  milestones: Milestone[];

  // Schritt 6: Budget & Risiken
  budget: BudgetItem[];
  risks: Risk[];

  // Schritt 7: Organisation
  organization: TeamMember[];
  stakeholders: Stakeholder[];

  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  current_step: number;

  // KI-Analysen (persistent)
  stepAnalyses?: StoredStepAnalyses;
  gesamtbewertung?: StoredGesamtbewertung;

  // Optimistic-Concurrency-Counter — bei jedem Save ++; siehe concurrency.ts.
  version?: number;

  // Verknuepfung zur Quell-Idee (sofern aus einer Idee generiert).
  // Wird via JOIN beim Detail-Read gefuellt; nicht im jsonb-data gespeichert
  // (idee_id liegt als separate FK-Spalte in projektauftraege.idee_id).
  idee?: { id: string; name: string };

  // Phase-2 Auftrags-Level Permissions. NULL/missing = nur created_by ist Owner.
  permissions?: ResourcePermissions | null;

  // Legacy - kept for compatibility
  analysis?: ProjektAnalysis;
}

/**
 * Projekt: Top-Level-Objekt fuer den PM-Lifecycle (Phase A der Entity-
 * Restruktur). Traegt Identitaet, Lifecycle-Status und Hierarchie-Referenzen.
 *
 * Sub-Resources sind via FK auf projekt.id angebunden:
 *   - Projektauftrag (1:1, formale Definition)
 *   - Statusberichte (1:n, fortlaufende Reportings)
 *   - Lessons Learned (1:n, Erkenntnisse — Phase E)
 *   - Abschlussbericht (1:1, finale Zusammenfassung — Phase E)
 *
 * Status-Wahrheit: PM-Phase lebt im Auftrag-Data unter `project_status`. Die
 * frueheren `lifecycle`-Werte (planning/active/closed/cancelled) wurden mit
 * Migration 0013 entfernt — sie wurden nicht mehr UI-gesetzt und drifteten
 * still. Siehe docs/projektmanagement-status-felder-2026-05-18.md.
 */
export interface Projekt {
  id: string;
  name: string;
  portfolioId?: string;        // 0..1 zu Portfolio (Phase D)
  ideeId?: string;             // optional, Herkunfts-Idee
  ownerId?: string;
  metadata?: Record<string, any>;
  permissions?: ResourcePermissions;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Eingabe-DTO fuer createProjekt — minimal, andere Felder werden defaulted.
 */
export interface ProjektCreateInput {
  id?: string;                 // optional — wenn gesetzt, wird 1:1 uebernommen (z.B. Auftrag→Projekt-Migration)
  name: string;
  portfolioId?: string;
  ideeId?: string;
  ownerId?: string;
  metadata?: Record<string, any>;
}

export interface ProjektUpdateInput {
  name?: string;
  portfolioId?: string | null;
  metadata?: Record<string, any>;
  expectedVersion?: number;     // optimistic concurrency
}

// ============== Portfolio (Phase D) ==============
//
// Gruppierung von Projekten fuer PMO-Sicht. Adressiert primaer Portfolio
// Performance + Risk Reporting (PMI/PMBOK). Strategic Alignment lebt als
// Markdown-Freitext im `strategy`-Feld.
//
// 0..1-Kardinalitaet via paProjekte.portfolioId. Loeschen eines Portfolios
// setzt portfolioId der zugeordneten Projekte auf NULL (kein Cascade).

export type PortfolioStatus = 'vorbereitung' | 'active' | 'pausiert' | 'abgeschlossen' | 'archived';

export const PORTFOLIO_STATUS_VALUES: readonly PortfolioStatus[] = [
  'vorbereitung', 'active', 'pausiert', 'abgeschlossen', 'archived',
] as const;

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  strategy?: string;            // Markdown
  status: PortfolioStatus;
  // Basis-Stammdaten (im metadata-JSONB persistiert, per rowToPortfolio angehoben).
  type?: string;                // portfolio_type (Config-Liste)
  driver?: string;              // portfolio_driver (Config-Liste)
  start_date?: string;
  end_date?: string;
  // Personen (im metadata-JSONB persistiert, per rowToPortfolio angehoben).
  organization?: TeamMember[];  // Portfolioteam
  stakeholders?: Stakeholder[]; // Portfolio-Stakeholder
  ownerId?: string;
  metadata?: Record<string, any>;
  permissions?: ResourcePermissions;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioCreateInput {
  id?: string;
  name: string;
  description?: string;
  strategy?: string;
  status?: PortfolioStatus;
  type?: string;
  driver?: string;
  start_date?: string;
  end_date?: string;
  organization?: TeamMember[];
  stakeholders?: Stakeholder[];
  ownerId?: string;
  metadata?: Record<string, any>;
}

export interface PortfolioUpdateInput {
  name?: string;
  description?: string | null;
  strategy?: string | null;
  status?: PortfolioStatus;
  type?: string;
  driver?: string;
  start_date?: string;
  end_date?: string;
  organization?: TeamMember[];
  stakeholders?: Stakeholder[];
  metadata?: Record<string, any>;
  expectedVersion?: number;
}

// ============== Portfolio-Dashboard (computed, Phase D) ==============
//
// Aggregat-Antwort fuer GET /portfolios/:id/dashboard. RBAC-gefiltert: enthaelt
// nur Projekte, auf die der aufrufende User mind. viewer-Rolle hat.

export interface PortfolioDashboardHealth {
  gruen: number;
  gelb: number;
  rot: number;
  unbekannt: number;            // Projekte ohne SB oder ohne Ampel
}

export interface PortfolioDashboardPhaseMix {
  initiation: number;
  planning: number;
  execution: number;
  closing: number;
  stopped: number;
  unbekannt: number;            // Projekte ohne project_status
}

export interface PortfolioDashboardBudget {
  plan_total: number;
  ist_total: number;
  abweichung_pct: number | null;  // null wenn plan_total = 0
}

export interface PortfolioDashboardTermine {
  on_track: number;
  gefaehrdet: number;             // 1-30 Tage Verzug oder Risiko
  verspaetet: number;             // > 30 Tage Verzug
  unbekannt: number;
}

export interface PortfolioDashboardTopRisk {
  projekt_id: string;
  projekt_name: string;
  risk_text: string;              // beschreibung (gekuerzt max 200 Chars)
  wahrscheinlichkeit: string;     // Raw-Value aus appConfig.probability ('low'|'medium'|'high')
  auswirkung: string;             // Raw-Value aus appConfig.impact ('low'|'medium'|'high')
  score: number;                  // 1..9 (low=1, medium=2, high=3, dann Produkt)
  ampel?: 'gruen' | 'gelb' | 'rot';
  status?: string;                // risk_tracking.status
}

export interface PortfolioDashboardSbEntry {
  projekt_id: string;
  projekt_name: string;
  sb_id?: string;
  sb_nummer?: number;
  datum?: string;
  ampel?: 'gruen' | 'gelb' | 'rot';
  management_summary?: string;    // gekuerzt (max 200 Chars im Backend)
  status?: 'draft' | 'final';
}

export interface PortfolioDashboardResponse {
  portfolio: Portfolio;
  projekte_total: number;
  projekte_aktiv: number;
  projekte_abgeschlossen: number;
  health: PortfolioDashboardHealth;
  phase_mix: PortfolioDashboardPhaseMix;
  budget: PortfolioDashboardBudget;
  termine: PortfolioDashboardTermine;
  top_risiken: PortfolioDashboardTopRisk[];
  letzte_statusberichte: PortfolioDashboardSbEntry[];
}

// ============== Lessons Learned ==============
//
// Phase E (Lessons Learned) — Sub-Resource am Projekt (heute noch via
// `paProjektauftraege.id` verknuepft, analog Statusberichte).
//
// `themengebiet` und `kategorie` sind freie Strings, deren erlaubte Werte
// aus der App-Config (Einstellungen-Tab) kommen. Defaults stehen unten in
// LESSON_THEMENGEBIET_DEFAULTS / LESSON_KATEGORIE_DEFAULTS.
//
// `kategorie` folgt SWOT (Strength / Weakness / Opportunity / Threat).

export interface LessonLearned {
  id: string;
  paId: string;                  // FK auf Projektauftrag (= Projekt-ID nach Phase A)
  title: string;
  themengebiet: string;          // siehe LESSON_THEMENGEBIET_DEFAULTS
  kategorie: string;             // siehe LESSON_KATEGORIE_DEFAULTS
  beschreibung: string;          // "Worum geht es?"
  auswirkung: string;            // "Was ist die Folge?"
  empfehlung: string;            // "Was geben wir an andere weiter?"
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  version: number;               // optimistic concurrency
}

export interface LessonLearnedCreateInput {
  title: string;
  themengebiet?: string;
  kategorie?: string;
  beschreibung?: string;
  auswirkung?: string;
  empfehlung?: string;
}

export interface LessonLearnedUpdateInput {
  title?: string;
  themengebiet?: string;
  kategorie?: string;
  beschreibung?: string;
  auswirkung?: string;
  empfehlung?: string;
  expectedVersion?: number;
}

/**
 * Default-Themengebiete fuer Lessons Learned. Editierbar via App-Config
 * (Einstellungen-Tab). Die Reihenfolge spiegelt grob den Projekt-Lifecycle.
 */
export const LESSON_THEMENGEBIET_DEFAULTS = [
  { value: 'basis', label: 'Basis' },
  { value: 'stakeholder', label: 'Stakeholder' },
  { value: 'organisation', label: 'Organisation' },
  { value: 'ziele', label: 'Ziele' },
  { value: 'inhalt', label: 'Inhalt' },
  { value: 'roadmap', label: 'Roadmap' },
  { value: 'kosten', label: 'Kosten' },
  { value: 'risiko', label: 'Risiko' },
  { value: 'lessons_learned', label: 'Lessons Learned' },
  { value: 'projektidee', label: 'Projektidee' },
  { value: 'auftragsklaerung', label: 'Auftragsklärung' },
  { value: 'umsetzung', label: 'Umsetzung' },
  { value: 'projektabschluss', label: 'Projektabschluss' },
] as const;

/**
 * SWOT-Kategorien. Editierbar via App-Config.
 */
export const LESSON_KATEGORIE_DEFAULTS = [
  { value: 'strength', label: 'Strength' },
  { value: 'weakness', label: 'Weakness' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'threat', label: 'Threat' },
] as const;

/**
 * KI-Vorschlag aus dem suggest-Endpoint. Wird nicht persistiert; User kann
 * Vorschlaege einzeln annehmen, dann werden sie zu echten Lessons Learned.
 */
export interface LessonLearnedSuggestion {
  title: string;
  themengebiet: string;
  kategorie: string;
  beschreibung: string;
  auswirkung: string;
  empfehlung: string;
  source?: string;               // Hinweis welcher SB / welche Bemerkung den Vorschlag ausgeloest hat
}

// ============== Abschlussbericht (Phase F) ==============
//
// 1:1 Sub-Resource am Projektauftrag (= Projekt-ID nach Phase A). Bündelt
// drei Quellen: (1) letzten SB als Vorbefüllung, (2) Projektauftrag-Felder
// die im SB fehlen, (3) abschluss-spezifische Felder.
//
// Inhaltliche Felder liegen im `data`-jsonb. `status`, `finalized_at` und
// `version` sind strukturierte Spalten.

export type AbschlussStatus = 'draft' | 'final';

/**
 * Bewertung der Stakeholder-Akzeptanz am Projektende — pro Stakeholder ein
 * Eintrag (gemappt via stakeholder_id auf den Auftrag-Snapshot in data).
 */
export interface StakeholderAkzeptanz {
  stakeholder_id: string;
  name?: string;               // Convenience-Field, vom UI mitgeschickt
  bewertung: AmpelStatus;      // gruen | gelb | rot
  bemerkung: string;
}

/**
 * Status eines Abschluss-Checklisten-Eintrags.
 */
export type ChecklistStatus = 'erledigt' | 'offen' | 'na';

/**
 * Definition eines Checklisten-Items (in den App-Einstellungen pflegbar,
 * liegt in der App-Config unter `abschluss_checkliste`).
 */
export interface ChecklistItemConfig {
  id: string;
  label: string;
}

/**
 * Pro-Bericht gespeicherter Zustand eines Checklisten-Items. `label` wird
 * mitgespeichert (Snapshot), damit Exporte auch nach Config-Aenderungen stabil
 * bleiben; `status` ist die User-Auswahl (Default 'offen').
 */
export interface ChecklistItemState {
  id: string;
  label: string;
  status: ChecklistStatus;
}

/**
 * Inhaltlicher Datenblob des Abschlussberichts (im jsonb-Feld `data`).
 * Felder sind Spiegel des Statusbericht-Schemas + Auftrag-Snapshots + Abschluss-
 * spezifische Blöcke. Pre-Fill-Logik siehe abschluss-service.ts.
 */
export interface AbschlussberichtData {
  // === Basis ===
  ampel: AmpelStatus;
  datum: string;                       // Abschluss-Datum (ISO)
  management_summary: string;

  // === Ziele (aus letztem SB) ===
  goals_snapshot: string;
  goals_tracking: CriterionTracking;
  criteria_snapshot: string[];
  criteria_tracking: CriterionTracking[];

  // === Roadmap (aus letztem SB) ===
  milestones_snapshot: MilestoneSnapshot[];
  milestones_tracking: RoadmapItemTracking[];
  tasks_snapshot: TaskSnapshot[];
  tasks_tracking: RoadmapItemTracking[];
  quality_gates_snapshot: QualityGateSnapshot[];
  quality_gates_tracking: RoadmapItemTracking[];

  // === Kosten (aus letztem SB) ===
  cost_budget: number;
  cost_months: CostMonthData[];

  // === Risiken ===
  risk_tracking: RiskTrackingItem[];   // aus letztem SB (Ist-Stand)
  risks_plan: Risk[];                  // aus Auftrag (Original-Risiken)

  // === Aus Projektauftrag (nicht im SB) ===
  project_type?: string;
  auftraggeber?: string;
  description?: string;
  start_date_plan?: string;
  end_date_plan?: string;
  scope?: string;
  in_scope: string[];
  out_scope: string[];
  stakeholders_snapshot: Stakeholder[];
  organization_snapshot: TeamMember[];
  budget_plan: BudgetItem[];

  // === Abschluss-spezifisch (User-input) ===
  key_findings: string;
  stakeholder_akzeptanz: StakeholderAkzeptanz[];
  uebergabe_an: string;
  uebergabe_datum: string;             // ISO
  uebergabe_inhalte: string;
  folgeprojekt_empfehlung: string;
  abnahme_durch: string;
  abnahme_datum: string;               // ISO
  abnahme_signiert: boolean;

  // === Abschluss-Checkliste (unternehmensspezifisch, Items via App-Config) ===
  checkliste?: ChecklistItemState[];
}

export interface Abschlussbericht {
  id: string;
  paId: string;                        // = Projekt-ID
  data: AbschlussberichtData;
  status: AbschlussStatus;
  finalizedAt?: string;
  version: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AbschlussberichtCreateInput {
  // Erstanlage: kein User-Input — Server zieht Pre-Fill aus letztem SB + Auftrag.
  // Future-proof: optional Override fuer Initial-Werte.
  overrides?: Partial<AbschlussberichtData>;
}

export interface AbschlussberichtUpdateInput {
  data?: Partial<AbschlussberichtData>;
  expectedVersion?: number;
}

/**
 * KI-Vorschlag fuer den initialen Entwurf (Management Summary, Key Findings,
 * Folgeprojekt-Empfehlung). Andere Felder (Uebergabe, Abnahme) bleiben User-
 * Input — zu sensibel fuer Halluzinationen.
 */
export interface AbschlussberichtSuggestion {
  management_summary: string;
  key_findings: string;
  folgeprojekt_empfehlung: string;
}

/**
 * Phase-2: Rollen auf Auftrags-/Idee-Ebene. Owner kann loeschen + Permissions
 * setzen, Editor kann bearbeiten + Statusberichte verwalten, Viewer nur lesen.
 * Statusberichte erben vom Auftrag — keine eigenen Permissions.
 */
export const AUFTRAGS_ROLES = ['owner', 'editor', 'viewer'] as const;
export type AuftragsRole = typeof AUFTRAGS_ROLES[number];

export function isAuftragsRole(value: unknown): value is AuftragsRole {
  return typeof value === 'string' && (AUFTRAGS_ROLES as readonly string[]).includes(value);
}

export interface UserPermission {
  userId: string;
  role: AuftragsRole;
}

export interface GroupPermission {
  groupId: string;
  role: AuftragsRole;
}

/**
 * Permissions-Block einer Idee oder eines Auftrags. Wird inline als jsonb-
 * Spalte (Drizzle/Postgres) bzw. inline in metadata.yaml (demo/messe) abgelegt.
 * `null` / fehlend = "noch nicht konfiguriert" — fallback ist `created_by`/`ownerId`.
 */
export interface ResourcePermissions {
  users: UserPermission[];
  groups: GroupPermission[];
}

// ============== Stored KI-Analysen ==============

export interface StoredStepAnalysis {
  step: number;
  stepName: string;
  timestamp: string;
  masterclassAnalysis: {
    staerken: string[];
    schwaechen: string[];
    hinweise: string[];
    score: number;
  };
  konsistenzAnalysis: {
    status: 'konsistent' | 'warnung' | 'inkonsistent';
    findings: {
      bereich: string;
      beschreibung: string;
      empfehlung: string;
    }[];
  };
}

export interface StoredStepAnalyses {
  [stepNumber: number]: StoredStepAnalysis;
}

export interface StoredGesamtbewertung {
  timestamp: string;
  gesamtScore: number;
  projektreife: {
    status: 'bereit' | 'bedingt_bereit' | 'nicht_bereit';
    begruendung: string;
  };
  hauptstaerken: string[];
  hauptrisiken: string[];
  handlungsempfehlungen: string[];
  stepScores: {
    step: number;
    stepName: string;
    score: number;
    kurzfazit: string;
  }[];
  risikoeinschaetzung: {
    level: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
    faktoren: string[];
  };
}

// ============== KI-Analyse ==============

export interface StepAnalysis {
  step: number;
  status: 'ok' | 'warning' | 'error';
  feedback: string[];
  suggestions: string[];
}

export interface ProjektAnalysis {
  overall_score: number; // 0-100
  risk_score: number; // 0-100
  completeness: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  step_analyses: StepAnalysis[];
  analyzed_at: string;
}

// ============== Historischer Vergleich (Schritt 9) ==============

export interface ComparisonDomain {
  domain: 'people' | 'risks' | 'milestones' | 'general';
  similarities: string[];
  differences: string[];
  lessons: string[];
  score: number; // 0-100 similarity score
}

export interface HistoricalComparison {
  reference_projects: string[];
  domains: ComparisonDomain[];
  overall_similarity: number;
  key_insights: string[];
  compared_at: string;
}

// ============== Statusberichte ==============

export type AmpelStatus = 'gruen' | 'gelb' | 'rot';

export interface CriterionTracking {
  fortschritt: number;      // 0-100
  ampel: AmpelStatus;
  bemerkung: string;
}

export interface RoadmapItemTracking {
  fortschritt: number;      // 0-100
  ampel: AmpelStatus;
  bemerkung: string;
  status: string;           // Konfigurierbarer Status-Wert
  ist_datum: string;        // Ist-Datum (vs Soll)
}

// Personen-Veränderung im Projektverlauf (pro Statusbericht, index-aligned zum
// jeweiligen Personen-Snapshot).
export interface PersonTracking {
  status: string;           // 'unveraendert' | 'neu' | 'ausgeschieden' | 'geaendert'
  bemerkung: string;
}

export interface MilestoneSnapshot {
  id: string;
  name: string;
  date: string;
  description: string;
}

export interface TaskSnapshot {
  id: string;
  name: string;
  responsible: string;
  start_date: string;
  end_date: string;
  effort: number;
}

export interface QualityGateSnapshot {
  id: string;
  name: string;
  date: string;
}

export interface RiskTrackingItem {
  id: string;
  auftrag_risk_id?: string;   // Link zum Original-Risiko im Projektauftrag
  type: 'bedrohung' | 'chance';
  strategie: string;          // Konfigurierbar (B-vermeiden, C-nutzen, etc.)
  status: string;             // Konfigurierbar (identifiziert, bewertet, aktiv, etc.)
  verantwortlich: string;
  erkannt: string;            // Datum
  aktualisiert: string;       // System-Datum (auto-update)
  erwartet_bis: string;       // Datum
  ampel: AmpelStatus;
  beschreibung: string;
  auswirkung: string;         // Freitext-Beschreibung der Auswirkung
  massnahmen: string;
  wahrscheinlichkeit: string; // Neubewertung (Config-Option wie im Auftrag)
  auswirkung_bewertung: string; // Neubewertung (Config-Option wie im Auftrag)
}

export interface CostMonthData {
  month: string;          // "2024-08" Format
  plan: number;
  ist: number;
  forecast: number;
}

export interface Statusbericht {
  id: string;                       // "sb-{base36timestamp}-{random6}"
  projekt_id: string;               // Referenz auf Projektauftrag
  nummer: number;                   // Laufende Nummer pro Projekt (1, 2, 3, ...)

  // Tab: Basis
  ampel: AmpelStatus;              // Gesamt-Ampel
  datum: string;                    // ISO-Datum des Berichts
  management_summary: string;       // Freitext

  // Tab: Ziele
  goals_snapshot: string;           // Kopie der Auftrag-Ziele bei Erstellung
  goals_tracking: CriterionTracking;      // Tracking fuer Gesamtziele
  criteria_snapshot: string[];      // Kopie der Auftrag-Kriterien bei Erstellung
  criteria_tracking: CriterionTracking[];  // 1:1 zu criteria_snapshot

  // Tab: Roadmap
  milestones_snapshot: MilestoneSnapshot[];
  milestones_tracking: RoadmapItemTracking[];
  tasks_snapshot: TaskSnapshot[];
  tasks_tracking: RoadmapItemTracking[];
  quality_gates_snapshot: QualityGateSnapshot[];
  quality_gates_tracking: RoadmapItemTracking[];

  // Tab: Kosten (Earned Value Management)
  cost_budget: number;              // Gesamtbudget
  cost_months: CostMonthData[];     // Monatliche Kostendaten

  // Tab: Risiken
  risk_tracking: RiskTrackingItem[];

  // Tab: Personen (read-only Snapshot vom Projektauftrag bei SB-Erstellung)
  organization_snapshot?: TeamMember[];
  stakeholders_snapshot?: Stakeholder[];
  organization_tracking?: PersonTracking[];
  stakeholders_tracking?: PersonTracking[];

  // Metadata
  status: 'draft' | 'final';
  created_at: string;
  updated_at: string;
  created_by: string;
  // Optimistic-Concurrency-Counter — bei jedem Save ++; siehe concurrency.ts.
  version?: number;
}

export interface StatusberichtDashboardEntry {
  projekt_id: string;
  projekt_name: string;
  projektleiter: string;
  project_type: string;
  latest_ampel: AmpelStatus;
  latest_datum: string;
  latest_nummer: number;
  bericht_count: number;
}

// ============== Filters & Stats ==============

export interface ProjektauftragFilters {
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
  project_type?: string;
  projektleiter?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
}

export interface ProjektauftragStats {
  total: number;
  draft: number;
  active: number;
  completed: number;
  cancelled: number;
  total_budget: number;
  avg_risk_score: number;
}

// ============== Vorlagen ==============

export interface Vorlage {
  id: string;
  name: string;
  description: string;
  project_type: string;
  template: Partial<Projektauftrag>;
}

// ============== API Response Types ==============

export interface ProjektauftragListResponse {
  projektauftraege: Projektauftrag[];
  total: number;
}

export interface ProjektauftragDetailResponse {
  projektauftrag: Projektauftrag;
}

export interface AnalysisResponse {
  analysis: StepAnalysis | ProjektAnalysis;
}

export interface ComparisonResponse {
  comparison: HistoricalComparison;
}


// ============== Projektidee ==============

/**
 * Business-Case-Position fuer eine Projektidee.
 * "kategorie" trennt Investitionen (Kosten) von Nutzen (Ertrag) — beide werden
 * vom User mit positiven Betraegen erfasst, das Vorzeichen wird erst in der
 * ROI-Berechnung interpretiert.
 */
export interface BusinessCaseItem {
  id: string;
  beschreibung: string;
  betrag: number;                // immer positiv erfasst
  anbieter?: string;
  hinweis?: string;              // optional, freier Text
}

export type ProjektideeStatus = 'draft' | 'review' | 'approved' | 'rejected' | 'archived';

export interface Projektidee {
  id: string;

  // Portfolio-Zuordnung (0..1) — im data-JSONB der Idee gespeichert.
  portfolioId?: string | null;

  // Tab 1: Basis (alle Felder aus PDF)
  projekt_id?: string;           // optional Kennummer (z.B. PRJ-2026-001)
  name: string;
  project_type?: 'internal' | 'external' | 'research' | 'infrastructure';
  status: ProjektideeStatus;     // "Projektidee Status" aus PDF
  project_status?: string;       // freier Status, "Projektstatus" aus PDF
  projekttreiber?: string;
  projektgroesse?: 'klein' | 'mittel' | 'gross' | 'sehr_gross';
  prioritaet?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;          // Kurzbeschreibung
  start_date?: string;
  end_date?: string;
  projektleiter?: string;
  auftraggeber?: string;

  // Tab 2: Ziele
  goals: string;

  // Tab 3: Projektkontext
  context: {
    ausgangslage: string;        // "Warum und in welchem Rahmen ist die Projektidee entstanden?"
    rahmenbedingungen: string;   // "Von welchen Faktoren ist die Projektidee abhaengig?"
  };
  in_scope?: string[];           // Im Projektumfang (analog Auftrag)
  out_scope?: string[];          // Ausserhalb des Projekts (analog Auftrag)

  // Tab 4: Business Case
  business_case: {
    investitionen: BusinessCaseItem[];   // Kosten
    nutzen: BusinessCaseItem[];          // Ertrag
  };

  // Tab 5: Unternehmensrisiken (gleiche Struktur wie Projektrisiken im Auftrag)
  unternehmensrisiken: Risk[];

  // Tab Personen (gleiche Maske wie im Projektauftrag; inkl. geplanter_einsatz)
  organization?: TeamMember[];
  stakeholders?: Stakeholder[];

  // Tab 6: Uebersicht — read-only-zusammenfassung, kein eigener State

  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
  current_step: number;
  // Optimistic-Concurrency-Counter — bei jedem Save ++; Frontend sendet
  // `expected_version` mit, Backend lehnt mit 409 ab wenn != current.
  version?: number;

  // Verknuepfung zu daraus erzeugten Auftraegen (umgekehrte Richtung: Auftrag.idee_id ist die Quelle of truth)
  // Wird via JOIN bei der Abfrage gefuellt.
  abgeleitete_auftraege?: { id: string; name: string; status: string; created_at: string }[];

  // Phase-2 Idee-Level Permissions. NULL/missing = nur created_by ist Owner.
  permissions?: ResourcePermissions | null;
}

