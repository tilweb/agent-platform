import { describe, expect, test } from 'bun:test';
import { fuseWithOcr, applyFusionToConfidences, isNumericLike, type FusionOutcome } from './fusion';
import type { ExtractionProfile } from '../../extraction/types';
import type { OcrWord } from './ocr';

const profile: ExtractionProfile = {
  fields: {
    felder: {
      lieferscheinnummer: { type: 'text', required: true, label: 'Lieferscheinnummer' },
      lieferdatum: { type: 'date', required: true, label: 'Lieferdatum' },
      kommentar: { type: 'text', required: false, label: 'Kommentar' },
      handschrift: { type: 'boolean', required: false, label: 'Handschrift' },
    },
    positionen: {
      _array: true,
      _label: 'Positionen',
      _item_fields: {
        artikelnummer: { type: 'text', label: 'Artikelnummer' },
        menge: { type: 'number', label: 'Menge' },
      },
    },
  },
} as unknown as ExtractionProfile;

/** Wort-Fabrik: Pixel auf einer 1000x1400-Seite. */
const w = (text: string, left: number, top: number): OcrWord =>
  ({ text, left, top, width: 80, height: 20, conf: 90 });

const page = { pngBuffer: Buffer.alloc(0), width: 1000, height: 1400, pageNumber: 1 };

describe('isNumericLike', () => {
  test('Zahl-/Datums-Felder und Ziffern-Werte sind zahlenartig, Freitext nicht', () => {
    expect(isNumericLike(5, 'number')).toBe(true);
    expect(isNumericLike('2024-12-19', 'date')).toBe(true);
    expect(isNumericLike('0275062', 'text')).toBe(true);
    expect(isNumericLike('3039326/11', 'text')).toBe(true);
    expect(isNumericLike('Kabelkanal grau', 'text')).toBe(false);
  });
});

describe('fuseWithOcr — Skalare', () => {
  const extracted = {
    felder: {
      lieferscheinnummer: '56294390',
      lieferdatum: '2024-12-19',
      kommentar: 'frei Bordsteinkante',
      handschrift: false,
    },
    positionen: [],
  };

  test('belegte Werte werden verified (inkl. DE-Datumsformat) und entschieden', () => {
    const words = [w('56294390', 100, 100), w('19.12.24', 300, 100)];
    const out = fuseWithOcr([page], extracted, profile, { wordsByPage: [words] });
    expect(out.ocrRan).toBe(true);
    expect(out.verdicts['felder.lieferscheinnummer']).toBe('verified');
    expect(out.verdicts['felder.lieferdatum']).toBe('verified');
    expect(out.decidedPaths.has('felder.lieferscheinnummer')).toBe(true);
    expect(out.boxes['felder.lieferscheinnummer']!.page).toBe(1);
  });

  test('unbelegte NUMMER wird not_found_numeric mit Befund; unbelegter Freitext bleibt weich', () => {
    const words = [w('irgendwas', 100, 100), w('anderes', 300, 100)];
    const out = fuseWithOcr([page], extracted, profile, { wordsByPage: [words] });
    expect(out.verdicts['felder.lieferscheinnummer']).toBe('not_found_numeric');
    expect(out.findings.some((f) => f.path === 'felder.lieferscheinnummer')).toBe(true);
    expect(out.verdicts['felder.kommentar']).toBe('not_found_text');
    expect(out.decidedPaths.has('felder.kommentar')).toBe(false);
  });

  test('boolean und leere Werte sind not_checkable', () => {
    const out = fuseWithOcr([page], { felder: { handschrift: true, kommentar: null } }, profile, { wordsByPage: [[w('x', 0, 0)]] });
    expect(out.verdicts['felder.handschrift']).toBe('not_checkable');
    expect(out.verdicts['felder.kommentar']).toBe('not_checkable');
  });

  test('ohne OCR-Woerter keine Urteile (ocrRan false) — keine falschen Befunde', () => {
    const out = fuseWithOcr([page], extracted, profile, { wordsByPage: [[]] });
    expect(out.ocrRan).toBe(false);
    expect(out.findings).toEqual([]);
  });
});

describe('fuseWithOcr — Listen-Zeilen', () => {
  const extracted = {
    felder: { lieferscheinnummer: null, lieferdatum: null, kommentar: null, handschrift: null },
    positionen: [
      { artikelnummer: '0491734', menge: 5 },
      { artikelnummer: '0498529', menge: 7 },
    ],
  };

  test('Anker (Artikelnummer) verankert die Zeile; Menge wird in der Bande gefunden', () => {
    const words = [
      w('0491734', 100, 400), w('5', 500, 400),
      w('0498529', 100, 500), w('7', 500, 500),
    ];
    const out = fuseWithOcr([page], extracted, profile, { wordsByPage: [words] });
    expect(out.verdicts['positionen[0].artikelnummer']).toBe('verified');
    expect(out.verdicts['positionen[0].menge']).toBe('verified');
    expect(out.verdicts['positionen[1].menge']).toBe('verified');
    expect(out.boxes['positionen[1].menge']!.y).toBeCloseTo(500 / 1400, 3);
  });

  test('Menge AUSSERHALB der Zeilen-Bande zaehlt nicht (keine Verwechslung mit fremder Zahl)', () => {
    const words = [
      w('0491734', 100, 400),
      // "5" steht weit weg (andere Zeile) — darf Zeile 1 nicht verifizieren.
      w('5', 500, 900),
    ];
    const out = fuseWithOcr([page], extracted, profile, { wordsByPage: [words] });
    expect(out.verdicts['positionen[0].menge']).toBe('not_found_numeric');
    expect(out.verdicts['positionen']).toBe('not_found_numeric');
    expect(out.findings.some((f) => f.path === 'positionen[0].menge')).toBe(true);
  });

  test('gedrucktes DE-Zahlformat belegt den Zahlwert ("5,00" ↔ 5), auch eine Zeile OBERHALB des Ankers', () => {
    // Sonepar-Layout: Menge steht in der Zeile UEBER der Artikelnummer.
    const words = [
      w('5,00', 500, 370),
      w('0491734', 100, 400),
      w('0498529', 100, 700), w('7,00', 500, 700),
    ];
    const out = fuseWithOcr([page], extracted, profile, { wordsByPage: [words] });
    expect(out.verdicts['positionen[0].menge']).toBe('verified');
    expect(out.verdicts['positionen[1].menge']).toBe('verified');
  });

  test('Nachbar-Anker begrenzt die Bande: Menge der NAECHSTEN Zeile belegt nichts', () => {
    const words = [
      w('0491734', 100, 400),
      // naechste Zeile beginnt bei y440: deren Menge 5,00 liegt nah, gehoert aber zu Zeile 2.
      w('0498529', 100, 440), w('5,00', 500, 440),
    ];
    const extractedSwapped = {
      felder: { lieferscheinnummer: null, lieferdatum: null, kommentar: null, handschrift: null },
      positionen: [
        { artikelnummer: '0491734', menge: 5 },   // 5 steht NICHT in Zeile 1
        { artikelnummer: '0498529', menge: 5 },
      ],
    };
    const out = fuseWithOcr([page], extractedSwapped, profile, { wordsByPage: [words] });
    expect(out.verdicts['positionen[0].menge']).toBe('not_found_numeric');
    expect(out.verdicts['positionen[1].menge']).toBe('verified');
  });

  test('ohne Anker keine Aussage ueber die Zeile (kein Befund-Rauschen)', () => {
    const words = [w('voellig', 100, 100), w('anderes', 300, 100)];
    const out = fuseWithOcr([page], extracted, profile, { wordsByPage: [words] });
    expect(out.verdicts['positionen[0].menge']).toBeUndefined();
    expect(out.findings).toEqual([]);
  });
});

describe('applyFusionToConfidences', () => {
  test('verified hebt an, unbelegte Zahl deckelt unter die Review-Schwelle', () => {
    const out: FusionOutcome = {
      boxes: {}, decidedPaths: new Set(), findings: [], ocrRan: true,
      verdicts: {
        'felder.a': 'verified',
        'felder.b': 'not_found_numeric',
        'felder.c': 'not_found_text',
      },
    };
    const conf = { 'felder.a': 0.7, 'felder.b': 0.7, 'felder.c': 0.7 };
    applyFusionToConfidences(conf, out);
    expect(conf['felder.a']).toBe(0.95);
    expect(conf['felder.b']).toBe(0.4);
    expect(conf['felder.c']).toBe(0.7);
  });

  test('ohne OCR keine Aenderung', () => {
    const out: FusionOutcome = { boxes: {}, decidedPaths: new Set(), findings: [], ocrRan: false, verdicts: { 'felder.a': 'verified' } };
    const conf = { 'felder.a': 0.5 };
    applyFusionToConfidences(conf, out);
    expect(conf['felder.a']).toBe(0.5);
  });
});
