import { afterEach, expect, test } from 'bun:test';
import { ersterSlot } from './model-slots';

afterEach(() => { delete process.env.EXTRACTION_WORKER_SLOT_RESERVE; });

test('ersterSlot: Web nutzt alle Slots, der Worker laesst die Reserve fuer interaktive Aufrufe frei', () => {
  expect(ersterSlot(4, false)).toBe(0);
  expect(ersterSlot(4, true)).toBe(1);
  process.env.EXTRACTION_WORKER_SLOT_RESERVE = '2';
  expect(ersterSlot(4, true)).toBe(2);
  process.env.EXTRACTION_WORKER_SLOT_RESERVE = '0';
  expect(ersterSlot(4, true)).toBe(0);
});

test('ersterSlot: dem Worker bleibt immer mindestens ein Slot', () => {
  process.env.EXTRACTION_WORKER_SLOT_RESERVE = '9';
  expect(ersterSlot(4, true)).toBe(3);
  expect(ersterSlot(1, true)).toBe(0);
});
