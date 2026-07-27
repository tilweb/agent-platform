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
  /**
   * Nur XLSX: Ziel-Tabellenblatt dieser Section. Ohne Angabe landet sie auf dem
   * Default-Blatt "Daten". Andere Generatoren (pdf/docx/md) ignorieren das Feld
   * und rendern alle Sections weiterhin sequentiell.
   */
  sheet?: string;
}

/**
 * Rich cell value — supports colored indicator dots in tables and key-value sections.
 * Plain strings are still supported everywhere; RichCell is opt-in.
 */
export interface RichCell {
  text: string;
  dot?: string;  // hex color for a status dot rendered before the text (e.g. '#22C55E')
}

/** A table cell can be a plain string/number or a RichCell with indicator */
export type CellValue = string | number | RichCell;

export interface TableContent {
  headers: string[];
  rows: CellValue[][];
}

export interface KeyValueContent {
  items: { key: string; value: string | RichCell }[];
}

export interface ListContent {
  items: string[];
}

export type DocumentFormat = 'xlsx' | 'pdf' | 'docx' | 'md';
