/**
 * L-VAR-Service — beschafft die Eingaben aus DB/Persistenz und ruft die
 * reine Assembly (`assembleLvar`).
 *
 *   · Variablen-Fundorte + Call-Graph: aus den in Phase 0 persistierten
 *     `el_variablen` / `el_prozess_items` (Koordinaten-Extraktion).
 *   · Namensmodul (alt→neu, Rolle) + CFG-Eingabe: am Prozess (Familie) hinterlegt
 *     (`data.lvarNamensmodul` / `data.lvarCfg`) — das ist der von der Projekt-
 *     Session geschriebene Teil (in Sebs Welt das `_..._namen.py`).
 *
 * Ohne hinterlegtes Namensmodul liefert der Service einen definierten Leer-Zustand
 * (kein Raten) — der Explorer zeigt dann nur das Inventar an.
 */
import { getProzess } from '../storage';
import { listVariablen, listProzessItems } from '../extract/persist';
import { assembleLvar, type LvarErgebnis } from './assemble';
import { sanitizeStand, type LvarStand } from './stand';
import type { NkNamensmodul } from './nk';
import type { CfgTarget, CfgExcel } from './cfg';

export interface LvarLeer { leer: true; grund: string; }
/** Berechnetes Ergebnis + überlagerter menschlicher Arbeitsstand (Sebs window.STAND). */
export type LvarAnsicht = LvarErgebnis & { stand: LvarStand; version: number };

export async function lvarFuerProzess(prozessId: string): Promise<LvarAnsicht | LvarLeer> {
  const prozess = await getProzess(prozessId);
  if (!prozess) return { leer: true, grund: 'Prozess nicht gefunden' };

  const data = prozess as unknown as { lvarNamensmodul?: NkNamensmodul; lvarCfg?: { targets: CfgTarget[]; excel: CfgExcel[] }; lvarStand?: unknown; namensraum?: string; familie?: string };
  const namensmodul = data.lvarNamensmodul;
  if (!namensmodul || !Array.isArray(namensmodul.map) || namensmodul.map.length === 0) {
    return { leer: true, grund: 'Kein Namensmodul hinterlegt — der Explorer zeigt nur das Variablen-Inventar (Reiter 1 Ist).' };
  }

  const [variablen, items] = await Promise.all([listVariablen(prozessId), listProzessItems(prozessId)]);
  const fundorte = variablen.map((v) => ({ name: v.name, p: v.p }));
  const callGraph = items.flatMap((it) => (it.aufrufe ?? []).map((nach) => ({ von: it.nr, nach })));

  const ergebnis = assembleLvar({
    namensraum: data.namensraum ?? namensmodul.namensraum,
    familie: data.familie ?? namensmodul.familie,
    namensmodul,
    fundorte,
    callGraph,
    cfg: data.lvarCfg,
  });

  // Menschlicher Arbeitsstand (abhaken/Feedback/Status) als Overlay + Version fürs Optimistic-Locking.
  return { ...ergebnis, stand: sanitizeStand(data.lvarStand), version: prozess.version ?? 1 };
}
