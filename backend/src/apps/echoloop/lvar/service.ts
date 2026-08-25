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
import { getProzess, getKunde } from '../storage';
import { listVariablen, listProzessItems, latestExtractBaustand } from '../extract/persist';
import { assembleLvar, type LvarErgebnis } from './assemble';
import { sanitizeStand, type LvarStand } from './stand';
import { schlageNamenVor, type NamensVorschlag } from './vorschlag';
import { effektiveNk, type NkConfig } from './nkconfig';
import { slug } from './kopplung';
import type { NkNamensmodul, NkRolle } from './nk';
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
export type LvarAnsicht = LvarErgebnis & { stand: LvarStand; version: number; vorschlagsBasis?: boolean };

export async function lvarFuerProzess(prozessId: string): Promise<LvarAnsicht | LvarLeer> {
  const leer = (grund: string, inventar: LvarInventar): LvarLeer => ({ leer: true, grund, inventar });
  const prozess = await getProzess(prozessId);
  if (!prozess) return leer('Prozess nicht gefunden', { variablen: [], prozesse: [] });

  const data = prozess as unknown as { lvarNamensmodul?: NkNamensmodul; lvarCfg?: { targets: CfgTarget[]; excel: CfgExcel[] }; lvarStand?: unknown; namensraum?: string; familie?: string };

  // NK-Regelsatz: fixer Paket-Standard + additive Kunden-Config (kunde.data.nkConfig).
  const kunde = prozess.kundeId ? await getKunde(prozess.kundeId) : null;
  const nk = effektiveNk((kunde as unknown as { nkConfig?: NkConfig } | null)?.nkConfig);

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

  // Namensmodul: importiert (Legacy) ODER maschinell vorgeschlagen (Scheibe B).
  // Die Vorschläge sind der NK-konforme Startpunkt; Kunden-Overrides (neu/rolle)
  // liegen im Arbeitsstand und werden hier übergelegt (Vorschlag ≠ Entscheid, D-095).
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

  // Menschlicher Arbeitsstand als Overlay + Version fürs Optimistic-Locking.
  return { ...ergebnis, stand, version: prozess.version ?? 1, vorschlagsBasis: !!vorschlagMeta };
}
