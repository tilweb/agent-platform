/**
 * Formatvorlagen einer Word-Vorlage auflösen und fehlende nachrüsten.
 *
 * Word speichert Style-IDs lokalisiert ("berschrift1" in deutschen Vorlagen,
 * "Heading1" in englischen). Stabil ist nur der sprachneutrale w:name
 * ("heading 1", "List Paragraph", "Table Grid"). Wir lösen darüber auf.
 *
 * Vorlagen enthalten oft nur die tatsächlich benutzten Formatvorlagen. Fehlende
 * rüsten wir nach dem Muster von Words eigenen Definitionen nach — mit Theme-
 * Schrift und Theme-Akzentfarbe, damit sie das CD der Vorlage erben.
 */

export interface StyleIndex {
  /** styleId zu einem sprachneutralen Namen, z.B. byName('heading 1') → 'berschrift1' */
  byName(name: string, type?: StyleType): string | undefined;
}

export type StyleType = 'paragraph' | 'character' | 'table';

export function readStyleIndex(stylesXml: string): StyleIndex {
  const map = new Map<string, string>();
  for (const m of stylesXml.matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    const attrs = m[1] ?? '';
    const id = /w:styleId="([^"]*)"/.exec(attrs)?.[1];
    const type = /w:type="([^"]*)"/.exec(attrs)?.[1] ?? 'paragraph';
    const name = /<w:name w:val="([^"]*)"/.exec(m[2] ?? '')?.[1];
    if (id && name) map.set(`${type}:${name.toLowerCase()}`, id);
  }
  return { byName: (name, type = 'paragraph') => map.get(`${type}:${name.toLowerCase()}`) };
}

/** Ergänzbare Formatvorlagen: sprachneutraler Name → OOXML-Definition. */
function styleDefinitions(normalId: string | undefined, heading1Id: string | undefined): Array<{ key: string; xml: string }> {
  const basedOnNormal = normalId ? `<w:basedOn w:val="${normalId}"/><w:next w:val="${normalId}"/>` : '';
  const next = normalId ? `<w:next w:val="${normalId}"/>` : '';
  const themeHeadingRun =
    `<w:rFonts w:asciiTheme="majorHAnsi" w:eastAsiaTheme="majorEastAsia" w:hAnsiTheme="majorHAnsi" w:cstheme="majorBidi"/>` +
    `<w:color w:val="2F5496" w:themeColor="accent1" w:themeShade="BF"/>`;
  // Größen in halben Punkten, analog zu Words Standard-Überschriften. Hat die Vorlage
  // eine eigene Überschrift 1, erben tiefere Ebenen deren Schrift und Farbe.
  const heading = (lvl: number, size: number, spaceBefore: number) => {
    const inherit = lvl > 1 && heading1Id;
    return {
      key: `paragraph:heading ${lvl}`,
      xml:
        `<w:style w:type="paragraph" w:styleId="WpHeading${lvl}"><w:name w:val="heading ${lvl}"/>` +
        (inherit ? `<w:basedOn w:val="${heading1Id}"/>${next}` : basedOnNormal) +
        `<w:uiPriority w:val="9"/><w:unhideWhenUsed/><w:qFormat/>` +
        `<w:pPr><w:keepNext/><w:keepLines/><w:spacing w:before="${spaceBefore}" w:after="80"/><w:outlineLvl w:val="${lvl - 1}"/></w:pPr>` +
        `<w:rPr>${inherit ? '' : themeHeadingRun}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`,
    };
  };
  return [
    {
      key: 'paragraph:title',
      xml:
        `<w:style w:type="paragraph" w:styleId="WpTitle"><w:name w:val="Title"/>${basedOnNormal}<w:uiPriority w:val="10"/><w:qFormat/>` +
        `<w:pPr><w:spacing w:after="160"/><w:contextualSpacing/></w:pPr>` +
        `<w:rPr><w:rFonts w:asciiTheme="majorHAnsi" w:eastAsiaTheme="majorEastAsia" w:hAnsiTheme="majorHAnsi" w:cstheme="majorBidi"/>` +
        `<w:kern w:val="28"/><w:sz w:val="56"/><w:szCs w:val="56"/></w:rPr></w:style>`,
    },
    heading(1, 32, 360),
    heading(2, 26, 240),
    heading(3, 24, 200),
    heading(4, 22, 160),
    {
      key: 'paragraph:list paragraph',
      xml:
        `<w:style w:type="paragraph" w:styleId="WpListParagraph"><w:name w:val="List Paragraph"/>${basedOnNormal}` +
        `<w:uiPriority w:val="34"/><w:qFormat/><w:pPr><w:spacing w:after="60"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style>`,
    },
    {
      key: 'paragraph:quote',
      xml:
        `<w:style w:type="paragraph" w:styleId="WpQuote"><w:name w:val="Quote"/>${basedOnNormal}<w:uiPriority w:val="29"/><w:qFormat/>` +
        `<w:pPr><w:spacing w:before="120" w:after="120"/><w:ind w:left="567" w:right="567"/></w:pPr>` +
        `<w:rPr><w:i/><w:iCs/><w:color w:val="404040" w:themeColor="text1" w:themeTint="BF"/></w:rPr></w:style>`,
    },
    {
      key: 'character:hyperlink',
      xml:
        `<w:style w:type="character" w:styleId="WpHyperlink"><w:name w:val="Hyperlink"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/>` +
        `<w:rPr><w:color w:val="0563C1" w:themeColor="hyperlink"/><w:u w:val="single"/></w:rPr></w:style>`,
    },
    {
      key: 'table:table grid',
      xml:
        `<w:style w:type="table" w:styleId="WpTableGrid"><w:name w:val="Table Grid"/><w:uiPriority w:val="39"/>` +
        `<w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>` +
        `<w:tblPr><w:tblBorders>` +
        ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`).join('') +
        `</w:tblBorders><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>` +
        `<w:bottom w:w="40" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>`,
    },
  ];
}

/**
 * Rüstet fehlende Formatvorlagen nach. Bestehende werden nie verändert —
 * das Design der Vorlage hat immer Vorrang.
 */
export function ensureStyles(stylesXml: string): { xml: string; added: string[] } {
  const index = readStyleIndex(stylesXml);
  const added: string[] = [];
  let defs = '';
  for (const def of styleDefinitions(index.byName('Normal'), index.byName('heading 1'))) {
    const [t, n] = splitKey(def.key);
    if (!index.byName(n, t)) {
      defs += def.xml;
      added.push(def.key);
    }
  }
  return { xml: defs ? stylesXml.replace('</w:styles>', `${defs}</w:styles>`) : stylesXml, added };
}

function splitKey(key: string): [StyleType, string] {
  const i = key.indexOf(':');
  return [key.slice(0, i) as StyleType, key.slice(i + 1)];
}
