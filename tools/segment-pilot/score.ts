/**
 * Segment-Pilot (W10.1): Messung gegen die Ground Truth.
 *
 * Metriken:
 *  - Seitentyp-Accuracy: je Seite GT-Typ vs. klassifizierter Typ
 *    (Aequivalenz: GT 'trennblatt' zaehlt als 'leerseite'; GT-Typen, die das
 *    jeweilige Familien-Profil nicht kennt, werden auf den naechsten
 *    Profil-Typ gemappt — siehe TYPE_ALIASES)
 *  - Grenzen: Precision/Recall der Segment-Uebergaenge (Seite i → i+1)
 *  - Segment-Exact-Match: Typ + Seitenbereich identisch
 *
 * Aufruf (im backend/-Verzeichnis):
 *   /Users/andreasbachmann/.bun/bin/bun run ../tools/segment-pilot/score.ts
 */

import { resolve } from 'path';
import { writeFile } from 'fs/promises';

interface GtSegment { type: string; from: number; to: number }
interface PredSegment { type: string; pageFrom: number; pageTo: number }

/** GT-Typen, die in den schlanken Familien-Profilen unter einem Nachbartyp laufen. */
const TYPE_ALIASES: Record<string, Record<string, string>> = {
  bewerbung: { trennblatt: 'leerseite' },
  energierechnung: {},
  versicherungspaket: {},
  formularpaket: {},
  vertragswerk: {},
  gutachten: {},
  eingangsrechnung: {},
  behoerdenschreiben: {},
  'nachweis-mappe': {},
  fahrzeugangebot: {},
};

function gtTypeFor(profileId: string, gtType: string): string {
  return TYPE_ALIASES[profileId]?.[gtType] ?? gtType;
}

function pageTypes(segs: Array<{ type: string; from: number; to: number }>, pages: number): string[] {
  const arr = new Array(pages).fill('unbekannt');
  for (const s of segs) for (let p = s.from; p <= s.to; p += 1) arr[p - 1] = s.type;
  return arr;
}

function boundaries(segs: Array<{ from: number; to: number }>): Set<number> {
  // Uebergang NACH Seite s.to (ausser am Dokumentende)
  const set = new Set<number>();
  for (const s of segs) set.add(s.to);
  return set;
}

async function main() {
  const gt = JSON.parse(await Bun.file(resolve(import.meta.dir, 'groundtruth/documents.json')).text()) as Record<string, { seiten: number; segmente: GtSegment[] }>;
  const mapping = JSON.parse(await Bun.file(resolve(import.meta.dir, 'groundtruth/mapping.json')).text()) as Record<string, string>;
  const results = JSON.parse(await Bun.file(resolve(import.meta.dir, 'results/segments.json')).text()) as Array<{
    file: string; profileId: string; seiten: number;
    segments: PredSegment[]; findings: Array<{ severity: string; message: string }>;
  }>;

  let pagesTotal = 0, pagesCorrect = 0;
  let gtBoundTotal = 0, predBoundTotal = 0, boundHit = 0;
  let segsTotal = 0, segsExact = 0, segsTypeRange1 = 0;
  const lines: string[] = ['# Segment-Pilot — Messung (W10.1)', ''];
  const perDoc: string[] = ['| Dokument | Seiten-Acc | Grenzen (Prec/Rec) | Segmente exakt | Befunde |', '|---|---|---|---|---|'];

  for (const [file, doc] of Object.entries(gt)) {
    if (file.startsWith('_')) continue;
    const r = results.find((x) => x.file === file);
    if (!r) { perDoc.push(`| ${file} | — nicht gelaufen — | | | |`); continue; }
    const profileId = mapping[file]!;
    const gtSegs = doc.segmente.map((s) => ({ ...s, type: gtTypeFor(profileId, s.type) }));

    const gtP = pageTypes(gtSegs, doc.seiten);
    const prP = pageTypes(r.segments.map((s) => ({ type: s.type, from: s.pageFrom, to: s.pageTo })), doc.seiten);
    const correct = gtP.filter((t, i) => t === prP[i]).length;
    pagesTotal += doc.seiten; pagesCorrect += correct;

    const gtB = boundaries(gtSegs.map((s) => ({ from: s.from, to: s.to })));
    const prB = boundaries(r.segments.map((s) => ({ from: s.pageFrom, to: s.pageTo })));
    gtB.delete(doc.seiten); prB.delete(doc.seiten);  // Dokumentende ist keine Entscheidung
    const hit = [...prB].filter((b) => gtB.has(b)).length;
    gtBoundTotal += gtB.size; predBoundTotal += prB.size; boundHit += hit;

    segsTotal += gtSegs.length;
    let exact = 0;
    for (const g of gtSegs) {
      if (r.segments.some((p) => p.type === g.type && p.pageFrom === g.from && p.pageTo === g.to)) { exact += 1; continue; }
      if (r.segments.some((p) => p.type === g.type && Math.abs(p.pageFrom - g.from) + Math.abs(p.pageTo - g.to) <= 1)) segsTypeRange1 += 1;
    }
    segsExact += exact;

    const prec = prB.size ? hit / prB.size : 1, rec = gtB.size ? hit / gtB.size : 1;
    perDoc.push(`| ${file} | ${correct}/${doc.seiten} | ${(prec * 100).toFixed(0)}%/${(rec * 100).toFixed(0)}% | ${exact}/${gtSegs.length} | ${r.findings.length} |`);
  }

  lines.push(`Seitentyp-Accuracy: **${pagesCorrect}/${pagesTotal} (${(100 * pagesCorrect / pagesTotal).toFixed(1)} %)**`);
  lines.push(`Grenzen: Precision **${(100 * boundHit / Math.max(1, predBoundTotal)).toFixed(1)} %** (${boundHit}/${predBoundTotal}) · Recall **${(100 * boundHit / Math.max(1, gtBoundTotal)).toFixed(1)} %** (${boundHit}/${gtBoundTotal})`);
  lines.push(`Segmente exakt (Typ + Seitenbereich): **${segsExact}/${segsTotal}** · zusaetzlich ±1 Seite: ${segsTypeRange1}`);
  lines.push('', ...perDoc);

  const out = lines.join('\n');
  console.log(out);
  await writeFile(resolve(import.meta.dir, 'results/messung.md'), out + '\n', 'utf-8');
  process.exit(0);
}

void main();
