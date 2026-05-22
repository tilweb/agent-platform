/**
 * Vorgangsmappe — End-to-End Probe gegen den DocuWare-Tenant (lokaler User).
 *
 * Testet:
 *   1. Config-Loader (config.yaml gelesen?)
 *   2. AB-Drilldown ueber `getVorgangByReference` (mit bekannter REFERENCE)
 *   3. Strukturierte freie Suche ueber `freeFilterSearch`
 *   4. Compliance-Check
 *
 * Aufruf:
 *   cd backend && /Users/andreasbachmann/.bun/bin/bun run ../tools/docuware-test/probe-vorgangsmappe.ts
 *
 * Voraussetzungen:
 *   - data/apps/vorgangsmappe/config.yaml mit gueltiger Cabinet-ID
 *   - User andreas_bachmann hat eine DocuWare-Connection
 *   - Cabinet enthaelt mindestens ein Doc, dessen REFERENCE einem
 *     AB-Pattern entspricht
 *
 * Optional ENV: REFERENCE=AB26-12345
 */

import { registerProviders } from '../../backend/src/connections/providers';
import { loadConfig } from '../../backend/src/apps/vorgangsmappe/config-loader';
import {
  getVorgangByReference,
  freeFilterSearch,
  runComplianceCheck,
} from '../../backend/src/apps/vorgangsmappe/service';

const USER_ID = 'user_1777818915819_snl28hv';
const REFERENCE = process.env.REFERENCE || '';

function header(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  registerProviders();

  header('Step 1: Config laden');
  const cfg = await loadConfig();
  if (!cfg) {
    console.error('FATAL: data/apps/vorgangsmappe/config.yaml fehlt oder unvollstaendig.');
    process.exit(1);
  }
  console.log('Cabinet:', cfg.cabinet.displayName, `(${cfg.cabinet.id})`);
  console.log('Felder:', cfg.reference_field, '|', cfg.document_type_field);

  if (!REFERENCE) {
    console.log('\nKeine REFERENCE ENV gesetzt — bitte ein bekanntes AB-Beispiel uebergeben.');
    console.log('Beispiel: REFERENCE=AB26-12345 /Users/andreasbachmann/.bun/bin/bun run ../tools/docuware-test/probe-vorgangsmappe.ts');
    process.exit(0);
  }

  header(`Step 2: AB-Drilldown ${REFERENCE}`);
  const detail = await getVorgangByReference(USER_ID, REFERENCE);
  console.log(`Documents: ${detail.documentCount}`);
  console.log(`Date range: ${detail.dateRange?.from} – ${detail.dateRange?.to}`);
  console.log(`Vorgangstyp: ${detail.vorgangstyp}`);
  for (const doc of detail.documents.slice(0, 5)) {
    console.log(`  - [${doc.id}] ${doc.title} (${doc.fields[cfg.document_type_field] || '?'})`);
  }

  header('Step 3: Compliance-Report');
  const compliance = await runComplianceCheck(USER_ID, REFERENCE);
  console.log(`RuleSet: ${compliance.compliance.ruleSetName} (overall: ${compliance.compliance.overall})`);
  for (const item of compliance.compliance.items) {
    const tag = item.status === 'ok' ? 'OK' : item.required ? 'MISSING' : 'optional';
    console.log(`  [${tag.padEnd(8)}] ${item.label} (${item.matchedDocIds.length} Treffer)`);
  }

  header('Step 4: Freie Filter-Suche (ART_DES_DOKUMENTES wildcard "Rechnung")');
  try {
    const free = await freeFilterSearch(USER_ID, [
      { field: cfg.document_type_field, values: ['*Rechnung*'] },
    ], { count: 5 });
    console.log(`Treffer: ${free.documents.length} Docs, ${free.vorgaenge.length} Vorgaenge`);
    for (const v of free.vorgaenge.slice(0, 3)) {
      console.log(`  - ${v.reference}: ${v.documentCount} Doc(s)`);
    }
  } catch (err) {
    console.log('Hinweis: freie Suche fehlgeschlagen — Feld evtl. anders benannt:', err instanceof Error ? err.message : err);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(99);
});
