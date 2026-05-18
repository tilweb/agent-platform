/**
 * Heavy Extraction Pipeline — Text-Chunker.
 *
 * Schneidet einen langen Markdown-Text in token-budgetierte Chunks. Wenn
 * `sectionAware` aktiv ist, werden Markdown-Heading-Grenzen (`# `, `## `, `### `)
 * bevorzugt — eine Sektion landet idealerweise in einem Chunk. Bei zu
 * langen Sektionen wird hart mit Overlap gesplittet.
 *
 * Wichtige Property: kein Wort/Satz wird mitten geschnitten — der Splitter
 * sucht im letzten 10% des Budgets den naechsten Zeilenumbruch oder Satzpunkt
 * als tatsaechliche Grenze.
 */

import { approximateTokenCount } from './tokenizer';

export interface Chunk {
  index: number;                 // 0-basiert
  text: string;
  tokenEstimate: number;
  startOffset: number;           // Position im Original-Text
  endOffset: number;
  /** Markdown-Heading, wenn der Chunk an einem Heading beginnt — sonst null. */
  heading?: string;
}

export interface ChunkOptions {
  chunkSizeTokens: number;       // Ziel-Groesse pro Chunk
  chunkOverlapTokens: number;    // Wie viele Tokens am Anfang nochmal vom Vorgaenger
  sectionAware: boolean;         // Heading-Grenzen bevorzugen
}

const HEADING_REGEX = /^(#{1,3})\s+(.+?)$/gm;

interface HeadingMatch {
  /** Position des `#` im Text. */
  start: number;
  /** Position des Zeilenumbruchs nach dem Heading. */
  end: number;
  level: number;
  text: string;
}

function findHeadings(text: string): HeadingMatch[] {
  const headings: HeadingMatch[] = [];
  const re = new RegExp(HEADING_REGEX);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    headings.push({
      start: match.index,
      end: match.index + match[0].length,
      level: match[1]!.length,
      text: match[2]!.trim(),
    });
  }
  return headings;
}

function tokensToChars(tokens: number): number {
  return Math.ceil(tokens * 3.5);
}

/**
 * Sucht eine "gute" Bruchstelle im Bereich [minOffset, maxOffset]. Suchreihenfolge:
 *   1. Markdown-Heading (idealer Schnitt)
 *   2. Doppelter Zeilenumbruch (Paragraph)
 *   3. Einzelner Zeilenumbruch
 *   4. Satzende (`.`, `?`, `!` gefolgt von Whitespace)
 *   5. Letztes Whitespace
 *   6. Hartes maxOffset (Notfall)
 */
function findBreakpoint(text: string, minOffset: number, maxOffset: number): number {
  if (maxOffset >= text.length) return text.length;
  const slice = text.substring(minOffset, maxOffset);

  const headingMatch = slice.match(/\n#{1,3}\s/g);
  if (headingMatch) {
    const lastIdx = slice.lastIndexOf(headingMatch[headingMatch.length - 1]!);
    if (lastIdx > 0) return minOffset + lastIdx + 1;  // vor dem `#` brechen
  }

  const lastParagraph = slice.lastIndexOf('\n\n');
  if (lastParagraph >= slice.length / 2) return minOffset + lastParagraph + 2;

  const lastNewline = slice.lastIndexOf('\n');
  if (lastNewline >= slice.length / 2) return minOffset + lastNewline + 1;

  const sentenceMatch = slice.match(/[.!?]\s+/g);
  if (sentenceMatch) {
    const lastMatch = sentenceMatch[sentenceMatch.length - 1]!;
    const lastIdx = slice.lastIndexOf(lastMatch);
    if (lastIdx >= slice.length / 2) return minOffset + lastIdx + lastMatch.length;
  }

  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace >= slice.length / 2) return minOffset + lastSpace + 1;

  return maxOffset;
}

/**
 * Section-aware Splitting: bevorzugt Heading-Grenzen.
 *
 * Wenn eine Sektion in das Token-Budget passt, landet sie als ganzer Chunk.
 * Wenn nicht, wird die Sektion mit Overlap weiter gesplittet (Fall-back auf
 * harten Split).
 */
function chunkSectionAware(text: string, options: ChunkOptions): Chunk[] {
  const headings = findHeadings(text);
  if (headings.length === 0) {
    return chunkHardSplit(text, options);
  }

  // Sektionen: [start, end), wo end = nächste Heading-Position oder text.length.
  interface Section {
    start: number;
    end: number;
    heading: string;
  }
  const sections: Section[] = [];
  if (headings[0]!.start > 0) {
    // Inhalt vor dem ersten Heading
    sections.push({ start: 0, end: headings[0]!.start, heading: '(Praeambel)' });
  }
  for (let i = 0; i < headings.length; i += 1) {
    const h = headings[i]!;
    const next = headings[i + 1];
    sections.push({
      start: h.start,
      end: next ? next.start : text.length,
      heading: h.text,
    });
  }

  const maxChars = tokensToChars(options.chunkSizeTokens);
  const overlapChars = tokensToChars(options.chunkOverlapTokens);
  const chunks: Chunk[] = [];

  let buffer = '';
  let bufferStart = 0;
  let bufferHeading: string | undefined;

  const flush = () => {
    if (buffer.length === 0) return;
    chunks.push({
      index: chunks.length,
      text: buffer,
      tokenEstimate: approximateTokenCount(buffer),
      startOffset: bufferStart,
      endOffset: bufferStart + buffer.length,
      heading: bufferHeading,
    });
    buffer = '';
    bufferHeading = undefined;
  };

  for (const section of sections) {
    const sectionText = text.substring(section.start, section.end);

    // Fall A: Sektion ist zu gross fuer einen Chunk → einzeln + hart splitten.
    if (sectionText.length > maxChars) {
      flush();
      // Sektion alleine als hart-split-Block
      const subChunks = chunkHardSplitWithStart(sectionText, options, section.start);
      // Erstem Sub-Chunk das Heading geben
      if (subChunks.length > 0) subChunks[0]!.heading = section.heading;
      chunks.push(...subChunks.map((c, i) => ({ ...c, index: chunks.length + i })));
      continue;
    }

    // Fall B: Sektion passt nicht mehr in den aktuellen Buffer → flush + neu.
    if (buffer.length + sectionText.length > maxChars) {
      flush();
      // Overlap aus dem geflushten Inhalt
      if (chunks.length > 0 && overlapChars > 0) {
        const prev = chunks[chunks.length - 1]!;
        const overlap = prev.text.substring(Math.max(0, prev.text.length - overlapChars));
        buffer = overlap;
        bufferStart = prev.endOffset - overlap.length;
      } else {
        bufferStart = section.start;
      }
      bufferHeading = section.heading;
    }

    // Fall C: passt rein.
    if (buffer.length === 0) {
      bufferStart = section.start;
      bufferHeading = section.heading;
    }
    buffer += sectionText;
  }
  flush();

  // Index re-numbering after possible insertions
  return chunks.map((c, i) => ({ ...c, index: i }));
}

function chunkHardSplitWithStart(text: string, options: ChunkOptions, globalStart: number): Chunk[] {
  const maxChars = tokensToChars(options.chunkSizeTokens);
  const overlapChars = tokensToChars(options.chunkOverlapTokens);
  const chunks: Chunk[] = [];
  let offset = 0;

  while (offset < text.length) {
    const idealEnd = Math.min(offset + maxChars, text.length);
    const minBreakpoint = Math.min(offset + Math.floor(maxChars * 0.9), idealEnd);
    const actualEnd = findBreakpoint(text, minBreakpoint, idealEnd);
    const chunkText = text.substring(offset, actualEnd);

    chunks.push({
      index: chunks.length,
      text: chunkText,
      tokenEstimate: approximateTokenCount(chunkText),
      startOffset: globalStart + offset,
      endOffset: globalStart + actualEnd,
    });

    // Next start: actualEnd minus overlap
    if (actualEnd >= text.length) break;
    offset = Math.max(actualEnd - overlapChars, offset + 1);
  }

  return chunks;
}

function chunkHardSplit(text: string, options: ChunkOptions): Chunk[] {
  return chunkHardSplitWithStart(text, options, 0);
}

/**
 * Top-Level-Entry: chunked einen Text gemaess Optionen.
 */
export function chunkText(text: string, options: ChunkOptions): Chunk[] {
  if (!text || text.length === 0) return [];
  // Wenn der ganze Text bereits in einen Chunk passt → ein Chunk.
  const totalTokens = approximateTokenCount(text);
  if (totalTokens <= options.chunkSizeTokens) {
    return [{
      index: 0,
      text,
      tokenEstimate: totalTokens,
      startOffset: 0,
      endOffset: text.length,
    }];
  }
  return options.sectionAware
    ? chunkSectionAware(text, options)
    : chunkHardSplit(text, options);
}
