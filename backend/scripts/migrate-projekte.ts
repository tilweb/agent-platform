/**
 * CLI-Wrapper um `migrateAuftraegeToProjekteIfNeeded()`.
 *
 * Bei normalem Scalingo-Boot laeuft diese Migration bereits automatisch (siehe
 * `backend/src/index.ts` nach `runMigrations()`). Dieser CLI-Wrapper bleibt
 * fuer:
 *   - lokale Tests (`bun run backend/scripts/migrate-projekte.ts`)
 *   - manuelle Re-Runs auf Scalingo (`scalingo --app <app> run "bun run backend/scripts/migrate-projekte.ts"`)
 *   - Audit-/Diagnose-Laeufe (Output zeigt created/skipped pro Lauf)
 *
 * Idempotent — zweite Ausfuehrung ist No-op.
 */

import { migrateAuftraegeToProjekteIfNeeded } from '../src/apps/projektmanagement/projekt-service';

async function main(): Promise<void> {
  console.log('[migrate-projekte] Starte Migration Projektauftrag → Projekt...');
  const { created, skipped, errors } = await migrateAuftraegeToProjekteIfNeeded();
  console.log('[migrate-projekte] Zusammenfassung:');
  console.log(`  Created:  ${created}`);
  console.log(`  Skipped:  ${skipped} (bereits migriert)`);
  console.log(`  Errors:   ${errors}`);
  console.log('[migrate-projekte] Fertig.');
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('[migrate-projekte] Fatal:', err);
  process.exit(1);
});
