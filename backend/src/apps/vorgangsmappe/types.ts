/**
 * Vorgangsmappe — Type Definitions
 */

import type { StructuredSearchHit } from '../../connections/providers/docuware/search';

export interface VorgangsmappeConfig {
  cabinet: {
    id: string;
    displayName: string;
  };
  reference_field: string;          // DocuWare-DBFieldName fuer die AB-Nummer (z.B. "REFERENCE")
  document_type_field: string;      // DBFieldName fuer die Dokumentenart (z.B. "DOCUMENT_TYPE")
  incoterm_field?: string | null;   // DBFieldName fuer Incoterm (z.B. "INCOTERM")
  geschaeftsart_field?: string | null; // DBFieldName fuer Geschaeftsart (z.B. "GESCHAFTSART")
  status_field?: string | null;     // DBFieldName fuer Vorgangs-Status (statusgebende Docs)
  doc_status_field?: string | null; // DBFieldName fuer Pro-Doc-Status (Filter + Anzeige)
  // Legacy/Fallback — wird nicht mehr aktiv genutzt (Compliance kommt aus DB).
  vorgangstyp_field?: string | null;
  default_requirement_set?: string;
}

export interface RequirementRule {
  id: string;
  label: string;
  required: boolean;
  match_any: string[];   // Werte zum Match gegen document_type_field; "*" als Wildcard
}

export interface RequirementSet {
  id: string;
  name: string;
  requirements: RequirementRule[];
}

export interface ComplianceItem {
  id: string;
  label: string;
  required: boolean;
  status: 'ok' | 'missing' | 'optional_missing';
  matchedDocIds: Array<number | string>;
}

export interface ComplianceReport {
  ruleSet: string;
  ruleSetName: string;
  items: ComplianceItem[];
  overall: 'complete' | 'incomplete' | 'partial' | 'no_rule';
  // Quelle der Regel — entweder eine Incoterm/Geschaeftsart-Kombi aus DB,
  // oder ein Fallback-Hinweis.
  source?: {
    incoterm?: string;
    geschaeftsart?: string;
    /** Erklaerung wenn keine Regel gefunden wurde. */
    note?: string;
  };
}

export interface VorgangSummary {
  reference: string;
  documentCount: number;
  dateRange: { from: string | null; to: string | null } | null;
  cabinetId: string;
  cabinetName?: string;
}

export interface VorgangDetail extends VorgangSummary {
  documents: StructuredSearchHit[];
  vorgangstyp: string;
  compliance: ComplianceReport;
  /**
   * Vorgangs-Status: Wert aus dem ersten Doc das (a) zu einem
   * statusgebenden Doc-Type matched und (b) einen Wert im status_field
   * traegt. null wenn keiner passt.
   */
  status: string | null;
  /**
   * Quelle der Status-Herkunft (Debug/Tooltip).
   */
  status_source?: {
    documentId: number | string;
    documentTypeId: string;
    documentTypeLabel: string;
  } | null;
}

/**
 * Output des LLM-NLU-Parsers. `filters` ist direkt an
 * executeStructuredSearch weitergebbar.
 */
export interface NluInterpretation {
  filters: Array<{ field: string; values: string[] }>;
  operation: 'And' | 'Or';
  interpretation: string;
  used_llm: boolean;       // false = Fast-Path (AB-Pattern) ohne LLM-Roundtrip
}
