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
import { listVariablen, listProzessItems, latestExtractBaustand } from '../extract/persist';
import { assembleLvar, type LvarErgebnis } from './assemble';
import { sanitizeStand, type LvarStand } from './stand';
import type { NkNamensmodul } from './nk';
import type { CfgTarget, CfgExcel } from './cfg';

/** Eine Ist-Variable aus dem Upload (vor jeder Namens-Entscheidung). */
export interface LvarInventarZeile { name: string; p: string; typ?: string; schnitt?: string; varId: string; }
/** Roh-Inventar der gezeigten Datenversion — Basis, gegen die die NK abgeglichen wird. */
export interface LvarInventar {
  variablen: LvarInventarZeile[];
  prozesse: { nr: string; nameExport?: string }[];
  datenstand?: string;   // baustandId der gezeigten Datenversion (undefined = noch kein Upload extrahiert)
}
export interface LvarLeer { leer: true; grund: string; inventar: LvarInventar; }
/** Berechnetes Ergebnis + überlagerter menschlicher Arbeitsstand (Sebs window.STAND). */
export type LvarAnsicht = LvarErgebnis & { stand: LvarStand; version: number };

export async function lvarFuerProzess(prozessId: string): Promise<LvarAnsicht | LvarLeer> {
  const leer = (grund: string, inventar: LvarInventar): LvarLeer => ({ leer: true, grund, inventar });
  const prozess = await getProzess(prozessId);
  if (!prozess) return leer('Prozess nicht gefunden', { variablen: [], prozesse: [] });

  const data = prozess as unknown as { lvarNamensmodul?: NkNamensmodul; lvarCfg?: { targets: CfgTarget[]; excel: CfgExcel[] }; lvarStand?: unknown; namensraum?: string; familie?: string };

  // Datenbasis: neueste Datenversion (Upload/Baustand) — RGA und L-VAR teilen dieselbe Quelle.
  const baustandId = await latestExtractBaustand(prozessId);
  const [variablen, items] = await Promise.all([
    listVariablen(prozessId, baustandId),
    listProzessItems(prozessId, baustandId),
  ]);
  const fundorte = variablen.map((v) => ({ name: v.name, p: v.p }));
  const callGraph = items.flatMap((it) => (it.aufrufe ?? []).map((nach) => ({ von: it.nr, nach })));
  const inventar: LvarInventar = {
    variablen: variablen.map((v) => ({ name: v.name, p: v.p, typ: v.typ, schnitt: v.schnitt, varId: v.varId })),
    prozesse: items.map((it) => ({ nr: it.nr, nameExport: it.nameExport })),
    datenstand: baustandId,
  };

  const namensmodul = data.lvarNamensmodul;
  if (!namensmodul || !Array.isArray(namensmodul.map) || namensmodul.map.length === 0) {
    const grund = inventar.variablen.length
      ? 'Noch keine Namens-Entscheidungen — der Explorer zeigt das Ist-Variablen-Inventar aus dem Upload (Reiter 1).'
      : 'Noch keine Daten — lade EMMA-Exporte über „Analyse starten" hoch; RGA und L-VAR nutzen dieselbe Datenbasis.';
    return leer(grund, inventar);
  }

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
