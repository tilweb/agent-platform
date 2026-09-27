/**
 * Phase-0-Spike Word-Vorlagen (siehe docs/word-vorlagen-*.md).
 * Prüft mit einer echten deutschen Word-Datei, ob docx.patchDocument als Engine
 * für Design- und Strukturvorlagen trägt — ohne neue Dependency.
 *
 * Usage: bun run tools/doc-template-spike/spike.ts [vorlage.docx]
 * Ausgabe: tools/doc-template-spike/out/
 */
import {
  patchDocument, patchDetector, PatchType, TextRun,
} from '../../backend/node_modules/docx/dist/index.mjs';
import { readZip, writeZip, text, bytes } from './zip';
import { mkdirSync } from 'node:fs';
import { BlockBuilder, readStyleIndex, replaceBlockPlaceholders, textWidthFromDocument, NUM_BULLET } from './ooxml';

const SRC = process.argv[2] ?? 'docs/projektmanagement-imports/Projektauftrag - Neues IT-System.docx';
const OUT = 'tools/doc-template-spike/out';
mkdirSync(OUT, { recursive: true });

const results: { check: string; ok: boolean; note?: string }[] = [];
const check = (name: string, ok: boolean, note?: string) => { results.push({ check: name, ok, note }); };

// ---------------------------------------------------------------------------
// 1. Style-Mapping über sprachneutrale w:name
// ---------------------------------------------------------------------------
type StyleInfo = { id: string; type: string; name: string };
function readStyles(stylesXml: string): Map<string, StyleInfo> {
  const map = new Map<string, StyleInfo>();
  const re = /<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g;
  for (const m of stylesXml.matchAll(re)) {
    const id = /w:styleId="([^"]*)"/.exec(m[1])?.[1];
    const type = /w:type="([^"]*)"/.exec(m[1])?.[1] ?? 'paragraph';
    const name = /<w:name w:val="([^"]*)"/.exec(m[2])?.[1];
    if (id && name) map.set(`${type}:${name.toLowerCase()}`, { id, type, name });
  }
  return map;
}

const srcZip = readZip(new Uint8Array(await Bun.file(SRC).arrayBuffer()));
const styles = readStyles(text(srcZip.get('word/styles.xml')));
const want = ['heading 1', 'heading 2', 'heading 3', 'title', 'list bullet', 'list number', 'list paragraph'];
const styleMap: Record<string, string | null> = {};
for (const w of want) styleMap[w] = styles.get(`paragraph:${w}`)?.id ?? null;
const tableStyles = [...styles.values()].filter(s => s.type === 'table').map(s => `${s.id}=${s.name}`);
console.log('Style-Mapping:', styleMap);
console.log('Tabellen-Styles:', tableStyles);
check('heading 1 → lokalisierte ID aufgelöst', !!styleMap['heading 1'], `heading 1 → ${styleMap['heading 1']}`);

// ---------------------------------------------------------------------------
// 2. Fehlende Styles nachrüsten (Überschrift 2/3, Tabellengitter) — Word-native
//    Definitionen, abgeleitet von vorhandener Überschrift 1 wo möglich
// ---------------------------------------------------------------------------
function ensureStyles(stylesXml: string): { xml: string; added: string[] } {
  const added: string[] = [];
  const add = (key: string, def: string) => {
    if (!styles.has(key)) { stylesXml = stylesXml.replace('</w:styles>', def + '</w:styles>'); added.push(key); }
  };
  const h1 = styles.get('paragraph:heading 1')?.id;
  for (const [lvl, size] of [[2, 26], [3, 24]] as const) {
    add(`paragraph:heading ${lvl}`,
      `<w:style w:type="paragraph" w:styleId="WpHeading${lvl}"><w:name w:val="heading ${lvl}"/>` +
      (h1 ? `<w:basedOn w:val="${h1}"/>` : '') +
      `<w:next w:val="${styles.get('paragraph:normal')?.id ?? 'Normal'}"/><w:uiPriority w:val="9"/><w:unhideWhenUsed/><w:qFormat/>` +
      `<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="${lvl - 1}"/></w:pPr>` +
      `<w:rPr><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`);
  }
  add('table:table grid',
    `<w:style w:type="table" w:styleId="WpTableGrid"><w:name w:val="Table Grid"/><w:uiPriority w:val="39"/>` +
    `<w:tblPr><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar><w:tblBorders>` +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(b => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`).join('') +
    `</w:tblBorders></w:tblPr></w:style>`);
  return { xml: stylesXml, added };
}

// ---------------------------------------------------------------------------
// 3. Design-Hülle aus echtem Dokument: Body leeren, sectPr (Kopf/Fuß/Ränder) behalten
// ---------------------------------------------------------------------------
function makeShell(zip: Map<string, Uint8Array>, splitRuns: boolean): Uint8Array {
  const out = new Map(zip);
  const doc = text(zip.get('word/document.xml'));
  const bodyStart = doc.indexOf('<w:body>') + '<w:body>'.length;
  const sectStart = doc.lastIndexOf('<w:sectPr');
  const placeholder = splitRuns
    // Wie Word es nach Rechtschreibprüfung/Formatwechsel speichert: Platzhalter über 3 Runs verteilt
    ? '<w:p><w:r><w:t>{{IN</w:t></w:r><w:proofErr w:type="spellStart"/><w:r><w:rPr><w:b/></w:rPr><w:t>HA</w:t></w:r><w:proofErr w:type="spellEnd"/><w:r><w:t>LT}}</w:t></w:r></w:p>'
    : '<w:p><w:r><w:t>{{INHALT}}</w:t></w:r></w:p>';
  out.set('word/document.xml', bytes(doc.slice(0, bodyStart) + placeholder + doc.slice(sectStart)));
  addHeaderLogo(out);
  const { xml, added } = ensureStyles(text(zip.get('word/styles.xml')));
  out.set('word/styles.xml', bytes(xml));
  if (!splitRuns) console.log('Nachgerüstete Styles:', added);
  return writeZip(out);
}

/** Setzt image1.png als Logo rechts in die Kopfzeile — simuliert eine CD-Vorlage mit Header-Logo. */
function addHeaderLogo(z: Map<string, Uint8Array>) {
  const hdr = text(z.get('word/header1.xml'));
  const drawing = `<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1440000" cy="540000"/><wp:docPr id="9901" name="Logo"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="9901" name="Logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdWpLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1440000" cy="540000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  z.set('word/header1.xml', bytes(hdr.replace(/(<w:hdr\b[^>]*>)/, `$1${drawing}`)));
  z.set('word/_rels/header1.xml.rels', bytes('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdWpLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>'));
}

const shell = makeShell(srcZip, false);
const shellSplit = makeShell(srcZip, true);
await Bun.write(`${OUT}/shell.docx`, shell);
check('Hülle erzeugt + wieder lesbar (ZIP roundtrip)', readZip(shell).size >= srcZip.size);

// ---------------------------------------------------------------------------
// 4. Platzhalter-Erkennung inkl. zerstückelter Runs
// ---------------------------------------------------------------------------
const det = await patchDetector({ data: shell });
const detSplit = await patchDetector({ data: shellSplit });
check('patchDetector: Platzhalter in einem Run', det.includes('INHALT'), JSON.stringify(det));
check('patchDetector: Platzhalter über 3 Runs', detSplit.includes('INHALT'), JSON.stringify(detSplit));

// ---------------------------------------------------------------------------
// 5. Design-Pfad: Block-Inhalt als eigenes OOXML statt docx-Objekte
//    (Befund: patchDocument merged numbering.xml nicht, nutzt englische IDs)
// ---------------------------------------------------------------------------
const st = readStyleIndex(text(readZip(shell).get('word/styles.xml')));
const tw = textWidthFromDocument(text(srcZip.get('word/document.xml')));
console.log('Satzspiegelbreite (Twips):', tw);

function designContent() {
  const b = new BlockBuilder(st, tw);
  b.heading(1, b.run('Projektstatus Q3'));
  b.p(b.run('Fließtext mit ') + b.run('Fettung', { b: true }) + b.run(' und ') + b.run('Kursiv', { i: true }) + b.run(' sowie ') + b.link('Link', 'https://adacor.com') + b.run('.'));
  b.heading(2, b.run('Meilensteine'));
  b.bullet(b.run('Aufzählung Ebene 1'));
  b.bullet(b.run('Aufzählung Ebene 2'), 1);
  b.bullet(b.run('Aufzählung Ebene 1 (zwei)'));
  b.heading(3, b.run('Nächste Schritte'));
  const n1 = b.newNumberedList();
  b.numbered(b.run('Erster Schritt'), n1); b.numbered(b.run('Zweiter Schritt'), n1);
  b.p(b.run('Zweite Liste soll wieder bei 1 beginnen:'));
  const n2 = b.newNumberedList();
  b.numbered(b.run('Neu Eins'), n2); b.numbered(b.run('Neu Zwei'), n2);
  b.heading(2, b.run('Risiken'));
  b.table([['Risiko', 'Eintritt', 'Maßnahme'], ['Lieferverzug', 'mittel', 'Puffer einplanen'], ['Budget', 'gering', 'Monatliches Controlling']]);
  return b;
}

for (const [src, file] of [[shell, 'design-filled.docx'], [shellSplit, 'design-filled-splitruns.docx']] as const) {
  const zip = readZip(src);
  const found = replaceBlockPlaceholders(zip, { INHALT: designContent() });
  const out = writeZip(zip);
  await Bun.write(`${OUT}/${file}`, out);
  const oz = readZip(out);
  const doc = text(oz.get('word/document.xml'));
  const num = text(oz.get('word/numbering.xml'));
  const tag = file.includes('split') ? ' (split runs)' : '';
  check(`Design${tag}: Platzhalter ersetzt, kein {{…}}-Rest`, found.includes('INHALT') && !doc.includes('{{'));
  if (tag) continue;
  check('Design: Kopf-/Fußzeile + Header-Logo erhalten', /headerReference/.test(doc) && /footerReference/.test(doc) && text(oz.get('word/_rels/header1.xml.rels')).includes('media/image1.png'));
  check('Design: Überschriften nutzen lokalisierte/nachgerüstete IDs', doc.includes('w:val="berschrift1"') && doc.includes('w:val="WpHeading2"') && doc.includes('w:val="WpHeading3"'));
  check('Design: Listenabsatz lokalisiert', doc.includes('<w:pStyle w:val="Listenabsatz"/>'));
  const ids = [...new Set([...doc.matchAll(/<w:numId w:val="(\d+)"\/>/g)].map(m => m[1]))];
  check('Design: alle numIds definiert', ids.every(id => num.includes(`<w:num w:numId="${id}">`)), ids.join(','));
  check('Design: numbering.xml Schema-Reihenfolge (abstractNum vor num)', num.lastIndexOf('<w:abstractNum ') < num.indexOf('<w:num '));
  check('Design: Tabelle mit Style', doc.includes('<w:tblStyle w:val="WpTableGrid"/>'));
  check('Design: Hyperlink-Relationship', text(oz.get('word/_rels/document.xml.rels')).includes('rIdWpLink1'));
}

// ---------------------------------------------------------------------------
// 6. Strukturvorlage: Block-Felder (eigenes OOXML) + Inline-Felder (patchDocument)
//    inkl. Kollisionstest mit einer bestehenden Liste der Vorlage (numId 1)
// ---------------------------------------------------------------------------
{
  const zip = new Map(srcZip);
  const doc = text(zip.get('word/document.xml'));
  const b0 = doc.indexOf('<w:body>') + 8, s0 = doc.lastIndexOf('<w:sectPr');
  const h1 = st.byName('heading 1');
  const body =
    `<w:p><w:pPr><w:pStyle w:val="${h1}"/></w:pPr><w:r><w:t>Projektstatusbericht {{projekt}}</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t xml:space="preserve">Stichtag: </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>{{stichtag}}</w:t></w:r><w:r><w:t xml:space="preserve"> – Ampel: {{ampel}}</w:t></w:r></w:p>` +
    `<w:p><w:pPr><w:pStyle w:val="Listenabsatz"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Bestehender Vorlagen-Listenpunkt (numId 1)</w:t></w:r></w:p>` +
    `<w:p><w:pPr><w:pStyle w:val="${h1}"/></w:pPr><w:r><w:t>Zusammenfassung</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t>{{zusammen</w:t></w:r><w:r><w:t>fassung}}</w:t></w:r></w:p>` +
    `<w:p><w:pPr><w:pStyle w:val="${h1}"/></w:pPr><w:r><w:t>Meilensteine</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t>{{meilensteine}}</w:t></w:r></w:p>` +
    `<w:p><w:r><w:t>Bemerkung: {{bemerkung}}</w:t></w:r></w:p>`;
  zip.set('word/document.xml', bytes(doc.slice(0, b0) + body + doc.slice(s0)));
  zip.set('word/styles.xml', bytes(ensureStyles(text(zip.get('word/styles.xml'))).xml));
  addHeaderLogo(zip);
  const tpl = writeZip(zip);
  await Bun.write(`${OUT}/structure-template.docx`, tpl);

  const fields = await patchDetector({ data: tpl });
  check('Struktur: alle Felder erkannt (inkl. Split-Run-Blockfeld)', ['projekt', 'stichtag', 'ampel', 'zusammenfassung', 'meilensteine', 'bemerkung'].every(f => fields.includes(f)), JSON.stringify(fields));

  // Schritt 1: Block-Felder
  const z = readZip(tpl);
  const zus = new BlockBuilder(st, tw);
  zus.p(zus.run('Das Projekt liegt im Zeitplan, Budget ist ') + zus.run('knapp', { b: true }) + zus.run('.'));
  zus.bullet(zus.run('Design abgenommen')); zus.bullet(zus.run('Content-Migration läuft'));
  const ms = new BlockBuilder(st, tw);
  ms.table([['Meilenstein', 'Termin', 'Status'], ['Konzept', '01.08.2026', 'erledigt'], ['Go-Live', '30.10.2026', 'offen']]);
  const found = replaceBlockPlaceholders(z, { zusammenfassung: zus, meilensteine: ms });
  // Schritt 2: Inline-Felder
  const out = await patchDocument({
    outputType: 'uint8array', data: writeZip(z), keepOriginalStyles: true,
    patches: {
      projekt: { type: PatchType.PARAGRAPH, children: [new TextRun('Relaunch Website')] },
      stichtag: { type: PatchType.PARAGRAPH, children: [new TextRun('25.09.2026')] },
      ampel: { type: PatchType.PARAGRAPH, children: [new TextRun('gelb')] },
      bemerkung: { type: PatchType.PARAGRAPH, children: [new TextRun('–')] },
    },
  });
  await Bun.write(`${OUT}/structure-filled.docx`, out);
  const oz = readZip(out);
  const sdoc = text(oz.get('word/document.xml'));
  const snum = text(oz.get('word/numbering.xml'));
  check('Struktur: Block-Felder ersetzt (auch Split-Run)', found.length === 2, found.join(','));
  check('Struktur: kein {{…}}-Rest', !sdoc.includes('{{'));
  check('Struktur: Inline-Feld behält Fettung', /<w:b\/>(?:(?!<\/w:r>)[\s\S])*25\.09\.2026/.test(sdoc));
  check('Struktur: Vorlagen-Liste numId 1 unangetastet + eigene Bullets 9101', sdoc.includes('<w:numId w:val="1"/>') && sdoc.includes(`<w:numId w:val="${NUM_BULLET}"/>`) && snum.includes(`<w:num w:numId="${NUM_BULLET}">`));
  check('Struktur: Tabelle + Text drumherum', sdoc.includes('Go-Live') && sdoc.includes('Projektstatusbericht') && sdoc.includes('Relaunch Website'));
  check('Struktur: patchDocument erhält Header-Logo-Relationship', /headerReference/.test(sdoc) && text(oz.get('word/_rels/header1.xml.rels')).includes('media/image1.png') && text(oz.get('word/header1.xml')).includes('rIdWpLogo'));
}

// ---------------------------------------------------------------------------
console.log('\nErgebnis:');
for (const r of results) console.log(`${r.ok ? '✔' : '✘'} ${r.check}${r.note ? `  (${r.note})` : ''}`);
console.log(`\nDateien in ${OUT}/`);
