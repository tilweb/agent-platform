/**
 * Pfad-Wiederholungs-Analyse (`pfad_befunde`) — Referenz cfg_generator.py:66-128.
 *
 * Klassifiziert die Pfad-Werte der C_-Konfigurations-Schlüssel einer Familie:
 *   · `kuerzbar` — Vollpfad UNTER dem gemeinsamen Stamm → ließe sich aus
 *     `C_BasisPfad` + Rest zusammensetzen (Copy-Paste in Datenform) → RGA **D9** (Modularität).
 *   · `extern`   — Vollpfad AUSSERHALB des Stamms (anderes Laufwerk/Programm/UNC) →
 *     nicht relativ baubar → RGA **D10** (Portabilität). Ausdrücklich KEIN Defekt (§A4 ⑤a).
 *   · `trenner`  — Teilpfad mit führendem Separator, aber kein Vollpfad → beim
 *     Zusammensetzen entstünde `…\\…` (Doppel-Trenner) → Bau-Geländer.
 *
 * Das Klasse→Dimension-Mapping steht NICHT in Sebs Code (nur konzeptionell im
 * /rga-Skill: „Zahl in die RGA"); wir setzen es hier (kuerzbar→D9, extern→D10)
 * und erzeugen HINWEISE mit Wiederholungszahl, keine Levels (§3.9).
 *
 * Rein & deterministisch. Golden: cfg_generator-Testfall (kuerzbar
 * [C_ArchivPfad,C_VorlagePfad] · extern [C_FremdPfad] · trenner [C_TeilPfad]).
 */
import type { RgaHinweis } from './verzahnung';

export interface PfadZeile { schluessel: string; wert: string; }
export interface PfadKuerzbar { schluessel: string; wert: string; rest: string; }
export interface PfadExtern { schluessel: string; wert: string; }

export interface PfadBefunde {
  stamm: string;
  kuerzbar: PfadKuerzbar[];
  extern: PfadExtern[];
  trenner: string[];
}

/** Vollpfad: Laufwerk (J:\ / C:/) oder UNC (\\server). */
function istVollpfad(s: string): boolean {
  return /^[A-Za-z]:[\\/]|^\\\\/.test(s || '');
}
const norm = (s: string) => (s || '').replace(/\//g, '\\');

/** Ermittelt den Basispfad: expliziter Wert > C_BasisPfad > häufigster Präfix (Tiefe ≥2, Zähler >1). */
function ermittleStamm(zeilen: PfadZeile[], basis: string): string {
  let b = (basis || '').trim().replace(/[\\/]+$/, '');
  if (b) return b;

  const basisPfad = zeilen.find((z) => z.schluessel === 'C_BasisPfad');
  if (basisPfad) b = norm(basisPfad.wert || '').trim().replace(/[\\/]+$/, '');
  if (b) return b;

  // Häufigster Präfix über alle Vollpfade (Tiefe ≥2), Kandidaten mit Zähler > 1.
  const counts = new Map<string, { count: number; tiefe: number }>();
  for (const z of zeilen) {
    const w = norm(z.wert || '');
    if (!istVollpfad(w)) continue;
    const teile = w.split('\\');
    for (let tiefe = 2; tiefe <= teile.length; tiefe++) {
      const pref = teile.slice(0, tiefe).join('\\');
      const c = counts.get(pref) ?? { count: 0, tiefe };
      counts.set(pref, { count: c.count + 1, tiefe });
    }
  }
  let best: { count: number; tiefe: number; pref: string } | null = null;
  for (const [pref, { count, tiefe }] of counts) {
    if (count <= 1) continue;
    if (!best || count > best.count || (count === best.count && tiefe > best.tiefe)) best = { count, tiefe, pref };
  }
  return best?.pref ?? '';
}

/** Klassifiziert die Pfad-Werte der CFG-Zeilen. */
export function pfadBefunde(zeilen: PfadZeile[], basis = ''): PfadBefunde {
  const stamm = ermittleStamm(zeilen, basis);
  const basisKey = zeilen.find((z) => norm(z.wert || '').replace(/[\\/]+$/, '') === stamm)?.schluessel;

  const kuerzbar: PfadKuerzbar[] = [];
  const extern: PfadExtern[] = [];
  for (const z of zeilen) {
    const wert = z.wert || '';
    if (!istVollpfad(wert) || z.schluessel === basisKey) continue;
    const w = norm(wert);
    if (stamm && stamm.length > 3 && w.startsWith(stamm)) {
      kuerzbar.push({ schluessel: z.schluessel, wert, rest: w.slice(stamm.length).replace(/^[\\]+/, '') });
    } else {
      extern.push({ schluessel: z.schluessel, wert });
    }
  }

  const trenner = zeilen
    .filter((z) => /^[\\/]/.test(z.wert || '') && !istVollpfad(z.wert || ''))
    .map((z) => z.schluessel);

  return { stamm, kuerzbar, extern, trenner };
}

/** Pfad-Befunde → RGA-Hinweise (kuerzbar→D9 mit Wiederholungszahl, extern→D10). Keine Levels. */
export function pfadNachRga(b: PfadBefunde): RgaHinweis[] {
  const out: RgaHinweis[] = [];
  if (b.kuerzbar.length > 1) {
    out.push({
      dim: 'D9', quelle: 'nk', provenienz: '[G Text]',
      hinweis: `Pfad-Wiederholung: ${b.kuerzbar.length} Vollpfade unter dem Stamm „${b.stamm}" (${b.kuerzbar.map((k) => k.schluessel).join(', ')}) — Copy-Paste in Datenform, über C_BasisPfad + Rest baubar.`,
    });
  }
  if (b.extern.length) {
    out.push({
      dim: 'D10', quelle: 'nk', provenienz: '[G Text]',
      hinweis: `Externe Pfade (${b.extern.map((e) => e.schluessel).join(', ')}) — nicht relativ baubar (Portabilität). Kein Defekt, aber Umgebungs-Bindung.`,
    });
  }
  return out;
}
