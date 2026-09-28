/**
 * Wächter: Jede im Checker erzeugte Regel-ID ist beschrieben — und jede Beschreibung gehört zu
 * einer tatsächlich erzeugten Regel. Zusätzlich: Umfang laut Spec (27 · 20 · 5 · 1).
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { REGELKATALOG, REGEL_GRUPPE_LABEL, regelBeschreibung } from './regeln';

const DATEIEN = ['nachweise.ts', 'plausibilitaet.ts', 'vorrang.ts', 'ausserhalb.ts'];

async function regelIds(datei?: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const d of datei ? [datei] : DATEIEN) {
    const src = await Bun.file(join(import.meta.dir, d)).text();
    for (const m of src.matchAll(/regelId:\s*'([^']+)'/g)) ids.add(m[1]!);
    for (const m of src.matchAll(/regelId:\s*`([^`$:]+)[:$]/g)) ids.add(m[1]!);
  }
  return ids;
}

describe('Regelkatalog Grundsicherung', () => {
  test('jede Regel im Checker ist beschrieben', async () => {
    const ids = await regelIds();
    const fehlend = [...ids].filter((id) => !regelBeschreibung(id));
    expect(fehlend).toEqual([]);
  });

  test('keine Beschreibung ohne Regel', async () => {
    const ids = await regelIds();
    const verwaist = REGELKATALOG.map((r) => r.id).filter((id) => !ids.has(id));
    expect(verwaist).toEqual([]);
  });

  test('Umfang laut Spec: 27 Vollständigkeit · 20 Plausibilität · 5 Vorrang · 1 Prüfumfang', async () => {
    expect((await regelIds('nachweise.ts')).size).toBe(27);
    expect((await regelIds('plausibilitaet.ts')).size).toBe(20);
    expect((await regelIds('vorrang.ts')).size).toBe(5);
    expect((await regelIds('ausserhalb.ts')).size).toBe(1);
    expect(REGELKATALOG.length).toBe(53);
  });

  test('Vorrang und Prüfumfang sind nur Hinweise (info)', () => {
    for (const r of REGELKATALOG.filter((r) => r.id.startsWith('vorrang-') || r.id === 'ausserhalb-pruefumfang')) {
      expect(r.typ).toBe('info');
    }
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
      if (r.kategorie === 'vollstaendigkeit') expect(r.nachweis).toBeTruthy();
      expect(r.kategorie === 'vollstaendigkeit').toBe(!r.id.startsWith('plausi-') && !r.id.startsWith('vorrang-') && r.id !== 'ausserhalb-pruefumfang');
    }
  });

  test('kommunal festzulegende Schwellen sind gekennzeichnet', () => {
    for (const id of ['kontoauszuege', 'plausi-grosse-abgaenge', 'plausi-miete-abweichung', 'plausi-kontostand-abweichung']) {
      expect(regelBeschreibung(id)?.hinweise?.some((h) => h.startsWith('Kommunal festzulegen'))).toBe(true);
    }
  });
});

test('GET /regeln liefert Katalog, Gruppen und Stand (Form wie Wohngeld)', async () => {
  const { pruefschritteRoutes } = await import('../routes/pruefschritte');
  const res = await pruefschritteRoutes.request('/regeln');
  expect(res.status).toBe(200);
  const d = await res.json() as { stand: string; gruppen: Record<string, string>; regeln: Array<{ id: string }> };
  expect(d.regeln.length).toBe(REGELKATALOG.length);
  expect(d.gruppen.wohnen).toBe('Unterkunft und Heizung');
  expect(d.stand).toMatch(/^\d{4}-\d{2}-\d{2}[a-z]?$/);
});
