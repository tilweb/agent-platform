/**
 * Block-Inhalte (Absätze, Listen, Tabellen) direkt als WordprocessingML erzeugen
 * und in eine Vorlage einsetzen.
 *
 * Warum nicht docx.patchDocument für Blöcke: Es führt numbering.xml nicht zusammen
 * (Aufzählungen hängen sich an fremde Listen der Vorlage) und schreibt englische
 * Style-IDs, die in deutschen Vorlagen nicht existieren. Details: docs/word-vorlagen-2026-09-25.md
 */
import type { StyleIndex } from './styles';
import { text, bytes, type ZipEntries } from './zip';

export interface Inline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
}

// Eigene Nummerierungs-IDs weit oberhalb dessen, was Word selbst vergibt
const NUM_BULLET = 9101;
const NUM_DECIMAL = 9102;

export interface RenderContext {
  styles: StyleIndex;
  /** nutzbare Satzspiegelbreite in Twips */
  textWidth: number;
  links: Array<{ id: string; url: string }>;
  numberedLists: number[];
  nextNum: number;
}

export function createContext(styles: StyleIndex, textWidth: number): RenderContext {
  return { styles, textWidth, links: [], numberedLists: [], nextNum: NUM_DECIMAL + 1 };
}

// Steuerzeichen außer Tab/Zeilenumbruch sind in XML 1.0 verboten und machen die Datei für Word kaputt
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(s: string): string {
  return s.replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export class BlockWriter {
  private parts: string[] = [];

  constructor(private ctx: RenderContext) {}

  private runs(inlines: Inline[]): string {
    return inlines.map(i => {
      const hl = i.link ? this.ctx.styles.byName('Hyperlink', 'character') : undefined;
      // Reihenfolge nach OOXML-Schema (CT_RPr) — Word meldet sonst "unlesbarer Inhalt"
      const rPr =
        (hl ? `<w:rStyle w:val="${hl}"/>` : '') +
        (i.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' : '') +
        (i.bold ? '<w:b/><w:bCs/>' : '') +
        (i.italic ? '<w:i/><w:iCs/>' : '') +
        (i.strike ? '<w:strike/>' : '') +
        (i.link && !hl ? '<w:color w:val="0563C1"/>' : '') +
        (i.link && !hl ? '<w:u w:val="single"/>' : '') +
        (i.code ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : '');
      if (!i.link) return runXml(i.text, rPr);
      const id = `rIdWpLink${this.ctx.links.length + 1}`;
      this.ctx.links.push({ id, url: i.link });
      return `<w:hyperlink r:id="${id}" w:history="1">${runXml(i.text, rPr)}</w:hyperlink>`;
    }).join('');
  }

  private pPr(styleName?: string, extra = ''): string {
    const sid = styleName ? this.ctx.styles.byName(styleName) : undefined;
    const inner = (sid ? `<w:pStyle w:val="${sid}"/>` : '') + extra;
    return inner ? `<w:pPr>${inner}</w:pPr>` : '';
  }

  paragraph(inlines: Inline[], styleName?: string): void {
    this.parts.push(`<w:p>${this.pPr(styleName)}${this.runs(inlines)}</w:p>`);
  }

  title(inlines: Inline[]): void {
    this.paragraph(inlines, 'Title');
  }

  heading(level: number, inlines: Inline[]): void {
    this.paragraph(inlines, `heading ${Math.min(Math.max(level, 1), 4)}`);
  }

  bullet(inlines: Inline[], level = 0): void {
    this.listItem(inlines, NUM_BULLET, level);
  }

  /** Startet eine neue nummerierte Liste (beginnt wieder bei 1) und liefert deren numId. */
  startNumberedList(): number {
    const numId = this.ctx.nextNum++;
    this.ctx.numberedLists.push(numId);
    return numId;
  }

  numbered(inlines: Inline[], numId: number, level = 0): void {
    this.listItem(inlines, numId, level);
  }

  private listItem(inlines: Inline[], numId: number, level: number): void {
    const ilvl = Math.min(Math.max(level, 0), 2);
    this.parts.push(`<w:p>${this.pPr('List Paragraph', `<w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr>`)}${this.runs(inlines)}</w:p>`);
  }

  quote(inlines: Inline[]): void {
    this.paragraph(inlines, 'Quote');
  }

  codeBlock(lines: string[]): void {
    for (const line of lines) {
      const pPr = '<w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:spacing w:before="0" w:after="0"/></w:pPr>';
      this.parts.push(`<w:p>${pPr}${runXml(line || ' ', '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="18"/>')}</w:p>`);
    }
  }

  rule(): void {
    this.parts.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>');
  }

  /** rows[0] ist die Kopfzeile, wenn header=true. Zellen sind Inline-Listen. */
  table(rows: Inline[][][], header = true): void {
    if (rows.length === 0) return;
    const cols = Math.max(...rows.map(r => r.length));
    // Explizite Breiten in Twips: Pages/LibreOffice brauchen gefüllte gridCol, Word verzeiht leere
    const w = Math.floor(this.ctx.textWidth / cols);
    const ts = this.ctx.styles.byName('Table Grid', 'table');
    const trs = rows.map((row, i) => {
      const isHeader = header && i === 0;
      const cells = Array.from({ length: cols }, (_, c) => {
        const content = row[c] ?? [];
        const inl = isHeader ? content.map(x => ({ ...x, bold: true })) : content;
        return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr><w:p>${this.runs(inl)}</w:p></w:tc>`;
      }).join('');
      return `<w:tr>${isHeader ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells}</w:tr>`;
    }).join('');
    this.parts.push(
      `<w:tbl><w:tblPr>${ts ? `<w:tblStyle w:val="${ts}"/>` : ''}<w:tblW w:w="${w * cols}" w:type="dxa"/><w:tblLayout w:type="fixed"/>` +
      `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
      `<w:tblGrid>${`<w:gridCol w:w="${w}"/>`.repeat(cols)}</w:tblGrid>${trs}</w:tbl>`,
    );
    // Absatz nach der Tabelle: sonst verkleben aufeinanderfolgende Tabellen in Word
    this.parts.push('<w:p/>');
  }

  isEmpty(): boolean {
    return this.parts.length === 0;
  }

  xml(): string {
    return this.parts.join('');
  }
}

function runXml(t: string, rPr: string): string {
  // Zeilenumbrüche innerhalb eines Absatzes als <w:br/>
  const segs = t.split('\n').map(s => `<w:t xml:space="preserve">${escapeXml(s)}</w:t>`).join('<w:br/>');
  return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}${segs}</w:r>`;
}

// ---------------------------------------------------------------------------
// Einsetzen ins Paket
// ---------------------------------------------------------------------------

const PARAGRAPH_RE = /<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>|<w:p\b[^>]*\/>/g;

function paragraphText(para: string): string {
  return [...para.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(m => m[1]).join('');
}

/** Namen aller Absätze, deren gesamter Text genau `{{name}}` ist (Block-Platzhalter). */
export function findBlockPlaceholders(documentXml: string): string[] {
  const names: string[] = [];
  for (const m of documentXml.matchAll(PARAGRAPH_RE)) {
    const hit = /^\{\{\s*([\p{L}\p{N}_.-]+)\s*\}\}$/u.exec(paragraphText(m[0]).trim());
    if (hit?.[1]) names.push(hit[1]);
  }
  return names;
}

/**
 * Ersetzt Block-Platzhalter-Absätze durch erzeugtes XML. Robust gegen Platzhalter,
 * die Word über mehrere Runs verteilt hat. Gibt die ersetzten Namen zurück.
 */
export function replaceBlockPlaceholders(zip: ZipEntries, blocks: Record<string, string>): string[] {
  const replaced: string[] = [];
  const doc = text(zip.get('word/document.xml')).replace(PARAGRAPH_RE, para => {
    const hit = /^\{\{\s*([\p{L}\p{N}_.-]+)\s*\}\}$/u.exec(paragraphText(para).trim());
    const name = hit?.[1];
    if (!name || !(name in blocks)) return para;
    replaced.push(name);
    return blocks[name] || '<w:p/>';
  });
  zip.set('word/document.xml', bytes(doc));
  return replaced;
}

/** Hängt XML ans Ende des Dokumentkörpers (vor dem abschließenden sectPr). */
export function appendToBody(zip: ZipEntries, xml: string): void {
  const doc = text(zip.get('word/document.xml'));
  const bodyEnd = doc.lastIndexOf('</w:body>');
  const sect = doc.lastIndexOf('<w:sectPr', bodyEnd);
  const at = sect > doc.lastIndexOf('</w:p>', bodyEnd) && sect > doc.lastIndexOf('</w:tbl>', bodyEnd) ? sect : bodyEnd;
  zip.set('word/document.xml', bytes(doc.slice(0, at) + xml + doc.slice(at)));
}

/** Satzspiegelbreite aus dem letzten sectPr (Seitenbreite minus linker/rechter Rand). */
export function textWidthFromDocument(documentXml: string): number {
  const sect = documentXml.slice(documentXml.lastIndexOf('<w:sectPr'));
  const page = Number(/<w:pgSz\b[^>]*\bw:w="(\d+)"/.exec(sect)?.[1] ?? 11906);
  const left = Number(/<w:pgMar\b[^>]*\bw:left="(\d+)"/.exec(sect)?.[1] ?? 1417);
  const right = Number(/<w:pgMar\b[^>]*\bw:right="(\d+)"/.exec(sect)?.[1] ?? 1417);
  const width = page - left - right;
  return width > 1000 ? width : 9072;
}

/** Registriert Hyperlinks und Listen-Definitionen des Kontexts im Paket. */
export function finalizePackage(zip: ZipEntries, ctx: RenderContext): void {
  if (ctx.links.length) {
    const rels = text(zip.get('word/_rels/document.xml.rels'));
    const add = ctx.links
      .map(l => `<Relationship Id="${l.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(l.url)}" TargetMode="External"/>`)
      .join('');
    zip.set('word/_rels/document.xml.rels', bytes(rels.replace('</Relationships>', `${add}</Relationships>`)));
  }
  const doc = text(zip.get('word/document.xml'));
  if (doc.includes(`<w:numId w:val="${NUM_BULLET}"/>`) || ctx.numberedLists.length) {
    ensureNumbering(zip, ctx.numberedLists);
  }
}

function abstractNum(id: number, kind: 'bullet' | 'decimal'): string {
  const lvls = [0, 1, 2].map(i => {
    const fmt = kind === 'bullet'
      ? `<w:numFmt w:val="bullet"/><w:lvlText w:val="${['•', '–', '▪'][i]}"/>`
      : `<w:numFmt w:val="${['decimal', 'lowerLetter', 'lowerRoman'][i]}"/><w:lvlText w:val="%${i + 1}."/>`;
    return `<w:lvl w:ilvl="${i}"><w:start w:val="1"/>${fmt}<w:lvlJc w:val="left"/>` +
      `<w:pPr><w:ind w:left="${360 * (i + 2)}" w:hanging="360"/></w:pPr></w:lvl>`;
  }).join('');
  return `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/>${lvls}</w:abstractNum>`;
}

function ensureNumbering(zip: ZipEntries, numberedLists: number[]): void {
  let xml = text(zip.get('word/numbering.xml'));
  if (!xml) {
    xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:numbering>';
    const rels = text(zip.get('word/_rels/document.xml.rels'));
    zip.set('word/_rels/document.xml.rels', bytes(rels.replace('</Relationships>',
      '<Relationship Id="rIdWpNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>')));
    const types = text(zip.get('[Content_Types].xml'));
    zip.set('[Content_Types].xml', bytes(types.replace('</Types>',
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>')));
  }
  // Schema verlangt: alle abstractNum vor allen num
  const abstracts = abstractNum(NUM_BULLET, 'bullet') + abstractNum(NUM_DECIMAL, 'decimal');
  const firstNum = xml.search(/<w:num\b/);
  xml = firstNum >= 0
    ? xml.slice(0, firstNum) + abstracts + xml.slice(firstNum)
    : xml.replace('</w:numbering>', `${abstracts}</w:numbering>`);
  const nums =
    `<w:num w:numId="${NUM_BULLET}"><w:abstractNumId w:val="${NUM_BULLET}"/></w:num>` +
    numberedLists.map(n =>
      `<w:num w:numId="${n}"><w:abstractNumId w:val="${NUM_DECIMAL}"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`,
    ).join('');
  zip.set('word/numbering.xml', bytes(xml.replace('</w:numbering>', `${nums}</w:numbering>`)));
}
