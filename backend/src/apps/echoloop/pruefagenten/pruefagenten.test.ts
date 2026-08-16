/**
 * Tests der deterministischen PA-Fan-out-Teile: Antwort-Parser (inkl. <think>-
 * Strip, Fundstelle-Pflicht, Status-/Schwere-Normalisierung), Dedupe gegen die
 * Checker-Anker (widerlegt raus, gleiche Fundstelle zusammengeführt) und der
 * Prompt-Bau (Invarianten + Betriebsdaten-Hinweis). Der LLM-Lauf selbst ist
 * nicht-deterministisch und wird hier nicht getestet.
 */
import { test, expect, describe } from 'bun:test';
import { parseAgentResponse, dedupeGegenChecker, buildSystemPrompt, PA_AGENTS } from './index';
import type { PAFinding } from './types';
import type { PMFinding } from '../checker/types';

describe('PA · Antwort-Parser', () => {
  test('parst JSON, strippt <think>, vergibt IDs, setzt beobachtend', () => {
    const raw = `<think>überlege…</think>
{"befunde":[{"titel":"Falschwert","prozess":"210","schritt":12,"beleg":"Text:{CV:3}","status":"belegt","schwere":"hoch","dimensionen":["D6b"],"refutation":"kein nachgelagerter Check gefunden","empfehlung":"Format prüfen"}],"zusammenfassung":"3 Zeilen","nichtGeprueft":["Betriebsdaten"]}`;
    const r = parseAgentResponse('PA-F1', raw);
    expect(r.fehler).toBeUndefined();
    expect(r.befunde).toHaveLength(1);
    expect(r.befunde[0]!.id).toBe('PA-F1-1');
    expect(r.befunde[0]!.status).toBe('belegt');
    expect(r.befunde[0]!.schrittId).toBe(12);
    expect(r.befunde[0]!.beobachtend).toBe(true);
    expect(r.nichtGeprueft).toEqual(['Betriebsdaten']);
  });

  test('Befund ohne Fundstelle (prozess) wird verworfen', () => {
    const r = parseAgentResponse('PA-F2', '{"befunde":[{"titel":"x","status":"belegt"}]}');
    expect(r.befunde).toHaveLength(0);
  });

  test('unparsebare Antwort → fehler gesetzt, keine Befunde', () => {
    const r = parseAgentResponse('PA-F3', 'nur Fließtext, kein JSON');
    expect(r.befunde).toHaveLength(0);
    expect(r.fehler).toBeTruthy();
  });

  test('Status-/Schwere-Normalisierung (verify default, kritisch)', () => {
    const r = parseAgentResponse('PA-F4', '{"befunde":[{"prozess":"1","status":"❓verify","schwere":"kritisch"},{"prozess":"2","status":"unklar","schwere":"blah"}]}');
    expect(r.befunde[0]!.status).toBe('verify');
    expect(r.befunde[0]!.schwere).toBe('kritisch');
    expect(r.befunde[1]!.status).toBe('verify');   // unbekannt → verify (konservativ)
    expect(r.befunde[1]!.schwere).toBe('mittel');
  });
});

describe('PA · Dedupe gegen Checker', () => {
  const pa: PAFinding[] = [
    { agent: 'PA-F1', id: 'PA-F1-1', titel: 'a', prozessNr: '210', schrittId: 12, beleg: '', status: 'belegt', schwere: 'hoch', dimensionen: [], refutation: '', empfehlung: '', beobachtend: true },
    { agent: 'PA-F2', id: 'PA-F2-1', titel: 'b', prozessNr: '210', schrittId: 99, beleg: '', status: 'belegt', schwere: 'mittel', dimensionen: [], refutation: '', empfehlung: '', beobachtend: true },
    { agent: 'PA-F4', id: 'PA-F4-1', titel: 'c', prozessNr: '210', schrittId: 5, beleg: '', status: 'widerlegt', schwere: 'niedrig', dimensionen: [], refutation: 'Human-Gate gefunden', empfehlung: '', beobachtend: true },
  ];
  const pm: PMFinding[] = [
    { pm: 'PM-01', aspekt: 'x', prozessNr: '210', schrittId: 12, befund: '', beleg: '', provenienz: '[G Text]', schwere: 'kritisch', empfehlung: '', dimensionen: [] },
  ];

  test('widerlegt raus, Checker-Fundstelle zusammengeführt, Rest bleibt', () => {
    const r = dedupeGegenChecker(pa, pm);
    expect(r.zusammengefuehrt).toBe(1);               // PA-F1-1 doppelt Checker-Anker 210:S12
    expect(r.befunde.map((f) => f.id)).toEqual(['PA-F2-1']); // widerlegt raus, dupliziert raus
  });
});

describe('PA · Prompt-Bau', () => {
  test('Invarianten + Ausgabe-Schema im System-Prompt', () => {
    const p = buildSystemPrompt(PA_AGENTS['PA-F1'], false);
    expect(p).toContain('PA-F1');
    expect(p).toContain('Graph≠Text');
    expect(p).toContain('WIDERLEGEN');
    expect(p).toContain('"status": "belegt | verify | widerlegt"');
  });
  test('F3 ohne Betriebsdaten → Hinweis „nur Design-Risiken"', () => {
    const p = buildSystemPrompt(PA_AGENTS['PA-F3'], true);
    expect(p).toContain('KEINE Betriebsdaten');
  });
});
