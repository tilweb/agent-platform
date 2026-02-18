/**
 * PDF Document Generator
 * Generates PDF files using pdfmake with built-in fonts
 */

import PdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content, TableCell, StyleDictionary } from 'pdfmake/interfaces';
import type { DocumentData, DocumentSection, TableContent, KeyValueContent, ListContent } from './index';

// Set up virtual file system for fonts
PdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs || pdfFonts;

// Colors
const COLORS = {
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  header: '#1E3A8A',
  border: '#E5E7EB',
  text: '#1F2937',
  textMuted: '#6B7280',
};

// Styles
const styles: StyleDictionary = {
  title: {
    fontSize: 20,
    bold: true,
    color: COLORS.header,
    margin: [0, 0, 0, 20],
  },
  sectionTitle: {
    fontSize: 14,
    bold: true,
    color: COLORS.primary,
    margin: [0, 15, 0, 8],
  },
  text: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.4,
  },
  tableHeader: {
    bold: true,
    fontSize: 10,
    color: '#FFFFFF',
    fillColor: COLORS.header,
  },
  tableCell: {
    fontSize: 9,
    color: COLORS.text,
  },
  keyLabel: {
    fontSize: 10,
    bold: true,
    color: COLORS.textMuted,
  },
  keyValue: {
    fontSize: 10,
    color: COLORS.text,
  },
  listItem: {
    fontSize: 10,
    color: COLORS.text,
  },
  metadata: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
};

/**
 * Generate a PDF document from DocumentData
 */
export async function generatePdf(data: DocumentData): Promise<Buffer> {
  const content: Content[] = [];

  // Title
  content.push({
    text: data.title,
    style: 'title',
  });

  // Metadata line
  const metadataItems = Object.entries(data.metadata)
    .map(([key, value]) => `${key}: ${value}`)
    .join('  |  ');
  content.push({
    text: metadataItems,
    style: 'metadata',
    margin: [0, 0, 0, 20],
  });

  // Horizontal line
  content.push({
    canvas: [
      {
        type: 'line',
        x1: 0,
        y1: 0,
        x2: 515,
        y2: 0,
        lineWidth: 1,
        lineColor: COLORS.border,
      },
    ],
    margin: [0, 0, 0, 20],
  });

  // Sections
  for (const section of data.sections) {
    const sectionContent = renderSection(section);
    content.push(...sectionContent);
  }

  const docDefinition: TDocumentDefinitions = {
    content,
    styles,
    defaultStyle: {
      font: 'Roboto',
    },
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    footer: (currentPage: number, pageCount: number) => ({
      text: `Seite ${currentPage} von ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: COLORS.textMuted,
      margin: [0, 20, 0, 0],
    }),
    info: {
      title: data.title,
      author: 'Agent Platform',
      creator: 'Agent Platform - Projektmanagement',
    },
  };

  // Create PDF using createPdf method
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

function renderSection(section: DocumentSection): Content[] {
  const content: Content[] = [];

  // Section title
  content.push({
    text: section.title,
    style: 'sectionTitle',
  });

  // Section underline
  content.push({
    canvas: [
      {
        type: 'line',
        x1: 0,
        y1: 0,
        x2: 150,
        y2: 0,
        lineWidth: 2,
        lineColor: COLORS.primary,
      },
    ],
    margin: [0, 0, 0, 10],
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

function renderText(text: string): Content[] {
  if (!text) return [];

  return [
    {
      text,
      style: 'text',
      margin: [0, 0, 0, 10],
    },
  ];
}

function renderTable(content: TableContent): Content[] {
  if (!content.headers || !content.rows) return [];

  const headerCells: TableCell[] = content.headers.map((header) => ({
    text: header,
    style: 'tableHeader',
    margin: [5, 8, 5, 8],
  }));

  const bodyCells: TableCell[][] = content.rows.map((row, rowIndex) => {
    const isTotal = row[0]?.toString().toLowerCase().includes('gesamt');

    return row.map((cell) => ({
      text: cell?.toString() || '-',
      style: 'tableCell',
      fillColor: isTotal ? COLORS.primaryLight : rowIndex % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
      bold: isTotal,
      margin: [5, 6, 5, 6],
    }));
  });

  // Calculate column widths based on number of columns
  const numCols = content.headers.length;
  const widths = numCols <= 2
    ? ['*', '*']
    : numCols === 3
      ? ['*', '*', 'auto']
      : numCols === 4
        ? ['*', 'auto', 'auto', 'auto']
        : content.headers.map(() => '*');

  return [
    {
      table: {
        headerRows: 1,
        widths,
        body: [headerCells, ...bodyCells],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => COLORS.border,
        vLineColor: () => COLORS.border,
      },
      margin: [0, 0, 0, 15],
    },
  ];
}

function renderList(content: ListContent): Content[] {
  if (!content.items || content.items.length === 0) return [];

  return [
    {
      ul: content.items.map((item) => ({
        text: item,
        style: 'listItem',
      })),
      margin: [0, 0, 0, 10],
    },
  ];
}

function renderKeyValue(content: KeyValueContent): Content[] {
  if (!content.items || content.items.length === 0) return [];

  const rows: TableCell[][] = content.items.map((item) => [
    { text: item.key, style: 'keyLabel', margin: [0, 3, 10, 3] },
    { text: item.value, style: 'keyValue', margin: [0, 3, 0, 3] },
  ]);

  return [
    {
      table: {
        widths: [120, '*'],
        body: rows,
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 10],
    },
  ];
}
