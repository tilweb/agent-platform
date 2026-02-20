/**
 * Word Document Generator
 * Generates DOCX files using the docx library
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
  HeadingLevel,
  Packer,
  ShadingType,
  convertInchesToTwip,
  PageOrientation,
} from 'docx';
import type { DocumentData, DocumentSection, TableContent, KeyValueContent, ListContent } from './index';

// Colors (hex without #)
const COLORS = {
  primary: '2563EB',
  primaryLight: 'DBEAFE',
  header: '1E3A8A',
  border: 'E5E7EB',
  text: '1F2937',
  textMuted: '6B7280',
  white: 'FFFFFF',
  altRow: 'F9FAFB',
};

/**
 * Generate a Word document from DocumentData
 */
export async function generateWord(data: DocumentData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.title,
          bold: true,
          size: 36,
          color: COLORS.header,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Metadata
  const metadataText = Object.entries(data.metadata)
    .map(([key, value]) => `${key}: ${value}`)
    .join('  |  ');
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: metadataText,
          size: 18,
          color: COLORS.textMuted,
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Horizontal line (using border)
  children.push(
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 6,
          color: COLORS.border,
        },
      },
      spacing: { after: 400 },
    })
  );

  // Sections
  for (const section of data.sections) {
    const sectionContent = renderSection(section);
    children.push(...sectionContent);
  }

  const doc = new Document({
    creator: 'Adacor Workplace',
    title: data.title,
    description: 'Projektauftrag Export',
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

function renderSection(section: DocumentSection): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];

  // Section title
  content.push(
    new Paragraph({
      children: [
        new TextRun({
          text: section.title,
          bold: true,
          size: 26,
          color: COLORS.primary,
        }),
      ],
      spacing: { before: 300, after: 100 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 12,
          color: COLORS.primary,
        },
      },
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

  // Add spacing after section
  content.push(
    new Paragraph({
      children: [],
      spacing: { after: 200 },
    })
  );

  return content;
}

function renderText(text: string): Paragraph[] {
  if (!text) return [];

  const lines = text.split('\n');
  return lines.map(
    (line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line,
            size: 20,
            color: COLORS.text,
          }),
        ],
        spacing: { after: 120 },
      })
  );
}

function renderTable(content: TableContent): Table[] {
  if (!content.headers || !content.rows) return [];

  const numCols = content.headers.length;

  // Header row
  const headerRow = new TableRow({
    children: content.headers.map(
      (header) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: header,
                  bold: true,
                  size: 20,
                  color: COLORS.white,
                }),
              ],
            }),
          ],
          shading: {
            type: ShadingType.SOLID,
            color: COLORS.header,
            fill: COLORS.header,
          },
          margins: {
            top: 100,
            bottom: 100,
            left: 100,
            right: 100,
          },
        })
    ),
    tableHeader: true,
  });

  // Data rows
  const dataRows = content.rows.map((row, rowIndex) => {
    const isTotal = row[0]?.toString().toLowerCase().includes('gesamt');
    const bgColor = isTotal ? COLORS.primaryLight : rowIndex % 2 === 0 ? COLORS.white : COLORS.altRow;

    return new TableRow({
      children: row.map(
        (cell) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: cell?.toString() || '-',
                    size: 18,
                    color: COLORS.text,
                    bold: isTotal,
                  }),
                ],
              }),
            ],
            shading: {
              type: ShadingType.SOLID,
              color: bgColor,
              fill: bgColor,
            },
            margins: {
              top: 80,
              bottom: 80,
              left: 100,
              right: 100,
            },
          })
      ),
    });
  });

  return [
    new Table({
      rows: [headerRow, ...dataRows],
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
        left: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
        right: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: COLORS.border },
      },
    }),
  ];
}

function renderList(content: ListContent): Paragraph[] {
  if (!content.items || content.items.length === 0) return [];

  return content.items.map(
    (item) =>
      new Paragraph({
        children: [
          new TextRun({
            text: `\u2022  ${item}`,
            size: 20,
            color: COLORS.text,
          }),
        ],
        spacing: { after: 80 },
        indent: { left: 200 },
      })
  );
}

function renderKeyValue(content: KeyValueContent): Table[] {
  if (!content.items || content.items.length === 0) return [];

  const rows = content.items.map(
    (item) =>
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.key,
                    bold: true,
                    size: 20,
                    color: COLORS.textMuted,
                  }),
                ],
              }),
            ],
            width: {
              size: 25,
              type: WidthType.PERCENTAGE,
            },
            margins: {
              top: 60,
              bottom: 60,
              right: 100,
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: item.value,
                    size: 20,
                    color: COLORS.text,
                  }),
                ],
              }),
            ],
            width: {
              size: 75,
              type: WidthType.PERCENTAGE,
            },
            margins: {
              top: 60,
              bottom: 60,
            },
          }),
        ],
      })
  );

  return [
    new Table({
      rows,
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
    }),
  ];
}
