/**
 * CFG-Generator — Konfigurations-Projektion + 7-Klassen-Diff (Referenz cfg_generator.py).
 *
 * Projiziert die C_-Konfigurations-Variablen einer Prozess-Familie in eine
 * CONFIG-Tabelle (ein Schlüssel je C_-Zielname) und vergleicht sie gegen die
 * vorhandene(n) CONFIG-Excel(s). Jeder Schlüssel bekommt genau eine Diff-Klasse:
 *
 *   gleich          Panel- und Excel-Wert identisch (einzige wirklich verglichene Zelle)
 *   abweichend      belegter Wert-Konflikt (Excel + ein/mehrere Panel-Werte, keiner belegt vor)
 *   unklar (❓)      Wertunterschied, aber der Panel-Wert stammt aus geratener Umbruch-Zeile
 *   nur_excel       Panel leer, Excel gepflegt (Regelfall einer laufenden Familie)
 *   nur_panel       Wert nur als Initialwert im Prozess, Excel-Lücke (lädt beim nächsten Lauf ins Leere)
 *   fehlend         im Prozess umbenannt, in der Excel steht noch der ALTE Name (D-085-Kreuz)
 *   nicht_verglichen  Schlüssel eines CONFIG-Prozesses ohne hinterlegte Excel (verhindert Falschbefunde)
 *
 * Excel-seitige Waisen (`verwaist`): Excel-Schlüssel ohne Prozess-Gegenstück —
 * `verdacht` (halbe Umbenennung: Excel kennt den alten Namen eines umbenannten Ziels)
 * vs. `altlast` (echte Altlast ohne Gegenstück).
 *
 * Modus selbsterkennend: ABGLEICH sobald eine Excel hinterlegt ist, sonst ERSTANLAGE.
 * Rein & deterministisch (kein LLM). Kalibriert am Übungsfall (cfg-demo.json).
 */

export type CfgKlasse =
  | 'gleich' | 'abweichend' | 'unklar' | 'nur_excel' | 'nur_panel' | 'fehlend' | 'nicht_verglichen';

export type VerwaistArt = 'verdacht' | 'altlast';
export type CfgModus = 'ERSTANLAGE' | 'ABGLEICH';

export interface CfgTarget {
  key: string;                       // C_-Zielname
  configProzess: string;             // welcher CONFIG-Prozess lädt ihn
  altName?: string;                  // präfixloser/alter Name (für fehlend/verwaist-Kreuzung)
  umbruch?: boolean;                 // Panel-Wert aus geratener Umbruch-Zeile → nie „abweichend", nur „unklar"
  panelWerte: Record<string, string>; // Prozess → Initialwert (leer/fehlend = kein Eintrag)
}

export interface CfgExcel {
  configProzess: string;
  vorhanden: boolean;
  werte: Record<string, string>;     // Excel-Schlüssel → Wert (kann alte Namen enthalten)
}

export interface CfgSchluessel {
  key: string;
  configProzess: string;
  klasse: CfgKlasse;
  panelWert?: string;
  excelWert?: string;
  kandidaten?: string[];             // bei abweichend/unklar: Excel + Panel-Werte
  vorabhakenGesperrt?: boolean;      // D-085: Kreuz-Widerspruch → Konform-Vorabhaken sperren
  hinweis?: string;
}

export interface CfgVerwaist {
  key: string;
  configProzess: string;
  art: VerwaistArt;
  wert: string;
  hinweis: string;
}

export interface CfgErgebnis {
  modus: CfgModus;
  schluessel: CfgSchluessel[];
  verwaist: CfgVerwaist[];
  verteilung: Record<CfgKlasse, number>;
}

function distinctNonEmpty(werte: Record<string, string>): string[] {
  const out: string[] = [];
  for (const v of Object.values(werte)) {
    const t = (v ?? '').trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Klassifiziert die C_-Ziele einer Familie gegen die CONFIG-Excel(s). */
export function generiereCfg(targets: CfgTarget[], excels: CfgExcel[]): CfgErgebnis {
  const excelByProzess = new Map(excels.map((e) => [e.configProzess, e]));
  const modus: CfgModus = excels.some((e) => e.vorhanden) ? 'ABGLEICH' : 'ERSTANLAGE';
  const targetKeys = new Set(targets.map((t) => t.key));
  // Alte Namen umbenannter Ziele, deren neuer Name NICHT in der jeweiligen Excel steht (→ Kreuz-Verdacht).
  const altVonUmbenannt = new Map<string, CfgTarget>();

  const schluessel: CfgSchluessel[] = targets.map((t) => {
    const excel = excelByProzess.get(t.configProzess);
    const panel = distinctNonEmpty(t.panelWerte);
    const panelWert = panel[0];

    if (!excel || !excel.vorhanden) {
      return { key: t.key, configProzess: t.configProzess, klasse: 'nicht_verglichen', panelWert };
    }

    const excelWert = excel.werte[t.key];
    const excelAlt = t.altName ? excel.werte[t.altName] : undefined;

    // Schlüssel in der Excel zugeordnet (Zeile vorhanden) — Reihenfolge wie cfg_generator.py
    // cfg_diff (nur_excel → nur_panel → unklar → gleich → abweichend). Leerer Excel-Wert = „Zeile
    // ohne Wert" (nur_panel), nicht abweichend. (Die Brücke über registrierte Alt-Namen lebt im
    // Engine-Layer; hier zugeordnet via Zielname; der D-085-Kreuz über `altName` siehe unten.)
    if (excelWert !== undefined) {
      const ev = excelWert.trim();
      if (!panel.length && ev) return { key: t.key, configProzess: t.configProzess, klasse: 'nur_excel', excelWert };
      if (panel.length && !ev) return { key: t.key, configProzess: t.configProzess, klasse: 'nur_panel', panelWert };
      if (!panel.length && !ev) return { key: t.key, configProzess: t.configProzess, klasse: 'gleich', panelWert, excelWert };
      const alle = [ev, ...panel].filter((v, i, a) => a.indexOf(v) === i);
      if (alle.length === 1) return { key: t.key, configProzess: t.configProzess, klasse: 'gleich', panelWert, excelWert };
      const klasse: CfgKlasse = t.umbruch ? 'unklar' : 'abweichend';
      return { key: t.key, configProzess: t.configProzess, klasse, panelWert, excelWert, kandidaten: alle };
    }

    // Neuer Name nicht in der Excel:
    if (excelAlt !== undefined) {
      altVonUmbenannt.set(t.altName!, t);
      return {
        key: t.key, configProzess: t.configProzess, klasse: 'fehlend', panelWert,
        vorabhakenGesperrt: true,
        hinweis: `Verdacht: die Excel kennt ihn noch als „${t.altName}" — wahrscheinlich eine unfertige Umbenennung (D-085).`,
      };
    }
    return { key: t.key, configProzess: t.configProzess, klasse: 'nur_panel', panelWert };
  });

  // Excel-seitige Waisen: Excel-Schlüssel ohne Ziel-Gegenstück.
  const verwaist: CfgVerwaist[] = [];
  for (const excel of excels) {
    if (!excel.vorhanden) continue;
    for (const [ek, ev] of Object.entries(excel.werte)) {
      if (targetKeys.has(ek)) continue;                       // deckt sich mit einem Ziel
      const umbenannt = altVonUmbenannt.get(ek);
      verwaist.push(umbenannt
        ? { key: ek, configProzess: excel.configProzess, art: 'verdacht', wert: ev, hinweis: `Halbe Umbenennung: gehört wohl zu „${umbenannt.key}".` }
        : { key: ek, configProzess: excel.configProzess, art: 'altlast', wert: ev, hinweis: 'Altlast ohne Prozess-Gegenstück.' });
    }
  }

  const verteilung = { gleich: 0, abweichend: 0, unklar: 0, nur_excel: 0, nur_panel: 0, fehlend: 0, nicht_verglichen: 0 } as Record<CfgKlasse, number>;
  for (const s of schluessel) verteilung[s.klasse]++;

  return { modus, schluessel, verwaist, verteilung };
}

/** Export als CSV (Spalten: Schlüssel · CONFIG-Prozess · Klasse · Panel-Wert · Excel-Wert · Kandidaten · Hinweis). */
export function cfgAlsCsv(erg: CfgErgebnis): string {
  const esc = (s: string) => /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const kopf = ['Schluessel', 'CONFIG-Prozess', 'Klasse', 'Panel-Wert', 'Excel-Wert', 'Kandidaten', 'Hinweis'];
  const zeilen = erg.schluessel.map((s) => [
    s.key, s.configProzess, s.klasse, s.panelWert ?? '', s.excelWert ?? '',
    (s.kandidaten ?? []).join(' | '), s.hinweis ?? '',
  ].map((v) => esc(String(v))).join(';'));
  const waisen = erg.verwaist.map((w) => [w.key, w.configProzess, `verwaist:${w.art}`, '', w.wert, '', w.hinweis].map((v) => esc(String(v))).join(';'));
  return [kopf.join(';'), ...zeilen, ...waisen].join('\n');
}
