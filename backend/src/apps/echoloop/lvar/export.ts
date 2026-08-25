/**
 * L-VAR-Export (Ziel 2) — Brücke aus der Kunden-Workplace zurück in Sebs lokales
 * F&E-Umfeld. Erzeugt EINE JSON-Datei, die Sebs lokale Engine ohne Nacharbeit
 * einlesen kann (Format an `_varliste_..._daten.json` angelehnt) plus den
 * Kunden-Arbeitsstand (`window.STAND`) und unsere Berechnung zum Vergleich.
 *
 * ERSTE FASSUNG — das genaue Schema wird mit Seb final abgestimmt. Rein &
 * deterministisch: `buildLvarExport` ist über seine Eingaben testbar.
 */
import { getProzess } from '../storage';
import { listVariablen, listProzessItems, latestExtractBaustand } from '../extract/persist';
import { assembleLvar, type LvarErgebnis } from './assemble';
import { sanitizeStand, type LvarStand } from './stand';
import type { Variable, ProzessItem } from '../types';
import type { NkNamensmodul } from './nk';
import type { CfgTarget, CfgExcel } from './cfg';

export const LVAR_EXPORT_SCHEMA = 'echoloop-lvar-export/v1';

export interface LvarExport {
  _meta: { schema: string; quelle: string; exportiertAm: string; kunde?: string; kd?: string; familie?: string };
  /** Extraktions-Daten im Engine-Format (prozesse + variablen) — Sebs Ingest. */
  daten: {
    prozesse: Record<string, { name_export?: string; prozess_stand?: string; druck_stand?: string; aufrufe?: string[]; cvrefs?: unknown[]; ausgaenge?: unknown }>;
    variablen: { p: string; id: string; name: string; typ?: string; init: string; schnitt?: string; pos?: number; fund?: unknown[] }[];
  };
  /** Namens-Modul (alt→neu, Rolle) — Sebs `_..._namen.py` als Daten. */
  namensmodul?: NkNamensmodul;
  /** CFG-Eingabe (Ziele + Excel), falls hinterlegt. */
  cfg?: { targets: CfgTarget[]; excel: CfgExcel[] };
  /** Kunden-Arbeitsstand: Status/Feedback/Vorabhaken/Entscheidungen (window.STAND). */
  stand: LvarStand;
  /** Unsere Berechnung (zum Vergleich mit Sebs lokalem Lauf). */
  analyse: LvarErgebnis;
}

export interface LvarExportInput {
  exportiertAm: string;
  kunde?: string; kd?: string; familie?: string;
  variablen: Variable[];
  items: ProzessItem[];
  namensmodul?: NkNamensmodul;
  cfg?: { targets: CfgTarget[]; excel: CfgExcel[] };
  stand: LvarStand;
  analyse: LvarErgebnis;
}

/** Baut das Export-Objekt aus den geladenen Eingaben (rein). */
export function buildLvarExport(input: LvarExportInput): LvarExport {
  const prozesse: LvarExport['daten']['prozesse'] = {};
  for (const it of input.items) {
    prozesse[it.nr] = {
      name_export: it.nameExport,
      prozess_stand: it.prozessStand,
      druck_stand: it.druckStand,
      aufrufe: it.aufrufe,
      cvrefs: it.cvrefs,
      ausgaenge: it.ausgaenge,
    };
  }
  const variablen = input.variablen.map((v) => ({
    p: v.p, id: v.varId, name: v.name, typ: v.typ, init: v.init ?? '', schnitt: v.schnitt, pos: v.pos, fund: v.fund,
  }));

  return {
    _meta: { schema: LVAR_EXPORT_SCHEMA, quelle: 'Workplace Echo-Loop', exportiertAm: input.exportiertAm, kunde: input.kunde, kd: input.kd, familie: input.familie },
    daten: { prozesse, variablen },
    namensmodul: input.namensmodul,
    cfg: input.cfg,
    stand: input.stand,
    analyse: input.analyse,
  };
}

/** Lädt alles zum Prozess und baut den Export (null wenn kein Namensmodul → nichts zu exportieren). */
export async function lvarExportFuerProzess(prozessId: string): Promise<LvarExport | null> {
  const prozess = await getProzess(prozessId);
  if (!prozess) return null;
  const data = prozess as unknown as {
    lvarNamensmodul?: NkNamensmodul; lvarCfg?: { targets: CfgTarget[]; excel: CfgExcel[] };
    lvarStand?: unknown; namensraum?: string; familie?: string; name?: string;
  };
  const namensmodul = data.lvarNamensmodul;
  if (!namensmodul || !Array.isArray(namensmodul.map) || namensmodul.map.length === 0) return null;

  const baustandId = await latestExtractBaustand(prozessId);
  const [variablen, items] = await Promise.all([listVariablen(prozessId, baustandId), listProzessItems(prozessId, baustandId)]);
  const fundorte = variablen.map((v) => ({ name: v.name, p: v.p }));
  const callGraph = items.flatMap((it) => (it.aufrufe ?? []).map((nach) => ({ von: it.nr, nach })));
  const analyse = assembleLvar({
    namensraum: data.namensraum ?? namensmodul.namensraum,
    familie: data.familie ?? namensmodul.familie,
    namensmodul, fundorte, callGraph, cfg: data.lvarCfg,
  });

  return buildLvarExport({
    exportiertAm: new Date().toISOString(),
    kd: namensmodul.kd, familie: data.familie ?? namensmodul.familie,
    variablen, items, namensmodul, cfg: data.lvarCfg,
    stand: sanitizeStand(data.lvarStand), analyse,
  });
}
