import { test, expect } from 'bun:test';
import {
  resolveReviewThreshold,
  computeReviewStatus,
  emptyCalibration,
  updateCalibration,
} from './review';
import type { ExtractionProject, ProjectField } from './types';

function makeProject(
  fields: Record<string, ProjectField>,
  extraction?: ExtractionProject['extraction'],
): ExtractionProject {
  return {
    id: 'p', name: 'P', description: '', created: '', updated: '',
    fields, guidelines: '',
    learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: 0 },
    ...(extraction ? { extraction } : {}),
  };
}

const nameField: ProjectField = { type: 'text', required: false, label: 'Name' };
const nrField: ProjectField = { type: 'text', required: true, label: 'Nr' };

// ============== resolveReviewThreshold ==============

test('Schwelle: review_threshold > confidence_threshold > Default 0.6', () => {
  expect(resolveReviewThreshold(makeProject({}))).toBe(0.6);
  expect(resolveReviewThreshold(makeProject({}, { confidence_threshold: 0.7 }))).toBe(0.7);
  expect(resolveReviewThreshold(makeProject({}, { confidence_threshold: 0.7, review_threshold: 0.9 }))).toBe(0.9);
});

// ============== computeReviewStatus ==============

test('alle Felder ueber Schwelle → auto_ok', () => {
  const p = makeProject({ name: nameField, nr: nrField });
  expect(computeReviewStatus(p, { name: 'X', nr: '1' }, { name: 0.9, nr: 1 })).toBe('auto_ok');
});

test('Feld mit Wert unter Schwelle → needs_review', () => {
  const p = makeProject({ name: nameField });
  expect(computeReviewStatus(p, { name: 'X' }, { name: 0.4 })).toBe('needs_review');
});

test('leeres OPTIONALES Feld mit niedriger Konfidenz → KEIN Review (kein Dauer-Alarm)', () => {
  const p = makeProject({ name: nameField });
  expect(computeReviewStatus(p, { name: null }, { name: 0 })).toBe('auto_ok');
  expect(computeReviewStatus(p, { name: '' }, {})).toBe('auto_ok');
  expect(computeReviewStatus(p, { name: [] }, { name: 0 })).toBe('auto_ok');
});

test('leeres PFLICHT-Feld mit niedriger Konfidenz → needs_review', () => {
  const p = makeProject({ nr: nrField });
  expect(computeReviewStatus(p, { nr: null }, { nr: 0 })).toBe('needs_review');
});

test('fehlende Konfidenz zaehlt wie 0 (Wert vorhanden → Review)', () => {
  const p = makeProject({ name: nameField });
  expect(computeReviewStatus(p, { name: 'X' }, undefined)).toBe('needs_review');
});

test('eigene Schwelle greift', () => {
  const p = makeProject({ name: nameField }, { review_threshold: 0.95 });
  expect(computeReviewStatus(p, { name: 'X' }, { name: 0.9 })).toBe('needs_review');
  const p2 = makeProject({ name: nameField }, { review_threshold: 0.5 });
  expect(computeReviewStatus(p2, { name: 'X' }, { name: 0.55 })).toBe('auto_ok');
});

// ============== Kalibrierung ==============

const numField: ProjectField = { type: 'number', required: false, label: 'Betrag' };

test('Bucket-Zuordnung + correct-Zaehlung', () => {
  const p = makeProject({ name: nameField, betrag: numField });
  const s = updateCalibration(
    undefined,
    p,
    { name: 'Falsch GmbH', betrag: 10 },   // initial
    { name: 'Richtig GmbH', betrag: 10 },  // corrected: name war falsch, betrag korrekt
    { name: 0.95, betrag: 0.3 },
  );
  expect(s.samples).toBe(2);
  // name: conf 0.95 → Bucket 4, falsch
  expect(s.buckets[4]).toEqual({ total: 1, correct: 0 });
  // betrag: conf 0.3 → Bucket 1, korrekt
  expect(s.buckets[1]).toEqual({ total: 1, correct: 1 });
});

test('Formatabweichung zaehlt NICHT als Fehler (compareField-Normalisierung)', () => {
  const p = makeProject({ betrag: numField });
  const s = updateCalibration(undefined, p, { betrag: '30,90' }, { betrag: 30.9 }, { betrag: 0.9 });
  expect(s.buckets[4]).toEqual({ total: 1, correct: 1 });
});

test('Aggregat wird fortgeschrieben, Input bleibt unveraendert', () => {
  const p = makeProject({ name: nameField });
  const s1 = updateCalibration(undefined, p, { name: 'A' }, { name: 'A' }, { name: 0.9 });
  const s2 = updateCalibration(s1, p, { name: 'B' }, { name: 'C' }, { name: 0.9 });
  expect(s1.buckets[4]).toEqual({ total: 1, correct: 1 }); // unveraendert
  expect(s2.buckets[4]).toEqual({ total: 2, correct: 1 });
  expect(s2.samples).toBe(2);
});

test('Konfidenz 1.0 landet im obersten Bucket (kein Overflow)', () => {
  const p = makeProject({ name: nameField });
  const s = updateCalibration(undefined, p, { name: 'A' }, { name: 'A' }, { name: 1.0 });
  expect(s.buckets[4]!.total).toBe(1);
});

test('Felder ohne Konfidenz werden uebersprungen', () => {
  const p = makeProject({ name: nameField, betrag: numField });
  const s = updateCalibration(undefined, p, { name: 'A', betrag: 1 }, { name: 'A', betrag: 1 }, { name: 0.8 });
  expect(s.samples).toBe(1);
});

test('emptyCalibration hat 5 leere Buckets', () => {
  const s = emptyCalibration();
  expect(s.buckets).toHaveLength(5);
  expect(s.samples).toBe(0);
});
