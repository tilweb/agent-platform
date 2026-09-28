/**
 * Grundsicherung-Golden — Generator.
 *
 * Erzeugt je Goldfall (faelle.ts) eine born-digital Sammel-PDF (Antrag + Nachweise, jedes
 * Dokument mit eigener Kopfzeile/Seitenzählung) und `expected.json`:
 *  - Abschnitte (Typ, Seitenbereich, Beschreibung),
 *  - Kernfelder je Abschnitt (von Hand erwartet) und die vollständigen Soll-Werte
 *    (ideale Profil-Rohwerte → App-Mapping `mappeAbschnitt`),
 *  - Befunde: laut Spec und aus den Soll-Werten (Posteingang-Nachbau + Regel-Engine).
 *
 * Aufruf im backend/-Ordner:  bun run scripts/grundsicherung-golden/erzeuge.ts
 * Ausgabe: tools/output/grundsicherung-golden/<Fall>/ (nicht eingecheckt). Braucht poppler
 * (`pdfinfo`, `pdfunite`). Alle Daten synthetisch, jede Seite trägt „MUSTER".
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';
import { mappeAbschnitt } from '../../src/apps/grundsicherung/dp-erkennung';
import { renderDokument } from './bausteine';
import { alleFaelle } from './faelle';
import { befundeFuer, gleich, holePfad, type AbschnittKurz } from './vergleich';

export const AUSGABE = join(import.meta.dir, '..', '..', '..', 'tools', 'output', 'grundsicherung-golden');

export interface ErwartetDokument {
  nr: number; typ: string; art: string; titel: string; seiteVon: number; seiteBis: number;
  kern: Record<string, unknown>;
  roh: Record<string, unknown>;
  soll: AbschnittKurz;
}
export interface Erwartung {
  fall: string; titel: string; beschreibung: string; pdf: string; seiten: number;
  dokumente: ErwartetDokument[];
  befunde: { spec: string[]; soll: string[] };
  hinweise: string[];
}

async function seitenzahl(pfad: string): Promise<number> {
  const info = await $`pdfinfo ${pfad}`.text();
  return Number(info.match(/Pages:\s+(\d+)/)?.[1] ?? 0);
}

if (import.meta.main) {
  const filter = process.argv.slice(2).map((s) => s.toUpperCase());
  for (const fall of alleFaelle().filter((f) => !filter.length || filter.includes(f.id))) {
    const dir = join(AUSGABE, fall.id);
    await mkdir(dir, { recursive: true });
    const tmp = await mkdtemp(join(tmpdir(), 'gs-golden-'));
    const hinweise: string[] = [];
    try {
      const teile: string[] = [];
      const dokumente: ErwartetDokument[] = [];
      let seite = 1;
      for (const [i, d] of fall.dokumente.entries()) {
        const v = d.vorlage;
        const pfad = join(tmp, `${String(i + 1).padStart(2, '0')}.pdf`);
        await Bun.write(pfad, await renderDokument(v.inhalt, v.rahmen, v.titel));
        const n = await seitenzahl(pfad);
        teile.push(pfad);
        const m = mappeAbschnitt(v.typ, v.roh);
        const soll: AbschnittKurz = { typ: m.typ, analyse: m.analyse, ...(m.stammdaten ? { stammdaten: m.stammdaten } : {}), ...(m.identitaet ? { identitaet: m.identitaet } : {}) };
        for (const [p, w] of Object.entries(d.kern)) {
          const ist = holePfad(soll, p);
          if (!gleich(w, ist)) hinweise.push(`Dokument ${i + 1} (${v.typ}): Kernfeld ${p} erwartet ${JSON.stringify(w)}, Soll-Mapping liefert ${JSON.stringify(ist)}`);
        }
        dokumente.push({ nr: i + 1, typ: v.typ, art: v.art, titel: v.titel, seiteVon: seite, seiteBis: seite + n - 1, kern: d.kern, roh: v.roh, soll });
        seite += n;
      }
      const pdf = join(dir, `${fall.id}.pdf`);
      await $`pdfunite ${teile} ${pdf}`.quiet();
      const seiten = await seitenzahl(pdf);
      const soll = befundeFuer(dokumente.map((d) => d.soll));
      for (const id of fall.befundeSpec) if (!soll.includes(id)) hinweise.push(`Spec-Befund ${id} entsteht aus den Soll-Werten NICHT`);
      const erwartung: Erwartung = {
        fall: fall.id, titel: fall.titel, beschreibung: fall.beschreibung, pdf: `${fall.id}.pdf`, seiten, dokumente,
        befunde: { spec: fall.befundeSpec, soll }, hinweise,
      };
      await Bun.write(join(dir, 'expected.json'), JSON.stringify(erwartung, null, 2));
      console.log(`${fall.id}: ${seiten} Seiten, ${dokumente.length} Dokumente — ${dokumente.map((d) => `${d.typ} ${d.seiteVon}-${d.seiteBis}`).join(', ')}`);
      console.log(`      Soll-Befunde: ${soll.join(', ')}`);
      for (const h of hinweise) console.warn(`      ⚠ ${h}`);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }
}
