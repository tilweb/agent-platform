import { test, expect } from 'bun:test';
import { darfEntscheiden } from './_shared';

test('darfEntscheiden: Vier-Augen aus → editor und owner dürfen entscheiden', () => {
  expect(darfEntscheiden('owner', false)).toBe(true);
  expect(darfEntscheiden('editor', false)).toBe(true);
});

test('darfEntscheiden: Vier-Augen aus → viewer darf nicht', () => {
  expect(darfEntscheiden('viewer', false)).toBe(false);
  expect(darfEntscheiden(undefined, false)).toBe(false);
});

test('darfEntscheiden: Vier-Augen an → nur owner darf entscheiden', () => {
  expect(darfEntscheiden('owner', true)).toBe(true);
  expect(darfEntscheiden('editor', true)).toBe(false);
  expect(darfEntscheiden('viewer', true)).toBe(false);
  expect(darfEntscheiden(undefined, true)).toBe(false);
});
