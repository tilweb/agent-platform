import { test, expect, describe } from 'bun:test';
import { isPdfRendererAvailable, renderPdfToImages, PdfRenderError } from './pdf';

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
