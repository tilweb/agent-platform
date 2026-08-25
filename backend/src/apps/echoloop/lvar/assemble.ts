/**
 * L-VAR-Assembly — führt die vier L-VAR-Verfahren zu einem Explorer-Ergebnis
 * zusammen (Reiter 1 Variablen/NK/Kopplung · Reiter 2 Steckbriefe · Reiter 3 CFG)
 * und leitet die RGA-Verzahnungs-Hinweise ab.
 *
 * Reihenfolge beachtet die Querverdrahtung: CFG zuerst (liefert die D-085-
 * Vorabhaken-Sperre), dann Kopplung (nutzt die Sperre), dann Steckbriefe + NK-Hinweise.
 *
 * Rein & deterministisch (kein LLM). Die DB-/Extraktions-Beschaffung liegt im
 * Service (`lvar/service.ts`); diese Funktion ist über ihre Eingaben testbar.
 */
import { pruefeNK, type NkNamensmodul, type NkErgebnis, type VarFundort } from './nk';
import { analysiereKopplung, type KopplungErgebnis } from './kopplung';
import { baueSteckbriefe, type Steckbrief, type SteckbriefEingang } from './steckbriefe';
import { generiereCfg, type CfgErgebnis, type CfgTarget, type CfgExcel } from './cfg';
import { nkNachRga, type RgaHinweis } from './verzahnung';
import { pfadBefunde, pfadNachRga, type PfadBefunde, type PfadZeile } from './pfad';
import { einbauTabelle, type EinbauZeile } from './prozessstart';
import type { EffektiveNk } from './nkconfig';

export interface LvarInput {
  namensraum?: string;
  familie?: string;
  namensmodul: NkNamensmodul;
  fundorte: VarFundort[];                          // Variablen-Name → Prozess (aus der Extraktion)
  callGraph: { von: string; nach: string }[];
  prozesseMeta?: Record<string, SteckbriefEingang>; // Ist/Typ/Soll je Prozess (sonst aus namensmodul.prozesse)
  cfg?: { targets: CfgTarget[]; excel: CfgExcel[] };
  nk?: EffektiveNk;                                 // effektiver NK-Regelsatz (Default + Kunden-Config)
}

export interface LvarErgebnis {
  nk: NkErgebnis;
  kopplung: KopplungErgebnis;
  steckbriefe: Steckbrief[];
  cfg: CfgErgebnis | null;
  pfad: PfadBefunde | null;
  einbau: EinbauZeile[];
  rgaHinweise: RgaHinweis[];
}

/** Baut aus namensmodul.prozesse die Steckbrief-Eingänge, falls keine Meta übergeben ist. */
function metaAusModul(modul: NkNamensmodul): Record<string, SteckbriefEingang> {
  const out: Record<string, SteckbriefEingang> = {};
  for (const [nr, p] of Object.entries(modul.prozesse ?? {})) {
    const istConfig = /config|cfg/i.test(p.ist) || /_UTIL$/.test(p.soll ?? '');
    out[nr] = { ist: p.ist, typGesetzt: p.typ, istConfig, sollEntschieden: p.soll };
  }
  return out;
}

export function assembleLvar(input: LvarInput): LvarErgebnis {
  // Reiter 3 zuerst — liefert die D-085-Vorabhaken-Sperre für Reiter 1.
  const cfg = input.cfg ? generiereCfg(input.cfg.targets, input.cfg.excel) : null;
  const gesperrt = cfg ? cfg.schluessel.filter((s) => s.vorabhakenGesperrt).map((s) => s.key) : [];

  const nk = pruefeNK(input.namensmodul, input.fundorte, input.nk && { verworfen: input.nk.verworfen, ausnahmen: input.nk.ausnahmen });
  const kopplung = analysiereKopplung(input.namensmodul, input.fundorte, { gesperrt });

  const meta = input.prozesseMeta ?? metaAusModul(input.namensmodul);
  const steckbriefe = baueSteckbriefe({
    namensraum: input.namensraum ?? input.namensmodul.namensraum,
    familie: input.familie ?? input.namensmodul.familie,
    prozesse: meta,
    callGraph: input.callGraph,
  });

  // Pfad-Wiederholungs-Analyse aus den CFG-Ziel-Pfaden (→ D9/D10).
  let pfad: PfadBefunde | null = null;
  const rgaHinweise = nkNachRga(nk, kopplung);
  if (input.cfg) {
    const zeilen: PfadZeile[] = input.cfg.targets.map((t) => ({
      schluessel: t.key,
      wert: Object.values(t.panelWerte).find((v) => (v ?? '').trim()) ?? '',
    }));
    pfad = pfadBefunde(zeilen);
    rgaHinweise.push(...pfadNachRga(pfad));
  }

  const einbau = einbauTabelle({
    namensraum: input.namensraum ?? input.namensmodul.namensraum,
    familie: input.familie ?? input.namensmodul.familie,
    namensmodul: input.namensmodul, fundorte: input.fundorte, callGraph: input.callGraph, prozesseMeta: input.prozesseMeta,
  });

  return { nk, kopplung, steckbriefe, cfg, pfad, einbau, rgaHinweise };
}
