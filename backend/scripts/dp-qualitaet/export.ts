/**
 * DP-Qualitaetssuite — Export aus einem DP-Profil (Spezifikation §6).
 *
 * Uebernimmt die Testbeispiele (mit Original) eines Profils als Faelle in den Korpus und
 * friert die aktuelle Profildefinition als `profil.json` ein. Annotation geschieht in der
 * Pruefoberflaeche (korrigieren → als Testbeispiel speichern), danach hier exportieren.
 *
 *   bun run scripts/dp-qualitaet/export.ts --profil <profil-id> --set <set-id> [--name "…"]
 *     [--split test|dev] [--auch-training] [--datenschutz intern|pseudonymisiert|anonymisiert|synthetisch]
 *     [--kritisch feld1,feld2] [--smoke id1,id2] [--wohngeld-golden <tools/wohngeld-golden>]
 *
 * Idempotent: vorhandene Faelle werden ueberschrieben, set.json bleibt (ausser --kritisch/--name).
 */

import { mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { getProject } from '../../src/extraction/learning/projects';
import { getExamples } from '../../src/extraction/learning/examples';
import { KORPUS, setPfad, sicher, type ErwartetSegment, type FallDef, type SetDef } from './lib/korpus';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const flag = (n: string) => argv.includes(`--${n}`);
const profilId = opt('profil');
const setId = opt('set');
if (!profilId || !setId) { console.error('--profil und --set erforderlich'); process.exit(2); }
const split = (opt('split') ?? 'test') as FallDef['split'];
const datenschutz = (opt('datenschutz') ?? 'intern') as NonNullable<FallDef['datenschutz']>;
const smoke = new Set(opt('smoke')?.split(',').map((s) => s.trim()) ?? []);
const wohngeldGolden = opt('wohngeld-golden');

/** Wohngeld-Golden: erwartete Abschnitte aus expected.json (Seitenbereiche + Abschnittstyp des Profils). */
async function wohngeldSegmente(dateiname: string): Promise<ErwartetSegment[] | undefined> {
  if (!wohngeldGolden) return undefined;
  const fall = /^(F\d{2})-/.exec(dateiname)?.[1];
  if (!fall) return undefined;
  const f = Bun.file(join(wohngeldGolden, 'expected', `${fall}.expected.json`));
  if (!(await f.exists())) return undefined;
  const { ART_ZU_ABSCHNITT } = await import('../wohngeld-golden/profilwahrheit');
  const exp = await f.json() as { dokumente: Array<{ seiteVon: number; seiteBis: number; art: string }> };
  return exp.dokumente
    .map((d) => ({ typ: ART_ZU_ABSCHNITT[d.art] ?? null, von: d.seiteVon, bis: d.seiteBis }))
    .filter((d): d is ErwartetSegment => !!d.typ);
}

async function main() {
  const profil = await getProject(profilId!);
  if (!profil) { console.error(`Profil „${profilId}" nicht gefunden`); process.exit(2); }
  const beispiele = (await getExamples(profilId!)).filter((e) => e.dataset?.original && (e.dataset.purpose === 'test' || flag('auch-training')));
  if (!beispiele.length) { console.error('Keine Beispiele mit Original (Testbeispiele in der Prüfoberfläche anlegen).'); process.exit(2); }

  const dir = setPfad(setId!);
  await mkdir(join(dir, 'faelle'), { recursive: true });
  const setDatei = Bun.file(join(dir, 'set.json'));
  const vorhanden = (await setDatei.exists()) ? await setDatei.json() as SetDef : null;
  const def: SetDef = {
    id: setId!, name: opt('name') ?? vorhanden?.name ?? profil.name, beschreibung: vorhanden?.beschreibung ?? `Export aus DP-Profil „${profil.name}"`,
    ...(opt('kritisch') ? { kritische_felder: opt('kritisch')!.split(',').map((s) => s.trim()) } : vorhanden?.kritische_felder ? { kritische_felder: vorhanden.kritische_felder } : {}),
    ...(vorhanden?.schwellen ? { schwellen: vorhanden.schwellen } : {}),
  };
  await Bun.write(join(dir, 'set.json'), JSON.stringify(def, null, 2));
  // Profildefinition einfrieren (ohne Lernzustand/Webhook — gemessen wird die Definition).
  const { learning: _l, webhook: _w, ...definition } = profil;
  await Bun.write(join(dir, 'profil.json'), JSON.stringify({ ...definition, learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: profil.learning.guideline_version } }, null, 2));

  const ids = new Set<string>();
  for (const e of beispiele) {
    const original = e.dataset!.original!;
    const stamm = sicher((e.source_filename ?? original.filename).replace(/\.[^.]+$/, ''));
    const id = ids.has(stamm) ? `${stamm}-${e.id.slice(-6)}` : stamm;
    ids.add(id);
    const fallDir = join(dir, 'faelle', id);
    await mkdir(fallDir, { recursive: true });
    await Bun.write(join(fallDir, `original${extname(original.filename) || '.pdf'}`), Buffer.from(original.base64, 'base64'));
    const gruppe = e.dataset?.group;
    const segmente = await wohngeldSegmente(e.source_filename ?? original.filename);
    const fall: FallDef = {
      id, split: e.dataset?.purpose === 'test' ? split : 'dev',
      ...(gruppe === 'scan' || gruppe === 'digital' ? { variante: gruppe } : {}),
      tags: [], datenschutz, quelle: `DP-Profil ${profilId}, Beispiel ${e.id}`,
      ...(gruppe ? { gruppe } : {}),
      ...(smoke.has(id) ? { smoke: true } : {}),
      erwartet: { daten: e.corrected_extraction, ...(segmente ? { segmente } : {}) },
    };
    await Bun.write(join(fallDir, 'fall.json'), JSON.stringify(fall, null, 2));
  }
  console.log(`${beispiele.length} Fälle → ${dir} (Profil eingefroren: ${profil.name}, Split ${split}, Korpus ${KORPUS})`);
}

await main();
process.exit(0);
