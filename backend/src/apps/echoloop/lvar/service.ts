/**
 * L-VAR-Service — beschafft die Eingaben aus DB/Persistenz und ruft die reine
 * Assembly (`assembleLvar`). Zentrale Ableitung in `ladeLvarKern` (von Sicht UND
 * Export genutzt, damit beide dasselbe Namensmodul verwenden):
 *
 *   · Variablen-Fundorte + Call-Graph: aus `el_variablen` / `el_prozess_items`
 *     der neuesten Datenversion (geteilter Upload, Koordinaten-Extraktion).
 *   · Namensmodul (alt→neu, Rolle): entweder importiert (Legacy) oder maschinell
 *     VORGESCHLAGEN (Scheibe B) + Kunden-Overrides aus dem Arbeitsstand.
 *   · NK-Regelsatz: fixer Paket-Standard + additive Kunden-Config (Scheibe C).
 */
import { getProzess, getKunde } from '../storage';
import { listVariablen, listProzessItems, latestExtractBaustand } from '../extract/persist';
import { assembleLvar, type LvarErgebnis } from './assemble';
import { sanitizeStand, type LvarStand } from './stand';
import { schlageNamenVor, type NamensVorschlag } from './vorschlag';
import { effektiveNk, type NkConfig, type EffektiveNk } from './nkconfig';
import { slug } from './kopplung';
import type { NkNamensmodul, NkRolle } from './nk';
import type { CfgTarget, CfgExcel } from './cfg';
import type { Variable, ProzessItem } from '../types';

type LvarCfgInput = { targets: CfgTarget[]; excel: CfgExcel[] };

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
export type LvarAnsicht = LvarErgebnis & { stand: LvarStand; version: number; vorschlagsBasis?: boolean };

/** Voll aufgelöste L-VAR-Grundlage — geteilt von Sicht und Export. */
export interface LvarKern {
  data: { lvarCfg?: LvarCfgInput; namensraum?: string; familie?: string };
  nk: EffektiveNk;
  variablen: Variable[];
  items: ProzessItem[];
  inventar: LvarInventar;
  namensmodul: NkNamensmodul;
  vorschlagMeta: Map<string, NamensVorschlag> | null;   // null = importiertes Modul
  stand: LvarStand;
  ergebnis: LvarErgebnis;
  version: number;
  kundeName?: string;
  nkConfigRoh?: NkConfig;                                // die additive Kunden-Anpassung (roh)
}

/**
 * Lädt Prozess + Datenversion + NK-Config, leitet das effektive Namensmodul ab
 * (Import ODER Vorschlag ⊕ Kunden-Override) und assembliert. `leer`, wenn es
 * keine Daten gibt.
 */
export async function ladeLvarKern(prozessId: string): Promise<LvarKern | LvarLeer> {
  const leer = (grund: string, inventar: LvarInventar): LvarLeer => ({ leer: true, grund, inventar });
  const prozess = await getProzess(prozessId);
  if (!prozess) return leer('Prozess nicht gefunden', { variablen: [], prozesse: [] });

  const data = prozess as unknown as { lvarNamensmodul?: NkNamensmodul; lvarCfg?: LvarCfgInput; lvarStand?: unknown; namensraum?: string; familie?: string };

  // NK-Regelsatz: fixer Paket-Standard + additive Kunden-Config (kunde.data.nkConfig).
  const kunde = prozess.kundeId ? await getKunde(prozess.kundeId) : null;
  const nkConfigRoh = (kunde as unknown as { nkConfig?: NkConfig } | null)?.nkConfig;
  const nk = effektiveNk(nkConfigRoh);

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

  // Namensmodul: importiert (Legacy) ODER maschinell vorgeschlagen (Scheibe B) +
  // Kunden-Overrides (neu/rolle) aus dem Arbeitsstand (Vorschlag ≠ Entscheid, D-095).
  const stand = sanitizeStand(data.lvarStand);
  const importiert = data.lvarNamensmodul;
  let namensmodul: NkNamensmodul;
  let vorschlagMeta: Map<string, NamensVorschlag> | null = null;

  if (importiert && Array.isArray(importiert.map) && importiert.map.length > 0) {
    namensmodul = importiert;                                    // Legacy-Importweg (unverändert)
  } else if (inventar.variablen.length > 0) {
    const { modul, vorschlaege } = schlageNamenVor(
      fundorte,
      variablen.map((v) => ({ name: v.name, p: v.p, typ: v.typ, schnitt: v.schnitt })),
      { verworfen: nk.verworfen, kategorieWoerter: nk.kategorieWoerter },
    );
    vorschlagMeta = new Map(vorschlaege.map((v) => [v.alt, v]));
    const ov = (alt: string, feld: string, fb: string): string => {
      const val = stand[`UB-${slug(alt)}-${feld}`];
      return typeof val === 'string' && val ? val : fb;
    };
    const validR = (r: string): r is NkRolle => r === 'C' || r === 'H' || r === 'T' || r === 'U';
    namensmodul = {
      ...modul,
      prozesse: Object.fromEntries(items.map((it) => [it.nr, { ist: it.nameExport ?? `Prozess ${it.nr}` }])),
      map: modul.map.map((e) => {
        const rolle = ov(e.alt, 'rolle', e.rolle);
        return { alt: e.alt, neu: ov(e.alt, 'neu', e.neu), rolle: validR(rolle) ? rolle : e.rolle };
      }),
    };
  } else {
    return leer('Noch keine Daten — lade EMMA-Exporte über „Analyse starten" hoch; RGA und L-VAR nutzen dieselbe Datenbasis.', inventar);
  }

  const ergebnis = assembleLvar({
    namensraum: data.namensraum ?? nk.namensraum ?? namensmodul.namensraum,
    familie: data.familie ?? namensmodul.familie,
    namensmodul,
    fundorte,
    callGraph,
    cfg: data.lvarCfg,
    nk,
  });

  // Vorschlags-Herkunft an die Umbenennen-Karten hängen (UI: Konfidenz/Begründung).
  if (vorschlagMeta) {
    for (const k of ergebnis.kopplung.karten) {
      const v = vorschlagMeta.get(k.alt);
      if (v) k.vorschlag = { konfidenz: v.konfidenz, begruendung: v.begruendung, istKonform: v.istKonform };
    }
  }

  return {
    data, nk, variablen, items, inventar, namensmodul, vorschlagMeta,
    stand, ergebnis, version: prozess.version ?? 1,
    kundeName: kunde?.name, nkConfigRoh,
  };
}

/** Sicht für den Explorer: Ergebnis + Arbeitsstand + Version (oder Leer-Zustand). */
export async function lvarFuerProzess(prozessId: string): Promise<LvarAnsicht | LvarLeer> {
  const k = await ladeLvarKern(prozessId);
  if ('leer' in k) return k;
  return { ...k.ergebnis, stand: k.stand, version: k.version, vorschlagsBasis: !!k.vorschlagMeta };
}
