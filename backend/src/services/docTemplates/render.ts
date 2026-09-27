/**
 * Designvorlagen: Markdown-Inhalt im Corporate Design einer Word-Vorlage rendern.
 *
 * Ablauf:
 *  1. Vorlage entpacken, fehlende Formatvorlagen nachrüsten
 *  2. Markdown → eigenes OOXML (aufgelöste Style-IDs, eigene Nummerierung)
 *  3. an {{INHALT}} einsetzen (ohne Marker: ans Ende des Dokumentkörpers)
 *  4. Standardfelder im Fließtext/Kopf/Fuß ({{TITEL}}, {{DATUM}}) via docx.patchDocument
 */
import { patchDetector, patchDocument, PatchType, TextRun } from 'docx';
import { readZip, writeZip, text, bytes, type ZipEntries } from './zip';
import { readStyleIndex, ensureStyles } from './styles';
import {
  BlockWriter, createContext, replaceBlockPlaceholders, appendToBody, findBlockPlaceholders,
  textWidthFromDocument, finalizePackage,
} from './ooxml';
import { renderMarkdown } from './markdown';

/** Block-Platzhalter für den freien Inhalt einer Designvorlage. */
export const CONTENT_MARKER = 'INHALT';

/** Standardfelder, die jede Designvorlage im Text, in Kopf- oder Fußzeile nutzen kann. */
export const STANDARD_FIELDS = ['TITEL', 'DATUM'] as const;

export interface TemplateInspection {
  /** alle gefundenen {{…}}-Platzhalter (Dokument, Kopf-, Fußzeilen) */
  placeholders: string[];
  hasContentMarker: boolean;
  hasHeaderOrFooter: boolean;
  /** Formatvorlagen, die fehlen und beim Rendern ergänzt werden (sprachneutrale Namen) */
  missingStyles: string[];
  /** Platzhalter, die eine Designvorlage nicht befüllen kann */
  unknownPlaceholders: string[];
}

export class TemplateError extends Error {}

function loadPackage(data: Uint8Array): ZipEntries {
  let zip: ZipEntries;
  try {
    zip = readZip(data);
  } catch {
    throw new TemplateError('Die Datei ist kein gültiges Word-Dokument (.docx).');
  }
  if (!zip.has('word/document.xml') || !zip.has('[Content_Types].xml')) {
    throw new TemplateError('Die Datei ist kein gültiges Word-Dokument (.docx).');
  }
  if (text(zip.get('[Content_Types].xml')).includes('macroEnabled')) {
    throw new TemplateError('Dokumente mit Makros (.docm/.dotm) werden nicht unterstützt.');
  }
  return zip;
}

/**
 * Word-Vorlagen (.dotx) sind technisch identisch zu .docx, nur der Content-Type
 * des Hauptdokuments unterscheidet sich. Wir normalisieren auf .docx, damit das
 * Ergebnis als normales Dokument öffnet.
 */
function normalizeToDocument(zip: ZipEntries): void {
  const types = text(zip.get('[Content_Types].xml'));
  const normalized = types.replace(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  );
  if (normalized !== types) zip.set('[Content_Types].xml', bytes(normalized));
}

export async function inspectTemplate(data: Uint8Array): Promise<TemplateInspection> {
  const zip = loadPackage(data);
  normalizeToDocument(zip);
  const placeholders = [...new Set(await patchDetector({ data: writeZip(zip) }))];
  const doc = text(zip.get('word/document.xml'));
  const blocks = findBlockPlaceholders(doc);
  const { added } = ensureStyles(text(zip.get('word/styles.xml')) || EMPTY_STYLES);
  const known = new Set<string>([CONTENT_MARKER, ...STANDARD_FIELDS]);
  return {
    placeholders,
    hasContentMarker: blocks.includes(CONTENT_MARKER),
    hasHeaderOrFooter: /<w:(header|footer)Reference\b/.test(doc),
    missingStyles: added.map(k => k.slice(k.indexOf(':') + 1)),
    unknownPlaceholders: placeholders.filter(p => !known.has(p)),
  };
}

const EMPTY_STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:styles>';

export interface DesignRenderInput {
  title: string;
  markdown: string;
  /** Datum für {{DATUM}}, Default: heute (de-DE) */
  date?: string;
}

export async function renderWithDesign(template: Uint8Array, input: DesignRenderInput): Promise<Uint8Array> {
  const zip = loadPackage(template);
  normalizeToDocument(zip);

  const stylesXml = text(zip.get('word/styles.xml'));
  if (!stylesXml) throw new TemplateError('Die Vorlage enthält keine Formatvorlagen (styles.xml fehlt).');
  const { xml: completedStyles } = ensureStyles(stylesXml);
  zip.set('word/styles.xml', bytes(completedStyles));

  const placeholders = new Set(await patchDetector({ data: writeZip(zip) }));
  const doc = text(zip.get('word/document.xml'));
  const ctx = createContext(readStyleIndex(completedStyles), textWidthFromDocument(doc));
  const writer = new BlockWriter(ctx);

  // Titel: steht er schon als {{TITEL}} in der Vorlage (Deckblatt/Kopfzeile), nicht doppeln.
  // Beginnt das Markdown selbst mit "# …", ist das die Titelzeile.
  const markdown = input.markdown.trim();
  const startsWithH1 = /^#\s+/.test(markdown);
  if (!placeholders.has('TITEL') && !startsWithH1) writer.title([{ text: input.title }]);
  renderMarkdown(markdown, writer);

  const content = writer.xml();
  const replaced = replaceBlockPlaceholders(zip, { [CONTENT_MARKER]: content });
  if (!replaced.includes(CONTENT_MARKER)) appendToBody(zip, content);
  finalizePackage(zip, ctx);

  const inlinePatches: Record<string, { type: typeof PatchType.PARAGRAPH; children: TextRun[] }> = {};
  const values: Record<string, string> = {
    TITEL: input.title,
    DATUM: input.date ?? new Date().toLocaleDateString('de-DE'),
  };
  for (const [key, value] of Object.entries(values)) {
    if (placeholders.has(key)) inlinePatches[key] = { type: PatchType.PARAGRAPH, children: [new TextRun(value)] };
  }
  const packed = writeZip(zip);
  if (Object.keys(inlinePatches).length === 0) return packed;
  return patchDocument({ outputType: 'uint8array', data: packed, patches: inlinePatches, keepOriginalStyles: true });
}

let builtinShell: Promise<Uint8Array> | null = null;

/**
 * Schlichte eingebaute Hülle (Word-Standardformate, Seitenzahl in der Fußzeile)
 * für Markdown-Exporte, wenn keine Designvorlage aktiv ist.
 */
export function getBuiltinShell(): Promise<Uint8Array> {
  builtinShell ??= (async () => {
    const { Document, Packer, Paragraph, TextRun, Footer, AlignmentType, PageNumber } = await import('docx');
    const doc = new Document({
      styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
      sections: [{
        properties: { page: { margin: { top: 1417, bottom: 1134, left: 1417, right: 1417 } } },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ children: ['Seite ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 16, color: '808080' })],
            })],
          }),
        },
        children: [new Paragraph({ children: [new TextRun(`{{${CONTENT_MARKER}}}`)] })],
      }],
    });
    return new Uint8Array(await Packer.toBuffer(doc));
  })();
  return builtinShell;
}
