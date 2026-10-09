/**
 * DP-Qualitaetssuite — Korpus-Format (Spezifikation docs/dp-qualitaetssuite-spec-2026-10-09.md §2).
 * Der Korpus liegt lokal ausserhalb des Repos (Kundendaten); Pfad ueber DP_KORPUS.
 */

import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ExtractionProject } from '../../../src/extraction/learning/types';
import type { Erwartung as VertragsErwartung } from '../../vertrag-pilot/vergleich';

export const KORPUS = process.env.DP_KORPUS ?? join(homedir(), 'Documents', 'Development', 'AgentWork', 'dp-qualitaet-korpus');

export interface Schwellen {
  /** Max. erlaubter Rueckgang in Prozentpunkten (zusaetzlich zum Rauschband). Standard 1. */
  rueckgang_pp?: number;
  /** Warnung ab relativem Anstieg von Tokens/Zeit je Seite. Standard 0.15. */
  kosten_anstieg?: number;
}

export interface SetDef {
  id: string;
  name: string;
  beschreibung?: string;
  /** Feldpfade (z. B. "betrag", "personalausweis.nachname"), die nie kippen duerfen. */
  kritische_felder?: string[];
  schwellen?: Schwellen;
}

export interface ErwartetSegment { typ: string; von: number; bis: number }

export interface FallDef {
  id: string;
  split: 'dev' | 'test';
  variante?: 'digital' | 'scan' | 'foto';
  tags?: string[];
  datenschutz?: 'synthetisch' | 'pseudonymisiert' | 'anonymisiert' | 'intern';
  quelle?: string;
  gruppe?: string;
  smoke?: boolean;
  erwartet: {
    /** Ergebnis im Profilformat (wie corrected_extraction); bewertet werden die vorhandenen Schluessel. */
    daten?: Record<string, unknown>;
    segmente?: ErwartetSegment[];
    vertrag?: VertragsErwartung;
  };
}

export interface GeladenerFall extends FallDef { verzeichnis: string; original: string }
export interface GeladenesSet { def: SetDef; profil: ExtractionProject; verzeichnis: string; faelle: GeladenerFall[] }

export const setPfad = (id: string) => join(KORPUS, 'sets', id);

export async function ladeSet(id: string): Promise<GeladenesSet> {
  const verzeichnis = setPfad(id);
  const def = await Bun.file(join(verzeichnis, 'set.json')).json() as SetDef;
  const profil = await Bun.file(join(verzeichnis, 'profil.json')).json() as ExtractionProject;
  const faelle: GeladenerFall[] = [];
  const fallVerz = join(verzeichnis, 'faelle');
  for (const name of (await readdir(fallVerz).catch(() => [] as string[])).sort()) {
    const dir = join(fallVerz, name);
    const f = Bun.file(join(dir, 'fall.json'));
    if (!(await f.exists())) continue;
    const fall = await f.json() as FallDef;
    const original = (await readdir(dir)).find((d) => d.startsWith('original.'));
    if (!original) continue;
    faelle.push({ ...fall, verzeichnis: dir, original: join(dir, original) });
  }
  return { def, profil, verzeichnis, faelle };
}

export async function alleSetIds(): Promise<string[]> {
  return (await readdir(join(KORPUS, 'sets')).catch(() => [] as string[])).sort();
}

/** Sichere Verzeichnis-/Dateinamen fuer Fall-IDs. */
export const sicher = (s: string) => s.replace(/[^\w.\-]+/g, '_').slice(0, 80);
