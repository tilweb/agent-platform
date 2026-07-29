import { test, expect } from 'bun:test';
import { parseClassification, partFilename } from './classify';

const VALID = ['rechnungen', 'lieferscheine'];

// ============== parseClassification ==============

test('valide Antwort wird uebernommen', () => {
  const r = parseClassification(
    '{"project_id": "rechnungen", "confidence": 0.92, "alternatives": [{"project_id": "lieferscheine", "confidence": 0.3}]}',
    VALID,
  );
  expect(r.project_id).toBe('rechnungen');
  expect(r.confidence).toBe(0.92);
  expect(r.alternatives).toEqual([{ project_id: 'lieferscheine', confidence: 0.3 }]);
});

test('unbekannte project_id → null, Confidence gedeckelt', () => {
  const r = parseClassification('{"project_id": "gibtsnicht", "confidence": 0.95}', VALID);
  expect(r.project_id).toBeNull();
  expect(r.confidence).toBeLessThan(0.5);
});

test('Confidence wird auf [0,1] geklemmt', () => {
  expect(parseClassification('{"project_id": "rechnungen", "confidence": 1.7}', VALID).confidence).toBe(1);
  expect(parseClassification('{"project_id": "rechnungen", "confidence": -0.3}', VALID).confidence).toBe(0);
});

test('Alternativen: nur valide IDs, ohne Haupt-Treffer, max 3', () => {
  const r = parseClassification(
    JSON.stringify({
      project_id: 'rechnungen',
      confidence: 0.9,
      alternatives: [
        { project_id: 'rechnungen', confidence: 0.9 },     // = Haupt-Treffer → raus
        { project_id: 'lieferscheine', confidence: 0.4 },
        { project_id: 'unbekannt', confidence: 0.6 },      // invalid → raus
      ],
    }),
    VALID,
  );
  expect(r.alternatives).toEqual([{ project_id: 'lieferscheine', confidence: 0.4 }]);
});

test('kaputtes JSON → leeres Ergebnis', () => {
  const r = parseClassification('sorry, kein JSON', VALID);
  expect(r).toEqual({ project_id: null, confidence: 0, alternatives: [] });
  expect(parseClassification(null, VALID).project_id).toBeNull();
});

test('Markdown-Fences werden toleriert (parseJsonObject)', () => {
  const r = parseClassification('```json\n{"project_id": "rechnungen", "confidence": 0.8}\n```', VALID);
  expect(r.project_id).toBe('rechnungen');
});

// ============== partFilename ==============

test('Teil-Dateinamen: .pdf gestript, Nummer angehaengt', () => {
  expect(partFilename('scan.pdf', 1)).toBe('scan-teil-1.pdf');
  expect(partFilename('Scan 2026.PDF', 2)).toBe('Scan 2026-teil-2.pdf');
});

test('Sonderzeichen sanitisiert, leerer Basisname → dokument', () => {
  expect(partFilename('Rechnung#§$.pdf', 1)).toBe('Rechnung_-teil-1.pdf');
  expect(partFilename('.pdf', 3)).toBe('dokument-teil-3.pdf');
});
