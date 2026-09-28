/**
 * Antrag-Kern — Konformität der Kern-Routenfabriken und Selbsttest der statischen Prüf-Helfer.
 *
 * Die Apps verlassen sich darauf, dass Routen aus Kern-Fabriken (Audit-Protokoll, Posteingang,
 * Feldstatus, Notizen) selbst auditieren, die Einschränkung prüfen und App-Hooks mit LLM-Arbeit
 * gemessen aufrufen. Das wird hier einmal für den Kern festgehalten.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  aufrufeInnerhalb, erreichend, findeFunktionen, findeRouten, ohneLiterale, pruefeAudit,
  pruefeEinschraenkung, ruftAuf, type KonformitaetsKonfig,
} from './konformitaet';

const KERN: KonformitaetsKonfig = {
  appDir: import.meta.dir,
  routenDateien: ['audit.ts', 'feldstatus.ts', 'notizen.ts', 'posteingang/routen.ts'],
  llmModule: {},
};

describe('Kern-Routenfabriken', () => {
  test('jede Schreibroute der Fabriken auditiert', () => {
    const e = pruefeAudit(KERN);
    expect(e.geprueft).toEqual(expect.arrayContaining([
      'POST /posteingang/ingest', 'POST /posteingang/analysieren', 'POST /posteingang/:id/zuordnen',
      'POST /vorgaenge/:vorgangId/feldstatus/:fsId/bestaetigen', 'POST /vorgaenge/:vorgangId/notizen', 'DELETE /notizen/:id',
    ]));
    expect(e.verstoesse).toEqual([]);
  });

  test('vorgangsbezogene Schreibrouten der Fabriken prüfen die Einschränkung', () => {
    const e = pruefeEinschraenkung(KERN);
    expect(e.geprueft.length).toBeGreaterThanOrEqual(5);
    expect(e.verstoesse).toEqual([]);
  });

  test('Posteingang ruft die LLM-Hooks der App nur gemessen auf', () => {
    const src = readFileSync(join(import.meta.dir, 'posteingang/routen.ts'), 'utf8');
    for (const hook of ['opts.analysiere', 'opts.werteNeueDateienAus']) {
      const r = aufrufeInnerhalb(src, hook);
      expect(r.gesamt).toBeGreaterThan(0);
      expect(r.ausserhalb).toEqual([]);
    }
  });
});

describe('Prüf-Helfer', () => {
  test('ohneLiterale blendet Strings, Templates, Regex und Kommentare aus', () => {
    const src = "a('x(');/* audit( */ b(`y ${c('{')} )`); const r = /\\(/g; // audit(\nd();";
    const code = ohneLiterale(src);
    expect(code.length).toBe(src.length);
    expect(code).not.toContain('audit');
    expect(code).toContain("c('");
    expect(ruftAuf(code, 'c')).toBe(true);
    expect(ruftAuf(code, 'd')).toBe(true);
  });

  test('findeRouten grenzt Handler per Klammer ab', () => {
    const src = [
      "r.get('/a', (c) => c.json({}));",
      "r.post('/b/:id', async (c) => {",
      "  const f = () => { return ')'; };",
      "  await audit(c, { x: 1 });",
      '});',
      "r.delete('/c', async (c) => { return c.json({ ok: true }); });",
      "form.get('file');",
    ].join('\n');
    const routen = findeRouten(src);
    expect(routen.map((r) => r.schluessel)).toEqual(['GET /a', 'POST /b/:id', 'DELETE /c']);
    expect(ruftAuf(routen[1]!.code, 'audit')).toBe(true);
    expect(ruftAuf(routen[2]!.code, 'audit')).toBe(false);
  });

  test('findeFunktionen und erreichend folgen Aufrufketten', () => {
    const src = [
      'async function innen(x: number): Promise<{ a: number }> { return llm(x); }',
      'const mitte = async (y: number) => { return innen(y); };',
      'function gemessen() { return messe(() => mitte(1)); }',
      'function frei() { return 1; }',
    ].join('\n');
    const fns = findeFunktionen(src);
    expect(fns.map((f) => f.name).sort()).toEqual(['frei', 'gemessen', 'innen', 'mitte']);
    const r = erreichend(fns, (c) => ruftAuf(c, 'llm'), (c) => ruftAuf(c, 'messe'));
    expect([...r].sort()).toEqual(['innen', 'mitte']);
  });

  test('ruftAuf: Empfänger nur auf Wunsch, Deklarationen zählen nicht', () => {
    expect(ruftAuf('d.audit(c)', 'audit')).toBe(false);
    expect(ruftAuf('d.audit(c)', 'audit', true)).toBe(true);
    expect(ruftAuf('guards.denyX?.(id)', 'denyX', true)).toBe(true);
    expect(ruftAuf('async function audit(c) {}', 'audit')).toBe(false);
    expect(ruftAuf('auditUpdate(c)', 'audit')).toBe(false);
  });
});
