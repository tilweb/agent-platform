/**
 * Phase 4 · Lagebild — Session-Start-Überblick aus der append-only Telemetrie-
 * Senke (`el_telemetrie`). Aggregiert die Läufe je Verfahren/Event, den Verbrauch
 * (Züge · Tokens · USD-Schätzung) und die letzten Gold-/Tresor-Ergebnisse zu einer
 * Lage-Zeile + Struktur — die Betriebs-Guardrail „was ist gelaufen, was hat es gekostet".
 *
 * Rein & deterministisch: nimmt die Telemetrie-Zeilen (aus `listTelemetrie`) und
 * gibt ein Lagebild zurück. Die Verbrauchs-Rechnung nutzt `verbrauch.ts`.
 */
import { budgetStufe, type BudgetStufe } from '../verbrauch';

export interface TelemetrieZeile {
  verfahren: string;                 // lvar | rga | bau | gold | tresor | verbrauch | …
  event: string;                     // extract | gold-run | tresor-sweep | redact | benotung | …
  data?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Lagebild {
  gesamt: number;
  jeVerfahren: Record<string, number>;
  jeEvent: Record<string, number>;
  verbrauch: { zuege: number; tokens: number; usd: number; budgetStufe: BudgetStufe };
  letzterGold?: { pass: boolean; datum: string };
  tresorFunde: number;
  zeile: string;                     // Ein-Zeilen-Lagebild
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Baut das Lagebild aus den Telemetrie-Zeilen (optional Tagesbudget in USD). */
export function lagebild(zeilen: TelemetrieZeile[], budget?: number): Lagebild {
  const jeVerfahren: Record<string, number> = {};
  const jeEvent: Record<string, number> = {};
  let zuege = 0, tokens = 0, usd = 0, tresorFunde = 0;
  let letzterGold: Lagebild['letzterGold'];

  for (const z of zeilen) {
    jeVerfahren[z.verfahren] = (jeVerfahren[z.verfahren] ?? 0) + 1;
    jeEvent[z.event] = (jeEvent[z.event] ?? 0) + 1;
    const d = z.data ?? {};

    if (z.verfahren === 'verbrauch') {
      zuege += num(d.zuege) || 1;                       // ein Verbrauchs-Event = mind. ein Zug
      tokens += num(d.tokens) + num(d.kontext);
      usd += num(d.usd);
    }
    if (z.verfahren === 'tresor') tresorFunde += num(d.funde);
    if (z.verfahren === 'gold' && z.event === 'gold-run') {
      // jüngster Gold-Lauf gewinnt (Zeilen kommen ggf. unsortiert)
      if (!letzterGold || z.createdAt > letzterGold.datum) letzterGold = { pass: !!d.pass, datum: z.createdAt };
    }
  }

  usd = Math.round(usd * 100) / 100;
  const stufe = budgetStufe(usd, budget);
  const zeile =
    `Lagebild: ${zeilen.length} Ereignis(se)` +
    (zuege ? ` · Verbrauch ~${usd} USD${budget ? ` (${stufe})` : ''} über ${zuege} Zug/Züge` : '') +
    (letzterGold ? ` · Gold ${letzterGold.pass ? 'PASS' : 'FAIL'}` : '') +
    (tresorFunde ? ` · ⚠ ${tresorFunde} Tresor-Fund(e) geschwärzt` : '');

  return { gesamt: zeilen.length, jeVerfahren, jeEvent, verbrauch: { zuege, tokens, usd, budgetStufe: stufe }, letzterGold, tresorFunde, zeile };
}
