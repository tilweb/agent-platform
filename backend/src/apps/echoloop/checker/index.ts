/**
 * Checker-Orchestrator: EMMA-Export-Texte (eine Prozess-Familie) → strukturierte
 * Prüfmuster-Befunde + Call-Graph. Deterministisch, LLM-frei.
 */
import { parseFamily } from './parse';
import { pm01, pm02, pm03, pm04, pm04b, pm09, pm10, pm13, pm14, pm12, pm17, pmWb, pmWc } from './patterns';
import type { CheckerResult, PMFinding, Severity } from './types';

export * from './types';
export { parseFamily, parseProcess } from './parse';
export { deriveHints, type CheckerHints, type DimHints, type TopHebel } from './hints';

const SEVERITY_RANK: Record<Severity, number> = {
  kritisch: 0, hoch: 1, mittel: 2, frage: 3, niedrig: 4,
};

/**
 * Führt alle Prüfmuster über die hochgeladene Prozess-Familie aus.
 * `files` = ein Eintrag je Prozess-Export (name = Dateiname, text = pdftotext-Layout).
 */
export function runChecker(files: { name: string; text: string }[]): CheckerResult {
  const family = parseFamily(files);

  // Scharfe Muster zuerst (nach Schwere sortiert), dann beobachtende (PAKET_2-
  // Governance: eigene Sektion, eskalieren nicht). Innerhalb je Gruppe nach Schwere.
  const scharf = [
    ...pm01(family),
    ...pm02(family),
    ...pm03(family),
    ...pm04(family),
    ...pm04b(family),
    ...pm09(family),
    ...pm10(family),
    ...pm13(family),
    ...pm14(family),
  ].sort((a, b) => SEVERITY_RANK[a.schwere] - SEVERITY_RANK[b.schwere]);

  const beobachtend = [
    ...pm12(family),
    ...pm17(family),
    ...pmWb(family),
    ...pmWc(family),
  ].sort((a, b) => SEVERITY_RANK[a.schwere] - SEVERITY_RANK[b.schwere]);

  const findings: PMFinding[] = [...scharf, ...beobachtend];

  const callGraph: { von: string; nach: string; schrittId: number }[] = [];
  for (const p of family.processes) {
    for (const c of p.calls) {
      callGraph.push({ von: p.nr, nach: String(c.testCaseId), schrittId: c.schrittId });
    }
  }

  return {
    findings,
    family: {
      prozessNummern: family.processes.map((p) => p.nr),
      callGraph,
    },
  };
}
