import { test, expect, describe } from 'bun:test';
import { Document, Packer, Paragraph, TextRun, Header, HeadingLevel } from 'docx';
import { readZip, writeZip, text, bytes } from './zip';
import { readStyleIndex, ensureStyles } from './styles';
import { parseInline } from './markdown';
import { inspectTemplate, renderWithDesign, TemplateError } from './render';

/** Design-Hülle wie aus deutschem Word: lokalisierte Style-IDs, Kopfzeile mit {{TITEL}}. */
async function germanShell(opts: { marker?: boolean; split?: boolean } = {}): Promise<Uint8Array> {
  const body = opts.marker === false
    ? [new Paragraph({ text: 'Einleitung der Vorlage', heading: HeadingLevel.HEADING_1 })]
    : [new Paragraph({ children: opts.split ? [new TextRun('{{IN'), new TextRun({ text: 'HA', bold: true }), new TextRun('LT}}')] : [new TextRun('{{INHALT}}')] })];
  const doc = new Document({
    styles: { paragraphStyles: [{ id: 'Heading1', name: 'heading 1', run: { size: 36, color: '1F4E79' } }] },
    sections: [{
      headers: { default: new Header({ children: [new Paragraph('Kopf: {{TITEL}}')] }) },
      children: body,
    }],
  });
  const zip = readZip(new Uint8Array(await Packer.toBuffer(doc)));
  // deutsche Style-IDs simulieren; wie bei echten Vorlagen nur Überschrift 1 definiert
  for (const part of ['word/styles.xml', 'word/document.xml']) {
    zip.set(part, bytes(text(zip.get(part)).replaceAll('"Heading1"', '"berschrift1"')));
  }
  const styles = text(zip.get('word/styles.xml')).replace(/<w:style\b[^>]*w:styleId="Heading[2-6]"[\s\S]*?<\/w:style>/g, '');
  zip.set('word/styles.xml', bytes(styles));
  return writeZip(zip);
}

describe('zip', () => {
  test('roundtrip erhält alle Einträge', async () => {
    const src = await germanShell();
    const a = readZip(src);
    const b = readZip(writeZip(a));
    expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
    expect(text(b.get('word/document.xml'))).toBe(text(a.get('word/document.xml')));
  });

  test('kein ZIP → Fehler', () => {
    expect(() => readZip(bytes('kein zip'))).toThrow();
  });
});

describe('styles', () => {
  test('löst lokalisierte IDs über w:name auf', async () => {
    const styles = text(readZip(await germanShell()).get('word/styles.xml'));
    expect(readStyleIndex(styles).byName('heading 1')).toBe('berschrift1');
  });

  test('rüstet fehlende Styles nach, bestehende bleiben unverändert', async () => {
    const styles = text(readZip(await germanShell()).get('word/styles.xml'));
    const { xml, added } = ensureStyles(styles);
    expect(added).toContain('paragraph:heading 2');
    expect(added).toContain('table:table grid');
    expect(added).not.toContain('paragraph:heading 1');
    const idx = readStyleIndex(xml);
    expect(idx.byName('heading 1')).toBe('berschrift1');
    expect(idx.byName('heading 2')).toBe('WpHeading2');
    // Überschrift 2 erbt von der CD-Überschrift 1
    expect(xml).toMatch(/w:styleId="WpHeading2">[\s\S]*?<w:basedOn w:val="berschrift1"\/>/);
    expect(ensureStyles(xml).added).toEqual([]);
  });
});

describe('markdown inline', () => {
  test('fett, kursiv, code, link, verschachtelt', () => {
    expect(parseInline('a **b *c*** d')).toEqual([
      { text: 'a ' }, { text: 'b ', bold: true }, { text: 'c', bold: true, italic: true }, { text: ' d' },
    ]);
    expect(parseInline('`x*y`')).toEqual([{ text: 'x*y', code: true }]);
    expect(parseInline('[Adacor](https://adacor.com)')).toEqual([{ text: 'Adacor', link: 'https://adacor.com' }]);
  });

  test('snake_case bleibt Text, javascript:-Links werden nicht verlinkt', () => {
    expect(parseInline('max_file_size')).toEqual([{ text: 'max_file_size' }]);
    expect(parseInline('[x](javascript:alert(1))').some(i => i.link)).toBe(false);
  });
});

describe('inspectTemplate', () => {
  test('erkennt Marker, Standardfelder, Kopfzeile und fehlende Styles', async () => {
    const r = await inspectTemplate(await germanShell());
    expect(r.hasContentMarker).toBe(true);
    expect(r.placeholders).toContain('TITEL');
    expect(r.hasHeaderOrFooter).toBe(true);
    expect(r.missingStyles).toContain('heading 2');
    expect(r.unknownPlaceholders).toEqual([]);
  });

  test('ungültige Datei → TemplateError', async () => {
    await expect(inspectTemplate(bytes('nope'))).rejects.toBeInstanceOf(TemplateError);
  });
});

describe('renderWithDesign', () => {
  const md = [
    '## Zusammenfassung',
    'Text mit **fett** und [Link](https://adacor.com).',
    '',
    '- Punkt A',
    '  - Unterpunkt',
    '- Punkt B',
    '',
    '1. Eins',
    '2. Zwei',
    '',
    'Zwischentext',
    '',
    '1. Neu eins',
    '',
    '| Risiko | Maßnahme |',
    '|---|---|',
    '| Verzug | Puffer & Plan <b> |',
  ].join('\n');

  test('setzt Inhalt an {{INHALT}}, füllt Kopfzeile, kein Platzhalter-Rest', async () => {
    const out = readZip(await renderWithDesign(await germanShell(), { title: 'Statusbericht', markdown: md }));
    const doc = text(out.get('word/document.xml'));
    const header = [...out.entries()].filter(([k]) => /word\/header\d*\.xml/.test(k)).map(([, v]) => text(v).replace(/<[^>]+>/g, '')).join('');
    expect(doc).not.toContain('{{');
    expect(header).toContain('Kopf: Statusbericht');
    expect(doc).toContain('<w:pStyle w:val="WpHeading2"/>');
    expect(doc).toContain('Puffer &amp; Plan &lt;b&gt;');
    // Titel steht als {{TITEL}} in der Kopfzeile → nicht zusätzlich im Text
    expect(doc).not.toContain('<w:pStyle w:val="WpTitle"/>');
  });

  test('Split-Run-Marker wird ersetzt', async () => {
    const out = readZip(await renderWithDesign(await germanShell({ split: true }), { title: 'T', markdown: 'Hallo' }));
    const doc = text(out.get('word/document.xml'));
    expect(doc).not.toContain('{{');
    expect(doc).toContain('Hallo');
  });

  test('ohne Marker wird ans Dokumentende angehängt, Vorlagentext bleibt', async () => {
    const out = readZip(await renderWithDesign(await germanShell({ marker: false }), { title: 'T', markdown: 'Angehängt' }));
    const doc = text(out.get('word/document.xml'));
    expect(doc.indexOf('Einleitung der Vorlage')).toBeLessThan(doc.indexOf('Angehängt'));
    expect(doc.indexOf('Angehängt')).toBeLessThan(doc.lastIndexOf('<w:sectPr'));
  });

  test('Nummerierung: alle numIds definiert, jede Liste eigene Instanz, Links registriert', async () => {
    const out = readZip(await renderWithDesign(await germanShell(), { title: 'T', markdown: md }));
    const doc = text(out.get('word/document.xml'));
    const numbering = text(out.get('word/numbering.xml'));
    const ids = [...new Set([...doc.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map(m => m[1]))];
    expect(ids.length).toBe(3); // Bullets + zwei getrennte nummerierte Listen
    for (const id of ids) expect(numbering).toContain(`<w:num w:numId="${id}">`);
    expect(numbering.lastIndexOf('<w:abstractNum ')).toBeLessThan(numbering.indexOf('<w:num '));
    expect(text(out.get('word/_rels/document.xml.rels'))).toContain('https://adacor.com');
  });

  test('Tabellen haben explizite Spaltenbreiten (Pages/LibreOffice)', async () => {
    const doc = text(readZip(await renderWithDesign(await germanShell(), { title: 'T', markdown: md })).get('word/document.xml'));
    expect(doc).toMatch(/<w:gridCol w:w="\d+"\/>/);
    expect(doc).not.toContain('<w:gridCol/>');
  });
});

describe('sectionsToMarkdown', () => {
  test('Textzeilen bleiben eigene Absätze, Tabellen/Keyvalue werden Markdown', async () => {
    const { sectionsToMarkdown } = await import('./sections');
    const md = sectionsToMarkdown([
      { title: 'A', type: 'text', content: 'Zeile 1\nZeile 2' },
      { title: 'B', type: 'table', content: { headers: ['x', 'y'], rows: [['1', { text: 'a|b' }]] } },
      { title: 'C', type: 'keyvalue', content: { items: [{ key: 'K', value: 'V' }] } },
    ]);
    expect(md).toContain('Zeile 1\n\nZeile 2');
    expect(md).toContain('| 1 | a\\|b |');
    expect(md).toContain('- **K:** V');
  });
});
