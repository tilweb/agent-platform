import { test, expect } from 'bun:test';
import { tokens, entferneAuszeichnung, vergleicheSeite, summiere, hatSchleife } from './metriken';
import { anweisungFuer } from './stufe-a';

test('tokens normalisiert Tausendertrenner und Satzzeichen', () => {
  expect(tokens('Brutto: 2.640,00 €')).toEqual(['brutto', '2640,00', '€']);
  expect(tokens('„Kılıç", Şeyma')).toEqual(['kılıç', 'şeyma']);
  expect(tokens('Datum 06.10.1991.')).toEqual(['datum', '06.10.1991']);
});

test('entferneAuszeichnung räumt HTML-Tabellen, Markdown und Grounding ab', () => {
  const s = '<|ref|>Miete<|/ref|><|det|>[[1,2,3,4]]<|/det|> <table><tr><td>**600**</td></tr></table> ## Titel';
  expect(tokens(entferneAuszeichnung(s))).toEqual(['miete', '600', 'titel']);
});

test('vergleicheSeite zählt Multimengen-Treffer und Zahlen getrennt', () => {
  const m = vergleicheSeite('Miete 600 Miete 57', 'Miete 600 600 Müll');
  expect(m).toEqual({ refWoerter: 4, ocrWoerter: 4, treffer: 2, refZahlen: 2, zahlenTreffer: 1 });
  const s = summiere([m]);
  expect(s.recall).toBe(0.5);
  expect(s.zahlenRecall).toBe(0.5);
});

test('anweisungFuer wählt den Trainings-Prompt je Modellfamilie', () => {
  expect(anweisungFuer('glm-ocr:latest')).toBe('Text Recognition:');
  expect(anweisungFuer('deepseek-ocr:3b')).toBe('Free OCR.');
  expect(anweisungFuer('PaddleOCR-VL-1.6')).toBe('OCR:');
});

test('hatSchleife erkennt Wiederholung, ignoriert kurze Symbolzeilen', () => {
  expect(hatSchleife(Array(12).fill('- [ ] DEUTSCH').join('\n'))).toBe(true);
  expect(hatSchleife(Array(18).fill('▶').join('\n') + '\nGeschlecht')).toBe(false);
  const buchungen = Array(12).fill('Kartenzahlung girocard Bremen').join('\n');
  expect(hatSchleife(buchungen, buchungen)).toBe(false);
  expect(hatSchleife(Array(40).fill('Betrag EUR\n1.180,00\n208').join('\n'), 'Gehalt Betrag EUR 1.180,00 Personal-Nr. 208')).toBe(true);
  expect(hatSchleife(Array(30).fill('- [ ] DEUTSCH').join('\n'), 'Staatsangehörigkeit DEUTSCH')).toBe(true);
});
