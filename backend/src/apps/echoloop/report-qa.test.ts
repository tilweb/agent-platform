/**
 * Artefakt-QA-Gate: VOLL bei komplettem Baustand, FAIL bei fehlender Pflicht
 * (Kennzahlen/Profil/Evidenz-Disziplin), TEIL bei weicher Lücke (Tiefe/Narrativ).
 */
import { test, expect, describe } from 'bun:test';
import { reportQa } from './report-qa';
import type { Baustand } from './types';
import type { Dim } from './scoring';

function baustand(over: Partial<Baustand> = {}): Baustand {
  const dims = {} as Baustand['dimensionen'];
  for (const d of ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd6b', 'd7', 'd8', 'd9', 'd10'] as Dim[]) {
    dims[d] = { ist: 2, soll: 3, relevanz: 1 };
  }
  return {
    id: 'b1', prozessId: 'p1', datum: '2026-08-16', status: 'in_review',
    dimensionen: dims, befunde: [],
    kennzahlen: { gesamtRg: 1, rgStar: 2, rgq: 40, seQuotient: 80, limiter: [], notenZeile: '' },
    analyseTiefe: 'T-A',
    ...over,
  };
}

describe('Artefakt-QA · Verdikt', () => {
  test('kompletter Baustand → VOLL', () => {
    expect(reportQa(baustand()).verdikt).toBe('VOLL');
  });

  test('fehlende Dimension → FAIL (Pflicht)', () => {
    const b = baustand();
    delete (b.dimensionen as Record<string, unknown>).d5;
    const r = reportQa(b);
    expect(r.verdikt).toBe('FAIL');
    expect(r.verstoesse.join(' ')).toContain('D5');
  });

  test('maskierte Dimension ohne Begründung → FAIL (Evidenz-Disziplin)', () => {
    const b = baustand();
    b.dimensionen.d10 = { ist: 0, soll: 0, relevanz: 0 };  // r=0 ohne maskeGrund
    expect(reportQa(b).verdikt).toBe('FAIL');
  });

  test('maskiert MIT Begründung → kein Verstoß', () => {
    const b = baustand();
    b.dimensionen.d10 = { ist: 0, soll: 0, relevanz: 0, maskeGrund: 'nicht portiert, Owner-Entscheid' };
    expect(reportQa(b).verdikt).toBe('VOLL');
  });

  test('fehlende Analyse-Tiefe → TEIL (Teil-Vertrag, kein PASS)', () => {
    const r = reportQa(baustand({ analyseTiefe: undefined }));
    expect(r.verdikt).toBe('TEIL');
    expect(r.verstoesse.join(' ')).toContain('Tiefe');
  });

  test('freigegeben ohne Kundenfassung → TEIL', () => {
    expect(reportQa(baustand({ status: 'freigegeben' })).verdikt).toBe('TEIL');
  });

  test('fehlende Kennzahlen → FAIL', () => {
    const r = reportQa(baustand({ kennzahlen: undefined }));
    expect(r.verdikt).toBe('FAIL');
  });
});
