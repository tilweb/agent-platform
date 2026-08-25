/**
 * L-VAR-Export (Ziel 2) — Brücke aus der Kunden-Workplace zurück in Sebs lokales
 * F&E-Umfeld. Erzeugt EINE JSON-Datei, die Sebs lokale Engine ohne Nacharbeit
 * einlesen kann (Format an `_varliste_..._daten.json` angelehnt) plus das in-App
 * erarbeitete Namensmodul (Vorschlag ⊕ Kunden-Entscheid), die Kunden-NK-Config,
 * den Arbeitsstand (`window.STAND`) und unsere Berechnung zum Vergleich.
 *
 * Nutzt `ladeLvarKern` — exportiert damit EXAKT dasselbe Modul, das der Explorer
 * zeigt (kein separater Ableitungspfad). ERSTE FASSUNG — Schema final mit Seb.
 * Rein & deterministisch: `buildLvarExport` ist über seine Eingaben testbar.
 */
import { ladeLvarKern } from './service';
import type { LvarErgebnis } from './assemble';
import type { LvarStand } from './stand';
import type { Variable, ProzessItem } from '../types';
import type { NkNamensmodul } from './nk';
import type { NkConfig } from './nkconfig';
import type { CfgTarget, CfgExcel } from './cfg';

export const LVAR_EXPORT_SCHEMA = 'echoloop-lvar-export/v1';

export interface LvarExport {
  _meta: { schema: string; quelle: string; exportiertAm: string; kunde?: string; kd?: string; familie?: string; datenstand?: string; vorschlagsBasis?: boolean };
  /** Extraktions-Daten im Engine-Format (prozesse + variablen) — Sebs Ingest. */
  daten: {
    prozesse: Record<string, { name_export?: string; prozess_stand?: string; druck_stand?: string; aufrufe?: string[]; cvrefs?: unknown[]; ausgaenge?: unknown }>;
    variablen: { p: string; id: string; name: string; typ?: string; init: string; schnitt?: string; pos?: number; fund?: unknown[] }[];
  };
  /** Namens-Modul (alt→neu, Rolle) — in der App erarbeitet (Vorschlag ⊕ Entscheid). */
  namensmodul?: NkNamensmodul;
  /** Additive Kunden-NK-Anpassung (der Kanon-Standard liegt lokal bei Seb). */
  nkConfig?: NkConfig;
  /** CFG-Eingabe (Ziele + Excel), falls hinterlegt. */
  cfg?: { targets: CfgTarget[]; excel: CfgExcel[] };
  /** Kunden-Arbeitsstand: Status/Feedback/Vorabhaken/Entscheidungen (window.STAND). */
  stand: LvarStand;
  /** Unsere Berechnung (zum Vergleich mit Sebs lokalem Lauf). */
  analyse: LvarErgebnis;
}

export interface LvarExportInput {
  exportiertAm: string;
  kunde?: string; kd?: string; familie?: string; datenstand?: string; vorschlagsBasis?: boolean;
  variablen: Variable[];
  items: ProzessItem[];
  namensmodul?: NkNamensmodul;
  nkConfig?: NkConfig;
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
    _meta: {
      schema: LVAR_EXPORT_SCHEMA, quelle: 'Workplace Echo-Loop', exportiertAm: input.exportiertAm,
      kunde: input.kunde, kd: input.kd, familie: input.familie, datenstand: input.datenstand, vorschlagsBasis: input.vorschlagsBasis,
    },
    daten: { prozesse, variablen },
    namensmodul: input.namensmodul,
    nkConfig: input.nkConfig,
    cfg: input.cfg,
    stand: input.stand,
    analyse: input.analyse,
  };
}

/** Lädt alles zum Prozess (geteilter Kern) und baut den Export. null = keine Daten. */
export async function lvarExportFuerProzess(prozessId: string): Promise<LvarExport | null> {
  const k = await ladeLvarKern(prozessId);
  if ('leer' in k) return null;   // keine Datenbasis → nichts zu exportieren

  return buildLvarExport({
    exportiertAm: new Date().toISOString(),
    kunde: k.kundeName,
    kd: k.namensmodul.kd ?? k.nk.namensraum,
    familie: k.data.familie ?? k.namensmodul.familie,
    datenstand: k.inventar.datenstand,
    vorschlagsBasis: !!k.vorschlagMeta,
    variablen: k.variablen, items: k.items,
    namensmodul: k.namensmodul, nkConfig: k.nkConfigRoh, cfg: k.data.lvarCfg,
    stand: k.stand, analyse: k.ergebnis,
  });
}
