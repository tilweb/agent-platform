/**
 * Ehinger-Pilot: Messung gegen die manuell gelabelte Ground Truth.
 *
 * Misst NICHT gegen einen Modell-Output, sondern gegen das, was in den Scans
 * steht (`groundtruth/documents.json`, Seite fuer Seite visuell gelabelt) und
 * gegen die per lokalem OCR ermittelte Lieferanten-Wahrheit
 * (`groundtruth/vendors.json`).
 *
 *   /Users/andreasbachmann/.bun/bin/bun run ../tools/ehinger-pilot/score.ts
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { computeReviewStatus } from '../../backend/src/extraction/learning/review';
import { getProject } from '../../backend/src/extraction/learning/projects';

const DIR = import.meta.dir;

interface Position {
  positionsnummer?: string;
  artikelnummer?: string;
  menge_bestellt?: number | string | null;
  menge_geliefert?: number | string | null;
  einheit?: string | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
/** Artikelnummern gelten als gleich, wenn sie ohne fuehrende Nullen/Trenner uebereinstimmen. */
const normArt = (v: unknown): string => String(v ?? '').trim().replace(/[\s/-]/g, '').replace(/^0+/, '').toLowerCase();
const normTxt = (v: unknown): string => String(v ?? '').trim().toLowerCase();

interface Tally { hit: number; total: number }
const t = (): Tally => ({ hit: 0, total: 0 });
const add = (x: Tally, ok: boolean) => { x.total += 1; if (ok) x.hit += 1; };
const pct = (x: Tally) => (x.total === 0 ? '—' : `${((x.hit / x.total) * 100).toFixed(0)} % (${x.hit}/${x.total})`);

async function main() {
  const run = JSON.parse(await readFile(resolve(DIR, 'results/run.json'), 'utf-8')) as any[];
  const truth = JSON.parse(await readFile(resolve(DIR, 'groundtruth/documents.json'), 'utf-8'));
  const vendors = JSON.parse(await readFile(resolve(DIR, 'groundtruth/vendors.json'), 'utf-8'));

  const byBeleg = new Map(run.map((r) => [r.beleg, r]));
  const lines: string[] = [];

  // ---------- 1. Klassifikation (alle 24) ----------
  const cls = t();
  const clsFehler: string[] = [];
  for (const [beleg, vendor] of Object.entries(vendors)) {
    if (beleg.startsWith('_')) continue;
    const r = byBeleg.get(beleg);
    if (!r) continue;
    const erkannt = r.klassifikation.project_id
      ? String(r.klassifikation.project_id).replace('ehinger-pilot-', '').replace('elektro-braun', 'elektrobraun')
      : 'fallback';
    const ok = erkannt === vendor;
    add(cls, ok);
    if (!ok) clsFehler.push(`${beleg}: erkannt ${erkannt} (${r.klassifikation.confidence.toFixed(2)}), richtig ${vendor}`);
  }

  // ---------- 2. Kopffelder + Positionen (gelabelte Stichprobe) ----------
  const kopf = { lieferscheinnummer: t(), referenznummer: t(), lieferdatum: t() };
  const posCount = t();
  const posFelder = { artikelnummer: t(), menge_bestellt: t(), menge_geliefert: t(), einheit: t() };
  const gefunden = t();          // Recall: gelabelte Positionen, die wiedergefunden wurden
  const erfunden: string[] = []; // Positionen im Ergebnis ohne Entsprechung im Beleg
  const detail: string[] = [];

  for (const [beleg, soll] of Object.entries<any>(truth)) {
    if (beleg.startsWith('_')) continue;
    const r = byBeleg.get(beleg);
    const ist = r?.extraktion?.data;
    if (!ist) { detail.push(`${beleg}: keine Extraktion (${r?.fehler ?? 'nicht gelaufen'})`); continue; }

    add(kopf.lieferscheinnummer, normTxt(ist.lieferscheinnummer) === normTxt(soll.lieferscheinnummer));
    add(kopf.referenznummer, normTxt(ist.referenznummer) === normTxt(soll.referenznummer));
    add(kopf.lieferdatum, normTxt(ist.lieferdatum) === normTxt(soll.lieferdatum));

    const istPos: Position[] = Array.isArray(ist.positionen) ? ist.positionen : [];
    add(posCount, istPos.length === soll.positionen.length);

    const verbraucht = new Set<number>();
    for (const sp of soll.positionen as Position[]) {
      const idx = istPos.findIndex((ip, i) => !verbraucht.has(i) && normArt(ip.artikelnummer) === normArt(sp.artikelnummer));
      add(gefunden, idx >= 0);
      if (idx < 0) { detail.push(`${beleg}: Position ${sp.positionsnummer} (Art. ${sp.artikelnummer}) fehlt`); continue; }
      verbraucht.add(idx);
      const ip = istPos[idx]!;
      add(posFelder.artikelnummer, true);
      const okB = num(ip.menge_bestellt) === num(sp.menge_bestellt);
      const okG = num(ip.menge_geliefert) === num(sp.menge_geliefert);
      const okE = normTxt(ip.einheit) === normTxt(sp.einheit);
      add(posFelder.menge_bestellt, okB);
      add(posFelder.menge_geliefert, okG);
      add(posFelder.einheit, okE);
      if (!okB) detail.push(`${beleg}/${sp.positionsnummer}: bestellt ${ip.menge_bestellt} statt ${sp.menge_bestellt}`);
      if (!okG) detail.push(`${beleg}/${sp.positionsnummer}: geliefert ${ip.menge_geliefert} statt ${sp.menge_geliefert}`);
      if (!okE) detail.push(`${beleg}/${sp.positionsnummer}: Einheit ${ip.einheit} statt ${sp.einheit}`);
    }
    istPos.forEach((ip, i) => { if (!verbraucht.has(i)) erfunden.push(`${beleg}: zusaetzliche Position Art. ${ip.artikelnummer}`); });
  }

  // ---------- 3. Review-Triage: markiert sie die Belege mit Fehlern? ----------
  const triage: string[] = [];
  let autoOk = 0, needsReview = 0;
  const projectCache = new Map<string, any>();
  for (const r of run) {
    if (!r.extraktion) continue;
    const pid = r.klassifikation.project_id as string;
    if (!projectCache.has(pid)) projectCache.set(pid, await getProject(pid));
    const project = projectCache.get(pid);
    if (!project) continue;
    const status = computeReviewStatus(project, r.extraktion.data, r.extraktion.fieldConfidences, r.extraktion.validations as any);
    if (status === 'auto_ok') autoOk += 1; else needsReview += 1;
    const soll = (truth as any)[r.beleg];
    if (soll) {
      const ist = r.extraktion.data;
      const fehlerhaft =
        normTxt(ist.lieferscheinnummer) !== normTxt(soll.lieferscheinnummer) ||
        normTxt(ist.referenznummer) !== normTxt(soll.referenznummer) ||
        normTxt(ist.lieferdatum) !== normTxt(soll.lieferdatum) ||
        (Array.isArray(ist.positionen) ? ist.positionen.length : 0) !== soll.positionen.length;
      triage.push(`${r.beleg}: ${status}${fehlerhaft ? '  ← hat einen Fehler' : ''}`);
    }
  }

  // ---------- 4. Betrieb ----------
  const gelaufen = run.filter((r) => r.extraktion);
  const seiten = gelaufen.reduce((s, r) => s + (r.seiten || 0), 0);
  const dauer = gelaufen.reduce((s, r) => s + r.dauerMs, 0);

  lines.push('# Ehinger-Pilot — Messung\n');
  lines.push(`Belege gelaufen: ${gelaufen.length}/${run.length} · Seiten gesamt: ${seiten}`);
  lines.push(`Laufzeit: ${(dauer / 1000 / 60).toFixed(1)} min gesamt, ${(dauer / gelaufen.length / 1000).toFixed(1)} s je Beleg, ${(dauer / Math.max(seiten,1) / 1000).toFixed(1)} s je Seite\n`);
  lines.push('## Klassifikation (alle Belege, Wahrheit per OCR)');
  lines.push(`Lieferant korrekt: **${pct(cls)}**`);
  clsFehler.forEach((f) => lines.push(`- ${f}`));
  lines.push('\n## Kopffelder (gelabelte Stichprobe)');
  lines.push(`- Lieferscheinnummer: **${pct(kopf.lieferscheinnummer)}**`);
  lines.push(`- Referenznummer: **${pct(kopf.referenznummer)}**`);
  lines.push(`- Lieferdatum: **${pct(kopf.lieferdatum)}**`);
  lines.push('\n## Review-Triage (alle Belege)');
  lines.push(`- auto_ok: **${autoOk}**, zu pruefen: **${needsReview}**`);
  triage.forEach((x) => lines.push(`- ${x}`));
  lines.push('\n## Positionen (gelabelte Stichprobe)');
  lines.push(`- Positionsanzahl exakt: **${pct(posCount)}**`);
  lines.push(`- Positionen wiedergefunden (Recall): **${pct(gefunden)}**`);
  lines.push(`- Erfundene Positionen: **${erfunden.length}**`);
  lines.push(`- Menge bestellt: **${pct(posFelder.menge_bestellt)}**`);
  lines.push(`- Menge geliefert: **${pct(posFelder.menge_geliefert)}**`);
  lines.push(`- Einheit (nach Katalog-Angleichung): **${pct(posFelder.einheit)}**`);
  if (detail.length) { lines.push('\n## Abweichungen im Detail'); detail.forEach((d) => lines.push(`- ${d}`)); }
  if (erfunden.length) erfunden.forEach((d) => lines.push(`- ${d}`));

  const out = lines.join('\n');
  console.log(out);
  await writeFile(resolve(DIR, 'results/messung.md'), out + '\n', 'utf-8');
  process.exit(0);
}

void main();
