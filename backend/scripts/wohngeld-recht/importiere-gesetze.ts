/**
 * Importiert die amtlichen Fassungen von WoGG, WoGV und SGB I (§§ 60–67) von
 * gesetze-im-internet.de (Download „xml.zip" der jeweiligen Gesetzesseite) und schreibt
 * den Absatz-Korpus nach src/apps/wohngeld/recht/gesetze.generated.ts.
 *
 * Aufruf im backend/-Ordner (braucht `unzip`):
 *   bun run scripts/wohngeld-recht/importiere-gesetze.ts [--quelle <Ordner mit wogg.zip, wogv.zip, sgb_1.zip>]
 *
 * Danach: Diff prüfen (Wortlaut-Änderungen = Gesetzesänderungen), Tests laufen lassen, committen.
 * Spec: docs/wohngeld-gesetzes-nachschlagen-spec-2026-09-24.md
 */
import { $ } from 'bun';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseGesetzXml, type GesetzAbsatz, type GesetzQuelle, type ParseOptionen } from '../../src/apps/wohngeld/recht/gesetz-parser';

const GESETZE: ParseOptionen[] = [
  { schluessel: 'wogg', pfad: 'wogg' },
  { schluessel: 'wogv', pfad: 'wogv' },
  { schluessel: 'sgb1', pfad: 'sgb_1', abkuerzung: 'SGB I', nurParagraphen: ['60', '61', '62', '63', '64', '65', '65a', '66', '67'] },
];

const argv = process.argv.slice(2);
const quelleOrdner = argv.includes('--quelle') ? argv[argv.indexOf('--quelle') + 1] : undefined;
const tmp = await mkdtemp(join(tmpdir(), 'wg-gesetze-'));
const quellen: GesetzQuelle[] = [];
const absaetze: GesetzAbsatz[] = [];
try {
  for (const g of GESETZE) {
    let zip = quelleOrdner ? join(quelleOrdner, `${g.pfad}.zip`) : '';
    if (!zip) {
      zip = join(tmp, `${g.pfad}.zip`);
      const res = await fetch(`https://www.gesetze-im-internet.de/${g.pfad}/xml.zip`);
      if (!res.ok) throw new Error(`${g.pfad}: HTTP ${res.status}`);
      await Bun.write(zip, await res.arrayBuffer());
    }
    const muster = "*.xml";
    const xml = await $`unzip -p ${zip} ${muster}`.text();
    const r = parseGesetzXml(xml, g);
    quellen.push(r.quelle);
    absaetze.push(...r.absaetze);
    console.log(`${r.quelle.gesetz}: ${r.absaetze.length} Absätze · ${r.quelle.stand}`);
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

const ids = new Set<string>();
for (const a of absaetze) { if (ids.has(a.id)) throw new Error(`Doppelte ID ${a.id}`); ids.add(a.id); }

const ziel = join(import.meta.dir, '..', '..', 'src', 'apps', 'wohngeld', 'recht', 'gesetze.generated.ts');
await Bun.write(ziel, `/**
 * GENERIERT von scripts/wohngeld-recht/importiere-gesetze.ts — nicht von Hand ändern.
 * Amtlicher Wortlaut (gesetze-im-internet.de, gemeinfrei nach § 5 UrhG), zerlegt in Absätze.
 */
import type { GesetzAbsatz, GesetzQuelle } from './gesetz-parser';

export const GESETZ_QUELLEN: GesetzQuelle[] = ${JSON.stringify(quellen, null, 2)};

export const GESETZ_ABSAETZE: GesetzAbsatz[] = ${JSON.stringify(absaetze, null, 1)};
`);
console.log(`\n${absaetze.length} Absätze → ${ziel}`);
