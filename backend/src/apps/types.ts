/**
 * Apps Framework Types
 * Type definitions for the modular apps system
 */

export interface AppRoute {
  path: string;
  component: string;
}

export interface AppConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  enabled: boolean;
  routes: AppRoute[];
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
