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
}

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  interest: 'low' | 'medium' | 'high';
  influence: 'low' | 'medium' | 'high';
  expectations?: string;
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

  // Verknuepfung zur Quell-Idee (sofern aus einer Idee generiert).
  // idee_id wird in der Auftrag-YAML persistiert; idee?: {...} wird beim Read
  // angereichert (File-Lookup auf die Idee-YAML).
  idee_id?: string;
  idee?: { id: string; name: string };

  // Legacy - kept for compatibility
  analysis?: ProjektAnalysis;
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

  // Metadata
  status: 'draft' | 'final';
  created_at: string;
  updated_at: string;
  created_by: string;
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

  // Tab 6: Uebersicht — read-only-zusammenfassung, kein eigener State

  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
  current_step: number;

  // Verknuepfung zu daraus erzeugten Auftraegen (umgekehrte Richtung: Auftrag.idee_id ist die Quelle of truth)
  // Wird via JOIN bei der Abfrage gefuellt.
  abgeleitete_auftraege?: { id: string; name: string; status: string; created_at: string }[];
}

