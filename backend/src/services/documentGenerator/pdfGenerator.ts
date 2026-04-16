/**
 * PDF Document Generator
 * Modern, clean design with refined typography and subtle accents
 */

import PdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content, TableCell, StyleDictionary } from 'pdfmake/interfaces';
import type { DocumentData, DocumentSection, TableContent, KeyValueContent, ListContent, CellValue, RichCell } from './types';

// Set up virtual file system for fonts
PdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs || pdfFonts;

// Modern color palette — warm slate + teal accent
const C = {
  accent: '#0F766E',       // teal-700
  accentLight: '#F0FDFA',  // teal-50
  accentMid: '#CCFBF1',    // teal-100
  text: '#1E293B',         // slate-800
  textMuted: '#64748B',    // slate-500
  textLight: '#94A3B8',    // slate-400
  bg: '#F8FAFC',           // slate-50
  bgAlt: '#F1F5F9',        // slate-100
  border: '#E2E8F0',       // slate-200
  white: '#FFFFFF',
  totalBg: '#ECFDF5',      // emerald-50
};

const styles: StyleDictionary = {
  title: {
    fontSize: 22,
    bold: true,
    color: C.text,
    characterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 9,
    color: C.textMuted,
    lineHeight: 1.5,
  },
  sectionTitle: {
    fontSize: 12,
    bold: true,
    color: C.text,
    characterSpacing: 0.2,
  },
  body: {
    fontSize: 9.5,
    color: C.text,
    lineHeight: 1.5,
  },
  tableHeader: {
    bold: true,
    fontSize: 8.5,
    color: C.textMuted,
  },
  tableCell: {
    fontSize: 9,
    color: C.text,
  },
  keyLabel: {
    fontSize: 9,
    color: C.textMuted,
  },
  keyValue: {
    fontSize: 9.5,
    color: C.text,
  },
  listItem: {
    fontSize: 9.5,
    color: C.text,
    lineHeight: 1.5,
  },
};

/**
 * Generate a PDF document from DocumentData
 */
export async function generatePdf(data: DocumentData): Promise<Buffer> {
  const content: Content[] = [];

  // ── Title block ──────────────────────────────────────
  content.push({
    text: data.title,
    style: 'title',
    margin: [0, 0, 0, 6],
  });

  // Accent line under title
  content.push({
    canvas: [
      { type: 'line', x1: 0, y1: 0, x2: 60, y2: 0, lineWidth: 2.5, lineColor: C.accent },
    ],
    margin: [0, 0, 0, 12],
  });

  // Metadata as subtle tag row
  const metaEntries = Object.entries(data.metadata);
  if (metaEntries.length > 0) {
    const metaColumns = metaEntries.map(([key, value], i) => ({
      text: [
        { text: `${key}  `, fontSize: 8, color: C.textLight, bold: false },
        { text: value, fontSize: 8.5, color: C.text, bold: false },
      ],
      margin: i < metaEntries.length - 1 ? [0, 0, 20, 0] : [0, 0, 0, 0],
    }));

    content.push({
      columns: metaColumns,
      margin: [0, 0, 0, 20],
    } as any);
  }

  // Thin separator
  content.push({
    canvas: [
      { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: C.border },
    ],
    margin: [0, 0, 0, 8],
  });

  // ── Sections ─────────────────────────────────────────
  for (const section of data.sections) {
    content.push(...renderSection(section));
  }

  const docDefinition: TDocumentDefinitions = {
    content,
    styles,
    defaultStyle: {
      font: 'Roboto',
    },
    pageSize: 'A4',
    pageMargins: [48, 56, 48, 56],
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: data.title, fontSize: 7, color: C.textLight, margin: [48, 0, 0, 0] },
        { text: `${currentPage} / ${pageCount}`, fontSize: 7, color: C.textLight, alignment: 'right', margin: [0, 0, 48, 0] },
      ],
      margin: [0, 16, 0, 0],
    }),
    info: {
      title: data.title,
      author: 'Agent Platform',
      creator: 'Agent Platform - Projektmanagement',
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = PdfMake.createPdf(docDefinition);
      pdfDoc.getBuffer((buffer: Buffer) => {
        resolve(Buffer.from(buffer));
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ── Section renderer ─────────────────────────────────────

function renderSection(section: DocumentSection): Content[] {
  const content: Content[] = [];

  // Spacer before section (so accent bar doesn't extend into previous section's space)
  content.push({ text: '', margin: [0, 16, 0, 0] });

  // Section title with left accent bar (using a table trick)
  content.push({
    table: {
      widths: [3, '*'],
      body: [[
        { text: '', fillColor: C.accent, border: [false, false, false, false] },
        {
          text: section.title.toUpperCase(),
          style: 'sectionTitle',
          border: [false, false, false, false],
          margin: [8, 0, 0, 0],
        },
      ]],
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 8],
  });

  switch (section.type) {
    case 'text':
      content.push(...renderText(section.content));
      break;
    case 'table':
      content.push(...renderTable(section.content as TableContent));
      break;
    case 'list':
      content.push(...renderList(section.content as ListContent));
      break;
    case 'keyvalue':
      content.push(...renderKeyValue(section.content as KeyValueContent));
      break;
  }

  return content;
}

// ── Text ─────────────────────────────────────────────────

function renderText(text: string): Content[] {
  if (!text) return [];

  return [{
    text,
    style: 'body',
    margin: [0, 0, 0, 8],
  }];
}

// ── Rich Cell Helper ─────────────────────────────────────

function isRichCell(val: any): val is RichCell {
  return val && typeof val === 'object' && 'text' in val;
}

function cellToText(cell: CellValue): string {
  if (isRichCell(cell)) return cell.text;
  return cell?.toString() || '-';
}

function renderCellContent(cell: CellValue, style: string, extra: Record<string, any> = {}): TableCell {
  if (isRichCell(cell) && cell.dot) {
    return {
      text: [
        { text: '\u25CF ', color: cell.dot, fontSize: 9 },
        { text: cell.text, style },
      ],
      ...extra,
    } as any;
  }
  return {
    text: cellToText(cell),
    style,
    ...extra,
  };
}

// ── Table ────────────────────────────────────────────────

function renderTable(content: TableContent): Content[] {
  if (!content.headers || !content.rows) return [];

  const headerCells: TableCell[] = content.headers.map((header) => ({
    text: header.toUpperCase(),
    style: 'tableHeader',
    fillColor: C.bgAlt,
    margin: [6, 7, 6, 7],
  }));

  const bodyCells: TableCell[][] = content.rows.map((row, rowIndex) => {
    const firstCell = cellToText(row[0]);
    const isTotal = firstCell.toLowerCase().includes('gesamt');

    return row.map((cell) => renderCellContent(cell, 'tableCell', {
      fillColor: isTotal ? C.totalBg : rowIndex % 2 === 1 ? C.bg : C.white,
      bold: isTotal,
      margin: [6, 5, 6, 5],
    }));
  });

  // Smart column widths
  const numCols = content.headers.length;
  const widths = numCols <= 2
    ? ['*', '*']
    : numCols === 3
      ? ['*', 'auto', 'auto']
      : numCols === 4
        ? ['*', 'auto', 'auto', 'auto']
        : numCols === 5
          ? ['*', 'auto', 'auto', 'auto', 'auto']
          : content.headers.map((_, i) => i === 0 ? '*' : 'auto');

  return [{
    table: {
      headerRows: 1,
      widths,
      body: [headerCells, ...bodyCells],
    },
    layout: {
      hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length) ? 0.8 : 0.4,
      vLineWidth: () => 0,
      hLineColor: (i: number) => i === 1 ? C.accent : C.border,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 12],
  }];
}

// ── List ─────────────────────────────────────────────────

function renderList(content: ListContent): Content[] {
  if (!content.items || content.items.length === 0) return [];

  const listItems = content.items.map((item) => ({
    text: [
      { text: '\u2022  ', color: C.accent, fontSize: 11 },
      { text: item, style: 'listItem' as const },
    ],
    margin: [8, 0, 0, 4] as [number, number, number, number],
  }));

  return [{
    stack: listItems,
    margin: [0, 0, 0, 8],
  }];
}

// ── Key-Value ────────────────────────────────────────────

function renderKeyValue(content: KeyValueContent): Content[] {
  if (!content.items || content.items.length === 0) return [];

  const rows: TableCell[][] = content.items.map((item, i) => [
    {
      text: item.key,
      style: 'keyLabel',
      margin: [0, 4, 12, 4],
      border: [false, false, false, i < content.items.length - 1],
      borderColor: [C.border, C.border, C.border, C.border],
    } as any,
    renderCellContent(item.value, 'keyValue', {
      margin: [0, 4, 0, 4],
      border: [false, false, false, i < content.items.length - 1],
      borderColor: [C.border, C.border, C.border, C.border],
    }) as any,
  ]);

  return [{
    table: {
      widths: [110, '*'],
      body: rows,
    },
    layout: {
      hLineWidth: (i: number, node: any) => (i > 0 && i < node.table.body.length) ? 0.3 : 0,
      vLineWidth: () => 0,
      hLineColor: () => C.border,
      hLineStyle: () => ({ dash: { length: 2, space: 2 } }),
    },
    margin: [0, 0, 0, 8],
  }];
}
