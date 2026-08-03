import { describe, expect, test } from 'bun:test';
import { dataUriToBuffer, deletePageImages, readPageImage, savePageImages } from './page-store';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const uri = (b: Buffer) => `data:image/png;base64,${b.toString('base64')}`;

describe('dataUriToBuffer', () => {
  test('dekodiert ein PNG-DataUri', () => {
    expect(dataUriToBuffer(uri(PNG))?.equals(PNG)).toBe(true);
  });

  test('lehnt Nicht-DataUris ab', () => {
    expect(dataUriToBuffer('https://example.com/a.png')).toBeNull();
    expect(dataUriToBuffer('')).toBeNull();
    expect(dataUriToBuffer('data:image/png;base64')).toBeNull();
  });
});

describe('Datei-Ablage (Roundtrip)', () => {
  test('speichern, lesen, loeschen', async () => {
    const runId = `batch_test_${Date.now().toString(36)}`;
    const fileId = 'bf_test_1';
    try {
      const stored = await savePageImages(runId, fileId, [
        { page: 1, dataUri: uri(PNG), width: 100, height: 200 },
        { page: 2, dataUri: uri(PNG), width: 100, height: 200 },
      ]);
      // Referenz statt Bytes im Record
      expect(stored).toEqual([
        { page: 1, width: 100, height: 200 },
        { page: 2, width: 100, height: 200 },
      ]);

      expect((await readPageImage(runId, fileId, 1))?.equals(PNG)).toBe(true);
      expect(await readPageImage(runId, fileId, 3)).toBeNull();
    } finally {
      await deletePageImages(runId);
    }
    expect(await readPageImage(runId, fileId, 1)).toBeNull();
  });

  test('kaputtes DataUri bleibt inline (Fail-Soft)', async () => {
    const runId = `batch_test_${Date.now().toString(36)}_x`;
    try {
      const stored = await savePageImages(runId, 'bf_x', [
        { page: 1, dataUri: 'kein-datauri', width: 10, height: 10 },
      ]);
      expect(stored?.[0]?.dataUri).toBe('kein-datauri');
    } finally {
      await deletePageImages(runId);
    }
  });

  test('leere oder fehlende Bildliste', async () => {
    expect(await savePageImages('r', 'f', [])).toEqual([]);
    expect(await savePageImages('r', 'f', undefined)).toBeUndefined();
  });

  test('Path-Traversal in Ids wird abgewiesen', async () => {
    const stored = await savePageImages('../../etc', 'bf_1', [
      { page: 1, dataUri: uri(PNG), width: 1, height: 1 },
    ]);
    // Fail-Soft: kein Schreiben ausserhalb, Bild bleibt inline
    expect(stored?.[0]?.dataUri).toBeDefined();
    expect(await readPageImage('../../etc', 'bf_1', 1)).toBeNull();
  });
});
