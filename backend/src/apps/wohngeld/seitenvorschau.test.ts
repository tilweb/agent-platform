import { expect, test } from 'bun:test';
import { vorschauArt } from './seitenvorschau';

test('PDF am Inhalt erkannt, Bilder am Content-Type, sonst keine Vorschau', () => {
  expect(vorschauArt(new TextEncoder().encode('%PDF-1.7 …'), 'application/octet-stream')).toBe('pdf');
  expect(vorschauArt(new Uint8Array([1, 2, 3]), 'application/pdf')).toBe('pdf');
  expect(vorschauArt(new Uint8Array([1, 2, 3]), 'image/jpeg')).toBe('bild');
  expect(vorschauArt(new Uint8Array([1, 2, 3]), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('keine');
});
