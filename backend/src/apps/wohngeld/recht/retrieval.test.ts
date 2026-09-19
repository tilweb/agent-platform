/**
 * Unit-Tests für das deterministische Recht-Retrieval (C2).
 * Abnahme-Anker aus der Spec (Abschnitt 9) + Regel-Katalog-Bezüge.
 */
import { test, expect, describe } from 'bun:test';
import { sucheRecht, tokenize, erkannteParagraphen, scoreChunk } from './retrieval';
import { RECHT_KORPUS_BY_ID } from './corpus';

/** Sammelt die Paragraphen-Nummern der Treffer (z. B. 14, 7). */
function paragraphenNummern(chunks: { paragraph: string }[]): number[] {
  return chunks.map((c) => parseInt(c.paragraph.match(/(\d+)/)![1]!, 10));
}
function ids(chunks: { id: string }[]): string[] {
  return chunks.map((c) => c.id);
}

describe('sucheRecht — Abnahme-Anker', () => {
  test('Elterngeld zählt zum Einkommen → § 14', () => {
    const r = sucheRecht('Zählt Elterngeld zum Einkommen?');
    expect(r.length).toBeGreaterThan(0);
    expect(paragraphenNummern(r)).toContain(14);
    // Elterngeld steht in § 14 Abs. 2 → dieser Chunk soll der Top-Treffer sein.
    expect(r[0]!.id).toBe('wogg-14-abs2');
  });

  test('Wohngeld in Haft / Ausschluss → § 7 (und § 5)', () => {
    const r = sucheRecht('Bekommt man Wohngeld in Haft? Ausschluss');
    const nrs = paragraphenNummern(r);
    expect(nrs).toContain(7);
    expect(nrs).toContain(5);
  });

  test('Vermögen Freigrenze → § 21', () => {
    const r = sucheRecht('Vermögen Freigrenze');
    expect(r[0]!.paragraph).toBe('§ 21');
  });

  test('Bewilligungszeitraum wie lange → § 25', () => {
    const r = sucheRecht('Bewilligungszeitraum wie lange');
    expect(r[0]!.paragraph).toBe('§ 25');
  });

  test('Miete Höchstbetrag / abziehbare Kosten → § 9 und WoGV § 6', () => {
    const r = sucheRecht('Miete Höchstbetrag abziehbare Kosten');
    expect(ids(r)).toContain('wogg-9');
    expect(ids(r)).toContain('wogv-6');
  });
});

describe('sucheRecht — weitere fachliche Fragen', () => {
  test('Krankengeld → § 14 Abs. 2', () => {
    const r = sucheRecht('Wird Krankengeld beim Einkommen berücksichtigt?');
    expect(r[0]!.id).toBe('wogg-14-abs2');
  });

  test('Alleinerziehenden-Freibetrag → § 17', () => {
    const r = sucheRecht('Wie hoch ist der Freibetrag für Alleinerziehende?');
    expect(r[0]!.paragraph).toBe('§ 17');
  });

  test('10-Prozent-Pauschale für KV/PV → § 16', () => {
    const r = sucheRecht('Pauschalabzug Krankenversicherung Rentenversicherung 10 Prozent');
    expect(paragraphenNummern(r)).toContain(16);
  });

  test('Änderung / Mitteilungspflicht bei Einkommenserhöhung → § 27', () => {
    const r = sucheRecht('Muss ich eine Einkommenserhöhung melden? Mitteilungspflicht');
    expect(paragraphenNummern(r)).toContain(27);
  });

  test('Unterhalt gezahlt → § 18', () => {
    const r = sucheRecht('Kann ich gezahlten Unterhalt abziehen?');
    expect(paragraphenNummern(r)).toContain(18);
  });

  test('Gesamteinkommen Herleitung → § 13', () => {
    const r = sucheRecht('Wie setzt sich das anrechenbare Gesamteinkommen zusammen?');
    expect(paragraphenNummern(r)).toContain(13);
  });
});

describe('§-Erkennung und Boost', () => {
  test('erkannteParagraphen findet einzelne und mehrere §', () => {
    expect([...erkannteParagraphen('Was steht in §14?')]).toEqual([14]);
    expect([...erkannteParagraphen('§ 14 WoGG')]).toEqual([14]);
    expect([...erkannteParagraphen('Paragraph 21')]).toEqual([21]);
    const mehrere = erkannteParagraphen('§§ 7 und 8 regeln den Ausschluss');
    expect(mehrere.has(7)).toBe(true);
    expect(mehrere.has(8)).toBe(true);
  });

  test('explizite §-Nennung boostet den passenden Chunk nach oben', () => {
    // „Miete" allein träfe § 9; mit „§ 25" muss § 25 gewinnen.
    const r = sucheRecht('§ 25 Miete');
    expect(r[0]!.paragraph).toBe('§ 25');
  });

  test('scoreChunk: Tag-Treffer wiegt mehr als reiner Text-Treffer', () => {
    const c14 = RECHT_KORPUS_BY_ID.get('wogg-14-abs2')!;
    const tagHit = scoreChunk(c14, tokenize('elterngeld'), new Set());
    const textOnly = scoreChunk(c14, tokenize('bundeselterngeld'), new Set());
    expect(tagHit).toBeGreaterThan(textOnly);
  });
});

describe('sucheRecht — Eigenschaften', () => {
  test('deterministisch: gleiche Frage → gleiches Ergebnis', () => {
    const a = sucheRecht('Zählt Elterngeld zum Einkommen?');
    const b = sucheRecht('Zählt Elterngeld zum Einkommen?');
    expect(ids(a)).toEqual(ids(b));
  });

  test('respektiert k', () => {
    expect(sucheRecht('Einkommen', 2).length).toBeLessThanOrEqual(2);
  });

  test('nur Treffer mit Score > 0 (kein Rauschen bei themenfremder Frage)', () => {
    expect(sucheRecht('Fußball Bundesliga Wetterbericht xyz')).toEqual([]);
  });

  test('leere Frage → keine Treffer', () => {
    expect(sucheRecht('')).toEqual([]);
  });
});
