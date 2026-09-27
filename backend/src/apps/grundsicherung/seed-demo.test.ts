/**
 * Grundsicherung — Demo-Seed: die Seed-Fälle ergeben durch die Regel-Engine die erwarteten
 * Goldfall-Befunde der Spec (DB-frei über `snapshotAus`).
 */
import { describe, expect, test } from 'bun:test';
import { demoFaelle, snapshotAus } from './seed-demo';
import { pruefeVorgang } from './checker';

const HEUTE = '2026-09-27';

describe('Demo-Seed = Goldfälle der Spec', () => {
  const faelle = demoFaelle();
  test('drei Fälle mit Personen und Dokumenten (personenbezogene Nachweise mit personId)', () => {
    expect(faelle.map((f) => f.key)).toEqual(['schmidt', 'berger', 'lehmann']);
    for (const f of faelle) {
      const keys = new Set(f.personen.map((p) => p.key));
      for (const d of f.dokumente) if (d.personKey) expect(keys.has(d.personKey)).toBe(true);
      expect(f.dokumente.find((d) => d.typ === 'grundsicherungsantrag')!.personKey).toBe(f.personen[0]!.key);
    }
  });
  for (const fall of demoFaelle()) {
    test(`${fall.key}: erwartete Befunde`, () => {
      const ids = new Set(pruefeVorgang(snapshotAus(fall), { heute: HEUTE }).map((b) => b.regelId));
      for (const id of fall.erwartet) expect(ids).toContain(id);
    });
  }
  test('Vermögen über Schonbetrag bleibt Hinweis (info)', () => {
    const b = pruefeVorgang(snapshotAus(demoFaelle()[2]!), { heute: HEUTE });
    expect(b.filter((x) => x.regelId.includes('vermoegen-ueber-schonbetrag')).every((x) => x.typ === 'info')).toBe(true);
  });
});
