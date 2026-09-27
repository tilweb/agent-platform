/**
 * Markdown → BlockWriter. Bewusst eigener, kleiner Parser (keine Dependency),
 * abgestimmt auf das, was LLMs typischerweise schreiben:
 * Überschriften H1–H4, Absätze, Aufzählungen/Nummerierungen (verschachtelt),
 * GFM-Tabellen, Zitate, Code-Blöcke, Trennlinien sowie inline **fett**,
 * *kursiv*, ~~durchgestrichen~~, `code` und [Links](https://…).
 */
import type { BlockWriter, Inline } from './ooxml';

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

type Marks = Omit<Inline, 'text'>;

export function parseInline(src: string, marks: Marks = {}): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push({ text: buf, ...marks });
    buf = '';
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    const rest = src.slice(i);

    if (ch === '\\' && i + 1 < src.length && /[\\`*_~[\]()#+\-.!|]/.test(src[i + 1]!)) {
      buf += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i) {
        flush();
        out.push({ text: src.slice(i + 1, end), ...marks, code: true });
        i = end + 1;
        continue;
      }
    }
    if (ch === '[') {
      const m = /^\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(rest);
      if (m && /^(https?:|mailto:)/i.test(m[2]!)) {
        flush();
        out.push(...parseInline(m[1]!, { ...marks, link: m[2]! }));
        i += m[0].length;
        continue;
      }
    }
    if (rest.startsWith('**') || rest.startsWith('__')) {
      const delim = rest.slice(0, 2);
      let end = src.indexOf(delim, i + 2);
      // "***" am Ende: das innere * schließt die Kursivierung, die letzten beiden den Fettdruck
      while (end > 0 && src[end + 2] === delim[0]) end++;
      if (end > i + 2) {
        flush();
        out.push(...parseInline(src.slice(i + 2, end), { ...marks, bold: true }));
        i = end + 2;
        continue;
      }
    }
    if (rest.startsWith('~~')) {
      const end = src.indexOf('~~', i + 2);
      if (end > i + 2) {
        flush();
        out.push(...parseInline(src.slice(i + 2, end), { ...marks, strike: true }));
        i = end + 2;
        continue;
      }
    }
    if (ch === '*' || ch === '_') {
      // _ nur an Wortgrenzen, damit snake_case_namen nicht kursiv werden
      const prev = src[i - 1];
      const opensOk = ch === '*' ? src[i + 1] !== ' ' : !prev || !/[\p{L}\p{N}]/u.test(prev);
      const end = findClosingEmphasis(src, i + 1, ch);
      if (opensOk && end > i + 1) {
        flush();
        out.push(...parseInline(src.slice(i + 1, end), { ...marks, italic: true }));
        i = end + 1;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return out;
}

function findClosingEmphasis(src: string, from: number, ch: string): number {
  for (let j = from; j < src.length; j++) {
    if (src[j] === '\\') { j++; continue; }
    if (src[j] !== ch) continue;
    if (src[j + 1] === ch) { j++; continue; } // ** innerhalb von *…* überspringen
    if (src[j - 1] === ' ') continue;
    if (ch === '_' && src[j + 1] && /[\p{L}\p{N}]/u.test(src[j + 1]!)) continue;
    return j;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Blöcke
// ---------------------------------------------------------------------------

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^(?:-{3,}|\*{3,}|_{3,})\s*$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)\d{1,3}[.)]\s+(.*)$/;
const FENCE = /^\s*(```|~~~)/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
}

function indentLevel(spaces: string): number {
  const width = spaces.replace(/\t/g, '    ').length;
  return Math.min(Math.floor(width / 2), 2);
}

export interface MarkdownOptions {
  /** Pegel-Verschiebung: '# ' wird zu heading(1 + shift) — z.B. wenn der Titel schon gesetzt ist */
  headingShift?: number;
}

export function renderMarkdown(md: string, w: BlockWriter, opts: MarkdownOptions = {}): void {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const shift = opts.headingShift ?? 0;
  let para: string[] = [];
  // nummerierte Listen: pro Einrückungsebene eine laufende numId, neue Liste nach Unterbrechung
  let orderedIds: Array<number | undefined> = [];

  const flushPara = () => {
    if (para.length) w.paragraph(parseInline(para.join(' ')));
    para = [];
  };
  const endLists = () => { orderedIds = []; };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (!line.trim()) {
      flushPara();
      // Leerzeile beendet eine Liste nur, wenn danach kein Listenpunkt folgt
      const next = lines.slice(i + 1).find(l => l.trim());
      if (!next || !(BULLET.test(next) || ORDERED.test(next))) endLists();
      continue;
    }

    if (FENCE.test(line)) {
      flushPara(); endLists();
      const fence = FENCE.exec(line)![1]!;
      const code: string[] = [];
      while (++i < lines.length && !lines[i]!.trim().startsWith(fence)) code.push(lines[i]!);
      w.codeBlock(code);
      continue;
    }

    const h = HEADING.exec(line);
    if (h) {
      flushPara(); endLists();
      w.heading(h[1]!.length + shift, parseInline(h[2]!));
      continue;
    }

    if (RULE.test(line)) {
      flushPara(); endLists();
      w.rule();
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]!)) {
      flushPara(); endLists();
      const rows = [splitRow(line)];
      i++;
      while (i + 1 < lines.length && lines[i + 1]!.includes('|') && lines[i + 1]!.trim()) rows.push(splitRow(lines[++i]!));
      w.table(rows.map(r => r.map(c => parseInline(c.replace(/<br\s*\/?>/gi, '\n')))));
      continue;
    }

    const b = BULLET.exec(line);
    if (b && !RULE.test(line)) {
      flushPara();
      const lvl = indentLevel(b[1]!);
      orderedIds = orderedIds.slice(0, lvl + 1);
      w.bullet(parseInline(stripTask(b[2]!)), lvl);
      continue;
    }

    const o = ORDERED.exec(line);
    if (o) {
      flushPara();
      const lvl = indentLevel(o[1]!);
      orderedIds = orderedIds.slice(0, lvl + 1);
      orderedIds[lvl] ??= w.startNumberedList();
      w.numbered(parseInline(o[2]!), orderedIds[lvl]!, lvl);
      continue;
    }

    if (line.startsWith('>')) {
      flushPara(); endLists();
      const quote: string[] = [];
      for (; i < lines.length && lines[i]!.startsWith('>'); i++) quote.push(lines[i]!.replace(/^>\s?/, ''));
      i--;
      w.quote(parseInline(quote.join(' ')));
      continue;
    }

    // Fortsetzungszeile eines Listenpunkts (eingerückt) → an Absatz anhängen reicht
    endLists();
    para.push(line.trim());
  }
  flushPara();
}

/** GitHub-Checkboxen "[ ] …" / "[x] …" als ☐/☒ darstellen. */
function stripTask(s: string): string {
  return s.replace(/^\[ \]\s+/, '☐ ').replace(/^\[[xX]\]\s+/, '☒ ');
}
