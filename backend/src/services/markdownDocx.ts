/**
 * Markdown → docx Renderer.
 *
 * Wandelt einen Markdown-String mit `# H1`, `## H2`, **bold**, *italic*,
 * `{{PLATZHALTER}}`-Markern und Listen in eine .docx-Buffer um. Nutzung:
 * Template-fueller (fill_template-Tool) und Workshop-Builder.
 *
 * Bewusst einfach gehalten — kein voller Markdown-Parser. Genug fuer:
 * - Headings H1, H2
 * - Horizontale Linien (---)
 * - Paragraphen mit **bold** und *italic*
 * - {{NAME}} und [BRACKETS] Platzhalter (gelb hinterlegt wenn als Marker
 *   im Template behalten — nach Substituierung normaler Text)
 * - Unterschrifts-Zeilen mit langem Underscore
 *
 * Nicht supported: nested lists, tables, code-blocks, images.
 */

import {
  Document,
  Paragraph,
  TextRun,
  AlignmentType,
  Packer,
  TabStopType,
  TabStopPosition,
} from 'docx';

const PLACEHOLDER_RE = /\{\{[A-ZÄÖÜ_0-9]+\}\}|\[[A-ZÄÖÜ_ ]+\]/g;
const BOLD_RE = /\*\*(.+?)\*\*/g;
const ITALIC_RE = /\*([^*]+?)\*/g;

interface InlineSegment {
  text: string;
  bold?: boolean;
  italics?: boolean;
  highlight?: 'yellow';
}

/**
 * Sehr leichtgewichtiger Markdown-Inline-Parser.
 * Verschachtelung wird nicht unterstuetzt.
 */
function parseInline(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  type Token = { text: string; bold?: boolean; italics?: boolean };

  // Bold-Blocks isolieren
  const boldTokens: Token[] = [];
  let last = 0;
  for (const m of line.matchAll(BOLD_RE)) {
    if (m.index! > last) boldTokens.push({ text: line.slice(last, m.index!) });
    boldTokens.push({ text: m[1]!, bold: true });
    last = m.index! + m[0].length;
  }
  if (last < line.length) boldTokens.push({ text: line.slice(last) });

  // Pro Bold-Token: italic + placeholder splitten
  for (const t of boldTokens) {
    const italicTokens: Token[] = [];
    let l = 0;
    for (const m of t.text.matchAll(ITALIC_RE)) {
      if (m.index! > l) italicTokens.push({ text: t.text.slice(l, m.index!), bold: t.bold });
      italicTokens.push({ text: m[1]!, bold: t.bold, italics: true });
      l = m.index! + m[0].length;
    }
    if (l < t.text.length) italicTokens.push({ text: t.text.slice(l), bold: t.bold });

    for (const it of italicTokens) {
      let li = 0;
      for (const pm of it.text.matchAll(PLACEHOLDER_RE)) {
        if (pm.index! > li) {
          segments.push({ text: it.text.slice(li, pm.index!), bold: it.bold, italics: it.italics });
        }
        segments.push({ text: pm[0], bold: true, italics: it.italics, highlight: 'yellow' });
        li = pm.index! + pm[0].length;
      }
      if (li < it.text.length) {
        segments.push({ text: it.text.slice(li), bold: it.bold, italics: it.italics });
      }
    }
  }
  return segments.filter((s) => s.text.length > 0);
}

function lineToRuns(line: string): TextRun[] {
  return parseInline(line).map(
    (s) =>
      new TextRun({
        text: s.text,
        bold: s.bold,
        italics: s.italics,
        ...(s.highlight ? { highlight: s.highlight } : {}),
      }),
  );
}

/**
 * Markdown → docx-Buffer.
 */
export async function renderMarkdownToDocx(markdown: string): Promise<Buffer> {
  const lines = markdown.split('\n');
  const children: Paragraph[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // H1 → Titel zentriert, gross
    if (trimmed.startsWith('# ')) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 },
          children: [new TextRun({ text: trimmed.slice(2), bold: true, size: 48 })],
        }),
      );
      i++;
      continue;
    }

    // H2 → Section-Heading
    if (trimmed.startsWith('## ')) {
      children.push(
        new Paragraph({
          spacing: { before: 360, after: 180 },
          children: [new TextRun({ text: trimmed.slice(3), bold: true, size: 26 })],
        }),
      );
      i++;
      continue;
    }

    // H3 → Subsection
    if (trimmed.startsWith('### ')) {
      children.push(
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: trimmed.slice(4), bold: true, size: 24 })],
        }),
      );
      i++;
      continue;
    }

    // Horizontaler Trenner
    if (trimmed === '---') {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          border: { bottom: { color: 'CCCCCC', space: 1, style: 'single', size: 6 } },
          children: [],
        }),
      );
      i++;
      continue;
    }

    // Leerzeile
    if (trimmed === '') {
      i++;
      continue;
    }

    // Unterschrifts-Zeile
    if (trimmed.includes('_____________________________')) {
      children.push(
        new Paragraph({
          spacing: { before: 480, after: 80 },
          tabStops: [{ type: TabStopType.LEFT, position: TabStopPosition.MAX / 2 }],
          children: [
            new TextRun({ text: '_______________________________' }),
            new TextRun({ text: '\t' }),
            new TextRun({ text: '_______________________________' }),
          ],
        }),
      );
      i++;
      continue;
    }

    // Standard-Paragraph: nachfolgende Zeilen zusammenfassen
    let buffer = trimmed;
    while (
      i + 1 < lines.length &&
      lines[i + 1]!.trim() !== '' &&
      !lines[i + 1]!.trim().startsWith('#') &&
      !lines[i + 1]!.trim().startsWith('---')
    ) {
      i++;
      buffer += ' ' + lines[i]!.trim();
    }
    children.push(
      new Paragraph({
        children: lineToRuns(buffer),
        spacing: { after: 120 },
      }),
    );
    i++;
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
          paragraph: { spacing: { line: 320 } },
        },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1133, bottom: 1133, left: 1417, right: 1417 } } },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
