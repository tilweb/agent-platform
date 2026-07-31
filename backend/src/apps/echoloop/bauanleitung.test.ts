import { test, expect } from 'bun:test';
import { parseBauanleitungResponse } from './bauanleitung';

test('parseBauanleitungResponse: strippt <think>, validiert karten', () => {
  const raw = `<think>Ich plane die Reihenfolge...</think>
{"zielLevel":1,"einleitung":"e","karten":[{"id":"BK-0","titel":"t","dimension":"D5","prio":"hoch","warum":"w","schritte":["s1","s2"]}]}`;
  const p = parseBauanleitungResponse(raw);
  expect(p).not.toBeNull();
  expect(p!.karten!.length).toBe(1);
  expect(p!.karten![0]!.titel).toBe('t');
  expect(p!.karten![0]!.schritte).toEqual(['s1', 's2']);
});

test('parseBauanleitungResponse: fehlendes karten-Array → null', () => {
  expect(parseBauanleitungResponse('{"einleitung":"x"}')).toBeNull();
});

test('parseBauanleitungResponse: kein JSON → null', () => {
  expect(parseBauanleitungResponse('nur Text, kein JSON')).toBeNull();
});
