/**
 * Legt das Golden Dataset als Testbestand im DP-Profil „Wohngeld-Eingang" an:
 * je Fall die digitale und die Scan-PDF als Testbeispiel (Original + Wahrheit je
 * Abschnitt, Gruppe digital/scan). Danach misst die Eval der Document-Processing-
 * Oberfläche jede Profiländerung (Champion/Challenger). Idempotent.
 *
 * Aufruf im backend/-Ordner (Datenbank nötig):
 *   bun run scripts/wohngeld-golden/testbestand.ts [--faelle F01,F18] [--trocken] [--erneuern]
 *
 * --erneuern: vorhandene Golden-Testbeispiele (Gruppe digital/scan) der gewählten Fälle erst löschen
 *             und mit der aktuellen Wahrheit neu anlegen (nach Änderungen an Profilfeldern).
 */
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ladeProfil, WOHNGELD_PROFIL_ID } from '../../src/apps/wohngeld/dp-erkennung';
import { deleteExample, getExamples, saveExample } from '../../src/extraction/learning/examples';
import { profilWahrheit, type ErwartungFuerWahrheit, type FallFuerWahrheit } from './profilwahrheit';

const TOOLS = join(import.meta.dir, '..', '..', '..', 'tools', 'wohngeld-golden');
const argv = process.argv.slice(2);
const faelleFilter = argv.includes('--faelle') ? argv[argv.indexOf('--faelle') + 1]!.split(',') : null;
const trocken = argv.includes('--trocken');
const erneuern = argv.includes('--erneuern');

const { FAELLE } = (await import(join(TOOLS, 'src', 'faelle', 'index.ts'))) as { FAELLE: Array<FallFuerWahrheit & { id: string; titel: string }> };
const { profil, quelle } = await ladeProfil();
if (quelle !== 'datenbank' && !trocken) { console.error('Profil nicht in der Datenbank — Testbestand braucht die DP-Datenbank.'); process.exit(1); }
let vorhanden = trocken ? [] : await getExamples(WOHNGELD_PROFIL_ID);
if (erneuern && !trocken) {
  const zuLoeschen = vorhanden.filter((e) => e.dataset?.purpose === 'test'
    && /^F\d{2}-(digital|scan)\.pdf$/.test(e.source_filename ?? '')
    && (!faelleFilter || faelleFilter.includes((e.source_filename ?? '').slice(0, 3))));
  for (const e of zuLoeschen) await deleteExample(WOHNGELD_PROFIL_ID, e.id);
  console.log(`${zuLoeschen.length} Golden-Testbeispiele gelöscht (erneuern).`);
  vorhanden = await getExamples(WOHNGELD_PROFIL_ID);
}
const bekannteHashes = new Set(vorhanden.map((e) => e.dataset?.original?.sha256).filter(Boolean));

let angelegt = 0, uebersprungen = 0;
for (const fall of FAELLE.filter((f) => !faelleFilter || faelleFilter.includes(f.id))) {
  const erw = (await Bun.file(join(TOOLS, 'expected', `${fall.id}.expected.json`)).json()) as ErwartungFuerWahrheit;
  const wahrheit = profilWahrheit(fall, erw, profil);
  for (const variante of ['digital', 'scan'] as const) {
    const pfad = join(TOOLS, 'out', fall.id, `${fall.id}-${variante}.pdf`);
    if (!(await Bun.file(pfad).exists())) { console.warn(`⚠ ${pfad} fehlt`); continue; }
    const bytes = Buffer.from(await Bun.file(pfad).arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (bekannteHashes.has(sha256)) { uebersprungen++; continue; }
    if (trocken) { console.log(`${fall.id} ${variante}: ${Object.keys(wahrheit).join(', ')}`); continue; }
    await saveExample(WOHNGELD_PROFIL_ID, {
      source_filename: `${fall.id}-${variante}.pdf`,
      document_text: `Golden Dataset ${fall.id} (${variante}): ${fall.titel}`,
      initial_extraction: {},
      corrected_extraction: wahrheit,
      dataset: { purpose: 'test', group: variante, original: { base64: bytes.toString('base64'), filename: `${fall.id}-${variante}.pdf`, sha256 } },
    });
    angelegt++;
    console.log(`${fall.id} ${variante}: Testbeispiel angelegt`);
  }
}
console.log(`\n${angelegt} angelegt, ${uebersprungen} schon vorhanden. Eval in der Document-Processing-Oberfläche starten (Profil „Wohngeld-Eingang").`);
process.exit(0);
