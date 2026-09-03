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
  /** Kontrollierte Werteliste (Welle 6) — auch fuer Positions-Spalten (z.B. Einheit). */
  catalog?: FieldCatalog;
  /** Anker-Aliasse fuer deterministische Strategien (template-labelmap). */
  aliases?: string[];
}

export interface ProjectField {
  type: ProjectFieldType;
  required: boolean;
  label: string;
  description?: string;
  /** Nur bei type === 'list': Spalten der Positions-Tabelle (1 Ebene tief). */
  item_fields?: Record<string, ProjectItemField>;
  /** Kontrollierte Werteliste (Welle 6); auf Listen-Feldern selbst sinnlos. */
  catalog?: FieldCatalog;
  /** Anker-Aliasse fuer deterministische Strategien (template-labelmap). */
  aliases?: string[];
}

// ============== Kontrollierte Wertelisten (Welle 6) ==============

/** Ein zulaessiger Wert samt gepflegten Schreibvarianten. */
export interface CatalogValue {
  /** Die kanonische Schreibweise — auf sie wird gemappt. */
  value: string;
  /** Bekannte Varianten/Abkuerzungen, die auf `value` zeigen. */
  synonyms?: string[];
}

/**
 * Endliche Liste zulaessiger Werte eines Feldes. Wirkt an drei Stellen:
 * im Extraktions-Prompt (die Werte stehen im Feld-Hinweis), beim Normalisieren
 * (eindeutige Treffer werden auf die kanonische Schreibweise gesetzt) und in der
 * Pruefung (ein Wert ausserhalb der Liste ist ein Befund).
 */
export interface FieldCatalog {
  /** 'list' = am Feld gepflegt, 'table' = Spalte einer Tabelle (Tables-Feature). */
  source: 'list' | 'table';
  /** Nur bei source 'list'. */
  values?: CatalogValue[];
  /** Nur bei source 'table'. */
  table_id?: string;
  column_id?: string;
  /** Wirkung eines Werts ausserhalb der Liste; Default 'error' (erzwingt Review). */
  severity?: Extract<RuleSeverity, 'error' | 'warn'>;
  /** Eindeutige Treffer automatisch auf die kanonische Schreibweise setzen; Default true. */
  auto_map?: boolean;
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
  /**
   * Eval-Alignment (W9): Die Messung laeuft text-basiert (single-pass auf dem
   * gespeicherten document_text) — Beispiele tragen keine Bilder. Bei
   * Vision-Profilen misst sie damit NICHT die Produktions-Pipeline; das wird
   * hier ausgewiesen statt verschwiegen.
   */
  measured_strategy?: string;
  production_strategy?: string;
  aligned?: boolean;
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

/**
 * `error` erzwingt das Review, `warn` ist ein Hinweis, `info` protokolliert nur
 * (z.B. eine automatische Angleichung an einen Katalogwert) und blockiert nichts.
 */
export type RuleSeverity = 'error' | 'warn' | 'info';

/** Ein konkreter Befund aus der Regel-/Katalogpruefung eines Extraktionsergebnisses. */
export interface RuleIssue {
  rule_id: string;
  type: ExtractionRule['type'] | 'catalog' | 'ocr' | 'processing' | 'segment';
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

// ============== Segmentierung (Welle 10) ==============

/**
 * Ein Segmenttyp eines Profils. `description` ist Prosa fuer die
 * Seiten-Klassifikation (wie bei `instructions`): Woran erkennt man eine Seite
 * dieses Typs? Welche Signale markieren den BEGINN einer neuen Instanz
 * (Briefkopf, "Seite 1 von N", eigene Kennung)?
 */
export interface SegmentTypeDef {
  label: string;
  /** Prosa-Beschreibung fuer die Seiten-Klassifikation. Pflicht. */
  description: string;
  /** Feldsatz des Segments — gleiche Form wie `project.fields`. Nur bei mode 'extract'. */
  fields?: Record<string, ProjectField>;
  /**
   * 'extract' (Default) | 'classify-only': ein Nachweis wird erkannt und belegt
   * (Typ + Seiten + Kurzbeschreibung), aber nicht feld-extrahiert.
   */
  mode?: 'extract' | 'classify-only';
  /** Duerfen mehrere Instanzen vorkommen (drei Nachweise -> drei Segmente)? */
  repeatable?: boolean;
  /** Fehlt das Segment im Dokument -> Befund + "Zu pruefen". */
  required?: boolean;
}

/** Eingebaute Segmenttypen — existieren in jedem Segment-Profil, nie deklarierbar. */
export const BUILTIN_SEGMENT_TYPES = ['leerseite', 'unbekannt'] as const;

/**
 * Eine erkannte Segment-Instanz am Lauf-Ergebnis. `type` ist ein Schluessel aus
 * `project.segments` oder ein eingebauter Typ.
 */
export interface SegmentInstance {
  type: string;
  /** 1..n je Typ (bei repeatable). */
  instance: number;
  pageFrom: number;
  pageTo: number;
  /** Kleinste Seiten-Klassifikations-Konfidenz der Instanz (0..1). */
  confidence: number;
  /** Kurzbeleg bei mode 'classify-only'. */
  summary?: string;
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
   * Segmenttypen (Welle 10): typisierte Abschnitte INNERHALB eines Vorgangs
   * (Anschreiben + Formular + Nachweis in einem Scan). Kein `segments` =
   * heutiges Verhalten (ein impliziter Segmenttyp ueber alle Seiten).
   * Die eingebauten Typen `leerseite` und `unbekannt` existieren immer und
   * duerfen hier nicht deklariert werden.
   */
  segments?: Record<string, SegmentTypeDef>;
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
  /**
   * Embedding des Dokumenttexts (Welle 5) fuer die Aehnlichkeits-Auswahl der
   * Few-Shot-Beispiele. Optional — alte Beispiele und Instanzen ohne
   * Embedding-Modell haben es nicht.
   */
  embedding?: number[] | null;
}
