import { test, expect } from 'bun:test';
import { parseBauanleitungResponse, fundamentWelle } from './bauanleitung';

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

test('Fundament-Welle (R4): feste erste Karte BK-F mit drei Ankern', () => {
  const f = fundamentWelle();
  expect(f.id).toBe('BK-F');
  expect(f.prio).toBe('hoch');
  expect(f.schritte).toHaveLength(3);
  const text = f.schritte.map((s) => s.text).join(' ');
  expect(text).toContain('Config-Bootstrap');
  expect(text).toContain('A_Ergebnis');
  expect(text).toContain('Kopfblock');
  expect(text).toContain('D6-L3'); // verweist auf das Vereinbarungs-Gate
});
