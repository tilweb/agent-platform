/**
 * Wächter: Jede im Checker erzeugte Regel-ID ist beschrieben — und jede Beschreibung
 * gehört zu einer tatsächlich erzeugten Regel.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { REGELKATALOG, REGEL_GRUPPE_LABEL, regelBeschreibung } from './regeln';

async function regelIdsImChecker(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const datei of ['nachweise.ts', 'plausibilitaet.ts']) {
    const src = await Bun.file(join(import.meta.dir, datei)).text();
    for (const m of src.matchAll(/regelId:\s*'([^']+)'/g)) ids.add(m[1]!);
    for (const m of src.matchAll(/regelId:\s*`([^`$:]+)[:$]/g)) ids.add(m[1]!); // parametrisiert: `basis:${…}`
  }
  return ids;
}

describe('Regelkatalog', () => {
  test('jede Regel im Checker ist beschrieben', async () => {
    const ids = await regelIdsImChecker();
    expect(ids.size).toBeGreaterThan(20);
    const fehlend = [...ids].filter((id) => !regelBeschreibung(id));
    expect(fehlend).toEqual([]);
  });

  test('keine Beschreibung ohne Regel', async () => {
    const ids = await regelIdsImChecker();
    const verwaist = REGELKATALOG.map((r) => r.id).filter((id) => !ids.has(id));
    expect(verwaist).toEqual([]);
  });

  test('Einträge vollständig und eindeutig', () => {
    const ids = REGELKATALOG.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of REGELKATALOG) {
      expect(r.titel.length).toBeGreaterThan(3);
      expect(r.ausloeser.length).toBeGreaterThan(20);
      expect(r.erledigung.length).toBeGreaterThan(10);
      expect(r.rechtsgrundlage).toMatch(/§/);
      expect(REGEL_GRUPPE_LABEL[r.gruppe]).toBeTruthy();
      if (r.kategorie === 'vollstaendigkeit' && r.typ === 'anforderung' && r.bezug !== 'vorgang') expect(r.nachweis).toBeTruthy();
    }
  });

  test('parametrisierte Regel-IDs werden aufgelöst', () => {
    expect(regelBeschreibung('plausi-kontoauszug-unerklaerte-einkuenfte:kapitalertraege')?.id).toBe('plausi-kontoauszug-unerklaerte-einkuenfte');
    expect(regelBeschreibung('gibt-es-nicht')).toBeUndefined();
  });
});

test('GET /regeln liefert Katalog, Gruppen und Stand', async () => {
  const { pruefschritteRoutes } = await import('../routes/pruefschritte');
  const res = await pruefschritteRoutes.request('/regeln');
  expect(res.status).toBe(200);
  const d = await res.json() as { stand: string; gruppen: Record<string, string>; regeln: Array<{ id: string }> };
  expect(d.regeln.length).toBe(REGELKATALOG.length);
  expect(d.gruppen.wohnen).toBe('Wohnung und Miete');
  expect(d.stand).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
