/**
 * Tests des K1-Report-Renderers: vollständiges HTML, Kennzahlen, Reifegradprofil,
 * Kundenfassung + Bauanleitung, HTML-Escaping, und dass maskierte Dimensionen als
 * „maskiert" statt „0" erscheinen (Evidenz-Disziplin).
 */
import { test, expect, describe } from 'bun:test';
import { renderReportHtml } from './report';
import type { Baustand } from './types';
import type { Dim } from './scoring';

function baustand(over: Partial<Baustand> = {}): Baustand {
  const dims = {} as Baustand['dimensionen'];
  for (const d of ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd6b', 'd7', 'd8', 'd9', 'd10'] as Dim[]) {
    dims[d] = { ist: 2, soll: 3, relevanz: 1 };
  }
  return {
    id: 'baustand-1', prozessId: 'prozess-1', datum: '2026-08-16', status: 'freigegeben',
    dimensionen: dims, befunde: [], kennzahlen: { gesamtRg: 0, rgStar: 2, rgq: 0, seQuotient: 0, limiter: [], notenZeile: '' },
    ...over,
  };
}

describe('K1-Report · Rendering', () => {
  test('liefert vollständiges HTML mit Kennzahlen + Profil', () => {
    const html = renderReportHtml({ kunde: { id: 'k', name: 'Muster GmbH' }, prozess: { id: 'p', kundeId: 'k', name: 'Rechnung prüfen' }, baustand: baustand() });
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Rechnung prüfen');
    expect(html).toContain('Muster GmbH');
    expect(html).toContain('SE (Soll-Erfüllung)');
    expect(html).toContain('Reifegradprofil');
  });

  test('maskierte Dimension erscheint als „maskiert", nicht als 0', () => {
    const b = baustand();
    b.dimensionen.d10 = { ist: 4, soll: 4, relevanz: 0 };
    const html = renderReportHtml({ baustand: b });
    expect(html).toContain('maskiert');
  });

  test('HTML-Escaping gegen Injektion im Prozessnamen', () => {
    const html = renderReportHtml({ prozess: { id: 'p', kundeId: 'k', name: '<script>alert(1)</script>' }, baustand: baustand() });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('Bauanleitung + Kundenfassung werden gerendert wenn vorhanden', () => {
    const b = baustand({
      narrativ: { exec: { was: 'Kernaussage', findings: ['F1'], staerken: [] }, prosa: ['Absatz'], dims: {}, erzeugtAm: '', modell: '' },
      bauanleitung: { zielLevel: 1, einleitung: 'Einstieg', karten: [{ id: 'BK-F', titel: 'Fundament', prio: 'hoch', warum: 'w', schritte: [{ text: 'Schritt A' }] }], erzeugtAm: '', modell: '' },
    });
    const html = renderReportHtml({ baustand: b });
    expect(html).toContain('Kundenfassung');
    expect(html).toContain('Kernaussage');
    expect(html).toContain('BK-F');
    expect(html).toContain('Schritt A');
  });
});
