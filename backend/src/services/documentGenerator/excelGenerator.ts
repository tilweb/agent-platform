/**
 * Excel Document Generator
 * Generates XLSX files using ExcelJS
 */

import ExcelJS from 'exceljs';
import type { DocumentData, DocumentSection, TableContent, KeyValueContent, ListContent } from './index';

// Style constants
const COLORS = {
  primary: '2563EB',
  primaryLight: 'DBEAFE',
  header: '1E3A8A',
  headerText: 'FFFFFF',
  border: 'E5E7EB',
  text: '1F2937',
  textMuted: '6B7280',
  success: '059669',
  successLight: 'D1FAE5',
};

/**
 * Generate an Excel document from DocumentData
 */
export async function generateExcel(data: DocumentData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Adacor Workplace';
  workbook.created = new Date();

  // Main sheet with all content
  const sheet = workbook.addWorksheet('Projektauftrag', {
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
  titleCell.font = { size: 18, bold: true, color: { argb: COLORS.header } };
  sheet.mergeCells(`A${currentRow}:E${currentRow}`);
  currentRow += 2;

  // Metadata
  for (const [key, value] of Object.entries(data.metadata)) {
    const keyCell = sheet.getCell(`A${currentRow}`);
    keyCell.value = key;
    keyCell.font = { bold: true, color: { argb: COLORS.textMuted } };

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

  // Generate buffer
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
  titleCell.font = { size: 14, bold: true, color: { argb: COLORS.primary } };
  sheet.mergeCells(`A${currentRow}:E${currentRow}`);

  // Underline
  currentRow++;
  for (let col = 1; col <= 5; col++) {
    const cell = sheet.getCell(currentRow, col);
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.primary } },
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

  // Headers
  content.headers.forEach((header, index) => {
    const cell = sheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: COLORS.headerText } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.header },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.border } },
      bottom: { style: 'thin', color: { argb: COLORS.border } },
      left: { style: 'thin', color: { argb: COLORS.border } },
      right: { style: 'thin', color: { argb: COLORS.border } },
    };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
  });
  currentRow++;

  // Rows
  for (let i = 0; i < content.rows.length; i++) {
    const row = content.rows[i];
    if (!row) continue;
    const isLastRow = i === content.rows.length - 1;
    const isTotal = row[0]?.toString().toLowerCase().includes('gesamt');

    row.forEach((value, colIndex) => {
      const cell = sheet.getCell(currentRow, colIndex + 1);
      cell.value = value;
      cell.font = {
        bold: isTotal,
        color: { argb: COLORS.text },
      };
      cell.fill = isTotal
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } }
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFF' : 'F9FAFB' } };
      cell.border = {
        top: { style: 'thin', color: { argb: COLORS.border } },
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        left: { style: 'thin', color: { argb: COLORS.border } },
        right: { style: 'thin', color: { argb: COLORS.border } },
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
    const bulletCell = sheet.getCell(`A${currentRow}`);
    bulletCell.value = `\u2022 ${item}`;
    bulletCell.font = { color: { argb: COLORS.text } };
    bulletCell.alignment = { wrapText: true };
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
    keyCell.font = { bold: true, color: { argb: COLORS.textMuted } };

    const valueCell = sheet.getCell(`B${currentRow}`);
    valueCell.value = item.value;
    valueCell.font = { color: { argb: COLORS.text } };
    sheet.mergeCells(`B${currentRow}:E${currentRow}`);

    currentRow++;
  }

  return currentRow;
}
