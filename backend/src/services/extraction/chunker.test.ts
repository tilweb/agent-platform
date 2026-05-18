import { test, expect, describe } from 'bun:test';
import { chunkText } from './chunker';

describe('chunkText', () => {
  test('empty input returns empty array', () => {
    expect(chunkText('', { chunkSizeTokens: 100, chunkOverlapTokens: 10, sectionAware: true })).toEqual([]);
  });

  test('short text fits in one chunk', () => {
    const text = 'Das ist ein kurzer Text.';
    const chunks = chunkText(text, { chunkSizeTokens: 1000, chunkOverlapTokens: 100, sectionAware: true });
    expect(chunks.length).toBe(1);
    expect(chunks[0]!.text).toBe(text);
    expect(chunks[0]!.startOffset).toBe(0);
    expect(chunks[0]!.endOffset).toBe(text.length);
  });

  test('long text without headings — hard split with overlap', () => {
    // Erzeuge sehr langen Text ohne Strukturen.
    const longText = 'Lorem ipsum dolor sit amet. '.repeat(200); // ~5600 chars
    const chunks = chunkText(longText, { chunkSizeTokens: 400, chunkOverlapTokens: 50, sectionAware: false });
    expect(chunks.length).toBeGreaterThan(1);
    // Alle Chunks unter Token-Budget (mit grosszuegigen 20% Toleranz)
    for (const c of chunks) {
      expect(c.tokenEstimate).toBeLessThanOrEqual(500);
    }
    // Chunks ueberlappen
    for (let i = 1; i < chunks.length; i += 1) {
      const prev = chunks[i - 1]!;
      const curr = chunks[i]!;
      expect(curr.startOffset).toBeLessThan(prev.endOffset);
    }
  });

  test('section-aware splitting bevorzugt Heading-Grenzen', () => {
    // Drei laengere Sektionen, die zusammen mehr als chunk_size_tokens sind,
    // jede einzelne aber drunter. Erwartung: Chunker macht ungefaehr 3 Chunks
    // (eine pro Heading) statt mitten in einer Sektion zu schneiden.
    const filler = 'Lorem ipsum dolor sit amet. '.repeat(30); // ~840 chars je Sektion
    const md = `# Section A\n\n${filler}\n# Section B\n\n${filler}\n# Section C\n\n${filler}`;
    const chunks = chunkText(md, { chunkSizeTokens: 300, chunkOverlapTokens: 20, sectionAware: true });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const withHeadings = chunks.filter((c) => c.heading);
    expect(withHeadings.length).toBeGreaterThan(0);
  });

  test('large section without intra-heading-split: fallback auf hard split', () => {
    const heading = '# Riesensektion\n\n';
    const body = 'Inhalt-Satz. '.repeat(500);
    const md = heading + body;
    const chunks = chunkText(md, { chunkSizeTokens: 200, chunkOverlapTokens: 20, sectionAware: true });
    expect(chunks.length).toBeGreaterThan(1);
    // Erster Chunk traegt das Heading
    expect(chunks[0]!.heading).toBe('Riesensektion');
  });

  test('Chunks decken den gesamten Text ab (modulo overlap)', () => {
    const text = 'a'.repeat(5000);
    const chunks = chunkText(text, { chunkSizeTokens: 300, chunkOverlapTokens: 30, sectionAware: false });
    // Erster Chunk start bei 0, letzter endet bei text.length
    expect(chunks[0]!.startOffset).toBe(0);
    expect(chunks[chunks.length - 1]!.endOffset).toBe(text.length);
  });

  test('Indices sind aufsteigend und beginnen bei 0', () => {
    const md = `# A\nx\n# B\ny\n# C\nz`;
    const chunks = chunkText(md, { chunkSizeTokens: 10, chunkOverlapTokens: 2, sectionAware: true });
    for (let i = 0; i < chunks.length; i += 1) {
      expect(chunks[i]!.index).toBe(i);
    }
  });
});
