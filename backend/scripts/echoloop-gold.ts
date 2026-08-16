#!/usr/bin/env bun
/**
 * Gold-Runner-CLI für den Betrieb (Prinzip §5 „Übungsfall zuerst").
 *
 *   bun scripts/echoloop-gold.ts                 # Übungsfall (Default-Fixture)
 *   bun scripts/echoloop-gold.ts <fixture-dir>   # anderes Golden-Set (z.B. Heinzl, compliance-gated)
 *
 * Exit-Code 0 = PASS, 1 = FAIL (jede Abweichung ist REGRESSION bis zum Re-Pin).
 * Kein DB-/LLM-Zugriff — rein deterministisch gegen die eingefrorene Referenz.
 */
import { runGold, UEBUNGSFALL_DIR } from '../src/apps/echoloop/qa/gold-runner';

const fixture = process.argv[2] || UEBUNGSFALL_DIR;
const r = await runGold(fixture);

console.log(r.summary);
if (!r.pass) {
  for (const m of r.mismatches) {
    console.log(`  ✗ ${m.entity} · ${m.field}`);
    console.log(`      mine  : ${JSON.stringify(m.mine)}`);
    console.log(`      golden: ${JSON.stringify(m.golden)}`);
  }
}
process.exit(r.pass ? 0 : 1);
