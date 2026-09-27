/**
 * Spike: Block-Inhalte direkt als OOXML erzeugen und in eine Vorlage einsetzen.
 * Grund: docx.patchDocument führt numbering.xml nicht zusammen und nutzt englische
 * Style-IDs (ListParagraph) — in deutschen Vorlagen falsch bzw. kollidierend.
 */
import { text, bytes, type ZipEntries } from './zip';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type Styles = { byName: (name: string, type?: string) => string | undefined };

export function readStyleIndex(stylesXml: string): Styles {
  const map = new Map<string, string>();
  for (const m of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const id = /w:styleId="([^"]*)"/.exec(m[1])?.[1];
    const type = /w:type="([^"]*)"/.exec(m[1])?.[1] ?? 'paragraph';
    const name = /<w:name w:val="([^"]*)"/.exec(m[2])?.[1];
    if (id && name) map.set(`${type}:${name.toLowerCase()}`, id);
  }
  return { byName: (name, type = 'paragraph') => map.get(`${type}:${name.toLowerCase()}`) };
}

// --- Nummerierung: eigene abstractNum/num mit hohen IDs, kollisionsfrei ------
export const NUM_BULLET = 9101;
export const NUM_DECIMAL = 9102;

function abstractNum(id: number, kind: 'bullet' | 'decimal') {
  const lvls = [0, 1, 2].map(i => {
    const fmt = kind === 'bullet'
      ? `<w:numFmt w:val="bullet"/><w:lvlText w:val="${['•', '–', '▪'][i]}"/>`
      : `<w:numFmt w:val="${['decimal', 'lowerLetter', 'lowerRoman'][i]}"/><w:lvlText w:val="%${i + 1}."/>`;
    return `<w:lvl w:ilvl="${i}"><w:start w:val="1"/>${fmt}<w:lvlJc w:val="left"/>` +
      `<w:pPr><w:ind w:left="${360 * (i + 1) + 360}" w:hanging="360"/></w:pPr></w:lvl>`;
  }).join('');
  return `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/>${lvls}</w:abstractNum>`;
}

/** Fügt unsere Listen-Definitionen in numbering.xml ein (legt die Datei bei Bedarf an). */
export function ensureNumbering(zip: ZipEntries, extraNums: number[] = []) {
  let xml = text(zip.get('word/numbering.xml'));
  if (!xml) {
    xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:numbering>';
    const rels = text(zip.get('word/_rels/document.xml.rels'));
    zip.set('word/_rels/document.xml.rels', bytes(rels.replace('</Relationships>',
      '<Relationship Id="rIdWpNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>')));
    const ct = text(zip.get('[Content_Types].xml'));
    zip.set('[Content_Types].xml', bytes(ct.replace('</Types>',
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>')));
  }
  if (xml.includes(`w:abstractNumId="${NUM_BULLET}"`)) return;
  // Schema-Reihenfolge: alle abstractNum vor allen num
  const abstracts = abstractNum(NUM_BULLET, 'bullet') + abstractNum(NUM_DECIMAL, 'decimal');
  const firstNum = xml.search(/<w:num\b/);
  xml = firstNum >= 0 ? xml.slice(0, firstNum) + abstracts + xml.slice(firstNum) : xml.replace('</w:numbering>', abstracts + '</w:numbering>');
  // Jede nummerierte Liste bekommt eine eigene num-Instanz (Neustart bei 1)
  const nums = [`<w:num w:numId="${NUM_BULLET}"><w:abstractNumId w:val="${NUM_BULLET}"/></w:num>`,
    ...extraNums.map(n => `<w:num w:numId="${n}"><w:abstractNumId w:val="${NUM_DECIMAL}"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>`)];
  zip.set('word/numbering.xml', bytes(xml.replace('</w:numbering>', nums.join('') + '</w:numbering>')));
}

// --- Block-Builder -----------------------------------------------------------
export class BlockBuilder {
  parts: string[] = [];
  links: { id: string; url: string }[] = [];
  numberedLists: number[] = [];
  // dokumentweit eindeutig, auch über mehrere Block-Felder hinweg
  private static nextNum = NUM_DECIMAL + 1;
  /** textWidth: nutzbare Satzspiegelbreite in Twips (Seite minus Ränder, aus sectPr der Vorlage) */
  constructor(private st: Styles, private textWidth = 9000) {}

  run(t: string, o: { b?: boolean; i?: boolean; code?: boolean } = {}) {
    const rPr = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : '');
    return `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
  }
  link(t: string, url: string) {
    const id = `rIdWpLink${this.links.length + 1}`;
    this.links.push({ id, url });
    const hl = this.st.byName('Hyperlink', 'character');
    return `<w:hyperlink r:id="${id}"><w:r>${hl ? `<w:rPr><w:rStyle w:val="${hl}"/></w:rPr>` : '<w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>'}<w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:hyperlink>`;
  }
  p(runs: string, styleName?: string, numPr?: { numId: number; ilvl: number }) {
    const sid = styleName ? this.st.byName(styleName) : undefined;
    const pPr = (sid ? `<w:pStyle w:val="${sid}"/>` : '') + (numPr ? `<w:numPr><w:ilvl w:val="${numPr.ilvl}"/><w:numId w:val="${numPr.numId}"/></w:numPr>` : '');
    this.parts.push(`<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs}</w:p>`);
  }
  heading(level: number, runs: string) { this.p(runs, `heading ${level}`); }
  bullet(runs: string, ilvl = 0) { this.p(runs, 'List Paragraph', { numId: NUM_BULLET, ilvl }); }
  newNumberedList() { const n = BlockBuilder.nextNum++; this.numberedLists.push(n); return n; }
  numbered(runs: string, numId: number, ilvl = 0) { this.p(runs, 'List Paragraph', { numId, ilvl }); }
  table(rows: string[][], header = true) {
    const ts = this.st.byName('Table Grid', 'table');
    const cols = Math.max(...rows.map(r => r.length));
    // Explizite Breiten in Twips: Pages/LibreOffice brauchen gefüllte gridCol, Word verzeiht leere
    const w = Math.floor(this.textWidth / cols);
    const tr = rows.map((r, i) => `<w:tr>${i === 0 && header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}` +
      r.map(c => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr><w:p>${this.run(c, { b: i === 0 && header })}</w:p></w:tc>`).join('') + '</w:tr>').join('');
    this.parts.push(`<w:tbl><w:tblPr>${ts ? `<w:tblStyle w:val="${ts}"/>` : ''}<w:tblW w:w="${w * cols}" w:type="dxa"/><w:tblLayout w:type="fixed"/>` +
      `<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>` +
      `<w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${tr}</w:tbl>`);
    this.parts.push('<w:p/>'); // Word braucht nach Tabelle einen Absatz, sonst verkleben aufeinanderfolgende Tabellen
  }
  xml() { return this.parts.join(''); }
}

/** Satzspiegelbreite aus dem letzten sectPr (pgSz − linker/rechter Rand). */
export function textWidthFromDocument(documentXml: string): number {
  const sect = documentXml.slice(documentXml.lastIndexOf('<w:sectPr'));
  const pg = Number(/<w:pgSz[^>]*w:w="(\d+)"/.exec(sect)?.[1] ?? 11906);
  const l = Number(/<w:pgMar[^>]*w:left="(\d+)"/.exec(sect)?.[1] ?? 1417);
  const r = Number(/<w:pgMar[^>]*w:right="(\d+)"/.exec(sect)?.[1] ?? 1417);
  return pg - l - r;
}

/** Ersetzt jeden Absatz, dessen Gesamttext genau `{{name}}` ist (robust gg. Split-Runs). */
export function replaceBlockPlaceholders(zip: ZipEntries, blocks: Record<string, BlockBuilder>) {
  let doc = text(zip.get('word/document.xml'));
  const found: string[] = [];
  doc = doc.replace(/<w:p\b[^>]*>(?:(?!<w:p\b)[\s\S])*?<\/w:p>/g, para => {
    const t = [...para.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map(m => m[1]).join('').trim();
    const m = /^\{\{\s*([\w.-]+)\s*\}\}$/.exec(t);
    if (!m || !blocks[m[1]]) return para;
    found.push(m[1]);
    return blocks[m[1]].xml() || '<w:p/>';
  });
  zip.set('word/document.xml', bytes(doc));

  // Hyperlinks + Nummerierung registrieren
  const all = Object.values(blocks);
  const links = all.flatMap(b => b.links);
  if (links.length) {
    const rels = text(zip.get('word/_rels/document.xml.rels'));
    zip.set('word/_rels/document.xml.rels', bytes(rels.replace('</Relationships>',
      links.map(l => `<Relationship Id="${l.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(l.url)}" TargetMode="External"/>`).join('') + '</Relationships>')));
  }
  ensureNumbering(zip, all.flatMap(b => b.numberedLists));
  return found;
}
