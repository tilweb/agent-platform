/**
 * Word Document Generator
 * Modern, clean design with refined typography and subtle accents
 */

import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Packer,
  ShadingType,
  convertInchesToTwip,
  PageOrientation,
  Tab,
  TabStopPosition,
  TabStopType,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import type { DocumentData, DocumentSection, TableContent, KeyValueContent, ListContent, CellValue, RichCell } from './types';

// Modern color palette — warm slate + teal accent (hex without #)
const C = {
  accent: '0F766E',       // teal-700
  accentLight: 'F0FDFA',  // teal-50
  accentMid: 'CCFBF1',    // teal-100
  text: '1E293B',         // slate-800
  textMuted: '64748B',    // slate-500
  textLight: '94A3B8',    // slate-400
  bg: 'F8FAFC',           // slate-50
  bgAlt: 'F1F5F9',        // slate-100
  border: 'E2E8F0',       // slate-200
  white: 'FFFFFF',
  totalBg: 'ECFDF5',      // emerald-50
  none: '000000',
};

const noBorder = { style: BorderStyle.NONE, size: 0, color: C.none };
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: C.border };
const accentBorder = { style: BorderStyle.SINGLE, size: 6, color: C.accent };

/**
 * Generate a Word document from DocumentData
 */
export async function generateWord(data: DocumentData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // ── Title ──────────────────────────────────────────
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.title,
          bold: true,
          size: 40,  // 20pt
          color: C.text,
          font: 'Calibri',
        }),
      ],
      spacing: { after: 80 },
    })
  );

  // Accent line (short teal bar via table)
  children.push(
    new Table({
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [] })],
              width: { size: 800, type: WidthType.DXA },
              shading: { type: ShadingType.SOLID, color: C.accent, fill: C.accent },
              borders: {
                top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
              },
            }),
            new TableCell({
              children: [new Paragraph({ children: [] })],
              width: { size: 8200, type: WidthType.DXA },
              borders: {
                top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
              },
            }),
          ],
          height: { value: 60, rule: 'exact' as any },
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
        insideHorizontal: noBorder, insideVertical: noBorder,
      },
    })
  );

  // Spacer
  children.push(new Paragraph({ children: [], spacing: { after: 120 } }));

  // ── Metadata row ───────────────────────────────────
  const metaEntries = Object.entries(data.metadata);
  if (metaEntries.length > 0) {
    const metaRuns: TextRun[] = [];
    metaEntries.forEach(([key, value], i) => {
      metaRuns.push(
        new TextRun({ text: `${key} `, size: 16, color: C.textLight, font: 'Calibri' }),
        new TextRun({ text: value, size: 17, color: C.text, font: 'Calibri' }),
      );
      if (i < metaEntries.length - 1) {
        metaRuns.push(
          new TextRun({ text: '    \u2022    ', size: 16, color: C.border, font: 'Calibri' }),
        );
      }
    });

    children.push(
      new Paragraph({
        children: metaRuns,
        spacing: { after: 240 },
      })
    );
  }

  // Thin separator
  children.push(
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 2, color: C.border },
      },
      spacing: { after: 160 },
    })
  );

  // ── Sections ───────────────────────────────────────
  for (const section of data.sections) {
    children.push(...renderSection(section));
  }

  const doc = new Document({
    creator: 'Agent Platform',
    title: data.title,
    description: 'Projektauftrag Export',
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 20,
            color: C.text,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.PORTRAIT },
            margin: {
              top: convertInchesToTwip(0.9),
              right: convertInchesToTwip(0.9),
              bottom: convertInchesToTwip(0.9),
              left: convertInchesToTwip(0.9),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: data.title, size: 14, color: C.textLight, font: 'Calibri' }),
                  new TextRun({ text: '\t', size: 14 }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 14, color: C.textLight, font: 'Calibri' }),
                  new TextRun({ text: ' / ', size: 14, color: C.textLight, font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: C.textLight, font: 'Calibri' }),
                ],
                tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
                border: {
                  top: { style: BorderStyle.SINGLE, size: 2, color: C.border },
                },
                spacing: { before: 100 },
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ── Section renderer ─────────────────────────────────────

function renderSection(section: DocumentSection): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];

  // Spacer before section (no border, just whitespace)
  content.push(
    new Paragraph({
      children: [],
      spacing: { before: 280 },
    })
  );

  // Section title with left accent border (no spacing.before so bar starts at text)
  content.push(
    new Paragraph({
      children: [
        new TextRun({
          text: section.title.toUpperCase(),
          bold: true,
          size: 22,  // 11pt
          color: C.text,
          font: 'Calibri',
          characterSpacing: 40,
        }),
      ],
      border: {
        left: { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 8 },
      },
      spacing: { after: 160 },
      indent: { left: 80 },
    })
  );

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

function renderText(text: string): Paragraph[] {
  if (!text) return [];

  const lines = text.split('\n');
  return lines.map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line,
            size: 19,
            color: C.text,
            font: 'Calibri',
          }),
        ],
        spacing: { after: 100, line: 300 },
      })
  );
}

// ── Rich Cell Helper ─────────────────────────────────────

function isRichCell(val: any): val is RichCell {
  return val && typeof val === 'object' && 'text' in val;
}

function cellToText(cell: CellValue): string {
  if (isRichCell(cell)) return cell.text;
  return cell?.toString() || '-';
}

function cellToTextRuns(cell: CellValue, opts: { size: number; color: string; bold?: boolean }): TextRun[] {
  if (isRichCell(cell) && cell.dot) {
    return [
      new TextRun({
        text: '\u25CF ',
        size: opts.size,
        color: cell.dot.replace('#', ''),
        font: 'Calibri',
      }),
      new TextRun({
        text: cell.text,
        size: opts.size,
        color: opts.color,
        bold: opts.bold,
        font: 'Calibri',
      }),
    ];
  }
  return [
    new TextRun({
      text: cellToText(cell),
      size: opts.size,
      color: opts.color,
      bold: opts.bold,
      font: 'Calibri',
    }),
  ];
}

// ── Table ────────────────────────────────────────────────

function renderTable(content: TableContent): Table[] {
  if (!content.headers || !content.rows) return [];

  // Header row — light background, no heavy fill
  const headerRow = new TableRow({
    children: content.headers.map(
      (header) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: header.toUpperCase(),
                  bold: true,
                  size: 16,
                  color: C.textMuted,
                  font: 'Calibri',
                  characterSpacing: 20,
                }),
              ],
            }),
          ],
          shading: { type: ShadingType.SOLID, color: C.bgAlt, fill: C.bgAlt },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          borders: {
            top: thinBorder,
            bottom: accentBorder,
            left: noBorder,
            right: noBorder,
          },
        })
    ),
    tableHeader: true,
  });

  // Data rows
  const dataRows = content.rows.map((row, rowIndex) => {
    const firstCell = cellToText(row[0]);
    const isTotal = firstCell.toLowerCase().includes('gesamt');
    const bgColor = isTotal ? C.totalBg : rowIndex % 2 === 1 ? C.bg : C.white;
    const isLast = rowIndex === content.rows.length - 1;

    return new TableRow({
      children: row.map(
        (cell) =>
          new TableCell({
            children: [
              new Paragraph({
                children: cellToTextRuns(cell, { size: 18, color: C.text, bold: isTotal }),
              }),
            ],
            shading: { type: ShadingType.SOLID, color: bgColor, fill: bgColor },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            borders: {
              top: noBorder,
              bottom: isLast ? thinBorder : { style: BorderStyle.SINGLE, size: 2, color: C.border },
              left: noBorder,
              right: noBorder,
            },
          })
      ),
    });
  });

  return [
    new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: noBorder,
        bottom: noBorder,
        left: noBorder,
        right: noBorder,
        insideHorizontal: noBorder,
        insideVertical: noBorder,
      },
    }),
  ];
}

// ── List ─────────────────────────────────────────────────

function renderList(content: ListContent): Paragraph[] {
  if (!content.items || content.items.length === 0) return [];

  return content.items.map(
    (item) =>
      new Paragraph({
        children: [
          new TextRun({
            text: '\u2022  ',
            size: 20,
            color: C.accent,
            font: 'Calibri',
          }),
          new TextRun({
            text: item,
            size: 19,
            color: C.text,
            font: 'Calibri',
          }),
        ],
        spacing: { after: 60, line: 280 },
        indent: { left: 180 },
      })
  );
}

// ── Key-Value ────────────────────────────────────────────

function renderKeyValue(content: KeyValueContent): Table[] {
  if (!content.items || content.items.length === 0) return [];

  const rows = content.items.map(
    (item, i) => {
      const isLast = i === content.items.length - 1;

      return new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.key,
                    size: 18,
                    color: C.textMuted,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
            width: { size: 28, type: WidthType.PERCENTAGE },
            margins: { top: 50, bottom: 50, right: 100 },
            borders: {
              top: noBorder,
              bottom: isLast ? noBorder : { style: BorderStyle.SINGLE, size: 2, color: C.border },
              left: noBorder,
              right: noBorder,
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: cellToTextRuns(item.value, { size: 19, color: C.text }),
              }),
            ],
            width: { size: 72, type: WidthType.PERCENTAGE },
            margins: { top: 50, bottom: 50 },
            borders: {
              top: noBorder,
              bottom: isLast ? noBorder : { style: BorderStyle.SINGLE, size: 2, color: C.border },
              left: noBorder,
              right: noBorder,
            },
          }),
        ],
      });
    }
  );

  return [
    new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: noBorder,
        bottom: noBorder,
        left: noBorder,
        right: noBorder,
        insideHorizontal: noBorder,
        insideVertical: noBorder,
      },
    }),
  ];
}
