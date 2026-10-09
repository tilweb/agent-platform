/**
 * DP-Qualitaetssuite — Lauf (Spezifikation docs/dp-qualitaetssuite-spec-2026-10-09.md §3).
 *
 * Wertet die Faelle des lokalen Korpus ueber den echten Produktionspfad `extract()` mit
 * eingefrorenem Profil aus, bewertet sie, vergleicht mit der Baseline und schreibt einen
 * Bericht. Exit-Code 1 bei harter Abweichung (Schwelle vor Kunden-Deploys).
 *
 * Aufruf (im backend/, PATH mit poppler):
 *   bun run scripts/dp-qualitaet/lauf.ts                          # alle Sets, alle Faelle
 *   bun run scripts/dp-qualitaet/lauf.ts --umfang smoke            # Smoke (smoke:true bzw. erste 3 je Set)
 *   bun run scripts/dp-qualitaet/lauf.ts --sets vertraege --split test
 *   bun run scripts/dp-qualitaet/lauf.ts --als-baseline --wiederholungen 3   # Baseline + Rauschband festschreiben
 * Optionen: --faelle id1,id2 · --parallel n (Standard 3) · Korpus-Pfad ueber DP_KORPUS.
 */

import { mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { extract, captureSnapshot } from '../../src/extraction/learning/service';
import { extractionModelLabel } from '../../src/extraction/model';
import { parallelBegrenzt } from '../../src/services/extraction/contract/modell';
import { alleSetIds, KORPUS, ladeSet, sicher, type GeladenerFall, type GeladenesSet } from './lib/korpus';
import { aggregiere, bewerteFall, type FallBewertung, type FallErgebnis, type SetMetriken } from './lib/bewertung';
import { beurteile, berichtMarkdown, kritischRichtigJeFall, rauschbandAus, type Baseline } from './lib/bericht';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (n: string) => argv.includes(`--${n}`);
const setFilter = opt('sets')?.split(',').map((s) => s.trim());
const fallFilter = opt('faelle')?.split(',').map((s) => s.trim());
const umfang = opt('umfang') === 'smoke' ? 'smoke' : 'voll';
const split = (opt('split') ?? 'alle') as 'dev' | 'test' | 'alle';
const parallel = Number(opt('parallel') ?? 3);
const alsBaseline = flag('als-baseline');
const wiederholungen = alsBaseline ? Math.max(1, Number(opt('wiederholungen') ?? 1)) : 1;

const git = (args: string[]) => Bun.spawnSync(['git', ...args], { cwd: import.meta.dir }).stdout.toString().trim();
const commit = `${git(['rev-parse', '--short', 'HEAD'])}${git(['status', '--porcelain', '--', '../../src']) ? '+lokal' : ''}`;
const modell = extractionModelLabel();
const laufId = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}_${commit}`;
const laufDir = join(KORPUS, 'laeufe', laufId);

function auswahl(set: GeladenesSet): GeladenerFall[] {
  let f = set.faelle.filter((x) => split === 'alle' || x.split === split);
  if (fallFilter) f = f.filter((x) => fallFilter.includes(x.id));
  if (umfang === 'smoke') {
    const markiert = f.filter((x) => x.smoke);
    f = markiert.length ? markiert : f.slice(0, 3);
  }
  return f;
}

async function werteAus(set: GeladenesSet, faelle: GeladenerFall[], wdh: number): Promise<FallBewertung[]> {
  const snapshot = await captureSnapshot(set.profil, []);
  const sicherAb = set.profil.extraction?.review_threshold ?? set.profil.extraction?.confidence_threshold ?? 0.8;
  const zielDir = join(laufDir, 'ergebnisse', sicher(set.def.id));
  await mkdir(zielDir, { recursive: true });
  return parallelBegrenzt(faelle, parallel, async (fall) => {
    const t0 = performance.now();
    let e: FallErgebnis;
    try {
      const r = await extract(set.profil.id, { type: 'file', path: fall.original, filename: basename(fall.original) }, 'dp-qualitaet', snapshot);
      e = {
        success: r.success, error: r.error, data: r.data ?? {}, fieldConfidences: r.fieldConfidences,
        segments: r.segments, vertrag: r.vertrag,
        seiten: r.pageImages?.length || r.segments?.reduce((m, s) => Math.max(m, s.pageTo), 0) || 1,
        sekunden: (performance.now() - t0) / 1000,
        verbrauch: r.audit?.verbrauch,
        verarbeitungsfehler: (r.validations ?? []).filter((v) => v.type === 'processing' && v.severity === 'error').map((v) => v.message),
      };
      await Bun.write(join(zielDir, `${sicher(fall.id)}${wdh > 1 ? `.${wdh}` : ''}.json`), JSON.stringify({
        fall: fall.id, strategy: r.strategyUsed, data: r.data, fieldConfidences: r.fieldConfidences, segments: r.segments,
        validations: r.validations, vertrag: r.vertrag, audit: r.audit, error: r.error,
      }, null, 2));
    } catch (err) {
      e = { success: false, error: err instanceof Error ? err.message : String(err), data: {}, seiten: 1, sekunden: (performance.now() - t0) / 1000 };
    }
    const b = bewerteFall(set.profil, fall, e, { kritische: set.def.kritische_felder ?? [], sicherAb });
    process.stdout.write(b.fehler ? 'x' : b.felder.every((f) => f.ok) && (b.vertrag ?? []).every((p) => p.ok) ? '.' : '~');
    return b;
  });
}

async function main() {
  const ids = (await alleSetIds()).filter((id) => !setFilter || setFilter.includes(id));
  if (!ids.length) { console.error(`Keine Sets unter ${KORPUS}/sets${setFilter ? ` (Filter ${setFilter.join(',')})` : ''}.`); process.exit(2); }
  const baselineDatei = Bun.file(join(KORPUS, 'baseline.json'));
  const baseline: Baseline | null = (await baselineDatei.exists()) ? await baselineDatei.json() : null;
  console.log(`DP-Qualitätssuite · Lauf ${laufId} · Modell ${modell} · ${umfang} · Split ${split} · ${wiederholungen}× · Korpus ${KORPUS}`);

  const ergebnisse: Array<{ id: string; name: string; metriken: SetMetriken; bewertungen: FallBewertung[]; urteil: ReturnType<typeof beurteile>; basis?: Baseline['sets'][string]; rauschband?: Record<string, number> }> = [];
  for (const id of ids) {
    const set = await ladeSet(id);
    const faelle = auswahl(set);
    if (!faelle.length) { console.log(`\n${id}: keine Fälle in Auswahl`); continue; }
    process.stdout.write(`\n${id} (${faelle.length} Fälle) `);
    const laeufe: Array<{ bewertungen: FallBewertung[]; metriken: SetMetriken }> = [];
    for (let w = 1; w <= wiederholungen; w++) {
      const bewertungen = await werteAus(set, faelle, w);
      laeufe.push({ bewertungen, metriken: aggregiere(bewertungen) });
      if (w < wiederholungen) process.stdout.write(' | ');
    }
    const { bewertungen, metriken } = laeufe[0]!;
    // Rauschband nur aus ausfallfreien Wiederholungen — ein Endpunkt-Ausfall ist kein Modellrauschen.
    const sauber = laeufe.filter((l) => l.metriken.ausfaelle === 0);
    if (wiederholungen > 1 && sauber.length < laeufe.length) {
      console.warn(`\n${id}: ${laeufe.length - sauber.length} von ${laeufe.length} Wiederholungen mit Ausfällen (${laeufe.map((l) => l.metriken.ausfaelle).join('/')}) — fürs Rauschband verworfen`);
    }
    const basis = baseline?.sets[id];
    const urteil = beurteile(id, metriken, bewertungen, alsBaseline ? undefined : basis, set.def.schwellen);
    ergebnisse.push({ id, name: set.def.name, metriken, bewertungen, urteil, basis: alsBaseline ? undefined : basis, ...(sauber.length > 1 ? { rauschband: rauschbandAus(sauber.map((l) => l.metriken)) } : {}) });
  }
  process.stdout.write('\n\n');

  const bericht = berichtMarkdown({ lauf: laufId, commit, modell, umfang, split }, ergebnisse);
  await mkdir(laufDir, { recursive: true });
  await Bun.write(join(laufDir, 'bericht.md'), bericht);
  await Bun.write(join(laufDir, 'metriken.json'), JSON.stringify(Object.fromEntries(ergebnisse.map((e) => [e.id, { metriken: e.metriken, urteil: e.urteil, bewertungen: e.bewertungen }])), null, 2));
  await Bun.write(join(laufDir, 'lauf.json'), JSON.stringify({ lauf: laufId, commit, modell, umfang, split, wiederholungen, sets: ids }, null, 2));
  console.log(bericht);

  if (alsBaseline) {
    if (umfang !== 'voll' || split !== 'alle' || fallFilter) console.warn('Hinweis: Baseline aus Teilauswahl — für die Deploy-Schwelle besser „voll" über alle Fälle.');
    const neu: Baseline = { erstellt: new Date().toISOString(), lauf: laufId, commit, modell, sets: { ...(baseline?.sets ?? {}) } };
    for (const e of ergebnisse) {
      if (e.metriken.ausfaelle > 0) { console.warn(`${e.id}: ${e.metriken.ausfaelle} Ausfall/Ausfälle — Baseline dieses Sets NICHT übernommen (Lauf wiederholen)`); continue; }
      neu.sets[e.id] = { metriken: e.metriken, rauschband: e.rauschband ?? baseline?.sets[e.id]?.rauschband ?? {}, kritischRichtig: kritischRichtigJeFall(e.bewertungen) };
    }
    await Bun.write(join(KORPUS, 'baseline.json'), JSON.stringify(neu, null, 2));
    console.log(`Baseline geschrieben: ${join(KORPUS, 'baseline.json')}`);
  }
  console.log(`Bericht: ${join(laufDir, 'bericht.md')}`);
  const hart = ergebnisse.some((e) => e.urteil.harte.length);
  process.exit(hart && !alsBaseline ? 1 : 0);
}

if (import.meta.main) await main();
