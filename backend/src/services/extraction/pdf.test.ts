import { test, expect, describe } from 'bun:test';
import { isPdfRendererAvailable, renderPdfToImages, countPdfPages, PdfRenderError } from './pdf';

describe('isPdfRendererAvailable', () => {
  test('returns boolean (no exception)', async () => {
    const available = await isPdfRendererAvailable();
    expect(typeof available).toBe('boolean');
  });

  test('result ist cached (zweimaliger Aufruf identisch)', async () => {
    const a = await isPdfRendererAvailable();
    const b = await isPdfRendererAvailable();
    expect(a).toBe(b);
  });
});

describe('renderPdfToImages — Fehler-Pfade', () => {
  test('Ungueltiger PDF-Buffer → PdfRenderError', async () => {
    const available = await isPdfRendererAvailable();
    if (!available) {
      // Ueberspringen wenn lokal nicht installiert (CI-tolerant)
      return;
    }
    const badBuffer = Buffer.from('Das ist kein PDF');
    try {
      await renderPdfToImages(badBuffer);
      throw new Error('Sollte nicht erreicht werden');
    } catch (err) {
      expect(err).toBeInstanceOf(PdfRenderError);
    }
  });
});

test('real PDF rendering honors the page cap while page count retains completeness', async () => {
  if (!(await isPdfRendererAvailable())) return;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources << >> >>',
  ];
  let text = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((obj, index) => { offsets.push(text.length); text += `${index + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = text.length;
  text += `xref\n0 5\n0000000000 65535 f \n${offsets.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = Buffer.from(text);
  expect(await countPdfPages(bytes)).toBe(2);
  const pages = await renderPdfToImages(bytes, { dpi: 72, maxPages: 1 });
  expect(pages).toHaveLength(1);
  expect(pages[0]!.pageNumber).toBe(1);
});
