/**
 * Document Generator Types
 * Shared type definitions for document generation
 */

export interface DocumentData {
  title: string;
  metadata: Record<string, string>;
  sections: DocumentSection[];
}

export interface DocumentSection {
  title: string;
  type: 'text' | 'table' | 'list' | 'keyvalue';
  content: any;
}

export interface TableContent {
  headers: string[];
  rows: (string | number)[][];
}

export interface KeyValueContent {
  items: { key: string; value: string }[];
}

export interface ListContent {
  items: string[];
}

export type DocumentFormat = 'xlsx' | 'pdf' | 'docx';
