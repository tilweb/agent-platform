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
export type AppRole = 'owner' | 'editor' | 'viewer';

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
  provenance?: Record<string, string[]> | null;
  extracted_history?: ContractExtractionSnapshot[];
}

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
  detected: string;
  confidence: number;
  alternatives: { type: string; confidence: number }[];
  user_corrected: boolean;
  corrected_at?: string | null;
}

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
