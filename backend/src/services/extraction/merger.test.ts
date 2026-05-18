import { test, expect, describe } from 'bun:test';
import { mergeChunks, type ChunkExtraction } from './merger';
import type { ExtractionProfile } from '../../extraction/types';

const profile: ExtractionProfile = {
  id: 'test',
  name: 'Test',
  description: 'Test profile',
  version: '1.0',
  detection: { keywords: [] },
  fields: {
    vertragspartner: {
      vermieter: { type: 'text', required: true },
      mieter: { type: 'text', required: true },
    },
    finanzen: {
      kaltmiete_monatlich: { type: 'number' },
      kaution: { type: 'number' },
    },
    stakeholder_liste: { _array: true, _item_fields: { name: { type: 'text' } } },
  },
};

describe('mergeChunks — first-non-null', () => {
  test('erster Chunk mit Wert wins', () => {
    const chunks: ChunkExtraction[] = [
      { chunkIndex: 0, data: { vertragspartner: {} } },
      { chunkIndex: 1, data: { vertragspartner: { vermieter: 'Acme GmbH' } } },
      { chunkIndex: 2, data: { vertragspartner: { vermieter: 'Anderswer Vermieter' } } },
    ];
    const result = mergeChunks(chunks, profile, 'first-non-null');
    expect((result.merged as any).vertragspartner.vermieter).toBe('Acme GmbH');
    const prov = result.provenance.find((p) => p.field === 'vertragspartner.vermieter');
    expect(prov?.source).toBe('c:1');
  });

  test('alle Chunks leer → kein Eintrag', () => {
    const chunks: ChunkExtraction[] = [
      { chunkIndex: 0, data: {} },
      { chunkIndex: 1, data: { vertragspartner: { vermieter: '' } } },
    ];
    const result = mergeChunks(chunks, profile, 'first-non-null');
    expect((result.merged as any).vertragspartner?.vermieter).toBeUndefined();
  });
});

describe('mergeChunks — majority-vote', () => {
  test('haeufigster Wert wins', () => {
    const chunks: ChunkExtraction[] = [
      { chunkIndex: 0, data: { finanzen: { kaltmiete_monatlich: 1200 } } },
      { chunkIndex: 1, data: { finanzen: { kaltmiete_monatlich: 1200 } } },
      { chunkIndex: 2, data: { finanzen: { kaltmiete_monatlich: 1500 } } },
    ];
    const result = mergeChunks(chunks, profile, 'majority-vote');
    expect((result.merged as any).finanzen.kaltmiete_monatlich).toBe(1200);
  });

  test('strings werden case-insensitive normalisiert', () => {
    const chunks: ChunkExtraction[] = [
      { chunkIndex: 0, data: { vertragspartner: { vermieter: 'Acme GmbH' } } },
      { chunkIndex: 1, data: { vertragspartner: { vermieter: 'acme gmbh ' } } },
      { chunkIndex: 2, data: { vertragspartner: { vermieter: 'Anderer' } } },
    ];
    const result = mergeChunks(chunks, profile, 'majority-vote');
    expect(String((result.merged as any).vertragspartner.vermieter).toLowerCase().trim()).toBe('acme gmbh');
  });
});

describe('mergeChunks — priority-by-section', () => {
  test('Chunk mit Heading "finanzen" gewinnt fuer finanzen-Felder', () => {
    const chunks: ChunkExtraction[] = [
      { chunkIndex: 0, heading: 'Vertragspartner', data: { finanzen: { kaltmiete_monatlich: 500 } } },
      { chunkIndex: 1, heading: 'Finanzen / Kosten', data: { finanzen: { kaltmiete_monatlich: 1200 } } },
      { chunkIndex: 2, heading: 'Sonstiges', data: { finanzen: { kaltmiete_monatlich: 800 } } },
    ];
    const result = mergeChunks(chunks, profile, 'priority-by-section');
    expect((result.merged as any).finanzen.kaltmiete_monatlich).toBe(1200);
    const prov = result.provenance.find((p) => p.field === 'finanzen.kaltmiete_monatlich');
    expect(prov?.source).toBe('c:1');
  });

  test('kein Heading-Match → faellt auf first-non-null zurueck', () => {
    const chunks: ChunkExtraction[] = [
      { chunkIndex: 0, heading: 'Allgemein', data: { finanzen: { kaltmiete_monatlich: 500 } } },
      { chunkIndex: 1, heading: 'Sonstiges', data: { finanzen: { kaltmiete_monatlich: 800 } } },
    ];
    const result = mergeChunks(chunks, profile, 'priority-by-section');
    expect((result.merged as any).finanzen.kaltmiete_monatlich).toBe(500);
  });
});

describe('mergeChunks — Array-Felder werden immer unioned', () => {
  test('alle Stakeholder aus allen Chunks zusammen', () => {
    const chunks: ChunkExtraction[] = [
      { chunkIndex: 0, data: { stakeholder_liste: [{ name: 'A' }, { name: 'B' }] } },
      { chunkIndex: 1, data: { stakeholder_liste: [{ name: 'C' }] } },
      { chunkIndex: 2, data: { stakeholder_liste: [{ name: 'D' }, { name: 'E' }] } },
    ];
    const result = mergeChunks(chunks, profile, 'first-non-null');
    expect((result.merged as any).stakeholder_liste).toHaveLength(5);
    const prov = result.provenance.find((p) => p.field === 'stakeholder_liste');
    expect(prov?.source).toBe('c:0+1+2');
  });
});

describe('Provenance', () => {
  test('listet pro gesetztem Feld einen Eintrag mit Quelle', () => {
    const chunks: ChunkExtraction[] = [
      { chunkIndex: 0, data: { vertragspartner: { vermieter: 'X' } } },
      { chunkIndex: 1, data: { vertragspartner: { mieter: 'Y' } } },
    ];
    const result = mergeChunks(chunks, profile, 'first-non-null');
    expect(result.provenance).toHaveLength(2);
    expect(result.provenance.map((p) => p.field).sort()).toEqual([
      'vertragspartner.mieter',
      'vertragspartner.vermieter',
    ]);
  });
});
