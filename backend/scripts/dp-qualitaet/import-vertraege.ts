/**
 * DP-Qualitaetssuite — Uebernahme der 10 END-Vertraege (Vertrags-Pilot) als Set „vertraege".
 *
 * Erwartungswerte aus tools/vertrag-golden/erwartet (lokal), Originale aus dem Vertragsordner.
 * Alle Faelle `dev`: an ihnen wurde nachgeschaerft — ein unabhaengiger Testbestand kommt aus
 * neu annotierten Vertraegen. Profil: eingefrorene Definition des DP-Profils (Standard
 * end-ladeinfrastruktur-vertraege).
 *
 *   bun run scripts/dp-qualitaet/import-vertraege.ts [--ordner <pfad>] [--profil <id>]
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, join } from 'node:path';
import { getProject } from '../../src/extraction/learning/projects';
import { setPfad, type FallDef, type SetDef } from './lib/korpus';
import type { Erwartung } from '../vertrag-pilot/vergleich';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const ordner = opt('ordner') ?? join(homedir(), 'Downloads', 'Vertragsbeispiele-Ehinger-END');
const profilId = opt('profil') ?? 'end-ladeinfrastruktur-vertraege';
const GOLDEN = join(import.meta.dir, '..', '..', '..', 'tools', 'vertrag-golden', 'erwartet');

const profil = await getProject(profilId);
if (!profil) { console.error(`Profil „${profilId}" nicht gefunden`); process.exit(2); }
const zuordnung = await Bun.file(join(GOLDEN, 'zuordnung.json')).json() as Record<string, string>;
const dir = setPfad('vertraege');
await mkdir(join(dir, 'faelle'), { recursive: true });
const def: SetDef = {
  id: 'vertraege', name: 'Verträge (END, Ladeinfrastruktur)',
  beschreibung: '10 echte Verträge (Wartung, Betrieb, Rahmen, Endkunde), überwiegend Scans. Alle dev — Grundlage der Nachschärfung 2026-10-08.',
};
await Bun.write(join(dir, 'set.json'), JSON.stringify(def, null, 2));
const { learning: _l, webhook: _w, ...definition } = profil;
await Bun.write(join(dir, 'profil.json'), JSON.stringify({ ...definition, learning: { total_examples: 0, accuracy_estimate: 0, guideline_version: profil.learning.guideline_version } }, null, 2));

const SMOKE = new Set(['V1', 'V3', 'V8']);
for (const [id, datei] of Object.entries(zuordnung)) {
  const erwartung = await Bun.file(join(GOLDEN, `${id}.json`)).json() as Erwartung;
  const fallDir = join(dir, 'faelle', id);
  await mkdir(fallDir, { recursive: true });
  await copyFile(join(ordner, datei), join(fallDir, `original${extname(datei) || '.pdf'}`));
  const fall: FallDef = {
    id, split: 'dev', tags: ['vertrag'], datenschutz: 'intern', quelle: 'Vertragsbeispiele END (freigegeben)',
    ...(SMOKE.has(id) ? { smoke: true } : {}),
    erwartet: { vertrag: erwartung },
  };
  await Bun.write(join(fallDir, 'fall.json'), JSON.stringify(fall, null, 2));
}
console.log(`${Object.keys(zuordnung).length} Verträge → ${dir}`);
process.exit(0);
