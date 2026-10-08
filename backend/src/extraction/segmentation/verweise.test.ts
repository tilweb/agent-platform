import { expect, test } from 'bun:test';
import { loeseSegmentVerweiseAuf, pruefeSegmentVerweise } from './verweise';
import type { ExtractionProject } from '../learning/types';

const lieferschein = { id: 'lieferschein', fields: { nummer: { type: 'text', required: true, label: 'Lieferscheinnummer' } }, instructions: 'Nur die erste Seite zählt.' } as unknown as ExtractionProject;
const segmentiert = { id: 'x', segments: { a: { label: 'A', description: 'xxxxxxxxxxxxxxxxxxxxxxxx' } } } as unknown as ExtractionProject;
const finde = (id: string) => ({ lieferschein, x: segmentiert } as Record<string, ExtractionProject>)[id];

test('pruefeSegmentVerweise', () => {
  const seg = (def: object) => ({ s: { label: 'S', description: 'Lieferschein eines Lieferanten', ...def } }) as ExtractionProject['segments'];
  expect(pruefeSegmentVerweise('wareneingang', seg({ profil: 'lieferschein' }), finde)).toBeNull();
  expect(pruefeSegmentVerweise('lieferschein', seg({ profil: 'lieferschein' }), finde)).toContain('eigene Profil');
  expect(pruefeSegmentVerweise('w', seg({ profil: 'fehlt' }), finde)).toContain('nicht gefunden');
  expect(pruefeSegmentVerweise('w', seg({ profil: 'x' }), finde)).toContain('selbst Segmente');
  expect(pruefeSegmentVerweise('w', seg({ profil: 'lieferschein', fields: { a: { type: 'text', required: false, label: 'a' } } }), finde)).toContain('nicht beides');
  expect(pruefeSegmentVerweise('w', seg({ profil: 'lieferschein', mode: 'classify-only' }), finde)).toContain('classify-only');
});

test('loeseSegmentVerweiseAuf kopiert Felder und Anweisungen, laesst andere Segmente unveraendert', () => {
  const p = { id: 'wareneingang', segments: {
    ls: { label: 'Lieferschein', description: 'Lieferschein eines Lieferanten', profil: 'lieferschein' },
    re: { label: 'Rechnung', description: 'Rechnung eines Lieferanten', fields: { betrag: { type: 'number', required: false, label: 'Betrag' } } },
  } } as unknown as ExtractionProject;
  const r = loeseSegmentVerweiseAuf(p, finde);
  expect(r.segments!.ls!.fields).toEqual(lieferschein.fields);
  expect(r.segments!.ls!.hinweise).toBe('Nur die erste Seite zählt.');
  expect(r.segments!.re).toBe(p.segments!.re!);
  expect(p.segments!.ls!.fields).toBeUndefined(); // Original unveraendert
});
