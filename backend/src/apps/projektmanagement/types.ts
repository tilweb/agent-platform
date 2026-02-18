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
