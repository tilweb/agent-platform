import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bereicheAusStartSeiten, brauchtGrenzpruefung, teilDateiname, findeOriginal, ersetzeGruppe,
  alleSpeicherRefs, pruefeUndTrenne, trenneManuell, defaultSplitDeps, type SplitDeps,
} from './posteingang-split';
import { countPdfPages } from '../../services/extraction/pdf';
import { isPdfSplitterAvailable } from '../../services/extraction/pdf-split';
import type { PosteingangDatei } from './types';

const pdf = (over: Partial<PosteingangDatei> = {}): PosteingangDatei => ({
  dateiname: 'scan.pdf', contentType: 'application/pdf', groesse: 100, hash: 'h-orig', pfad: 'x/scan.pdf', ...over,
});

const teil = (nr: number, von: number, bis: number, gesamt = 3): PosteingangDatei => ({
  dateiname: `scan_teil-${nr}.pdf`, contentType: 'application/pdf', groesse: 10, hash: `h-t${nr}`, pfad: `x/t${nr}.pdf`,
  typ: 'mietbescheinigung',
  teilVon: {
    dateiname: 'scan.pdf', pfad: 'x/scan.pdf', hash: 'h-orig', contentType: 'application/pdf', groesse: 100,
    seitenGesamt: 9, seiteVon: von, seiteBis: bis, teilNr: nr, teileGesamt: gesamt,
  },
});

describe('bereicheAusStartSeiten', () => {
  test('Seitenstarts → Bereiche', () => {
    expect(bereicheAusStartSeiten(9, [1, 4, 7])).toEqual([{ from: 1, to: 3 }, { from: 4, to: 6 }, { from: 7, to: 9 }]);
  });
  test('1 wird ergänzt, Dubletten/Reihenfolge egal', () => {
    expect(bereicheAusStartSeiten(5, [4, 4, 2])).toEqual([{ from: 1, to: 1 }, { from: 2, to: 3 }, { from: 4, to: 5 }]);
  });
  test('leer ⇒ ein Dokument', () => {
    expect(bereicheAusStartSeiten(3, [])).toEqual([{ from: 1, to: 3 }]);
  });
  test('ungültige Seite wirft', () => {
    expect(() => bereicheAusStartSeiten(3, [5])).toThrow(/Ungültige Seitenangabe 5/);
    expect(() => bereicheAusStartSeiten(3, [1.5])).toThrow();
  });
});

describe('brauchtGrenzpruefung', () => {
  test('neue PDF ja, Bild/Teil/ein_dokument/manuell nein, unsicher ja', () => {
    expect(brauchtGrenzpruefung(pdf())).toBe(true);
    expect(brauchtGrenzpruefung(pdf({ dateiname: 'a.jpg', contentType: 'image/jpeg' }))).toBe(false);
    expect(brauchtGrenzpruefung(teil(1, 1, 3))).toBe(false);
    expect(brauchtGrenzpruefung(pdf({ trennung: { status: 'ein_dokument', seitenGesamt: 4 } }))).toBe(false);
    expect(brauchtGrenzpruefung(pdf({ trennung: { status: 'unsicher', manuell: true } }))).toBe(false);
    expect(brauchtGrenzpruefung(pdf({ trennung: { status: 'unsicher' } }))).toBe(true);
  });
});

test('teilDateiname', () => {
  expect(teilDateiname('Scan 2026.pdf', 2, { from: 3, to: 5 })).toBe('Scan 2026_teil-2_S3-5.pdf');
  expect(teilDateiname('x.PDF', 1, { from: 1, to: 1 })).toBe('x_teil-1_S1.pdf');
});

describe('Gruppen-Helfer', () => {
  const dateien = [pdf({ dateiname: 'antrag.pdf', hash: 'h-a' }), teil(2, 4, 6), teil(1, 1, 3), pdf({ dateiname: 'foto.jpg', contentType: 'image/jpeg', hash: 'h-f' })];

  test('findeOriginal rekonstruiert das Original aus Teilen', () => {
    const g = findeOriginal(dateien, 'h-orig')!;
    expect(g.original.dateiname).toBe('scan.pdf');
    expect(g.original.typ).toBeUndefined();
    expect(g.seitenGesamt).toBe(9);
    expect(g.bereiche).toEqual([{ from: 1, to: 3 }, { from: 4, to: 6 }]);
    expect(findeOriginal(dateien, 'gibtsnicht')).toBeNull();
  });

  test('ersetzeGruppe ersetzt an der Position des ersten Teils', () => {
    const neu = ersetzeGruppe(dateien, 'h-orig', [pdf({ hash: 'h-orig', trennung: { status: 'ein_dokument', manuell: true } })]);
    expect(neu.map((d) => d.hash)).toEqual(['h-a', 'h-orig', 'h-f']);
  });

  test('alleSpeicherRefs dedupliziert Original über mehrere Teile', () => {
    expect(alleSpeicherRefs(dateien).map((r) => r.pfad)).toEqual(['x/scan.pdf', 'x/t2.pdf', 'x/t1.pdf']);
  });
});

// ── IO mit Fakes ─────────────────────────────────────────────────────────────

function fakeDeps(seiten: number, urteile: Array<boolean | null>, over: Partial<SplitDeps> = {}): SplitDeps & { gespeichert: string[] } {
  const gespeichert: string[] = [];
  return {
    gespeichert,
    load: async () => new Uint8Array([1, 2, 3]),
    store: async (_b, name) => { gespeichert.push(name); return { pfad: `store/${name}`, dateiname: name }; },
    countPages: async () => seiten,
    renderPages: async () => Array.from({ length: seiten }, (_, i) => ({ pageNumber: i + 1, pngBuffer: Buffer.from([]) }) as never),
    judge: async () => urteile,
    splitterAvailable: async () => true,
    buildPart: async (_p, from, to) => new Uint8Array([from, to]),
    ...over,
  };
}

describe('pruefeUndTrenne (Fakes)', () => {
  test('trennt an sicheren Grenzen, Provenienz gesetzt', async () => {
    const deps = fakeDeps(5, [false, true, false, true]);
    const r = await pruefeUndTrenne(pdf(), {}, deps);
    expect(r.getrennt).toBe(true);
    expect(r.bereiche).toEqual([{ from: 1, to: 2 }, { from: 3, to: 4 }, { from: 5, to: 5 }]);
    expect(r.dateien.map((d) => d.dateiname)).toEqual(['scan_teil-1_S1-2.pdf', 'scan_teil-2_S3-4.pdf', 'scan_teil-3_S5.pdf']);
    expect(r.dateien[1]!.teilVon).toMatchObject({ hash: 'h-orig', seitenGesamt: 5, seiteVon: 3, seiteBis: 4, teilNr: 2, teileGesamt: 3 });
    expect(r.dateien[1]!.teilVon!.manuell).toBeUndefined();
  });

  test('ein unsicheres Urteil ⇒ keine Trennung, Hinweis', async () => {
    const r = await pruefeUndTrenne(pdf(), {}, fakeDeps(3, [true, null]));
    expect(r.getrennt).toBe(false);
    expect(r.dateien).toHaveLength(1);
    expect(r.dateien[0]!.trennung).toMatchObject({ status: 'unsicher', seitenGesamt: 3 });
  });

  test('keine Grenze ⇒ ein_dokument (wird nicht erneut geprüft)', async () => {
    const r = await pruefeUndTrenne(pdf(), {}, fakeDeps(3, [false, false]));
    expect(r.dateien[0]!.trennung).toEqual({ status: 'ein_dokument', seitenGesamt: 3 });
    expect(brauchtGrenzpruefung(r.dateien[0]!)).toBe(false);
  });

  test('einseitig ⇒ kein Vision-Call', async () => {
    let calls = 0;
    const r = await pruefeUndTrenne(pdf(), {}, fakeDeps(1, [], { judge: async () => { calls++; return []; } }));
    expect(calls).toBe(0);
    expect(r.dateien[0]!.trennung?.status).toBe('ein_dokument');
  });

  test('zu viele Seiten / fehlender Splitter / Judge-Fehler ⇒ nicht getrennt', async () => {
    const viele = await pruefeUndTrenne(pdf(), {}, fakeDeps(500, []));
    expect(viele.dateien[0]!.trennung?.status).toBe('nicht_moeglich');
    const ohne = await pruefeUndTrenne(pdf(), {}, fakeDeps(3, [true, true], { splitterAvailable: async () => false }));
    expect(ohne.dateien[0]!.trennung?.status).toBe('nicht_moeglich');
    const kaputt = await pruefeUndTrenne(pdf(), {}, fakeDeps(3, [], { judge: async () => { throw new Error('Modell weg'); } }));
    expect(kaputt.dateien[0]!.trennung?.status).toBe('unsicher');
  });

  test('Bild wird nicht angefasst', async () => {
    const bild = pdf({ dateiname: 'a.png', contentType: 'image/png' });
    const r = await pruefeUndTrenne(bild, {}, fakeDeps(3, [true, true]));
    expect(r.dateien).toEqual([bild]);
  });
});

describe('trenneManuell (Fakes)', () => {
  test('Seitenstarts ⇒ manuelle Teile', async () => {
    const r = await trenneManuell(pdf(), [1, 3], fakeDeps(4, []));
    expect(r.getrennt).toBe(true);
    expect(r.dateien.every((d) => d.teilVon?.manuell)).toBe(true);
    expect(r.bereiche).toEqual([{ from: 1, to: 2 }, { from: 3, to: 4 }]);
  });
  test('leer ⇒ ein Dokument, manuell markiert, Analyse zurückgesetzt', async () => {
    const r = await trenneManuell(pdf({ typ: 'wohngeldantrag' }), [], fakeDeps(4, []));
    expect(r.dateien).toHaveLength(1);
    expect(r.dateien[0]!.typ).toBeUndefined();
    expect(r.dateien[0]!.trennung).toEqual({ status: 'ein_dokument', seitenGesamt: 4, manuell: true });
  });
  test('ungültige Seite ⇒ Fehler', async () => {
    await expect(trenneManuell(pdf(), [9], fakeDeps(4, []))).rejects.toThrow(/Ungültige Seitenangabe/);
  });
});

// ── Echter poppler-Split (übersprungen, wenn poppler fehlt) ──────────────────

describe('trenneManuell mit poppler', () => {
  let dir = '';
  let quelle: Uint8Array | null = null;
  const fixture = join(import.meta.dir, '../echoloop/extract/__fixtures__/uebungsfall/prozesse/Prozess_210_2026-08-05.pdf');

  beforeAll(async () => {
    if (!(await isPdfSplitterAvailable())) return;
    dir = await mkdtemp(join(tmpdir(), 'wg-split-test-'));
    const out = join(dir, 'vier.pdf');
    const proc = Bun.spawn(['pdfunite', fixture, fixture, out], { stdout: 'pipe', stderr: 'pipe' });
    if ((await proc.exited) === 0) quelle = new Uint8Array(await readFile(out));
  });
  afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

  test('4-seitige PDF in 1–1 und 2–4 trennen', async () => {
    if (!quelle) { console.warn("poppler fehlt — Test übersprungen"); return; }
    const bytes = quelle;
    const deps: SplitDeps = {
      ...defaultSplitDeps,
      load: async () => bytes,
      store: async (_b, name) => ({ pfad: `mem/${name}`, dateiname: name }),
    };
    const gebaut: Uint8Array[] = [];
    const r = await trenneManuell(pdf(), [2], { ...deps, buildPart: async (p, f, t) => { const b = await defaultSplitDeps.buildPart(p, f, t); gebaut.push(b); return b; } });
    expect(r.seitenGesamt).toBe(4);
    expect(r.dateien).toHaveLength(2);
    expect(await countPdfPages(Buffer.from(gebaut[0]!))).toBe(1);
    expect(await countPdfPages(Buffer.from(gebaut[1]!))).toBe(3);
    expect(r.dateien[0]!.hash).not.toBe(r.dateien[1]!.hash);
  });
});
