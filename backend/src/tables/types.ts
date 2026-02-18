/**
 * Table Types and Interfaces
 *
 * Defines the structure for the file-based table system including
 * schemas, columns, rows, views, and relations.
 */

// ============================================
// Column Types
// ============================================

export type ColumnType =
  | 'text'        // Single-line text
  | 'text_long'   // Multi-line text
  | 'number'      // Integer or float
  | 'date'        // Date only
  | 'datetime'    // Date + time
  | 'boolean'     // Yes/No
  | 'email'       // Email (validated)
  | 'url'         // URL (validated)
  | 'tags'        // Array of strings
  | 'select'      // Single selection from options
  | 'relation';   // Reference to another table

export interface ColumnDefinition {
  /** Unique column identifier */
  id: string;

  /** Display name */
  name: string;

  /** Column data type */
  type: ColumnType;

  /** Whether this column is required */
  required?: boolean;

  /** Default value for new rows */
  default?: any;

  /** Description/help text */
  description?: string;

  // Type-specific options

  /** For 'select' type: available options */
  options?: string[];

  /** For 'relation' type: target table ID */
  relation_table?: string;

  /** For 'relation' type: display column in target table */
  relation_display_column?: string;

  /** For 'number' type: minimum value */
  min?: number;

  /** For 'number' type: maximum value */
  max?: number;

  /** For 'number' type: decimal places */
  decimals?: number;

  /** For 'text' type: maximum length */
  max_length?: number;
}

// ============================================
// View Definitions
// ============================================

export interface ViewDefinition {
  /** Unique view identifier */
  id: string;

  /** Display name */
  name: string;

  /** Filter expression (simple query language) */
  filter?: string;

  /** Sort expression (e.g., "name ASC" or "created_at DESC") */
  sort?: string;

  /** Columns to display (if not specified, show all) */
  columns?: string[];

  /** Description */
  description?: string;
}

// ============================================
// Table Schema
// ============================================

export interface TableSettings {
  /** Column to use as primary display */
  primary_column?: string;

  /** Default sort column */
  default_sort?: string;

  /** Default sort direction */
  default_sort_direction?: 'ASC' | 'DESC';

  /** Column to use for row coloring */
  row_color_by?: string;

  /** Color mapping for row_color_by column values */
  row_colors?: Record<string, string>;
}

export interface TableSchema {
  /** Unique table identifier (directory name) */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description?: string;

  /** Optional icon (emoji) */
  icon?: string;

  /** Column definitions */
  columns: ColumnDefinition[];

  /** Table settings */
  settings?: TableSettings;

  /** Saved views */
  views?: ViewDefinition[];

  /** Creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;
}

// ============================================
// Row Data
// ============================================

export interface RowData {
  /** Unique row identifier */
  _id: string;

  /** Creation timestamp */
  _created_at?: string;

  /** Last update timestamp */
  _updated_at?: string;

  /** Dynamic column values */
  [columnId: string]: any;
}

export interface TableData {
  /** Last update timestamp */
  updated_at: string;

  /** Total row count */
  row_count: number;

  /** Array of rows */
  rows: RowData[];
}

// ============================================
// Combined Table (Schema + Data)
// ============================================

export interface Table extends TableSchema {
  /** Row data */
  data?: TableData;
}

// ============================================
// Query & Filter Types
// ============================================

export type FilterOperator =
  | 'eq'       // equals
  | 'neq'      // not equals
  | 'gt'       // greater than
  | 'gte'      // greater than or equal
  | 'lt'       // less than
  | 'lte'      // less than or equal
  | 'contains' // string contains
  | 'starts'   // string starts with
  | 'ends'     // string ends with
  | 'in'       // value in array
  | 'nin'      // value not in array
  | 'empty'    // is empty/null
  | 'nempty';  // is not empty/null

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value?: any;
}

export interface QueryOptions {
  /** Filter conditions (AND) */
  filters?: FilterCondition[];

  /** Natural language filter (parsed to conditions) */
  filter_text?: string;

  /** Sort column */
  sort_by?: string;

  /** Sort direction */
  sort_direction?: 'ASC' | 'DESC';

  /** Number of rows to skip */
  offset?: number;

  /** Maximum number of rows to return */
  limit?: number;

  /** Columns to include (if not specified, all) */
  columns?: string[];

  /** Whether to resolve relations to their display values */
  resolve_relations?: boolean;
}

export interface QueryResult {
  /** Matched rows */
  rows: RowData[];

  /** Total count (before pagination) */
  total: number;

  /** Offset used */
  offset: number;

  /** Limit used */
  limit: number;
}

// ============================================
// CRUD Operation Types
// ============================================

export interface CreateTableParams {
  /** Table ID (will be sanitized) */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description?: string;

  /** Icon */
  icon?: string;

  /** Column definitions */
  columns: ColumnDefinition[];

  /** Settings */
  settings?: TableSettings;

  /** Initial views */
  views?: ViewDefinition[];
}

export interface UpdateTableParams {
  /** New display name */
  name?: string;

  /** New description */
  description?: string;

  /** New icon */
  icon?: string;

  /** Updated settings */
  settings?: TableSettings;
}

export interface AddRowParams {
  /** Column values */
  data: Record<string, any>;
}

export interface UpdateRowParams {
  /** Row ID */
  row_id: string;

  /** Updated column values */
  data: Record<string, any>;
}

// ============================================
// Import/Export Types
// ============================================

export type ExportFormat = 'json' | 'csv' | 'yaml';

export interface ExportOptions {
  /** Export format */
  format: ExportFormat;

  /** Columns to export (if not specified, all) */
  columns?: string[];

  /** Filter to apply before export */
  filter?: FilterCondition[];

  /** Whether to include schema */
  include_schema?: boolean;
}

export interface ImportOptions {
  /** Import format */
  format: ExportFormat;

  /** Column mapping (source column -> target column) */
  column_mapping?: Record<string, string>;

  /** Whether to update existing rows (by ID) or always create new */
  update_existing?: boolean;

  /** Whether to skip rows with validation errors */
  skip_invalid?: boolean;
}

export interface ImportResult {
  /** Number of rows imported */
  imported: number;

  /** Number of rows updated (if update_existing) */
  updated: number;

  /** Number of rows skipped */
  skipped: number;

  /** Errors encountered */
  errors: Array<{
    row: number;
    message: string;
    data?: Record<string, any>;
  }>;
}

// ============================================
// Relation Types
// ============================================

export interface RelationInfo {
  /** Source table */
  source_table: string;

  /** Source column (type: relation) */
  source_column: string;

  /** Target table */
  target_table: string;

  /** Display column in target table */
  display_column?: string;
}

// ============================================
// Template Types
// ============================================

export interface TableTemplate {
  /** Template ID */
  id: string;

  /** Template name */
  name: string;

  /** Description */
  description: string;

  /** Icon */
  icon?: string;

  /** Tables to create */
  tables: CreateTableParams[];
}

// ============================================
// Validation Types
// ============================================

export interface ValidationError {
  column: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
