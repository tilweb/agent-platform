import { describe, expect, test } from 'bun:test';
import { dataUriToBuffer } from './page-store';
import { s3Paths } from '../../storage/paths';

describe('dataUriToBuffer', () => {
  test('dekodiert ein PNG-DataUri', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const uri = `data:image/png;base64,${png.toString('base64')}`;
    expect(dataUriToBuffer(uri)?.equals(png)).toBe(true);
  });

  test('lehnt Nicht-DataUris ab', () => {
    expect(dataUriToBuffer('https://example.com/a.png')).toBeNull();
    expect(dataUriToBuffer('')).toBeNull();
    expect(dataUriToBuffer('data:image/png;base64')).toBeNull();
  });
});

describe('s3Paths.batchPageImage', () => {
  test('baut den Schluessel nach Konvention', () => {
    expect(s3Paths.batchPageImage('batch_abc', 'bf_123', 3)).toBe('extraction-pages/batch_abc/bf_123/p3.png');
  });

  test('weist Path-Traversal und unsinnige Seiten ab', () => {
    expect(() => s3Paths.batchPageImage('../other', 'bf_1', 1)).toThrow();
    expect(() => s3Paths.batchPageImage('batch_1', '../../x', 1)).toThrow();
    expect(() => s3Paths.batchPageImage('batch_1', 'bf_1', 0)).toThrow();
    expect(() => s3Paths.batchPageImage('batch_1', 'bf_1', -2)).toThrow();
    expect(() => s3Paths.batchPageImage('batch_1', 'bf_1', 1.5)).toThrow();
    expect(() => s3Paths.batchPageImage('batch_1', 'bf_1', 99999)).toThrow();
  });
});
