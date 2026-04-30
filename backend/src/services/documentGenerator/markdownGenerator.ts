/**
 * Markdown Generator
 * Renders DocumentData to a plain Markdown string.
 * Supports headings, paragraphs, key-value lists, tables, and bullet lists.
 */

import type {
  DocumentData,
  DocumentSection,
  CellValue,
  RichCell,
} from './types';

function cellToString(cell: CellValue): string {
  if (cell == null) return '';
  if (typeof cell === 'string' || typeof cell === 'number') return String(cell);
  // RichCell — dot is rendered as a coloured indicator in PDF/DOCX, in Markdown
  // we just emit the text. Adding a • prefix would muddle reading flow.
  return (cell as RichCell).text ?? '';
}

function escapePipes(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderSection(section: DocumentSection): string {
  const lines: string[] = [];
  lines.push(`## ${section.title}`);
  lines.push('');

  switch (section.type) {
    case 'text': {
      const text = typeof section.content === 'string' ? section.content : '';
      lines.push(text || '_— nicht erfasst —_');
      break;
    }
    case 'keyvalue': {
      const items = section.content?.items ?? [];
      if (items.length === 0) {
        lines.push('_— nicht erfasst —_');
      } else {
        for (const item of items) {
          const value = typeof item.value === 'object' ? cellToString(item.value as CellValue) : (item.value ?? '');
          lines.push(`- **${item.key}:** ${value || '—'}`);
        }
      }
      break;
    }
    case 'list': {
      const items = section.content?.items ?? [];
      if (items.length === 0) {
        lines.push('_— keine Eintraege —_');
      } else {
        for (const item of items) {
          lines.push(`- ${item}`);
        }
      }
      break;
    }
    case 'table': {
      const headers: string[] = section.content?.headers ?? [];
      const rows: CellValue[][] = section.content?.rows ?? [];
      if (headers.length === 0 || rows.length === 0) {
        lines.push('_— keine Eintraege —_');
      } else {
        lines.push('| ' + headers.map((h) => escapePipes(h)).join(' | ') + ' |');
        lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
        for (const row of rows) {
          lines.push('| ' + row.map((c) => escapePipes(cellToString(c))).join(' | ') + ' |');
        }
      }
      break;
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function generateMarkdown(data: DocumentData): Buffer {
  const lines: string[] = [];

  lines.push(`# ${data.title}`);
  lines.push('');

  if (data.metadata && Object.keys(data.metadata).length > 0) {
    for (const [key, value] of Object.entries(data.metadata)) {
      if (value) lines.push(`> **${key}:** ${value}`);
    }
    lines.push('');
  }

  for (const section of data.sections) {
    lines.push(renderSection(section));
  }

  return Buffer.from(lines.join('\n'), 'utf-8');
}
