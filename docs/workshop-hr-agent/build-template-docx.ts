/**
 * One-off Builder fuer das Vertrags-Template als Word-Dokument.
 *
 * Liest template_unbefristet_vollzeit.md und produziert die gleichnamige
 * .docx mit gestalteten Headings, Platzhalter-Highlight (Gelb) und
 * Unterschriftszeilen. Wird vom Workshop-Use-Case fuer den HR-Agenten
 * als Vorlage benutzt.
 *
 * Usage (im backend/-Ordner):
 *   /Users/andreasbachmann/.bun/bin/bun run ../docs/workshop-hr-agent/build-template-docx.ts
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  PageBreak,
  TabStopType,
  TabStopPosition,
} from 'docx';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const HERE = resolve(import.meta.dir);
const SOURCE = resolve(HERE, 'template_unbefristet_vollzeit.md');
const OUTPUT = resolve(HERE, 'template_unbefristet_vollzeit.docx');

// --- Helfer: Platzhalter (`{{NAME}}`) als gelb hinterlegte TextRuns rendern ---
const PLACEHOLDER_RE = /\{\{[A-ZÄÖÜ_0-9]+\}\}|\[[A-ZÄÖÜ_ ]+\]/g;
const BOLD_RE = /\*\*(.+?)\*\*/g;
const ITALIC_RE = /\*(.+?)\*/g;

interface InlineSegment {
  text: string;
  bold?: boolean;
  italics?: boolean;
  highlight?: 'yellow';
}

/**
 * Sehr leichtgewichtiger Markdown-Inline-Parser fuer das Template:
 * **bold**, *italic*, {{PLACEHOLDER}} / [BRACKETS]. Verschachtelung wird
 * absichtlich nicht supportet — das Template kommt ohne aus.
 */
function parseInline(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  // Erstmal Bold-Blocks isolieren
  type Token = { text: string; bold?: boolean };
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
      italicTokens.push({ text: m[1]!, bold: t.bold, ...{ italics: true } as any });
      l = m.index! + m[0].length;
    }
    if (l < t.text.length) italicTokens.push({ text: t.text.slice(l), bold: t.bold });

    for (const it of italicTokens as Array<Token & { italics?: boolean }>) {
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

function runs(line: string): TextRun[] {
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

function para(text: string, opts: { spacing?: number; alignment?: any } = {}): Paragraph {
  return new Paragraph({
    children: runs(text),
    spacing: { after: opts.spacing ?? 120 },
    alignment: opts.alignment,
  });
}

async function main() {
  const md = await Bun.file(SOURCE).text();
  const lines = md.split('\n');
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
          children: [
            new TextRun({
              text: trimmed.slice(2),
              bold: true,
              size: 48, // half-points → 24pt
            }),
          ],
        }),
      );
      i++;
      continue;
    }

    // H2 → Paragraph-Heading bold + size
    if (trimmed.startsWith('## ')) {
      children.push(
        new Paragraph({
          spacing: { before: 360, after: 180 },
          children: [
            new TextRun({
              text: trimmed.slice(3),
              bold: true,
              size: 26, // 13pt
            }),
          ],
        }),
      );
      i++;
      continue;
    }

    // Horizontaler Trenner → leerer Absatz mit Bottom-Border simulieren
    if (trimmed === '---') {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          border: {
            bottom: { color: 'CCCCCC', space: 1, style: 'single', size: 6 },
          },
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

    // Mehrzeilige Unterschrifts-Block: zwei Lines mit `_____________________________`
    if (trimmed.includes('_____________________________')) {
      children.push(
        new Paragraph({
          spacing: { before: 480, after: 80 },
          tabStops: [
            { type: TabStopType.LEFT, position: TabStopPosition.MAX / 2 },
          ],
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

    // Standard-Paragraph (joinen ueber Folgezeilen ohne Leerzeile)
    let buffer = trimmed;
    while (i + 1 < lines.length && lines[i + 1]!.trim() !== '' && !lines[i + 1]!.trim().startsWith('#') && !lines[i + 1]!.trim().startsWith('---')) {
      i++;
      buffer += ' ' + lines[i]!.trim();
    }
    children.push(para(buffer));
    i++;
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22, // 11pt
          },
          paragraph: {
            spacing: { line: 320 }, // 1.15-fach
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1133, bottom: 1133, left: 1417, right: 1417 }, // ~2cm/2.5cm
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  await writeFile(OUTPUT, buffer);
  console.log(`✓ ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
