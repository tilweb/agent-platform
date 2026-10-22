/**
 * Vergleichsbasis fuer eine Teilauswahl (Smoke, --faelle, --split).
 *
 * Die Baseline-Quoten gelten fuer ALLE Faelle eines Sets. Misst ein Lauf nur einige davon (Smoke: 3 von 60 Wohngeld-
 * Faellen), ist der Vergleich mit dem Gesamtschnitt schief: schwerere Faelle erscheinen als Rueckgang (Smoke vor dem
 * Demo-Deploy 2026-10-22: 93,4 % gegen 90,3 %, obwohl dieselben Faelle in der Baseline 90,3–90,9 % hatten).
 *
 * Deshalb: dieselben Faelle aus dem Baseline-Lauf (`baseline.lauf`, gespeicherte Einzelergebnisse inkl. Wiederholungen)
 * mit der aktuellen Bewertungslogik neu bewerten. Quoten und Zaehler kommen aus dieser Teilmenge, das Rauschband aus
 * ihren Wiederholungen. Betriebskennzahlen je Seite bleiben aus der Gesamt-Baseline (die Einzelergebnisse speichern
 * keine Laufzeit).
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { aggregiere, bewerteFall, type FallBewertung, type FallErgebnis } from './bewertung';
import { rauschbandAus, type SetBaseline } from './bericht';
import { KORPUS, sicher, type GeladenerFall, type GeladenesSet } from './korpus';

/** Gespeichertes Einzelergebnis (`laeufe/<lauf>/ergebnisse/<set>/<fall>.json`) → Bewertungseingabe wie in lauf.ts. */
export function ausGespeichertem(r: Record<string, unknown>): FallErgebnis {
  const validations = (r.validations ?? []) as Array<{ rule_id?: string; severity?: string; message?: string }>;
  return {
    success: !r.error,
    error: (r.error as string | undefined) ?? undefined,
    data: (r.data as Record<string, unknown>) ?? {},
    fieldConfidences: r.fieldConfidences as FallErgebnis['fieldConfidences'],
    segments: r.segments as FallErgebnis['segments'],
    vertrag: r.vertrag as FallErgebnis['vertrag'],
    seiten: 1,
    sekunden: 0,
    verarbeitungsfehler: validations.filter((v) => v.rule_id === 'verarbeitung' && v.severity === 'error').map((v) => v.message ?? ''),
  };
}

/** Rein: Teilbasis aus den Bewertungen je Wiederholung (erste = Bezug). */
export function teilbasisAus(voll: SetBaseline, jeWiederholung: FallBewertung[][]): SetBaseline {
  const metriken = jeWiederholung.map(aggregiere);
  const sauber = metriken.filter((m) => m.ausfaelle === 0);
  return {
    metriken: { ...metriken[0]!, betrieb: voll.metriken.betrieb },
    rauschband: sauber.length >= 2 ? rauschbandAus(sauber) : voll.rauschband,
    kritischRichtig: voll.kritischRichtig,
  };
}

export interface Teilbasis {
  basis: SetBaseline;
  /** Lauf, aus dem die Einzelergebnisse stammen. */
  lauf: string;
  /** Faelle mit Ergebnis im Baseline-Lauf. */
  faelle: number;
  wiederholungen: number;
  /** Ausgewaehlte Faelle ohne Ergebnis im Baseline-Lauf (z. B. spaeter hinzugekommen). */
  fehlend: string[];
}

/**
 * Lauf, aus dem die Set-Baseline stammt. Neuere Baselines nennen ihn (`lauf`). Bei aelteren steht nur der Lauf der
 * ganzen Baseline in `baseline.json` — nicht neu gemessene Sets wurden aus frueheren Laeufen uebernommen. Dann den Lauf
 * suchen, dessen gespeicherte Kennzahlen fuer dieses Set exakt der Baseline entsprechen (neueste zuerst).
 */
export async function baselineLaufFuer(setId: string, voll: SetBaseline, baselineLauf: string): Promise<string | null> {
  if (voll.lauf) return voll.lauf;
  const kandidaten = [baselineLauf, ...(await readdir(join(KORPUS, 'laeufe')).catch(() => [] as string[])).sort().reverse()];
  const soll = JSON.stringify(voll.metriken.quoten);
  for (const lauf of [...new Set(kandidaten)]) {
    const datei = Bun.file(join(KORPUS, 'laeufe', lauf, 'metriken.json'));
    if (!(await datei.exists())) continue;
    const m = (await datei.json().catch(() => ({}))) as Record<string, { metriken?: { quoten?: unknown } }>;
    if (JSON.stringify(m[setId]?.metriken?.quoten) === soll) return lauf;
  }
  return null;
}

/** Laedt die Teilbasis; `null`, wenn der Baseline-Lauf fuer diese Faelle keine Ergebnisse hat. */
export async function ladeTeilbasis(
  set: GeladenesSet, faelle: GeladenerFall[], voll: SetBaseline, baselineLauf: string, sicherAb: number,
): Promise<Teilbasis | null> {
  const quelle = await baselineLaufFuer(set.def.id, voll, baselineLauf);
  if (!quelle) return null;
  const dir = join(KORPUS, 'laeufe', quelle, 'ergebnisse', sicher(set.def.id));
  const opts = { kritische: set.def.kritische_felder ?? [], sicherAb };
  const vorhanden: GeladenerFall[] = [];
  const fehlend: GeladenerFall[] = [];
  for (const f of faelle) ((await Bun.file(join(dir, `${sicher(f.id)}.json`)).exists()) ? vorhanden : fehlend).push(f);
  if (!vorhanden.length) return null;
  const jeWiederholung: FallBewertung[][] = [];
  for (let w = 1; w <= 10; w++) {
    const suffix = w === 1 ? '' : `.${w}`;
    const bewertungen: FallBewertung[] = [];
    for (const f of vorhanden) {
      const datei = Bun.file(join(dir, `${sicher(f.id)}${suffix}.json`));
      if (!(await datei.exists())) break;
      bewertungen.push(bewerteFall(set.profil, f, ausGespeichertem(await datei.json()), opts));
    }
    if (bewertungen.length < vorhanden.length) break; // Wiederholung unvollstaendig → nicht verwenden
    jeWiederholung.push(bewertungen);
  }
  if (!jeWiederholung.length) return null;
  return { basis: teilbasisAus(voll, jeWiederholung), lauf: quelle, faelle: vorhanden.length, wiederholungen: jeWiederholung.length, fehlend: fehlend.map((f) => f.id) };
}
