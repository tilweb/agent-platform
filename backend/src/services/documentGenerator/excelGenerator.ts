/**
 * Excel Document Generator
 * Generates XLSX files using ExcelJS
 */

import ExcelJS from 'exceljs';
import type { DocumentData, DocumentSection, TableContent, KeyValueContent, ListContent, CellValue, RichCell } from './types';

// Style constants — aligned with the modern slate+teal palette
const COLORS = {
  accent: '0F766E',
  accentLight: 'F0FDFA',
  text: '1E293B',
  textMuted: '64748B',
  bg: 'F8FAFC',
  bgAlt: 'F1F5F9',
  border: 'E2E8F0',
  white: 'FFFFFF',
  totalBg: 'ECFDF5',
};

// ── Rich Cell Helper ─────────────────────────────────────

function isRichCell(val: any): val is RichCell {
  return val && typeof val === 'object' && 'text' in val;
}

function cellToText(cell: CellValue): string {
  if (isRichCell(cell)) return cell.text;
  return cell?.toString() || '-';
}

function cellToDisplayText(cell: CellValue): string {
  if (isRichCell(cell) && cell.dot) return `● ${cell.text}`;
  return cellToText(cell);
}

function getCellDotColor(cell: CellValue): string | null {
  if (isRichCell(cell) && cell.dot) return cell.dot.replace('#', '');
  return null;
}

/**
 * Generate an Excel document from DocumentData
 */
export async function generateExcel(data: DocumentData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Agent Platform';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Daten', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
    },
  });

  // Set column widths
  sheet.columns = [
    { width: 25 },
    { width: 25 },
    { width: 20 },
    { width: 20 },
    { width: 30 },
  ];

  let currentRow = 1;

  // Title
  const titleCell = sheet.getCell(`A${currentRow}`);
  titleCell.value = data.title;
  titleCell.font = { size: 16, bold: true, color: { argb: COLORS.text } };
  sheet.mergeCells(`A${currentRow}:E${currentRow}`);
  currentRow += 2;

  // Metadata
  for (const [key, value] of Object.entries(data.metadata)) {
    const keyCell = sheet.getCell(`A${currentRow}`);
    keyCell.value = key;
    keyCell.font = { color: { argb: COLORS.textMuted } };

    const valueCell = sheet.getCell(`B${currentRow}`);
    valueCell.value = value;
    valueCell.font = { color: { argb: COLORS.text } };

    currentRow++;
  }

  currentRow += 2;

  // Sections
  for (const section of data.sections) {
    currentRow = renderSection(sheet, section, currentRow);
    currentRow += 2;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function renderSection(
  sheet: ExcelJS.Worksheet,
  section: DocumentSection,
  startRow: number
): number {
  let currentRow = startRow;

  // Section title
  const titleCell = sheet.getCell(`A${currentRow}`);
  titleCell.value = section.title;
  titleCell.font = { size: 12, bold: true, color: { argb: COLORS.accent } };
  sheet.mergeCells(`A${currentRow}:E${currentRow}`);

  // Accent underline
  currentRow++;
  for (let col = 1; col <= 5; col++) {
    const cell = sheet.getCell(currentRow, col);
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.accent } },
    };
  }
  currentRow++;

  switch (section.type) {
    case 'text':
      currentRow = renderText(sheet, section.content, currentRow);
      break;
    case 'table':
      currentRow = renderTable(sheet, section.content as TableContent, currentRow);
      break;
    case 'list':
      currentRow = renderList(sheet, section.content as ListContent, currentRow);
      break;
    case 'keyvalue':
      currentRow = renderKeyValue(sheet, section.content as KeyValueContent, currentRow);
      break;
  }

  return currentRow;
}

function renderText(sheet: ExcelJS.Worksheet, content: string, startRow: number): number {
  if (!content) return startRow;

  const lines = content.split('\n');
  let currentRow = startRow;

  for (const line of lines) {
    const cell = sheet.getCell(`A${currentRow}`);
    cell.value = line;
    cell.font = { color: { argb: COLORS.text } };
    cell.alignment = { wrapText: true };
    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    currentRow++;
  }

  return currentRow;
}

function renderTable(sheet: ExcelJS.Worksheet, content: TableContent, startRow: number): number {
  let currentRow = startRow;

  // Headers — light background, muted text (modern style)
  content.headers.forEach((header, index) => {
    const cell = sheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, size: 9, color: { argb: COLORS.textMuted } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.bgAlt },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.border } },
      bottom: { style: 'medium', color: { argb: COLORS.accent } },
    };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  });
  currentRow++;

  // Rows
  for (let i = 0; i < content.rows.length; i++) {
    const row = content.rows[i];
    const firstText = cellToText(row[0]);
    const isTotal = firstText.toLowerCase().includes('gesamt');
    const isLast = i === content.rows.length - 1;

    row.forEach((cellValue, colIndex) => {
      const cell = sheet.getCell(currentRow, colIndex + 1);
      const dotColor = getCellDotColor(cellValue);

      if (dotColor) {
        // Rich text with colored dot
        cell.value = {
          richText: [
            { text: '● ', font: { color: { argb: dotColor }, size: 10 } },
            { text: cellToText(cellValue), font: { color: { argb: COLORS.text }, bold: isTotal } },
          ],
        };
      } else {
        cell.value = cellToText(cellValue);
        cell.font = { bold: isTotal, color: { argb: COLORS.text } };
      }

      cell.fill = isTotal
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalBg } }
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? COLORS.white : COLORS.bg } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: isLast ? COLORS.border : COLORS.border } },
      };
      cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    });
    currentRow++;
  }

  return currentRow;
}

function renderList(sheet: ExcelJS.Worksheet, content: ListContent, startRow: number): number {
  let currentRow = startRow;

  for (const item of content.items) {
    const cell = sheet.getCell(`A${currentRow}`);
    cell.value = {
      richText: [
        { text: '● ', font: { color: { argb: COLORS.accent } } },
        { text: item, font: { color: { argb: COLORS.text } } },
      ],
    };
    cell.alignment = { wrapText: true };
    sheet.mergeCells(`A${currentRow}:E${currentRow}`);
    currentRow++;
  }

  return currentRow;
}

function renderKeyValue(sheet: ExcelJS.Worksheet, content: KeyValueContent, startRow: number): number {
  let currentRow = startRow;

  for (const item of content.items) {
    const keyCell = sheet.getCell(`A${currentRow}`);
    keyCell.value = item.key;
    keyCell.font = { color: { argb: COLORS.textMuted } };

    const valueCell = sheet.getCell(`B${currentRow}`);
    const dotColor = getCellDotColor(item.value);

    if (dotColor) {
      valueCell.value = {
        richText: [
          { text: '● ', font: { color: { argb: dotColor }, size: 11 } },
          { text: cellToText(item.value), font: { color: { argb: COLORS.text } } },
        ],
      };
    } else {
      valueCell.value = cellToText(item.value);
      valueCell.font = { color: { argb: COLORS.text } };
    }

    sheet.mergeCells(`B${currentRow}:E${currentRow}`);
    currentRow++;
  }

  return currentRow;
}
