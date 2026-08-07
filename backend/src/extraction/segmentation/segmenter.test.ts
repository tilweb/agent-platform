import { describe, expect, test } from 'bun:test';
import { buildSegments, type PageClassification } from './segmenter';
import type { SegmentTypeDef } from '../learning/types';

const defs: Record<string, SegmentTypeDef> = {
  anschreiben: { label: 'Anschreiben', description: 'Begleitbrief mit Anrede und Grussformel.' },
  lebenslauf: { label: 'Lebenslauf', description: 'Tabellarischer Werdegang.' },
  zertifikat: { label: 'Zertifikat', description: 'Urkunden und Teilnahmebescheinigungen.', repeatable: true },
  formular: { label: 'Formular', description: 'Ausfuellbares Antragsformular.', required: true },
};

const pg = (page: number, type: string, confidence = 0.9, neustart = false): PageClassification =>
  ({ page, type, confidence, neustart });

describe('buildSegments — Gruppierung', () => {
  test('Typwechsel bildet Grenzen, gleiche Typen werden zusammengefasst', () => {
    const r = buildSegments([
      pg(1, 'anschreiben'), pg(2, 'lebenslauf'), pg(3, 'lebenslauf'), pg(4, 'formular'),
    ], defs);
    expect(r.segments.map((s) => [s.type, s.pageFrom, s.pageTo])).toEqual([
      ['anschreiben', 1, 1], ['lebenslauf', 2, 3], ['formular', 4, 4],
    ]);
    expect(r.findings).toEqual([]);
  });

  test('Instanz-Konfidenz ist das Minimum der Seiten', () => {
    const r = buildSegments([pg(1, 'lebenslauf', 0.9), pg(2, 'lebenslauf', 0.6)], { ...defs, formular: { ...defs.formular!, required: false } });
    expect(r.segments[0]!.confidence).toBe(0.6);
  });

  test('langes Ein-Typ-Dokument bleibt EIN Segment (Negativfall 13-seitiger Lebenslauf)', () => {
    const r = buildSegments(
      Array.from({ length: 13 }, (_, i) => pg(i + 1, 'lebenslauf')),
      { lebenslauf: defs.lebenslauf! },
    );
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0]).toMatchObject({ pageFrom: 1, pageTo: 13, instance: 1 });
  });
});

describe('buildSegments — repeatable + Neustart', () => {
  test('Neustart-Marker trennt Instanzen desselben repeatable-Typs', () => {
    // Zwei Zertifikate direkt hintereinander (Bewerbungsmappen-Fall S.12+13)
    const r = buildSegments([
      pg(1, 'zertifikat', 0.9, true), pg(2, 'zertifikat', 0.9, true), pg(3, 'zertifikat', 0.9, false),
    ], defs);
    expect(r.segments.map((s) => [s.type, s.instance, s.pageFrom, s.pageTo])).toEqual([
      ['zertifikat', 1, 1, 1], ['zertifikat', 2, 2, 3],
    ]);
  });

  test('Neustart bei NICHT-repeatable Typ fasst zusammen und meldet einen Befund', () => {
    const r = buildSegments([pg(1, 'lebenslauf', 0.9, true), pg(2, 'lebenslauf', 0.9, true)], defs);
    expect(r.segments).toHaveLength(1);
    expect(r.findings.some((f) => f.severity === 'warn' && f.message.includes('wiederholbar'))).toBe(true);
  });
});

describe('buildSegments — eingebaute Typen + Befunde', () => {
  test('leerseite trennt Segmente ohne Alarm', () => {
    const r = buildSegments([
      pg(1, 'formular'), pg(2, 'leerseite'), pg(3, 'formular', 0.9, true),
    ], { formular: { ...defs.formular!, repeatable: true } });
    expect(r.segments.map((s) => s.type)).toEqual(['formular', 'leerseite', 'formular']);
    expect(r.findings).toEqual([]);
  });

  test('unbekannt wird ausgewiesen (error), fehlendes Pflicht-Segment ebenso', () => {
    const r = buildSegments([pg(1, 'anschreiben'), pg(2, 'unbekannt', 0.9)], defs);
    expect(r.findings.some((f) => f.severity === 'error' && f.message.includes('keinem beschriebenen Segmenttyp'))).toBe(true);
    expect(r.findings.some((f) => f.severity === 'error' && f.message.includes('Pflicht-Segment'))).toBe(true);
  });

  test('erfundene Typ-IDs aus dem Freitext-Fallback werden zu unbekannt', () => {
    const r = buildSegments([pg(1, 'phantasietyp', 0.9)], { lebenslauf: defs.lebenslauf! });
    expect(r.segments[0]!.type).toBe('unbekannt');
  });
});

describe('buildSegments — Glättung', () => {
  test('unsicherer Einzelseiten-Ausreißer zwischen gleichen Nachbarn wird absorbiert (mit Befund)', () => {
    const r = buildSegments([
      pg(1, 'lebenslauf'), pg(2, 'formular', 0.3), pg(3, 'lebenslauf'), pg(4, 'formular'),
    ], defs);
    expect(r.segments.map((s) => [s.type, s.pageFrom, s.pageTo])).toEqual([
      ['lebenslauf', 1, 3], ['formular', 4, 4],
    ]);
    expect(r.findings.some((f) => f.message.includes('Seite 2'))).toBe(true);
  });

  test('SICHERER Einseiter zwischen gleichen Nachbarn bleibt stehen — Einseiter sind der Normalfall', () => {
    const r = buildSegments([
      pg(1, 'lebenslauf'), pg(2, 'formular', 0.95), pg(3, 'lebenslauf'), pg(4, 'formular'),
    ], defs);
    expect(r.segments).toHaveLength(4);
  });
});
