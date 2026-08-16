/**
 * L-VAR ↔ L-RGA-Verzahnung — der NK-/Kopplungs-Zustand der Familie fließt als
 * Belege/Hinweise in die RGA-Dimensionen zurück (Leitbild: ein Datenmodell,
 * viele Verfahren, die sich über den Baustand querverdrahten).
 *
 * Abgebildet:
 *   · NK-Gate-Zustand → RGA: G4-Dublette → D5 (Idempotenz/Konsistenz) + D9
 *     (Modularität); harter Kanon-Verstoß / Präfix → D6 (Konfiguration); Fachwert-
 *     Präfix → D8. Es werden HINWEISE erzeugt, keine Levels gesetzt (der Mensch
 *     benotet — Prinzip §3.9: Zustimmung ≠ Zeile).
 *   · Kopplungs-Riss → D6b (Datenfluss): die Übergabe über Namensgleichheit ist tot.
 *   · Twin-Import: RGA-Soll je Dimension ist bereits in den Steckbriefen als
 *     `sollTwin` verankert (Soll-Kaskade), hier nur referenziert.
 *
 * NICHT hier (eigene Referenz-Kartierung nötig): die Pfad-Wiederholungs-Analyse
 * (`pfad_befunde` kürzbar/extern/trenner → D9/D10) — folgt als eigener Baustein.
 *
 * Rein & deterministisch (kein LLM).
 */
import type { NkErgebnis } from './nk';
import type { KopplungErgebnis } from './kopplung';

export interface RgaHinweis {
  dim: string;                 // RGA-Dimension, z.B. "D5"
  quelle: 'nk' | 'kopplung';
  hinweis: string;
  provenienz: '[Graph]' | '[G Text]';
}

/** Leitet aus NK-Gate + Kopplung die RGA-Dimensionshinweise ab (keine Levels). */
export function nkNachRga(nk: NkErgebnis, kopplung?: KopplungErgebnis): RgaHinweis[] {
  const out: RgaHinweis[] = [];
  const dubletten = Object.values(nk.g4).filter((x) => x.art === 'dublette').map((x) => x.neu);

  if (dubletten.length) {
    const liste = dubletten.join(', ');
    out.push({ dim: 'D5', quelle: 'nk', provenienz: '[G Text]', hinweis: `NK-G4: Dublette(n) ${liste} — zwei Namen für dieselbe Größe im selben Prozess (Konsistenz-Risiko).` });
    out.push({ dim: 'D9', quelle: 'nk', provenienz: '[G Text]', hinweis: `NK-G4: Dublette(n) ${liste} vor Modularisierung bereinigen.` });
  }

  if (nk.sperrend) {
    out.push({ dim: 'D6', quelle: 'nk', provenienz: '[G Text]', hinweis: `NK-G1: harter Kanon-Verstoß (${nk.hartVerstoss.length}) — Konfigurations-/Namensbasis nicht sauber.` });
  }
  if (!nk.gates.G1.erfuellt) {
    const fachwertPraefix = nk.gates.G1.details.some((d) => d.includes('PRAEFIX-BEI-FACHWERT'));
    if (fachwertPraefix) out.push({ dim: 'D8', quelle: 'nk', provenienz: '[G Text]', hinweis: 'NK-G1: Fachwert trägt Präfix — Übergabe-/Sicherheits-Semantik unklar.' });
  }
  if (!nk.gates.G6.erfuellt) {
    out.push({ dim: 'D6', quelle: 'nk', provenienz: '[G Text]', hinweis: 'NK-G6: verworfene Kategorie-Wörter — Config-Namensbasis uneinheitlich.' });
  }

  for (const r of kopplung?.risse ?? []) {
    out.push({
      dim: 'D6b', quelle: 'kopplung', provenienz: '[Graph]',
      hinweis: `Kopplungs-Riss ${r.neu}: in ${r.renamedIn.join('/')} umbenannt, in ${r.oldIn.join('/')} noch „${r.altName}" — Übergabe über Namensgleichheit tot, bis beide stehen.`,
    });
  }

  return out;
}

/** Gruppiert die RGA-Hinweise je Dimension (für das Panel/Beleg-Feld). */
export function hinweiseJeDimension(hinweise: RgaHinweis[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const h of hinweise) (out[h.dim] ??= []).push(h.hinweis);
  return out;
}
