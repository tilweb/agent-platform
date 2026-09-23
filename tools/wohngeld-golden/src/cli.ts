/**
 * Golden-Dataset-Generator.
 *
 *   bun run src/cli.ts              # alle registrierten Fälle
 *   bun run src/cli.ts F01 F18      # ausgewählte Fälle
 *   bun run src/cli.ts --ohne-scan  # nur digitale Variante (schneller)
 *
 * Ausgabe: out/<Fall>/<Fall>-digital.pdf, out/<Fall>/<Fall>-scan.pdf (nicht eingecheckt)
 *          expected/<Fall>.expected.json (eingecheckt)
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { FAELLE } from './faelle';
import { baueErwartung } from './erwartung';
import { OUT, ROOT } from './lib';
import { scanne } from './scan';
import { setzeZusammen } from './zusammensetzen';

const args = process.argv.slice(2);
const ohneScan = args.includes('--ohne-scan');
const ids = args.filter((a) => !a.startsWith('--'));
const auswahl = ids.length ? FAELLE.filter((f) => ids.includes(f.id)) : FAELLE;
if (ids.length && auswahl.length !== ids.length) {
  const fehlt = ids.filter((i) => !FAELLE.some((f) => f.id === i));
  console.error(`Unbekannte Fälle: ${fehlt.join(', ')}`);
  process.exit(1);
}

await mkdir(join(ROOT, 'expected'), { recursive: true });
for (const fall of auswahl) {
  const t0 = performance.now();
  const dir = join(OUT, fall.id);
  await mkdir(dir, { recursive: true });
  const { pdf, dokumente } = await setzeZusammen(fall);
  await Bun.write(join(dir, `${fall.id}-digital.pdf`), pdf);
  const seiten = dokumente.at(-1)?.seiteBis ?? 0;
  if (!ohneScan) await Bun.write(join(dir, `${fall.id}-scan.pdf`), await scanne(pdf, fall.id));
  const erwartung = baueErwartung(fall, dokumente, seiten);
  await Bun.write(join(ROOT, 'expected', `${fall.id}.expected.json`), `${JSON.stringify(erwartung, null, 2)}\n`);
  const s = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`${fall.id}  ${String(seiten).padStart(3)} S.  ${String(dokumente.length).padStart(2)} Dok.  ${s}s  ${fall.titel}`);
}
