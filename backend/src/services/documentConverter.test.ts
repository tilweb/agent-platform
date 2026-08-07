import { describe, expect, test, afterEach } from 'bun:test';
import { mimeTypeForFilename, resolveBackend, pdfHasTextLayer, doclingConfigured } from './documentConverter';

/**
 * Minimales born-digital PDF (handgebaut): eine Seite, ein Textobjekt mit
 * genug Zeichen fuer die Textlayer-Stichprobe (> 50 nach Whitespace-Strip).
 */
function buildTextPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj;
  }
  const xrefPos = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}

const TEXT_PDF = buildTextPdf('Dies ist ein born-digital PDF mit ausreichend Text fuer die Stichprobe der Textlayer-Erkennung.');

describe('mimeTypeForFilename', () => {
  test('kennt die gaengigen Formate, auch bei Grossschreibung', () => {
    expect(mimeTypeForFilename('rechnung.PDF')).toBe('application/pdf');
    expect(mimeTypeForFilename('tabelle.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(mimeTypeForFilename('unbekannt.bin')).toBe('application/octet-stream');
  });
});

describe('pdfHasTextLayer', () => {
  test('born-digital PDF hat einen Textlayer', () => {
    expect(pdfHasTextLayer(TEXT_PDF)).toBe(true);
  });

  test('Nicht-PDF-Bytes haben keinen', () => {
    expect(pdfHasTextLayer(Buffer.from('kein pdf'))).toBe(false);
  });
});

describe('resolveBackend', () => {
  afterEach(() => { delete process.env.DOCLING_API_URL; });

  test('ohne DOCLING_API_URL immer markitdown', () => {
    expect(doclingConfigured()).toBe(false);
    expect(resolveBackend('a.docx', Buffer.alloc(0))).toBe('markitdown');
    expect(resolveBackend('a.pdf', TEXT_PDF)).toBe('markitdown');
  });

  test('mit Docling: Office → docling, PDF nach Textlayer, Rest markitdown', () => {
    process.env.DOCLING_API_URL = 'https://api.adacor.ai/v1/docling/';
    expect(resolveBackend('vertrag.docx', Buffer.alloc(0))).toBe('docling');
    expect(resolveBackend('daten.csv', Buffer.alloc(0))).toBe('docling');
    // born-digital → docling; Scan (kein Textlayer) → markitdown (Vision-Strecke)
    expect(resolveBackend('born-digital.pdf', TEXT_PDF)).toBe('docling');
    expect(resolveBackend('scan.pdf', Buffer.from('kein textlayer'))).toBe('markitdown');
    expect(resolveBackend('bild.png', Buffer.alloc(0))).toBe('markitdown');
  });

  test('explizites Backend schlaegt das Routing', () => {
    process.env.DOCLING_API_URL = 'https://api.adacor.ai/v1/docling/';
    expect(resolveBackend('vertrag.docx', Buffer.alloc(0), 'markitdown')).toBe('markitdown');
    expect(resolveBackend('scan.pdf', Buffer.alloc(0), 'docling')).toBe('docling');
  });
});
