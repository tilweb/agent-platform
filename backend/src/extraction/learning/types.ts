/**
 * Learning Extraction - Type Definitions
 *
 * Flat, intent-based extraction with learning from corrections.
 */

import type { ExtractionConfig } from '../../services/extraction';

export type FieldType = 'text' | 'number' | 'date' | 'boolean';

/** Projekt-Feldtypen: Skalare plus Listen (Positionsdaten, z.B. Rechnungspositionen). */
export type ProjectFieldType = FieldType | 'list';

/**
 * Spalte einer Positions-Tabelle (list-Feld). Bewusst KEIN 'list' als Typ —
 * Listen sind genau eine Ebene tief (keine Verschachtelung).
 */
export interface ProjectItemField {
  type: FieldType;
  label: string;
  required?: boolean;
  description?: string;
}

export interface ProjectField {
  type: ProjectFieldType;
  required: boolean;
  label: string;
  description?: string;
  /** Nur bei type === 'list': Spalten der Positions-Tabelle (1 Ebene tief). */
  item_fields?: Record<string, ProjectItemField>;
}

/** Type-Guard: ist das Projekt-Feld eine Positions-Liste? */
export function isListField(f: ProjectField): boolean {
  return f.type === 'list';
}

/** Gemessener Eval-Score (Champion/Challenger) auf dem Beispiel-Set. */
export interface EvalScore {
  /** Anteil korrekter (Beispiel, Feld)-Paare in Prozent (0..100, 1 Nachkommastelle). */
  overall: number;
  /** Accuracy je Feld in Prozent. */
  by_field: Record<string, number>;
  /** Anzahl erfolgreich ausgewerteter Beispiele. */
  examples: number;
}

export type EvalRunAction = 'accepted' | 'rejected' | 'measured' | 'initial' | 'error';

/**
 * Eval-Zustand des Lern-Loops (Welle 2). Liegt in `learning.eval` (jsonb/YAML —
 * keine Migration). Champion = Score der aktuell aktiven Guidelines.
 */
export interface LearningEvalState {
  status: 'idle' | 'running';
  /** Start des laufenden Laufs (Stale-Erkennung: >10 min alt → ignorieren). */
  started_at?: string;
  champion?: EvalScore & {
    eval_set_hash: string;
    guideline_version: number;
    model: string;
    at: string;
  };
  last_run?: {
    at: string;
    action: EvalRunAction;
    challenger_overall?: number;
    champion_overall?: number;
    examples?: number;
    message?: string;
  };
  /** Kompakte Historie, Cap 20 (neueste zuerst). */
  history?: Array<{
    at: string;
    action: EvalRunAction;
    champion?: number;
    challenger?: number;
    examples?: number;
    version?: number;
  }>;
}

/** Review-Triage-Status einer Batch-Datei (Welle 3). */
export type ReviewStatus = 'auto_ok' | 'needs_review' | 'reviewed';

// ============== Fachliche Pruefregeln (Welle 5) ==============

/**
 * Summen-Check: Die Werte einer Positions-Spalte muessen (in Toleranz) den Wert
 * eines skalaren Zielfelds ergeben — z.B. Rechnungspositionen ↔ Gesamtbetrag.
 */
export interface SumRule {
  id: string;
  type: 'sum';
  /** fieldId eines `list`-Felds. */
  list_field: string;
  /** Spalten-Id innerhalb von `item_fields` (numerisch). */
  item_field: string;
  /** fieldId des skalaren (numerischen) Zielfelds. */
  target_field: string;
  /** Absolute Toleranz; Default 0.01. */
  tolerance?: number;
  label?: string;
}

/**
 * Stammdaten-Abgleich: Der Feldwert muss in einer Spalte einer Tabelle
 * (Tables-Feature) vorkommen. Vorstufe zu W6 (kontrollierte Wertelisten) —
 * die Wertequelle ist bewusst hinter `loadAllowedValues` gekapselt.
 */
export interface LookupRule {
  id: string;
  type: 'lookup';
  /** fieldId eines skalaren Felds. */
  field: string;
  table_id: string;
  column_id: string;
  /** Default 'error' (erzwingt Review); 'warn' nur anzeigen. */
  severity?: RuleSeverity;
  label?: string;
}

export type ExtractionRule = SumRule | LookupRule;

export type RuleSeverity = 'error' | 'warn';

/** Ein konkreter Befund aus der Regelpruefung eines Extraktionsergebnisses. */
export interface RuleIssue {
  rule_id: string;
  type: ExtractionRule['type'];
  severity: RuleSeverity;
  /** Klartext fuer die UI (deutsch, mit den beteiligten Werten). */
  message: string;
  /** Beteiligte fieldIds — fuer die Markierung im Formular. */
  fields: string[];
}

/**
 * Konfidenz-Kalibrierung (Welle 3): aggregiert je Konfidenz-Bucket (0–0.2 …
 * 0.8–1.0), wie oft die initiale Extraktion tatsaechlich korrekt war. Wird bei
 * jedem Korrektur-Training fortgeschrieben (Training-Tab + Batch-Review).
 */
export interface CalibrationState {
  /** 5 Buckets: [0,0.2), [0.2,0.4), [0.4,0.6), [0.6,0.8), [0.8,1.0]. */
  buckets: Array<{ total: number; correct: number }>;
  /** Gesamtzahl der (Feld, Beispiel)-Samples. */
  samples: number;
  updated_at: string;
}

export interface LearningMetadata {
  total_examples: number;
  accuracy_estimate: number;
  guideline_version: number;
  /** Eval-Harness-Zustand (optional — alte Projekte haben das Feld nicht). */
  eval?: LearningEvalState;
  /** Konfidenz-Kalibrierung (optional — waechst mit Korrekturen). */
  calibration?: CalibrationState;
}

export interface ExtractionProject {
  id: string;
  name: string;
  description: string;
  created: string;
  updated: string;
  fields: Record<string, ProjectField>;
  /**
   * Hand-gepflegte Domaenen-Anweisungen. Stabil — wird vom Lern-Loop NICHT
   * ueberschrieben (anders als `guidelines`). Wird im Vision-/Extraktions-Prompt
   * VOR den gelernten Guidelines + Few-Shot gerendert.
   */
  instructions?: string;
  guidelines: string;
  learning: LearningMetadata;
  /**
   * Optionale Heavy-Pipeline-Konfiguration (Strategie + Parameter). Wenn nicht
   * gesetzt, nutzt der Adapter Default `hybrid`. Pro-Projekt in den
   * Projekt-Settings konfigurierbar.
   */
  extraction?: ExtractionConfig;
  /**
   * Fachliche Pruefregeln (Welle 5): Plausibilitaet des Ergebnisses jenseits von
   * Typ/Format — Summen-Check und Stammdaten-Abgleich. Ein `error`-Befund hebt
   * die Batch-Datei unabhaengig von der Konfidenz auf "Zu pruefen".
   */
  rules?: ExtractionRule[];
  /**
   * Webhook-Ziel des Projekts (Welle 5). `url` ist der Default fuer alle Laeufe
   * (auch UI-Laeufe); eine `callback_url` in der API-Anfrage schlaegt sie.
   * `secret` signiert JEDE Zustellung des Projekts (HMAC-SHA256).
   */
  webhook?: { url?: string; secret?: string };
}

export interface TrainingExample {
  id: string;
  created: string;
  source_filename: string;
  document_text: string;
  initial_extraction: Record<string, unknown>;
  corrected_extraction: Record<string, unknown>;
  corrections: Array<{
    field: string;
    was: unknown;
    corrected_to: unknown;
  }>;
  confirmed_correct: boolean;
}
