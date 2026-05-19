/**
 * Apps Framework Types
 * Type definitions for the modular apps system
 */

export interface AppRoute {
  path: string;
  component: string;
}

/**
 * App-Berechtigung pro Gruppe.
 *
 * - owner   = fachlicher Eigentuemer (in Phase 2 von der App selbst interpretiert,
 *             z.B. "Ersteller einer Idee"). KEIN App-Settings-Recht — das bleibt
 *             globaler Admin-Rolle vorbehalten.
 * - editor  = darf inhaltlich aendern, anlegen, evtl. loeschen
 * - viewer  = read-only
 */
export const APP_ROLES = ['owner', 'editor', 'viewer'] as const;
export type AppRole = typeof APP_ROLES[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value);
}

export interface AppGroupPermission {
  groupId: string;
  role: AppRole;
}

export interface AppConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  enabled: boolean;
  routes: AppRoute[];
  /**
   * Gruppen-basierte Berechtigungen (Phase 1: Sichtbarkeit-Filter beim Aufruf).
   * Leer = "noch nicht konfiguriert" — Admin sieht im Aufruf einen
   * "Wartet auf Konfiguration"-Hinweis, andere User die "Keine Berechtigung"-Page.
   */
  permissions?: {
    groups: AppGroupPermission[];
  };
  /**
   * Optional list of functions this app exposes as Public-API endpoints
   * (see backend/src/public-api/). Structural typing avoids a circular
   * import — the router narrows via the PublicFunction contract.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicFunctions?: Array<{
    id: string;
    description: string;
    input: unknown;
    output?: unknown;
    defaultRateLimit?: { requests: number; windowSec: number };
    handler: (input: any, ctx: any) => Promise<any>;
  }>;
}

export interface AppsRegistry {
  apps: Record<string, AppConfig>;
}

export interface AppInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  enabled: boolean;
  routes: AppRoute[];
  permissions?: {
    groups: AppGroupPermission[];
  };
}

// Contract Management specific types
export interface ContractSchemaField {
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  required?: boolean;
  label?: string;
  options?: string[];
}

export interface ContractSchemaFieldGroup {
  [fieldName: string]: ContractSchemaField;
}

/**
 * Konfiguriert die Heavy-Extraction-Pipeline pro Schema (siehe
 * `backend/src/services/extraction/`). Optional — wenn nicht gesetzt, gelten
 * Defaults aus `extraction/defaults.ts` (Strategy `single-pass`, Confidence-
 * Threshold 0.6 etc.).
 */
export interface ContractSchemaExtractionConfig {
  strategy?: 'single-pass' | 'long-text-chunked' | 'vision-per-page' | 'hybrid';
  chunk_size_tokens?: number;
  chunk_overlap_tokens?: number;
  section_aware?: boolean;
  merge_strategy?: 'first-non-null' | 'majority-vote' | 'priority-by-section' | 'union';
  confidence_threshold?: number;
  vision_fallback?: boolean;
  vision_detail?: 'low' | 'high';
  max_pages?: number;
  max_concurrent?: number;
  model_override?: {
    provider_id: string;
    model_id: string;
  } | null;
}

export interface ContractSchema {
  id: string;
  name: string;
  icon: string;
  fields: Record<string, ContractSchemaFieldGroup>;
  mapping: {
    party_a: string;
    party_b: string;
    start_date: string;
    end_date: string;
    value: string;
  };
  /**
   * Optional: Konfiguration der Heavy-Extraction-Pipeline fuer diesen
   * Vertragstyp. Wenn nicht gesetzt, faellt auf `single-pass` mit Defaults
   * zurueck.
   */
  extraction?: ContractSchemaExtractionConfig;
}

export interface ContractObligation {
  party: string;
  category: string;
  description: string;
  recurrence?: string;
}

export interface ContractMetadata {
  id: string;
  contract_type: string;
  upload_filename: string;
  uploaded_at: string;
  uploaded_by: string;
  extracted: Record<string, any>;
  computed: {
    party_a: string;
    party_b: string;
    start_date: string;
    end_date: string;
    annual_value: number;
    status: 'active' | 'expiring' | 'expired';
    days_to_expiry: number | null;
  };
  obligations: ContractObligation[];

  // Phase-2 Multi-File / Auto-Detection / Provenance — optional, da nur fuer
  // Vertraege die ueber den neuen Import-Wizard angelegt wurden.
  attachments?: ContractAttachment[];
  primary_attachment_id?: string | null;
  type_detection?: ContractTypeDetection | null;
  provenance?: Record<string, string[]> | null;     // fieldKey → [attachmentId, ...]
  extracted_history?: ContractExtractionSnapshot[]; // bei Re-Extraktion archiviert

  // Phase D / P4 — Heavy-Extraction-Pipeline-Output. Per-Feld-Konfidenz aus
  // dem LLM-Self-Reflection-Scoring; Provenance pro Feld (Chunk/Page-Quellen).
  // Frontend zeigt Felder unter Schema.extraction.confidence_threshold mit
  // gelber Markierung + Tooltip.
  field_confidences?: Record<string, number> | null;          // dotted path → [0..1]
  extraction_provenance?: ContractFieldProvenance[] | null;   // pro Feld eine Source-Notiz
  /** Welche Strategy hat zuletzt extrahiert (single-pass | long-text-chunked | vision-per-page | hybrid). */
  extraction_strategy?: string | null;
}

/**
 * Ein Provenance-Eintrag der Heavy-Pipeline. `source` ist ein kompaktes Format:
 *   `c:N`      — Chunk-Index
 *   `c:N+M`    — mehrere Chunks (Union)
 *   `p:<page>` — Seite (Vision-Strategy)
 *   `p:<a>+<b>` — mehrere Seiten
 */
export interface ContractFieldProvenance {
  field: string;
  value: unknown;
  source: string;
  confidence?: number;
}

/** 'hauptvertrag' | 'anhang' | 'toolbox' | 'korrespondenz' | 'sonstiges'. */
export type ContractDocumentRole =
  | 'hauptvertrag'
  | 'anhang'
  | 'toolbox'
  | 'korrespondenz'
  | 'sonstiges';

export interface ContractAttachment {
  id: string;
  contract_id: string;
  filename: string;
  content_type?: string;
  s3_key_original: string;
  s3_key_markdown?: string | null;
  size_bytes?: number;
  document_role: ContractDocumentRole;
  uploaded_at: string;
}

export interface ContractTypeDetection {
  detected: string;                                 // contractType-id (z.B. 'mietvertrag')
  confidence: number;                               // 0..1
  alternatives: { type: string; confidence: number }[];
  user_corrected: boolean;
  corrected_at?: string | null;
}

/** Bei Re-Extraktion mit anderem Vertragstyp wird der alte Stand archiviert. */
export interface ContractExtractionSnapshot {
  contract_type: string;
  extracted: Record<string, any>;
  archived_at: string;
}

export interface ContractFilters {
  type?: string;
  status?: 'active' | 'expiring' | 'expired';
  party?: string;
  search?: string;
}

export interface ContractStats {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  totalValue: number;
}
